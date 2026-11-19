/**
 * luminadesk/tests/challenger3_empirical_stress.mjs
 *
 * EMPIRICAL ADVERSARIAL STRESS SUITE (CHALLENGER 3)
 * Milestone 1 — Iteration 2 Independent Empirical Verification
 *
 * Validates:
 * 1. Concurrency: 5 & 10 simultaneous booking requests for identical slot -> exactly 1x 201 & all others 409
 * 2. Concurrency: 5 & 10 simultaneous walk-in queue joins -> sequential positions 1..N & zero state overwrite
 * 3. Multi-Tenant Concurrency: Simultaneous requests across distinct shop slugs do not cross-block or contaminate
 * 4. Distinct Barbers Concurrency: Simultaneous requests for different barbers at the exact same time slot both succeed
 * 5. Security Attack Vectors:
 *    - x-test-mode header bypass attempts across admin and sync endpoints strictly rejected with 401
 *    - Missing, invalid, or forged credentials rejected with 401
 * 6. Business Schedule & Hours Enforcement: Closed days and outside hours strictly rejected with 400
 * 7. WhatsApp wa.me Phone Prefix Normalization (+34 for 9-digit Spanish numbers)
 */

import bookingHandler from '../netlify/functions/booking.js';
import syncHandler from '../netlify/functions/sync.js';
import adminHandler from '../netlify/functions/admin.js';
import { formatWhatsAppNumber } from '../netlify/functions/sync.js';
import {
  resetMemoryStore,
  getShopAppointments,
  getShopQueue,
  setShopConfig,
  setShopAppointments,
  setShopQueue,
  DEFAULT_SHOP_CONFIG
} from '../netlify/functions/lib/blobsClient.js';

const results = [];

function record(name, passed, details = {}) {
  results.push({ name, passed, details });
  const icon = passed ? '\x1b[32m✔ PASS\x1b[0m' : '\x1b[31m✖ FAIL\x1b[0m';
  console.log(`  ${icon} ${name}`);
  if (!passed || details.warning) {
    console.log('     Details:', JSON.stringify(details, null, 2));
  }
}

export async function runChallenger3StressSuite() {
  console.log('\n=======================================================================');
  console.log('  CHALLENGER 3 — EMPIRICAL STRESS & CONCURRENCY VERIFICATION');
  console.log('=======================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: 5 Simultaneous Booking Requests for Same Slot
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
          clientName: `Simultaneous Client 5-${i}`,
          clientPhone: `61100000${i}`,
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-25', // Wednesday
          timeSlot: '11:00'
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

    const passed = count201 === 1 && count409 === count - 1 && storedApts.length === 1;
    record('1.1: 5 simultaneous bookings for same slot -> exactly 1x 201 & 4x 409', passed, {
      statuses,
      count201,
      count409,
      storedCount: storedApts.length
    });
  }

  // -------------------------------------------------------------------------
  // TEST 2: 10 Simultaneous Booking Requests for Same Slot
  // -------------------------------------------------------------------------
  {
    resetMemoryStore();
    const count = 10;
    const requests = Array.from({ length: count }, (_, i) => {
      return new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: `Simultaneous Client 10-${i}`,
          clientPhone: `6220000${String(i).padStart(2, '0')}`,
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-25', // Wednesday
          timeSlot: '12:00'
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

    const passed = count201 === 1 && count409 === count - 1 && storedApts.length === 1;
    record('1.2: 10 simultaneous bookings for same slot -> exactly 1x 201 & 9x 409', passed, {
      statuses,
      count201,
      count409,
      storedCount: storedApts.length
    });
  }

  // -------------------------------------------------------------------------
  // TEST 3: 5 Simultaneous Walk-in Queue Joins
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
          clientName: `Queue Client 5-${i}`,
          clientPhone: `63300000${i}`,
          barberId: 'Cualquiera',
          serviceId: 'Skin Fade Express'
        })
      });
    });

    const responses = await Promise.all(
      requests.map(req => bookingHandler(req, { params: { shopSlug: 'kutz-madrid' } }))
    );

    const bodies = await Promise.all(responses.map(r => r.json()));
    const positions = bodies.map(b => b.position);
    const storedQueue = await getShopQueue('kutz-madrid');

    const uniquePositions = new Set(positions).size === count;
    const allStored = storedQueue.length === count;
    const sequential = positions.slice().sort((a, b) => a - b).every((pos, idx) => pos === idx + 1);

    const passed = uniquePositions && allStored && sequential;
    record('2.1: 5 simultaneous walk-in joins -> distinct sequential positions 1..5 & all 5 preserved', passed, {
      positions,
      storedCount: storedQueue.length
    });
  }

  // -------------------------------------------------------------------------
  // TEST 4: 10 Simultaneous Walk-in Queue Joins
  // -------------------------------------------------------------------------
  {
    resetMemoryStore();
    const count = 10;
    const requests = Array.from({ length: count }, (_, i) => {
      return new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'walkin',
          clientName: `Queue Client 10-${i}`,
          clientPhone: `6440000${String(i).padStart(2, '0')}`,
          barberId: 'Cualquiera',
          serviceId: 'Skin Fade Express'
        })
      });
    });

    const responses = await Promise.all(
      requests.map(req => bookingHandler(req, { params: { shopSlug: 'kutz-madrid' } }))
    );

    const bodies = await Promise.all(responses.map(r => r.json()));
    const positions = bodies.map(b => b.position);
    const storedQueue = await getShopQueue('kutz-madrid');

    const uniquePositions = new Set(positions).size === count;
    const allStored = storedQueue.length === count;
    const sequential = positions.slice().sort((a, b) => a - b).every((pos, idx) => pos === idx + 1);

    const passed = uniquePositions && allStored && sequential;
    record('2.2: 10 simultaneous walk-in joins -> distinct sequential positions 1..10 & all 10 preserved', passed, {
      positions,
      storedCount: storedQueue.length
    });
  }

  // -------------------------------------------------------------------------
  // TEST 5: Multi-Tenant Concurrency (Shop A vs Shop B at same slot)
  // -------------------------------------------------------------------------
  {
    resetMemoryStore();
    // Provision Shop B
    await setShopConfig('barberia-rex', {
      ...DEFAULT_SHOP_CONFIG,
      slug: 'barberia-rex',
      name: 'BARBERÍA REX BILBAO',
      pin: '5678'
    });

    // 5 simultaneous requests to Shop A, and 5 simultaneous requests to Shop B at 15:00
    const reqsA = Array.from({ length: 5 }, (_, i) => {
      return new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: `ShopA Client ${i}`,
          clientPhone: `65511111${i}`,
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-25',
          timeSlot: '15:00'
        })
      });
    });

    const reqsB = Array.from({ length: 5 }, (_, i) => {
      return new Request('http://localhost/api/shops/barberia-rex/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: `ShopB Client ${i}`,
          clientPhone: `66611111${i}`,
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-25',
          timeSlot: '15:00'
        })
      });
    });

    // Fire all 10 simultaneously
    const [respsA, respsB] = await Promise.all([
      Promise.all(reqsA.map(r => bookingHandler(r, { params: { shopSlug: 'kutz-madrid' } }))),
      Promise.all(reqsB.map(r => bookingHandler(r, { params: { shopSlug: 'barberia-rex' } })))
    ]);

    const count201A = respsA.map(r => r.status).filter(s => s === 201).length;
    const count409A = respsA.map(r => r.status).filter(s => s === 409).length;
    const count201B = respsB.map(r => r.status).filter(s => s === 201).length;
    const count409B = respsB.map(r => r.status).filter(s => s === 409).length;

    const aptsA = await getShopAppointments('kutz-madrid');
    const aptsB = await getShopAppointments('barberia-rex');

    const passed =
      count201A === 1 && count409A === 4 && aptsA.length === 1 &&
      count201B === 1 && count409B === 4 && aptsB.length === 1;

    record('3.1: Multi-tenant concurrency -> Shop A and Shop B mutate independently without collision', passed, {
      shopA: { count201: count201A, count409: count409A, stored: aptsA.length },
      shopB: { count201: count201B, count409: count409B, stored: aptsB.length }
    });
  }

  // -------------------------------------------------------------------------
  // TEST 6: Distinct Barbers Concurrency (Same Shop, Same Time Slot)
  // -------------------------------------------------------------------------
  {
    resetMemoryStore();
    const reqRex = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Rex Client Simultaneous',
        clientPhone: '677111222',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-25',
        timeSlot: '16:00'
      })
    });

    const reqKiko = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Kiko Client Simultaneous',
        clientPhone: '677333444',
        barberId: 'kiko',
        serviceId: 'skin-fade',
        date: '2026-11-25',
        timeSlot: '16:00'
      })
    });

    const [resRex, resKiko] = await Promise.all([
      bookingHandler(reqRex, { params: { shopSlug: 'kutz-madrid' } }),
      bookingHandler(reqKiko, { params: { shopSlug: 'kutz-madrid' } })
    ]);

    const storedApts = await getShopAppointments('kutz-madrid');
    const passed = resRex.status === 201 && resKiko.status === 201 && storedApts.length === 2;

    record('3.2: Different barbers at identical time slot both succeed (201) simultaneously', passed, {
      rexStatus: resRex.status,
      kikoStatus: resKiko.status,
      storedAptsCount: storedApts.length
    });
  }

  // -------------------------------------------------------------------------
  // TEST 7: Security Penetration — x-test-mode Header Attack
  // -------------------------------------------------------------------------
  {
    resetMemoryStore();
    const attacks = [
      // Sync GET without PIN, with x-test-mode
      {
        name: 'Sync GET with x-test-mode: true',
        exec: () => syncHandler(new Request('http://localhost/api/shops/kutz-madrid/sync', {
          method: 'GET',
          headers: { 'x-test-mode': 'true' }
        }), { params: { shopSlug: 'kutz-madrid' } })
      },
      // Sync POST without PIN, with x-test-mode
      {
        name: 'Sync POST with x-test-mode: true',
        exec: () => syncHandler(new Request('http://localhost/api/shops/kutz-madrid/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-test-mode': 'true' },
          body: JSON.stringify({ action: 'approve', payload: { appointmentId: 'apt-1' } })
        }), { params: { shopSlug: 'kutz-madrid' } })
      },
      // Admin GET without admin key, with x-test-mode
      {
        name: 'Admin GET with x-test-mode: true',
        exec: () => adminHandler(new Request('http://localhost/api/admin/shops', {
          method: 'GET',
          headers: { 'x-test-mode': 'true' }
        }), {})
      },
      // Admin POST without admin key, with x-test-mode
      {
        name: 'Admin POST with x-test-mode: true',
        exec: () => adminHandler(new Request('http://localhost/api/admin/shops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-test-mode': 'true' },
          body: JSON.stringify({ slug: 'attack-shop', name: 'Attack Shop', pin: '0000' })
        }), {})
      },
      // Admin PUT without admin key, with x-test-mode
      {
        name: 'Admin PUT with x-test-mode: true',
        exec: () => adminHandler(new Request('http://localhost/api/admin/shops/kutz-madrid', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-test-mode': 'true' },
          body: JSON.stringify({ name: 'Hacked Shop' })
        }), { params: { shopSlug: 'kutz-madrid' } })
      }
    ];

    let allBlocked = true;
    const attackResults = [];
    for (const atk of attacks) {
      const res = await atk.exec();
      const blocked = res.status === 401;
      attackResults.push({ name: atk.name, status: res.status, blocked });
      if (!blocked) allBlocked = false;
    }

    record('4.1: x-test-mode attack rejected with 401 across all admin and sync endpoints', allBlocked, {
      attackResults
    });
  }

  // -------------------------------------------------------------------------
  // TEST 8: Genuine Credential Authorization Verification
  // -------------------------------------------------------------------------
  {
    resetMemoryStore();
    // Valid shop PIN succeeds
    const validPinRes = await syncHandler(new Request('http://localhost/api/shops/kutz-madrid/sync', {
      method: 'GET',
      headers: { 'x-shop-pin': '1234' }
    }), { params: { shopSlug: 'kutz-madrid' } });

    // Invalid shop PIN fails
    const invalidPinRes = await syncHandler(new Request('http://localhost/api/shops/kutz-madrid/sync', {
      method: 'GET',
      headers: { 'x-shop-pin': '9999' }
    }), { params: { shopSlug: 'kutz-madrid' } });

    // Valid admin key succeeds
    const validAdminRes = await adminHandler(new Request('http://localhost/api/admin/shops', {
      method: 'GET',
      headers: { 'x-admin-key': 'kutz-super-admin-2026' }
    }), {});

    // Invalid admin key fails
    const invalidAdminRes = await adminHandler(new Request('http://localhost/api/admin/shops', {
      method: 'GET',
      headers: { 'x-admin-key': 'fake-key-123' }
    }), {});

    const passed =
      validPinRes.status === 200 &&
      invalidPinRes.status === 401 &&
      validAdminRes.status === 200 &&
      invalidAdminRes.status === 401;

    record('4.2: Legitimate PIN & Admin Key granted (200), wrong credentials denied (401)', passed, {
      validPinStatus: validPinRes.status,
      invalidPinStatus: invalidPinRes.status,
      validAdminStatus: validAdminRes.status,
      invalidAdminStatus: invalidAdminRes.status
    });
  }

  // -------------------------------------------------------------------------
  // TEST 9: Schedule & Business Hours Validation
  // -------------------------------------------------------------------------
  {
    resetMemoryStore();
    // Sunday (closed day)
    const sundayRes = await bookingHandler(new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Sunday Client',
        clientPhone: '688111222',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-22', // Sunday
        timeSlot: '11:00'
      })
    }), { params: { shopSlug: 'kutz-madrid' } });
    const sundayData = await sundayRes.json();

    // Outside business hours (22:00)
    const lateHourRes = await bookingHandler(new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Late Client',
        clientPhone: '688222333',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-25', // Wednesday
        timeSlot: '22:00'
      })
    }), { params: { shopSlug: 'kutz-madrid' } });
    const lateHourData = await lateHourRes.json();

    // Early morning before open (08:00)
    const earlyHourRes = await bookingHandler(new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Early Client',
        clientPhone: '688333444',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-25', // Wednesday
        timeSlot: '08:00'
      })
    }), { params: { shopSlug: 'kutz-madrid' } });
    const earlyHourData = await earlyHourRes.json();

    // Valid Wednesday slot at 11:00
    const validSlotRes = await bookingHandler(new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Valid Client',
        clientPhone: '688444555',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-25', // Wednesday
        timeSlot: '11:00'
      })
    }), { params: { shopSlug: 'kutz-madrid' } });

    const passed =
      sundayRes.status === 400 && sundayData.error === 'shop_closed_on_date' &&
      lateHourRes.status === 400 && lateHourData.error === 'outside_business_hours' &&
      earlyHourRes.status === 400 && earlyHourData.error === 'outside_business_hours' &&
      validSlotRes.status === 201;

    record('5.1: Schedule boundaries enforce closed days (400) and business hours limits (400)', passed, {
      sunday: { status: sundayRes.status, error: sundayData.error },
      lateHour: { status: lateHourRes.status, error: lateHourData.error },
      earlyHour: { status: earlyHourRes.status, error: earlyHourData.error },
      validSlot: { status: validSlotRes.status }
    });
  }

  // -------------------------------------------------------------------------
  // TEST 10: WhatsApp Phone Number Normalization (+34 Prefix)
  // -------------------------------------------------------------------------
  {
    resetMemoryStore();
    const formatted9Digits = formatWhatsAppNumber('622456789');
    const formattedWithSpaces = formatWhatsAppNumber('622 45 67 89');
    const formattedWithCountry = formatWhatsAppNumber('34622456789');
    const formattedInternational = formatWhatsAppNumber('+33 612 345 678');
    const nullOnShort = formatWhatsAppNumber('12345');

    // Also verify action approval returns WhatsApp link with 34 prefix
    const mockApt = {
      id: 'apt-wa-test',
      shopSlug: 'kutz-madrid',
      clientName: 'WhatsApp Client',
      clientPhone: '622456789',
      rawPhone: '622456789',
      date: '2026-11-25',
      timeSlot: '12:00',
      status: 'pending'
    };
    await setShopAppointments('kutz-madrid', [mockApt]);

    const approveReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
      body: JSON.stringify({
        action: 'approve',
        payload: { appointmentId: 'apt-wa-test' }
      })
    });
    const approveRes = await syncHandler(approveReq, { params: { shopSlug: 'kutz-madrid' } });
    const approveData = await approveRes.json();

    const expectedWaLink = 'https://wa.me/34622456789';
    const waLinkMatches = approveData.whatsappUrl && approveData.whatsappUrl.includes(expectedWaLink);

    const passed =
      formatted9Digits === '34622456789' &&
      formattedWithSpaces === '34622456789' &&
      formattedWithCountry === '34622456789' &&
      formattedInternational === '33612345678' &&
      nullOnShort === null &&
      waLinkMatches;

    record('6.1: WhatsApp formatting auto-prefixes Spanish 9-digit phones with 34 in wa.me links', passed, {
      formatted9Digits,
      formattedWithSpaces,
      formattedWithCountry,
      formattedInternational,
      whatsappUrl: approveData.whatsappUrl
    });
  }

  console.log('\n=======================================================================');
  const total = results.length;
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = total - passedCount;
  const verdict = failedCount === 0 ? 'APPROVE' : 'FAIL';

  console.log(`SUMMARY: Total: ${total} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log(`CHALLENGER 3 VERDICT: [${verdict}]`);
  console.log('=======================================================================\n');

  return { total, passedCount, failedCount, verdict, results };
}

// Self-executing runner
const isDirect = process.argv[1] && process.argv[1].endsWith('challenger3_empirical_stress.mjs');
if (isDirect) {
  runChallenger3StressSuite().then(summary => {
    if (summary.verdict === 'FAIL') {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }).catch(err => {
    console.error('Fatal stress suite execution failure:', err);
    process.exit(2);
  });
}
