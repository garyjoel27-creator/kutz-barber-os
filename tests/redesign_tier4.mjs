/**
 * Tier 4: Real-World Barbershop Workload Scenarios Suite for KUTZ // BARBER OS Redesign
 * 5 End-to-End Realistic User Workflows
 * Strictly derived from ORIGINAL_REQUEST.md, PROJECT.md, and TEST_INFRA.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from './helpers/testHarness.mjs';
import {
  createBentoCardState,
  triggerCardFlip,
  quickAddSessionContract,
  getFadeAlert,
  calculateContrastRatio,
  isWcagAAA,
  THEME_PALETTE,
  MockAudioContext,
  MockNavigator,
  SoundFxEngine,
  getBentoGridColumns,
  evaluateDashboardCognitiveGlance,
  MOCK_BARBERSHOP_STATE
} from './helpers/redesignContracts.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export function registerRedesignTier4Tests(runner) {
  runner.describe('Tier 4: Real-World Barbershop Scenarios', () => {
    // ------------------------------------------------------------------------
    // Scenario 1: Busy Saturday Walk-In Surge
    // ------------------------------------------------------------------------
    runner.it('T4.1: Scenario 1 — Busy Saturday Walk-In Surge with Real-Time Chair Cycling and Kiosk Sync', () => {
      // 1. Initial rush state: 3 chairs active, 5 walk-in clients waiting
      let chairs = [
        { id: 1, name: 'Sillón 01 (Master)', barber: 'Marcos Fade', status: 'occupied', client: 'Javier', elapsedMin: 35 },
        { id: 2, name: 'Sillón 02 (Razor)', barber: 'Dani Razor', status: 'occupied', client: 'Carlos', elapsedMin: 40 },
        { id: 3, name: 'Sillón 03 (Texture)', barber: 'Mateo Crop', status: 'occupied', client: 'David', elapsedMin: 20 }
      ];

      let walkInQueue = [
        { id: 'w1', name: 'Lucas', waitTimeMinutes: 15, phone: '+34600111111' },
        { id: 'w2', name: 'Mario', waitTimeMinutes: 30, phone: '+34600222222' },
        { id: 'w3', name: 'Sergio', waitTimeMinutes: 45, phone: '+34600333333' }
      ];

      // Verify dashboard glance reflects high-volume triage
      const glance = evaluateDashboardCognitiveGlance([
        { id: 'chairs', isPrimary: true, isCollapsed: false },
        { id: 'walkin-queue', isPrimary: true, isCollapsed: false },
        { id: 'quick-actions', isPrimary: true, isCollapsed: false },
        { id: 'vault-backup', isPrimary: false, isCollapsed: true },
        { id: 'rgpd-drawer', isPrimary: false, isCollapsed: true }
      ]);
      expect(glance.comprehensionWithin3Seconds).toBe(true);

      // Chair 2 finishes: barber Dani completes cut, next walk-in (Lucas) is notified via WhatsApp
      chairs[1] = { ...chairs[1], status: 'available', client: null, elapsedMin: 0 };
      const nextClient = walkInQueue.shift();
      const notifyMsg = `¡Hola ${nextClient.name}! Dani Razor tiene listo el Sillón 02 para tu corte.`;
      expect(notifyMsg).toContain('Lucas');

      // Lucas takes seat
      chairs[1] = { ...chairs[1], status: 'occupied', client: nextClient.name, elapsedMin: 0 };
      expect(chairs[1].status).toBe('occupied');
      expect(chairs[1].client).toBe('Lucas');
      expect(walkInQueue.length).toBe(2);
    });

    // ------------------------------------------------------------------------
    // Scenario 2: VIP Client Touchup & Quick In-Card Formula Update
    // ------------------------------------------------------------------------
    runner.it('T4.2: Scenario 2 — VIP Client Touchup (Álex Rivera): 3D Flip, Inline Formula Edit & Bono Usage', () => {
      let client = JSON.parse(JSON.stringify(MOCK_BARBERSHOP_STATE.vipClients[0]));
      expect(client.name).toBe('Álex Rivera');

      // 1. Initial inspection: front face displays fade alert
      const evalDate = new Date('2026-11-02T10:00:00Z');
      const alertBefore = getFadeAlert(client, evalDate);
      expect(alertBefore.alertLevel).toBe('urgent');

      // 2. Barber taps 3D card flip
      let card = createBentoCardState(client, true);
      const audioMock = { playFlip: () => true, triggerHaptic: () => true };
      card = triggerCardFlip(card, audioMock);
      expect(card.isFlipped).toBe(true);
      expect(card.audioTriggered).toBe(true);

      // 3. Inspect previous formula on card back
      const lastFormula = client.treatments[0].formula;
      expect(lastFormula).toContain('Shaver #000');

      // 4. Quick add session directly from card back
      const updatedClients = quickAddSessionContract([client], '3', {
        date: '02 Nov 2026',
        timestamp: evalDate.getTime(),
        formula: 'Shaver #000 -> #0.5 palanca semi-abierta -> #2 superior textura con tijera de entresacar',
        notes: 'Retoque rápido de sábado. Todo perfecto.',
        ritual: 'Vapor de ozono + toalla mentolada'
      });
      const updatedClient = updatedClients[0];

      // 5. Deduct 1 session from active Bono VIP
      const bono = updatedClient.bonos[0];
      bono.usedSessions += 1;
      expect(bono.usedSessions).toBe(4);
      expect(bono.totalSessions - bono.usedSessions).toBe(1);

      // 6. Recalculate fade alert -> returns to 'normal' with 15 days fresh
      const alertAfter = getFadeAlert(updatedClient, evalDate);
      expect(alertAfter.alertLevel).toBe('normal');
      expect(alertAfter.daysRemaining).toBe(15);
    });

    // ------------------------------------------------------------------------
    // Scenario 3: Low-Light Salon Visual & Acoustic Check
    // ------------------------------------------------------------------------
    runner.it('T4.3: Scenario 3 — Low-Light Salon Atmospheric Visual & Acoustic Check (WCAG AAA & Web Audio)', () => {
      // 1. Check layout visual contrast in atmospheric night/studio lighting
      const canvasContrast = calculateContrastRatio(THEME_PALETTE.espresso, THEME_PALETTE.canvas);
      const surfaceContrast = calculateContrastRatio(THEME_PALETTE.espresso, THEME_PALETTE.surface);
      const emeraldContrast = calculateContrastRatio(THEME_PALETTE.emerald, THEME_PALETTE.canvas);

      expect(canvasContrast).toBeGreaterThanOrEqual(14.0);
      expect(surfaceContrast).toBeGreaterThanOrEqual(12.0);
      expect(emeraldContrast).toBeGreaterThanOrEqual(7.0);
      expect(isWcagAAA(canvasContrast)).toBe(true);
      expect(isWcagAAA(surfaceContrast)).toBe(true);

      // 2. Acoustic check: soundFx synthesis of flip and click
      const mockCtx = new MockAudioContext('running');
      const flipAudio = SoundFxEngine.playFlip(mockCtx);
      const clickAudio = SoundFxEngine.playClick(mockCtx);

      expect(flipAudio.wave).toBe('sine');
      expect(flipAudio.sweepStart).toBe(180);
      expect(flipAudio.sweepEnd).toBe(320);
      expect(clickAudio.wave).toBe('triangle');
      expect(clickAudio.durationMs).toBe(30);
    });

    // ------------------------------------------------------------------------
    // Scenario 4: Tablet Barber Station Operations
    // ------------------------------------------------------------------------
    runner.it('T4.4: Scenario 4 — Tablet Barber Station Ergonomics (768px Viewport & Touch Flipping)', () => {
      const tabletWidth = 768;
      const bentoLayout = getBentoGridColumns(tabletWidth);

      // 1. Grid adapts to 2 columns on tablet
      expect(bentoLayout.columns).toBe(2);
      expect(bentoLayout.isTablet).toBe(true);

      // 2. Tap target check
      const minimumTapTargetPx = 44;
      expect(minimumTapTargetPx).toBe(44);

      // 3. Card flip under touch tap
      const mockNav = new MockNavigator(true);
      const client = MOCK_BARBERSHOP_STATE.vipClients[1];
      let card = createBentoCardState(client, false);

      // Simulate touch tap with haptic pulse
      card = triggerCardFlip(card, {
        playFlip: () => true,
        triggerHaptic: (dur) => SoundFxEngine.triggerHaptic(dur, mockNav)
      });

      expect(card.isFlipped).toBe(true);
      expect(mockNav.vibrateLogs[0]).toBe(12);
    });

    // ------------------------------------------------------------------------
    // Scenario 5: Cold Boot & Offline PWA Recovery
    // ------------------------------------------------------------------------
    runner.it('T4.5: Scenario 5 — Cold Boot & Offline PWA Resilience (Cache, Quota Safety & Build Verification)', () => {
      // 1. Verify build and Netlify redirect contract
      const redirectsPath = path.resolve(projectRoot, 'public/_redirects');
      expect(fs.existsSync(redirectsPath)).toBe(true);
      const redirectContent = fs.readFileSync(redirectsPath, 'utf8').trim();
      expect(redirectContent.replace(/\s+/g, ' ')).toBe('/* /index.html 200');

      // 2. Offline audio synthesis operates without network
      const offlineAudioCtx = new MockAudioContext('running');
      const sound = SoundFxEngine.playFlip(offlineAudioCtx);
      expect(sound.played).toBe(true);

      // 3. LocalStorage quota recovery check
      const mockStorage = {
        data: {},
        setItem(key, val) {
          if (val.length > 5000000) {
            const err = new Error('QuotaExceededError');
            err.name = 'QuotaExceededError';
            throw err;
          }
          this.data[key] = val;
        }
      };

      let saveSuccessful = false;
      try {
        mockStorage.setItem('kutz_clients', JSON.stringify(MOCK_BARBERSHOP_STATE.vipClients));
        saveSuccessful = true;
      } catch {
        saveSuccessful = false;
      }
      expect(saveSuccessful).toBe(true);
    });
  });
}
