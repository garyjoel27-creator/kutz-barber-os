/**
 * Empirical Adversarial Challenge: Concurrency, Flakiness, Determinism & TTL Auto-Release
 * Author: Challenger 2 (challenger_r3_2)
 */

import bookingHandler from '../netlify/functions/booking.js';
import syncHandler from '../netlify/functions/sync.js';
import adminHandler from '../netlify/functions/admin.js';
import {
  resetMemoryStore,
  getShopAppointments,
  getShopQueue,
  setShopConfig,
  DEFAULT_SHOP_CONFIG
} from '../netlify/functions/lib/blobsClient.js';
import {
  MockBlobsStore,
  SlotHoldManager,
  executeBookingFunctionContract,
  executeSyncFunctionContract,
  DEFAULT_SHOP_FIXTURE,
  SHOP_REX_FIXTURE
} from './helpers/bookingContracts.mjs';
import { registerAllBookingEngineSuites } from './e2e_booking_engine.test.mjs';
import { TestRunner } from './helpers/testHarness.mjs';

async function runChallenger2EmpiricalSuite() {
  console.log('=======================================================================');
  console.log('  CHALLENGER 2: EMPIRICAL CONCURRENCY, DETERMINISM & TTL STRESS');
  console.log('=======================================================================\n');

  let passed = 0;
  let failed = 0;
  const metrics = {};

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name} -> ${details}`);
      failed++;
    }
  }

  // =========================================================================
  // SECTION 1: EXTREME CONCURRENCY ON PRODUCTION NETLIFY FUNCTION (booking.js)
  // =========================================================================
  console.log('--- SECTION 1: PRODUCTION HANDLER CONCURRENCY (booking.js) ---');

  // Test 1.1: 30 simultaneous requests for the exact same slot in bookingHandler
  {
    resetMemoryStore();
    const count = 30;
    const requests = Array.from({ length: count }, (_, i) => {
      return new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: `High-Concurrency Client ${i}`,
          clientPhone: `6550000${String(i).padStart(2, '0')}`,
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-25',
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
    const appointments = await getShopAppointments('kutz-madrid');

    metrics.extremeConcurrency30 = { count201, count409, appointmentsStored: appointments.length };
    assert(
      'CH2.1: 30 simultaneous requests to bookingHandler -> exactly 1x 201 Created and 29x 409 Conflict',
      count201 === 1 && count409 === 29 && appointments.length === 1,
      `201s: ${count201}, 409s: ${count409}, stored: ${appointments.length}`
    );
  }

  // Test 1.2: 25 concurrent requests across 2 independent tenants (50 total)
  {
    resetMemoryStore();
    // Provision second shop
    await setShopConfig('barberia-rex', {
      ...DEFAULT_SHOP_CONFIG,
      slug: 'barberia-rex',
      name: 'KUTZ // Barbería Rex',
      pin: '7890'
    });

    const requestsMadrid = Array.from({ length: 25 }, (_, i) => {
      return new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: `Madrid Client ${i}`,
          clientPhone: `6110000${String(i).padStart(2, '0')}`,
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-25',
          timeSlot: '12:00'
        })
      });
    });

    const requestsRex = Array.from({ length: 25 }, (_, i) => {
      return new Request('http://localhost/api/shops/barberia-rex/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: `Rex Client ${i}`,
          clientPhone: `6220000${String(i).padStart(2, '0')}`,
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-25',
          timeSlot: '12:00'
        })
      });
    });

    // Fire all 50 concurrently
    const [responsesMadrid, responsesRex] = await Promise.all([
      Promise.all(requestsMadrid.map(req => bookingHandler(req, { params: { shopSlug: 'kutz-madrid' } }))),
      Promise.all(requestsRex.map(req => bookingHandler(req, { params: { shopSlug: 'barberia-rex' } })))
    ]);

    const madrid201 = responsesMadrid.filter(r => r.status === 201).length;
    const madrid409 = responsesMadrid.filter(r => r.status === 409).length;
    const rex201 = responsesRex.filter(r => r.status === 201).length;
    const rex409 = responsesRex.filter(r => r.status === 409).length;

    const madridApts = await getShopAppointments('kutz-madrid');
    const rexApts = await getShopAppointments('barberia-rex');

    metrics.crossTenantConcurrency = { madrid201, madrid409, rex201, rex409 };
    assert(
      'CH2.2: 50 simultaneous cross-tenant requests -> Shop A and Shop B each have 1x 201 and 24x 409',
      madrid201 === 1 && madrid409 === 24 && rex201 === 1 && rex409 === 24 &&
      madridApts.length === 1 && rexApts.length === 1,
      `Madrid: ${madrid201} 201s, ${madrid409} 409s | Rex: ${rex201} 201s, ${rex409} 409s`
    );
  }

  // Test 1.3: 20 simultaneous walk-in joins to live queue
  {
    resetMemoryStore();
    const count = 20;
    const walkinRequests = Array.from({ length: count }, (_, i) => {
      return new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'walkin',
          clientName: `Queue Client ${i}`,
          clientPhone: `6330000${String(i).padStart(2, '0')}`
        })
      });
    });

    const responses = await Promise.all(
      walkinRequests.map(req => bookingHandler(req, { params: { shopSlug: 'kutz-madrid' } }))
    );

    const all201 = responses.every(r => r.status === 201);
    const bodyData = await Promise.all(responses.map(r => r.json()));
    const positions = bodyData.map(b => b.position);
    const strictlyMonotonic = positions.every((p, idx) => p === idx + 1);
    const queue = await getShopQueue('kutz-madrid');

    assert(
      'CH2.3: 20 simultaneous walk-ins -> 20x 201 Created with strictly monotonic positions 1..20',
      all201 && strictlyMonotonic && queue.length === 20,
      `All 201: ${all201}, Monotonic: ${strictlyMonotonic}, Queue length: ${queue.length}`
    );
  }

  // =========================================================================
  // SECTION 2: DETERMINISTIC SLOT HOLD AUTO-RELEASE TTL (ZERO TIMERS)
  // =========================================================================
  console.log('\n--- SECTION 2: SLOT HOLD AUTO-RELEASE TTL ---');

  // Test 2.1: Immediate collision during active hold TTL
  {
    resetMemoryStore();
    // Client 1 books 10:00 slot
    const req1 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Original Client',
        clientPhone: '611111111',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-25',
        timeSlot: '10:00'
      })
    });
    const res1 = await bookingHandler(req1, { params: { shopSlug: 'kutz-madrid' } });
    const data1 = await res1.json();

    // Client 2 attempts to book same slot immediately -> 409
    const req2 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Colliding Client',
        clientPhone: '622222222',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-25',
        timeSlot: '10:00'
      })
    });
    const res2 = await bookingHandler(req2, { params: { shopSlug: 'kutz-madrid' } });

    assert(
      'CH2.4: Active hold lock blocks second client (res1: 201, res2: 409)',
      res1.status === 201 && res2.status === 409,
      `res1: ${res1.status}, res2: ${res2.status}`
    );
  }

  // Test 2.2: Hold auto-release by timestamp comparison (no sleep/setTimeout)
  {
    // Expire the hold in storage by setting holdExpiresAt to in the past
    const appointments = await getShopAppointments('kutz-madrid');
    appointments[0].holdExpiresAt = Date.now() - 1000;
    const { setShopAppointments } = await import('../netlify/functions/lib/blobsClient.js');
    await setShopAppointments('kutz-madrid', appointments);

    // 1) Verify public-state reports slot as available
    const reqPublic = new Request('http://localhost/api/shops/kutz-madrid/public-state?date=2026-11-25');
    const resPublic = await bookingHandler(reqPublic, { params: { shopSlug: 'kutz-madrid' } });
    const publicData = await resPublic.json();
    const slot1000 = publicData.availability.find(s => s.time === '10:00');
    const isAvailableForRex = slot1000?.barbers.find(b => b.barberId === 'rex')?.available;

    // 2) Verify Client 2 can now book the exact same slot
    const req2 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'New Client After Expiry',
        clientPhone: '622222222',
        barberId: 'rex',
        serviceId: 'skin-fade',
        date: '2026-11-25',
        timeSlot: '10:00'
      })
    });
    const res2 = await bookingHandler(req2, { params: { shopSlug: 'kutz-madrid' } });

    // 3) Verify syncHandler GET auto-expires old holds
    const reqSync = new Request('http://localhost/api/shops/kutz-madrid/sync', {
      headers: { 'x-shop-pin': '1234' }
    });
    const resSync = await syncHandler(reqSync, { params: { shopSlug: 'kutz-madrid' } });
    const syncData = await resSync.json();
    const oldApt = syncData.appointments.find(a => a.clientPhone === '611111111');

    assert(
      'CH2.5: Expired hold auto-released deterministically (public availability=true, new booking=201, sync marks old=expired)',
      isAvailableForRex === true && res2.status === 201 && oldApt?.status === 'expired',
      `public available: ${isAvailableForRex}, res2 status: ${res2.status}, old status: ${oldApt?.status}`
    );
  }

  // =========================================================================
  // SECTION 3: 10 CONSECUTIVE TEST RUNS (ZERO FLAKINESS & STATE LEAKAGE)
  // =========================================================================
  console.log('\n--- SECTION 3: 10 CONSECUTIVE RUNS FOR DETERMINISM ---');
  const runDurations = [];
  let all1410Passed = true;

  for (let r = 1; r <= 10; r++) {
    const runner = new TestRunner();
    registerAllBookingEngineSuites(runner);

    // Suppress console output for clean stress measurement
    const origLog = console.log;
    console.log = () => {};
    const tStart = Date.now();
    const res = await runner.execute();
    const dur = Date.now() - tStart;
    console.log = origLog;

    runDurations.push(dur);
    if (!res.success || res.totalFailed > 0 || res.totalPassed !== 141) {
      all1410Passed = false;
      console.error(`  Run ${r} failed: passed ${res.totalPassed}/141, failed ${res.totalFailed}`);
      break;
    }
  }

  const avgDuration = Math.round(runDurations.reduce((a, b) => a + b, 0) / runDurations.length);
  const minDur = Math.min(...runDurations);
  const maxDur = Math.max(...runDurations);

  metrics.runs10 = {
    allPassed: all1410Passed,
    totalTestsExecuted: runDurations.length * 141,
    durations: runDurations,
    avgDuration,
    minDur,
    maxDur
  };

  assert(
    `CH2.6: 10 consecutive runs: 141/141 passed in each run (1410/1410 total), avg ${avgDuration}ms [${minDur}ms..${maxDur}ms], 0 flaky failures`,
    all1410Passed && runDurations.length === 10,
    `allPassed: ${all1410Passed}, runs: ${runDurations.length}`
  );

  console.log('\n=======================================================================');
  console.log(`CHALLENGER 2 SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log('Metrics:', JSON.stringify(metrics, null, 2));
  console.log('=======================================================================');

  return { passed, failed, metrics };
}

runChallenger2EmpiricalSuite().then(res => {
  process.exit(res.failed > 0 ? 1 : 0);
});
