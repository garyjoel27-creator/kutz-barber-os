#!/usr/bin/env node

/**
 * tests/challenger_m1_sync_stress.test.mjs
 * Empirical Challenge Harness for Milestone 1 (Iteration 2 Verification)
 * 
 * Target: src/lib/syncService.js
 * 
 * Verifies:
 * 1. Outbox Queue Replay Under Simulated Offline/Online Toggles (50+ actions)
 *    - 75 offline actions queued and persisted
 *    - Simulated network flapping during replay (interrupted flushes, resume)
 *    - Strict FIFO order preservation, 0 duplicate executions, 0 dropped actions
 * 2. Poison-Pill Handling:
 *    - 4xx client errors (400, 404, 422) retry up to 5 times then dropped
 *    - 4xx errors do NOT block subsequent valid actions in queue
 *    - 5xx server errors (500, 502, 503) trigger immediate circuit breaker (halts loop, preserves queue)
 *    - Network exception errors halt replay without state loss
 * 3. Multi-Tenant Storage Boundary Isolation:
 *    - kutz-madrid vs kutz-barcelona vs kutz-vallecas
 *    - Strict storage key partitioning
 *    - Isolated outbox queues, zero cross-tenant contamination
 *    - Multi-instance SyncEngine independence
 */

import { expect, TestRunner } from './helpers/testHarness.mjs';
import {
  SYNC_STATUS,
  getShopStorageKeys,
  getDefaultShopConfig,
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

// Dedicated in-memory storage adapter isolated per test run
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

export function registerSyncStressSuites(runner) {

  // =========================================================================
  // SUITE 1: Outbox Queue Replay Under Simulated Offline/Online Flapping (50+ Actions)
  // =========================================================================
  runner.describe('Challenger 4 Suite 1: Outbox Replay & Flapping Stress (50+ Actions)', () => {

    runner.it('C4.1.1: Buffers 75 diverse actions offline in strict FIFO order with metadata', () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';
      const actionTypes = ['approve', 'reject', 'seat', 'add_walkin', 'add_appointment'];
      const totalActions = 75;

      for (let i = 0; i < totalActions; i++) {
        const action = actionTypes[i % actionTypes.length];
        const payload = {
          seq: i,
          bookingId: `book-seq-${i}`,
          clientName: `Client ${i}`,
          clientPhone: `600${String(i).padStart(6, '0')}`,
          barberId: i % 2 === 0 ? 'rex' : 'kiko',
          serviceId: 'skin-fade',
          timeSlot: '12:00'
        };

        const item = addToOutbox(shopSlug, action, payload, storage);
        expect(item.shopSlug).toBe(shopSlug);
        expect(item.action).toBe(action);
        expect(item.payload.seq).toBe(i);
        expect(typeof item.createdAt).toBe('number');
        expect(item.retryCount).toBe(0);
      }

      const outbox = getOutbox(shopSlug, storage);
      expect(outbox.length).toBe(totalActions);

      // Verify strict sequential ordering preserved in storage
      for (let i = 0; i < totalActions; i++) {
        expect(outbox[i].payload.seq).toBe(i);
        expect(outbox[i].action).toBe(actionTypes[i % actionTypes.length]);
      }
    });

    runner.it('C4.1.2: Replays 75 actions across 3 interrupted flapping cycles with zero duplicates or lost actions', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';
      const totalActions = 75;
      const actionTypes = ['approve', 'reject', 'seat', 'add_walkin', 'add_appointment'];

      // Queue 75 actions
      for (let i = 0; i < totalActions; i++) {
        addToOutbox(shopSlug, actionTypes[i % actionTypes.length], {
          seq: i,
          title: `Action-${i}`
        }, storage);
      }

      const serverAuditLog = [];

      // Phase 1: Online, flushes 25 actions, then network drops (throws error)
      let networkDropTriggered = false;
      const phase1Fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.payload.seq === 25) {
          networkDropTriggered = true;
          throw new Error('ECONNRESET: Simulated WiFi disconnection during peak salon rush');
        }
        serverAuditLog.push({ ...body.payload, action: body.action });
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      const res1 = await flushOutbox(shopSlug, '1234', phase1Fetch, storage);
      expect(networkDropTriggered).toBe(true);
      expect(res1.processed).toBe(25);
      expect(res1.remaining).toBe(50); // 75 - 25 = 50 remaining
      expect(serverAuditLog.length).toBe(25);

      const outboxAfterPhase1 = getOutbox(shopSlug, storage);
      expect(outboxAfterPhase1.length).toBe(50);
      expect(outboxAfterPhase1[0].payload.seq).toBe(25);
      expect(outboxAfterPhase1[0].retryCount).toBe(1); // Increment on failing item

      // Phase 2: In offline state, 1 new action is dispatched locally (appended to tail)
      addToOutbox(shopSlug, 'approve', { seq: 75, title: 'Action-75 (offline emergency)' }, storage);
      expect(getOutbox(shopSlug, storage).length).toBe(51);

      // Phase 3: Online resumes, flushes 30 actions, then server experiences 503 gateway timeout
      let gatewayTimeoutTriggered = false;
      const phase2Fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.payload.seq === 55) {
          gatewayTimeoutTriggered = true;
          return { ok: false, status: 503, json: async () => ({ error: 'gateway_timeout' }) };
        }
        serverAuditLog.push({ ...body.payload, action: body.action });
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      const res2 = await flushOutbox(shopSlug, '1234', phase2Fetch, storage);
      expect(gatewayTimeoutTriggered).toBe(true);
      expect(res2.processed).toBe(30); // 25..54 = 30 processed
      expect(res2.remaining).toBe(21); // 55..75 = 21 remaining
      expect(serverAuditLog.length).toBe(55); // 25 + 30 = 55 total processed so far

      // Phase 4: Network and server fully recovered, flush final batch
      const recoveredFetch = async (url, options) => {
        const body = JSON.parse(options.body);
        serverAuditLog.push({ ...body.payload, action: body.action });
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      const res3 = await flushOutbox(shopSlug, '1234', recoveredFetch, storage);
      expect(res3.processed).toBe(21);
      expect(res3.remaining).toBe(0);
      expect(getOutbox(shopSlug, storage).length).toBe(0);

      // Total server receptions = 76
      expect(serverAuditLog.length).toBe(76);

      // Strict FIFO Order Verification: each processed action matches its sequence 0..75 exactly
      for (let i = 0; i < 76; i++) {
        expect(serverAuditLog[i].seq).toBe(i);
      }
    });

    runner.it('C4.1.3: Rapid flapping (50 rapid single-action disconnect toggles) executes each action exactly once in order', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';
      const actionCount = 50;

      for (let i = 0; i < actionCount; i++) {
        addToOutbox(shopSlug, 'seat', { seq: i }, storage);
      }

      const receivedSequence = [];

      // Each flush call allows exactly 1 item through, then disconnects on the 2nd
      for (let step = 0; step < actionCount; step++) {
        let countInThisBatch = 0;
        const flappyFetch = async (url, options) => {
          countInThisBatch++;
          const body = JSON.parse(options.body);
          if (countInThisBatch === 1) {
            receivedSequence.push(body.payload.seq);
            return { ok: true, status: 200, json: async () => ({ success: true }) };
          }
          throw new Error('Rapid flap disconnect');
        };

        const res = await flushOutbox(shopSlug, '1234', flappyFetch, storage);
        expect(res.processed).toBe(1);
        expect(res.remaining).toBe(actionCount - 1 - step);
      }

      expect(getOutbox(shopSlug, storage).length).toBe(0);
      expect(receivedSequence.length).toBe(actionCount);
      for (let i = 0; i < actionCount; i++) {
        expect(receivedSequence[i]).toBe(i);
      }
    });

  });

  // =========================================================================
  // SUITE 2: Poison-Pill Handling & Circuit Breaker
  // =========================================================================
  runner.describe('Challenger 4 Suite 2: Poison-Pill Resilience & Circuit Breaker', () => {

    runner.it('C4.2.1: Client 4xx error (400 Bad Request) does not block intervening or subsequent valid actions', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';

      // Queue: Valid A -> Poison 400 -> Valid B -> Poison 422 -> Valid C
      addToOutbox(shopSlug, 'approve', { id: 'valid-A' }, storage);
      addToOutbox(shopSlug, 'malformed-400', { id: 'poison-400' }, storage);
      addToOutbox(shopSlug, 'seat', { id: 'valid-B' }, storage);
      addToOutbox(shopSlug, 'malformed-422', { id: 'poison-422' }, storage);
      addToOutbox(shopSlug, 'reject', { id: 'valid-C' }, storage);

      const serverReceived = [];
      const mockFetch = async (url, options) => {
        const body = JSON.parse(options.body);
        serverReceived.push(body.payload.id);

        if (body.action === 'malformed-400') {
          return { ok: false, status: 400, json: async () => ({ error: 'bad_request' }) };
        }
        if (body.action === 'malformed-422') {
          return { ok: false, status: 422, json: async () => ({ error: 'unprocessable' }) };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      const res = await flushOutbox(shopSlug, '1234', mockFetch, storage);

      // All 5 actions were attempted in loop because 4xx does not break the loop
      expect(serverReceived).toEqual(['valid-A', 'poison-400', 'valid-B', 'poison-422', 'valid-C']);

      // 3 valid actions succeeded, 2 poison pills remain in outbox
      expect(res.processed).toBe(3);
      expect(res.remaining).toBe(2);

      const remainingOutbox = getOutbox(shopSlug, storage);
      expect(remainingOutbox.length).toBe(2);
      expect(remainingOutbox[0].payload.id).toBe('poison-400');
      expect(remainingOutbox[0].retryCount).toBe(1);
      expect(remainingOutbox[1].payload.id).toBe('poison-422');
      expect(remainingOutbox[1].retryCount).toBe(1);
    });

    runner.it('C4.2.2: Poison pill is automatically discarded after exactly 5 failed retry cycles', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';

      addToOutbox(shopSlug, 'poison-pill', { toxic: true }, storage);

      const poisonFetch = async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_data' })
      });

      // Flushes 1 through 4: retained with retryCount incrementing 1..4
      for (let cycle = 1; cycle <= 4; cycle++) {
        const res = await flushOutbox(shopSlug, '1234', poisonFetch, storage);
        expect(res.processed).toBe(0);
        expect(res.remaining).toBe(1);
        const outbox = getOutbox(shopSlug, storage);
        expect(outbox[0].retryCount).toBe(cycle);
      }

      // Flush 5: retryCount becomes 5 -> condition `item.retryCount < 5` is FALSE -> item dropped!
      const finalRes = await flushOutbox(shopSlug, '1234', poisonFetch, storage);
      expect(finalRes.processed).toBe(0);
      expect(finalRes.remaining).toBe(0); // Successfully evicted
      expect(finalRes.errors.length).toBe(1);

      const emptyOutbox = getOutbox(shopSlug, storage);
      expect(emptyOutbox.length).toBe(0);
    });

    runner.it('C4.2.3: Server 5xx error (500 Internal Error) activates circuit breaker, halting loop immediately', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';

      // Setup: Valid 1 -> Server 500 -> Valid 2 -> Valid 3
      addToOutbox(shopSlug, 'approve', { id: 'v1' }, storage);
      addToOutbox(shopSlug, 'seat', { id: 'server-error-500' }, storage);
      addToOutbox(shopSlug, 'seat', { id: 'v2' }, storage);
      addToOutbox(shopSlug, 'reject', { id: 'v3' }, storage);

      const contactedIds = [];
      const serverFailFetch = async (url, options) => {
        const body = JSON.parse(options.body);
        contactedIds.push(body.payload.id);

        if (body.payload.id === 'server-error-500') {
          return { ok: false, status: 500, json: async () => ({ error: 'database_timeout' }) };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      const res = await flushOutbox(shopSlug, '1234', serverFailFetch, storage);

      // Circuit breaker halted execution: v2 and v3 were NOT contacted
      expect(contactedIds).toEqual(['v1', 'server-error-500']);
      expect(res.processed).toBe(1);
      expect(res.remaining).toBe(3); // 'server-error-500', 'v2', 'v3' preserved

      const outbox = getOutbox(shopSlug, storage);
      expect(outbox.length).toBe(3);
      expect(outbox[0].payload.id).toBe('server-error-500');
      expect(outbox[0].retryCount).toBe(1);
      expect(outbox[1].payload.id).toBe('v2');
      expect(outbox[1].retryCount).toBe(0); // Never touched
      expect(outbox[2].payload.id).toBe('v3');
      expect(outbox[2].retryCount).toBe(0); // Never touched
    });

    runner.it('C4.2.4: Heterogeneous cascade: 4xx item progresses while subsequent 503 trips breaker, then recovers', async () => {
      const storage = createIsolatedStorage();
      const shopSlug = 'kutz-madrid';

      addToOutbox(shopSlug, 'item-404', { id: 'i-404' }, storage);
      addToOutbox(shopSlug, 'item-503', { id: 'i-503' }, storage);
      addToOutbox(shopSlug, 'item-valid', { id: 'i-valid' }, storage);

      // Attempt 1: 404 processed with error (retry=1), 503 halts loop (retry=1), valid item untouched
      const fetch1 = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'item-404') return { ok: false, status: 404 };
        if (body.action === 'item-503') return { ok: false, status: 503 };
        return { ok: true, status: 200 };
      };

      const res1 = await flushOutbox(shopSlug, '1234', fetch1, storage);
      expect(res1.processed).toBe(0);
      expect(res1.remaining).toBe(3);

      const outbox1 = getOutbox(shopSlug, storage);
      expect(outbox1[0].retryCount).toBe(1); // 404
      expect(outbox1[1].retryCount).toBe(1); // 503
      expect(outbox1[2].retryCount).toBe(0); // Valid untouched

      // Attempt 2: Server recovers for 503 and valid items; 404 continues failing
      const fetch2 = async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.action === 'item-404') return { ok: false, status: 404 };
        return { ok: true, status: 200 };
      };

      const res2 = await flushOutbox(shopSlug, '1234', fetch2, storage);
      expect(res2.processed).toBe(2); // 503 and valid items processed!
      expect(res2.remaining).toBe(1); // Only 404 remaining

      const outbox2 = getOutbox(shopSlug, storage);
      expect(outbox2.length).toBe(1);
      expect(outbox2[0].action).toBe('item-404');
      expect(outbox2[0].retryCount).toBe(2);
    });

  });

  // =========================================================================
  // SUITE 3: Multi-Tenant Storage Boundary Isolation
  // =========================================================================
  runner.describe('Challenger 4 Suite 3: Multi-Tenant Boundary Isolation', () => {

    runner.it('C4.3.1: Generates strictly namespaced localStorage keys across distinct shop slugs', () => {
      const shops = ['kutz-madrid', 'kutz-barcelona', 'kutz-vallecas'];
      const keyMaps = shops.map(slug => getShopStorageKeys(slug));

      // Assert all keys contain respective shop slug
      keyMaps.forEach((keys, idx) => {
        const slug = shops[idx];
        expect(keys.APPOINTMENTS).toBe(`kutz_${slug}_appointments`);
        expect(keys.QUEUE).toBe(`kutz_${slug}_queue`);
        expect(keys.CLIENTS).toBe(`kutz_${slug}_clients`);
        expect(keys.CONFIG).toBe(`kutz_${slug}_config`);
        expect(keys.OUTBOX).toBe(`kutz_${slug}_outbox`);
        expect(keys.LAST_SYNC).toBe(`kutz_${slug}_last_sync`);
      });

      // Verify zero overlap across any two tenants
      for (let i = 0; i < shops.length; i++) {
        for (let j = i + 1; j < shops.length; j++) {
          Object.keys(keyMaps[i]).forEach(k => {
            expect(keyMaps[i][k] !== keyMaps[j][k]).toBe(true);
          });
        }
      }
    });

    runner.it('C4.3.2: Concurrent state mutations across multiple tenants remain completely isolated', () => {
      const storage = createIsolatedStorage();
      const madrid = 'kutz-madrid';
      const bcn = 'kutz-barcelona';

      // 1. Save local state for Madrid
      saveLocalShopState(madrid, {
        appointments: [{ id: 'mad-1', clientName: 'Madrid Client', date: '2026-11-20', timeSlot: '10:00' }],
        queue: [{ id: 'mad-q1', clientName: 'Madrid Walkin' }],
        clients: [{ id: 'mad-c1', name: 'Madrid VIP', formula: '#000 skin fade' }]
      }, storage);

      // 2. Save local state for Barcelona with conflicting appointment time
      saveLocalShopState(bcn, {
        appointments: [{ id: 'bcn-1', clientName: 'BCN Client', date: '2026-11-20', timeSlot: '10:00' }],
        queue: [{ id: 'bcn-q1', clientName: 'BCN Walkin' }],
        clients: [{ id: 'bcn-c1', name: 'BCN VIP', formula: '#1.5 taper' }]
      }, storage);

      // Verify Madrid state
      const madState = loadLocalShopState(madrid, storage);
      expect(madState.appointments.length).toBe(1);
      expect(madState.appointments[0].clientName).toBe('Madrid Client');
      expect(madState.queue.length).toBe(1);
      expect(madState.queue[0].clientName).toBe('Madrid Walkin');
      expect(madState.clients[0].formula).toBe('#000 skin fade');

      // Verify Barcelona state
      const bcnState = loadLocalShopState(bcn, storage);
      expect(bcnState.appointments.length).toBe(1);
      expect(bcnState.appointments[0].clientName).toBe('BCN Client');
      expect(bcnState.queue.length).toBe(1);
      expect(bcnState.queue[0].clientName).toBe('BCN Walkin');
      expect(bcnState.clients[0].formula).toBe('#1.5 taper');

      // Zero leakage: no Madrid records in Barcelona, and vice versa
      expect(bcnState.appointments.some(a => a.clientName.includes('Madrid'))).toBe(false);
      expect(madState.appointments.some(a => a.clientName.includes('BCN'))).toBe(false);
    });

    runner.it('C4.3.3: Outbox buffers and flush operations operate strictly within tenant boundary', async () => {
      const storage = createIsolatedStorage();
      const madrid = 'kutz-madrid';
      const bcn = 'kutz-barcelona';

      // Add 25 actions to Madrid outbox
      for (let i = 0; i < 25; i++) {
        addToOutbox(madrid, 'approve', { id: `mad-act-${i}` }, storage);
      }

      // Add 15 actions to Barcelona outbox
      for (let i = 0; i < 15; i++) {
        addToOutbox(bcn, 'seat', { id: `bcn-act-${i}` }, storage);
      }

      expect(getOutbox(madrid, storage).length).toBe(25);
      expect(getOutbox(bcn, storage).length).toBe(15);

      const serverDispatches = [];
      const tenantMockFetch = async (url, options) => {
        serverDispatches.push({ url, body: JSON.parse(options.body) });
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      // Flush only Madrid
      const madResult = await flushOutbox(madrid, '1234', tenantMockFetch, storage);
      expect(madResult.processed).toBe(25);
      expect(madResult.remaining).toBe(0);
      expect(getOutbox(madrid, storage).length).toBe(0);

      // Barcelona outbox MUST remain completely untouched at 15 items
      expect(getOutbox(bcn, storage).length).toBe(15);
      expect(serverDispatches.every(d => d.url.includes('kutz-madrid'))).toBe(true);
      expect(serverDispatches.some(d => d.url.includes('kutz-barcelona'))).toBe(false);

      // Now clear Barcelona outbox directly
      clearOutbox(bcn, storage);
      expect(getOutbox(bcn, storage).length).toBe(0);
    });

    runner.it('C4.3.4: Poison pills in Shop A do not contaminate or stall Shop B operations', async () => {
      const storage = createIsolatedStorage();
      const shopA = 'kutz-madrid';
      const shopB = 'kutz-barcelona';

      // Shop A has 3 toxic poison pills
      addToOutbox(shopA, 'toxic-1', {}, storage);
      addToOutbox(shopA, 'toxic-2', {}, storage);
      addToOutbox(shopA, 'toxic-3', {}, storage);

      // Shop B has 10 valid actions
      for (let i = 0; i < 10; i++) {
        addToOutbox(shopB, 'seat', { chairId: `chair-${i}` }, storage);
      }

      const routerFetch = async (url) => {
        if (url.includes('kutz-madrid')) {
          return { ok: false, status: 400, json: async () => ({ error: 'poison' }) };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      // Flush Shop B first
      const resB = await flushOutbox(shopB, '1234', routerFetch, storage);
      expect(resB.processed).toBe(10);
      expect(resB.remaining).toBe(0);
      expect(getOutbox(shopB, storage).length).toBe(0);

      // Shop A outbox still has its 3 poison pills
      expect(getOutbox(shopA, storage).length).toBe(3);
    });

    runner.it('C4.3.5: Multi-instance SyncEngine maintains independent status, listeners, and intervals', async () => {
      const storage = createIsolatedStorage();
      const engineMadrid = new SyncEngine({ shopSlug: 'kutz-madrid', storage });
      const engineBcn = new SyncEngine({ shopSlug: 'kutz-barcelona', storage });

      const madridStatusUpdates = [];
      const bcnStatusUpdates = [];

      engineMadrid.on('status', s => madridStatusUpdates.push(s));
      engineBcn.on('status', s => bcnStatusUpdates.push(s));

      // Trigger state change on Madrid only
      engineMadrid._setStatus(SYNC_STATUS.ONLINE);

      expect(engineMadrid.getStatus()).toBe(SYNC_STATUS.ONLINE);
      expect(engineBcn.getStatus()).toBe(SYNC_STATUS.IDLE);
      expect(madridStatusUpdates).toEqual([SYNC_STATUS.ONLINE]);
      expect(bcnStatusUpdates).toEqual([]);

      // Clean up
      engineMadrid.destroy();
      engineBcn.destroy();
    });

  });

}

// Standalone execution capability
const isDirectRun = process.argv[1] && process.argv[1].endsWith('challenger_m1_sync_stress.test.mjs');
if (isDirectRun) {
  const runner = new TestRunner('Challenger 4: syncService Empirical Stress Harness');
  registerSyncStressSuites(runner);
  runner.execute().then(res => {
    if (!res.success) {
      console.error(`\x1b[31m[STRESS HARNESS FAILURE]\x1b[0m ${res.totalFailed} test(s) failed.`);
      process.exit(1);
    } else {
      console.log(`\x1b[32m[STRESS HARNESS SUCCESS]\x1b[0m All ${res.totalPassed} tests passed!`);
      process.exit(0);
    }
  });
}
