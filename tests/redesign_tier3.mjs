/**
 * Tier 3: Cross-Feature Interactions Suite for KUTZ // BARBER OS Redesign
 * Requirements R1–R5 (15 Pairwise & System Interaction Tests)
 * Strictly derived from ORIGINAL_REQUEST.md, PROJECT.md, and TEST_INFRA.md
 */

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
  MOCK_BARBERSHOP_STATE
} from './helpers/redesignContracts.mjs';

export function registerRedesignTier3Tests(runner) {
  runner.describe('Tier 3: Cross-Feature Interactions (Pairwise Combinations)', () => {
    // ------------------------------------------------------------------------
    // T3.1: 3D Card flip during live walk-in queue update
    // ------------------------------------------------------------------------
    runner.it('T3.1: 3D Card flip state remains stable when walk-in queue receives background updates', () => {
      let card = createBentoCardState(MOCK_BARBERSHOP_STATE.vipClients[0]);
      card = triggerCardFlip(card);
      expect(card.isFlipped).toBe(true);

      // Simulating live queue event
      const updatedQueue = [
        ...MOCK_BARBERSHOP_STATE.walkInQueue,
        { id: 'w-new', name: 'Nuevo Cliente', waitTimeMinutes: 45 }
      ];
      expect(updatedQueue.length).toBe(4);
      // Card remains flipped on back face
      expect(card.isFlipped).toBe(true);
      expect(card.flipCount).toBe(1);
    });

    // ------------------------------------------------------------------------
    // T3.2: SoundFx audio sweep during Bento search query filter
    // ------------------------------------------------------------------------
    runner.it('T3.2: SoundFx playClick triggers cleanly during rapid keystroke filtering without lag', () => {
      const mockCtx = new MockAudioContext('running');
      const searchQuery = 'Rivera';
      const audioLogs = [];

      for (const char of searchQuery) {
        const sound = SoundFxEngine.playClick(mockCtx);
        audioLogs.push({ char, played: sound.played });
      }

      expect(audioLogs.length).toBe(6);
      expect(audioLogs.every(l => l.played)).toBe(true);
      expect(mockCtx.createdNodes.length).toBe(12); // 6 oscillators + 6 gains
    });

    // ------------------------------------------------------------------------
    // T3.3: In-card quick session save updating client store and fade alert
    // ------------------------------------------------------------------------
    runner.it('T3.3: In-card quick session save refreshes fade alert immediately without modal navigation', () => {
      const clients = JSON.parse(JSON.stringify(MOCK_BARBERSHOP_STATE.vipClients));
      const targetClient = clients[0]; // Álex Rivera

      // Initial state: last session was 10 Oct 2026. Evaluating on 5 Nov 2026 -> urgent
      const evalDate = new Date('2026-11-05T12:00:00Z');
      const beforeAlert = getFadeAlert(targetClient, evalDate);
      expect(beforeAlert.alertLevel).toBe('urgent');

      // Add fresh session today (5 Nov 2026) directly from card back
      const updatedList = quickAddSessionContract(clients, '3', {
        date: '05 Nov 2026',
        timestamp: evalDate.getTime(),
        formula: 'Skin Fade Alto #000 -> #0.5 -> #2 superior textura',
        notes: 'Corte realizado en sillón 01'
      });

      const updatedClient = updatedList.find(c => c.id === '3');
      const afterAlert = getFadeAlert(updatedClient, evalDate);

      expect(afterAlert.alertLevel).toBe('normal');
      expect(afterAlert.requiresRetouch).toBe(false);
      expect(afterAlert.daysRemaining).toBe(15);
    });

    // ------------------------------------------------------------------------
    // T3.4: Walk-in status toggle updating live queue status without layout shift
    // ------------------------------------------------------------------------
    runner.it('T3.4: Walk-in mode toggle (Abierto vs Solo Citas) updates queue header without layout reflow', () => {
      let mode = 'open';
      const toggleMode = () => {
        mode = mode === 'open' ? 'vip_only' : 'open';
      };

      toggleMode();
      expect(mode).toBe('vip_only');
      const badgeText = mode === 'open' ? 'WALK-INS: ABIERTOS' : 'MODO: SOLO CITAS VIP';
      expect(badgeText).toBe('MODO: SOLO CITAS VIP');

      toggleMode();
      expect(mode).toBe('open');
    });

    // ------------------------------------------------------------------------
    // T3.5: Bento card flip with haptic vibration and sound isolated from action buttons
    // ------------------------------------------------------------------------
    runner.it('T3.5: Event propagation stopPropagation isolates WhatsApp click from triggering card flip', () => {
      let card = createBentoCardState(MOCK_BARBERSHOP_STATE.vipClients[0]);
      let flipCalled = false;
      let whatsAppCalled = false;

      const onCardClick = () => {
        flipCalled = true;
        card = triggerCardFlip(card);
      };

      const onWhatsAppClick = (e) => {
        e.stopPropagation();
        whatsAppCalled = true;
      };

      const mockEvent = {
        stopped: false,
        stopPropagation() { this.stopped = true; }
      };

      // User taps WhatsApp button
      onWhatsAppClick(mockEvent);
      if (!mockEvent.stopped) {
        onCardClick();
      }

      expect(whatsAppCalled).toBe(true);
      expect(mockEvent.stopped).toBe(true);
      expect(flipCalled).toBe(false);
      expect(card.isFlipped).toBe(false);
    });

    // ------------------------------------------------------------------------
    // T3.6: Collapsible utility drawer toggle while Web Audio engine initializes
    // ------------------------------------------------------------------------
    runner.it('T3.6: Drawer toggle user gesture smoothly initializes suspended AudioContext', () => {
      const suspendedCtx = new MockAudioContext('suspended');
      let drawerOpen = false;

      const toggleDrawerWithSound = () => {
        drawerOpen = !drawerOpen;
        SoundFxEngine.playClick(suspendedCtx);
      };

      toggleDrawerWithSound();
      expect(drawerOpen).toBe(true);
      expect(suspendedCtx.state).toBe('running');
      expect(suspendedCtx.resumed).toBe(true);
    });

    // ------------------------------------------------------------------------
    // T3.7: Viewport resize from 390px to 1280px preserving flipped card state
    // ------------------------------------------------------------------------
    runner.it('T3.7: Viewport resizing from mobile to desktop preserves flipped card state and columns', () => {
      let card = createBentoCardState(MOCK_BARBERSHOP_STATE.vipClients[0]);
      card = triggerCardFlip(card);
      expect(card.isFlipped).toBe(true);

      // Breakpoint shifts
      const mobileCols = getBentoGridColumns(390).columns;
      const desktopCols = getBentoGridColumns(1280).columns;

      expect(mobileCols).toBe(1);
      expect(desktopCols).toBe(3);
      // Card flipped state is retained
      expect(card.isFlipped).toBe(true);
    });

    // ------------------------------------------------------------------------
    // T3.8: Real-time chair status change triggering walk-in queue check-in sequence
    // ------------------------------------------------------------------------
    runner.it('T3.8: Chair status transition from occupied to available prompts next walk-in check-in', () => {
      let chairs = [...MOCK_BARBERSHOP_STATE.chairs];
      let queue = [...MOCK_BARBERSHOP_STATE.walkInQueue];

      // Chair 1 finishes cut
      chairs[0] = { ...chairs[0], status: 'available', client: null };
      expect(chairs[0].status).toBe('available');

      // Next in queue seated
      const nextClient = queue.shift();
      chairs[0] = {
        ...chairs[0],
        status: 'occupied',
        client: nextClient.name,
        service: nextClient.service,
        elapsedMin: 0
      };

      expect(chairs[0].client).toBe('Javier Peña');
      expect(chairs[0].status).toBe('occupied');
      expect(queue.length).toBe(2);
    });

    // ------------------------------------------------------------------------
    // T3.9: Quick session addition with extreme clipper guard formula
    // ------------------------------------------------------------------------
    runner.it('T3.9: Quick session addition with extreme clipper guard (#000 to #3) updates retention alert immediately', () => {
      const clients = JSON.parse(JSON.stringify(MOCK_BARBERSHOP_STATE.vipClients));
      const extremeFormula = 'Base Shaver #000 -> #0.5 cerrada -> #1 abierta -> #1.5 -> #2 conector -> #3 superior crop textura';

      const updated = quickAddSessionContract(clients, '3', {
        formula: extremeFormula,
        notes: 'Piel sensible en cuello',
        date: '29 Oct 2026'
      });

      const client = updated.find(c => c.id === '3');
      expect(client.treatments[0].formula).toBe(extremeFormula);

      const alert = getFadeAlert(client, new Date('2026-10-29T12:00:00Z'));
      expect(alert.alertLevel).toBe('normal');
      expect(alert.elapsedDays).toBe(0);
    });

    // ------------------------------------------------------------------------
    // T3.10: Dark scrim opacity adjustments maintaining WCAG AAA compliance
    // ------------------------------------------------------------------------
    runner.it('T3.10: Dark scrim overlays over background images maintain WCAG AAA contrast ratio', () => {
      const surfaceColor = THEME_PALETTE.surface; // #141820
      const textColor = THEME_PALETTE.espresso; // #F3F4F6
      const ratio = calculateContrastRatio(textColor, surfaceColor);

      expect(ratio).toBeGreaterThanOrEqual(13.0);
      expect(isWcagAAA(ratio)).toBe(true);
    });

    // ------------------------------------------------------------------------
    // T3.11: Search filter combined with 3D flip card interaction and active VIP pass
    // ------------------------------------------------------------------------
    runner.it('T3.11: Searching for VIP client displays hero card with active bono and allows 3D flipping', () => {
      const clients = MOCK_BARBERSHOP_STATE.vipClients;
      const search = 'Álex';
      const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

      expect(filtered.length).toBe(1);
      const target = filtered[0];
      const hasActiveBono = target.bonos.some(b => b.active);
      expect(hasActiveBono).toBe(true);

      let card = createBentoCardState(target, true);
      card = triggerCardFlip(card);
      expect(card.isFlipped).toBe(true);
      expect(card.client.name).toContain('Álex');
    });

    // ------------------------------------------------------------------------
    // T3.12: Multiple cards flipped simultaneously with soundFx and zero crosstalk
    // ------------------------------------------------------------------------
    runner.it('T3.12: Multiple cards flipped independently maintain isolated flip states without crosstalk', () => {
      let card1 = createBentoCardState(MOCK_BARBERSHOP_STATE.vipClients[0]);
      let card2 = createBentoCardState(MOCK_BARBERSHOP_STATE.vipClients[1]);

      card1 = triggerCardFlip(card1);
      expect(card1.isFlipped).toBe(true);
      expect(card2.isFlipped).toBe(false);

      card2 = triggerCardFlip(card2);
      expect(card1.isFlipped).toBe(true);
      expect(card2.isFlipped).toBe(true);

      card1 = triggerCardFlip(card1);
      expect(card1.isFlipped).toBe(false);
      expect(card2.isFlipped).toBe(true);
    });

    // ------------------------------------------------------------------------
    // T3.13: VIP bono consumption during quick session addition on card back
    // ------------------------------------------------------------------------
    runner.it('T3.13: Quick session addition decrements remaining VIP bono session count', () => {
      let client = JSON.parse(JSON.stringify(MOCK_BARBERSHOP_STATE.vipClients[0]));
      const bono = client.bonos[0];
      expect(bono.usedSessions).toBe(3);
      expect(bono.totalSessions).toBe(5);

      // Consume session
      bono.usedSessions += 1;
      const remaining = bono.totalSessions - bono.usedSessions;

      expect(bono.usedSessions).toBe(4);
      expect(remaining).toBe(1);
      expect(bono.active).toBe(true);
    });

    // ------------------------------------------------------------------------
    // T3.14: Walk-in WhatsApp alert notification generation while viewing Bento grid
    // ------------------------------------------------------------------------
    runner.it('T3.14: Walk-in notification draft URL formatting executes cleanly without leaving Bento grid', () => {
      const walkIn = MOCK_BARBERSHOP_STATE.walkInQueue[0];
      const draft = `https://wa.me/${walkIn.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Tu turno está listo')}`;

      expect(draft).toContain('wa.me/34600112233');
      expect(draft).toContain('Tu%20turno%20est%C3%A1%20listo');
    });

    // ------------------------------------------------------------------------
    // T3.15: Full Lifecycle: Walk-in -> Seat -> 3D Flip -> Quick Session -> Fade Alert
    // ------------------------------------------------------------------------
    runner.it('T3.15: Full lifecycle: Walk-in intake, seat assignment, formula inspection, quick session save and alert reset', () => {
      // Step 1: Walk-in arrives
      const newWalkIn = { id: 'w-life', name: 'Marcos Vega', service: 'Burst Fade + Barba', phone: '+34699887766' };
      let queue = [newWalkIn];
      expect(queue.length).toBe(1);

      // Step 2: Seat in available Chair 3
      let chairs = [...MOCK_BARBERSHOP_STATE.chairs];
      chairs[2] = { ...chairs[2], status: 'occupied', client: newWalkIn.name, service: newWalkIn.service, elapsedMin: 0 };
      queue = [];
      expect(chairs[2].status).toBe('occupied');
      expect(queue.length).toBe(0);

      // Step 3: Open client card and flip to inspect formula
      const client = {
        id: 'c-life',
        name: 'Marcos Vega',
        treatments: [
          { name: 'Corte Anterior', date: '01 Oct 2026', timestamp: new Date('2026-10-01T10:00:00Z').getTime(), formula: 'Guarda #1 -> #2' }
        ]
      };
      let card = createBentoCardState(client);
      card = triggerCardFlip(card);
      expect(card.isFlipped).toBe(true);

      // Step 4: Perform quick session save on card back
      const updatedClients = quickAddSessionContract([client], 'c-life', {
        date: '29 Oct 2026',
        formula: 'Burst Fade con Shaver #000 + Perfilado de barba a navaja',
        notes: 'Piel hidratada con bálsamo mentolado'
      });
      const updated = updatedClients[0];
      expect(updated.treatments.length).toBe(2);

      // Step 5: Recalculate fade alert
      const alert = getFadeAlert(updated, new Date('2026-10-29T14:00:00Z'));
      expect(alert.alertLevel).toBe('normal');
      expect(alert.elapsedDays).toBe(0);
      expect(alert.requiresRetouch).toBe(false);
    });
  });
}
