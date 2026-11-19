/**
 * tests/m2_multishop_superadmin.test.mjs
 * Milestone 2: Multi-Shop Architecture & Super-Admin Management Test Suite
 * 
 * Verifies:
 * - 4-tier tenant resolution cascade (path -> query -> localStorage -> fallback)
 * - Pure slug normalization, name sanitization, and tenant schema validation
 * - SyncEngine dynamic shop switching (switchShop) and tenant isolation
 * - Offline-first tenant provisioning and 1-click status toggling (active <-> paused)
 * - Serverless admin endpoint authentication and CRUD operations with master keys
 * - App.jsx routing preservation and layout compliance
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from './helpers/testHarness.mjs';
import {
  DEFAULT_SHOP_SLUG,
  DEFAULT_SHOP_CONFIG,
  SHOP_REX_CONFIG,
  normalizeShopSlug,
  sanitizeShopName,
  validateTenantConfig,
  resolveTenantSlug,
  buildCustomerPortalUrl,
  buildBarberHubUrl,
  isPublicBookingPath
} from '../src/lib/shopUtils.js';

import {
  SyncEngine,
  fetchAdminShops,
  provisionShop,
  updateShopStatus,
  updateShopConfig,
  getLocalShopsIndex,
  saveLocalShopsIndex,
  getShopStorageKeys,
  SYNC_STATUS
} from '../src/lib/syncService.js';

import adminHandler from '../netlify/functions/admin.js';
import { resetMemoryStore, getShopsIndex, getShopConfig } from '../netlify/functions/lib/blobsClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function createMockStorage(initialData = {}) {
  const store = new Map();
  for (const [k, v] of Object.entries(initialData)) {
    store.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
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
    },
    _raw() {
      return store;
    }
  };
}

export function registerM2MultiShopTests(runner) {
  // ==========================================================================
  // SUITE 1: Pure Utilities & 4-Tier Slug Resolution Cascade
  // ==========================================================================
  runner.describe('Milestone 2 — Pure Utilities & Slug Resolution Cascade', () => {
    runner.it('M2.1.1: normalizeShopSlug standardizes diacritics, whitespace, and special characters', () => {
      expect(normalizeShopSlug('  Barbería Los Andes #1!  ')).toBe('barberia-los-andes-1');
      expect(normalizeShopSlug('KÜTZ // BÄRBER OS')).toBe('kutz-barber-os');
      expect(normalizeShopSlug('---shop---slug---')).toBe('shop-slug');
      expect(normalizeShopSlug('')).toBe('');
      expect(normalizeShopSlug(null)).toBe('');
    });

    runner.it('M2.1.2: sanitizeShopName strips malicious HTML and script tags', () => {
      expect(sanitizeShopName('Barbería <script>alert(1)</script>Rex')).toBe('Barbería alert(1)Rex');
      expect(sanitizeShopName('<b>KUTZ</b> Central')).toBe('KUTZ Central');
      expect(sanitizeShopName('')).toBe('');
    });

    runner.it('M2.1.3: validateTenantConfig validates full schema requirements', () => {
      const valid = validateTenantConfig({
        slug: 'barberia-centro',
        name: 'Barbería Centro',
        pin: '4321',
        barbers: [{ id: 'b1', name: 'Pepe' }],
        services: [{ id: 's1', name: 'Corte', price: 15 }]
      });
      expect(valid.valid).toBe(true);

      // Rejects non-object
      expect(validateTenantConfig(null).valid).toBe(false);

      // Rejects slug > 64 chars
      const tooLong = validateTenantConfig({
        slug: 'a'.repeat(65),
        name: 'Test',
        pin: '1234',
        barbers: [{ id: 'b1' }],
        services: [{ id: 's1' }]
      });
      expect(tooLong.valid).toBe(false);
      expect(tooLong.code).toBe('ERR_SLUG_TOO_LONG');

      // Rejects non-4-digit PIN
      expect(validateTenantConfig({
        slug: 'valid-slug',
        name: 'Valid Name',
        pin: '12',
        barbers: [{ id: 'b1' }],
        services: [{ id: 's1' }]
      }).valid).toBe(false);

      // Rejects empty barbers
      expect(validateTenantConfig({
        slug: 'valid-slug',
        name: 'Valid Name',
        pin: '1234',
        barbers: [],
        services: [{ id: 's1' }]
      }).valid).toBe(false);

      // Rejects empty services
      expect(validateTenantConfig({
        slug: 'valid-slug',
        name: 'Valid Name',
        pin: '1234',
        barbers: [{ id: 'b1' }],
        services: []
      }).valid).toBe(false);
    });

    runner.it('M2.1.4: resolveTenantSlug executes 4-tier resolution cascade correctly', () => {
      const storage = createMockStorage({ kutz_active_shop_slug: 'stored-shop' });

      // Tier 1: Path /r/:shopSlug wins over everything
      expect(resolveTenantSlug({ pathname: '/r/barberia-rex', search: '?shop=query-shop' }, storage)).toBe('barberia-rex');
      expect(resolveTenantSlug('/r/barber%C3%ADa-valencia?shop=other', storage)).toBe('barberia-valencia');

      // Tier 2: Query param ?shop=slug wins over storage
      expect(resolveTenantSlug({ pathname: '/', search: '?shop=barberia-rex' }, storage)).toBe('barberia-rex');
      expect(resolveTenantSlug({ pathname: '/dashboard', search: '?shopSlug=barberia-rex' }, storage)).toBe('barberia-rex');

      // Tier 3: LocalStorage kutz_active_shop_slug wins over fallback
      expect(resolveTenantSlug({ pathname: '/', search: '' }, storage)).toBe('stored-shop');

      // Tier 4: Fallback to kutz-madrid when all sources empty
      const emptyStorage = createMockStorage();
      expect(resolveTenantSlug({ pathname: '/', search: '' }, emptyStorage)).toBe(DEFAULT_SHOP_SLUG);
      expect(resolveTenantSlug(null, emptyStorage)).toBe(DEFAULT_SHOP_SLUG);
    });

    runner.it('M2.1.5: URL construction helpers generate canonical links', () => {
      expect(buildCustomerPortalUrl('https://luminadesk-gary.netlify.app', 'barberia-rex')).toBe('https://luminadesk-gary.netlify.app/r/barberia-rex');
      expect(buildCustomerPortalUrl('', 'kutz-madrid')).toBe('https://luminadesk-gary.netlify.app/r/kutz-madrid');
      expect(buildBarberHubUrl('barberia-rex')).toBe('/?shop=barberia-rex');
      expect(buildBarberHubUrl('barberia-rex', 'https://luminadesk-gary.netlify.app')).toBe('https://luminadesk-gary.netlify.app/?shop=barberia-rex');
    });

    runner.it('M2.1.6: isPublicBookingPath distinguishes customer routes from internal barber views', () => {
      expect(isPublicBookingPath('/reservar')).toBe(true);
      expect(isPublicBookingPath('/r/kutz-madrid')).toBe(true);
      expect(isPublicBookingPath('/r/barberia-rex')).toBe(true);
      expect(isPublicBookingPath('/')).toBe(false);
      expect(isPublicBookingPath('/dashboard')).toBe(false);
      expect(isPublicBookingPath('/clients')).toBe(false);
      expect(isPublicBookingPath('/admin')).toBe(false);
      expect(isPublicBookingPath('/r/../admin')).toBe(false);
    });
  });

  // ==========================================================================
  // SUITE 2: Multi-Tenant Data Isolation & SyncEngine Tenant Switching
  // ==========================================================================
  runner.describe('Milestone 2 — Multi-Tenant Storage Partitioning & SyncEngine Switching', () => {
    runner.it('M2.2.1: Generates segregated storage keys per tenant slug', () => {
      const keysA = getShopStorageKeys('kutz-madrid');
      const keysB = getShopStorageKeys('barberia-rex');

      expect(keysA.CONFIG).toBe('kutz_kutz-madrid_config');
      expect(keysB.CONFIG).toBe('kutz_barberia-rex_config');
      expect(keysA.OUTBOX).toBe('kutz_kutz-madrid_outbox');
      expect(keysB.OUTBOX).toBe('kutz_barberia-rex_outbox');
      expect(keysA.CONFIG === keysB.CONFIG).toBe(false);
    });

    runner.it('M2.2.2: SyncEngine.switchShop dynamically transitions to new tenant', async () => {
      const storage = createMockStorage();
      const engine = new SyncEngine({
        shopSlug: 'kutz-madrid',
        pin: '1234',
        storage,
        intervalMs: 100000
      });

      expect(engine.shopSlug).toBe('kutz-madrid');
      expect(engine.pin).toBe('1234');

      // Switch to barberia-rex
      engine.switchShop('barberia-rex', '7890');
      expect(engine.shopSlug).toBe('barberia-rex');
      expect(engine.pin).toBe('7890');

      engine.destroy();
    });

    runner.it('M2.2.3: getLocalShopsIndex auto-seeds default fixtures if storage is empty', () => {
      const storage = createMockStorage();
      const list = getLocalShopsIndex(storage);

      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list[0].slug).toBe('kutz-madrid');
      expect(list[1].slug).toBe('barberia-rex');

      // Verify that configurations were written to storage
      expect(storage.getItem('kutz_kutz-madrid_config')).toBeDefined();
      expect(storage.getItem('kutz_barberia-rex_config')).toBeDefined();
    });
  });

  // ==========================================================================
  // SUITE 3: Tenant Provisioning & 1-Click Status Toggling
  // ==========================================================================
  runner.describe('Milestone 2 — Tenant Provisioning & 1-Click Status Toggling', () => {
    runner.it('M2.3.1: provisionShop creates new shop with local offline fallback', async () => {
      const storage = createMockStorage();
      const newShop = {
        slug: 'barberia-triana',
        name: 'Barbería Triana',
        pin: '5555',
        phone: '654321987',
        address: 'Calle Betis 10, Sevilla',
        barbers: [{ id: 'b1', name: 'Manolo', role: 'Barbero' }],
        services: [{ id: 's1', name: 'Corte', durationMinutes: 30, price: 18 }]
      };

      const result = await provisionShop(newShop, 'kutz-superadmin-2026', { storage });
      expect(result.success).toBe(true);
      expect(result.slug).toBe('barberia-triana');

      // Verify updated index
      const index = getLocalShopsIndex(storage);
      const found = index.find(s => s.slug === 'barberia-triana');
      expect(found).toBeDefined();
      expect(found.name).toBe('Barbería Triana');

      // Verify isolated collections initialized
      expect(storage.getItem('kutz_barberia-triana_config')).toBeDefined();
      expect(storage.getItem('kutz_barberia-triana_appointments')).toBe('[]');
    });

    runner.it('M2.3.2: provisionShop rejects duplicate slug collision', async () => {
      const storage = createMockStorage();
      const shop1 = {
        slug: 'barberia-malaga',
        name: 'Barbería Málaga 1',
        pin: '1111',
        barbers: [{ id: 'b1' }],
        services: [{ id: 's1' }]
      };

      const res1 = await provisionShop(shop1, 'kutz-superadmin-2026', { storage });
      expect(res1.success).toBe(true);

      // Attempt duplicate slug
      const shop2 = {
        slug: 'barberia-malaga',
        name: 'Barbería Málaga 2',
        pin: '2222',
        barbers: [{ id: 'b1' }],
        services: [{ id: 's1' }]
      };
      const res2 = await provisionShop(shop2, 'kutz-superadmin-2026', { storage });
      expect(res2.success).toBe(false);
      expect(res2.status).toBe(409);
      expect(res2.error.toLowerCase()).toContain('ya existe');
    });

    runner.it('M2.3.3: updateShopStatus performs 1-click status toggling', async () => {
      const storage = createMockStorage();
      getLocalShopsIndex(storage); // seed defaults

      // Pause barberia-rex
      const resPause = await updateShopStatus('barberia-rex', 'paused', 'kutz-superadmin-2026', { storage });
      expect(resPause.success).toBe(true);
      expect(resPause.status).toBe('paused');

      const indexPaused = getLocalShopsIndex(storage);
      const rexPaused = indexPaused.find(s => s.slug === 'barberia-rex');
      expect(rexPaused.status).toBe('paused');

      // Re-activate barberia-rex
      const resActive = await updateShopStatus('barberia-rex', 'active', 'kutz-superadmin-2026', { storage });
      expect(resActive.success).toBe(true);
      expect(resActive.status).toBe('active');

      const indexActive = getLocalShopsIndex(storage);
      const rexActive = indexActive.find(s => s.slug === 'barberia-rex');
      expect(rexActive.status).toBe('active');
    });
  });

  // ==========================================================================
  // SUITE 4: Netlify Functions Admin Serverless Endpoints
  // ==========================================================================
  runner.describe('Milestone 2 — Netlify Functions Admin Serverless API', () => {
    runner.it('M2.4.1: Admin endpoints authenticate via kutz-superadmin-2026, kutz-master-secret-2026, and kutz-super-admin-2026', async () => {
      resetMemoryStore();

      const validKeys = [
        'kutz-superadmin-2026',
        'kutz-master-secret-2026',
        'kutz-super-admin-2026'
      ];

      for (const key of validKeys) {
        const req = new Request('http://localhost/api/admin/shops', {
          headers: { 'x-admin-key': key }
        });
        const res = await adminHandler(req, {});
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
      }

      // Rejects invalid key
      const badReq = new Request('http://localhost/api/admin/shops', {
        headers: { 'x-admin-key': 'invalid-secret' }
      });
      const badRes = await adminHandler(badReq, {});
      expect(badRes.status).toBe(401);
    });

    runner.it('M2.4.2: POST /api/admin/shops provisions tenant in Netlify Blobs with slug response', async () => {
      resetMemoryStore();

      const newShop = {
        slug: 'barberia-zaragoza',
        name: 'Barbería Zaragoza',
        pin: '9876',
        address: 'Paseo Independencia 5',
        phone: '611223344',
        barbers: [{ id: 'b1', name: 'Javier' }],
        services: [{ id: 's1', name: 'Fade', price: 20 }]
      };

      const req = new Request('http://localhost/api/admin/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'kutz-master-secret-2026'
        },
        body: JSON.stringify(newShop)
      });

      const res = await adminHandler(req, {});
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.slug).toBe('barberia-zaragoza');

      const config = await getShopConfig('barberia-zaragoza');
      expect(config).toBeDefined();
      expect(config.name).toBe('Barbería Zaragoza');
    });

    runner.it('M2.4.3: PATCH /api/admin/shops/:shopSlug/status supports 1-click status update', async () => {
      resetMemoryStore();

      // Ensure barberia-rex exists
      const newShop = {
        slug: 'barberia-albacete',
        name: 'Barbería Albacete',
        pin: '4444',
        barbers: [{ id: 'b1' }],
        services: [{ id: 's1' }]
      };
      await adminHandler(new Request('http://localhost/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': 'kutz-superadmin-2026' },
        body: JSON.stringify(newShop)
      }), {});

      // Patch status to paused
      const patchReq = new Request('http://localhost/api/admin/shops/barberia-albacete/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'kutz-superadmin-2026'
        },
        body: JSON.stringify({ status: 'paused' })
      });

      const res = await adminHandler(patchReq, { params: { shopSlug: 'barberia-albacete' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.shop.status).toBe('paused');

      const saved = await getShopConfig('barberia-albacete');
      expect(saved.status).toBe('paused');
    });
  });

  // ==========================================================================
  // SUITE 5: App Routing & Layout Integration Guard
  // ==========================================================================
  runner.describe('Milestone 2 — App Routing & Layout Integration Guard', () => {
    runner.it('M2.5.1: App.jsx preserves all required regex targets verbatim', () => {
      const appPath = path.resolve(projectRoot, 'src/App.jsx');
      const content = fs.readFileSync(appPath, 'utf8');

      expect(content).toMatch(/path=["']dashboard["']/);
      expect(content).toMatch(/path=["']clients["']/);
      expect(content).toMatch(/path=["']clients\/:id["']/);
      expect(content).toMatch(/path=["']\*["']/);
      expect(content).toMatch(/Navigate/);
    });

    runner.it('M2.5.2: App.jsx defines standalone routes for /reservar, /r/:shopSlug, and /admin', () => {
      const appPath = path.resolve(projectRoot, 'src/App.jsx');
      const content = fs.readFileSync(appPath, 'utf8');

      expect(content).toMatch(/path=["']\/reservar["']/);
      expect(content).toMatch(/path=["']\/r\/:shopSlug["']/);
      expect(content).toMatch(/path=["']\/admin["']/);
      expect(content).toContain('ShopProvider');
    });

    runner.it('M2.5.3: Layout.jsx integrates SuperAdminModal and active tenant pill', () => {
      const layoutPath = path.resolve(projectRoot, 'src/components/Layout.jsx');
      const content = fs.readFileSync(layoutPath, 'utf8');

      expect(content).toContain('SuperAdminModal');
      expect(content).toContain('useShop');
      expect(content).toContain('openSuperAdmin');
    });
  });
}
