import { expect } from './helpers/testHarness.mjs';
import {
  appendVoiceTranscript,
  calculateRetentionInsights,
  validateMorphEligibility,
  calculateMorphOpacity,
  processConciergeQuery,
  calculateRetinaDimensions,
  MockLocalStorageWithQuota,
  MORPH_WATERMARK
} from './helpers/contracts.mjs';

export function registerTier3Tests(runner) {
  runner.describe('Tier 3: Cross-Feature Interactions (Pairwise Combinations)', () => {
    runner.it('T3.1: Lumina Voice -> ClientContext Treatment -> Lumina Insights trigger', () => {
      // 1. Clinician enters treatment modal and dictates session notes with Lumina Voice
      const manualTitle = 'Toxina Botulínica Preventiva';
      let sessionNotes = 'Primera sesión de modulación muscular';
      const spokenTranscript = 'Aplicación de 25 unidades en tercio superior facial con aguja 32G';
      
      sessionNotes = appendVoiceTranscript(sessionNotes, spokenTranscript);
      expect(sessionNotes).toContain('25 unidades en tercio superior facial');

      // 2. Treatment is stored in ClientContext with date 95 days prior
      const client = {
        id: 'c-interaction-1',
        name: 'Valeria Montero',
        treatments: [
          {
            id: 101,
            name: manualTitle,
            date: '2026-07-08',
            notes: sessionNotes
          }
        ]
      };

      // 3. Current date evaluation (Day 95)
      const simulatedToday = new Date('2026-10-11T00:00:00Z');
      const insights = calculateRetentionInsights(client, simulatedToday);

      expect(insights).toHaveLength(1);
      expect(insights[0].type).toBe('botox');
      expect(insights[0].elapsedDays).toBe(95);
      expect(insights[0].suggestedAction.type).toBe('rebook');
    });

    runner.it('T3.2: Lumina Insights -> Lumina Concierge synchronization', () => {
      const simulatedToday = new Date('2026-10-15T00:00:00Z');
      
      // Client has an overdue filler treatment
      const clientA = {
        id: 'c-int-2a',
        name: 'Gabriela Silva',
        treatments: [
          { id: 201, name: 'Relleno Ácido Hialurónico Pómulos', date: '2025-11-15' } // 334 days ago
        ]
      };
      const clientB = {
        id: 'c-int-2b',
        name: 'Manuel Ortiz',
        treatments: [
          { id: 202, name: 'Láser Diodo Barba', date: '2026-10-01' } // 14 days ago (no retention card)
        ]
      };

      const clients = [clientA, clientB];

      // Insights individually detects clientA
      const insightsA = calculateRetentionInsights(clientA, simulatedToday);
      const insightsB = calculateRetentionInsights(clientB, simulatedToday);
      expect(insightsA).toHaveLength(1);
      expect(insightsB).toHaveLength(0);

      // Concierge query directly extracts clientA
      const conciergeResponse = processConciergeQuery('¿Qué pacientes tienen retoques o revisiones pendientes?', clients, simulatedToday);

      expect(conciergeResponse.intent).toBe('retention_followup');
      expect(conciergeResponse.matches).toBe(1);
      expect(conciergeResponse.response).toContain('Gabriela Silva');
      expect(conciergeResponse.response).toContain('Relleno Dérmico');
    });

    runner.it('T3.3: Photo Capture -> Canvas Compression -> Lumina Morph player', () => {
      // 1. Raw photo dimensions (camera snapshot: 3840x2160)
      const rawWidth = 3840;
      const rawHeight = 2160;

      // 2. Compress via Canvas retina constraints
      const scaled = calculateRetinaDimensions(rawWidth, rawHeight, 1200, 1200);
      expect(scaled.width).toBe(1200);
      expect(scaled.height).toBe(675);

      // 3. Stored as Before & After photos in treatment
      const treatmentPhotos = [
        { url: 'data:image/jpeg;base64,mockBeforeData', type: 'before', date: '2026-05-01' },
        { url: 'data:image/jpeg;base64,mockAfterData', type: 'after', date: '2026-05-15' }
      ];

      // 4. Validated for Lumina Morph time-lapse
      const morphValidation = validateMorphEligibility(treatmentPhotos);
      expect(morphValidation.eligible).toBe(true);

      // 5. Cross-fade interpolation test
      const midOpacity = calculateMorphOpacity(50);
      expect(midOpacity).toBe(0.5);
    });

    runner.it('T3.4: Voice Dictation Notes -> Concierge Patient Dossier Lookup', () => {
      // 1. Dictate specific clinical detail via Voice
      const dictatedNote = appendVoiceTranscript(
        'Paciente con rosácea tipo 1',
        'Se detecta eritema persistente tras exposición solar. Prescribir crema con bisabolol y niacinamida.'
      );

      const client = {
        id: 'c-int-4',
        name: 'Clara Navarro',
        phone: '+34 611 222 333',
        allergies: 'Sensibilidad cutánea aguda',
        notes: dictatedNote,
        treatments: [{ id: 401, name: 'Evaluación Dérmica', date: '2026-09-20' }]
      };

      // 2. Clinician queries Concierge about Clara Navarro
      const queryResult = processConciergeQuery('Información y notas de Clara Navarro', [client]);

      expect(queryResult.intent).toBe('patient_lookup');
      expect(queryResult.patient.name).toBe('Clara Navarro');
      expect(queryResult.response).toContain('Clara Navarro');
      expect(queryResult.response).toContain('bisabolol y niacinamida');
    });

    runner.it('T3.5: Storage Quota Guard -> Treatment Addition -> Insights Stability', () => {
      const storage = new MockLocalStorageWithQuota(500); // 500 byte limit

      const clients = [
        {
          id: 'c-int-5',
          name: 'Daniela Peña',
          treatments: [
            { id: 501, name: 'Botox Frente', date: '2026-06-01' }
          ]
        }
      ];

      // Store initial state
      storage.setItem('luminadesk_clients', JSON.stringify(clients));
      expect(storage.getItem('luminadesk_clients')).toBeDefined();

      // Attempt to append huge photo payload that exceeds quota
      let quotaAlert = false;
      try {
        storage.setItem('luminadesk_clients', JSON.stringify(clients) + 'X'.repeat(600));
      } catch (err) {
        if (err.name === 'QuotaExceededError') {
          quotaAlert = true;
        }
      }

      expect(quotaAlert).toBe(true);

      // Verify that in-memory state and Insights calculations remain intact
      const refDate = new Date('2026-10-15T00:00:00Z');
      const insights = calculateRetentionInsights(clients[0], refDate);
      expect(insights).toHaveLength(1);
      expect(insights[0].type).toBe('botox');
    });

    runner.it('T3.6: Full Patient Care Lifecycle Interaction (Intake -> Voice -> Photo -> Morph -> Concierge)', () => {
      // Step 1: New client intake
      const newClient = {
        id: 'c-lifecycle-1',
        name: 'Natalia Vega',
        phone: '+34 677 888 999',
        allergies: 'Sin alergias',
        notes: 'Desea tratamiento de rejuvenecimiento labial',
        treatments: []
      };

      // Step 2: Voice session recording
      const dictatedTreatment = {
        id: 601,
        name: 'Perfilado de Labios con Ácido Hialurónico',
        date: '2026-09-01',
        notes: appendVoiceTranscript('Técnica de micro-cánula', 'Excelente simetría lograda con 0.8ml de producto.'),
        photos: {
          before: 'data:image/jpeg;base64,beforeMock',
          after: 'data:image/jpeg;base64,afterMock'
        }
      };
      newClient.treatments.push(dictatedTreatment);

      // Step 3: Photos eligible for Lumina Morph
      const photosArray = [
        { url: dictatedTreatment.photos.before, type: 'before' },
        { url: dictatedTreatment.photos.after, type: 'after' }
      ];
      const morphCheck = validateMorphEligibility(photosArray);
      expect(morphCheck.eligible).toBe(true);

      // Step 4: Concierge stats audit reflects new client and treatment
      const stats = processConciergeQuery('Dame un resumen de estadísticas', [newClient]);
      expect(stats.intent).toBe('statistics');
      expect(stats.stats.totalClients).toBe(1);
      expect(stats.stats.totalTreatments).toBe(1);
      expect(stats.stats.treatmentsWithPhotos).toBe(1);
    });
  });
}
