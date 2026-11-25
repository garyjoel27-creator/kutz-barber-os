/**
 * luminadesk/tests/block1_legal_security.test.mjs
 * Block 1 Legal, RGPD, ARSOPOL, Anti Brute-Force Rate Limiting, Audit Log,
 * VeriFactu Shield & Cloud Internal Cash Sync Verification Suite
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bookingHandler from '../netlify/functions/booking.js';
import syncHandler from '../netlify/functions/sync.js';
import {
  resetMemoryStore,
  getAuditLog,
  hashClientIp,
  setRateLimitState,
} from '../netlify/functions/lib/blobsClient.js';
import {
  mergeSyncedSales,
  SyncEngine,
  addToOutbox,
  getOutbox,
  flushOutbox,
} from '../src/lib/syncService.js';
import { expect } from './helpers/testHarness.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function registerBlock1LegalSecurityTests(runner) {
  runner.describe('Block 1 — Legal, RGPD, ARSOPOL, Security Anti Brute-Force & VeriFactu', () => {
    runner.it('B1.1: Booking POST without rgpdConsent or with acceptedPrivacy=false returns 422 rgpd_consent_required', async () => {
      resetMemoryStore();

      const missingApt = await bookingHandler(
        new Request('http://localhost/api/shops/kutz-madrid/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'appointment',
            clientName: 'Carlos Sin RGPD',
            clientPhone: '611223344',
            barberId: 'rex',
            serviceId: 'skin-fade',
            date: '2026-11-23',
            timeSlot: '11:00',
          }),
        }),
        { params: { shopSlug: 'kutz-madrid' } }
      );
      expect(missingApt.status).toBe(422);
      const missingData = await missingApt.json();
      expect(missingData.error).toBe('rgpd_consent_required');

      const falseWalkin = await bookingHandler(
        new Request('http://localhost/api/shops/kutz-madrid/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'walkin',
            clientName: 'Dani Walkin Sin RGPD',
            clientPhone: '622334455',
            rgpdConsent: { acceptedPrivacy: false, acceptedWhatsapp: true },
          }),
        }),
        { params: { shopSlug: 'kutz-madrid' } }
      );
      expect(falseWalkin.status).toBe(422);
      const falseData = await falseWalkin.json();
      expect(falseData.error).toBe('rgpd_consent_required');
    });

    runner.it('B1.2: Booking POST with valid rgpdConsent persists consent metadata on appointment', async () => {
      resetMemoryStore();
      const res = await bookingHandler(
        new Request('http://localhost/api/shops/kutz-madrid/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'appointment',
            clientName: 'Marcos RGPD',
            clientPhone: '611223344',
            barberId: 'rex',
            serviceId: 'skin-fade',
            date: '2026-11-23',
            timeSlot: '11:00',
            rgpdConsent: {
              acceptedPrivacy: true,
              acceptedWhatsapp: true,
              policyVersion: '2026.1',
            },
          }),
        }),
        { params: { shopSlug: 'kutz-madrid' } }
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.appointment.rgpdConsent.acceptedPrivacy).toBe(true);
      expect(data.appointment.rgpdConsent.acceptedWhatsapp).toBe(true);
      expect(data.appointment.rgpdConsent.policyVersion).toBe('2026.1');
    });

    runner.it('B1.3: PIN anti brute-force blocks after 5 failed attempts (429 + Retry-After 900) and resets on valid PIN', async () => {
      resetMemoryStore();
      // 3 wrong attempts + 1 valid PIN from IP A -> resets counter
      for (let i = 0; i < 3; i++) {
        const failRes = await syncHandler(
          new Request('http://localhost/api/shops/kutz-madrid/sync', {
            headers: { 'x-shop-pin': '9999', 'x-forwarded-for': '198.51.100.21' },
          }),
          { params: { shopSlug: 'kutz-madrid' } }
        );
        expect(failRes.status).toBe(401);
      }
      const validResetRes = await syncHandler(
        new Request('http://localhost/api/shops/kutz-madrid/sync', {
          headers: { 'x-shop-pin': '1234', 'x-forwarded-for': '198.51.100.21' },
        }),
        { params: { shopSlug: 'kutz-madrid' } }
      );
      expect(validResetRes.status).toBe(200);

      // 4 wrong attempts -> 401, 5th -> 429 lockout
      for (let i = 0; i < 4; i++) {
        const r = await syncHandler(
          new Request('http://localhost/api/shops/kutz-madrid/sync', {
            headers: { 'x-shop-pin': '0000', 'x-forwarded-for': '203.0.113.77' },
          }),
          { params: { shopSlug: 'kutz-madrid' } }
        );
        expect(r.status).toBe(401);
      }
      const fifth = await syncHandler(
        new Request('http://localhost/api/shops/kutz-madrid/sync', {
          headers: { 'x-shop-pin': '0000', 'x-forwarded-for': '203.0.113.77' },
        }),
        { params: { shopSlug: 'kutz-madrid' } }
      );
      expect(fifth.status).toBe(429);
      expect(fifth.headers.get('Retry-After')).toBe('900');
      const body = await fifth.json();
      expect(body.error).toBe('too_many_attempts');

      // Even valid PIN from locked IP remains blocked 429
      const stillBlocked = await syncHandler(
        new Request('http://localhost/api/shops/kutz-madrid/sync', {
          headers: { 'x-shop-pin': '1234', 'x-forwarded-for': '203.0.113.77' },
        }),
        { params: { shopSlug: 'kutz-madrid' } }
      );
      expect(stillBlocked.status).toBe(429);

      // Regression: once 15-min lockout expires (blockedUntil <= now), 1 wrong PIN must return 401 with 4 remaining attempts (NOT immediate 429 re-lockout!)
      const expiredIpReq = new Request('http://localhost/api/shops/kutz-madrid/sync', {
        headers: { 'x-shop-pin': '0000', 'x-forwarded-for': '203.0.113.77' },
      });
      const ipHash = hashClientIp(expiredIpReq);
      await setRateLimitState('kutz-madrid', ipHash, {
        attempts: 5,
        blockedUntil: Date.now() - 1000,
        updatedAt: Date.now() - 901000,
      });
      const postExpiryWrong = await syncHandler(expiredIpReq, { params: { shopSlug: 'kutz-madrid' } });
      expect(postExpiryWrong.status).toBe(401);
      const postExpiryBody = await postExpiryWrong.json();
      expect(postExpiryBody.remainingAttempts).toBe(4);
    });

    runner.it('B1.3b: SyncEngine pauses on missing/401/429 PIN and flushOutbox preserves items on 401/429 without self-lockout', async () => {
      const storeMap = new Map();
      const storage = {
        getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
        setItem: (k, v) => storeMap.set(k, String(v)),
        removeItem: (k) => storeMap.delete(k),
      };

      // 1. Empty PIN must emit auth=true without calling fetch
      let fetchCalls = 0;
      const engineNoPin = new SyncEngine({
        shopSlug: 'kutz-madrid',
        pin: '',
        storage,
        fetch: async () => {
          fetchCalls++;
          return { ok: false, status: 401 };
        },
      });
      let authEmitted = false;
      engineNoPin.on('auth', (v) => { authEmitted = v; });
      await engineNoPin.forceSync();
      expect(fetchCalls).toBe(0);
      expect(authEmitted).toBe(true);
      expect(engineNoPin.authPaused).toBe(true);
      engineNoPin.destroy();

      // 2. flushOutbox halts immediately on 429 without incrementing retryCount or dropping items
      addToOutbox('kutz-madrid', 'record_sale', { id: 's1' }, storage);
      addToOutbox('kutz-madrid', 'record_sale', { id: 's2' }, storage);
      let flushCalls = 0;
      const flushRes = await flushOutbox(
        'kutz-madrid',
        '1234',
        async () => {
          flushCalls++;
          return { ok: false, status: 429 };
        },
        storage
      );
      expect(flushCalls).toBe(1);
      expect(flushRes.remaining).toBe(2);
      const outbox = getOutbox('kutz-madrid', storage);
      expect(outbox.length).toBe(2);
      expect(outbox[0].retryCount).toBe(0);
    });

    runner.it('B1.4: RGPD Audit Log captures sensitive mutations and pin_lockout without plaintext PINs', async () => {
      resetMemoryStore();
      await syncHandler(
        new Request('http://localhost/api/shops/kutz-madrid/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
          body: JSON.stringify({
            action: 'upsert_client',
            payload: { client: { id: 'c-audit-1', name: 'Audit Client', consent: { signed: true } } },
          }),
        }),
        { params: { shopSlug: 'kutz-madrid' } }
      );
      await syncHandler(
        new Request('http://localhost/api/shops/kutz-madrid/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
          body: JSON.stringify({ action: 'delete_client', payload: { clientId: 'c-audit-1' } }),
        }),
        { params: { shopSlug: 'kutz-madrid' } }
      );
      await syncHandler(
        new Request('http://localhost/api/shops/kutz-madrid/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
          body: JSON.stringify({ action: 'update_shop_schedule', payload: { walkInOpen: false } }),
        }),
        { params: { shopSlug: 'kutz-madrid' } }
      );

      const audit = await getAuditLog('kutz-madrid');
      expect(audit.some((e) => e.action === 'upsert_client')).toBe(true);
      expect(audit.some((e) => e.action === 'delete_client')).toBe(true);
      expect(audit.some((e) => e.action === 'update_shop_schedule')).toBe(true);
      expect(JSON.stringify(audit).includes('1234')).toBe(false);
    });

    runner.it('B1.5: Cloud sync for internal cash (record_sale + GET /sync dailySales + mergeSyncedSales)', async () => {
      resetMemoryStore();
      const postSale = await syncHandler(
        new Request('http://localhost/api/shops/kutz-madrid/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-shop-pin': '1234' },
          body: JSON.stringify({
            action: 'record_sale',
            payload: { sale: { id: 'sale-kutz-1', barber: 'REX', amount: 25, method: 'cash', timestamp: 1763500001000 } },
          }),
        }),
        { params: { shopSlug: 'kutz-madrid' } }
      );
      expect(postSale.status).toBe(200);

      const getSync = await syncHandler(
        new Request('http://localhost/api/shops/kutz-madrid/sync', {
          headers: { 'x-shop-pin': '1234' },
        }),
        { params: { shopSlug: 'kutz-madrid' } }
      );
      const data = await getSync.json();
      expect(Array.isArray(data.dailySales)).toBe(true);
      expect(data.dailySales.length).toBe(1);
      expect(data.dailySales[0].id).toBe('sale-kutz-1');

      const merged = mergeSyncedSales(data.dailySales, [
        { id: 'sale-local-2', barber: 'KIKO', amount: 30, timestamp: 1763500005000 },
      ]);
      expect(merged.length).toBe(2);
      expect(merged[0].id).toBe('sale-local-2');
    });

    runner.it('B1.6: UI Legal Hub, VeriFactu shield, ARSOPOL panel, unchecked RGPD checkboxes, clean URLs & pure barbershop layout', () => {
      const pub = fs.readFileSync(path.join(rootDir, 'src/pages/PublicBookingView.jsx'), 'utf8');
      const rgpd = fs.readFileSync(path.join(rootDir, 'src/components/RGPDConsentModal.jsx'), 'utf8');
      const profile = fs.readFileSync(path.join(rootDir, 'src/pages/ClientProfile.jsx'), 'utf8');
      const dash = fs.readFileSync(path.join(rootDir, 'src/pages/Dashboard.jsx'), 'utf8');
      const legal = fs.readFileSync(path.join(rootDir, 'src/components/LegalComplianceModal.jsx'), 'utf8');
      const admin = fs.readFileSync(path.join(rootDir, 'src/components/SuperAdminManager.jsx'), 'utf8');
      const sigPad = fs.readFileSync(path.join(rootDir, 'src/components/SignaturePad.jsx'), 'utf8');

      expect(pub.includes('Art. 13 RGPD')).toBe(true);
      expect(pub.includes('useState(false)')).toBe(true);
      expect(pub.includes('publicOnly={true}')).toBe(true);
      expect(rgpd.includes('treatment: false')).toBe(true);
      expect(rgpd.includes('photosPrivate: false')).toBe(true);
      expect(rgpd.includes('photosMarketing: false')).toBe(true);
      expect(rgpd.includes('communications: false')).toBe(true);
      expect(rgpd.includes('onClear={')).toBe(true);
      expect(sigPad.includes('lastEmittedRef')).toBe(true);
      expect(profile.includes('Privacidad &amp; Derechos ARSOPOL')).toBe(true);
      expect(profile.includes('-datos-rgpd.json')).toBe(true);
      expect(profile.includes('Revocar permisos opcionales')).toBe(true);
      expect(profile.includes('Derecho de Supresión')).toBe(true);
      expect(dash.includes('No válido como ticket fiscal ni factura (VeriFactu)')).toBe(true);
      expect(legal.includes('DPA-Art28-')).toBe(true);
      expect(admin.includes('&pin=')).toBe(false);
    });
  });
}
