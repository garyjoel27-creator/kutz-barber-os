/**
 * KUTZ // BARBER OS — QR Booking Engine & Multi-Shop Platform
 * Tier 4: Real-World Application Workload Scenarios (7 Scenarios)
 * Strictly derived from explorer_e2e_2/handoff.md (T4.01–T4.07)
 */

import { expect } from './helpers/testHarness.mjs';
import {
  MockBlobsStore,
  SlotHoldManager,
  OfflineSyncEngine,
  DEFAULT_SHOP_FIXTURE,
  SHOP_REX_FIXTURE,
  INITIAL_CLIENTS_FIXTURE,
  executeBookingFunctionContract,
  executeSyncFunctionContract,
  executeAdminFunctionContract
} from './helpers/bookingContracts.mjs';
import { MockLocalStorageWithQuota } from './helpers/contracts.mjs';

export function registerBookingTier4Tests(runner) {
  runner.describe('Tier 4: Real-World Barbershop Workload Scenarios', () => {
    // Scenario 1: Complete Customer Lifecycle
    runner.it('T4.01: Scenario 1 — Complete Customer Lifecycle (From QR Scan to Haircut Completion & Chair Seating)', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const holdManager = new SlotHoldManager();

      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
      await store.setJSON('shops/kutz-madrid/appointments', []);
      await store.setJSON('shops/kutz-madrid/clients', INITIAL_CLIENTS_FIXTURE);

      // Phase 1: Customer scans QR and browses availability
      const pubReq = new Request('http://localhost/api/shops/kutz-madrid/public-state?date=2026-11-20');
      const pubRes = await executeBookingFunctionContract(pubReq, store, holdManager);
      const pubData = await pubRes.json();

      expect(pubData.shop.name).toContain('KUTZ');
      const slot1630 = pubData.availability.slots.find(s => s.time === '16:30' && s.barberId === 'b1');
      expect(slot1630.available).toBe(true);

      // Phase 2: Customer submits booking
      const bookReq = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'David Silva',
          clientPhone: '+34 611 223 344',
          barberId: 'b1',
          serviceId: 's3', // Skin Fade + Barba (45 min)
          date: '2026-11-20',
          timeSlot: '16:30'
        })
      });
      const bookRes = await executeBookingFunctionContract(bookReq, store, holdManager);
      const bookData = await bookRes.json();
      expect(bookData.status).toBe('pending');
      const bookingId = bookData.bookingId;

      // Phase 3: Barber receives and accepts in Salón Hoy
      const approveReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'approve', payload: { bookingId } })
      });
      const approveRes = await executeSyncFunctionContract(approveReq, store, holdManager);
      const approveData = await approveRes.json();

      expect(approveData.updatedState.status).toBe('confirmed');
      expect(approveData.whatsappUrl).toContain('34611223344');

      // Phase 4: Customer arrives next day and is seated in Chair 1
      const seatReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'seat', payload: { bookingId, chairId: 1 } })
      });
      const seatRes = await executeSyncFunctionContract(seatReq, store, holdManager);
      const seatData = await seatRes.json();

      expect(seatData.updatedState.status).toBe('seated');
      expect(seatData.updatedState.chairId).toBe(1);

      // Phase 5: Haircut completion and formula archival
      const finishReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({
          action: 'finish',
          payload: {
            bookingId,
            formula: '#000 Shaver base → #0.5 a 1 dedo → Tijera entresacar arriba'
          }
        })
      });
      const finishRes = await executeSyncFunctionContract(finishReq, store, holdManager);
      const finishData = await finishRes.json();

      expect(finishData.updatedState.status).toBe('completed');
      expect(finishData.updatedState.recipeFormula).toContain('Tijera entresacar');
    });

    // Scenario 2: Multi-Shop Tenant Lifecycle
    runner.it('T4.02: Scenario 2 — Multi-Shop Tenant Lifecycle (Super-Admin Provisioning -> QR Poster -> Booking -> Cross-Tenant Isolation)', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/index', ['kutz-madrid']);
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
      await store.setJSON('shops/kutz-madrid/appointments', []);

      // Phase 1: Super-Admin provisions Rex salon
      const provisionReq = new Request('http://localhost/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': 'kutz-superadmin-2026' },
        body: JSON.stringify(SHOP_REX_FIXTURE)
      });
      const provisionRes = await executeAdminFunctionContract(provisionReq, store);
      expect(provisionRes.status).toBe(201);

      // Phase 2: Barber Rex unlocks with PIN 7890 and generates QR
      const rexSync = await executeSyncFunctionContract(
        new Request('http://localhost/api/shops/barberia-rex/sync', { headers: { 'x-shop-pin': '7890' } }),
        store
      );
      expect(rexSync.status).toBe(200);
      const qrTarget = `https://luminadesk-gary.netlify.app/r/${SHOP_REX_FIXTURE.slug}`;
      expect(qrTarget).toBe('https://luminadesk-gary.netlify.app/r/barberia-rex');

      // Phase 3: Client books in Rex salon
      const rexBookReq = new Request('http://localhost/api/shops/barberia-rex/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Nico Client',
          clientPhone: '611000111',
          barberId: 'b-rex-1',
          serviceId: 's-rex-1',
          date: '2026-11-20',
          timeSlot: '17:00'
        })
      });
      const rexBookRes = await executeBookingFunctionContract(rexBookReq, store);
      expect(rexBookRes.status).toBe(201);

      // Phase 4: Strict cross-tenant isolation verification
      const madridSyncReq = new Request('http://localhost/api/shops/kutz-madrid/sync', { headers: { 'x-shop-pin': '1234' } });
      const madridSyncRes = await executeSyncFunctionContract(madridSyncReq, store);
      const madridData = await madridSyncRes.json();
      expect(madridData.appointments).toHaveLength(0); // ZERO leakage from Rex salon

      // Attempt to access Rex salon with Madrid PIN -> 403
      const badAccessReq = new Request('http://localhost/api/shops/barberia-rex/sync', { headers: { 'x-shop-pin': '1234' } });
      const badAccessRes = await executeSyncFunctionContract(badAccessReq, store);
      expect(badAccessRes.status).toBe(403);
    });

    // Scenario 3: Barber Rejection Workflow
    runner.it('T4.03: Scenario 3 — Barber Rejection Workflow (1-Touch Rejection with WhatsApp Rescheduling URL & Immediate Slot Release)', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const holdManager = new SlotHoldManager();

      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
      await store.setJSON('shops/kutz-madrid/appointments', []);

      // Phase 1: Slot hold creation
      const bookReq = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Carlos Méndez',
          clientPhone: '+34 612 345 678',
          barberId: 'b1',
          serviceId: 's1',
          date: '2026-11-20',
          timeSlot: '19:00'
        })
      });
      const bookRes = await executeBookingFunctionContract(bookReq, store, holdManager);
      const bookData = await bookRes.json();
      const bookingId = bookData.bookingId;

      // Phase 2: Barber rejects due to early maintenance
      const rejectReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'reject', payload: { bookingId, reason: 'Mantenimiento' } })
      });
      const rejectRes = await executeSyncFunctionContract(rejectReq, store, holdManager);
      const rejectData = await rejectRes.json();

      expect(rejectData.updatedState.status).toBe('rejected');
      expect(rejectData.whatsappUrl).toContain('34612345678');
      expect(holdManager.isHeld('kutz-madrid', 'b1', '2026-11-20', '19:00')).toBe(false);

      // Phase 3: Instant public slot recovery: another client books 19:00
      const newBookReq = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Lucas Rey',
          clientPhone: '699000111',
          barberId: 'b1',
          serviceId: 's1',
          date: '2026-11-20',
          timeSlot: '19:00'
        })
      });
      const newBookRes = await executeBookingFunctionContract(newBookReq, store, holdManager);
      expect(newBookRes.status).toBe(201);
    });

    // Scenario 4: Returning Star VIP Customer Recognition
    runner.it('T4.04: Scenario 4 — Returning Star VIP Customer Recognition (Auto-Linking 3D Recipe, Occipital Alerts & VIP Bono)', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
      await store.setJSON('shops/kutz-madrid/clients', INITIAL_CLIENTS_FIXTURE);
      await store.setJSON('shops/kutz-madrid/appointments', []);

      // Phase 1: Álex Rivera books via public web
      const bookReq = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Álex Rivera',
          clientPhone: '+34 622 456 789',
          barberId: 'b1',
          serviceId: 's1',
          date: '2026-11-20',
          timeSlot: '17:00'
        })
      });
      const bookRes = await executeBookingFunctionContract(bookReq, store);
      const bookData = await bookRes.json();
      const bookingId = bookData.bookingId;

      // Phase 2: Barber accepts and recipe auto-links
      const approveReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'approve', payload: { bookingId } })
      });
      const approveRes = await executeSyncFunctionContract(approveReq, store);
      const approveData = await approveRes.json();

      expect(approveData.updatedState.clientCardId).toBe('3');
      expect(approveData.updatedState.recipeFormula).toContain('Base Shaver #000');
      expect(approveData.updatedState.vipBono.active).toBe(true);

      // Phase 3: Barber seats Álex in Chair 3, debiting 1 VIP session
      const seatReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'seat', payload: { bookingId, chairId: 3 } })
      });
      await executeSyncFunctionContract(seatReq, store);

      const clients = await store.getJSON('shops/kutz-madrid/clients');
      const alex = clients.find(c => c.id === '3');
      expect(alex.vipBono.cutsRemaining).toBe(2); // Debited from 3 to 2
      expect(alex.vipBono.usedSessions).toBe(2);  // Incremented from 1 to 2
    });

    // Scenario 5: New Customer Indicative Style Onboarding
    runner.it('T4.05: Scenario 5 — New Customer Indicative Style Onboarding (Public Style Choice -> Auto 3D Card Creation)', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
      await store.setJSON('shops/kutz-madrid/clients', INITIAL_CLIENTS_FIXTURE);
      await store.setJSON('shops/kutz-madrid/appointments', []);

      // Phase 1: First-time client books with style "Mullet Moderno"
      const bookReq = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Dylan Torres',
          clientPhone: '+34 677 889 900',
          barberId: 'b1',
          serviceId: 's1',
          date: '2026-11-20',
          timeSlot: '18:00',
          indicativeStyle: 'Mullet Moderno'
        })
      });
      const bookRes = await executeBookingFunctionContract(bookReq, store);
      const bookData = await bookRes.json();
      const bookingId = bookData.bookingId;

      // Phase 2: Barber confirms booking
      const approveReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'approve', payload: { bookingId } })
      });
      await executeSyncFunctionContract(approveReq, store);

      // Phase 3: Client profile created automatically
      const clients = await store.getJSON('shops/kutz-madrid/clients');
      const dylan = clients.find(c => c.name === 'Dylan Torres');

      expect(dylan).toBeDefined();
      expect(dylan.indicativeStyle).toBe('Mullet Moderno');
      expect(dylan.reliabilityScore).toBe(100);

      // Phase 4: Barber finishes cut and updates real formula
      const finishReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({
          action: 'finish',
          payload: {
            bookingId,
            formula: 'Shaver contornos → #0.5 patillas → Tijera de esculpir nuca'
          }
        })
      });
      const finishRes = await executeSyncFunctionContract(finishReq, store);
      const finishData = await finishRes.json();

      expect(finishData.updatedState.recipeFormula).toContain('Tijera de esculpir nuca');
    });

    // Scenario 6: Internet Blackout & Sync Recovery
    runner.it('T4.06: Scenario 6 — Salon Peak Saturday Rush During Network Outage (Offline Outbox Queue -> Reconnect -> Blob Sync)', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const storage = new MockLocalStorageWithQuota();
      const holdManager = new SlotHoldManager();

      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
      await store.setJSON('shops/kutz-madrid/appointments', [
        { id: 'book-rush-1', clientName: 'Rush 1', clientPhone: '611000001', status: 'pending' },
        { id: 'book-rush-2', clientName: 'Rush 2', clientPhone: '611000002', status: 'pending' }
      ]);

      const syncEngine = new OfflineSyncEngine('kutz-madrid', { store, storage, holdManager, isOnline: false });

      // Barber accepts both bookings while WiFi is down
      await syncEngine.dispatchAction({ action: 'approve', payload: { bookingId: 'book-rush-1' } });
      await syncEngine.dispatchAction({ action: 'approve', payload: { bookingId: 'book-rush-2' } });

      expect(syncEngine.getOutbox()).toHaveLength(2);

      // WiFi is restored
      syncEngine.setOnlineStatus(true);
      const flushResult = await syncEngine.flushOutbox();

      expect(flushResult.success).toBe(true);
      expect(flushResult.processed).toBe(2);
      expect(syncEngine.getOutbox()).toHaveLength(0);

      const appointments = await store.getJSON('shops/kutz-madrid/appointments');
      expect(appointments[0].status).toBe('confirmed');
      expect(appointments[1].status).toBe('confirmed');
    });

    // Scenario 7 (Bonus): Walk-In Queue Dynamic Rebalancing
    runner.it('T4.07: Scenario 7 (Bonus) — Walk-In Queue Dynamic Rebalancing (Customer Cancellation & Early Chair Completion)', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
      await store.setJSON('shops/kutz-madrid/queue', [
        { id: 'c1', ticket: '#W01', status: 'waiting', position: 1, waitMinutes: 15 },
        { id: 'c2', ticket: '#W02', status: 'waiting', position: 2, waitMinutes: 30 },
        { id: 'c3', ticket: '#W03', status: 'waiting', position: 3, waitMinutes: 45 },
        { id: 'c4', ticket: '#W04', status: 'waiting', position: 4, waitMinutes: 60 }
      ]);

      // Phase 1: Client C2 self-cancels from mobile
      const cancelReq = new Request('http://localhost/api/shops/kutz-madrid/booking?ticketId=c2', { method: 'DELETE' });
      await executeBookingFunctionContract(cancelReq, store);

      let queue = await store.getJSON('shops/kutz-madrid/queue');
      expect(queue).toHaveLength(3);
      expect(queue.find(q => q.id === 'c3').position).toBe(2);
      expect(queue.find(q => q.id === 'c4').position).toBe(3);

      // Phase 2: Barber seats C1 early
      const seatReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'seat_walkin', payload: { queueId: 'c1', chairId: 1 } })
      });
      await executeSyncFunctionContract(seatReq, store);

      queue = await store.getJSON('shops/kutz-madrid/queue');
      expect(queue.find(q => q.id === 'c1').status).toBe('in_chair');

      // Remaining waiting clients advanced monotonically
      const c3 = queue.find(q => q.id === 'c3');
      const c4 = queue.find(q => q.id === 'c4');

      expect(c3.position).toBe(1);
      expect(c3.waitMinutes).toBe(0);
      expect(c4.position).toBe(2);
      expect(c4.waitMinutes).toBe(20);
    });
  });
}
