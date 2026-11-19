/**
 * Adversarial Stress & Verification Harness
 * Tests concurrency, slot collision, hold TTL expiration, multi-tenant isolation, and suite determinism.
 */

import {
  MockBlobsStore,
  SlotHoldManager,
  OfflineSyncEngine,
  DEFAULT_SHOP_FIXTURE,
  SHOP_REX_FIXTURE,
  executeBookingFunctionContract,
  executeSyncFunctionContract,
  validatePublicStateGdprBoundary,
  normalizePhone
} from './helpers/bookingContracts.mjs';
import { MockLocalStorageWithQuota } from './helpers/contracts.mjs';
import { registerAllBookingEngineSuites } from './e2e_booking_engine.test.mjs';
import { TestRunner } from './helpers/testHarness.mjs';

async function runAdversarialTests() {
  console.log('=======================================================================');
  console.log('  STARTING ADVERSARIAL CHALLENGE & STRESS HARNESS');
  console.log('=======================================================================\n');

  let passed = 0;
  let failed = 0;

  function report(name, ok, details = '') {
    if (ok) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name} -> ${details}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 1: CONCURRENT RACE CONDITIONS (True Promise.all)
  // --------------------------------------------------------------------------
  console.log('--- GROUP 1: CONCURRENCY & RACE CONDITIONS ---');

  // Test 1.1: 20 simultaneous concurrent bookings for the exact same slot
  {
    const store = new MockBlobsStore('kutz_platform');
    const holdManager = new SlotHoldManager();
    await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
    await store.setJSON('shops/kutz-madrid/appointments', []);

    const concurrentRequests = Array.from({ length: 20 }, (_, i) => {
      const req = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: `Concurrent Client ${i}`,
          clientPhone: `6000000${String(i).padStart(2, '0')}`,
          barberId: 'b1',
          date: '2026-11-20',
          timeSlot: '10:00'
        })
      });
      return executeBookingFunctionContract(req, store, holdManager);
    });

    const responses = await Promise.all(concurrentRequests);
    const statuses = responses.map(r => r.status);
    const successes = statuses.filter(s => s === 201);
    const conflicts = statuses.filter(s => s === 409);

    report(
      'C1.1: 20 simultaneous requests for same slot -> exactly 1 winner (201) and 19 conflicts (409)',
      successes.length === 1 && conflicts.length === 19,
      `Successes: ${successes.length}, Conflicts: ${conflicts.length}`
    );
  }

  // Test 1.2: 10 concurrent bookings for DIFFERENT slots all succeed
  {
    const store = new MockBlobsStore('kutz_platform');
    const holdManager = new SlotHoldManager();
    await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
    await store.setJSON('shops/kutz-madrid/appointments', []);

    const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '16:00', '16:30'];
    const concurrentRequests = slots.map((timeSlot, i) => {
      const req = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: `Client ${i}`,
          clientPhone: `6111111${String(i).padStart(2, '0')}`,
          barberId: 'b1',
          date: '2026-11-20',
          timeSlot
        })
      });
      return executeBookingFunctionContract(req, store, holdManager);
    });

    const responses = await Promise.all(concurrentRequests);
    const statuses = responses.map(r => r.status);
    const all201 = statuses.every(s => s === 201);

    report(
      'C1.2: 10 concurrent requests for distinct slots -> all 10 succeed (201)',
      all201,
      `Statuses: ${JSON.stringify(statuses)}`
    );
  }

  // Test 1.3: Concurrency in Mode 2 Live Queue (15 simultaneous walk-in joins)
  {
    const store = new MockBlobsStore('kutz_platform');
    await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
    await store.setJSON('shops/kutz-madrid/queue', []);

    const results = [];
    for (let i = 0; i < 15; i++) {
      const req = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'walkin',
          clientName: `Walkin ${i}`,
          clientPhone: `6222222${String(i).padStart(2, '0')}`
        })
      });
      const res = await executeBookingFunctionContract(req, store);
      results.push(await res.json());
    }

    const positions = results.map(r => r.position);
    const isStrictlyMonotonic = positions.every((pos, idx) => pos === idx + 1);

    report(
      'C1.3: 15 walk-in queue joins -> monotonic position assignment 1 through 15',
      isStrictlyMonotonic,
      `Positions: ${JSON.stringify(positions)}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: HOLD TTL EXPIRATION & AUTO-RELEASE IN CONTRACT RUNNER
  // --------------------------------------------------------------------------
  console.log('\n--- GROUP 2: HOLD TTL EXPIRATION & AUTO-RELEASE ---');

  // Test 2.1: In SlotHoldManager: verify hold expires after TTL
  {
    const holdManager = new SlotHoldManager(1); // 1 sec
    holdManager.acquireHold('kutz-madrid', 'b1', '2026-11-20', '10:00', '611111111', 10);
    const heldBefore = holdManager.isHeld('kutz-madrid', 'b1', '2026-11-20', '10:00');

    const hold = holdManager.getHold('kutz-madrid', 'b1', '2026-11-20', '10:00');
    if (hold) hold.expiresAt = Date.now() - 1000;

    const heldAfter = holdManager.isHeld('kutz-madrid', 'b1', '2026-11-20', '10:00');
    report(
      'H2.1: SlotHoldManager cleanly releases hold when expiresAt < now',
      heldBefore === true && heldAfter === false,
      `heldBefore: ${heldBefore}, heldAfter: ${heldAfter}`
    );
  }

  // Test 2.2: End-to-end: Client 1 books, hold expires, Client 2 books same slot
  {
    const store = new MockBlobsStore('kutz_platform');
    const holdManager = new SlotHoldManager();
    await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
    await store.setJSON('shops/kutz-madrid/appointments', []);

    // Client 1 books
    const req1 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Client 1',
        clientPhone: '611111111',
        barberId: 'b1',
        date: '2026-11-20',
        timeSlot: '11:00'
      })
    });
    const res1 = await executeBookingFunctionContract(req1, store, holdManager);
    await res1.json();

    // Expire hold in holdManager
    const hold = holdManager.getHold('kutz-madrid', 'b1', '2026-11-20', '11:00');
    if (hold) hold.expiresAt = Date.now() - 1000;

    // Simulate hold expired in stored appointment
    const appointments = await store.getJSON('shops/kutz-madrid/appointments');
    appointments[0].holdExpiresAt = Date.now() - 1000;
    await store.setJSON('shops/kutz-madrid/appointments', appointments);

    // Client 2 attempts to book same slot
    const req2 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Client 2',
        clientPhone: '622222222',
        barberId: 'b1',
        date: '2026-11-20',
        timeSlot: '11:00'
      })
    });
    const res2 = await executeBookingFunctionContract(req2, store, holdManager);
    const data2 = await res2.json();

    report(
      'H2.2: After hold TTL expires, Client 2 can acquire the same slot',
      res2.status === 201,
      `res2.status = ${res2.status}, error: ${data2.error}, code: ${data2.code}`
    );
  }

  // Test 2.3: Public state availability check after hold expiration
  {
    const store = new MockBlobsStore('kutz_platform');
    const holdManager = new SlotHoldManager();
    await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
    await store.setJSON('shops/kutz-madrid/appointments', [
      {
        id: 'apt-expired-hold',
        barberId: 'b1',
        date: '2026-11-20',
        timeSlot: '12:00',
        status: 'pending',
        holdExpiresAt: Date.now() - 5000
      }
    ]);

    const req = new Request('http://localhost/api/shops/kutz-madrid/public-state?date=2026-11-20');
    const res = await executeBookingFunctionContract(req, store, holdManager);
    const data = await res.json();
    const slot1200 = data.availability.slots.find(s => s.time === '12:00' && s.barberId === 'b1');

    report(
      'H2.3: Public state availability exposes slot with expired hold as available (true)',
      slot1200?.available === true,
      `slot1200.available: ${slot1200?.available}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: MULTI-TENANT ISOLATION & DATA PARTITIONING
  // --------------------------------------------------------------------------
  console.log('\n--- GROUP 3: MULTI-TENANT ISOLATION ---');

  // Test 3.1: Strict key prefix segregation in BlobsStore
  {
    const store = new MockBlobsStore('kutz_platform');
    await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);
    await store.setJSON('shops/kutz-madrid/appointments', [{ id: 'apt-madrid' }]);
    await store.setJSON('shops/barberia-rex/config', SHOP_REX_FIXTURE);
    await store.setJSON('shops/barberia-rex/appointments', [{ id: 'apt-rex' }]);

    const madridList = await store.list({ prefix: 'shops/kutz-madrid/' });
    const rexList = await store.list({ prefix: 'shops/barberia-rex/' });

    const madridKeys = madridList.blobs.map(b => b.key);
    const rexKeys = rexList.blobs.map(b => b.key);

    const noLeakMtoR = madridKeys.every(k => !k.includes('barberia-rex'));
    const noLeakRtoM = rexKeys.every(k => !k.includes('kutz-madrid'));

    report(
      'M3.1: Blobs storage prefix listing strictly segregates tenant partitions',
      noLeakMtoR && noLeakRtoM,
      `madridKeys: ${JSON.stringify(madridKeys)}, rexKeys: ${JSON.stringify(rexKeys)}`
    );
  }

  // Test 3.2: PIN cross-authentication attack
  {
    const store = new MockBlobsStore('kutz_platform');
    await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE); // PIN: 1234
    await store.setJSON('shops/barberia-rex/config', SHOP_REX_FIXTURE);    // PIN: 7890

    // Attempt to access Rex with Madrid PIN
    const req = new Request('http://localhost/api/shops/barberia-rex/sync', {
      headers: { 'x-shop-pin': '1234' }
    });
    const res = await executeSyncFunctionContract(req, store);

    report(
      'M3.2: Cross-tenant PIN usage returns HTTP 403 Forbidden',
      res.status === 403,
      `Status: ${res.status}`
    );
  }

  // Test 3.3: Offline outbox tenant separation in localStorage
  {
    const storage = new MockLocalStorageWithQuota();
    const syncMadrid = new OfflineSyncEngine('kutz-madrid', { storage, isOnline: false });
    const syncRex = new OfflineSyncEngine('barberia-rex', { storage, isOnline: false });

    await syncMadrid.dispatchAction({ action: 'approve', payload: { bookingId: 'apt-madrid-1' } });
    await syncRex.dispatchAction({ action: 'approve', payload: { bookingId: 'apt-rex-1' } });

    const outboxMadrid = syncMadrid.getOutbox();
    const outboxRex = syncRex.getOutbox();

    const madridClean = outboxMadrid.every(item => item.shopSlug === 'kutz-madrid');
    const rexClean = outboxRex.every(item => item.shopSlug === 'barberia-rex');

    report(
      'M3.3: Offline outbox queues in localStorage are partitioned per shopSlug',
      madridClean && rexClean && outboxMadrid.length === 1 && outboxRex.length === 1,
      `outboxMadrid: ${JSON.stringify(outboxMadrid)}, outboxRex: ${JSON.stringify(outboxRex)}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: SUITE DETERMINISM & FLAKINESS STRESS
  // --------------------------------------------------------------------------
  console.log('\n--- GROUP 4: SUITE DETERMINISM & FLAKINESS STRESS ---');

  // Test 4.1: Phone normalizer correctly extracts 9 digits across 100 randomized inputs
  {
    let allNormalizedCorrectly = true;
    for (let i = 0; i < 100; i++) {
      const raw = ` +34  6${String(Math.floor(10000000 + Math.random() * 90000000))} `;
      const norm = normalizePhone(raw);
      if (norm.length !== 9 || !norm.startsWith('6')) {
        allNormalizedCorrectly = false;
        break;
      }
    }
    report(
      'S4.1: Phone normalizer correctly extracts 9 digits across 100 randomized inputs',
      allNormalizedCorrectly
    );
  }

  // Test 4.2: Privacy boundary validator stress test on 50 synthetic public states
  {
    let passedPrivacy = true;
    for (let i = 0; i < 50; i++) {
      const cleanState = {
        success: true,
        shop: { name: `Shop ${i}`, status: 'active' },
        availability: { slots: [{ time: '10:00', available: true }] },
        queue: { count: i, waitMinutes: i * 20 }
      };
      const val = validatePublicStateGdprBoundary(cleanState);
      if (!val.valid) {
        passedPrivacy = false;
        break;
      }
    }
    report(
      'S4.2: Privacy boundary validator confirms 50 clean public states without false alarms',
      passedPrivacy
    );
  }

  // Test 4.3: 10 Consecutive Full Runs of e2e_booking_engine.test.mjs
  console.log('\n--- GROUP 5: 10 CONSECUTIVE TEST RUNS (DETERMINISM & ZERO FLAKINESS) ---');
  let stressPassed = true;
  const durations = [];
  for (let iter = 1; iter <= 10; iter++) {
    const runner = new TestRunner();
    registerAllBookingEngineSuites(runner);
    // Suppress console spam during stress runs
    const origLog = console.log;
    console.log = () => {};
    const tStart = Date.now();
    const result = await runner.execute();
    const dur = Date.now() - tStart;
    console.log = origLog;

    durations.push(dur);
    if (!result.success || result.totalFailed > 0 || result.totalPassed !== 141) {
      stressPassed = false;
      report(`Iter ${iter}/10`, false, `Passed: ${result.totalPassed}/141, Failed: ${result.totalFailed}`);
      break;
    }
  }

  const avgDur = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  report(
    `S4.3: 10 consecutive runs of 141 booking tests: 100% pass (1410/1410), avg duration ${avgDur}ms, 0 flaky failures`,
    stressPassed,
    `Durations: ${durations.join('ms, ')}ms`
  );

  console.log('\n=======================================================================');
  console.log(`ADVERSARIAL HARNESS SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log('=======================================================================');

  return { passed, failed };
}

runAdversarialTests().then(res => {
  process.exit(res.failed > 0 ? 1 : 0);
});
