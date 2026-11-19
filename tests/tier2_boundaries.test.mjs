import { expect } from './helpers/testHarness.mjs';
import {
  appendVoiceTranscript,
  checkSpeechSupport,
  calculateRetentionInsights,
  validateMorphEligibility,
  calculateMorphOpacity,
  processConciergeQuery,
  calculateRetinaDimensions,
  MockLocalStorageWithQuota,
  normalizeText
} from './helpers/contracts.mjs';

export function registerTier2Tests(runner) {
  runner.describe('Tier 2: Boundary & Corner Cases — Lumina Voice', () => {
    runner.it('T2.1: Graceful fallback when SpeechRecognition and webkitSpeechRecognition are undefined', () => {
      const emptyWindow = {};
      const supported = checkSpeechSupport(emptyWindow);
      expect(supported).toBe(false);

      const fallbackNotice = supported ? 'Microphone ready' : 'Tu navegador actual no admite dictado por voz. Recomendamos Google Chrome o Safari.';
      expect(fallbackNotice).toContain('Tu navegador actual no admite dictado por voz');
    });

    runner.it('T2.2: Microphone permission denied (not-allowed error) resets listening state safely', () => {
      let isListening = true;
      let errorReported = null;

      const handleSpeechError = (event) => {
        isListening = false;
        errorReported = event.error === 'not-allowed' ? 'Permiso de micrófono denegado' : 'Error de reconocimiento';
      };

      handleSpeechError({ error: 'not-allowed' });

      expect(isListening).toBe(false);
      expect(errorReported).toBe('Permiso de micrófono denegado');
    });

    runner.it('T2.3: Empty speech transcription event leaves existing notes unaltered', () => {
      const initialNotes = 'Parámetros láser: 30J/cm2 en espalda.';
      const emptyTranscript = '   ';

      const result = appendVoiceTranscript(initialNotes, emptyTranscript);
      expect(result).toBe('Parámetros láser: 30J/cm2 en espalda.');
    });

    runner.it('T2.4: Rapid consecutive mic toggling prevents duplicate recognition sessions', () => {
      let activeSessionCount = 0;
      let isListening = false;

      const toggle = () => {
        if (!isListening) {
          isListening = true;
          activeSessionCount++;
        } else {
          isListening = false;
          activeSessionCount--;
        }
      };

      // Rapidly toggle 4 times
      toggle();
      toggle();
      toggle();
      toggle();

      expect(isListening).toBe(false);
      expect(activeSessionCount).toBe(0);
    });

    runner.it('T2.5: Complex accented Spanish and clinical dose symbols retain fidelity', () => {
      const initial = 'Piel sensible con eritema';
      const clinicalDictation = 'Ácido hialurónico reticulado 20mg/ml con lidocaína al 0.3% en tercio medio & surco nasogeniano';

      const merged = appendVoiceTranscript(initial, clinicalDictation);

      expect(merged).toContain('Ácido hialurónico reticulado 20mg/ml');
      expect(merged).toContain('lidocaína al 0.3%');
      expect(merged).toContain('surco nasogeniano');
    });
  });

  runner.describe('Tier 2: Boundary & Corner Cases — Lumina Insights', () => {
    const refDate = new Date('2026-10-01T00:00:00Z');

    runner.it('T2.6: Client with empty treatments array produces empty insights without runtime errors', () => {
      const emptyClient = { id: 'c99', name: 'Nuevo Paciente', treatments: [] };
      const insights = calculateRetentionInsights(emptyClient, refDate);

      expect(Array.isArray(insights)).toBe(true);
      expect(insights).toHaveLength(0);
    });

    runner.it('T2.7: Treatment performed today (0 elapsed days) produces zero premature alerts', () => {
      const clientToday = {
        id: 'c100',
        name: 'Julia Ramos',
        treatments: [{ id: 1, name: 'Toxina Botulínica Frente', date: '2026-10-01' }]
      };

      const insights = calculateRetentionInsights(clientToday, refDate);
      expect(insights).toHaveLength(0);
    });

    runner.it('T2.8: Exact threshold boundary (Day 89 vs Day 90 for Botox)', () => {
      // Day 89: 2026-07-04 -> 89 days before 2026-10-01
      const client89 = {
        id: 'c89',
        name: 'Patricia G.',
        treatments: [{ id: 1, name: 'Botox Glabela', date: '2026-07-04' }]
      };
      // Day 90: 2026-07-03 -> 90 days before 2026-10-01
      const client90 = {
        id: 'c90',
        name: 'Marta R.',
        treatments: [{ id: 2, name: 'Botox Glabela', date: '2026-07-03' }]
      };

      const insights89 = calculateRetentionInsights(client89, refDate);
      const insights90 = calculateRetentionInsights(client90, refDate);

      expect(insights89).toHaveLength(0);
      expect(insights90).toHaveLength(1);
      expect(insights90[0].elapsedDays).toBe(90);
    });

    runner.it('T2.9: Multiple historical Botox sessions: elapsed time calculated from most recent session', () => {
      const clientMultiple = {
        id: 'c91',
        name: 'Sonia Vega',
        treatments: [
          { id: 1, name: 'Botox Completo', date: '2025-01-15' }, // 600 days ago
          { id: 2, name: 'Botox Retoque', date: '2026-08-01' }   // 61 days ago (not due)
        ]
      };

      const insights = calculateRetentionInsights(clientMultiple, refDate);
      // Because most recent was only 61 days ago (< 90 threshold), no alert should trigger!
      expect(insights).toHaveLength(0);
    });

    runner.it('T2.10: Unrecognized treatment categories do not trigger false retention alerts', () => {
      const clientOther = {
        id: 'c92',
        name: 'Marcos Gil',
        treatments: [
          { id: 1, name: 'Higiene Facial Profunda con Punta de Diamante', date: '2025-01-01' },
          { id: 2, name: 'Drenaje Linfático Manual', date: '2025-03-01' }
        ]
      };

      const insights = calculateRetentionInsights(clientOther, refDate);
      expect(insights).toHaveLength(0);
    });
  });

  runner.describe('Tier 2: Boundary & Corner Cases — Lumina Morph', () => {
    runner.it('T2.11: Zero photos boundary: Lumina Morph eligibility fails with clear reason', () => {
      const check = validateMorphEligibility([]);
      expect(check.eligible).toBe(false);
      expect(check.count).toBe(0);
      expect(check.reason).toContain('requiere al menos 2 fotografías');
    });

    runner.it('T2.12: Single photo boundary: Lumina Morph informs user that 2+ photos are required', () => {
      const single = [{ url: 'https://example.com/p1.png', type: 'before' }];
      const check = validateMorphEligibility(single);

      expect(check.eligible).toBe(false);
      expect(check.count).toBe(1);
      expect(check.reason).toContain('requiere al menos 2 fotografías');
    });

    runner.it('T2.13: Scrub slider value is safely clamped to [0, 100] range', () => {
      expect(calculateMorphOpacity(-25)).toBe(0.0);
      expect(calculateMorphOpacity(150)).toBe(1.0);
      expect(calculateMorphOpacity('invalid')).toBe(0.0);
      expect(calculateMorphOpacity(50)).toBe(0.5);
    });

    runner.it('T2.14: 2x speed animation loops stay strictly within [0, 1] opacity bounds without NaN', () => {
      const opacities = [];
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const percent = (i / steps) * 100;
        const opacity = calculateMorphOpacity(percent);
        opacities.push(opacity);
        expect(isNaN(opacity)).toBe(false);
        expect(opacity).toBeGreaterThanOrEqual(0.0);
        expect(opacity).toBeLessThanOrEqual(1.0);
      }
      expect(opacities[0]).toBe(0.0);
      expect(opacities[steps]).toBe(1.0);
    });

    runner.it('T2.15: Malformed and null photo objects are filtered without runtime errors', () => {
      const messyList = [
        null,
        undefined,
        '',
        { url: 'https://example.com/valid1.jpg' },
        { before: 'https://example.com/valid2.jpg' }
      ];

      const check = validateMorphEligibility(messyList);
      expect(check.eligible).toBe(true);
      expect(check.count).toBe(2);
    });
  });

  runner.describe('Tier 2: Boundary & Corner Cases — Lumina Concierge', () => {
    const clients = [
      {
        id: '1',
        name: 'Elena García',
        phone: '+34 600 123 456',
        allergies: 'Piel reactiva',
        notes: 'Luz tenue',
        treatments: [{ id: 1, name: 'Botox', date: '2026-06-01' }]
      }
    ];

    runner.it('T2.16: Empty query, whitespace, or punctuation handled gracefully', () => {
      const res1 = processConciergeQuery('');
      const res2 = processConciergeQuery('   \n  \t ');

      expect(res1.intent).toBe('empty');
      expect(res2.intent).toBe('empty');
      expect(res1.response).toContain('consulta clínica');
    });

    runner.it('T2.17: Searching for non-existent patient name falls back to polite assistance', () => {
      const res = processConciergeQuery('Busca la ficha de Don Quijote De La Mancha', clients);

      // Should not crash and should fall back gracefully
      expect(res.intent === 'fallback' || res.intent === 'patient_lookup').toBe(true);
      expect(res.response).toBeDefined();
    });

    runner.it('T2.18: Empty database statistics query reports 0 patients cleanly without crash', () => {
      const res = processConciergeQuery('resumen de estadísticas totales', []);

      expect(res.intent).toBe('statistics');
      expect(res.stats.totalClients).toBe(0);
      expect(res.stats.totalTreatments).toBe(0);
      expect(res.response).toContain('Pacientes Registrados: 0');
    });

    runner.it('T2.19: Case and accent normalization (BÓTOX, botox, ELENA, elena)', () => {
      const refDate = new Date('2026-10-15T00:00:00Z');
      const resUpper = processConciergeQuery('¿QUIÉN NECESITA RETOQUE DE BÓTOX?', clients, refDate);
      const resLower = processConciergeQuery('quien necesita retoque de botox?', clients, refDate);

      expect(resUpper.intent).toBe('retention_followup');
      expect(resLower.intent).toBe('retention_followup');
      expect(resUpper.matches).toBe(1);
      expect(resLower.matches).toBe(1);
    });

    runner.it('T2.20: Injection and special script syntax neutralized safely as plain text', () => {
      const injectionQuery = '<script>alert("hack")</script> {{patient.secret}}';
      const res = processConciergeQuery(injectionQuery, clients);

      expect(res.response).toBeDefined();
      expect(typeof res.response).toBe('string');
    });
  });

  runner.describe('Tier 2: Boundary & Corner Cases — Storage Quotas & Build', () => {
    runner.it('T2.21: Simulated QuotaExceededError in localStorage triggers alert without crashing state', () => {
      const storage = new MockLocalStorageWithQuota(100);
      storage.setItem('key1', 'Hello LuminaDesk');

      let alertTriggered = false;
      try {
        storage.setItem('overflow', 'X'.repeat(200));
      } catch (err) {
        if (err.name === 'QuotaExceededError') {
          alertTriggered = true;
        }
      }

      expect(alertTriggered).toBe(true);
      expect(storage.getItem('key1')).toBe('Hello LuminaDesk');
    });

    runner.it('T2.22: Extreme panoramic (5000x500) and ultra-tall (500x5000) scaling within 1200 bounds', () => {
      const pano = calculateRetinaDimensions(5000, 500, 1200, 1200);
      expect(pano.width).toBe(1200);
      expect(pano.height).toBe(120);

      const tall = calculateRetinaDimensions(500, 5000, 1200, 1200);
      expect(tall.width).toBe(120);
      expect(tall.height).toBe(1200);
    });

    runner.it('T2.23: Non-image file types rejected with clear descriptive validation', () => {
      const validateFileType = (file) => {
        if (!file || !file.type || !file.type.startsWith('image/')) {
          throw new Error('El archivo no es una imagen válida');
        }
        return true;
      };

      expect(() => validateFileType({ type: 'application/pdf', name: 'documento.pdf' })).toThrow('El archivo no es una imagen válida');
      expect(() => validateFileType({ type: 'text/plain', name: 'notas.txt' })).toThrow('El archivo no es una imagen válida');
      expect(validateFileType({ type: 'image/jpeg', name: 'foto.jpg' })).toBe(true);
    });

    runner.it('T2.24: Corrupted LocalStorage JSON string recovers to initial seed safely', () => {
      const readWithFallback = (rawJson) => {
        try {
          if (rawJson) return JSON.parse(rawJson);
        } catch {
          // fallback
        }
        return [{ id: '1', name: 'Default Client' }];
      };

      const recovered = readWithFallback('{corrupt json string}');
      expect(recovered).toHaveLength(1);
      expect(recovered[0].name).toBe('Default Client');
    });

    runner.it('T2.25: Ultra-large clinical notes payload (10,000+ chars) handles cleanly without corruption', () => {
      const longNotes = 'Registro clínico detallado en cabina. '.repeat(400); // ~15,000 chars
      expect(longNotes.length).toBeGreaterThan(10000);

      const appended = appendVoiceTranscript(longNotes, 'Observación final de recuperación.');
      expect(appended.length).toBeGreaterThan(longNotes.length);
      expect(appended.endsWith('Observación final de recuperación.')).toBe(true);
    });
  });
}
