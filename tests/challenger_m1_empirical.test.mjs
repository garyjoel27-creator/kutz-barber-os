/**
 * luminadesk/tests/challenger_m1_empirical.test.mjs
 *
 * EMPIRICAL CHALLENGE SUITE FOR MILESTONE 1 (Backend & Blobs Sync Engine)
 * Challenger 1: Adversarial Concurrency, TTL Expiration, GDPR Penetration & Security Testing
 */

import bookingHandler from '../netlify/functions/booking.js';
import syncHandler from '../netlify/functions/sync.js';
import adminHandler from '../netlify/functions/admin.js';
import {
  resetMemoryStore,
  getShopAppointments,
  getShopQueue,
  setShopConfig,
  setShopAppointments,
  setShopQueue,
  setShopClients
} from '../netlify/functions/lib/blobsClient.js';
import { cleanExpiredHolds } from '../src/lib/syncService.js';
import { expect } from './helpers/testHarness.mjs';

const results = [];

function recordResult(category, testName, passed, details) {
  results.push({ category, testName, passed, details });
  const mark = passed ? '✔ PASS' : '✖ FAIL';
  console.log(`[${category}] ${mark} — ${testName}`);
  if (!passed || details?.warning) {
    console.log(`   Details:`, details);
  }
}

export function registerChallenger1EmpiricalSuites(runner) {
  runner.describe('Milestone 1 — Challenger 1 Empirical Concurrency & Security', () => {
    runner.it('C1.1: 5 simultaneous bookings for same slot -> exactly 1 succeeds (201) & 4 conflict (409)', async () => {
      resetMemoryStore();
      const count = 5;
      const requests = Array.from({ length: count }, (_, i) => {
        return new Request('http://localhost/api/shops/kutz-madrid/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'appointment',
            clientName: `Simultaneous Client ${i}`,
            clientPhone: `60011122${i}`,
            barberId: 'rex',
            serviceId: 'skin-fade',
            date: '2026-11-25',
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

      const storedApts = await getShopAppointments('kutz-madrid');
      expect(count201).toBe(1);
      expect(count409).toBe(count - 1);
      expect(storedApts.length).toBe(1);
    });

    runner.it('C1.2: 5 simultaneous walk-in queue joins -> positions are distinct (1..5) & all 5 preserved in store', async () => {
      resetMemoryStore();
      const count = 5;
      const requests = Array.from({ length: count }, (_, i) => {
        return new Request('http://localhost/api/shops/kutz-madrid/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'walkin',
            clientName: `Walkin Client ${i}`,
            clientPhone: `68800000${i}`,
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
      const storedQueue = await getShopQueue('kutz-madrid');

      expect(new Set(positions).size).toBe(count);
      expect(storedQueue.length).toBe(count);
    });

    runner.it('C1.3: Sequential collision check blocks second client with 409 (slot_unavailable)', async () => {
      resetMemoryStore();
      const req1 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Sequential Client 1',
          clientPhone: '611000111',
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-25',
          timeSlot: '12:00',
          rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
        })
      });
      const res1 = await bookingHandler(req1, { params: { shopSlug: 'kutz-madrid' } });

      const req2 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Sequential Client 2',
          clientPhone: '622000222',
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-25',
          timeSlot: '12:00',
          rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
        })
      });
      const res2 = await bookingHandler(req2, { params: { shopSlug: 'kutz-madrid' } });
      const data2 = await res2.json();

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(409);
      expect(data2.error).toBe('slot_unavailable');
    });

    runner.it('C1.4: Different barbers at the same time slot do NOT collide (both 201)', async () => {
      const reqRex = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Rex Client',
          clientPhone: '633000333',
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-25',
          timeSlot: '14:00',
          rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
        })
      });
      const resRex = await bookingHandler(reqRex, { params: { shopSlug: 'kutz-madrid' } });

      const reqKiko = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Kiko Client',
          clientPhone: '644000444',
          barberId: 'kiko',
          serviceId: 'skin-fade',
          date: '2026-11-25',
          timeSlot: '14:00',
          rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
        })
      });
      const resKiko = await bookingHandler(reqKiko, { params: { shopSlug: 'kutz-madrid' } });

      expect(resRex.status).toBe(201);
      expect(resKiko.status).toBe(201);
    });

    runner.it('C1.5: 10-minute hold locks slot, expires at 10m, cleanExpiredHolds releases it & allows rebooking (201)', async () => {
      resetMemoryStore();
      const t0 = 1763000000000;
      const originalDateNow = Date.now;

      try {
        Date.now = () => t0;
        const reqA = new Request('http://localhost/api/shops/kutz-madrid/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'appointment',
            clientName: 'TTL Client Alpha',
            clientPhone: '655000111',
            barberId: 'rex',
            serviceId: 'skin-fade',
            date: '2026-11-25',
            timeSlot: '16:00',
            rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
          })
        });
        const resA = await bookingHandler(reqA, { params: { shopSlug: 'kutz-madrid' } });
        const dataA = await resA.json();

        Date.now = () => t0 + 5 * 60 * 1000;
        const reqB = new Request('http://localhost/api/shops/kutz-madrid/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'appointment',
            clientName: 'TTL Client Beta',
            clientPhone: '655000222',
            barberId: 'rex',
            serviceId: 'skin-fade',
            date: '2026-11-25',
            timeSlot: '16:00',
            rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
          })
        });
        const resB = await bookingHandler(reqB, { params: { shopSlug: 'kutz-madrid' } });

        Date.now = () => t0 + 10 * 60 * 1000 + 1000;
        const apts = await getShopAppointments('kutz-madrid');
        const { hasChanges, expiredCount } = cleanExpiredHolds(apts, Date.now());

        const syncReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
          method: 'GET',
          headers: { 'x-shop-pin': '1234' }
        });
        const syncRes = await syncHandler(syncReq, { params: { shopSlug: 'kutz-madrid' } });
        const syncData = await syncRes.json();

        const reqC = new Request('http://localhost/api/shops/kutz-madrid/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'appointment',
            clientName: 'TTL Client Gamma',
            clientPhone: '655000333',
            barberId: 'rex',
            serviceId: 'skin-fade',
            date: '2026-11-25',
            timeSlot: '16:00',
            rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
          })
        });
        const resC = await bookingHandler(reqC, { params: { shopSlug: 'kutz-madrid' } });
        const dataC = await resC.json();

        expect(resA.status).toBe(201);
        expect(dataA.holdExpiresAt - t0).toBe(600000);
        expect(resB.status).toBe(409);
        expect(hasChanges).toBe(true);
        expect(expiredCount).toBe(1);
        expect(syncData.appointments[0].status).toBe('expired');
        expect(resC.status).toBe(201);
        expect(dataC.success).toBe(true);
      } finally {
        Date.now = originalDateNow;
      }
    });

    runner.it('C1.6: Public state endpoint strictly strips client PII, notes, formulas & PIN across diverse attack vectors', async () => {
      resetMemoryStore();
      const shopSlug = 'kutz-madrid';
      await setShopConfig(shopSlug, {
        slug: shopSlug,
        name: 'KUTZ // BARBER STUDIO',
        pin: '9876-SUPER-SECRET-PIN',
        status: 'active',
        phone: '+34 912 345 678',
        address: 'Calle de Fuencarral 42, Madrid',
        logo: 'https://example.com/logo.png',
        barbers: [{ id: 'rex', name: 'REX' }],
        services: [{ id: 'fade', name: 'Fade', durationMinutes: 30, price: 20 }],
        schedule: { openTime: '10:00', closeTime: '18:00', slotIntervalMinutes: 30 }
      });

      await setShopAppointments(shopSlug, [
        {
          id: 'apt-secret-1',
          shopSlug,
          clientName: 'VIP Marcos Varela',
          clientPhone: '+34 611 223 344',
          rawPhone: '+34 611 223 344',
          notes: 'Scalp psoriasis on crown; confidential client',
          barberId: 'rex',
          date: '2026-11-20',
          timeSlot: '11:00',
          status: 'confirmed'
        }
      ]);

      await setShopQueue(shopSlug, [
        {
          id: 'wq-secret-1',
          shopSlug,
          name: 'VIP Dani Morales',
          phone: '633 445 566',
          rawPhone: '+34 633 445 566',
          barber: 'rex',
          position: 1,
          waitMinutes: 20,
          status: 'waiting'
        }
      ]);

      await setShopClients(shopSlug, [
        {
          id: 'c-secret-1',
          name: 'VIP Álex Rivera',
          phone: '+34 622 334 455',
          treatments: [
            {
              id: 't-1',
              formula: 'Shaver #000 base with lever open #1.5 secret formula',
              notes: 'Sensitive skin'
            }
          ]
        }
      ]);

      const attackUrls = [
        'http://localhost/api/shops/kutz-madrid/public-state?date=2026-11-20',
        'http://localhost/api/shops/kutz-madrid/public-state',
        'http://localhost/api/shops/kutz-madrid/public-state?date=invalid-date',
        'http://localhost/api/shops/kutz-madrid/public-state?date=2026-11-20&admin=true&pin=9876-SUPER-SECRET-PIN'
      ];

      const leakedTokens = [];
      const sensitiveTokens = [
        'Marcos Varela',
        'Dani Morales',
        'Álex Rivera',
        '611 223 344',
        '611223344',
        '633 445 566',
        '633445566',
        '622 334 455',
        '622334455',
        'Scalp psoriasis',
        'confidential',
        'secret formula',
        'Sensitive skin',
        '9876-SUPER-SECRET-PIN'
      ];

      for (const urlStr of attackUrls) {
        const req = new Request(urlStr, { method: 'GET' });
        const res = await bookingHandler(req, { params: { shopSlug: 'kutz-madrid' } });
        const text = await res.text();
        for (const token of sensitiveTokens) {
          if (text.includes(token)) {
            leakedTokens.push({ url: urlStr, token });
          }
        }
      }

      expect(leakedTokens.length).toBe(0);
    });

    runner.it('C1.7: Unauthorized GET/POST/PUT without valid x-admin-key are blocked with 401', async () => {
      resetMemoryStore();
      const validKey = 'kutz-super-admin-2026';
      const wrongKey = 'attacker-wrong-key';

      // GET /api/admin/shops
      const getNoAuth = await adminHandler(new Request('http://localhost/api/admin/shops', { method: 'GET' }), {});
      const getWrongAuth = await adminHandler(new Request('http://localhost/api/admin/shops', { method: 'GET', headers: { 'x-admin-key': wrongKey } }), {});
      const getValidAuth = await adminHandler(new Request('http://localhost/api/admin/shops', { method: 'GET', headers: { 'x-admin-key': validKey } }), {});

      // POST /api/admin/shops
      const postPayload = { slug: 'new-shop-auth', name: 'New Shop Auth', pin: '4321' };
      const postNoAuth = await adminHandler(new Request('http://localhost/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postPayload)
      }), {});
      const postValidAuth = await adminHandler(new Request('http://localhost/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': validKey },
        body: JSON.stringify(postPayload)
      }), {});

      // PUT /api/admin/shops/:shopSlug
      const putPayload = { name: 'Updated Name' };
      const putNoAuth = await adminHandler(new Request('http://localhost/api/admin/shops/new-shop-auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(putPayload)
      }), { params: { shopSlug: 'new-shop-auth' } });
      const putValidAuth = await adminHandler(new Request('http://localhost/api/admin/shops/new-shop-auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': validKey },
        body: JSON.stringify(putPayload)
      }), { params: { shopSlug: 'new-shop-auth' } });

      expect(getNoAuth.status).toBe(401);
      expect(getWrongAuth.status).toBe(401);
      expect(getValidAuth.status).toBe(200);
      expect(postNoAuth.status).toBe(401);
      expect(postValidAuth.status).toBe(201);
      expect(putNoAuth.status).toBe(401);
      expect(putValidAuth.status).toBe(200);
    });

    runner.it('C1.8: Client header x-test-mode cannot bypass server-side authentication in production', async () => {
      const adminBypassReq = new Request('http://localhost/api/admin/shops', {
        method: 'GET',
        headers: { 'x-test-mode': 'true' }
      });
      const adminBypassRes = await adminHandler(adminBypassReq, {});

      const syncBypassReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'GET',
        headers: { 'x-test-mode': 'true' }
      });
      const syncBypassRes = await syncHandler(syncBypassReq, { params: { shopSlug: 'kutz-madrid' } });

      expect(adminBypassRes.status).toBe(401);
      expect(syncBypassRes.status).toBe(401);
    });
  });
}

async function runChallengerSuite() {
  console.log('\n=======================================================================');
  console.log('  CHALLENGER 1 — EMPIRICAL VERIFICATION HARNESS (MILESTONE 1)');
  console.log('=======================================================================\n');

  // -------------------------------------------------------------------------
  // 1. CONCURRENCY & COLLISION: Simultaneous Requests
  // -------------------------------------------------------------------------
  {
    resetMemoryStore();
    const count = 5;
    const requests = Array.from({ length: count }, (_, i) => {
      return new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: `Simultaneous Client ${i}`,
          clientPhone: `60011122${i}`,
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-25',
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

    const storedApts = await getShopAppointments('kutz-madrid');
    const storedAptsCount = storedApts.length;

    // Requirement: "Verify only one booking succeeds with 201 and all collisions receive 409 Conflict (slot_unavailable)"
    const passed = (count201 === 1 && count409 === count - 1 && storedAptsCount === 1);
    recordResult('Concurrency', '1.1: 5 simultaneous bookings for same slot -> exactly 1 succeeds (201) & 4 conflict (409)', passed, {
      statuses,
      count201,
      count409,
      storedAptsCount,
      storedClients: storedApts.map(a => a.clientName),
      verdict: passed ? 'PROTECTED' : 'CRITICAL BUG: Race condition allowed double bookings and state overwrite'
    });
  }

  // -------------------------------------------------------------------------
  // 2. CONCURRENCY: Walk-in Queue Race Condition
  // -------------------------------------------------------------------------
  {
    resetMemoryStore();
    const count = 5;
    const requests = Array.from({ length: count }, (_, i) => {
      return new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'walkin',
          clientName: `Walkin Client ${i}`,
          clientPhone: `68800000${i}`,
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
    const storedQueue = await getShopQueue('kutz-madrid');

    // Each client should get unique sequential position 1..5, and store must retain all 5
    const allUniquePositions = new Set(positions).size === count;
    const allRetainedInStore = storedQueue.length === count;
    const passed = allUniquePositions && allRetainedInStore;

    recordResult('Concurrency', '1.2: 5 simultaneous walk-in queue joins -> positions are distinct (1..5) & all 5 preserved in store', passed, {
      assignedPositions: positions,
      storedQueueCount: storedQueue.length,
      storedNames: storedQueue.map(q => q.name),
      verdict: passed ? 'PROTECTED' : 'CRITICAL BUG: Simultaneous walk-ins all assigned position 1 and overwrite each other'
    });
  }

  // -------------------------------------------------------------------------
  // 3. COLLISION: Sequential Requests
  // -------------------------------------------------------------------------
  {
    resetMemoryStore();
    const req1 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Sequential Client 1',
        clientPhone: '611000111',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-25',
        timeSlot: '12:00'
      })
    });
    const res1 = await bookingHandler(req1, { params: { shopSlug: 'kutz-madrid' } });

    const req2 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Sequential Client 2',
        clientPhone: '622000222',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-25',
        timeSlot: '12:00'
      })
    });
    const res2 = await bookingHandler(req2, { params: { shopSlug: 'kutz-madrid' } });
    const data2 = await res2.json();

    const passed = res1.status === 201 && res2.status === 409 && data2.error === 'slot_unavailable';
    recordResult('Collision', '2.1: Sequential collision check blocks second client with 409 (slot_unavailable)', passed, {
      res1Status: res1.status,
      res2Status: res2.status,
      res2Error: data2.error
    });
  }

  // -------------------------------------------------------------------------
  // 4. NON-COLLISION: Different Barber at Same Time
  // -------------------------------------------------------------------------
  {
    const reqRex = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Rex Client',
        clientPhone: '633000333',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-25',
        timeSlot: '14:00'
      })
    });
    const resRex = await bookingHandler(reqRex, { params: { shopSlug: 'kutz-madrid' } });

    const reqKiko = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Kiko Client',
        clientPhone: '644000444',
        barberId: 'kiko',
        serviceId: 'skin-fade',
        date: '2026-11-25',
        timeSlot: '14:00'
      })
    });
    const resKiko = await bookingHandler(reqKiko, { params: { shopSlug: 'kutz-madrid' } });

    const passed = resRex.status === 201 && resKiko.status === 201;
    recordResult('Collision', '2.2: Different barbers at the same time slot do NOT collide (both 201)', passed, {
      rexStatus: resRex.status,
      kikoStatus: resKiko.status
    });
  }

  // -------------------------------------------------------------------------
  // 5. SLOT HOLD TTL EXPIRATION
  // -------------------------------------------------------------------------
  {
    resetMemoryStore();
    const t0 = 1763000000000;
    const originalDateNow = Date.now;

    try {
      // Step A: Book at T0
      Date.now = () => t0;
      const reqA = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'TTL Client Alpha',
          clientPhone: '655000111',
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-25',
          timeSlot: '16:00',
          rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
        })
      });
      const resA = await bookingHandler(reqA, { params: { shopSlug: 'kutz-madrid' } });
      const dataA = await resA.json();

      // Step B: Attempt collision at T0 + 5 minutes -> must be blocked 409
      Date.now = () => t0 + 5 * 60 * 1000;
      const reqB = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'TTL Client Beta',
          clientPhone: '655000222',
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-25',
          timeSlot: '16:00',
          rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
        })
      });
      const resB = await bookingHandler(reqB, { params: { shopSlug: 'kutz-madrid' } });

      // Step C: Advance to T0 + 10m + 1s -> sweep holds & re-book
      Date.now = () => t0 + 10 * 60 * 1000 + 1000;
      const apts = await getShopAppointments('kutz-madrid');
      const { hasChanges, expiredCount } = cleanExpiredHolds(apts, Date.now());

      const syncReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'GET',
        headers: { 'x-shop-pin': '1234' }
      });
      const syncRes = await syncHandler(syncReq, { params: { shopSlug: 'kutz-madrid' } });
      const syncData = await syncRes.json();

      const reqC = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'TTL Client Gamma',
          clientPhone: '655000333',
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-25',
          timeSlot: '16:00',
          rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
        })
      });
      const resC = await bookingHandler(reqC, { params: { shopSlug: 'kutz-madrid' } });
      const dataC = await resC.json();

      const passed =
        resA.status === 201 &&
        dataA.holdExpiresAt - t0 === 600000 &&
        resB.status === 409 &&
        hasChanges === true &&
        expiredCount === 1 &&
        syncData.appointments[0].status === 'expired' &&
        resC.status === 201 &&
        dataC.success === true;

      recordResult('TTL Expiration', '3.1: 10-minute hold locks slot, expires at 10m, cleanExpiredHolds releases it & allows rebooking (201)', passed, {
        holdDurationMs: dataA.holdExpiresAt - t0,
        blockedAt5m: resB.status === 409,
        cleanedStatus: syncData.appointments[0]?.status,
        rebookedStatus: resC.status
      });
    } finally {
      Date.now = originalDateNow;
    }
  }

  // -------------------------------------------------------------------------
  // 6. GDPR PRIVACY PENETRATION
  // -------------------------------------------------------------------------
  {
    resetMemoryStore();
    const shopSlug = 'kutz-madrid';
    await setShopConfig(shopSlug, {
      slug: shopSlug,
      name: 'KUTZ // BARBER STUDIO',
      pin: '9876-SUPER-SECRET-PIN',
      status: 'active',
      phone: '+34 912 345 678',
      address: 'Calle de Fuencarral 42, Madrid',
      logo: 'https://example.com/logo.png',
      barbers: [{ id: 'rex', name: 'REX' }],
      services: [{ id: 'fade', name: 'Fade', durationMinutes: 30, price: 20 }],
      schedule: { openTime: '10:00', closeTime: '18:00', slotIntervalMinutes: 30 }
    });

    await setShopAppointments(shopSlug, [
      {
        id: 'apt-secret-1',
        shopSlug,
        clientName: 'VIP Marcos Varela',
        clientPhone: '+34 611 223 344',
        rawPhone: '+34 611 223 344',
        notes: 'Scalp psoriasis on crown; confidential client',
        barberId: 'rex',
        date: '2026-11-20',
        timeSlot: '11:00',
        status: 'confirmed'
      }
    ]);

    await setShopQueue(shopSlug, [
      {
        id: 'wq-secret-1',
        shopSlug,
        name: 'VIP Dani Morales',
        phone: '633 445 566',
        rawPhone: '+34 633 445 566',
        barber: 'rex',
        position: 1,
        waitMinutes: 20,
        status: 'waiting'
      }
    ]);

    await setShopClients(shopSlug, [
      {
        id: 'c-secret-1',
        name: 'VIP Álex Rivera',
        phone: '+34 622 334 455',
        treatments: [
          {
            id: 't-1',
            formula: 'Shaver #000 base with lever open #1.5 secret formula',
            notes: 'Sensitive skin'
          }
        ]
      }
    ]);

    const attackUrls = [
      'http://localhost/api/shops/kutz-madrid/public-state?date=2026-11-20',
      'http://localhost/api/shops/kutz-madrid/public-state',
      'http://localhost/api/shops/kutz-madrid/public-state?date=invalid-date',
      'http://localhost/api/shops/kutz-madrid/public-state?date=2026-11-20&admin=true&pin=9876-SUPER-SECRET-PIN'
    ];

    const leakedTokens = [];
    const sensitiveTokens = [
      'Marcos Varela',
      'Dani Morales',
      'Álex Rivera',
      '611 223 344',
      '611223344',
      '633 445 566',
      '633445566',
      '622 334 455',
      '622334455',
      'Scalp psoriasis',
      'confidential',
      'secret formula',
      'Sensitive skin',
      '9876-SUPER-SECRET-PIN'
    ];

    for (const urlStr of attackUrls) {
      const req = new Request(urlStr, { method: 'GET' });
      const res = await bookingHandler(req, { params: { shopSlug: 'kutz-madrid' } });
      const text = await res.text();
      for (const token of sensitiveTokens) {
        if (text.includes(token)) {
          leakedTokens.push({ url: urlStr, token });
        }
      }
    }

    const passed = leakedTokens.length === 0;
    recordResult('GDPR Penetration', '4.1: Public state endpoint strictly strips client PII, notes, formulas & PIN across diverse attack vectors', passed, {
      testedVectors: attackUrls.length,
      leaksDetected: leakedTokens.length,
      leakedTokens
    });
  }

  // -------------------------------------------------------------------------
  // 7. ADMIN AUTHENTICATION
  // -------------------------------------------------------------------------
  {
    resetMemoryStore();
    const validKey = 'kutz-super-admin-2026';
    const wrongKey = 'attacker-wrong-key';

    // GET /api/admin/shops
    const getNoAuth = await adminHandler(new Request('http://localhost/api/admin/shops', { method: 'GET' }), {});
    const getWrongAuth = await adminHandler(new Request('http://localhost/api/admin/shops', { method: 'GET', headers: { 'x-admin-key': wrongKey } }), {});
    const getValidAuth = await adminHandler(new Request('http://localhost/api/admin/shops', { method: 'GET', headers: { 'x-admin-key': validKey } }), {});

    // POST /api/admin/shops
    const postPayload = { slug: 'new-shop-auth', name: 'New Shop Auth', pin: '4321' };
    const postNoAuth = await adminHandler(new Request('http://localhost/api/admin/shops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload)
    }), {});
    const postValidAuth = await adminHandler(new Request('http://localhost/api/admin/shops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': validKey },
      body: JSON.stringify(postPayload)
    }), {});

    // PUT /api/admin/shops/:shopSlug
    const putPayload = { name: 'Updated Name' };
    const putNoAuth = await adminHandler(new Request('http://localhost/api/admin/shops/new-shop-auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(putPayload)
    }), { params: { shopSlug: 'new-shop-auth' } });
    const putValidAuth = await adminHandler(new Request('http://localhost/api/admin/shops/new-shop-auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': validKey },
      body: JSON.stringify(putPayload)
    }), { params: { shopSlug: 'new-shop-auth' } });

    const passed =
      getNoAuth.status === 401 &&
      getWrongAuth.status === 401 &&
      getValidAuth.status === 200 &&
      postNoAuth.status === 401 &&
      postValidAuth.status === 201 &&
      putNoAuth.status === 401 &&
      putValidAuth.status === 200;

    recordResult('Admin Auth', '5.1: Unauthorized GET/POST/PUT without valid x-admin-key are blocked with 401', passed, {
      getNoAuth: getNoAuth.status,
      getWrongAuth: getWrongAuth.status,
      getValidAuth: getValidAuth.status,
      postNoAuth: postNoAuth.status,
      postValidAuth: postValidAuth.status,
      putNoAuth: putNoAuth.status,
      putValidAuth: putValidAuth.status
    });
  }

  // -------------------------------------------------------------------------
  // 8. SECURITY VULNERABILITY AUDIT: Client Header Bypass (x-test-mode)
  // -------------------------------------------------------------------------
  {
    // Test if sending x-test-mode: true in headers allows an unauthenticated external attacker to bypass admin key & pin
    const adminBypassReq = new Request('http://localhost/api/admin/shops', {
      method: 'GET',
      headers: { 'x-test-mode': 'true' } // NO x-admin-key!
    });
    const adminBypassRes = await adminHandler(adminBypassReq, {});

    const syncBypassReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
      method: 'GET',
      headers: { 'x-test-mode': 'true' } // NO x-shop-pin!
    });
    const syncBypassRes = await syncHandler(syncBypassReq, { params: { shopSlug: 'kutz-madrid' } });

    const isSecure = adminBypassRes.status === 401 && syncBypassRes.status === 401;
    recordResult('Security Audit', '6.1: Client header x-test-mode cannot bypass server-side authentication in production', isSecure, {
      adminBypassStatus: adminBypassRes.status,
      syncBypassStatus: syncBypassRes.status,
      warning: !isSecure,
      verdict: isSecure ? 'SECURE' : 'VULNERABILITY: External client can bypass Admin Key and Shop PIN by passing x-test-mode: true header'
    });
  }

  console.log('\n=======================================================================');
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;

  console.log(`SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  const overallVerdict = failedTests === 0 ? 'APPROVE' : 'FAIL';
  console.log(`FINAL CHALLENGER VERDICT: [${overallVerdict}]`);
  console.log('=======================================================================\n');

  return { totalTests, passedTests, failedTests, overallVerdict, results };
}

const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith('challenger_m1_empirical.test.mjs') ||
  process.argv[1].includes('challenger_m1_empirical')
);

if (isDirectExecution) {
  runChallengerSuite().then(summary => {
    if (summary.overallVerdict === 'FAIL') {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }).catch(err => {
    console.error('Fatal test harness failure:', err);
    process.exit(2);
  });
}

export { runChallengerSuite };
