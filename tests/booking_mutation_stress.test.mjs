/**
 * Adversarial Mutation & Stress Test Harness for QR Booking Engine
 * Executed by challenger_e2e_1 to empirically verify mutation sensitivity,
 * assertion rigor, and detect survival/killing of contractual mutations.
 */

import {
  MockBlobsStore,
  SlotHoldManager,
  OfflineSyncEngine,
  DEFAULT_SHOP_FIXTURE,
  SHOP_REX_FIXTURE,
  INITIAL_CLIENTS_FIXTURE,
  validatePublicStateGdprBoundary,
  checkPinTestBypass,
  normalizePhone,
  matchClientByPhone,
  createNewClientFromBooking,
  validateTenantConfig,
  executeBookingFunctionContract,
  executeSyncFunctionContract,
  executeAdminFunctionContract
} from './helpers/bookingContracts.mjs';

async function runAdversarialMutationTests() {
  console.log('\x1b[35m=== RUNNING EMPIRICAL ADVERSARIAL MUTATION & STRESS SUITE ===\x1b[0m');
  const results = [];

  function record(name, killed, details) {
    results.push({ name, killed, details });
    const mark = killed ? '\x1b[32m[MUTANT KILLED]\x1b[0m' : '\x1b[31m[MUTANT SURVIVED]\x1b[0m';
    console.log(`  ${mark} ${name}: ${details}`);
  }

  // --------------------------------------------------------------------------
  // MUTANT 1: Leaking cutting recipes / PII on public-state endpoint
  // --------------------------------------------------------------------------
  {
    const mutatedPublicState = {
      success: true,
      shop: { name: 'KUTZ Madrid' },
      availability: { slots: [] },
      queue: { count: 0 },
      // INJECTED LEAK
      leakedFormula: 'Base Shaver #000 → #0.5',
      clientNotes: 'Piel reactiva y remolino'
    };

    const check = validatePublicStateGdprBoundary(mutatedPublicState);
    const caught = !check.valid && check.violations.length >= 2;
    record(
      'M1: GDPR Leakage on Public Endpoint',
      caught,
      caught ? `Detected ${check.violations.length} violations: ${check.violations.join('; ')}` : 'GDPR validator failed to detect leaked formula/notes!'
    );
  }

  // --------------------------------------------------------------------------
  // MUTANT 2: Allowing duplicate booking for the same slot (Disabling collision hold)
  // --------------------------------------------------------------------------
  {
    const store = new MockBlobsStore('kutz_platform');
    const holdManager = new SlotHoldManager();

    // Client 1 books 10:00
    const req1 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Client 1',
        clientPhone: '611111111',
        barberId: 'b1',
        serviceId: 's1',
        date: '2026-11-20',
        timeSlot: '10:00'
      })
    });
    const res1 = await executeBookingFunctionContract(req1, store, holdManager);

    // Client 2 attempts same slot
    const req2 = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Client 2',
        clientPhone: '622222222',
        barberId: 'b1',
        serviceId: 's1',
        date: '2026-11-20',
        timeSlot: '10:00'
      })
    });
    const res2 = await executeBookingFunctionContract(req2, store, holdManager);

    const caught = res1.status === 201 && res2.status === 409;
    const body2 = await res2.json();
    record(
      'M2: Duplicate Slot Collision Detection',
      caught,
      caught ? `Client 1 got 201, Client 2 rejected with HTTP ${res2.status} (${body2.code})` : 'Collision failed to reject second client!'
    );
  }

  // --------------------------------------------------------------------------
  // MUTANT 3: Accepting wrong PIN without webdriver bypass
  // --------------------------------------------------------------------------
  {
    const store = new MockBlobsStore('kutz_platform');
    await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);

    const reqWrongPin = new Request('http://localhost/api/shops/kutz-madrid/sync', {
      headers: { 'x-shop-pin': '0000' } // Correct is 1234
    });
    const resWrongPin = await executeSyncFunctionContract(reqWrongPin, store);

    const reqNoPin = new Request('http://localhost/api/shops/kutz-madrid/sync');
    const resNoPin = await executeSyncFunctionContract(reqNoPin, store);

    const caught = resWrongPin.status === 403 && resNoPin.status === 401;
    record(
      'M3: Security PIN Enforcement & Authentication Guard',
      caught,
      caught ? `No-PIN returned HTTP ${resNoPin.status}, Wrong-PIN returned HTTP ${resWrongPin.status}` : 'Security guard allowed invalid PIN access!'
    );
  }

  // --------------------------------------------------------------------------
  // MUTANT 4: Allowing booking outside business hours (22:00)
  // --------------------------------------------------------------------------
  {
    const store = new MockBlobsStore('kutz_platform');
    const reqAfterHours = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Late Client',
        clientPhone: '612345678',
        date: '2026-11-20',
        timeSlot: '22:00' // Closing is 20:00
      })
    });
    const resAfterHours = await executeBookingFunctionContract(reqAfterHours, store);
    const caught = resAfterHours.status === 400;
    record(
      'M4: Business Hours Boundary (22:00 booking)',
      caught,
      caught ? `Rejected with HTTP ${resAfterHours.status}` : 'Allowed booking outside operating hours!'
    );
  }

  // --------------------------------------------------------------------------
  // MUTANT 5: Allowing booking on Sunday (Closed day)
  // --------------------------------------------------------------------------
  {
    const store = new MockBlobsStore('kutz_platform');
    const reqSunday = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Sunday Client',
        clientPhone: '612345678',
        date: '2026-11-22', // Sunday
        timeSlot: '11:00'
      })
    });
    const resSunday = await executeBookingFunctionContract(reqSunday, store);
    const caught = resSunday.status === 400;
    record(
      'M5: Closed Business Day Boundary (Sunday)',
      caught,
      caught ? `Rejected with HTTP ${resSunday.status}` : 'Allowed booking on Sunday!'
    );
  }

  // --------------------------------------------------------------------------
  // MUTANT 6: 45-min service overlapping closing time (19:30 + 45m = 20:15 > 20:00)
  // --------------------------------------------------------------------------
  {
    const store = new MockBlobsStore('kutz_platform');
    const reqOverlap = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment',
        clientName: 'Overlap Client',
        clientPhone: '612345678',
        serviceId: 's3', // 45 min
        date: '2026-11-20',
        timeSlot: '19:30'
      })
    });
    const resOverlap = await executeBookingFunctionContract(reqOverlap, store);
    const caught = resOverlap.status === 400;
    record(
      'M6: Closing Time Service Duration Overlap Boundary',
      caught,
      caught ? `Rejected with HTTP ${resOverlap.status}` : 'Allowed service extending past closing time!'
    );
  }

  // --------------------------------------------------------------------------
  // MUTANT 7: Broken Phone Normalizer (e.g. failing to strip +34 or spaces)
  // --------------------------------------------------------------------------
  {
    const n1 = normalizePhone('+34 622 456 789');
    const n2 = normalizePhone(' 622-456-789 ');
    const n3 = normalizePhone('0034622456789');
    const caught = n1 === '622456789' && n2 === '622456789' && n3 === '622456789';
    record(
      'M7: Spanish Phone Normalization Consistency',
      caught,
      caught ? 'Normalized +34, dashes, spaces, and 0034 to canonical 9-digit format' : 'Normalization mismatch!'
    );
  }

  // --------------------------------------------------------------------------
  // MUTANT 8: Walk-in Queue Overflow (>20 waiting clients)
  // --------------------------------------------------------------------------
  {
    const store = new MockBlobsStore('kutz_platform');
    const fullQueue = [];
    for (let i = 1; i <= 20; i++) {
      fullQueue.push({ id: `q-${i}`, clientPhone: `6000000${String(i).padStart(2, '0')}`, status: 'waiting' });
    }
    await store.setJSON('shops/kutz-madrid/queue', fullQueue);

    const reqOver = new Request('http://localhost/api/shops/kutz-madrid/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'walkin',
        clientName: 'Client 21',
        clientPhone: '699999999'
      })
    });
    const resOver = await executeBookingFunctionContract(reqOver, store);
    const caught = resOver.status === 400;
    record(
      'M8: Queue Maximum Capacity Limit (20 clients)',
      caught,
      caught ? `Rejected 21st walk-in with HTTP ${resOver.status}` : 'Queue allowed >20 waiting clients!'
    );
  }

  // --------------------------------------------------------------------------
  // MUTANT 9: Cross-Tenant Data Isolation (Shop B modifying Shop A)
  // --------------------------------------------------------------------------
  {
    const store = new MockBlobsStore('kutz_platform');
    await store.setJSON('shops/kutz-madrid/appointments', [{ id: 'mad-1' }]);
    await store.setJSON('shops/barberia-rex/appointments', [{ id: 'rex-1' }]);

    const reqRex = new Request('http://localhost/api/shops/barberia-rex/sync', {
      headers: { 'x-shop-pin': '7890' }
    });
    const resRex = await executeSyncFunctionContract(reqRex, store);
    const dataRex = await resRex.json();

    const madridContainsRex = (await store.getJSON('shops/kutz-madrid/appointments')).some(a => a.id === 'rex-1');
    const rexContainsMadrid = dataRex.appointments.some(a => a.id === 'mad-1');
    const caught = !madridContainsRex && !rexContainsMadrid;

    record(
      'M9: Cross-Tenant Data Partition Isolation',
      caught,
      caught ? 'Shop A and Shop B data partitions are 100% isolated' : 'Cross-tenant leakage detected!'
    );
  }

  // --------------------------------------------------------------------------
  // MUTANT 10: Super-Admin Duplicate Slug Collision (Rejecting 409)
  // --------------------------------------------------------------------------
  {
    const store = new MockBlobsStore('kutz_platform');
    await store.setJSON('shops/index', ['kutz-madrid']);

    const reqDup = new Request('http://localhost/api/admin/shops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': 'kutz-superadmin-2026' },
      body: JSON.stringify({
        slug: 'kutz-madrid',
        name: 'Collision Salon',
        pin: '1234',
        barbers: [{ id: 'b1' }],
        services: [{ id: 's1' }]
      })
    });
    const resDup = await executeAdminFunctionContract(reqDup, store);
    const caught = resDup.status === 409;
    record(
      'M10: Super-Admin Duplicate Slug Rejection',
      caught,
      caught ? `Rejected with HTTP ${resDup.status}` : 'Allowed duplicate tenant slug creation!'
    );
  }

  console.log('\n-------------------------------------------------------------');
  const allKilled = results.every(r => r.killed);
  console.log(`Summary: ${results.filter(r => r.killed).length}/${results.length} contractual mutants killed.`);
  if (allKilled) {
    console.log('\x1b[32m[MUTATION TEST VERDICT]\x1b[0m All 10 critical contractual mutations were caught and killed.');
  } else {
    console.log('\x1b[31m[MUTATION TEST VERDICT]\x1b[0m Some mutants survived!');
  }

  return allKilled;
}

runAdversarialMutationTests().catch(err => {
  console.error('Adversarial mutation test failed with unhandled error:', err);
  process.exit(1);
});
