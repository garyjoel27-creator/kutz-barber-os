import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  DEFAULT_SHOP_SLUG,
  DEFAULT_SHOP_CONFIG,
  SHOP_REX_CONFIG,
  SHOP_JOSEH_CONFIG,
  normalizeShopSlug,
  validateTenantConfig,
  resolveTenantSlug,
  isPublicBookingPath
} from '../lib/shopUtils';
import {
  SyncEngine,
  fetchAdminShops,
  provisionShop,
  updateShopStatus as apiUpdateShopStatus,
  updateShopConfig as apiUpdateShopConfig,
  getLocalShopsIndex,
  getEffectiveStorage,
  SYNC_STATUS
} from '../lib/syncService';

export const ShopContext = createContext(null);

export function ShopProvider({ children, initialSlug = null, customStorage = null, customFetch = null }) {
  // Safe location extraction (supports router or standalone environment)
  let routerLocation = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    routerLocation = useLocation();
  } catch {
    if (typeof window !== 'undefined') {
      routerLocation = window.location;
    }
  }

  const storage = useMemo(() => getEffectiveStorage(customStorage), [customStorage]);

  // Determine initial active shop slug through the 4-tier cascade
  const initialResolvedSlug = useMemo(() => {
    if (initialSlug) return normalizeShopSlug(initialSlug);
    return resolveTenantSlug(routerLocation, storage);
  }, [initialSlug, routerLocation, storage]);

  const [activeShopSlug, setActiveShopSlug] = useState(initialResolvedSlug);
  const [activeShop, setActiveShop] = useState(() => {
    try {
      const raw = storage.getItem(`kutz_${initialResolvedSlug}_config`);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    if (initialResolvedSlug === SHOP_REX_CONFIG.slug) return SHOP_REX_CONFIG;
    if (initialResolvedSlug === SHOP_JOSEH_CONFIG.slug) return SHOP_JOSEH_CONFIG;
    return DEFAULT_SHOP_CONFIG;
  });

  const [shopsList, setShopsList] = useState(() => getLocalShopsIndex(storage));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSuperAdminOpen, setIsSuperAdminOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.IDLE);
  const [outboxCount, setOutboxCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [needsPinSync, setNeedsPinSync] = useState(false);

  const isPublicRoute = useMemo(() => {
    const pathname = routerLocation?.pathname || (typeof window !== 'undefined' ? window.location?.pathname : '');
    return isPublicBookingPath(pathname);
  }, [routerLocation?.pathname]);

  // Resolve persisted verified PIN for current tenant (never on public customer booking routes)
  const resolvedPin = useMemo(() => {
    if (isPublicRoute) return '';
    try {
      const search = routerLocation?.search || (typeof window !== 'undefined' ? window.location.search : '');
      if (search) {
        const params = new URLSearchParams(search);
        const urlPin = params.get('pin');
        if (urlPin && /^\d{4}$/.test(urlPin)) {
          storage.setItem(`kutz_${activeShopSlug}_verified_pin`, urlPin);
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            params.delete('pin');
            const cleanQuery = params.toString();
            const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash || ''}`;
            window.history.replaceState({}, '', cleanUrl);
          }
          return urlPin;
        }
      }
      const savedPin = storage.getItem(`kutz_${activeShopSlug}_verified_pin`);
      if (savedPin && /^\d{4}$/.test(savedPin)) return savedPin;
    } catch {
      // ignore
    }
    return activeShop?.pin || '';
  }, [isPublicRoute, activeShopSlug, activeShop?.pin, routerLocation?.search, storage]);

  const isPaused = useMemo(() => {
    return String(activeShop?.status || '').toLowerCase() === 'paused';
  }, [activeShop]);

  // Sync engine reference for current active tenant
  const syncEngineRef = useRef(null);

  // Hydrate shop public config (name, barbers, services, schedule) from Netlify Blobs on any new device
  useEffect(() => {
    if (!activeShopSlug || typeof fetch === 'undefined') return;
    let cancelled = false;
    fetch(`/api/shops/${encodeURIComponent(activeShopSlug)}/public-state`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data };
      })
      .then(({ ok, status, data }) => {
        if (cancelled) return;
        if ((status === 403 || status === 404) && (data?.paused || data?.error === 'shop_inactive')) {
          setActiveShop((prev) => ({
            ...(prev || {}),
            ...(data?.shop || {}),
            slug: activeShopSlug,
            status: 'paused'
          }));
          return;
        }
        if (!ok || !data || !data.success || !data.shop) return;
        setActiveShop((prev) => {
          const merged = { ...(prev || {}), ...data.shop, slug: activeShopSlug };
          if (isPublicRoute) {
            delete merged.pin;
          }
          try {
            storage.setItem(`kutz_${activeShopSlug}_config`, JSON.stringify(merged));
          } catch {
            // ignore
          }
          return merged;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeShopSlug, isPublicRoute, storage]);

  // Initialize and attach SyncEngine ONLY on private barber routes (NEVER on /r/:shopSlug or /reservar)
  useEffect(() => {
    if (isPublicRoute) {
      if (syncEngineRef.current) {
        syncEngineRef.current.destroy();
        syncEngineRef.current = null;
      }
      return;
    }

    const engine = new SyncEngine({
      shopSlug: activeShopSlug,
      pin: resolvedPin || activeShop?.pin || '',
      storage,
      fetch: customFetch
    });
    syncEngineRef.current = engine;

    const unsubs = [
      engine.on('status', (st) => setSyncStatus(st)),
      engine.on('auth', (req) => setNeedsPinSync(Boolean(req))),
      engine.on('outbox', (outbox) => setOutboxCount(Array.isArray(outbox) ? outbox.length : 0)),
      engine.on('data', (data) => {
        if (data && data.config) {
          setActiveShop((prev) => ({
            ...(prev || {}),
            ...data.config,
            pin: data.config.pin || prev?.pin || resolvedPin || ''
          }));
        }
        setLastSyncTime(Date.now());
      }),
      engine.on('error', (err) => {
        setError(err?.message || 'Error de sincronización');
      })
    ];

    engine.start();

    return () => {
      unsubs.forEach((unsub) => unsub());
      engine.destroy();
      syncEngineRef.current = null;
    };
  }, [isPublicRoute, activeShopSlug, resolvedPin, activeShop?.pin, storage, customFetch]);

  // Load shop config whenever activeShopSlug changes
  const loadShopConfig = useCallback((slug) => {
    const cleanSlug = normalizeShopSlug(slug);
    try {
      const raw = storage.getItem(`kutz_${cleanSlug}_config`);
      if (raw) {
        const parsed = JSON.parse(raw);
        setActiveShop(parsed);
        return parsed;
      }
    } catch {
      // ignore
    }
    if (cleanSlug === SHOP_REX_CONFIG.slug) {
      setActiveShop(SHOP_REX_CONFIG);
      return SHOP_REX_CONFIG;
    }
    if (cleanSlug === SHOP_JOSEH_CONFIG.slug) {
      setActiveShop(SHOP_JOSEH_CONFIG);
      return SHOP_JOSEH_CONFIG;
    }
    setActiveShop(DEFAULT_SHOP_CONFIG);
    return DEFAULT_SHOP_CONFIG;
  }, [storage]);

  // Switch active shop tenant
  const switchShop = useCallback((rawSlug, pin = null) => {
    const cleanSlug = normalizeShopSlug(rawSlug) || DEFAULT_SHOP_SLUG;
    if (cleanSlug === activeShopSlug) return;

    setActiveShopSlug(cleanSlug);
    try {
      storage.setItem('kutz_active_shop_slug', cleanSlug);
    } catch {
      // ignore storage error
    }

    const cfg = loadShopConfig(cleanSlug);
    if (syncEngineRef.current) {
      syncEngineRef.current.switchShop(cleanSlug, pin || cfg?.pin || '');
    }
  }, [activeShopSlug, storage, loadShopConfig]);

  // Synchronize activeShopSlug when URL path (/r/:slug) or query (?shop=:slug) changes
  useEffect(() => {
    const pathname = routerLocation?.pathname || (typeof window !== 'undefined' ? window.location?.pathname : '');
    const search = routerLocation?.search || (typeof window !== 'undefined' ? window.location?.search : '');
    const hasExplicitUrlTenant = /^\/r\/[^/?#]+/i.test(pathname || '') || /[?&](shop|shopSlug)=/i.test(search || '');
    if (hasExplicitUrlTenant && initialResolvedSlug && initialResolvedSlug !== activeShopSlug) {
      setActiveShopSlug(initialResolvedSlug);
      try {
        storage.setItem('kutz_active_shop_slug', initialResolvedSlug);
      } catch {
        // ignore
      }
      loadShopConfig(initialResolvedSlug);
    }
  }, [initialResolvedSlug, activeShopSlug, routerLocation?.pathname, routerLocation?.search, storage, loadShopConfig]);

  // Refresh shops list from serverless backend or local fallback
  const refreshShops = useCallback(async (adminKey = 'kutz-superadmin-2026') => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminShops(adminKey, { storage, fetch: customFetch });
      if (res.success && Array.isArray(res.shops)) {
        setShopsList(res.shops);
      }
      return res.shops;
    } catch (err) {
      setError(err?.message || 'Error al listar barberías');
      const fallbackList = getLocalShopsIndex(storage);
      setShopsList(fallbackList);
      return fallbackList;
    } finally {
      setIsLoading(false);
    }
  }, [storage, customFetch]);

  // Provision new tenant
  const createShop = useCallback(async (shopData, adminKey = 'kutz-superadmin-2026') => {
    setError(null);
    const validation = validateTenantConfig(shopData);
    if (!validation.valid) {
      setError(validation.error);
      return { success: false, error: validation.error };
    }

    setIsLoading(true);
    try {
      const result = await provisionShop(shopData, adminKey, { storage, fetch: customFetch });
      if (!result.success) {
        setError(result.error);
        return result;
      }
      await refreshShops(adminKey);
      return result;
    } catch (err) {
      const msg = err?.message || 'Error al crear barbería';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  }, [storage, customFetch, refreshShops]);

  // 1-Click status toggle
  const toggleShopStatus = useCallback(async (slug, adminKey = 'kutz-superadmin-2026') => {
    const cleanSlug = normalizeShopSlug(slug);
    const current = shopsList.find((s) => s.slug === cleanSlug) || (cleanSlug === activeShopSlug ? activeShop : null);
    const currentStatus = String(current?.status || '').toLowerCase();
    const newStatus = currentStatus === 'paused' ? 'active' : 'paused';

    // Optimistic UI update
    setShopsList((prev) =>
      prev.map((s) => (s.slug === cleanSlug ? { ...s, status: newStatus } : s))
    );
    if (cleanSlug === activeShopSlug) {
      setActiveShop((prev) => (prev ? { ...prev, status: newStatus } : prev));
    }

    try {
      const res = await apiUpdateShopStatus(cleanSlug, newStatus, adminKey, { storage, fetch: customFetch });
      return res;
    } catch (err) {
      // Revert optimistic update on hard error
      setShopsList((prev) =>
        prev.map((s) => (s.slug === cleanSlug ? { ...s, status: currentStatus } : s))
      );
      if (cleanSlug === activeShopSlug) {
        setActiveShop((prev) => (prev ? { ...prev, status: currentStatus } : prev));
      }
      setError(err?.message || 'Error al cambiar estado de barbería');
      return { success: false, error: err?.message };
    }
  }, [shopsList, activeShopSlug, activeShop, storage, customFetch]);

  // Update shop configurations
  const updateShop = useCallback(async (slug, updates, adminKey = 'kutz-superadmin-2026') => {
    const cleanSlug = normalizeShopSlug(slug);
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiUpdateShopConfig(cleanSlug, updates, adminKey, { storage, fetch: customFetch });
      if (res.success) {
        if (cleanSlug === activeShopSlug && res.shop) {
          setActiveShop(res.shop);
        }
        await refreshShops(adminKey);
      }
      return res;
    } catch (err) {
      setError(err?.message || 'Error al actualizar configuración');
      return { success: false, error: err?.message };
    } finally {
      setIsLoading(false);
    }
  }, [activeShopSlug, storage, customFetch, refreshShops]);

  const openSuperAdmin = useCallback(() => setIsSuperAdminOpen(true), []);
  const closeSuperAdmin = useCallback(() => setIsSuperAdminOpen(false), []);

  // Verify 4-digit PIN directly against Netlify Blobs /sync and unlock real-time sync on new devices
  const verifyAndUnlockShopPin = useCallback(async (pinAttempt) => {
    const cleanPin = String(pinAttempt || '').trim();
    if (!/^\d{4}$/.test(cleanPin)) return { success: false, error: 'PIN inválido' };

    if (typeof fetch === 'undefined') {
      try {
        storage.setItem(`kutz_${activeShopSlug}_verified_pin`, cleanPin);
      } catch {
        // ignore
      }
      setNeedsPinSync(false);
      return { success: true };
    }

    try {
      const res = await fetch(`/api/shops/${encodeURIComponent(activeShopSlug)}/sync`, {
        method: 'GET',
        headers: {
          'x-shop-pin': cleanPin,
          Accept: 'application/json'
        }
      });

      if (!res.ok) {
        return { success: false, error: 'PIN incorrecto para esta barbería' };
      }

      const data = await res.json();
      try {
        storage.setItem(`kutz_${activeShopSlug}_verified_pin`, cleanPin);
      } catch {
        // ignore
      }

      if (data && data.config) {
        const merged = { ...data.config, pin: cleanPin };
        setActiveShop(merged);
        try {
          storage.setItem(`kutz_${activeShopSlug}_config`, JSON.stringify(merged));
          if (Array.isArray(data.appointments)) {
            storage.setItem(`kutz_${activeShopSlug}_appointments`, JSON.stringify(data.appointments));
          }
          if (Array.isArray(data.queue)) {
            storage.setItem(`kutz_${activeShopSlug}_queue`, JSON.stringify(data.queue));
          }
          if (Array.isArray(data.clients)) {
            storage.setItem(`kutz_${activeShopSlug}_clients`, JSON.stringify(data.clients));
          }
        } catch {
          // ignore
        }
      }

      setNeedsPinSync(false);
      if (syncEngineRef.current) {
        syncEngineRef.current.pin = cleanPin;
        syncEngineRef.current.forceSync();
      }
      setLastSyncTime(Date.now());
      return { success: true };
    } catch {
      return { success: false, error: 'Error de conexión' };
    }
  }, [activeShopSlug, storage]);

  const forceSyncNow = useCallback(async () => {
    if (syncEngineRef.current) {
      return await syncEngineRef.current.forceSync();
    }
    return null;
  }, []);

  const value = useMemo(() => ({
    activeShopSlug,
    activeShop,
    shopsList,
    isLoading,
    error,
    isPaused,
    isSuperAdminOpen,
    syncStatus,
    outboxCount,
    lastSyncTime,
    needsPinSync,
    switchShop,
    createShop,
    updateShop,
    toggleShopStatus,
    refreshShops,
    openSuperAdmin,
    closeSuperAdmin,
    setIsSuperAdminOpen,
    verifyAndUnlockShopPin,
    forceSyncNow
  }), [
    activeShopSlug,
    activeShop,
    shopsList,
    isLoading,
    error,
    isPaused,
    isSuperAdminOpen,
    syncStatus,
    outboxCount,
    lastSyncTime,
    needsPinSync,
    switchShop,
    createShop,
    updateShop,
    toggleShopStatus,
    refreshShops,
    openSuperAdmin,
    closeSuperAdmin,
    verifyAndUnlockShopPin,
    forceSyncNow
  ]);

  return (
    <ShopContext.Provider value={value}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
}
