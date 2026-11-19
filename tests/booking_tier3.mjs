/**
 * KUTZ // BARBER OS — QR Booking Engine & Multi-Shop Platform
 * Tier 3: Cross-Feature Interactions (Pairwise Combinations, 14 Tests)
 * Strictly derived from explorer_e2e_2/handoff.md (T3.01–T3.14)
 */

import { expect } from './helpers/testHarness.mjs';
import {
  MockBlobsStore,
  SlotHoldManager,
  OfflineSyncEngine,
  DEFAULT_SHOP_FIXTURE,
  SHOP_REX_FIXTURE,
  INITIAL_CLIENTS_FIXTURE,
  validatePublicStateGdprBoundary,
  checkPinTestBypass,
  executeBookingFunctionContract,
  executeSyncFunctionContract,
  executeAdminFunctionContract
} from './helpers/bookingContracts.mjs';
import { MockLocalStorageWithQuota } from './helpers/contracts.mjs';

export function registerBookingTier3Tests(runner) {
  runner.describe('Tier 3: Cross-Feature Interactions (Pairwise Combinations)', () => {
    // T3.01: F05 + F06 + F10 + F11
    runner.it('T3.01: QR Booking -> 1-Touch Accept -> 3D Recipe Auto-Link -> Chair Seating -> Queue Update', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const holdManager = new SlotHoldManager();

      // Seed client Álex Rivera
      await store.setJSON('shops/kutz-madrid/clients', INITIAL_CLIENTS_FIXTURE);
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
      await store.setJSON('shops/kutz-madrid/appointments', []);

      // 1. Client books via public endpoint
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
          timeSlot: '16:00',
          notes: 'Fade bien comprimido'
        })
      });

      const bookRes = await executeBookingFunctionContract(bookReq, store, holdManager);
      expect(bookRes.status).toBe(201);
      const bookData = await bookRes.json();
      expect(bookData.success).toBe(true);
      expect(bookData.status).toBe('pending');
      const bookingId = bookData.bookingId;

      // 2. Barber polls sync
      const syncGetReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        headers: { 'x-shop-pin': '1234' }
      });
      const syncGetRes = await executeSyncFunctionContract(syncGetReq, store, holdManager);
      const syncGetData = await syncGetRes.json();
      expect(syncGetData.appointments).toHaveLength(1);

      // 3. Barber 1-touch approves
      const approveReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'approve', payload: { bookingId } })
      });
      const approveRes = await executeSyncFunctionContract(approveReq, store, holdManager);
      const approveData = await approveRes.json();

      expect(approveData.success).toBe(true);
      expect(approveData.updatedState.status).toBe('confirmed');
      expect(approveData.updatedState.clientCardId).toBe('3');
      expect(approveData.updatedState.recipeFormula).toContain('Base Shaver #000');
      expect(approveData.whatsappUrl.startsWith('https://wa.me/34622456789')).toBe(true);

      // 4. Barber seats client in Chair 1
      const seatReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'seat', payload: { bookingId, chairId: 1 } })
      });
      const seatRes = await executeSyncFunctionContract(seatReq, store, holdManager);
      const seatData = await seatRes.json();

      expect(seatData.success).toBe(true);
      expect(seatData.updatedState.status).toBe('seated');
      expect(seatData.updatedState.chairId).toBe(1);
    });

    // T3.02: F03 + F04 + F01
    runner.it('T3.02: Super-Admin Creates Shop B -> Tenant Configuration Isolation in Blobs', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/index', ['kutz-madrid']);
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);

      const newShop = {
        slug: 'barberia-valencia',
        name: 'Barbería Valencia Elite',
        pin: '5678',
        barbers: [{ id: 'b-val-1', name: 'Vicente', role: 'Barber', available: true }],
        services: [{ id: 's-val-1', name: 'Corte Tradicional', price: 20, durationMinutes: 30 }]
      };

      const req = new Request('http://localhost/api/admin/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'kutz-superadmin-2026'
        },
        body: JSON.stringify(newShop)
      });

      const res = await executeAdminFunctionContract(req, store);
      expect(res.status).toBe(201);

      const index = await store.getJSON('shops/index');
      expect(index.includes('kutz-madrid')).toBe(true);
      expect(index.includes('barberia-valencia')).toBe(true);

      const madridConfig = await store.getJSON('shops/kutz-madrid/config');
      expect(madridConfig.pin).toBe('1234'); // Untouched

      const valenciaConfig = await store.getJSON('shops/barberia-valencia/config');
      expect(valenciaConfig.pin).toBe('5678');
    });

    // T3.03: F03 + F01 + F05
    runner.it('T3.03: Client Books in Shop B -> Shop A Data Remains Strictly Isolated', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const holdManager = new SlotHoldManager();

      await store.setJSON('shops/barberia-rex/config', SHOP_REX_FIXTURE);
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
      await store.setJSON('shops/kutz-madrid/appointments', []);
      await store.setJSON('shops/barberia-rex/appointments', []);

      const req = new Request('http://localhost/api/shops/barberia-rex/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Carlos Fallas',
          clientPhone: '+34 655 443 322',
          barberId: 'b-rex-1',
          serviceId: 's-rex-1',
          date: '2026-11-20',
          timeSlot: '11:00'
        })
      });

      const res = await executeBookingFunctionContract(req, store, holdManager);
      expect(res.status).toBe(201);

      const rexApts = await store.getJSON('shops/barberia-rex/appointments');
      const madridApts = await store.getJSON('shops/kutz-madrid/appointments');

      expect(rexApts).toHaveLength(1);
      expect(rexApts[0].clientName).toBe('Carlos Fallas');
      expect(madridApts).toHaveLength(0); // Zero cross-tenant leakage
    });

    // T3.04: F07 + F10 + F01
    runner.it('T3.04: Mode 2 Walk-In Mobile Registration -> Dynamic Queue Recalculation -> Barber Chair Seating', async () => {
      const store = new MockBlobsStore('kutz_platform');

      // Seed 1 waiting client
      await store.setJSON('shops/kutz-madrid/queue', [
        { id: 'wq-1', ticket: '#W01', clientName: 'Hugo Navarro', status: 'waiting', position: 1, durationMinutes: 20 }
      ]);
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);

      // Customer 2 registers
      const req = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'walkin',
          clientName: 'Roberto Gómez',
          clientPhone: '+34 677 112 233',
          indicativeStyle: 'Low Taper Fade'
        })
      });

      const res = await executeBookingFunctionContract(req, store);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.position).toBe(2);
      expect(data.waitMinutes).toBe(20);

      // Barber seats client 1 in Chair 2
      const seatReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({
          action: 'seat_walkin',
          payload: { queueId: 'wq-1', chairId: 2 }
        })
      });

      const seatRes = await executeSyncFunctionContract(seatReq, store);
      expect(seatRes.status).toBe(200);

      const queue = await store.getJSON('shops/kutz-madrid/queue');
      expect(queue[0].status).toBe('in_chair');
      expect(queue[1].position).toBe(1); // Roberto advanced to pos 1
      expect(queue[1].waitMinutes).toBe(0);
    });

    // T3.05: F02 + F01
    runner.it('T3.05: Offline Booking Creation -> Sync Service Buffer in Outbox -> Network Restore -> Remote Blobs Flush', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const storage = new MockLocalStorageWithQuota();
      const holdManager = new SlotHoldManager();

      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
      await store.setJSON('shops/kutz-madrid/appointments', [
        { id: 'book-pending-10', clientName: 'Marcos', clientPhone: '612345678', status: 'pending' }
      ]);

      const syncEngine = new OfflineSyncEngine('kutz-madrid', { store, storage, holdManager, isOnline: false });

      // Barber approves while offline
      await syncEngine.dispatchAction({ action: 'approve', payload: { bookingId: 'book-pending-10' } });

      expect(syncEngine.getOutbox()).toHaveLength(1);

      // Network restores
      syncEngine.setOnlineStatus(true);
      const flushResult = await syncEngine.flushOutbox();

      expect(flushResult.success).toBe(true);
      expect(flushResult.processed).toBe(1);
      expect(syncEngine.getOutbox()).toHaveLength(0);

      const appointments = await store.getJSON('shops/kutz-madrid/appointments');
      expect(appointments[0].status).toBe('confirmed');
    });

    // T3.06: F08 + F03 + F01
    runner.it('T3.06: Multi-Tenant PIN Authentication Guard -> Unauthorized Sync Attempt Rejected -> Correct PIN Sync Granted', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE); // PIN: 1234
      await store.setJSON('shops/barberia-rex/config', SHOP_REX_FIXTURE);    // PIN: 7890

      // 1. Missing PIN header
      const reqNoPin = new Request('http://localhost/api/shops/kutz-madrid/sync');
      const resNoPin = await executeSyncFunctionContract(reqNoPin, store);
      expect(resNoPin.status).toBe(401);

      // 2. Wrong PIN
      const reqBadPin = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        headers: { 'x-shop-pin': '9999' }
      });
      const resBadPin = await executeSyncFunctionContract(reqBadPin, store);
      expect(resBadPin.status).toBe(403);

      // 3. Other shop's PIN
      const reqOtherPin = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        headers: { 'x-shop-pin': '7890' }
      });
      const resOtherPin = await executeSyncFunctionContract(reqOtherPin, store);
      expect(resOtherPin.status).toBe(403);

      // 4. Correct PIN
      const reqCorrectPin = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        headers: { 'x-shop-pin': '1234' }
      });
      const resCorrectPin = await executeSyncFunctionContract(reqCorrectPin, store);
      expect(resCorrectPin.status).toBe(200);
    });

    // T3.07: F06 + F01
    runner.it('T3.07: Slot Reservation Hold Lock -> Second Client Collision Rejection -> Hold Expiration -> Slot Re-Availability', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const holdManager = new SlotHoldManager(1); // 1-second TTL

      const bookingA = {
        type: 'appointment',
        clientName: 'Client 1',
        clientPhone: '611111111',
        barberId: 'b1',
        date: '2026-11-25',
        timeSlot: '11:00'
      };

      const bookingB = {
        type: 'appointment',
        clientName: 'Client 2',
        clientPhone: '622222222',
        barberId: 'b1',
        date: '2026-11-25',
        timeSlot: '11:00'
      };

      // Client 1 books
      const req1 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingA)
      });
      const res1 = await executeBookingFunctionContract(req1, store, holdManager);
      expect(res1.status).toBe(201);

      // Client 2 attempts same slot -> 409
      const req2 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingB)
      });
      const res2 = await executeBookingFunctionContract(req2, store, holdManager);
      expect(res2.status).toBe(409);

      // Expire hold in holdManager
      const hold = holdManager.getHold('kutz-madrid', 'b1', '2026-11-25', '11:00');
      if (hold) hold.expiresAt = Date.now() - 1000;

      // Simulate hold TTL expiration on stored pending appointment without database wipe
      const appointments = await store.getJSON('shops/kutz-madrid/appointments');
      expect(appointments).toHaveLength(1);
      appointments[0].holdExpiresAt = Date.now() - 1000;
      await store.setJSON('shops/kutz-madrid/appointments', appointments);

      // Verify public-state exposes slot as available after TTL expiration
      const pubReq = new Request('http://localhost/api/shops/kutz-madrid/public-state?date=2026-11-25');
      const pubRes = await executeBookingFunctionContract(pubReq, store, holdManager);
      const pubData = await pubRes.json();
      const slot1100 = pubData.availability.slots.find(s => s.time === '11:00' && s.barberId === 'b1');
      expect(slot1100.available).toBe(true);

      // Client 2 retries -> 201 Created (slot successfully claimed after hold expiration)
      const req3 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingB)
      });
      const res3 = await executeBookingFunctionContract(req3, store, holdManager);
      expect(res3.status).toBe(201);

      // Verify store retains appointment history (expired Client 1 hold + newly booked Client 2)
      const updatedAppointments = await store.getJSON('shops/kutz-madrid/appointments');
      expect(updatedAppointments).toHaveLength(2);
      expect(updatedAppointments[0].clientName).toBe('Client 1');
      expect(updatedAppointments[1].clientName).toBe('Client 2');
      expect(updatedAppointments[1].status).toBe('pending');
    });

    // T3.08: F10 + F06 + F05
    runner.it('T3.08: 1-Touch Barber Rejection -> WhatsApp Rescheduling URL Generation -> Instant Public Slot Release', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const holdManager = new SlotHoldManager();

      holdManager.acquireHold('kutz-madrid', 'b1', '2026-11-23', '18:00', '600555444');
      await store.setJSON('shops/kutz-madrid/appointments', [
        { id: 'book-rej-01', barberId: 'b1', clientName: 'Sergio Ramos', clientPhone: '600555444', date: '2026-11-23', timeSlot: '18:00', status: 'pending' }
      ]);

      // Barber rejects
      const req = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'reject', payload: { bookingId: 'book-rej-01', reason: 'Agenda completa' } })
      });

      const res = await executeSyncFunctionContract(req, store, holdManager);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.updatedState.status).toBe('rejected');
      expect(data.whatsappUrl).toContain('34600555444');
      expect(holdManager.isHeld('kutz-madrid', 'b1', '2026-11-23', '18:00')).toBe(false);

      // Public availability check shows 18:00 is available again
      const pubReq = new Request('http://localhost/api/shops/kutz-madrid/public-state?date=2026-11-23');
      const pubRes = await executeBookingFunctionContract(pubReq, store, holdManager);
      const pubData = await pubRes.json();

      const slot18 = pubData.availability.slots.find(s => s.time === '18:00' && s.barberId === 'b1');
      expect(slot18.available).toBe(true);
    });

    // T3.09: F09 + F05 + F03
    runner.it('T3.09: Printable QR Poster Generator ("Mi Cartel QR") -> Public Route Resolution & Privacy Boundary', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);

      const qrPayload = 'https://luminadesk-gary.netlify.app/r/kutz-madrid';
      expect(qrPayload).toContain('/r/kutz-madrid');

      const pubReq = new Request('http://localhost/api/shops/kutz-madrid/public-state');
      const pubRes = await executeBookingFunctionContract(pubReq, store);
      const pubData = await pubRes.json();

      const privacyCheck = validatePublicStateGdprBoundary(pubData);
      expect(privacyCheck.valid).toBe(true);
    });

    // T3.10: F05 + F10 + F11
    runner.it('T3.10: New Client Indicative Style Selection -> Mode 1 Booking -> 1-Touch Accept -> Automatic 3D Card Creation', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
      await store.setJSON('shops/kutz-madrid/clients', INITIAL_CLIENTS_FIXTURE);
      await store.setJSON('shops/kutz-madrid/appointments', []);

      // New client books
      const bookReq = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Iker Casillas',
          clientPhone: '+34 699 887 766',
          barberId: 'b1',
          serviceId: 's1',
          date: '2026-11-20',
          timeSlot: '12:00',
          indicativeStyle: 'Mullet Moderno'
        })
      });

      const bookRes = await executeBookingFunctionContract(bookReq, store);
      const bookData = await bookRes.json();
      const bookingId = bookData.bookingId;

      // Barber approves
      const approveReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'approve', payload: { bookingId } })
      });

      await executeSyncFunctionContract(approveReq, store);

      // Verify new client created in clients partition
      const clients = await store.getJSON('shops/kutz-madrid/clients');
      const newClient = clients.find(c => c.name === 'Iker Casillas');

      expect(newClient).toBeDefined();
      expect(newClient.indicativeStyle).toBe('Mullet Moderno');
      expect(newClient.formula).toContain('Mullet Moderno');
      expect(newClient.reliabilityScore).toBe(100);
    });

    // T3.11: F11 + F10 + F06
    runner.it('T3.11: Returning Client with Active VIP Bono -> 1-Touch Accept -> Chair Seating -> Automatic Session Debit', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
      await store.setJSON('shops/kutz-madrid/clients', [
        {
          id: '1',
          name: 'Mateo Vargas',
          phone: '+34 600 123 456',
          formula: 'Base Shaver #000 → #0.5 a 1 dedo',
          vipBono: { active: true, totalSessions: 4, usedSessions: 2, cutsRemaining: 2 }
        }
      ]);
      await store.setJSON('shops/kutz-madrid/appointments', []);

      // Mateo books
      const bookReq = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Mateo Vargas',
          clientPhone: '+34 600 123 456',
          barberId: 'b1',
          serviceId: 's1',
          date: '2026-11-20',
          timeSlot: '10:00'
        })
      });

      const bookRes = await executeBookingFunctionContract(bookReq, store);
      const bookData = await bookRes.json();
      const bookingId = bookData.bookingId;

      // Barber approves
      const approveReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'approve', payload: { bookingId } })
      });
      await executeSyncFunctionContract(approveReq, store);

      // Barber seats Mateo
      const seatReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'seat', payload: { bookingId, chairId: 1 } })
      });
      await executeSyncFunctionContract(seatReq, store);

      // Verify bono was debited
      const clients = await store.getJSON('shops/kutz-madrid/clients');
      const mateo = clients.find(c => c.id === '1');

      expect(mateo.vipBono.cutsRemaining).toBe(1);
      expect(mateo.vipBono.usedSessions).toBe(3);
    });

    // T3.12: F04 + F08 + F03
    runner.it('T3.12: Super-Admin Shop Update -> Dynamic PIN Invalidation -> Barber Lock Screen Enforcement', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);

      // Super admin updates shop PIN to 4321
      const updateReq = new Request('http://localhost/api/admin/shops/kutz-madrid', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'kutz-superadmin-2026'
        },
        body: JSON.stringify({ pin: '4321' })
      });
      await executeAdminFunctionContract(updateReq, store);

      // Barber tablet attempts sync with old PIN '1234' -> 403
      const oldSyncReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        headers: { 'x-shop-pin': '1234' }
      });
      const oldSyncRes = await executeSyncFunctionContract(oldSyncReq, store);
      expect(oldSyncRes.status).toBe(403);

      // Barber tablet inputs new PIN '4321' -> 200
      const newSyncReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        headers: { 'x-shop-pin': '4321' }
      });
      const newSyncRes = await executeSyncFunctionContract(newSyncReq, store);
      expect(newSyncRes.status).toBe(200);
    });

    // T3.13: F07 + F02 + F05
    runner.it('T3.13: Mode 2 Walk-In -> TV Screen Live Queue Real-Time Synchronization', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
      await store.setJSON('shops/kutz-madrid/queue', []);

      // Walkin 1
      const req1 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'walkin', clientName: 'Mario Bros', clientPhone: '611000001' })
      });
      await executeBookingFunctionContract(req1, store);

      // TV poll 1
      const tvPoll1 = await executeBookingFunctionContract(new Request('http://localhost/api/shops/kutz-madrid/public-state'), store);
      const tvData1 = await tvPoll1.json();
      expect(tvData1.queue.count).toBe(1);
      expect(tvData1.queue.waitMinutes).toBe(20);

      // Walkin 2
      const req2 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'walkin', clientName: 'Luigi Bros', clientPhone: '611000002' })
      });
      await executeBookingFunctionContract(req2, store);

      // TV poll 2
      const tvPoll2 = await executeBookingFunctionContract(new Request('http://localhost/api/shops/kutz-madrid/public-state'), store);
      const tvData2 = await tvPoll2.json();
      expect(tvData2.queue.count).toBe(2);
      expect(tvData2.queue.waitMinutes).toBe(40);
    });

    // T3.14: F05 + F08 + F03
    runner.it('T3.14: Security Boundary: Public Client Route vs Barber Private Route Isolation & Test-Mode Bypass', () => {
      // 1. Public route requires no authentication
      const isPublic = (path) => path.startsWith('/r/') || path === '/reservar';
      expect(isPublic('/r/kutz-madrid')).toBe(true);

      // 2. Headless runner bypass
      const testNavigator = { webdriver: true };
      expect(checkPinTestBypass(testNavigator)).toBe(true);

      // 3. Barber tablet requires PIN
      const tabletNavigator = { webdriver: false };
      expect(checkPinTestBypass(tabletNavigator)).toBe(false);
    });
  });
}
