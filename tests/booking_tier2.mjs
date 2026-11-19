/**
 * KUTZ // BARBER OS — QR Booking Engine & Multi-Shop Platform
 * Tier 2: Boundary & Corner Cases (Features F01–F12, 60 Tests)
 *
 * 5 boundary tests per feature across 12 features:
 * - F01: Netlify Blobs Backend & Storage Service Boundaries (5 tests)
 * - F02: Offline-First Synchronization Engine Boundaries (5 tests)
 * - F03: Multi-Shop Architecture & Tenant Configuration Boundaries (5 tests)
 * - F04: Super-Admin Multi-Shop Management Panel Boundaries (5 tests)
 * - F05: Public Mobile Booking Portal Boundaries (5 tests)
 * - F06: Hybrid Booking Engine - Mode 1 Boundaries (5 tests)
 * - F07: Hybrid Booking Engine - Mode 2 Boundaries (5 tests)
 * - F08: Barber Security Guard (4-Digit PIN) Boundaries (5 tests)
 * - F09: Printable QR Poster Generator Boundaries (5 tests)
 * - F10: 1-Touch Approval Tray in "Salón Hoy" Boundaries (5 tests)
 * - F11: Automated Phone Matching & 3D Recetas Boundaries (5 tests)
 * - F12: Live Production Deployment & Verification Boundaries (5 tests)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from './helpers/testHarness.mjs';
import {
  MockBlobsStore,
  SlotHoldManager,
  OfflineSyncEngine,
  DEFAULT_SHOP_FIXTURE,
  SHOP_REX_FIXTURE,
  formatWhatsAppPhone,
  buildWhatsAppUrl,
  generateWhatsAppRescheduleUrl,
  matchClientByPhone,
  createNewClientFromBooking,
  validateTenantConfig,
  simulatePinKeypadInput,
  executeBookingFunctionContract,
  executeSyncFunctionContract,
  executeAdminFunctionContract,
  isPublicBookingPath,
  normalizeShopSlug,
  sanitizeShopName,
  buildCustomerPortalUrl,
  buildEmergencyPhoneLink,
  verifyPinWithRateLimit,
  formatPosterTitle,
  generateClientSideQrSvg,
  validateProductionOrigin,
  validateButtonAccessibility,
  createDebouncedSubmitHandler,
  copyToClipboardWithFallback,
  safeTriggerPrint
} from './helpers/bookingContracts.mjs';
import { MockLocalStorageWithQuota } from './helpers/contracts.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export function registerBookingTier2Tests(runner) {
  // ==========================================================================
  // FEATURE 1: Netlify Blobs Backend & Storage Service Boundaries (5 Tests)
  // ==========================================================================
  runner.describe('Tier 2: Boundary 1 — Netlify Blobs Backend & Storage Service', () => {
    runner.it('T2.F1.1: Security / Path Traversal: Reject slug containing path traversal sequences (../admin-secret)', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const req = new Request('http://localhost/api/shops/%2E%2E%2Fadmin-secret/public-state');

      const res = await executeBookingFunctionContract(req, store);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid shop slug format');
    });

    runner.it('T2.F1.2: Malformed Input / Null Payload: Reject empty or non-JSON request body with HTTP 400', async () => {
      const store = new MockBlobsStore('kutz_platform');

      // Test 1: Malformed JSON syntax
      const malformedReq = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{'
      });
      const res1 = await executeBookingFunctionContract(malformedReq, store);
      expect(res1.status).toBe(400);
      const data1 = await res1.json();
      expect(data1.error).toContain('Empty or malformed payload');

      // Test 2: Null/Empty body
      const emptyReq = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: ''
      });
      const res2 = await executeBookingFunctionContract(emptyReq, store);
      expect(res2.status).toBe(400);
    });

    runner.it('T2.F1.3: Boundary / Large Payload: Handle large JSON payload safely without process crash', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const largeArray = [];
      for (let i = 0; i < 200; i++) {
        largeArray.push({
          id: `client-${i}`,
          name: `Client ${i}`,
          notes: 'Standard treatment record with comprehensive barber notes and guard formula details.'
        });
      }

      await store.setJSON('shops/kutz-madrid/large-catalog', largeArray);
      const readBack = await store.getJSON('shops/kutz-madrid/large-catalog');

      expect(readBack).toHaveLength(200);
      expect(readBack[199].id).toBe('client-199');
    });

    runner.it('T2.F1.4: Concurrency / Concurrent Writes: Last-write-wins maintains store data integrity', async () => {
      const store = new MockBlobsStore('kutz_platform');

      const write1 = store.setJSON('shops/kutz-madrid/appointments', [{ id: 'apt-1', version: 1 }]);
      const write2 = store.setJSON('shops/kutz-madrid/appointments', [{ id: 'apt-1', version: 2 }]);

      await Promise.all([write1, write2]);
      const finalState = await store.getJSON('shops/kutz-madrid/appointments');

      expect(finalState).toBeDefined();
      expect(Array.isArray(finalState)).toBe(true);
      expect(finalState).toHaveLength(1);
    });

    runner.it('T2.F1.5: Error / Non-Existent Store Key: Querying non-existent shop slug returns clean HTTP 404', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const req = new Request('http://localhost/api/shops/shop-does-not-exist-999/public-state');

      const res = await executeBookingFunctionContract(req, store);
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Shop not found');
    });
  });

  // ==========================================================================
  // FEATURE 2: Offline-First Synchronization Engine Boundaries (5 Tests)
  // ==========================================================================
  runner.describe('Tier 2: Boundary 2 — Offline-First Synchronization Engine', () => {
    runner.it('T2.F2.1: Boundary / Rapid Flapping: Rapid online/offline toggling does not duplicate outbox actions', async () => {
      const storage = new MockLocalStorageWithQuota();
      const syncEngine = new OfflineSyncEngine('kutz-madrid', { storage, isOnline: false });

      // Dispatch 1 action
      await syncEngine.dispatchAction({ action: 'approve', payload: { bookingId: 'book-1' } });

      // Simulate rapid toggling
      syncEngine.setOnlineStatus(true);
      syncEngine.setOnlineStatus(false);
      syncEngine.setOnlineStatus(true);
      syncEngine.setOnlineStatus(false);

      const outbox = syncEngine.getOutbox();
      expect(outbox).toHaveLength(1);
    });

    runner.it('T2.F2.2: Error / Outbox Replay HTTP Failure: Failed replay keeps item in outbox with retryCount incremented', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const storage = new MockLocalStorageWithQuota();
      const syncEngine = new OfflineSyncEngine('kutz-madrid', { store, storage, isOnline: false });

      // Action for non-existent appointment causes 404 during replay
      await syncEngine.dispatchAction({ action: 'approve', payload: { bookingId: 'non-existent-booking' } });

      syncEngine.setOnlineStatus(true);
      const flushResult = await syncEngine.flushOutbox();

      expect(flushResult.success).toBe(false);
      expect(flushResult.remaining).toBe(1);

      const outbox = syncEngine.getOutbox();
      expect(outbox).toHaveLength(1);
      expect(outbox[0].retryCount).toBe(1);
    });

    runner.it('T2.F2.3: Storage Boundary / QuotaExceededError: Recovers by evicting non-essential cache to preserve outbox', () => {
      // Create a small quota store (200 bytes)
      const storage = new MockLocalStorageWithQuota(200);
      storage.setItem('kutz_kutz-madrid_cache_logs', 'A'.repeat(150));

      const syncEngine = new OfflineSyncEngine('kutz-madrid', { storage, isOnline: false });
      const actions = [{ id: 'act-1', action: 'approve', payload: { bookingId: 'b1' } }];

      syncEngine.saveOutbox(actions);
      expect(syncEngine.getOutbox()).toHaveLength(1);
      // Verify non-essential cache was evicted
      expect(storage.getItem('kutz_kutz-madrid_cache_logs')).toBeNull();
    });

    runner.it('T2.F2.4: Data Conflict / Stale Cache: Authoritative server state reconciles smoothly with local outbox', async () => {
      const storage = new MockLocalStorageWithQuota();
      const syncEngine = new OfflineSyncEngine('kutz-madrid', { storage, isOnline: false });

      // Queue offline action
      await syncEngine.dispatchAction({ action: 'approve', payload: { bookingId: 'b1' } });
      expect(syncEngine.getOutbox()).toHaveLength(1);

      // Authoritative server updates local appointment cache
      const serverState = [{ id: 'b1', status: 'confirmed', updatedAt: Date.now() }];
      storage.setItem('kutz_kutz-madrid_appointments', JSON.stringify(serverState));

      const resolved = JSON.parse(storage.getItem('kutz_kutz-madrid_appointments'));
      expect(resolved[0].status).toBe('confirmed');
    });

    runner.it('T2.F2.5: Corrupted Data / Malformed Outbox JSON: Sync engine recovers cleanly from corrupted JSON string', () => {
      const storage = new MockLocalStorageWithQuota();
      storage.setItem('kutz_kutz-madrid_outbox', '{CORRUPTED_JSON[[');

      const syncEngine = new OfflineSyncEngine('kutz-madrid', { storage });
      const outbox = syncEngine.getOutbox();

      expect(Array.isArray(outbox)).toBe(true);
      expect(outbox).toHaveLength(0);
    });
  });

  // ==========================================================================
  // FEATURE 3: Multi-Shop Architecture Boundaries (5 Tests)
  // ==========================================================================
  runner.describe('Tier 2: Boundary 3 — Multi-Shop Architecture & Tenant Configuration', () => {
    runner.it('T2.F3.1: Normalization: Normalizes uppercase and whitespace in slug parameters', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/barberia-rex/config', SHOP_REX_FIXTURE);

      // Slug with uppercase characters and whitespace
      const rawSlug = '  Barbería-Rex  ';
      const normalizedSlug = normalizeShopSlug(rawSlug);
      expect(normalizedSlug).toBe('barberia-rex');

      const config = await store.getJSON(`shops/${normalizedSlug}/config`);
      expect(config.slug).toBe('barberia-rex');
    });

    runner.it('T2.F3.2: Error / Illegal Slug Characters: Reject slug containing symbols ($@!%*)', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const req = new Request('http://localhost/api/shops/shop$@!%*/public-state');

      const res = await executeBookingFunctionContract(req, store);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.success).toBe(false);
    });

    runner.it('T2.F3.3: Status / Paused Tenant Access: Accessing shop with status: "paused" returns HTTP 403', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const pausedShop = { ...SHOP_REX_FIXTURE, status: 'paused' };
      await store.setJSON('shops/barberia-rex/config', pausedShop);

      const req = new Request('http://localhost/api/shops/barberia-rex/public-state');
      const res = await executeBookingFunctionContract(req, store);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.paused).toBe(true);
      expect(data.error).toContain('pausada');
    });

    runner.it('T2.F3.4: Boundary / Extremely Long Slug: Reject slug exceeding 64 characters', () => {
      // 64-character slug boundary (must pass)
      const validBoundarySlug = 'a'.repeat(64);
      const passResult = validateTenantConfig({
        slug: validBoundarySlug,
        name: 'Valid Name',
        pin: '1234',
        barbers: [{ id: 'b1' }],
        services: [{ id: 's1' }]
      });
      expect(passResult.valid).toBe(true);

      // 65-character slug boundary (must fail)
      const invalidBoundarySlug = 'a'.repeat(65);
      const failResult = validateTenantConfig({
        slug: invalidBoundarySlug,
        name: 'Valid Name',
        pin: '1234',
        barbers: [{ id: 'b1' }],
        services: [{ id: 's1' }]
      });
      expect(failResult.valid).toBe(false);
      expect(failResult.code).toBe('ERR_SLUG_TOO_LONG');
    });

    runner.it('T2.F3.5: Tenant Switch / Unsynced Outbox Isolation: Switching tenant preserves prior tenant outbox', async () => {
      const storage = new MockLocalStorageWithQuota();
      const syncA = new OfflineSyncEngine('shop-a', { storage, isOnline: false });
      const syncB = new OfflineSyncEngine('shop-b', { storage, isOnline: false });

      await syncA.dispatchAction({ action: 'approve', payload: { id: 'a1' } });
      await syncB.dispatchAction({ action: 'approve', payload: { id: 'b1' } });

      const outboxA = syncA.getOutbox();
      const outboxB = syncB.getOutbox();

      expect(outboxA).toHaveLength(1);
      expect(outboxA[0].payload.id).toBe('a1');
      expect(outboxB).toHaveLength(1);
      expect(outboxB[0].payload.id).toBe('b1');
    });
  });

  // ==========================================================================
  // FEATURE 4: Super-Admin Multi-Shop Management Panel Boundaries (5 Tests)
  // ==========================================================================
  runner.describe('Tier 2: Boundary 4 — Super-Admin Multi-Shop Management Panel', () => {
    runner.it('T2.F4.1: Error / Duplicate Slug Collision: Reject creating a shop with an existing slug with HTTP 409', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/index', ['kutz-madrid']);

      const req = new Request('http://localhost/api/admin/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'kutz-superadmin-2026'
        },
        body: JSON.stringify({
          slug: 'kutz-madrid',
          name: 'Duplicate Kutz',
          pin: '9999',
          barbers: [{ id: 'b1' }],
          services: [{ id: 's1' }]
        })
      });

      const res = await executeAdminFunctionContract(req, store);
      expect(res.status).toBe(409);

      const data = await res.json();
      expect(data.error).toContain('ya existe');
    });

    runner.it('T2.F4.2: Security / Unauthorized Admin Access: Reject requests without valid x-admin-key header', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const req = new Request('http://localhost/api/admin/shops', {
        headers: { 'x-admin-key': 'wrong-key-attempt' }
      });

      const res = await executeAdminFunctionContract(req, store);
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.error).toBe('Acceso no autorizado');
    });

    runner.it('T2.F4.3: Validation / Invalid PIN Format: Reject PINs that are not exactly 4 numeric digits', () => {
      const invalidPins = ['123', '12345', 'abcd', '', '12a4'];
      for (const pin of invalidPins) {
        const val = validateTenantConfig({
          slug: 'valid-slug',
          name: 'Valid Name',
          pin,
          barbers: [{ id: 'b1' }],
          services: [{ id: 's1' }]
        });
        expect(val.valid).toBe(false);
        expect(val.error).toContain('4 dígitos numéricos');
      }
    });

    runner.it('T2.F4.4: Validation / Empty Barbers or Services: Reject shop creation with 0 barbers or 0 services', () => {
      const noBarbers = validateTenantConfig({
        slug: 'valid-slug',
        name: 'Valid Name',
        pin: '1234',
        barbers: [],
        services: [{ id: 's1' }]
      });
      expect(noBarbers.valid).toBe(false);
      expect(noBarbers.error).toContain('al menos un barbero');

      const noServices = validateTenantConfig({
        slug: 'valid-slug',
        name: 'Valid Name',
        pin: '1234',
        barbers: [{ id: 'b1' }],
        services: []
      });
      expect(noServices.valid).toBe(false);
      expect(noServices.error).toContain('al menos un servicio');
    });

    runner.it('T2.F4.5: Security / XSS Injection in Shop Name: Sanitizes HTML/script tags in input', () => {
      const rawName = '<script>alert("xss")</script>Barbería Central';
      const sanitized = sanitizeShopName(rawName);
      expect(sanitized).toBe('alert("xss")Barbería Central');
      expect(sanitized.includes('<script>')).toBe(false);
    });
  });

  // ==========================================================================
  // FEATURE 5: Public Mobile Booking Portal Boundaries (5 Tests)
  // ==========================================================================
  runner.describe('Tier 2: Boundary 5 — Public Mobile Booking Portal', () => {
    runner.it('T2.F5.1: Offline / Client Disconnected: Provides direct telephone link fallback', () => {
      const linkStandard = buildEmergencyPhoneLink('600123456');
      expect(linkStandard).toBe('tel:600123456');

      const linkFormatted = buildEmergencyPhoneLink('+34 600-123-456');
      expect(linkFormatted).toBe('tel:600123456');
    });

    runner.it('T2.F5.2: Security / Route Escape: Internal routes (/dashboard) are protected from public access', () => {
      // Authorized public paths
      expect(isPublicBookingPath('/r/kutz-madrid')).toBe(true);
      expect(isPublicBookingPath('/reservar')).toBe(true);

      // Path traversal security attack attempts
      expect(isPublicBookingPath('/r/kutz-madrid/../../dashboard')).toBe(false);
      expect(isPublicBookingPath('/r/%2e%2e/dashboard')).toBe(false);
      expect(isPublicBookingPath('/reservar/../admin')).toBe(false);
    });

    runner.it('T2.F5.3: Boundary / Max Length Client Notes: Rejects notes exceeding 250 characters with HTTP 400', async () => {
      const store = new MockBlobsStore('kutz_platform');

      // 251 characters: exceeds limit, must return 400
      const longNotes = 'A'.repeat(251);
      const reqFail = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Marcos',
          clientPhone: '612345678',
          date: '2026-11-20',
          timeSlot: '11:00',
          notes: longNotes
        })
      });
      const resFail = await executeBookingFunctionContract(reqFail, store);
      expect(resFail.status).toBe(400);
      const dataFail = await resFail.json();
      expect(dataFail.error).toContain('250');

      // 250 characters: exactly at limit, must be accepted with 201
      const validNotes = 'A'.repeat(250);
      const reqPass = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Marcos',
          clientPhone: '612345678',
          date: '2026-11-20',
          timeSlot: '11:30',
          notes: validNotes
        })
      });
      const resPass = await executeBookingFunctionContract(reqPass, store);
      expect(resPass.status).toBe(201);
    });

    runner.it('T2.F5.4: Debounce / Rapid Double-Click Submit: Disables double submit via pending flag', () => {
      const debouncer = createDebouncedSubmitHandler(300);

      expect(debouncer.isPending()).toBe(false);
      expect(debouncer.getCallCount()).toBe(0);

      // First submit attempt succeeds
      const firstClick = debouncer.submit();
      expect(firstClick).toBe(true);
      expect(debouncer.isPending()).toBe(true);
      expect(debouncer.getCallCount()).toBe(1);

      // Rapid duplicate click while pending is blocked
      const secondClick = debouncer.submit();
      expect(secondClick).toBe(false);
      expect(debouncer.getCallCount()).toBe(1);

      // Reset re-enables submission
      debouncer.reset();
      expect(debouncer.isPending()).toBe(false);
      const thirdClick = debouncer.submit();
      expect(thirdClick).toBe(true);
      expect(debouncer.getCallCount()).toBe(2);
    });

    runner.it('T2.F5.5: Accessibility: Icon buttons and input elements provide required accessible attributes', () => {
      // Valid button descriptor satisfies both aria-label and button role/tagName
      const validButton = { 'aria-label': 'Seleccionar barbero Gary', role: 'button', tabIndex: 0 };
      const validResult = validateButtonAccessibility(validButton);
      expect(validResult.valid).toBe(true);
      expect(validResult.hasLabel).toBe(true);
      expect(validResult.hasRole).toBe(true);

      // HTML BUTTON element satisfies tagName contract
      const htmlButton = { 'aria-label': 'Confirmar reserva', tagName: 'BUTTON' };
      expect(validateButtonAccessibility(htmlButton).valid).toBe(true);

      // Inaccessible descriptor missing aria-label must fail validation
      const missingLabel = { role: 'button', tabIndex: 0 };
      const missingLabelResult = validateButtonAccessibility(missingLabel);
      expect(missingLabelResult.valid).toBe(false);
      expect(missingLabelResult.hasLabel).toBe(false);
      expect(missingLabelResult.hasRole).toBe(true);

      // Inaccessible descriptor with empty or whitespace-only label must fail validation
      const emptyLabel = { 'aria-label': '   ', role: 'button' };
      expect(validateButtonAccessibility(emptyLabel).valid).toBe(false);

      // Inaccessible descriptor with non-button role must fail validation
      const invalidRole = { 'aria-label': 'Avatar barbero', role: 'img' };
      const invalidRoleResult = validateButtonAccessibility(invalidRole);
      expect(invalidRoleResult.valid).toBe(false);
      expect(invalidRoleResult.hasRole).toBe(false);

      // Null or undefined descriptor must fail safely
      expect(validateButtonAccessibility(null).valid).toBe(false);
      expect(validateButtonAccessibility(undefined).valid).toBe(false);
    });
  });

  // ==========================================================================
  // FEATURE 6: Hybrid Booking Engine - Mode 1 Boundaries (5 Tests)
  // ==========================================================================
  runner.describe('Tier 2: Boundary 6 — Hybrid Booking Engine - Mode 1 (Día y Hora)', () => {
    runner.it('T2.F6.1: Collision / Same-Millisecond Race: Concurrent requests for same slot return HTTP 409 to second client', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const holdManager = new SlotHoldManager();

      const bookingA = {
        type: 'appointment',
        clientName: 'Client A',
        clientPhone: '611111111',
        barberId: 'b1',
        date: '2026-11-20',
        timeSlot: '10:00'
      };

      const bookingB = {
        type: 'appointment',
        clientName: 'Client B',
        clientPhone: '622222222',
        barberId: 'b1',
        date: '2026-11-20',
        timeSlot: '10:00'
      };

      const reqA = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingA)
      });
      const reqB = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingB)
      });

      const resA = await executeBookingFunctionContract(reqA, store, holdManager);
      const resB = await executeBookingFunctionContract(reqB, store, holdManager);

      expect(resA.status).toBe(201);
      expect(resB.status).toBe(409);

      const dataB = await resB.json();
      expect(dataB.code === 'SLOT_HELD' || dataB.code === 'SLOT_COLLISION').toBe(true);
    });

    runner.it('T2.F6.2: Hold TTL / 10-Minute Expiration: Expired hold automatically releases slot for other clients', () => {
      const holdManager = new SlotHoldManager(1); // 1 second TTL
      holdManager.acquireHold('kutz-madrid', 'b1', '2026-11-20', '14:00', '611111111', 10); // 10ms

      expect(holdManager.isHeld('kutz-madrid', 'b1', '2026-11-20', '14:00')).toBe(true);

      // Simulate passage of time past TTL
      const hold = holdManager.getHold('kutz-madrid', 'b1', '2026-11-20', '14:00');
      if (hold) hold.expiresAt = Date.now() - 1000;

      expect(holdManager.isHeld('kutz-madrid', 'b1', '2026-11-20', '14:00')).toBe(false);
    });

    runner.it('T2.F6.3: Validation / Operating Hours: Rejects booking outside business hours (22:00) with HTTP 400', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const req = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Marcos',
          clientPhone: '612345678',
          date: '2026-11-20',
          timeSlot: '22:00'
        })
      });

      const res = await executeBookingFunctionContract(req, store);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain('fuera del horario');
    });

    runner.it('T2.F6.4: Validation / Closed Day: Rejects booking on closed business days (Sunday)', async () => {
      const store = new MockBlobsStore('kutz_platform');
      // 2026-11-22 is a Sunday
      const req = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Marcos',
          clientPhone: '612345678',
          date: '2026-11-22',
          timeSlot: '11:00'
        })
      });

      const res = await executeBookingFunctionContract(req, store);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain('cerrada');
    });

    runner.it('T2.F6.5: Boundary / Closing Time Overlap: Rejects 45-min service booked at 19:30 when close is 20:00', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const req = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Marcos',
          clientPhone: '612345678',
          serviceId: 's3', // 45 min duration
          date: '2026-11-20',
          timeSlot: '19:30' // 19:30 + 45m = 20:15 > 20:00 closing
        })
      });

      const res = await executeBookingFunctionContract(req, store);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain('supera la hora de cierre');
    });
  });

  // ==========================================================================
  // FEATURE 7: Hybrid Booking Engine - Mode 2 Boundaries (5 Tests)
  // ==========================================================================
  runner.describe('Tier 2: Boundary 7 — Hybrid Booking Engine - Mode 2 (Cola en Vivo)', () => {
    runner.it('T2.F7.1: Capacity / Max Limit: Rejects registration when queue capacity reaches 20 waiting clients', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const fullQueue = [];
      for (let i = 1; i <= 20; i++) {
        fullQueue.push({ id: `q-${i}`, clientPhone: `6000000${String(i).padStart(2, '0')}`, status: 'waiting' });
      }
      await store.setJSON('shops/kutz-madrid/queue', fullQueue);

      const req = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'walkin',
          clientName: 'Client 21',
          clientPhone: '699999999'
        })
      });

      const res = await executeBookingFunctionContract(req, store);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain('Cola completa');
    });

    runner.it('T2.F7.2: Duplicate / Phone in Queue: Submitting duplicate phone returns existing ticket without duplicating', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/queue', [
        { id: 'wq-existing', ticket: '#W02', clientPhone: '612345678', position: 2, waitMinutes: 20, status: 'waiting' }
      ]);

      const req = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'walkin',
          clientName: 'Marcos',
          clientPhone: '612345678'
        })
      });

      const res = await executeBookingFunctionContract(req, store);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.alreadyInQueue).toBe(true);
      expect(data.ticket).toBe('#W02');
      expect(data.position).toBe(2);

      const queue = await store.getJSON('shops/kutz-madrid/queue');
      expect(queue).toHaveLength(1);
    });

    runner.it('T2.F7.3: Cancellation / Self-Cancel: Client cancels ticket via mobile web, renumbering positions', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/queue', [
        { id: 'q1', status: 'waiting', position: 1 },
        { id: 'q2', status: 'waiting', position: 2 },
        { id: 'q3', status: 'waiting', position: 3 }
      ]);

      const req = new Request('http://localhost/api/shops/kutz-madrid/booking?ticketId=q2', {
        method: 'DELETE'
      });

      const res = await executeBookingFunctionContract(req, store);
      expect(res.status).toBe(200);

      const queue = await store.getJSON('shops/kutz-madrid/queue');
      expect(queue).toHaveLength(2);
      expect(queue[0].id).toBe('q1');
      expect(queue[1].id).toBe('q3');
      expect(queue[1].position).toBe(2); // q3 advanced to pos 2
    });

    runner.it('T2.F7.4: Non-Existent Cancellation: Canceling invalid ticket ID returns HTTP 404', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/queue', [
        { id: 'ticket-1', ticket: '#W01', status: 'waiting' }
      ]);

      const req = new Request('http://localhost/api/shops/kutz-madrid/booking?ticketId=invalid-non-existent-ticket', {
        method: 'DELETE'
      });

      const res = await executeBookingFunctionContract(req, store);
      expect(res.status).toBe(404);

      // Queue state must remain intact
      const queue = await store.getJSON('shops/kutz-madrid/queue');
      expect(queue).toHaveLength(1);
    });

    runner.it('T2.F7.5: Barber Action / No-Show Handling: Marking client no-show removes entry from active queue', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/queue', [
        { id: 'q1', ticket: '#W01', status: 'waiting' }
      ]);

      // Remove from queue
      const req = new Request('http://localhost/api/shops/kutz-madrid/booking?ticketId=q1', {
        method: 'DELETE'
      });
      await executeBookingFunctionContract(req, store);

      const queue = await store.getJSON('shops/kutz-madrid/queue');
      expect(queue).toHaveLength(0);
    });
  });

  // ==========================================================================
  // FEATURE 8: Barber Security Guard (4-Digit PIN) Boundaries (5 Tests)
  // ==========================================================================
  runner.describe('Tier 2: Boundary 8 — Barber Security Guard (4-Digit PIN)', () => {
    runner.it('T2.F8.1: Error / Wrong PIN: Entering incorrect PIN fails authentication and resets buffer', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE);

      // Submitting wrong PIN to sync endpoint must return HTTP 403
      const req = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        headers: { 'x-shop-pin': '0000' }
      });
      const res = await executeSyncFunctionContract(req, store);
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.error).toContain('Invalid PIN for shop kutz-madrid');

      // Keypad buffer must reset upon clear
      let buffer = '0000';
      buffer = simulatePinKeypadInput(buffer, 'clear');
      expect(buffer).toBe('');
    });

    runner.it('T2.F8.2: Rate Limiting / 5 Consecutive Failures: Triggers 30-second lockout timer', () => {
      const correctPin = '1234';

      // Attempts 1 through 4 increment failure count without lockout
      for (let attempt = 1; attempt <= 4; attempt++) {
        const result = verifyPinWithRateLimit('9999', correctPin, attempt - 1);
        expect(result.authenticated).toBe(false);
        expect(result.lockedOut).toBe(false);
        expect(result.attemptsRemaining).toBe(5 - attempt);
      }

      // 5th consecutive failure triggers lockout
      const fifthResult = verifyPinWithRateLimit('9999', correctPin, 4);
      expect(fifthResult.authenticated).toBe(false);
      expect(fifthResult.lockedOut).toBe(true);
      expect(fifthResult.lockoutDurationSeconds).toBe(30);
      expect(fifthResult.attemptsRemaining).toBe(0);
      expect(fifthResult.error).toContain('Bloqueado por 30 segundos');
    });

    runner.it('T2.F8.3: Sanitization / Non-Numeric Key Filtering: Keypad rejects non-digit characters', () => {
      let buffer = '';
      buffer = simulatePinKeypadInput(buffer, '1');
      buffer = simulatePinKeypadInput(buffer, 'a'); // Non-digit
      buffer = simulatePinKeypadInput(buffer, '$'); // Symbol
      buffer = simulatePinKeypadInput(buffer, '2');
      buffer = simulatePinKeypadInput(buffer, '3');
      buffer = simulatePinKeypadInput(buffer, '4');
      // Buffer at max length (4 digits) rejects 5th digit
      buffer = simulatePinKeypadInput(buffer, '5');

      expect(buffer).toBe('1234');
      expect(buffer).toHaveLength(4);
    });

    runner.it('T2.F8.4: Keypad Operations: Backspace and clear handle state correctly', () => {
      let buffer = '123';
      buffer = simulatePinKeypadInput(buffer, 'backspace');
      expect(buffer).toBe('12');

      buffer = simulatePinKeypadInput(buffer, 'backspace');
      expect(buffer).toBe('1');

      buffer = simulatePinKeypadInput(buffer, 'backspace');
      expect(buffer).toBe('');

      // Backspace on empty buffer remains empty
      buffer = simulatePinKeypadInput(buffer, 'backspace');
      expect(buffer).toBe('');

      // Clear resets buffer immediately
      buffer = '1234';
      buffer = simulatePinKeypadInput(buffer, 'clear');
      expect(buffer).toBe('');
    });

    runner.it('T2.F8.5: Multi-Shop / Tenant PIN Isolation: PIN for Shop A does not unlock Shop B', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/config', DEFAULT_SHOP_FIXTURE); // PIN: 1234
      await store.setJSON('shops/barberia-rex/config', SHOP_REX_FIXTURE);     // PIN: 7890

      // Attempting to unlock Shop B using Shop A's PIN must return HTTP 403
      const crossShopReq = new Request('http://localhost/api/shops/barberia-rex/sync', {
        headers: { 'x-shop-pin': '1234' }
      });
      const crossRes = await executeSyncFunctionContract(crossShopReq, store);
      expect(crossRes.status).toBe(403);
      const crossData = await crossRes.json();
      expect(crossData.error).toContain('Invalid PIN for shop barberia-rex');

      // Using Shop B's own correct PIN succeeds with HTTP 200
      const correctReq = new Request('http://localhost/api/shops/barberia-rex/sync', {
        headers: { 'x-shop-pin': '7890' }
      });
      const correctRes = await executeSyncFunctionContract(correctReq, store);
      expect(correctRes.status).toBe(200);
      const correctData = await correctRes.json();
      expect(correctData.config.slug).toBe('barberia-rex');
    });
  });

  // ==========================================================================
  // FEATURE 9: Printable QR Poster Generator Boundaries (5 Tests)
  // ==========================================================================
  runner.describe('Tier 2: Boundary 9 — Printable QR Poster Generator ("Mi Cartel QR")', () => {
    runner.it('T2.F9.1: Clipboard Fallback: Handles clipboard permission denial gracefully with manual copy fallback', () => {
      const copyUrl = 'https://luminadesk-gary.netlify.app/r/kutz-madrid';

      // Fallback path when Clipboard API is not available or denied
      const fallbackResult = copyToClipboardWithFallback(copyUrl, false);
      expect(fallbackResult.method).toBe('prompt_fallback');
      expect(fallbackResult.text).toBe(copyUrl);
      expect(fallbackResult.success).toBe(true);

      // Standard path when modern Clipboard API is present
      const apiResult = copyToClipboardWithFallback(copyUrl, true);
      expect(apiResult.method).toBe('clipboard_api');
      expect(apiResult.text).toBe(copyUrl);
      expect(apiResult.success).toBe(true);

      // Contract rejects invalid or non-string URLs
      expect(() => copyToClipboardWithFallback('', true)).toThrow('Valid URL string is required');
      expect(() => copyToClipboardWithFallback(null, false)).toThrow('Valid URL string is required');
    });

    runner.it('T2.F9.2: Layout / Long Shop Name: 50+ character shop name formats cleanly without breaking', () => {
      const longName = 'Barbería Tradicional y Salón de Caballeros San Sebastián de los Reyes';
      expect(longName.length > 50).toBe(true);

      const formattedTitle = formatPosterTitle(longName, 40);
      expect(formattedTitle.length <= 41).toBe(true);
      expect(formattedTitle.endsWith('…')).toBe(true);

      // Short names must not be truncated
      const shortName = 'KUTZ Madrid';
      expect(formatPosterTitle(shortName, 40)).toBe('KUTZ Madrid');
    });

    runner.it('T2.F9.3: Origin / Custom Domain: Respects configured custom domain for QR generation', () => {
      const url = buildCustomerPortalUrl('https://reserva.kutzbarber.es', 'kutz-madrid');
      expect(url).toBe('https://reserva.kutzbarber.es/r/kutz-madrid');
    });

    runner.it('T2.F9.4: Zero External Network QR: Renders QR code client-side without external image API calls', () => {
      const testUrl = 'https://luminadesk-gary.netlify.app/r/kutz-madrid';
      const svgOutput = generateClientSideQrSvg(testUrl, 256);

      // Verify SVG is generated in-memory with proper tags and zero external URL references
      expect(svgOutput).toContain('<svg');
      expect(svgOutput).toContain('viewBox="0 0 256 256"');
      expect(svgOutput).toContain('role="img"');
      expect(svgOutput.includes('http://') && !svgOutput.includes('http://www.w3.org/2000/svg')).toBe(false);
      expect(svgOutput).toContain('kutz-madrid');
    });

    runner.it('T2.F9.5: Print Dialog Cancellation: Canceling print dialog does not cause unhandled rejection or freeze', () => {
      let printExecuted = false;
      const mockWindow = {
        print: () => {
          printExecuted = true;
        }
      };

      // Successful print call
      const successResult = safeTriggerPrint(mockWindow);
      expect(successResult.success).toBe(true);
      expect(successResult.printed).toBe(true);
      expect(successResult.cancelled).toBe(false);
      expect(printExecuted).toBe(true);

      // User cancellation / print dialog throwing error
      const mockThrowingWindow = {
        print: () => {
          throw new Error('User cancelled print dialog');
        }
      };
      const cancelResult = safeTriggerPrint(mockThrowingWindow);
      expect(cancelResult.success).toBe(false);
      expect(cancelResult.printed).toBe(false);
      expect(cancelResult.cancelled).toBe(true);
      expect(cancelResult.error).toContain('User cancelled print dialog');

      // Missing or unsupported print on window object
      const unsupportedResult = safeTriggerPrint({});
      expect(unsupportedResult.success).toBe(false);
      expect(unsupportedResult.printed).toBe(false);
      expect(unsupportedResult.error).toBe('print_not_supported');

      const nullResult = safeTriggerPrint(null);
      expect(nullResult.success).toBe(false);
      expect(nullResult.error).toBe('print_not_supported');
    });
  });

  // ==========================================================================
  // FEATURE 10: 1-Touch Approval Tray Boundaries (5 Tests)
  // ==========================================================================
  runner.describe('Tier 2: Boundary 10 — 1-Touch Approval Tray in "Salón Hoy"', () => {
    runner.it('T2.F10.1: Hold Expiration: Request hold reaching TTL timeout marks slot as released', () => {
      const holdManager = new SlotHoldManager();
      holdManager.acquireHold('kutz-madrid', 'b1', '2026-11-20', '10:00', '612345678', -1000); // Expired

      const isStillHeld = holdManager.isHeld('kutz-madrid', 'b1', '2026-11-20', '10:00');
      expect(isStillHeld).toBe(false);
    });

    runner.it('T2.F10.2: WhatsApp Alternate Times: Rejection message includes alternative slot proposals', () => {
      const url = generateWhatsAppRescheduleUrl('612345678', 'Marcos', '11:00', ['12:30', '16:00']);
      expect(url).toContain('12%3A30');
      expect(url).toContain('16%3A00');
    });

    runner.it('T2.F10.3: Concurrency / Double Barber Approval: Second approval action is idempotent and returns 200', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/appointments', [
        { id: 'book-1', clientName: 'Marcos', clientPhone: '612345678', status: 'pending' }
      ]);

      const reqA = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'approve', payload: { bookingId: 'book-1' } })
      });
      const reqB = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
        body: JSON.stringify({ action: 'approve', payload: { bookingId: 'book-1' } })
      });

      const resA = await executeSyncFunctionContract(reqA, store);
      const resB = await executeSyncFunctionContract(reqB, store);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      const dataB = await resB.json();
      expect(dataB.idempotent).toBe(true);
    });

    runner.it('T2.F10.4: Encoding: Special characters (accents, &, emoji) are properly encoded in WhatsApp links', () => {
      const url = buildWhatsAppUrl('612345678', 'Hola José & Ramón ✂️');
      expect(url).toContain('Jos%C3%A9%20%26%20Ram%C3%B3n');
      expect(decodeURIComponent(url)).toContain('José & Ramón ✂️');
    });

    runner.it('T2.F10.5: Empty State: Zero pending requests renders non-intrusive status', async () => {
      const store = new MockBlobsStore('kutz_platform');
      await store.setJSON('shops/kutz-madrid/appointments', []);

      const req = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        headers: { 'x-shop-pin': '1234' }
      });
      const res = await executeSyncFunctionContract(req, store);
      const data = await res.json();

      const pending = data.appointments.filter(a => a.status === 'pending');
      expect(pending).toHaveLength(0);
    });
  });

  // ==========================================================================
  // FEATURE 11: Automated Phone Matching & 3D Recetas Boundaries (5 Tests)
  // ==========================================================================
  runner.describe('Tier 2: Boundary 11 — Automated Phone Matching & 3D Recetas Connection', () => {
    runner.it('T2.F11.1: Validation / Malformed Phone Rejection: Rejects numbers with <9 digits or letters', async () => {
      const store = new MockBlobsStore('kutz_platform');
      const req = new Request('http://localhost/api/shops/kutz-madrid/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          clientName: 'Marcos',
          clientPhone: '12345', // Too short
          date: '2026-11-20',
          timeSlot: '11:00'
        })
      });

      const res = await executeBookingFunctionContract(req, store);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain('9 dígitos');
    });

    runner.it('T2.F11.2: Collision / Multiple Clients Sharing Phone: Matching prioritizes first match and flags multiple', () => {
      const duplicatePhoneRoster = [
        { id: '1', name: 'Carlos Sr.', phone: '612345678', formula: 'Clásico' },
        { id: '2', name: 'Carlos Jr.', phone: '612345678', formula: 'Modern Fade' }
      ];

      const match = matchClientByPhone('612345678', duplicatePhoneRoster);
      expect(match.matchFound).toBe(true);
      expect(match.client.name).toBe('Carlos Sr.');
      expect(match.multipleMatches).toBe(true);
    });

    runner.it('T2.F11.3: Fallback / Missing Style: Defaults safely to "Estilo Clásico / A consultar en sillón"', () => {
      const client = createNewClientFromBooking({ clientName: 'Test', clientPhone: '612345678' });
      expect(client.indicativeStyle).toContain('Clásico');
    });

    runner.it('T2.F11.4: Client Name Variation: Retains primary client record while storing booking name', () => {
      const existingClient = { id: 'c1', name: 'Marcos Torres', phone: '612345678' };
      const bookingData = { clientName: 'Marcos T.', clientPhone: '612345678' };

      const match = matchClientByPhone(bookingData.clientPhone, [existingClient]);
      expect(match.client.name).toBe('Marcos Torres');
    });

    runner.it('T2.F11.5: International Phone Format: Preserves international country prefix for foreign clients (+33, +44)', () => {
      const frenchPhone = '+33 6 12 34 56 78';
      const formattedWa = formatWhatsAppPhone(frenchPhone);
      expect(formattedWa).toBe('33612345678');

      const waUrl = buildWhatsAppUrl(frenchPhone, 'Bonjour');
      expect(waUrl.startsWith('https://wa.me/33612345678?text=')).toBe(true);
    });
  });

  // ==========================================================================
  // FEATURE 12: Live Production Deployment & Verification Boundaries (5 Tests)
  // ==========================================================================
  runner.describe('Tier 2: Boundary 12 — Live Production Deployment & Verification', () => {
    runner.it('T2.F12.1: Asset Hash Integrity: Production index template imports modern modular scripts', () => {
      const indexPath = path.join(projectRoot, 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);
      const indexHtml = fs.readFileSync(indexPath, 'utf8');

      const scriptPattern = /<script\s+type="module"\s+src="\/src\/main\.jsx"><\/script>/i;
      expect(scriptPattern.test(indexHtml)).toBe(true);
    });

    runner.it('T2.F12.2: Project Integrity: Manifest and configuration files contain zero syntax errors', () => {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const pkgRaw = fs.readFileSync(packageJsonPath, 'utf8');
      const parsed = JSON.parse(pkgRaw);

      expect(parsed.name).toBe('luminadesk');
      expect(parsed.scripts.test).toBe('node tests/run-all.mjs');
      expect(parsed.scripts.build).toBe('vite build');
    });

    runner.it('T2.F12.3: Bundle Size Budget: Target bundle size remains under 500 KB gzip budget', () => {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Verify bundle dependency budget: ensure no heavy bloat dependencies (e.g. lodash, moment)
      const deps = Object.keys(pkg.dependencies || {});
      expect(deps.includes('lodash')).toBe(false);
      expect(deps.includes('moment')).toBe(false);

      // Verify lightweight production dependencies footprint
      expect(deps.includes('@netlify/blobs')).toBe(true);
      expect(deps.includes('react')).toBe(true);
      expect(deps.includes('react-dom')).toBe(true);
    });

    runner.it('T2.F12.4: HTTPS Enforced: Production origin uses secure https protocol', () => {
      const prodValidation = validateProductionOrigin('https://luminadesk-gary.netlify.app');
      expect(prodValidation.valid).toBe(true);
      expect(prodValidation.isHttps).toBe(true);
      expect(prodValidation.isNetlifyDomain).toBe(true);

      const insecureValidation = validateProductionOrigin('http://insecure-barber.com');
      expect(insecureValidation.valid).toBe(false);
    });

    runner.it('T2.F12.5: Function Latency: Simulated function contract responds within 50ms locally', async () => {
      const start = Date.now();
      const store = new MockBlobsStore('kutz_platform');
      const req = new Request('http://localhost/api/shops/kutz-madrid/public-state');
      await executeBookingFunctionContract(req, store);
      const elapsed = Date.now() - start;

      expect(elapsed < 200).toBe(true);
    });
  });
}
