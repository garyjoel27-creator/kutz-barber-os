import { expect } from './helpers/testHarness.mjs';
import {
  appendVoiceTranscript,
  calculateRetentionInsights,
  validateMorphEligibility,
  calculateMorphOpacity,
  getMorphCycleDuration,
  processConciergeQuery,
  calculateRetinaDimensions,
  MockLocalStorageWithQuota,
  MORPH_WATERMARK
} from './helpers/contracts.mjs';

export function registerTier4Tests(runner) {
  runner.describe('Tier 4: Real-World Clinical Workload Scenarios', () => {
    runner.it('T4.1: Scenario 1 — VIP Patient Intake & Baseline Dermic Assessment', () => {
      // Step 1: Onboard VIP patient
      const newVipClient = {
        id: 'vip-001',
        name: 'Doña Victoria Alba',
        phone: '+34 688 111 222',
        email: 'victoria.alba@luxury.es',
        allergies: 'Sensibilidad a parabenos y fragancias sintéticas. Piel reactiva con tendencia a cuperosis.',
        notes: 'Preferencia por cabina privada con aromaterapia lavanda suave y música clásica.',
        treatments: []
      };

      // Step 2: Clinician initiates treatment and uses Lumina Voice to dictate clinical assessment
      let treatmentNotes = 'Evaluación dérmica inicial con luz de Wood.';
      const vocalObservation1 = 'Fototipo Fitzpatrick II, eritema malar difuso sin pústulas';
      const vocalObservation2 = 'Barrera lipídica comprometida en mejillas, se prescribe protocolo calmante sin retinoides agresivos';

      treatmentNotes = appendVoiceTranscript(treatmentNotes, vocalObservation1);
      treatmentNotes = appendVoiceTranscript(treatmentNotes, vocalObservation2);

      expect(treatmentNotes).toContain('Fototipo Fitzpatrick II');
      expect(treatmentNotes).toContain('Barrera lipídica comprometida');

      // Step 3: Raw camera photo taken in cabin (4032x3024 raw iPhone format)
      const rawWidth = 4032;
      const rawHeight = 3024;
      const compressedDims = calculateRetinaDimensions(rawWidth, rawHeight, 1200, 1200);

      expect(compressedDims.width).toBe(1200);
      expect(compressedDims.height).toBe(900);

      // Step 4: Save initial treatment into dossier
      const initialTreatment = {
        id: Date.now(),
        name: 'Diagnóstico Facial Basal & Estabilización Cutánea',
        date: '2026-10-01',
        notes: treatmentNotes,
        photos: {
          before: 'data:image/jpeg;base64,vipBaselinePhotoBase64',
          after: null
        }
      };
      newVipClient.treatments.push(initialTreatment);

      expect(newVipClient.treatments).toHaveLength(1);
      expect(newVipClient.treatments[0].photos.before).toBeDefined();
    });

    runner.it('T4.2: Scenario 2 — 4-Month Botox Retention & WhatsApp Outreach Workflow', () => {
      // Reference date: Mid October 2026
      const referenceToday = new Date('2026-10-15T00:00:00Z');

      // Patient who received Botox 105 days ago (around July 2, 2026)
      const patient = {
        id: 'patient-retention-botox',
        name: 'Mercedes Castillo',
        phone: '+34 655 444 333',
        treatments: [
          {
            id: 88,
            name: 'Toxina Botulínica Frente y Entrecejo',
            date: '2026-07-02',
            notes: '35 UI Vistabel. Corrección de arrugas hipercinéticas.'
          }
        ]
      };

      // Step 1: System computes retention insights
      const insights = calculateRetentionInsights(patient, referenceToday);

      expect(insights).toHaveLength(1);
      const botoxCard = insights[0];
      expect(botoxCard.type).toBe('botox');
      expect(botoxCard.elapsedDays).toBe(105);
      expect(botoxCard.thresholdDays).toBe(90);
      expect(botoxCard.urgency).toBe('alta'); // >= 100 days

      // Step 2: Clinician verifies pre-drafted WhatsApp message
      expect(botoxCard.whatsappDraft).toContain('Mercedes Castillo');
      expect(botoxCard.whatsappDraft).toContain('105 días');
      expect(botoxCard.whatsappDraft).toContain('LuminaDesk');

      // Step 3: Clinician executes "Agendar Retoque" action
      expect(botoxCard.suggestedAction.type).toBe('rebook');
      const nextSession = {
        clientId: patient.id,
        name: botoxCard.suggestedAction.treatmentName,
        date: '2026-10-16',
        notes: `Sesión de retoque programada por recomendación Lumina Insights (${botoxCard.elapsedDays} días pos-tratamiento previo).`
      };
      patient.treatments.push(nextSession);

      expect(patient.treatments).toHaveLength(2);
      expect(patient.treatments[1].name).toBe('Retoque Toxina Botulínica');
    });

    runner.it('T4.3: Scenario 3 — 6-Month Cross-Fade Evolution Review with Atelier Branding', () => {
      // Patient with Before and After treatment photos
      const patientPhotos = [
        {
          url: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15',
          type: 'before',
          label: 'Basal (Marzo 2026)'
        },
        {
          url: 'https://images.unsplash.com/photo-1531299204812-e6d44d9a185c',
          type: 'after',
          label: 'Evolución 6 meses (Septiembre 2026)'
        }
      ];

      // Step 1: Validate modal eligibility
      const eligibility = validateMorphEligibility(patientPhotos);
      expect(eligibility.eligible).toBe(true);
      expect(eligibility.count).toBe(2);

      // Step 2: Validate atelier watermark branding
      expect(MORPH_WATERMARK).toBe('LuminaDesk • Atelier & Clinical Management');

      // Step 3: Test 0.5x slow-motion playback timing
      const slowCycleDuration = getMorphCycleDuration(0.5);
      expect(slowCycleDuration).toBe(4000); // 4 seconds for elegant delicate inspection

      // Step 4: Clinician pauses and scrubs to 50% opacity to highlight smooth tissue remodeling
      const halfwayOpacity = calculateMorphOpacity(50);
      expect(halfwayOpacity).toBe(0.5);

      // Step 5: Full transition opacity at 100%
      const finalOpacity = calculateMorphOpacity(100);
      expect(finalOpacity).toBe(1.0);
    });

    runner.it('T4.4: Scenario 4 — High-Volume Clinic Day Under Storage Stress', () => {
      // 5 consecutive patients on a packed clinic day
      const storage = new MockLocalStorageWithQuota(5 * 1024 * 1024); // 5MB simulated quota
      const roster = [];

      for (let i = 1; i <= 5; i++) {
        // Raw photo 4000x3000 downscaled
        const dims = calculateRetinaDimensions(4000, 3000, 1200, 1200);
        expect(dims.width).toBe(1200);
        expect(dims.height).toBe(900);

        // Simulated compressed Base64 (~150KB per photo)
        const compressedBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(150 * 1024);

        const client = {
          id: `patient-batch-${i}`,
          name: `Paciente ${i}`,
          treatments: [
            {
              id: i * 10,
              name: `Tratamiento Facial Sesión ${i}`,
              date: '2026-10-15',
              notes: appendVoiceTranscript('Sesión estándar', 'Paciente tolera procedimiento sin incidencias.'),
              photos: {
                before: compressedBase64,
                after: compressedBase64
              }
            }
          ]
        };
        roster.push(client);
      }

      // Persist full clinic day roster
      storage.setItem('luminadesk_clients', JSON.stringify(roster));
      const persisted = JSON.parse(storage.getItem('luminadesk_clients'));

      expect(persisted).toHaveLength(5);
      expect(persisted[4].name).toBe('Paciente 5');
      expect(storage.usedBytes).toBeLessThan(storage.quotaBytes);
    });

    runner.it('T4.5: Scenario 5 — Clinical Director End-of-Day Audit via AI Concierge', () => {
      const refDate = new Date('2026-10-15T00:00:00Z');
      const clinicData = [
        {
          id: '1',
          name: 'Elena García',
          treatments: [
            { id: 1, name: 'Toxina Botulínica Glabela', date: '2026-06-15' } // ~122 days ago (due)
          ]
        },
        {
          id: '2',
          name: 'Carlos Soler',
          treatments: [
            { id: 2, name: 'Relleno Ácido Hialurónico Pómulos', date: '2025-10-01' } // ~379 days ago (due)
          ]
        },
        {
          id: '3',
          name: 'Mireia Valls',
          treatments: [
            { id: 3, name: 'Láser Diodo Piernas', date: '2026-10-10' } // Recent
          ]
        }
      ];

      // 1. Director asks for clinic statistics
      const statsQuery = processConciergeQuery('Dame un resumen de estadísticas de la clínica', clinicData);
      expect(statsQuery.intent).toBe('statistics');
      expect(statsQuery.stats.totalClients).toBe(3);
      expect(statsQuery.stats.totalTreatments).toBe(3);

      // 2. Director queries follow-ups and touch-ups
      const followUpQuery = processConciergeQuery('¿Qué pacientes necesitan seguimiento o retoque?', clinicData, refDate);
      expect(followUpQuery.intent).toBe('retention_followup');
      expect(followUpQuery.matches).toBe(2);
      expect(followUpQuery.response).toContain('Elena García');
      expect(followUpQuery.response).toContain('Carlos Soler');

      // 3. Director asks for post-treatment protocol guidance
      const protocolQuery = processConciergeQuery('Protocolo cuidados post peeling químico', clinicData);
      expect(protocolQuery.intent).toBe('protocol_knowledge');
      expect(protocolQuery.response).toContain('SPF 50+');
    });
  });
}
