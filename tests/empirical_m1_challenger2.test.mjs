/**
 * tests/empirical_m1_challenger2.test.mjs
 * Empirical Challenge Harness for Milestone 1: Backend & Blobs Sync Engine
 * 
 * Verifies:
 * 1. Outbox Stress & Strictly Chronological FIFO Replay (approve, reject, seat, finish)
 * 2. Poison-Pill Resilience (4xx dropped after 5 retries without blocking queue)
 * 3. Multi-Tenant Isolation (kutz-madrid vs barberia-rex keys and state)
 * 4. Network Dropout Simulation (0 unhandled promise rejections, local UI responsiveness)
 */

import { expect, TestRunner } from './helpers/testHarness.mjs';
import {
  SYNC_STATUS,
  getShopStorageKeys,
  loadLocalShopState,
  saveLocalShopState,
  getOutbox,
  addToOutbox,
  removeFromOutbox,
  clearOutbox,
  flushOutbox,
  fetchRemoteShopState,
  syncShopData,
  dispatchBarberAction,
  SyncEngine
} from '../src/lib/syncService.js';

import bookingHandler from '../netlify/functions/booking.js';
import syncHandler from '../netlify/functions/sync.js';
import adminHandler from '../netlify/functions/admin.js';
import { resetMemoryStore } from '../netlify/functions/lib/blobsClient.js';

// In-Memory Storage Adapter isolated per test
function createIsolatedStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => { map.clear(); },
    dumpKeys: () => Array.from(map.keys()),
    rawMap: map
  };
}

export function registerEmpiricalSuites(runner) {

  // =========================================================================
  // SUITE 1: Outbox Stress & Chronological FIFO Replay
  // =========================================================================
  runner.describe('Challenger 2 Suite 1: Outbox Stress & Strictly Chronological FIFO Replay', () => {

    runner.it('1.1: Queues 60 interleaved offline actions (approve, reject, seat, finish) with complete metadata', () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';
      const actionTypes = ['approve', 'reject', 'seat', 'finish'];
      const totalActions = 60;

      for (let i = 0; i < totalActions; i++) {
        const action = actionTypes[i % actionTypes.length];
        const payload = {
          sequenceId: i,
          appointmentId: `apt-stress-${i}`,
          chairId: `chair-${(i % 3) + 1}`,
          clientId: `cli-${i}`,
          formulaNotes: `#000 skin fade step ${i}`
        };
        const item = addToOutbox(shopSlug, action, payload, storage);

        expect(item.shopSlug).toBe(shopSlug);
        expect(item.action).toBe(action);
        expect(item.payload.sequenceId).toBe(i);
        expect(typeof item.createdAt).toBe('number');
        expect(item.retryCount).toBe(0);
      }

      const outbox = getOutbox(shopSlug, storage);
      expect(outbox.length).toBe(totalActions);

      // Verify strict insertion order and persistence in storage
      for (let i = 0; i < totalActions; i++) {
        expect(outbox[i].payload.sequenceId).toBe(i);
        expect(outbox[i].action).toBe(actionTypes[i % actionTypes.length]);
      }

      const keys = getShopStorageKeys(shopSlug);
      const rawStored = JSON.parse(storage.getItem(keys.OUTBOX));
      expect(rawStored.length).toBe(totalActions);
    });

    runner.it('1.2: Replays 60 queued actions in strictly chronological FIFO order to the server', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';
      const totalActions = 60;
      const actionTypes = ['approve', 'reject', 'seat', 'finish'];

      // Seed 60 actions
      for (let i = 0; i < totalActions; i++) {
        addToOutbox(shopSlug, actionTypes[i % actionTypes.length], {
          sequenceId: i,
          timestamp: Date.now() + i
        }, storage);
      }

      // Track incoming requests in mock server
      const serverLog = [];
      const mockFetch = async (url, options) => {
        const body = JSON.parse(options.body);
        serverLog.push({
          url,
          action: body.action,
          sequenceId: body.payload.sequenceId,
          receivedAt: Date.now()
        });
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, processedAction: body.action })
        };
      };

      const flushResult = await flushOutbox(shopSlug, '1234', mockFetch, storage);

      expect(flushResult.processed).toBe(totalActions);
      expect(flushResult.remaining).toBe(0);
      expect(flushResult.errors.length).toBe(0);
      expect(serverLog.length).toBe(totalActions);

      // Verify STRICT FIFO ORDER: each request must have sequenceId === index
      for (let i = 0; i < totalActions; i++) {
        expect(serverLog[i].sequenceId).toBe(i);
        expect(serverLog[i].action).toBe(actionTypes[i % actionTypes.length]);
      }

      // Verify outbox is completely cleared
      const remainingOutbox = getOutbox(shopSlug, storage);
      expect(remainingOutbox.length).toBe(0);
    });

    runner.it('1.3: Handles mid-flight network failure preserving un-replayed actions in FIFO order', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';
      const totalActions = 25;
      const failAtIndex = 10; // First 10 succeed (0..9), 10th fails

      for (let i = 0; i < totalActions; i++) {
        addToOutbox(shopSlug, 'approve', { sequenceId: i }, storage);
      }

      const serverLog = [];
      const unstableFetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.payload.sequenceId === failAtIndex) {
          throw new Error('Connection reset by peer');
        }
        serverLog.push(body.payload.sequenceId);
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      const result = await flushOutbox(shopSlug, '1234', unstableFetch, storage);

      expect(result.processed).toBe(failAtIndex); // 0 to 9 succeeded = 10
      expect(result.remaining).toBe(totalActions - failAtIndex); // 15 remain (10 to 24)
      expect(result.errors.length > 0).toBe(true);

      const outboxAfterFail = getOutbox(shopSlug, storage);
      expect(outboxAfterFail.length).toBe(15);
      expect(outboxAfterFail[0].payload.sequenceId).toBe(failAtIndex);
      expect(outboxAfterFail[0].retryCount).toBe(1);

      // Verify remaining elements preserved in strict FIFO order
      for (let j = 0; j < outboxAfterFail.length; j++) {
        expect(outboxAfterFail[j].payload.sequenceId).toBe(failAtIndex + j);
      }

      // Now restore network connection and flush again
      const resumedLog = [];
      const recoveredFetch = async (url, options) => {
        const body = JSON.parse(options.body);
        resumedLog.push(body.payload.sequenceId);
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      const resumedResult = await flushOutbox(shopSlug, '1234', recoveredFetch, storage);
      expect(resumedResult.processed).toBe(15);
      expect(resumedResult.remaining).toBe(0);
      expect(getOutbox(shopSlug, storage).length).toBe(0);

      // Verify concatenated stream matches 0 to 24
      const fullLog = [...serverLog, ...resumedLog];
      expect(fullLog.length).toBe(totalActions);
      for (let i = 0; i < totalActions; i++) {
        expect(fullLog[i]).toBe(i);
      }
    });

  });

  // =========================================================================
  // SUITE 2: Poison-Pill Resilience
  // =========================================================================
  runner.describe('Challenger 2 Suite 2: Poison-Pill Resilience (4xx Drops After 5 Retries)', () => {

    runner.it('2.1: Permanently failing 400 client error does not block subsequent valid actions', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';

      // Item 1: valid
      addToOutbox(shopSlug, 'approve', { id: 'valid-1', name: 'Valid 1' }, storage);
      // Item 2: poison pill (invalid action syntax -> 400 Bad Request)
      addToOutbox(shopSlug, 'invalid_action', { id: 'poison-1' }, storage);
      // Item 3: valid
      addToOutbox(shopSlug, 'seat', { id: 'valid-2', name: 'Valid 2' }, storage);

      const mockFetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'invalid_action') {
          return {
            ok: false,
            status: 400,
            json: async () => ({ success: false, error: 'unknown_action' })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true })
        };
      };

      // Flush 1: Valid 1 succeeds, Poison fails with 400 (retry=1), Valid 2 succeeds!
      const res1 = await flushOutbox(shopSlug, '1234', mockFetch, storage);
      expect(res1.processed).toBe(2); // Valid 1 + Valid 2 processed!
      expect(res1.remaining).toBe(1); // Poison pill retained for retry

      const outbox1 = getOutbox(shopSlug, storage);
      expect(outbox1.length).toBe(1);
      expect(outbox1[0].action).toBe('invalid_action');
      expect(outbox1[0].retryCount).toBe(1);
    });

    runner.it('2.2: Poison pill is dropped after exactly 5 retry attempts', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';

      addToOutbox(shopSlug, 'malformed', { id: 'poison-pill' }, storage);

      const poisonFetch = async () => ({
        ok: false,
        status: 422,
        json: async () => ({ success: false, error: 'unprocessable_entity' })
      });

      // Retries 1 to 4: remains in queue
      for (let attempt = 1; attempt <= 4; attempt++) {
        const res = await flushOutbox(shopSlug, '1234', poisonFetch, storage);
        expect(res.processed).toBe(0);
        expect(res.remaining).toBe(1);
        const outbox = getOutbox(shopSlug, storage);
        expect(outbox[0].retryCount).toBe(attempt);
      }

      // Attempt 5: retryCount reaches 5, condition `retryCount < 5` fails -> DROPPED!
      const finalRes = await flushOutbox(shopSlug, '1234', poisonFetch, storage);
      expect(finalRes.processed).toBe(0);
      expect(finalRes.remaining).toBe(0); // DROPPED

      const emptyOutbox = getOutbox(shopSlug, storage);
      expect(emptyOutbox.length).toBe(0);
    });

    runner.it('2.3: Multiple heterogeneous poison pills (400, 404, 422) drop safely without hanging queue', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';

      addToOutbox(shopSlug, 'act-400', { errorType: 400 }, storage);
      addToOutbox(shopSlug, 'act-404', { errorType: 404 }, storage);
      addToOutbox(shopSlug, 'act-422', { errorType: 422 }, storage);

      const multiPoisonFetch = async (url, options) => {
        const body = JSON.parse(options.body);
        return {
          ok: false,
          status: body.payload.errorType,
          json: async () => ({ success: false })
        };
      };

      // 5 flushes
      for (let i = 0; i < 5; i++) {
        await flushOutbox(shopSlug, '1234', multiPoisonFetch, storage);
      }

      const finalOutbox = getOutbox(shopSlug, storage);
      expect(finalOutbox.length).toBe(0);
    });

    runner.it('2.4: 500 Server error halts queue to preserve state whereas 400 error does not halt', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';

      addToOutbox(shopSlug, 'act-500', { code: 500 }, storage);
      addToOutbox(shopSlug, 'act-valid', { code: 200 }, storage);

      const serverErrorFetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.payload.code === 500) {
          return { ok: false, status: 500, json: async () => ({ error: 'database_offline' }) };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      const res = await flushOutbox(shopSlug, '1234', serverErrorFetch, storage);
      // Server error must halt: 0 processed, both items preserved
      expect(res.processed).toBe(0);
      expect(res.remaining).toBe(2);

      const outbox = getOutbox(shopSlug, storage);
      expect(outbox.length).toBe(2);
      expect(outbox[0].action).toBe('act-500');
      expect(outbox[1].action).toBe('act-valid');
    });

  });

  // =========================================================================
  // SUITE 3: Multi-Tenant Isolation
  // =========================================================================
  runner.describe('Challenger 2 Suite 3: Multi-Tenant Isolation (kutz-madrid vs barberia-rex)', () => {

    runner.it('3.1: Strict separation of localStorage keys prevents cross-tenant contamination', () => {
      const storage = createIsolatedStorage();

      const madridSlug = 'kutz-madrid';
      const rexSlug = 'barberia-rex';

      const madridKeys = getShopStorageKeys(madridSlug);
      const rexKeys = getShopStorageKeys(rexSlug);

      // Verify no key equality
      Object.keys(madridKeys).forEach(k => {
        expect(madridKeys[k] !== rexKeys[k]).toBe(true);
        expect(madridKeys[k].includes(madridSlug)).toBe(true);
        expect(rexKeys[k].includes(rexSlug)).toBe(true);
      });

      // Save initial state in barberia-rex
      const initialRexAppointments = [{ id: 'rex-apt-1', clientName: 'Rex VIP Client', barberId: 'rex-senior' }];
      const initialRexQueue = [{ id: 'rex-q-1', clientName: 'Rex Walkin' }];
      saveLocalShopState(rexSlug, {
        appointments: initialRexAppointments,
        queue: initialRexQueue
      }, storage);

      // Now perform intensive mutations on kutz-madrid
      saveLocalShopState(madridSlug, {
        appointments: [
          { id: 'mad-apt-1', clientName: 'Madrid Client 1' },
          { id: 'mad-apt-2', clientName: 'Madrid Client 2' }
        ],
        queue: [{ id: 'mad-q-1', clientName: 'Madrid Walkin' }]
      }, storage);

      addToOutbox(madridSlug, 'approve', { appointmentId: 'mad-apt-1' }, storage);
      addToOutbox(madridSlug, 'seat', { chairId: 'sillón-madrid-1' }, storage);

      // Inspect barberia-rex keys: verify zero mutations or leaks
      const rexState = loadLocalShopState(rexSlug, storage);
      expect(rexState.appointments.length).toBe(1);
      expect(rexState.appointments[0].clientName).toBe('Rex VIP Client');
      expect(rexState.queue.length).toBe(1);
      expect(rexState.queue[0].clientName).toBe('Rex Walkin');

      const rexOutbox = getOutbox(rexSlug, storage);
      expect(rexOutbox.length).toBe(0); // Rex outbox is empty!

      // Clear madrid outbox and verify rex remains untouched
      clearOutbox(madridSlug, storage);
      expect(getOutbox(madridSlug, storage).length).toBe(0);
      expect(getOutbox(rexSlug, storage).length).toBe(0);
    });

    runner.it('3.2: Netlify Functions Blobs storage maintains tenant isolation across booking and sync', async () => {
      resetMemoryStore();

      // Provision barberia-rex via Super-Admin so both shops exist in Blobs store
      const adminReq = new Request('http://localhost/api/admin/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'kutz-super-admin-2026'
        },
        body: JSON.stringify({
          slug: 'barberia-rex',
          name: 'BARBERÍA REX VALLECAS',
          pin: '9999',
          phone: '+34 919 887 766',
          address: 'Avenida de la Albufera 88, Madrid',
          status: 'active'
        })
      });
      const adminRes = await adminHandler(adminReq, {});
      expect(adminRes.status).toBe(201);

      // 1. Create appointment in kutz-madrid
      const reqMadrid = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Madrid User',
          clientPhone: '611223344',
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-20',
          timeSlot: '11:00',
          rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
        })
      });
      const resMadrid = await bookingHandler(reqMadrid, {});
      expect(resMadrid.status).toBe(201);

      // 2. Create appointment in barberia-rex on same date/time
      const reqRex = new Request('http://localhost/api/shops/barberia-rex/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Rex User',
          clientPhone: '699887766',
          barberId: 'rex',
          serviceId: 'skin-fade',
          date: '2026-11-20',
          timeSlot: '11:00',
          rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
        })
      });
      // Should NOT collide because shops are isolated!
      const resRex = await bookingHandler(reqRex, {});
      expect(resRex.status).toBe(201);

      // 3. Sync kutz-madrid: should only see Madrid appointment
      const syncReqMadrid = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'GET',
        headers: { 'x-shop-pin': '1234' }
      });
      const syncResMadrid = await syncHandler(syncReqMadrid, {});
      const dataMadrid = await syncResMadrid.json();
      expect(dataMadrid.appointments.some(a => a.clientName === 'Madrid User')).toBe(true);
      expect(dataMadrid.appointments.some(a => a.clientName === 'Rex User')).toBe(false);

      // 4. Sync barberia-rex: should only see Rex appointment
      const syncReqRex = new Request('http://localhost/api/shops/barberia-rex/sync', {
        method: 'GET',
        headers: { 'x-shop-pin': '9999' }
      });
      const syncResRex = await syncHandler(syncReqRex, {});
      const dataRex = await syncResRex.json();
      expect(dataRex.appointments.some(a => a.clientName === 'Rex User')).toBe(true);
      expect(dataRex.appointments.some(a => a.clientName === 'Madrid User')).toBe(false);
    });

  });

  // =========================================================================
  // SUITE 4: Network Dropout Simulation & Error Resilience
  // =========================================================================
  runner.describe('Challenger 2 Suite 4: Network Dropout Simulation & Error Resilience', () => {

    runner.it('4.1: ZERO unhandled promise rejections on network timeouts, socket hangups, and broken JSON', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';

      let unhandledCount = 0;
      const rejectionHandler = (reason) => {
        unhandledCount++;
        console.error('Captured unhandledRejection:', reason);
      };
      process.on('unhandledRejection', rejectionHandler);

      // Fault injection scenarios: network exception, connection reset, timeout, broken JSON
      const brokenFetches = [
        async () => { throw new Error('ECONNREFUSED'); },
        async () => { throw new TypeError('Failed to fetch'); },
        async () => Promise.reject(new Error('ETIMEDOUT: Connection timed out')),
        async () => ({ ok: false, status: 504, json: async () => ({ error: 'Gateway Timeout' }) })
      ];

      for (const failingFetch of brokenFetches) {
        // 1. syncShopData under fault gracefully falls back to local storage
        const syncRes = await syncShopData(shopSlug, '1234', {
          fetch: failingFetch,
          storage,
          timeoutMs: 50
        });
        expect(syncRes.source).toBe('local');
        expect(syncRes.data).toBeDefined();

        // 2. dispatchBarberAction under fault updates optimistic local state and queues to outbox
        const dispatchRes = await dispatchBarberAction(
          shopSlug,
          'approve',
          { appointmentId: 'apt-drop-1' },
          '1234',
          failingFetch,
          storage
        );
        expect(dispatchRes.success).toBe(true);
        expect(dispatchRes.remoteSynced).toBe(false);
      }

      // Also verify broken JSON during syncShopData remote fetch
      const brokenJsonFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); }
      });
      const jsonFailRes = await syncShopData(shopSlug, '1234', {
        fetch: brokenJsonFetch,
        storage
      });
      expect(jsonFailRes.source).toBe('local');

      // Allow tick for any pending microtasks
      await new Promise(r => setTimeout(r, 50));
      process.removeListener('unhandledRejection', rejectionHandler);

      // Verify exactly ZERO unhandled promise rejections occurred across all failures
      expect(unhandledCount).toBe(0);
    });

    runner.it('4.2: Local UI state remains fully responsive and optimistic during network blackout', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';

      // Seed local appointment
      const initialApt = {
        id: 'apt-offline-1',
        clientName: 'Offline Barber Client',
        clientPhone: '612345678',
        status: 'pending',
        date: '2026-11-20',
        timeSlot: '12:00'
      };
      saveLocalShopState(shopSlug, { appointments: [initialApt] }, storage);

      // Complete blackout fetch: network throws immediately
      const blackoutFetch = async () => {
        throw new Error('NETWORK_UNREACHABLE');
      };

      // 1. Barber clicks "Aceptar" (approve) while offline
      const approveRes = await dispatchBarberAction(
        shopSlug,
        'approve',
        { appointmentId: 'apt-offline-1' },
        '1234',
        blackoutFetch,
        storage
      );

      expect(approveRes.success).toBe(true);
      expect(approveRes.localUpdated).toBe(true);
      expect(approveRes.remoteSynced).toBe(false);

      // Verify UI immediately sees confirmed status from local storage
      const updatedState = loadLocalShopState(shopSlug, storage);
      const updatedApt = updatedState.appointments.find(a => a.id === 'apt-offline-1');
      expect(updatedApt.status).toBe('confirmed');

      // Verify mutation is queued safely in outbox for background delivery
      const outbox = getOutbox(shopSlug, storage);
      expect(outbox.length).toBe(1);
      expect(outbox[0].action).toBe('approve');
      expect(outbox[0].payload.appointmentId).toBe('apt-offline-1');

      // 2. Barber seats client into chair station while offline
      const seatRes = await dispatchBarberAction(
        shopSlug,
        'seat',
        { appointmentId: 'apt-offline-1', chairId: 'SILLÓN 2' },
        '1234',
        blackoutFetch,
        storage
      );

      expect(seatRes.success).toBe(true);
      expect(seatRes.localUpdated).toBe(true);

      const seatedState = loadLocalShopState(shopSlug, storage);
      expect(seatedState.appointments[0].status).toBe('seated');
      expect(seatedState.appointments[0].chairId).toBe('SILLÓN 2');

      expect(getOutbox(shopSlug, storage).length).toBe(2);
    });

    runner.it('4.3: SyncEngine lifecycle: events emission, offline transition, and clean destruction', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';

      let isNetworkOnline = false;
      const mockNetworkFetch = async () => {
        if (!isNetworkOnline) {
          throw new Error('Offline mode active');
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            config: { name: 'KUTZ MADRID SYNCED' },
            appointments: [],
            queue: [],
            clients: []
          })
        };
      };

      const engine = new SyncEngine({
        shopSlug,
        pin: '1234',
        intervalMs: 100, // fast interval for test
        fetch: mockNetworkFetch,
        storage
      });

      const observedStatuses = [];
      engine.on('status', (s) => observedStatuses.push(s));

      // 1. Initial forceSync while offline
      const offlineResult = await engine.forceSync();
      expect(offlineResult.syncStatus).toBe(SYNC_STATUS.OFFLINE);
      expect(engine.getStatus()).toBe(SYNC_STATUS.OFFLINE);

      // 2. Dispatch action while offline
      await engine.dispatch('add_walkin', { id: 'w-1', clientName: 'Walkin Offline' });
      expect(getOutbox(shopSlug, storage).length).toBe(1);

      // 3. Network comes back online
      isNetworkOnline = true;
      const onlineResult = await engine.forceSync();
      expect(onlineResult.syncStatus).toBe(SYNC_STATUS.ONLINE);
      expect(engine.getStatus()).toBe(SYNC_STATUS.ONLINE);

      // Outbox should be auto-flushed
      expect(getOutbox(shopSlug, storage).length).toBe(0);

      // 4. Destroy engine and verify clean teardown
      engine.destroy();
      expect(engine.getStatus()).toBe(SYNC_STATUS.IDLE);
      expect(engine.timerId).toBeNull();
    });

  });
}

// Standalone runner execution
if (process.argv[1]?.endsWith('empirical_m1_challenger2.test.mjs')) {
  const runner = new TestRunner('Challenger 2 Empirical Verification: Milestone 1');
  registerEmpiricalSuites(runner);
  runner.execute().then(res => {
    if (!res.success) {
      console.error(`[EMPIRICAL TEST FAILURE] ${res.totalFailed} test(s) failed.`);
      process.exit(1);
    } else {
      console.log(`[EMPIRICAL TEST SUCCESS] All ${res.totalPassed} empirical challenge tests passed!`);
      process.exit(0);
    }
  }).catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
