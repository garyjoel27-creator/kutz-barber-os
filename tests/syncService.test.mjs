/**
 * tests/syncService.test.mjs
 * Comprehensive Unit and E2E Tests for Netlify Functions Backend & Sync Engine
 */

import { expect } from './helpers/testHarness.mjs';
import {
  HOLD_DURATION_MS,
  DEFAULT_SHOP_SLUG,
  SYNC_STATUS,
  getShopStorageKeys,
  calculateHoldExpiration,
  isSlotHeld,
  cleanExpiredHolds,
  isSlotAvailable,
  loadLocalShopState,
  saveLocalShopState,
  getOutbox,
  addToOutbox,
  removeFromOutbox,
  clearOutbox,
  flushOutbox,
  SyncEngine
} from '../src/lib/syncService.js';

import bookingHandler from '../netlify/functions/booking.js';
import syncHandler from '../netlify/functions/sync.js';
import adminHandler from '../netlify/functions/admin.js';
import { resetMemoryStore, getKutzStore, getShopAppointments, getShopQueue } from '../netlify/functions/lib/blobsClient.js';

// In-Memory Storage Helper for testing
function createMockStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, val) {
      store.set(key, String(val));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

export function registerSyncServiceTests(runner) {
  // SUITE 1: Multi-Tenant Storage Partitioning & State Persistence
  runner.describe('Milestone 1 — Shop Storage Partitioning & Local Persistence', () => {
    runner.it('S1.1: Generates shop-isolated storage keys partitioned by slug', () => {
      const madridKeys = getShopStorageKeys('kutz-madrid');
      const bcnKeys = getShopStorageKeys('kutz-barcelona');

      expect(madridKeys.APPOINTMENTS).toBe('kutz_kutz-madrid_appointments');
      expect(madridKeys.QUEUE).toBe('kutz_kutz-madrid_queue');
      expect(madridKeys.CLIENTS).toBe('kutz_kutz-madrid_clients');
      expect(madridKeys.CONFIG).toBe('kutz_kutz-madrid_config');
      expect(madridKeys.OUTBOX).toBe('kutz_kutz-madrid_outbox');
      expect(madridKeys.LAST_SYNC).toBe('kutz_kutz-madrid_last_sync');

      expect(bcnKeys.APPOINTMENTS).toBe('kutz_kutz-barcelona_appointments');
      expect(bcnKeys.QUEUE).toBe('kutz_kutz-barcelona_queue');
      expect(bcnKeys.APPOINTMENTS !== madridKeys.APPOINTMENTS).toBeTruthy();
    });

    runner.it('S1.2: Loads default shop configuration fixture for kutz-madrid fallback', () => {
      const storage = createMockStorage();
      const state = loadLocalShopState(DEFAULT_SHOP_SLUG, storage);

      expect(state.shopSlug).toBe('kutz-madrid');
      expect(state.config.name).toBe('KUTZ // BARBER STUDIO');
      expect(state.config.barbers.length >= 3).toBeTruthy();
      expect(state.config.services.length >= 4).toBeTruthy();
      expect(state.config.pin).toBe('1234');
    });

    runner.it('S1.3: Saves and loads state atomically across multiple isolated tenants', () => {
      const storage = createMockStorage();

      saveLocalShopState('shop-alpha', {
        appointments: [{ id: 'apt-a1', clientName: 'Alpha Client' }]
      }, storage);

      saveLocalShopState('shop-beta', {
        appointments: [{ id: 'apt-b1', clientName: 'Beta Client' }]
      }, storage);

      const alphaState = loadLocalShopState('shop-alpha', storage);
      const betaState = loadLocalShopState('shop-beta', storage);

      expect(alphaState.appointments.length).toBe(1);
      expect(alphaState.appointments[0].clientName).toBe('Alpha Client');

      expect(betaState.appointments.length).toBe(1);
      expect(betaState.appointments[0].clientName).toBe('Beta Client');
    });
  });

  // SUITE 2: Slot Holding Logic, Anti-Collision & Cleaner
  runner.describe('Milestone 1 — Slot Holding & Anti-Collision Engine', () => {
    runner.it('S2.1: Calculates exact 10-minute hold expiration', () => {
      const start = Date.now();
      const holdIso = calculateHoldExpiration(start, 10);
      const holdTime = new Date(holdIso).getTime();

      expect(holdTime - start).toBe(10 * 60 * 1000);
      expect(HOLD_DURATION_MS).toBe(600000);
    });

    runner.it('S2.2: isSlotHeld accurately identifies active vs expired holds', () => {
      const now = Date.now();
      const activeApt = {
        id: 'apt-1',
        status: 'pending',
        holdExpiresAt: now + 500000
      };
      const expiredApt = {
        id: 'apt-2',
        status: 'pending',
        holdExpiresAt: now - 1000
      };
      const confirmedApt = {
        id: 'apt-3',
        status: 'confirmed',
        holdExpiresAt: now + 500000
      };

      expect(isSlotHeld(activeApt, now)).toBe(true);
      expect(isSlotHeld(expiredApt, now)).toBe(false);
      expect(isSlotHeld(confirmedApt, now)).toBe(false);
    });

    runner.it('S2.3: cleanExpiredHolds sweeps expired holds to "expired" status without mutating confirmed slots', () => {
      const now = Date.now();
      const appointments = [
        { id: '1', status: 'pending', holdExpiresAt: now - 5000 },
        { id: '2', status: 'pending', holdExpiresAt: now + 60000 },
        { id: '3', status: 'confirmed', holdExpiresAt: null }
      ];

      const { updatedAppointments, hasChanges, expiredCount } = cleanExpiredHolds(appointments, now);

      expect(hasChanges).toBe(true);
      expect(expiredCount).toBe(1);
      expect(updatedAppointments[0].status).toBe('expired');
      expect(updatedAppointments[1].status).toBe('pending');
      expect(updatedAppointments[2].status).toBe('confirmed');
    });

    runner.it('S2.4: isSlotAvailable prevents collisions with active holds or confirmed bookings', () => {
      const now = Date.now();
      const appointments = [
        {
          id: 'apt-booked',
          date: '2026-11-15',
          time: '18:00',
          durationMinutes: 30,
          barberId: 'rex',
          status: 'confirmed'
        },
        {
          id: 'apt-held',
          date: '2026-11-15',
          time: '19:00',
          durationMinutes: 30,
          barberId: 'rex',
          status: 'pending',
          holdExpiresAt: now + 300000
        },
        {
          id: 'apt-expired',
          date: '2026-11-15',
          time: '19:30',
          durationMinutes: 30,
          barberId: 'rex',
          status: 'pending',
          holdExpiresAt: now - 1000
        }
      ];

      // Exact collision with confirmed booking
      expect(isSlotAvailable(appointments, '2026-11-15', '18:00', 30, 'rex', null, now)).toBe(false);

      // Overlap collision with confirmed booking (18:15 starts while 18:00-18:30 is in progress)
      expect(isSlotAvailable(appointments, '2026-11-15', '18:15', 30, 'rex', null, now)).toBe(false);

      // Same time for a DIFFERENT barber is AVAILABLE
      expect(isSlotAvailable(appointments, '2026-11-15', '18:00', 30, 'kiko', null, now)).toBe(true);

      // Collision with active hold
      expect(isSlotAvailable(appointments, '2026-11-15', '19:00', 30, 'rex', null, now)).toBe(false);

      // Expired hold does NOT block slot
      expect(isSlotAvailable(appointments, '2026-11-15', '19:30', 30, 'rex', null, now)).toBe(true);

      // Different date is available
      expect(isSlotAvailable(appointments, '2026-11-16', '18:00', 30, 'rex', null, now)).toBe(true);
    });
  });

  // SUITE 3: Outbox Queue & Offline Resilience
  runner.describe('Milestone 1 — Outbox Queue & Auto-Replay Engine', () => {
    runner.it('S3.1: Queues and manages actions in outbox during offline periods', () => {
      const storage = createMockStorage();
      const item1 = addToOutbox('kutz-madrid', 'approve', { appointmentId: 'apt-1' }, storage);
      const item2 = addToOutbox('kutz-madrid', 'seat', { chairId: 'SILLÓN 1' }, storage);

      const outbox = getOutbox('kutz-madrid', storage);
      expect(outbox.length).toBe(2);
      expect(outbox[0].id).toBe(item1.id);
      expect(outbox[1].id).toBe(item2.id);

      removeFromOutbox('kutz-madrid', item1.id, storage);
      expect(getOutbox('kutz-madrid', storage).length).toBe(1);

      clearOutbox('kutz-madrid', storage);
      expect(getOutbox('kutz-madrid', storage).length).toBe(0);
    });

    runner.it('S3.2: Flushes outbox successfully upon reconnection', async () => {
      const storage = createMockStorage();
      addToOutbox('kutz-madrid', 'approve', { appointmentId: 'apt-1' }, storage);
      addToOutbox('kutz-madrid', 'approve', { appointmentId: 'apt-2' }, storage);

      const processedUrls = [];
      const mockFetch = async (url) => {
        processedUrls.push(url);
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      const result = await flushOutbox('kutz-madrid', '1234', mockFetch, storage);

      expect(result.processed).toBe(2);
      expect(result.remaining).toBe(0);
      expect(getOutbox('kutz-madrid', storage).length).toBe(0);
      expect(processedUrls.length).toBe(2);
    });

    runner.it('S3.3: Halts outbox flush and preserves items when server encounters error', async () => {
      const storage = createMockStorage();
      addToOutbox('kutz-madrid', 'action1', {}, storage);
      addToOutbox('kutz-madrid', 'action2', {}, storage);

      const mockFailingFetch = async () => {
        return { ok: false, status: 503 };
      };

      const result = await flushOutbox('kutz-madrid', '1234', mockFailingFetch, storage);

      expect(result.processed).toBe(0);
      expect(result.remaining).toBe(2);
      expect(getOutbox('kutz-madrid', storage).length).toBe(2);
    });
  });

  // SUITE 4: Netlify Functions Handlers & GDPR Boundary
  runner.describe('Milestone 1 — Netlify Functions API & GDPR Boundary', () => {
    runner.it('S4.1: Public state endpoint strictly strips client PII (GDPR compliance)', async () => {
      resetMemoryStore();
      const req = new Request('http://localhost/api/shops/kutz-madrid/public-state?date=2026-11-15', {
        method: 'GET'
      });

      const res = await bookingHandler(req, { params: { shopSlug: 'kutz-madrid' } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.shop.name).toBe('KUTZ // BARBER STUDIO');
      expect(Array.isArray(data.availability)).toBe(true);
      expect(data.queue).toBeDefined();
      expect(typeof data.queue.count).toBe('number');
      expect(typeof data.queue.waitMinutes).toBe('number');

      // Verify zero client PII or private CRM formulas leaked in public state
      const serialized = JSON.stringify(data);
      expect(serialized.includes('Marcos Varela')).toBe(false);
      expect(serialized.includes('Dani Morales')).toBe(false);
      expect(serialized.includes('Álex Rivera')).toBe(false);
      expect(serialized.includes('611 223 344')).toBe(false);
      expect(serialized.includes('622 334 455')).toBe(false);
      expect(serialized.includes('formula')).toBe(false); // No cutting formulas
      expect(serialized.includes('Shaver')).toBe(false);
      expect(serialized.includes('Navaja')).toBe(true); // Public service descriptions are allowed
    });

    runner.it('S4.2: Mode 1 booking creates 10-minute slot hold and prevents race conditions', async () => {
      resetMemoryStore();
      const bookingPayload = {
        type: 'appointment',
        clientName: 'Alejandro Sanz',
        clientPhone: '+34 655 443 322',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-20',
        timeSlot: '17:00',
        rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
      };

      const req1 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload)
      });

      const res1 = await bookingHandler(req1, { params: { shopSlug: 'kutz-madrid' } });
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      expect(data1.success).toBe(true);
      expect(data1.status).toBe('pending');
      expect(data1.holdExpiresAt > Date.now()).toBe(true);

      // Immediate collision attempt by another client for same slot
      const req2 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bookingPayload,
          clientName: 'Other Person'
        })
      });

      const res2 = await bookingHandler(req2, { params: { shopSlug: 'kutz-madrid' } });
      expect(res2.status).toBe(409);
      const data2 = await res2.json();
      expect(data2.error).toBe('slot_unavailable');
    });

    runner.it('S4.3: Mode 2 booking appends client to live queue with position and wait time', async () => {
      resetMemoryStore();
      const queuePayload = {
        type: 'walkin',
        clientName: 'Carlos Sainz',
        clientPhone: '699 112 233',
        barberId: 'Cualquiera',
        serviceId: 'Skin Fade Express',
        rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
      };

      const req = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queuePayload)
      });

      const res = await bookingHandler(req, { params: { shopSlug: 'kutz-madrid' } });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.status).toBe('waiting');
      expect(data.position >= 1).toBe(true);
      expect(data.waitMinutes >= 20).toBe(true);
    });

    runner.it('S4.4: Sync endpoint enforces PIN security and returns 401 on unauthorized access', async () => {
      resetMemoryStore();
      // 1. Wrong PIN -> 401
      const unauthorizedReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'GET',
        headers: { 'x-shop-pin': 'wrong-pin' }
      });
      const res = await syncHandler(unauthorizedReq, { params: { shopSlug: 'kutz-madrid' } });
      expect(res.status).toBe(401);

      // 2. Missing PIN -> 401
      const noPinReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'GET'
      });
      const noPinRes = await syncHandler(noPinReq, { params: { shopSlug: 'kutz-madrid' } });
      expect(noPinRes.status).toBe(401);

      // 3. x-test-mode header bypass attempt -> MUST STILL BE 401
      const bypassReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'GET',
        headers: { 'x-test-mode': 'true' }
      });
      const bypassRes = await syncHandler(bypassReq, { params: { shopSlug: 'kutz-madrid' } });
      expect(bypassRes.status).toBe(401);

      // 4. Valid PIN -> 200
      const validReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'GET',
        headers: { 'x-shop-pin': '1234' }
      });
      const validRes = await syncHandler(validReq, { params: { shopSlug: 'kutz-madrid' } });
      expect(validRes.status).toBe(200);
    });

    runner.it('S4.5: Barber 1-touch approve connects 3D cards and normalizes WhatsApp country prefix (34)', async () => {
      resetMemoryStore();

      // Seed an appointment with a local 9-digit Spanish number (no international prefix)
      const store = getKutzStore();
      const apt = {
        id: 'apt-test-1',
        shopSlug: 'kutz-madrid',
        clientName: 'Álex Rivera',
        clientPhone: '622456789',
        rawPhone: '622456789',
        barberId: 'rex',
        date: '2026-11-20',
        timeSlot: '16:00',
        status: 'pending',
        holdExpiresAt: Date.now() + 600000
      };
      await store.setJSON('shops/kutz-madrid/appointments', [apt]);

      const approveReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shop-pin': '1234'
        },
        body: JSON.stringify({
          action: 'approve',
          payload: { appointmentId: 'apt-test-1' }
        })
      });

      const res = await syncHandler(approveReq, { params: { shopSlug: 'kutz-madrid' } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.appointment.status).toBe('confirmed');
      expect(data.appointment.holdExpiresAt).toBe(null);
      // Normalized with 34 prefix
      expect(data.whatsappUrl).toContain('https://wa.me/34622456789');
      expect(data.whatsappUrl).toContain('CONFIRMADA');

      // Test reject with 9-digit number also prefixes 34
      const aptReject = {
        id: 'apt-test-rej',
        shopSlug: 'kutz-madrid',
        clientName: 'Dani Morales',
        clientPhone: '633445566',
        rawPhone: '633445566',
        barberId: 'rex',
        date: '2026-11-20',
        timeSlot: '17:00',
        status: 'pending',
        holdExpiresAt: Date.now() + 600000
      };
      await store.setJSON('shops/kutz-madrid/appointments', [aptReject]);

      const rejectReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shop-pin': '1234'
        },
        body: JSON.stringify({
          action: 'reject',
          payload: { appointmentId: 'apt-test-rej' }
        })
      });
      const rejectRes = await syncHandler(rejectReq, { params: { shopSlug: 'kutz-madrid' } });
      expect(rejectRes.status).toBe(200);
      const rejectData = await rejectRes.json();
      expect(rejectData.whatsappUrl).toContain('https://wa.me/34633445566');
    });

    runner.it('S4.6: Super-Admin provisioning enforces auth (x-admin-key) and blocks bypass attempts', async () => {
      resetMemoryStore();

      const newShopPayload = {
        slug: 'barberia-valencia',
        name: 'KUTZ // VALENCIA PORT',
        pin: '5678',
        phone: '+34 960 112 233',
        address: 'Paseo Marítimo 12, Valencia'
      };

      // 1. Missing auth -> 401
      const noAuthReq = new Request('http://localhost/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShopPayload)
      });
      const noAuthRes = await adminHandler(noAuthReq, {});
      expect(noAuthRes.status).toBe(401);

      // 2. Header bypass attempt (x-test-mode) -> MUST BE 401
      const bypassReq = new Request('http://localhost/api/admin/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-mode': 'true'
        },
        body: JSON.stringify(newShopPayload)
      });
      const bypassRes = await adminHandler(bypassReq, {});
      expect(bypassRes.status).toBe(401);

      // 3. Valid admin key (kutz_super_admin_secret_2026) -> 201
      const adminReq = new Request('http://localhost/api/admin/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'kutz_super_admin_secret_2026'
        },
        body: JSON.stringify(newShopPayload)
      });

      const res = await adminHandler(adminReq, {});
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.shop.slug).toBe('barberia-valencia');

      // 4. Verify listed in admin catalog with valid key
      const listReq = new Request('http://localhost/api/admin/shops', {
        method: 'GET',
        headers: { 'x-admin-key': 'kutz_super_admin_secret_2026' }
      });
      const listRes = await adminHandler(listReq, {});
      const listData = await listRes.json();
      expect(listData.shops.some(s => s.slug === 'barberia-valencia')).toBe(true);
    });

    runner.it('S4.7: Mode 1 booking validates open business days and rejects closed days with 400', async () => {
      resetMemoryStore();
      // 2026-11-22 is Sunday (closed)
      const sundayBooking = {
        type: 'appointment',
        clientName: 'Sunday Client',
        clientPhone: '611223344',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-22',
        timeSlot: '11:00',
        rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
      };

      const req = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sundayBooking)
      });

      const res = await bookingHandler(req, { params: { shopSlug: 'kutz-madrid' } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('shop_closed_on_date');
    });

    runner.it('S4.8: Mode 1 booking validates business hours and rejects outside hours with 400', async () => {
      resetMemoryStore();
      // 22:00 is after closeTime (20:30)
      const lateBooking = {
        type: 'appointment',
        clientName: 'Late Client',
        clientPhone: '611223344',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-20',
        timeSlot: '22:00',
        rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
      };

      const lateReq = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lateBooking)
      });

      const lateRes = await bookingHandler(lateReq, { params: { shopSlug: 'kutz-madrid' } });
      expect(lateRes.status).toBe(400);
      const lateData = await lateRes.json();
      expect(lateData.error).toBe('outside_business_hours');

      // 03:00 is before openTime (10:00)
      const earlyBooking = {
        type: 'appointment',
        clientName: 'Early Client',
        clientPhone: '611223344',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-20',
        timeSlot: '03:00',
        rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
      };

      const earlyReq = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(earlyBooking)
      });

      const earlyRes = await bookingHandler(earlyReq, { params: { shopSlug: 'kutz-madrid' } });
      expect(earlyRes.status).toBe(400);
      const earlyData = await earlyRes.json();
      expect(earlyData.error).toBe('outside_business_hours');
    });

    runner.it('S4.9: Concurrency lock prevents double-booking under simultaneous Promise.all requests', async () => {
      resetMemoryStore();
      const count = 5;
      const requests = Array.from({ length: count }, (_, i) => {
        return new Request('http://localhost/api/shops/kutz-madrid/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'appointment',
            clientName: `Concurrent Client ${i}`,
            clientPhone: `65511122${i}`,
            barberId: 'rex',
            serviceId: 'skin-fade',
            date: '2026-11-20',
            timeSlot: '11:00',
            rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
          })
        });
      });

      const responses = await Promise.all(
        requests.map(req => bookingHandler(req, { params: { shopSlug: 'kutz-madrid' } }))
      );

      const statuses = responses.map(r => r.status);
      const count201 = statuses.filter(s => s === 201).length;
      const count409 = statuses.filter(s => s === 409).length;

      expect(count201).toBe(1);
      expect(count409).toBe(4);

      const stored = await getShopAppointments('kutz-madrid');
      expect(stored.length).toBe(1);
    });

    runner.it('S4.10: Concurrency lock assigns distinct positions to simultaneous walk-in queue joins', async () => {
      resetMemoryStore();
      const count = 5;
      const requests = Array.from({ length: count }, (_, i) => {
        return new Request('http://localhost/api/shops/kutz-madrid/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'walkin',
            clientName: `Queue Client ${i}`,
            clientPhone: `67700011${i}`,
            barberId: 'Cualquiera',
            serviceId: 'Skin Fade Express',
            rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
          })
        });
      });

      const responses = await Promise.all(
        requests.map(req => bookingHandler(req, { params: { shopSlug: 'kutz-madrid' } }))
      );

      const bodies = await Promise.all(responses.map(r => r.json()));
      const positions = bodies.map(b => b.position);

      expect(new Set(positions).size).toBe(count);
      const storedQueue = await getShopQueue('kutz-madrid');
      expect(storedQueue.length).toBe(count);
    });
  });

  // SUITE 5: Dual-Layer Client Engine
  runner.describe('Milestone 1 — SyncEngine Background Lifecycle', () => {
    runner.it('S5.1: SyncEngine manages state, polling lifecycle and event subscription', async () => {
      const storage = createMockStorage();
      const engine = new SyncEngine({
        shopSlug: 'kutz-madrid',
        pin: '1234',
        intervalMs: 100,
        storage
      });

      expect(engine.getStatus()).toBe(SYNC_STATUS.IDLE);

      let dataEmitted = false;
      engine.on('data', () => {
        dataEmitted = true;
      });

      await engine.forceSync();
      expect(dataEmitted).toBe(true);
      expect(engine.getStatus()).toBe(SYNC_STATUS.OFFLINE); // Local storage fallback in test

      engine.destroy();
      expect(engine.timerId).toBe(null);
    });
  });
}
