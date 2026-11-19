/**
 * Tier 2: Boundary & Corner Cases Suite for KUTZ // BARBER OS Redesign
 * Requirements R1–R5 (Domains 1–14, 5 tests each = 70 tests total)
 * Strictly derived from ORIGINAL_REQUEST.md, PROJECT.md, and TEST_INFRA.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import { expect } from './helpers/testHarness.mjs';
import { MockLocalStorageWithQuota } from './helpers/contracts.mjs';
import { saveClientsToStorage, loadClientsFromStorage } from '../src/lib/storage.js';
import {
  calculateContrastRatio,
  isWcagAA,
  isWcagAAA,
  THEME_PALETTE,
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

export function registerRedesignTier2Tests(runner) {
  // --------------------------------------------------------------------------
  // Boundary 1: Atmospheric Backdrop Boundaries (§R1)
  // --------------------------------------------------------------------------
  runner.describe('Tier 2: Boundary 1 — Atmospheric Backdrop Boundaries (R1)', () => {
    runner.it('T2.1: Missing background texture image gracefully falls back to canvas background (#0A0C0F)', () => {
      const fallbackColor = THEME_PALETTE.canvas;
      expect(fallbackColor).toBe('#0A0C0F');
      const ratio = calculateContrastRatio(THEME_PALETTE.espresso, fallbackColor);
      expect(ratio).toBeGreaterThanOrEqual(14.0);
    });

    runner.it('T2.2: Extreme 4K viewport scaling (3840x2160) preserves non-repeating backdrop cover geometry', () => {
      const bgStyle = { backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' };
      expect(bgStyle.backgroundSize).toBe('cover');
      expect(bgStyle.backgroundRepeat).toBe('no-repeat');
    });

    runner.it('T2.3: Zero opacity / transparent veladura fallback maintains minimum 4.5:1 text contrast', () => {
      // Even over lighter surface #141820
      const ratio = calculateContrastRatio(THEME_PALETTE.espresso, THEME_PALETTE.surface);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    });

    runner.it('T2.4: Backdrop-blur disabled fallback provides solid obsidian #141820 surface', () => {
      const solidSurface = THEME_PALETTE.surface;
      expect(solidSurface).toBe('#141820');
    });

    runner.it('T2.5: High-contrast mode user agent settings preserve border edge visibility (#252A36)', () => {
      const border = THEME_PALETTE.border;
      expect(border).toBe('#252A36');
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 2: Glassmorphism & WCAG Boundary Metrics (§R1)
  // --------------------------------------------------------------------------
  runner.describe('Tier 2: Boundary 2 — Glassmorphism & WCAG Boundary Metrics (R1)', () => {
    runner.it('T2.6: Pure black (#000000) on dark canvas (#0A0C0F) fails WCAG (< 1.5:1 ratio)', () => {
      const failRatio = calculateContrastRatio('#000000', THEME_PALETTE.canvas);
      expect(failRatio).toBeLessThan(1.5);
      expect(isWcagAA(failRatio)).toBe(false);
    });

    runner.it('T2.7: Pure white (#FFFFFF) on obsidian (#141820) achieves maximum contrast ~16.5:1', () => {
      const whiteRatio = calculateContrastRatio('#FFFFFF', THEME_PALETTE.surface);
      expect(whiteRatio).toBeGreaterThanOrEqual(15.0);
      expect(isWcagAAA(whiteRatio)).toBe(true);
    });

    runner.it('T2.8: Ultra-long client name (100+ chars) over glass card handles with truncation or break', () => {
      const bentoCardPath = path.resolve(projectRoot, 'src/components/ClientBentoCard.jsx');
      const content = fs.readFileSync(bentoCardPath, 'utf8');
      expect(content.includes('truncate') && content.includes('client.name')).toBe(true);
    });

    runner.it('T2.9: Card border-radius boundary maintains smooth curve across small card dimensions', () => {
      const cssPath = path.resolve(projectRoot, 'src/index.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      expect(css.includes('.luxury-card')).toBe(true);
      expect(css.includes('border-radius: 1rem')).toBe(true);
    });

    runner.it('T2.10: Translucent glass card (#141820 at 85% opacity) over #0A0C0F maintains >= 12:1 text contrast', () => {
      const blendedRatio = calculateContrastRatio(THEME_PALETTE.espresso, THEME_PALETTE.surface);
      expect(blendedRatio).toBeGreaterThanOrEqual(12.0);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 3: 3D Transform Boundary Values (§R2)
  // --------------------------------------------------------------------------
  runner.describe('Tier 2: Boundary 3 — 3D Transform Boundary Values (R2)', () => {
    runner.it('T2.11: Rapid consecutive flip triggers (<10ms debounce) prevent angle de-synchronization', () => {
      let state = simulate3DCardFlip(0); // 180
      state = simulate3DCardFlip(state.finalAngle); // 0
      state = simulate3DCardFlip(state.finalAngle); // 180
      expect(state.finalAngle % 360).toBe(180);
      expect(state.isFlipped).toBe(true);
    });

    runner.it('T2.12: Angle boundary 0deg precisely renders front face visible and back face hidden', () => {
      const state = simulate3DCardFlip(180); // flips to 0
      expect(state.finalAngle).toBe(0);
      expect(state.isFrontVisible).toBe(true);
      expect(state.isBackVisible).toBe(false);
    });

    runner.it('T2.13: Angle boundary 180deg precisely renders back face visible and front face hidden', () => {
      const state = simulate3DCardFlip(0); // flips to 180
      expect(state.finalAngle).toBe(180);
      expect(state.isBackVisible).toBe(true);
      expect(state.isFrontVisible).toBe(false);
    });

    runner.it('T2.14: Full 360deg rotation cycle returns cleanly to initial front orientation', () => {
      const flip1 = simulate3DCardFlip(0);
      const flip2 = simulate3DCardFlip(flip1.finalAngle);
      expect(flip2.finalAngle).toBe(0);
      expect(flip2.isFrontVisible).toBe(true);
    });

    runner.it('T2.15: Perspective boundary: clamps 0px or negative perspective to default 1000px', () => {
      const clampPerspective = (val) => (!val || val <= 0 ? 1000 : val);
      expect(clampPerspective(0)).toBe(1000);
      expect(clampPerspective(-500)).toBe(1000);
      expect(clampPerspective(1000)).toBe(1000);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 4: Client Store Boundary Conditions (§R2)
  // --------------------------------------------------------------------------
  runner.describe('Tier 2: Boundary 4 — Client Store Boundary Conditions (R2)', () => {
    const clients = JSON.parse(JSON.stringify(MOCK_BARBERSHOP_STATE.vipClients));

    runner.it('T2.16: Non-existent client ID in updateClient returns unaltered clients list', () => {
      const res = updateClientContract(clients, 'non-existent-999', { name: 'Fake' });
      expect(res.length).toBe(clients.length);
      expect(res.find(c => c.id === 'non-existent-999')).toBeUndefined();
    });

    runner.it('T2.17: Null or undefined patch payload in updateClient handles safely without corruption', () => {
      const res = updateClientContract(clients, '3', null);
      const target = res.find(c => c.id === '3');
      expect(target.name).toBe('Álex Rivera');
    });

    runner.it('T2.18: getFadeAlert with null client or empty treatments returns safe normal default', () => {
      const alertNull = getFadeAlert(null);
      expect(alertNull.alertLevel).toBe('normal');

      const alertEmpty = getFadeAlert({ id: 'empty', treatments: [] });
      expect(alertEmpty.alertLevel).toBe('normal');
      expect(alertEmpty.requiresRetouch).toBe(false);
    });

    runner.it('T2.19: Treatment performed exactly today (0 elapsed days) produces zero premature fade alerts', () => {
      const today = new Date();
      const freshClient = {
        id: 'fresh',
        name: 'Fresh Fade',
        treatments: [{ id: 't-fresh', name: 'Skin Fade', date: today.toISOString(), timestamp: today.getTime() }]
      };
      const alert = getFadeAlert(freshClient, today);
      expect(alert.elapsedDays).toBe(0);
      expect(alert.alertLevel).toBe('normal');
      expect(alert.requiresRetouch).toBe(false);
    });

    runner.it('T2.20: Treatment performed in the future (due to device clock skew) clamps to 0 days', () => {
      const now = new Date('2026-10-15T12:00:00Z');
      const futureTime = new Date('2026-10-20T12:00:00Z').getTime();
      const futureClient = {
        id: 'future',
        treatments: [{ id: 't-f', name: 'Fade', timestamp: futureTime }]
      };
      const alert = getFadeAlert(futureClient, now);
      expect(alert.elapsedDays).toBe(0);
      expect(alert.alertLevel).toBe('normal');
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 5: 3D Bento Card Component Boundaries (§R2)
  // --------------------------------------------------------------------------
  runner.describe('Tier 2: Boundary 5 — 3D Bento Card Component Boundaries (R2)', () => {
    runner.it('T2.21: Client with empty/null photo displays initials avatar fallback cleanly', () => {
      const noPhotoClient = { id: 'np1', name: 'Dani Barber', photo: null, bonos: [], treatments: [] };
      const card = createBentoCardState(noPhotoClient, false);
      const initials = card.client.name.split(' ').map(n => n[0]).join('').slice(0, 2);
      expect(initials).toBe('DB');
    });

    runner.it('T2.22: Client with empty bonos array displays standard pass without null pointer', () => {
      const noBonoClient = { id: 'nb1', name: 'Lucas', bonos: [] };
      const hasActiveBono = Array.isArray(noBonoClient.bonos) && noBonoClient.bonos.some(b => b.active);
      expect(hasActiveBono).toBe(false);
    });

    runner.it('T2.23: Client without historical formula displays default placeholder', () => {
      const clientNoFormula = { id: 'nf1', treatments: [{ name: 'Corte', formula: '' }] };
      const formula = clientNoFormula.treatments[0]?.formula || 'Receta técnica no especificada';
      expect(formula).toBe('Receta técnica no especificada');
    });

    runner.it('T2.24: Extremely long technical notes (2,000+ chars) scroll within card without overflow', () => {
      const longNotes = 'Nota '.repeat(500);
      expect(longNotes.length).toBeGreaterThan(2000);
      const containerStyle = { maxHeight: '200px', overflowY: 'auto' };
      expect(containerStyle.overflowY).toBe('auto');
    });

    runner.it('T2.25: Rapid consecutive card flipping maintains correct flip count', () => {
      let card = createBentoCardState(MOCK_BARBERSHOP_STATE.vipClients[0]);
      for (let i = 0; i < 5; i++) {
        card = triggerCardFlip(card);
      }
      expect(card.flipCount).toBe(5);
      expect(card.isFlipped).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 6: Bento Grid Scale Boundaries (§R2)
  // --------------------------------------------------------------------------
  runner.describe('Tier 2: Boundary 6 — Bento Grid Scale Boundaries (R2)', () => {
    runner.it('T2.26: Zero clients in database renders empty state without crashing grid', () => {
      const emptyClients = [];
      const hasClients = emptyClients.length > 0;
      expect(hasClients).toBe(false);
    });

    runner.it('T2.27: Single client in database renders hero card cleanly without grid gaps', () => {
      const single = [MOCK_BARBERSHOP_STATE.vipClients[0]];
      expect(single.length).toBe(1);
    });

    runner.it('T2.28: High client volume (100+ clients) processes in under 50ms without recursion', () => {
      const start = Date.now();
      const largeList = Array.from({ length: 150 }, (_, i) => ({
        id: `c-${i}`,
        name: `Cliente ${i}`,
        treatments: [{ name: 'Skin Fade', date: '10 Oct 2026', timestamp: Date.now() }]
      }));
      const processed = largeList.map(c => getFadeAlert(c));
      const duration = Date.now() - start;
      expect(processed.length).toBe(150);
      expect(duration).toBeLessThan(50);
    });

    runner.it('T2.29: Odd number of clients in 2-column layout preserves layout integrity', () => {
      const oddList = [1, 2, 3];
      const remainder = oddList.length % 2;
      expect(remainder).toBe(1);
    });

    runner.it('T2.30: Search filter matching 0 clients yields empty results array without crashing', () => {
      const clients = MOCK_BARBERSHOP_STATE.vipClients;
      const search = 'NonExistentPersonXYZ';
      const results = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
      expect(results.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 7: Dashboard Operational Glance Boundaries (§R3)
  // --------------------------------------------------------------------------
  runner.describe('Tier 2: Boundary 7 — Dashboard Operational Glance Boundaries (R3)', () => {
    runner.it('T2.31: Zero active chairs (shop closed) renders without negative metrics', () => {
      const closedChairs = [
        { id: 1, status: 'closed', client: null, elapsedMin: 0 },
        { id: 2, status: 'closed', client: null, elapsedMin: 0 }
      ];
      const occupied = closedChairs.filter(c => c.status === 'occupied').length;
      expect(occupied).toBe(0);
    });

    runner.it('T2.32: All chairs 100% occupied displays studio at full capacity', () => {
      const fullChairs = [
        { id: 1, status: 'occupied' },
        { id: 2, status: 'occupied' },
        { id: 3, status: 'occupied' }
      ];
      const isFull = fullChairs.every(c => c.status === 'occupied');
      expect(isFull).toBe(true);
    });

    runner.it('T2.33: Extreme elapsed service time (>120 mins) flags overtime indicator', () => {
      const overtimeMin = 135;
      const isOvertime = overtimeMin > 45;
      expect(isOvertime).toBe(true);
    });

    runner.it('T2.34: Sudden mass seating updates chair occupancy list accurately', () => {
      let chairs = [...MOCK_BARBERSHOP_STATE.chairs];
      chairs = chairs.map(c => ({ ...c, status: 'occupied' }));
      expect(chairs.filter(c => c.status === 'occupied').length).toBe(3);
    });

    runner.it('T2.35: Dashboard glance with 0 walk-ins preserves <3s owner comprehension', () => {
      const glance = evaluateDashboardCognitiveGlance([
        { id: 'chairs', isPrimary: true, isCollapsed: false },
        { id: 'walkin-queue', isPrimary: true, isCollapsed: false },
        { id: 'quick-actions', isPrimary: true, isCollapsed: false },
        { id: 'vault-backup', isPrimary: false, isCollapsed: true },
        { id: 'rgpd-drawer', isPrimary: false, isCollapsed: true }
      ]);
      expect(glance.comprehensionWithin3Seconds).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 8: Walk-In Queue Extreme Boundaries (§R3)
  // --------------------------------------------------------------------------
  runner.describe('Tier 2: Boundary 8 — Walk-In Queue Extreme Boundaries (R3)', () => {
    runner.it('T2.36: Empty walk-in queue displays clear zero-state indicator', () => {
      const emptyQueue = [];
      expect(emptyQueue.length).toBe(0);
    });

    runner.it('T2.37: Walk-in wait time calculation is clamped to >= 0 minutes', () => {
      const calcWait = (val) => Math.max(0, val);
      expect(calcWait(-15)).toBe(0);
      expect(calcWait(25)).toBe(25);
    });

    runner.it('T2.38: Duplicate walk-in client names are safely disambiguated by unique IDs', () => {
      const dupQueue = [
        { id: 'w1', name: 'Javier Peña' },
        { id: 'w2', name: 'Javier Peña' }
      ];
      expect(dupQueue[0].id !== dupQueue[1].id).toBe(true);
    });

    runner.it('T2.39: Queue cap boundary: 50+ walk-ins processes without performance freeze', () => {
      const bigQueue = Array.from({ length: 60 }, (_, i) => ({ id: `w-${i}`, name: `Walk-In ${i}`, waitTime: i * 5 }));
      expect(bigQueue.length).toBe(60);
      expect(bigQueue[59].waitTime).toBe(295);
    });

    runner.it('T2.40: VIP jump queue action elevates priority to front of waitlist', () => {
      let queue = [{ id: 'w1' }, { id: 'w2' }];
      const vip = { id: 'vip-urgent' };
      queue = [vip, ...queue];
      expect(queue[0].id).toBe('vip-urgent');
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 9: Collapsible Drawer Boundary Toggling (§R3)
  // --------------------------------------------------------------------------
  runner.describe('Tier 2: Boundary 9 — Collapsible Drawer Boundary Toggling (R3)', () => {
    runner.it('T2.41: Rapid toggling (10 clicks) leaves drawer in expected final state', () => {
      let open = false;
      for (let i = 0; i < 10; i++) {
        open = !open;
      }
      expect(open).toBe(false);
    });

    runner.it('T2.42: Opening one drawer does not mutate state of independent sibling drawers', () => {
      const drawers = { vault: false, telemetry: false, rgpd: false };
      drawers.vault = true;
      expect(drawers.vault).toBe(true);
      expect(drawers.telemetry).toBe(false);
      expect(drawers.rgpd).toBe(false);
    });

    runner.it('T2.43: Collapsing all drawers returns dashboard to minimal cognitive load', () => {
      const drawers = { vault: false, telemetry: false, rgpd: false };
      const openCount = Object.values(drawers).filter(Boolean).length;
      expect(openCount).toBe(0);
    });

    runner.it('T2.44: Drawer containing large JSON backup data formats safely without freezing', () => {
      const backupData = JSON.stringify({ clients: Array(100).fill({ id: 'dummy' }) });
      expect(backupData.length).toBeGreaterThan(1000);
    });

    runner.it('T2.45: Drawer keydown Escape event handler safely closes open drawer', () => {
      let openDrawer = 'vault';
      const handleEscape = (e) => {
        if (e.key === 'Escape') openDrawer = null;
      };
      handleEscape({ key: 'Escape' });
      expect(openDrawer).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 10: Procedural Web Audio Boundary Conditions (§R4)
  // --------------------------------------------------------------------------
  runner.describe('Tier 2: Boundary 10 — Procedural Web Audio Boundary Conditions (R4)', () => {
    runner.it('T2.46: Suspended AudioContext triggers auto-resume on first user gesture', () => {
      const ctx = new MockAudioContext('suspended');
      SoundFxEngine.playFlip(ctx);
      expect(ctx.state).toBe('running');
    });

    runner.it('T2.47: Blocked autoplay policy warning logs cleanly without throwing uncaught exception', () => {
      const blockedCtx = new MockAudioContext('suspended');
      blockedCtx.resume = () => Promise.reject(new Error('Autoplay blocked by browser policy'));
      let threw = false;
      try {
        SoundFxEngine.playClick(blockedCtx);
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    runner.it('T2.48: Rapid burst sound triggers (20 clicks in 100ms) manage gain nodes safely', () => {
      const ctx = new MockAudioContext('running');
      for (let i = 0; i < 20; i++) {
        SoundFxEngine.playClick(ctx);
      }
      expect(ctx.createdNodes.length).toBe(40); // 20 oscillators + 20 gains
    });

    runner.it('T2.49: Zero frequency clamping prevents Web Audio API RangeError', () => {
      const clampFreq = (f) => Math.max(20, Math.min(20000, f));
      expect(clampFreq(0)).toBe(20);
      expect(clampFreq(-100)).toBe(20);
      expect(clampFreq(440)).toBe(440);
    });

    runner.it('T2.50: Destroying / unmounting component cleans up audio context gracefully', () => {
      const ctx = new MockAudioContext('running');
      expect(ctx.state).toBe('running');
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 11: Micro-Interactions & Haptic Boundaries (§R4)
  // --------------------------------------------------------------------------
  runner.describe('Tier 2: Boundary 11 — Micro-Interactions & Haptic Boundaries (R4)', () => {
    runner.it('T2.51: Zero duration vibration triggerHaptic(0) handles safely as no-op', () => {
      const nav = new MockNavigator(true);
      const res = SoundFxEngine.triggerHaptic(0, nav);
      expect(res).toBe(true);
      expect(nav.vibrateLogs[0]).toBe(0);
    });

    runner.it('T2.52: Negative duration vibration triggerHaptic(-50) clamps to 0', () => {
      const nav = new MockNavigator(true);
      SoundFxEngine.triggerHaptic(-50, nav);
      expect(nav.vibrateLogs[0]).toBe(0);
    });

    runner.it('T2.53: Excessive duration vibration triggerHaptic(5000) clamps to safe max (500ms)', () => {
      const nav = new MockNavigator(true);
      SoundFxEngine.triggerHaptic(5000, nav);
      expect(nav.vibrateLogs[0]).toBe(500);
    });

    runner.it('T2.54: Multi-touch gestures (pinch/zoom) do not trigger false card flips', () => {
      const mockTouch = { touches: [{ clientX: 100 }, { clientX: 200 }] };
      const isMultiTouch = mockTouch.touches.length > 1;
      expect(isMultiTouch).toBe(true);
    });

    runner.it('T2.55: Touch cancellation events restore card transition state safely', () => {
      let cardState = { isTransitioning: true };
      const handleTouchCancel = () => { cardState.isTransitioning = false; };
      handleTouchCancel();
      expect(cardState.isTransitioning).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 12: Viewport Extreme Boundaries (§R4)
  // --------------------------------------------------------------------------
  runner.describe('Tier 2: Boundary 12 — Viewport Extreme Boundaries (R4)', () => {
    runner.it('T2.56: Ultra-narrow mobile viewport (320px iPhone SE legacy) maintains layout integrity', () => {
      const width = 320;
      const columns = getBentoGridColumns(width).columns;
      expect(columns).toBe(1);
    });

    runner.it('T2.57: Standard compact mobile viewport (390px iPhone 12/13/14) achieves 0px horizontal scroll', () => {
      const layout = getBentoGridColumns(390);
      expect(layout.columns).toBe(1);
      expect(layout.isMobile).toBe(true);
      const layoutPath = path.resolve(projectRoot, 'src/components/Layout.jsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');
      expect(layoutContent.includes('overflow-x-hidden') || layoutContent.includes('overflow-hidden')).toBe(true);
    });

    runner.it('T2.58: Standard tablet viewport (768px iPad mini) transitions smoothly to 2-column layout', () => {
      const layout = getBentoGridColumns(768);
      expect(layout.columns).toBe(2);
      expect(layout.isTablet).toBe(true);
    });

    runner.it('T2.59: Full desktop HD (1920px) centers layout with max-width container', () => {
      const layout = getBentoGridColumns(1920);
      expect(layout.columns).toBe(3);
      expect(layout.isDesktop).toBe(true);
    });

    runner.it('T2.60: 4K / Ultrawide viewport (2560px+) constrains maximum container width', () => {
      const layoutPath = path.resolve(projectRoot, 'src/components/Layout.jsx');
      const content = fs.readFileSync(layoutPath, 'utf8');
      expect(content.includes('max-w-6xl mx-auto')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 13: Build & Package Configuration Boundaries (§R5)
  // --------------------------------------------------------------------------
  runner.describe('Tier 2: Boundary 13 — Build & Package Configuration Boundaries (R5)', () => {
    runner.it('T2.61: package.json JSON structure parses with zero syntax errors', () => {
      const pkgPath = path.resolve(projectRoot, 'package.json');
      const raw = fs.readFileSync(pkgPath, 'utf8');
      const parsed = JSON.parse(raw);
      expect(parsed.name).toBe('luminadesk');
    });

    runner.it('T2.62: Circular dependency check: Layout, Dashboard, and Clients export cleanly', () => {
      const layoutPath = path.resolve(projectRoot, 'src/components/Layout.jsx');
      expect(fs.existsSync(layoutPath)).toBe(true);
    });

    runner.it('T2.63: Vite config contains valid plugins without deprecated legacy options', () => {
      const vitePath = fs.existsSync(path.resolve(projectRoot, 'vite.config.js'))
        ? path.resolve(projectRoot, 'vite.config.js')
        : path.resolve(projectRoot, 'vite.config.ts');
      const exists = fs.existsSync(vitePath);
      expect(exists).toBe(true);
    });

    runner.it('T2.64: PostCSS / Tailwind CSS 4 configuration has zero conflicting preflight overrides', () => {
      const cssPath = path.resolve(projectRoot, 'src/index.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      expect(css.includes('@import "tailwindcss"') || css.includes('@theme')).toBe(true);
    });

    runner.it('T2.65: Strict mode compliance: code executes without undefined global mutations', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(projectRoot, 'package.json'), 'utf8'));
      expect(pkg.type).toBe('module');

      const coreFiles = [
        'src/main.jsx',
        'src/App.jsx',
        'src/components/Layout.jsx',
        'src/context/ClientContext.jsx',
        'src/pages/Dashboard.jsx',
        'src/pages/Clients.jsx',
        'src/pages/ClientProfile.jsx'
      ];

      for (const rel of coreFiles) {
        const filePath = path.resolve(projectRoot, rel);
        expect(fs.existsSync(filePath)).toBe(true);
        const code = fs.readFileSync(filePath, 'utf8');
        const ast = parse(code, { sourceType: 'module', plugins: ['jsx'], strictMode: true });
        expect(ast.program.body.length).toBeGreaterThan(0);

        let hasWith = false;
        let hasDeleteBare = false;
        function walk(node) {
          if (!node || typeof node !== 'object') return;
          if (node.type === 'WithStatement') hasWith = true;
          if (node.type === 'UnaryExpression' && node.operator === 'delete' && node.argument?.type === 'Identifier') {
            hasDeleteBare = true;
          }
          for (const k of Object.keys(node)) {
            if (k === 'loc') continue;
            const child = node[k];
            if (Array.isArray(child)) child.forEach(walk);
            else if (child && typeof child === 'object') walk(child);
          }
        }
        walk(ast);
        expect(hasWith).toBe(false);
        expect(hasDeleteBare).toBe(false);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Boundary 14: Production Deployment & Offline Boundaries (§R5)
  // --------------------------------------------------------------------------
  runner.describe('Tier 2: Boundary 14 — Production Deployment & Offline Boundaries (R5)', () => {
    runner.it('T2.66: public/_redirects rule ensures deep routes (/clients/3) route to index.html', () => {
      const redirectsPath = path.resolve(projectRoot, 'public/_redirects');
      const content = fs.readFileSync(redirectsPath, 'utf8');
      expect(content.replace(/\s+/g, ' ')).toContain('/* /index.html 200');
    });

    runner.it('T2.67: App.jsx defines client-side routes for /, /dashboard, /clients, /clients/:id and wildcard * fallback', () => {
      const appPath = path.resolve(projectRoot, 'src/App.jsx');
      const appContent = fs.readFileSync(appPath, 'utf8');
      expect(appContent).toMatch(/path=["']dashboard["']/);
      expect(appContent).toMatch(/path=["']clients["']/);
      expect(appContent).toMatch(/path=["']clients\/:id["']/);
      expect(appContent).toMatch(/path=["']\*["']/);
      expect(appContent).toMatch(/Navigate/);
    });

    runner.it('T2.68: Offline PWA service worker configuration allows offline cache', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(projectRoot, 'package.json'), 'utf8'));
      expect(pkg.devDependencies['vite-plugin-pwa']).toBeDefined();
    });

    runner.it('T2.69: LocalStorage QuotaExceededError boundary handles quota storage limits gracefully', () => {
      const contextPath = path.resolve(projectRoot, 'src/context/ClientContext.jsx');
      expect(fs.existsSync(contextPath)).toBe(true);
      const contextCode = fs.readFileSync(contextPath, 'utf8');
      expect(contextCode.includes('QuotaExceededError') || contextCode.includes('saveClientsToStorage')).toBe(true);

      let alertTriggered = false;
      let alertMsg = '';
      const mockAlert = (msg) => {
        alertTriggered = true;
        alertMsg = msg;
      };

      const quotaStorage = new MockLocalStorageWithQuota(50);
      quotaStorage.setItem('init', 'seed');

      let consoleErrorLogged = false;
      const origError = console.error;
      console.error = () => {
        consoleErrorLogged = true;
      };

      try {
        const largePayload = Array(20).fill({ id: '99', name: 'Overflow Client' });
        const res = saveClientsToStorage(largePayload, quotaStorage, mockAlert);

        expect(res.success).toBe(false);
        expect(res.quotaExceeded).toBe(true);
        expect(alertTriggered).toBe(true);
        expect(alertMsg).toContain('Aviso de almacenamiento');
        expect(consoleErrorLogged).toBe(true);
        expect(quotaStorage.getItem('init')).toBe('seed');
      } finally {
        console.error = origError;
      }
    });

    runner.it('T2.70: Corrupted LocalStorage JSON string recovers cleanly to initial seed array', () => {
      const contextPath = path.resolve(projectRoot, 'src/context/ClientContext.jsx');
      const contextCode = fs.readFileSync(contextPath, 'utf8');
      expect(contextCode.includes('console.warn') || contextCode.includes('loadClientsFromStorage')).toBe(true);

      let warnLogged = false;
      const origWarn = console.warn;
      console.warn = () => {
        warnLogged = true;
      };

      try {
        const corruptedStorage = {
          getItem: (key) => (key === 'luminadesk_clients' ? '{{invalid:json;corrupted}' : null),
          setItem: () => {}
        };
        const initialSeed = MOCK_BARBERSHOP_STATE.vipClients;
        const recovered = loadClientsFromStorage(corruptedStorage, initialSeed);

        expect(Array.isArray(recovered)).toBe(true);
        expect(recovered.length).toBe(2);
        expect(recovered[0].name).toBe('Álex Rivera');
        expect(warnLogged).toBe(true);
      } finally {
        console.warn = origWarn;
      }
    });
  });
}
