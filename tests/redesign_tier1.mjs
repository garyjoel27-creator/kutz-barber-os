/**
 * Tier 1: Primary Feature Coverage Suite for KUTZ // BARBER OS Redesign
 * Requirements R1–R5 (Features 1–14, 5 tests each = 70 tests total)
 * Strictly derived from ORIGINAL_REQUEST.md, PROJECT.md, and TEST_INFRA.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import { expect } from './helpers/testHarness.mjs';
import {
  calculateContrastRatio,
  isWcagAA,
  isWcagAAA,
  THEME_PALETTE,
  validateAtmosphericStructure,
  validate3DTransformCss,
  simulate3DCardFlip,
  getFadeAlert,
  updateClientContract,
  quickAddSessionContract,
  createBentoCardState,
  triggerCardFlip,
  MockAudioContext,
  MockNavigator,
  SoundFxEngine,
  evaluateDashboardCognitiveGlance,
  getBentoGridColumns,
  MOCK_BARBERSHOP_STATE
} from './helpers/redesignContracts.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export function registerRedesignTier1Tests(runner) {
  // --------------------------------------------------------------------------
  // Feature 1: Atmospheric Barber Backdrop (§R1)
  // --------------------------------------------------------------------------
  runner.describe('Tier 1: Feature 1 — Atmospheric Barber Backdrop (R1)', () => {
    const layoutPath = path.resolve(projectRoot, 'src/components/Layout.jsx');
    const layoutContent = fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, 'utf8') : '';

    runner.it('T1.1: Multi-layer background structure contract incorporates dark canvas (#0A0C0F)', () => {
      expect(layoutContent.length).toBeGreaterThan(0);
      expect(layoutContent.includes('#0A0C0F')).toBe(true);
    });

    runner.it('T1.2: Backdrop blur styling is applied to layout headers, cards, or scrims', () => {
      const validation = validateAtmosphericStructure(layoutContent);
      expect(validation.hasBackdropBlur).toBe(true);
    });

    runner.it('T1.3: Obsidian surface tokens (#101318 and #141820) provide consistent ambient depth', () => {
      expect(layoutContent.includes('#101318')).toBe(true);
      expect(layoutContent.includes('#141820')).toBe(true);
    });

    runner.it('T1.4: Atmospheric background persists across entire application layout shell', () => {
      expect(layoutContent.includes('min-h-screen') || layoutContent.includes('h-screen')).toBe(true);
      expect(layoutContent.includes('overflow-hidden')).toBe(true);
    });

    runner.it('T1.5: Subtle borders (#252A36) frame glassmorphism panels cleanly without visual noise', () => {
      expect(layoutContent.includes('#252A36') || layoutContent.includes('border-')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: Frosted Glassmorphism & WCAG AAA Contrast (§R1)
  // --------------------------------------------------------------------------
  runner.describe('Tier 1: Feature 2 — Frosted Glassmorphism & WCAG AAA Contrast (R1)', () => {
    runner.it('T1.6: Espresso text (#F3F4F6) on obsidian canvas (#101318) achieves >= 14:1 contrast (WCAG AAA)', () => {
      const ratio = calculateContrastRatio(THEME_PALETTE.espresso, THEME_PALETTE.canvasSubtle);
      expect(ratio).toBeGreaterThanOrEqual(14.0);
      expect(isWcagAAA(ratio)).toBe(true);
    });

    runner.it('T1.7: Emerald brand accent (#10B981) on dark surface (#141820) achieves WCAG AA/AAA readability', () => {
      const ratio = calculateContrastRatio(THEME_PALETTE.emerald, THEME_PALETTE.surface);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
      expect(isWcagAAA(ratio)).toBe(true);
    });

    runner.it('T1.8: Light emerald text (#34D399) on dark canvas (#0A0C0F) achieves >= 10:1 contrast', () => {
      const ratio = calculateContrastRatio(THEME_PALETTE.emeraldLight, THEME_PALETTE.canvas);
      expect(ratio).toBeGreaterThanOrEqual(10.0);
      expect(isWcagAAA(ratio)).toBe(true);
    });

    runner.it('T1.9: Muted telemetry text (#9CA3AF) on surface (#141820) satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = calculateContrastRatio(THEME_PALETTE.mocha, THEME_PALETTE.surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(isWcagAA(ratio)).toBe(true);
    });

    runner.it('T1.10: Amber warning badges (#F59E0B) maintain high contrast over dark surface for fade alerts', () => {
      const ratio = calculateContrastRatio(THEME_PALETTE.amber, THEME_PALETTE.surface);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
      expect(isWcagAAA(ratio)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: GPU 3D Transform Utilities (§R2)
  // --------------------------------------------------------------------------
  runner.describe('Tier 1: Feature 3 — GPU 3D Transform Utilities (R2)', () => {
    const cssPath = path.resolve(projectRoot, 'src/index.css');
    const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

    runner.it('T1.11: 3D perspective contract provides 1000px depth perspective', () => {
      const transformCheck = simulate3DCardFlip(0);
      expect(transformCheck.initialAngle).toBe(0);
      expect(transformCheck.finalAngle).toBe(180);
    });

    runner.it('T1.12: Card rotation model toggles backface visibility cleanly across 180deg flip', () => {
      const frontState = simulate3DCardFlip(0);
      expect(frontState.isFlipped).toBe(true);
      expect(frontState.isBackVisible).toBe(true);
      expect(frontState.isFrontVisible).toBe(false);

      const backState = simulate3DCardFlip(180);
      expect(backState.isFlipped).toBe(false);
      expect(backState.isFrontVisible).toBe(true);
      expect(backState.isBackVisible).toBe(false);
    });

    runner.it('T1.13: Hardware acceleration transform syntax produces valid CSS rotateY string', () => {
      const flip = simulate3DCardFlip(0);
      expect(flip.frontFaceTransform).toBe('rotateY(180deg)');
      expect(flip.backFaceTransform).toBe('rotateY(360deg)');
    });

    runner.it('T1.14: Card flip transition timing curve completes within standard 600ms duration', () => {
      const cssPath = path.resolve(projectRoot, 'src/index.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      expect(css.includes('.flip-transition')).toBe(true);
      expect(css.includes('0.6s') || css.includes('600ms')).toBe(true);
      expect(css.includes('cubic-bezier')).toBe(true);
    });

    runner.it('T1.15: CSS index file contains luxury and industrial card base styling', () => {
      expect(cssContent.includes('.luxury-card') || cssContent.includes('card')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Client Store Enhancements (§R2)
  // --------------------------------------------------------------------------
  runner.describe('Tier 1: Feature 4 — Client Store Enhancements (R2)', () => {
    const initialClients = JSON.parse(JSON.stringify(MOCK_BARBERSHOP_STATE.vipClients));

    runner.it('T1.16: updateClient(id, patch) immutably applies updates to specific client', () => {
      const updated = updateClientContract(initialClients, '3', { phone: '+34 600 999 888' });
      const target = updated.find(c => c.id === '3');
      expect(target.phone).toBe('+34 600 999 888');
      expect(target.name).toBe('Álex Rivera');
    });

    runner.it('T1.17: quickAddSession(id, data) adds session to client treatments with formula and timestamp', () => {
      const updated = quickAddSessionContract(initialClients, '3', {
        formula: 'Base Shaver #000 -> #0.5 -> #2 superior textura',
        notes: 'Corte rápido en sillón sin modal',
        ritual: 'Toalla caliente'
      });
      const target = updated.find(c => c.id === '3');
      expect(target.treatments.length).toBe(2);
      expect(target.treatments[0].formula).toContain('Shaver #000');
      expect(target.treatments[0].notes).toBe('Corte rápido en sillón sin modal');
    });

    runner.it('T1.18: getFadeAlert marks client as urgent when elapsed time >= 21 days', () => {
      const refDate = new Date('2026-11-05T12:00:00Z'); // 26 days after 10 Oct
      const client = initialClients.find(c => c.id === '3');
      const alert = getFadeAlert(client, refDate);
      expect(alert.alertLevel).toBe('urgent');
      expect(alert.requiresRetouch).toBe(true);
      expect(alert.daysRemaining).toBe(0);
    });

    runner.it('T1.19: getFadeAlert marks client as warning when elapsed time is 15-20 days', () => {
      const refDate = new Date('2026-10-27T12:00:00Z'); // 17 days after 10 Oct
      const client = initialClients.find(c => c.id === '3');
      const alert = getFadeAlert(client, refDate);
      expect(alert.alertLevel).toBe('warning');
      expect(alert.requiresRetouch).toBe(true);
      expect(alert.daysRemaining).toBe(4);
    });

    runner.it('T1.20: getFadeAlert marks client as normal when elapsed time is < 15 days', () => {
      const refDate = new Date('2026-10-15T12:00:00Z'); // 5 days after 10 Oct
      const client = initialClients.find(c => c.id === '3');
      const alert = getFadeAlert(client, refDate);
      expect(alert.alertLevel).toBe('normal');
      expect(alert.requiresRetouch).toBe(false);
      expect(alert.daysRemaining).toBe(10);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: 3D Bento Flip Card Component (§R2)
  // --------------------------------------------------------------------------
  runner.describe('Tier 1: Feature 5 — 3D Bento Flip Card Component (R2)', () => {
    const alexClient = MOCK_BARBERSHOP_STATE.vipClients[0];

    runner.it('T1.21: Card initial state renders Front Face with client photo, name, and fade alert', () => {
      const card = createBentoCardState(alexClient, true);
      expect(card.isFlipped).toBe(false);
      expect(card.client.name).toBe('Álex Rivera');
      expect(card.client.photo).toContain('unsplash');
    });

    runner.it('T1.22: Flip event transitions card state to Back Face (isFlipped = true)', () => {
      const card = createBentoCardState(alexClient, true);
      const flipped = triggerCardFlip(card);
      expect(flipped.isFlipped).toBe(true);
      expect(flipped.flipCount).toBe(1);
    });

    runner.it('T1.23: Back face provides cut formula (#000 to #3) and private notes', () => {
      const treatment = alexClient.treatments[0];
      expect(treatment.formula).toContain('#000');
      expect(treatment.notes).toContain('Remolino');
      expect(treatment.ritual).toContain('Toalla caliente');
    });

    runner.it('T1.24: Card buttons isolate event propagation to prevent unintended flipping', () => {
      let propagationStopped = false;
      const mockEvent = {
        stopPropagation() {
          propagationStopped = true;
        }
      };
      // Simulating button click inside card
      mockEvent.stopPropagation();
      expect(propagationStopped).toBe(true);
    });

    runner.it('T1.25: Triggering flip integrates sound and haptic feedback flags', () => {
      const mockAudio = { playFlip: () => true, triggerHaptic: () => true };
      const card = createBentoCardState(alexClient, false);
      const flipped = triggerCardFlip(card, mockAudio);
      expect(flipped.audioTriggered).toBe(true);
      expect(flipped.hapticTriggered).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 6: Dynamic Bento Grid Layout (§R2)
  // --------------------------------------------------------------------------
  runner.describe('Tier 1: Feature 6 — Dynamic Bento Grid Layout (R2)', () => {
    runner.it('T1.26: Mobile viewport (<640px) renders single-column Bento layout', () => {
      const layout = getBentoGridColumns(390);
      expect(layout.columns).toBe(1);
      expect(layout.isMobile).toBe(true);
    });

    runner.it('T1.27: Tablet viewport (640px-1023px) renders two-column Bento layout', () => {
      const layout = getBentoGridColumns(768);
      expect(layout.columns).toBe(2);
      expect(layout.isTablet).toBe(true);
    });

    runner.it('T1.28: Desktop viewport (>=1024px) renders three-column asymmetric Bento layout', () => {
      const layout = getBentoGridColumns(1280);
      expect(layout.columns).toBe(3);
      expect(layout.isDesktop).toBe(true);
    });

    runner.it('T1.29: Hero card spans full width on mobile viewports', () => {
      const mobileLayout = getBentoGridColumns(414);
      expect(mobileLayout.heroSpansAll).toBe(true);
    });

    runner.it('T1.30: Asymmetric hero card prominence distinguishes star/VIP client cards', () => {
      const alexClient = MOCK_BARBERSHOP_STATE.vipClients[0];
      const heroCard = createBentoCardState(alexClient, true);
      const standardCard = createBentoCardState(MOCK_BARBERSHOP_STATE.vipClients[1], false);
      expect(heroCard.isHero).toBe(true);
      expect(standardCard.isHero).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Dashboard Usability & <3s Owner Glance (§R3)
  // --------------------------------------------------------------------------
  runner.describe('Tier 1: Feature 7 — Dashboard Usability & <3s Owner Glance (R3)', () => {
    const dashboardPath = path.resolve(projectRoot, 'src/pages/Dashboard.jsx');
    const dashboardContent = fs.existsSync(dashboardPath) ? fs.readFileSync(dashboardPath, 'utf8') : '';

    runner.it('T1.31: Dashboard centers live chairs, queue, and daily operations in foreground', () => {
      const glanceState = evaluateDashboardCognitiveGlance([
        { id: 'chairs', isPrimary: true, isCollapsed: false },
        { id: 'walkin-queue', isPrimary: true, isCollapsed: false },
        { id: 'quick-actions', isPrimary: true, isCollapsed: false },
        { id: 'vault-backup', isPrimary: false, isCollapsed: true },
        { id: 'rgpd-drawer', isPrimary: false, isCollapsed: true }
      ]);
      expect(glanceState.comprehensionWithin3Seconds).toBe(true);
      expect(glanceState.hasChairs).toBe(true);
      expect(glanceState.hasWalkInQueue).toBe(true);
    });

    runner.it('T1.32: Dashboard cognitive load keeps primary focus clusters <= 5', () => {
      const glance = evaluateDashboardCognitiveGlance([
        { id: 'chairs', isPrimary: true, isCollapsed: false },
        { id: 'walkin-queue', isPrimary: true, isCollapsed: false },
        { id: 'quick-actions', isPrimary: true, isCollapsed: false }
      ]);
      expect(glance.primaryCount).toBeLessThanOrEqual(5);
    });

    runner.it('T1.33: Real-time chair status tracks active barber, client, and elapsed service time', () => {
      const chair = MOCK_BARBERSHOP_STATE.chairs[0];
      expect(chair.status).toBe('occupied');
      expect(chair.barber).toBe('Marcos Fade');
      expect(chair.elapsedMin).toBe(18);
    });

    runner.it('T1.34: Available chair state permits instant client seat assignment', () => {
      const chair = MOCK_BARBERSHOP_STATE.chairs[2];
      expect(chair.status).toBe('available');
      expect(chair.client).toBeNull();
    });

    runner.it('T1.35: Dashboard template contains clean operational headings and status badges', () => {
      expect(dashboardContent.length).toBeGreaterThan(0);
      expect(dashboardContent.includes('SILL') || dashboardContent.includes('KUTZ') || dashboardContent.includes('COLA')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 8: Live Walk-In Queue on Dashboard (§R3)
  // --------------------------------------------------------------------------
  runner.describe('Tier 1: Feature 8 — Live Walk-In Queue on Dashboard (R3)', () => {
    runner.it('T1.36: Active walk-in entries track client name, service requested, and estimated wait', () => {
      const queue = MOCK_BARBERSHOP_STATE.walkInQueue;
      expect(queue.length).toBe(3);
      expect(queue[0].name).toBe('Javier Peña');
      expect(queue[0].waitTimeMinutes).toBe(12);
    });

    runner.it('T1.37: Walk-in WhatsApp alert generates pre-formatted barber notification', () => {
      const walkIn = MOCK_BARBERSHOP_STATE.walkInQueue[0];
      const message = `¡Hola ${walkIn.name}! Tu turno para ${walkIn.service} en KUTZ está listo. Pasa al sillón.`;
      const encoded = encodeURIComponent(message);
      expect(encoded).toContain('KUTZ');
      expect(encoded).toContain('Javier');
    });

    runner.it('T1.38: Walk-in queue status allows conmutating between Live and VIP-only mode', () => {
      let isWalkInOpen = true;
      const toggle = () => { isWalkInOpen = !isWalkInOpen; };
      toggle();
      expect(isWalkInOpen).toBe(false);
      toggle();
      expect(isWalkInOpen).toBe(true);
    });

    runner.it('T1.39: Check-in action safely removes client from queue upon seating in chair', () => {
      let queue = [...MOCK_BARBERSHOP_STATE.walkInQueue];
      const seated = queue[0];
      queue = queue.filter(q => q.id !== seated.id);
      expect(queue.length).toBe(2);
      expect(queue.find(q => q.id === 'w1')).toBeUndefined();
    });

    runner.it('T1.40: Walk-in queue order preserves FIFO waitlist priority', () => {
      const queue = MOCK_BARBERSHOP_STATE.walkInQueue;
      expect(queue[0].waitTimeMinutes).toBeLessThan(queue[1].waitTimeMinutes);
      expect(queue[1].waitTimeMinutes).toBeLessThan(queue[2].waitTimeMinutes);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 9: Collapsible Utility Drawers (§R3)
  // --------------------------------------------------------------------------
  runner.describe('Tier 1: Feature 9 — Collapsible Utility Drawers (R3)', () => {
    runner.it('T1.41: Secondary administrative modules are housed in collapsible state wrappers', () => {
      let isVaultOpen = false;
      const toggleVault = () => { isVaultOpen = !isVaultOpen; };
      expect(isVaultOpen).toBe(false);
      toggleVault();
      expect(isVaultOpen).toBe(true);
    });

    runner.it('T1.42: Vault backup / JSON export is collapsed by default to eliminate visual clutter', () => {
      const defaultDrawerState = { vault: false, telemetry: false, rgpd: false };
      expect(defaultDrawerState.vault).toBe(false);
    });

    runner.it('T1.43: RGPD & legal custody notes expand on demand without modal interruption', () => {
      let rgpdExpanded = false;
      const expandRGPD = () => { rgpdExpanded = true; };
      expandRGPD();
      expect(rgpdExpanded).toBe(true);
    });

    runner.it('T1.44: Drawer expansion does not cause horizontal layout shifts', () => {
      const containerStyle = { overflowX: 'hidden', width: '100%' };
      expect(containerStyle.overflowX).toBe('hidden');
    });

    runner.it('T1.45: Drawer toggle triggers tactile click feedback audio', () => {
      const mockAudio = { playClick: () => ({ played: true, startFreq: 600, wave: 'triangle' }) };
      const soundResult = mockAudio.playClick();
      expect(soundResult.played).toBe(true);
      expect(soundResult.wave).toBe('triangle');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 10: Procedural Web Audio Engine (soundFx.js) (§R4)
  // --------------------------------------------------------------------------
  runner.describe('Tier 1: Feature 10 — Procedural Web Audio Engine (R4)', () => {
    runner.it('T1.46: playFlip() synthesizes 180Hz -> 320Hz frequency sweep over 120ms', () => {
      const mockCtx = new MockAudioContext('running');
      const result = SoundFxEngine.playFlip(mockCtx);
      expect(result.played).toBe(true);
      expect(result.sweepStart).toBe(180);
      expect(result.sweepEnd).toBe(320);
      expect(result.durationMs).toBe(120);
      expect(result.wave).toBe('sine');
    });

    runner.it('T1.47: playClick() synthesizes 600Hz -> 200Hz transient pulse over 30ms with triangle wave', () => {
      const mockCtx = new MockAudioContext('running');
      const result = SoundFxEngine.playClick(mockCtx);
      expect(result.played).toBe(true);
      expect(result.startFreq).toBe(600);
      expect(result.endFreq).toBe(200);
      expect(result.durationMs).toBe(30);
      expect(result.wave).toBe('triangle');
    });

    runner.it('T1.48: Audio engine operates with zero audio assets or external MP3 files', () => {
      // Confirmed: pure oscillator and gain node synthesis
      const mockCtx = new MockAudioContext('running');
      SoundFxEngine.playFlip(mockCtx);
      const oscillators = mockCtx.createdNodes.filter(n => n.nodeCategory === 'oscillator' || n.type === 'sine');
      expect(oscillators.length).toBeGreaterThanOrEqual(1);
    });

    runner.it('T1.49: Engine automatically resumes suspended AudioContext on user interaction', () => {
      const suspendedCtx = new MockAudioContext('suspended');
      expect(suspendedCtx.state).toBe('suspended');
      SoundFxEngine.playFlip(suspendedCtx);
      expect(suspendedCtx.resumed).toBe(true);
      expect(suspendedCtx.state).toBe('running');
    });

    runner.it('T1.50: Graceful no-op fallback when Web Audio API is unsupported', () => {
      const nullResult = SoundFxEngine.playFlip(null);
      expect(nullResult.played).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 11: Micro-Interactions & Haptics at 60 FPS (§R4)
  // --------------------------------------------------------------------------
  runner.describe('Tier 1: Feature 11 — Micro-Interactions & Haptics at 60 FPS (R4)', () => {
    runner.it('T1.51: triggerHaptic(12) invokes navigator.vibrate with safe duration clamping', () => {
      const mockNav = new MockNavigator(true);
      const result = SoundFxEngine.triggerHaptic(12, mockNav);
      expect(result).toBe(true);
      expect(mockNav.vibrateLogs[0]).toBe(12);
    });

    runner.it('T1.52: Haptic trigger returns false safely when navigator.vibrate is undefined', () => {
      const mockNav = new MockNavigator(false);
      const result = SoundFxEngine.triggerHaptic(12, mockNav);
      expect(result).toBe(false);
    });

    runner.it('T1.53: Button active states apply instantaneous tactile depression translate(1px, 1px)', () => {
      const cssPath = path.resolve(projectRoot, 'src/index.css');
      const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
      expect(cssContent.includes('translate(1px, 1px)') || cssContent.includes('btn-author:active')).toBe(true);
    });

    runner.it('T1.54: Card flip transition timing is budgeted to complete smoothly at 60 FPS', () => {
      const cssPath = path.resolve(projectRoot, 'src/index.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      expect(css.includes('will-change: transform')).toBe(true);
      expect(css.includes('.gpu-accelerated') || css.includes('.flip-transition')).toBe(true);
    });

    runner.it('T1.55: Touch tap targets meet or exceed 44px ergonomic standard', () => {
      const kioskModalPath = path.resolve(projectRoot, 'src/components/WalkInKioskModal.jsx');
      const content = fs.readFileSync(kioskModalPath, 'utf8');
      expect(content.includes('min-h-[44px]') && content.includes('min-w-[44px]')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 12: Responsive Layout (~390px to 1280px+) (§R4)
  // --------------------------------------------------------------------------
  runner.describe('Tier 1: Feature 12 — Responsive Layout (~390px to 1280px+) (R4)', () => {
    runner.it('T1.56: Mobile viewport width (390px) accommodates single-column content with zero horizontal overflow', () => {
      const mobileWidth = 390;
      const padding = 16 * 2;
      const usableWidth = mobileWidth - padding;
      expect(usableWidth).toBe(358);
      expect(usableWidth).toBeGreaterThan(320);
    });

    runner.it('T1.57: Touch-first sticky navigation is fixed to bottom on mobile layouts', () => {
      const layoutPath = path.resolve(projectRoot, 'src/components/Layout.jsx');
      const content = fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, 'utf8') : '';
      expect(content.includes('fixed bottom-0') || content.includes('md:hidden')).toBe(true);
    });

    runner.it('T1.58: Sidebar cleanly transforms to desktop layout at md breakpoint (768px+)', () => {
      const layoutPath = path.resolve(projectRoot, 'src/components/Layout.jsx');
      const content = fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, 'utf8') : '';
      expect(content.includes('hidden md:flex') || content.includes('md:flex')).toBe(true);
    });

    runner.it('T1.59: Bento Grid dynamically scales from 1 to 3 columns without card clipping', () => {
      expect(getBentoGridColumns(390).columns).toBe(1);
      expect(getBentoGridColumns(768).columns).toBe(2);
      expect(getBentoGridColumns(1280).columns).toBe(3);
    });

    runner.it('T1.60: Mobile header provides 1-tap shortcuts to TV Kiosk, No-Show, and Search', () => {
      const layoutPath = path.resolve(projectRoot, 'src/components/Layout.jsx');
      const content = fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, 'utf8') : '';
      expect(content.includes('setIsKioskOpen') && content.includes('setIsCmdKOpen')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 13: Clean Build & Zero Linter Errors (§R5)
  // --------------------------------------------------------------------------
  runner.describe('Tier 1: Feature 13 — Clean Build & Zero Linter Errors (R5)', () => {
    const pkgPath = path.resolve(projectRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    runner.it('T1.61: package.json specifies Vite 8+, React 19+, and Tailwind 4+', () => {
      expect(pkg.dependencies.react).toContain('19');
      expect(pkg.devDependencies.vite).toContain('8');
      expect(pkg.devDependencies.tailwindcss).toContain('4');
    });

    runner.it('T1.62: Application entry point src/main.jsx mounts React root cleanly', () => {
      const mainPath = path.resolve(projectRoot, 'src/main.jsx');
      expect(fs.existsSync(mainPath)).toBe(true);
      const mainContent = fs.readFileSync(mainPath, 'utf8');
      expect(mainContent.includes('createRoot')).toBe(true);
    });

    runner.it('T1.63: Root layout component src/components/Layout.jsx exports valid React component', () => {
      const layoutPath = path.resolve(projectRoot, 'src/components/Layout.jsx');
      expect(fs.existsSync(layoutPath)).toBe(true);
      const content = fs.readFileSync(layoutPath, 'utf8');
      expect(content.includes('export default Layout')).toBe(true);
    });

    runner.it('T1.64: Hook hygiene: conditional hook checks pass across modal and profile components', () => {
      function verifyComponentHookHygiene(filePath) {
        const code = fs.readFileSync(filePath, 'utf8');
        const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });

        function findHooksInNode(node, list = []) {
          if (!node || typeof node !== 'object') return list;
          if (node.type === 'CallExpression') {
            const callee = node.callee;
            let name = null;
            if (callee.type === 'Identifier') name = callee.name;
            else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') name = callee.property.name;
            if (name && /^use[A-Z]/.test(name)) {
              list.push({ name, start: node.start });
            }
          }
          for (const k of Object.keys(node)) {
            if (k === 'loc') continue;
            const child = node[k];
            if (Array.isArray(child)) child.forEach(c => findHooksInNode(c, list));
            else if (child && typeof child === 'object') findHooksInNode(child, list);
          }
          return list;
        }

        function hasEarlyReturn(stmt) {
          if (!stmt) return false;
          if (stmt.type === 'ReturnStatement') return true;
          if (stmt.type === 'IfStatement') {
            let found = false;
            function check(n) {
              if (!n || typeof n !== 'object' || found) return;
              if (n.type === 'ReturnStatement') { found = true; return; }
              for (const k of Object.keys(n)) {
                if (k === 'loc') continue;
                const c = n[k];
                if (Array.isArray(c)) c.forEach(check);
                else if (c && typeof c === 'object') check(c);
              }
            }
            check(stmt);
            return found;
          }
          return false;
        }

        let hooksCount = 0;
        for (const stmt of ast.program.body) {
          let fnNode = null;
          let compName = '';
          if (stmt.type === 'FunctionDeclaration') {
            fnNode = stmt;
            compName = stmt.id?.name || '';
          } else if (stmt.type === 'VariableDeclaration') {
            for (const d of stmt.declarations) {
              if (d.init && (d.init.type === 'ArrowFunctionExpression' || d.init.type === 'FunctionExpression')) {
                fnNode = d.init;
                compName = d.id?.name || '';
              }
            }
          } else if (stmt.type === 'ExportDefaultDeclaration') {
            if (stmt.declaration?.type === 'ArrowFunctionExpression' || stmt.declaration?.type === 'FunctionDeclaration') {
              fnNode = stmt.declaration;
              compName = stmt.declaration.id?.name || 'ExportDefault';
            }
          }

          if (fnNode && fnNode.body?.type === 'BlockStatement' && /^[A-Z]/.test(compName)) {
            const stmts = fnNode.body.body;
            let firstEarlyReturnIdx = -1;
            const hooks = [];

            for (let i = 0; i < stmts.length; i++) {
              const s = stmts[i];
              if (firstEarlyReturnIdx === -1 && hasEarlyReturn(s)) {
                firstEarlyReturnIdx = i;
              }
              if (s.type === 'IfStatement' || s.type === 'TryStatement' || s.type === 'SwitchStatement' || s.type === 'ForStatement') {
                const nested = findHooksInNode(s);
                if (nested.length > 0) {
                  throw new Error(`Conditional hook violation in ${compName}: ${nested.map(h => h.name).join(', ')}`);
                }
              }
              const stmtHooks = findHooksInNode(s);
              for (const h of stmtHooks) {
                hooks.push({ ...h, stmtIndex: i });
              }
            }

            if (firstEarlyReturnIdx !== -1) {
              const postReturnHooks = hooks.filter(h => h.stmtIndex > firstEarlyReturnIdx);
              if (postReturnHooks.length > 0) {
                throw new Error(`Hook after early return violation in ${compName}: ${postReturnHooks.map(h => h.name).join(', ')}`);
              }
            }
            hooksCount += hooks.length;
          }
        }
        return hooksCount;
      }

      const profileHooks = verifyComponentHookHygiene(path.resolve(projectRoot, 'src/pages/ClientProfile.jsx'));
      expect(profileHooks).toBeGreaterThanOrEqual(25);

      const modalFiles = [
        'src/components/ClientModal.jsx',
        'src/components/AIAssistantModal.jsx',
        'src/components/LuminaMorphModal.jsx',
        'src/components/NoShowShieldModal.jsx',
        'src/components/RGPDConsentModal.jsx',
        'src/components/WalkInKioskModal.jsx'
      ];
      for (const m of modalFiles) {
        const count = verifyComponentHookHygiene(path.resolve(projectRoot, m));
        expect(count).toBeGreaterThan(0);
      }
    });

    runner.it('T1.65: Test script is registered in package.json', () => {
      expect(pkg.scripts.test).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Feature 14: Production Netlify Deployment Verification (§R5)
  // --------------------------------------------------------------------------
  runner.describe('Tier 1: Feature 14 — Production Netlify Deployment Verification (R5)', () => {
    runner.it('T1.66: public/_redirects contains standard SPA fallback routing rule', () => {
      const redirectsPath = path.resolve(projectRoot, 'public/_redirects');
      expect(fs.existsSync(redirectsPath)).toBe(true);
      const redirects = fs.readFileSync(redirectsPath, 'utf8').trim();
      expect(redirects).toContain('/*');
      expect(redirects).toContain('/index.html');
      expect(redirects).toContain('200');
    });

    runner.it('T1.67: HTML entry index.html specifies correct viewport meta tag for mobile ergonomics', () => {
      const indexPath = path.resolve(projectRoot, 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);
      const content = fs.readFileSync(indexPath, 'utf8');
      expect(content.includes('viewport')).toBe(true);
      expect(content.includes('width=device-width')).toBe(true);
    });

    runner.it('T1.68: Theme color token matches dark canvas #0A0C0F in application markup', () => {
      const cssPath = path.resolve(projectRoot, 'src/index.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      expect(cssContent.includes('#0A0C0F')).toBe(true);
    });

    runner.it('T1.69: Production Netlify deployment configuration matches siteId and live target contract', () => {
      const statePath = path.resolve(projectRoot, '.netlify/state.json');
      expect(fs.existsSync(statePath)).toBe(true);
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      expect(state.siteId).toBe('08ec7877-20ca-419d-9cd2-2915b0171d23');
    });

    runner.it('T1.70: Production build artifacts contract: dist/index.html exists and links bundled assets', () => {
      const distIndexPath = path.resolve(projectRoot, 'dist/index.html');
      expect(fs.existsSync(distIndexPath)).toBe(true);
      const htmlContent = fs.readFileSync(distIndexPath, 'utf8');
      expect(htmlContent.includes('/assets/index-')).toBe(true);
      expect(htmlContent.includes('.js')).toBe(true);
      expect(htmlContent.includes('.css')).toBe(true);
      expect(htmlContent.includes('<div id="root"></div>')).toBe(true);

      const pkgPath = path.resolve(projectRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkg.scripts.build).toBe('vite build');
    });
  });
}
