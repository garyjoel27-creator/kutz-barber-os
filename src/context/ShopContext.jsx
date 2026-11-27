import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  DEFAULT_SHOP_SLUG,
  DEFAULT_BARBER_THEME_ID,
  normalizeBarberThemeId,
  DEFAULT_SHOP_CONFIG,
  SHOP_REX_CONFIG,
  SHOP_JOSEH_CONFIG,
  SHOP_CAMPODONICO_NAILS_CONFIG,
  SHOP_SALON_ESTETICA_CONFIG,
  normalizeShopSlug,
  validateTenantConfig,
  resolveTenantSlug,
  isPublicBookingPath
} from '../lib/shopUtils';
import {
  SyncEngine,
  dispatchBarberAction,
  fetchAdminShops,
  provisionShop,
  updateShopStatus as apiUpdateShopStatus,
  updateShopConfig as apiUpdateShopConfig,
  getLocalShopsIndex,
  getEffectiveStorage,
  SYNC_STATUS
} from '../lib/syncService';

export const ShopContext = createContext(null);

function getFallbackShopForSlug(slug, storage = null, stripPin = false) {
  const cleanSlug = normalizeShopSlug(slug) || DEFAULT_SHOP_SLUG;
  let base;
  if (cleanSlug === SHOP_REX_CONFIG.slug) {
    base = { ...SHOP_REX_CONFIG };
  } else if (cleanSlug === SHOP_JOSEH_CONFIG.slug) {
    base = { ...SHOP_JOSEH_CONFIG };
  } else if (cleanSlug === SHOP_CAMPODONICO_NAILS_CONFIG.slug || cleanSlug === 'campodonico-unas') {
    base = { ...SHOP_CAMPODONICO_NAILS_CONFIG, slug: cleanSlug };
  } else if (cleanSlug === SHOP_SALON_ESTETICA_CONFIG.slug || cleanSlug === 'salon-estetica') {
    base = { ...SHOP_SALON_ESTETICA_CONFIG, slug: cleanSlug };
  } else if (cleanSlug === DEFAULT_SHOP_CONFIG.slug || cleanSlug === 'default') {
    base = { ...DEFAULT_SHOP_CONFIG };
  } else {
    // Custom tenant provisioned via /admin: check local shops index first, never inherit kutz-madrid's PIN or REX/KIKO/NICO
    let indexed = null;
    if (storage) {
      try {
        const list = getLocalShopsIndex(storage);
        indexed = Array.isArray(list) ? list.find((s) => s.slug === cleanSlug) : null;
      } catch {
        // ignore
      }
    }
    base = {
      ...DEFAULT_SHOP_CONFIG,
      ...(indexed || {}),
      slug: cleanSlug,
      name: indexed?.name || cleanSlug.replace(/-/g, ' ').toUpperCase(),
      pin: indexed?.pin || '',
      phone: indexed?.phone || '',
      address: indexed?.address || '',
      barbers:
        Array.isArray(indexed?.barbers) && indexed.barbers.length > 0
          ? indexed.barbers
          : [{ id: 'b1', name: 'Barbero Titular', role: 'Master Barber', specialty: 'Master Barber', available: true }],
      services:
        Array.isArray(indexed?.services) && indexed.services.length > 0
          ? indexed.services
          : DEFAULT_SHOP_CONFIG.services
    };
  }
  if (stripPin) {
    const { pin: _omitted, ...safe } = base;
    return safe;
  }
  return base;
}

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

  const isPublicRoute = useMemo(() => {
    const pathname = routerLocation?.pathname || (typeof window !== 'undefined' ? window.location?.pathname : '');
    return isPublicBookingPath(pathname);
  }, [routerLocation?.pathname]);

  // Determine initial active shop slug through the 4-tier cascade
  const initialResolvedSlug = useMemo(() => {
    if (initialSlug) return normalizeShopSlug(initialSlug);
    return resolveTenantSlug(routerLocation, storage);
  }, [initialSlug, routerLocation, storage]);

  const [activeShopSlug, setActiveShopSlug] = useState(initialResolvedSlug);
  const [activeShop, setActiveShop] = useState(() => {
    try {
      const raw = storage.getItem(`kutz_${initialResolvedSlug}_config`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isPublicRoute) {
          const { pin: _p, ...safe } = parsed;
          return safe;
        }
        return parsed;
      }
    } catch {
      // fallback
    }
    return getFallbackShopForSlug(initialResolvedSlug, storage, isPublicRoute);
  });

  const [shopsList, setShopsList] = useState(() => getLocalShopsIndex(storage));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSuperAdminOpen, setIsSuperAdminOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.IDLE);
  const [outboxCount, setOutboxCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [needsPinSync, setNeedsPinSync] = useState(false);

  // Strip legacy ?pin= parameter from URL cleanly inside an effect (never side-effect in useMemo)
  useEffect(() => {
    if (isPublicRoute || typeof window === 'undefined') return;
    try {
      const search = window.location.search || routerLocation?.search || '';
      if (!search) return;
      const params = new URLSearchParams(search);
      const urlPin = params.get('pin');
      if (urlPin !== null) {
        if (/^\d{4}$/.test(urlPin)) {
          storage.setItem(`kutz_${activeShopSlug}_verified_pin`, urlPin);
        }
        if (window.history?.replaceState) {
          params.delete('pin');
          const cleanQuery = params.toString();
          const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash || ''}`;
          window.history.replaceState({}, '', cleanUrl);
        }
      }
    } catch {
      // ignore
    }
  }, [isPublicRoute, activeShopSlug, routerLocation?.search, storage]);

  // Resolve persisted verified PIN for current tenant (never on public customer booking routes)
  const resolvedPin = useMemo(() => {
    if (isPublicRoute) return '';
    try {
      const search = routerLocation?.search || (typeof window !== 'undefined' ? window.location.search : '');
      if (search) {
        const params = new URLSearchParams(search);
        const urlPin = params.get('pin');
        if (urlPin && /^\d{4}$/.test(urlPin)) {
          return urlPin;
        }
      }
      const savedPin = storage.getItem(`kutz_${activeShopSlug}_verified_pin`);
      if (savedPin && /^\d{4}$/.test(savedPin)) return savedPin;
      const rawCfg = storage.getItem(`kutz_${activeShopSlug}_config`);
      if (rawCfg) {
        const parsedCfg = JSON.parse(rawCfg);
        if (parsedCfg?.pin && /^\d{4}$/.test(String(parsedCfg.pin))) {
          return String(parsedCfg.pin);
        }
      }
    } catch {
      // ignore
    }
    if (activeShop?.slug === activeShopSlug && activeShop?.pin && /^\d{4}$/.test(String(activeShop.pin))) {
      return String(activeShop.pin);
    }
    const fallback = getFallbackShopForSlug(activeShopSlug, storage, false);
    return fallback?.pin || '';
  }, [isPublicRoute, activeShopSlug, activeShop?.slug, activeShop?.pin, routerLocation?.search, storage]);

  const isPaused = useMemo(() => {
    return String(activeShop?.status || '').toLowerCase() === 'paused';
  }, [activeShop]);

  // Sync engine reference for current active tenant
  const syncEngineRef = useRef(null);

  // Hydrate shop public config (name, barbers, services, schedule) from Netlify Blobs on any new device
  useEffect(() => {
    const fetchFn = customFetch || (typeof fetch !== 'undefined' ? fetch : null);
    if (!activeShopSlug || !fetchFn) return;
    let cancelled = false;
    fetchFn(`/api/shops/${encodeURIComponent(activeShopSlug)}/public-state`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data };
      })
      .then(({ ok, status, data }) => {
        if (cancelled) return;
        if ((status === 403 || status === 404) && (data?.paused || data?.error === 'shop_inactive')) {
          setActiveShop((prev) => ({
            ...(prev?.slug === activeShopSlug ? prev : {}),
            ...(data?.shop || {}),
            slug: activeShopSlug,
            status: 'paused'
          }));
          return;
        }
        if (!ok || !data || !data.success || !data.shop) return;
        setActiveShop((prev) => {
          const sameTenantPrev = prev?.slug === activeShopSlug ? prev : {};
          const merged = { ...sameTenantPrev, ...data.shop, slug: activeShopSlug };
          if (isPublicRoute) {
            delete merged.pin;
          } else {
            // Preserve verified/private PIN when on private barber routes, neveroverwrite private config from public route
            const privatePin = sameTenantPrev?.pin || resolvedPin || '';
            if (privatePin) merged.pin = privatePin;
            try {
              storage.setItem(`kutz_${activeShopSlug}_config`, JSON.stringify(merged));
            } catch {
              // ignore
            }
          }
          if (prev && JSON.stringify(prev) === JSON.stringify(merged)) {
            return prev;
          }
          return merged;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeShopSlug, isPublicRoute, resolvedPin, storage, customFetch]);

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
          setActiveShop((prev) => {
            const sameTenantPrev = prev?.slug === activeShopSlug ? prev : {};
            const nextShop = {
              ...sameTenantPrev,
              ...data.config,
              pin: data.config.pin || sameTenantPrev?.pin || resolvedPin || ''
            };
            if (prev && JSON.stringify(prev) === JSON.stringify(nextShop)) {
              return prev;
            }
            return nextShop;
          });
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

  // Load shop config whenever activeShopSlug or route privacy changes
  const loadShopConfig = useCallback((slug, forPublicRoute = isPublicRoute) => {
    const cleanSlug = normalizeShopSlug(slug) || DEFAULT_SHOP_SLUG;
    try {
      const raw = storage.getItem(`kutz_${cleanSlug}_config`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const fallback = getFallbackShopForSlug(cleanSlug, storage, false);
        const savedPin = !forPublicRoute ? storage.getItem(`kutz_${cleanSlug}_verified_pin`) : '';
        const merged = {
          ...fallback,
          ...parsed,
          slug: cleanSlug,
          pin: parsed.pin || savedPin || fallback.pin || ''
        };
        if (forPublicRoute) {
          delete merged.pin;
        }
        setActiveShop((prev) => (prev && JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged));
        return merged;
      }
    } catch {
      // ignore
    }
    const fallback = getFallbackShopForSlug(cleanSlug, storage, forPublicRoute);
    setActiveShop((prev) => (prev && JSON.stringify(prev) === JSON.stringify(fallback) ? prev : fallback));
    return fallback;
  }, [storage, isPublicRoute]);

  // Switch active shop tenant
  const switchShop = useCallback((rawSlug, pin = null) => {
    const cleanSlug = normalizeShopSlug(rawSlug) || DEFAULT_SHOP_SLUG;
    try {
      if (!isPublicRoute) {
        storage.setItem('kutz_active_shop_slug', cleanSlug);
      }
      if (pin && /^\d{4}$/.test(String(pin))) {
        storage.setItem(`kutz_${cleanSlug}_verified_pin`, String(pin));
      }
    } catch {
      // ignore storage error
    }

    if (cleanSlug !== activeShopSlug) {
      setActiveShopSlug(cleanSlug);
    }

    const cfg = loadShopConfig(cleanSlug, isPublicRoute);
    if (syncEngineRef.current && !isPublicRoute) {
      syncEngineRef.current.switchShop(cleanSlug, pin || cfg?.pin || '');
    }
  }, [activeShopSlug, isPublicRoute, storage, loadShopConfig]);

  // Persist activeShopSlug on private routes & synchronize when URL path (/r/:slug) or query (?shop=:slug) or privacy changes
  useEffect(() => {
    const pathname = routerLocation?.pathname || (typeof window !== 'undefined' ? window.location?.pathname : '');
    const search = routerLocation?.search || (typeof window !== 'undefined' ? window.location?.search : '');
    const hasExplicitUrlTenant = /^\/r\/[^/?#]+/i.test(pathname || '') || /[?&](shop|shopSlug)=/i.test(search || '');
    const targetSlug = hasExplicitUrlTenant && initialResolvedSlug ? initialResolvedSlug : activeShopSlug;

    if (targetSlug && targetSlug !== activeShopSlug) {
      setActiveShopSlug(targetSlug);
    }
    if (!isPublicRoute && targetSlug) {
      try {
        storage.setItem('kutz_active_shop_slug', targetSlug);
      } catch {
        // ignore
      }
    }
    loadShopConfig(targetSlug, isPublicRoute);
  }, [initialResolvedSlug, activeShopSlug, isPublicRoute, routerLocation?.pathname, routerLocation?.search, storage, loadShopConfig]);

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

    const fetchFn = customFetch || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetchFn) {
      try {
        storage.setItem(`kutz_${activeShopSlug}_verified_pin`, cleanPin);
      } catch {
        // ignore
      }
      setNeedsPinSync(false);
      return { success: true };
    }

    try {
      const res = await fetchFn(`/api/shops/${encodeURIComponent(activeShopSlug)}/sync`, {
        method: 'GET',
        headers: {
          'x-shop-pin': cleanPin,
          Accept: 'application/json'
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        if (res.status === 429) {
          return {
            success: false,
            rateLimited: true,
            retryAfterSeconds: errData?.retryAfterSeconds || 900,
            error: errData?.message || 'Demasiados intentos fallidos. Espera 15 minutos antes de volver a intentarlo.'
          };
        }
        return { success: false, error: errData?.message || 'PIN incorrecto para esta barbería' };
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
          if (Array.isArray(data.dailySales)) {
            storage.setItem(`kutz_${activeShopSlug}_daily_sales_v2`, JSON.stringify(data.dailySales));
          }
        } catch {
          // ignore
        }
      }

      setNeedsPinSync(false);
      if (syncEngineRef.current) {
        syncEngineRef.current.pin = cleanPin;
        syncEngineRef.current.authPaused = false;
        syncEngineRef.current.forceSync();
      }
      setLastSyncTime(Date.now());
      return { success: true };
    } catch {
      return { success: false, error: 'Error de conexión' };
    }
  }, [activeShopSlug, storage, customFetch]);

  const forceSyncNow = useCallback(async () => {
    if (syncEngineRef.current) {
      return await syncEngineRef.current.forceSync();
    }
    return null;
  }, []);

  const activeThemeId = useMemo(() => {
    if (activeShop?.themeId) return normalizeBarberThemeId(activeShop.themeId);
    try {
      const saved = storage.getItem(`kutz_${activeShopSlug}_theme`);
      if (saved) return normalizeBarberThemeId(saved);
    } catch {
      // ignore
    }
    return DEFAULT_BARBER_THEME_ID;
  }, [activeShop?.themeId, activeShopSlug, storage]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', activeThemeId);
    }
  }, [activeThemeId]);

  const setShopTheme = useCallback(
    (nextThemeId) => {
      const cleanTheme = normalizeBarberThemeId(nextThemeId);
      setActiveShop((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, themeId: cleanTheme };
        try {
          storage.setItem(`kutz_${activeShopSlug}_config`, JSON.stringify(updated));
          storage.setItem(`kutz_${activeShopSlug}_theme`, cleanTheme);
        } catch {
          // ignore
        }
        return updated;
      });
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', cleanTheme);
      }
      if (!isPublicRoute && typeof dispatchBarberAction === 'function') {
        dispatchBarberAction(activeShopSlug, 'update_shop_schedule', { themeId: cleanTheme }, resolvedPin, customFetch, storage);
      }
      return cleanTheme;
    },
    [activeShopSlug, resolvedPin, isPublicRoute, storage, customFetch]
  );

  const value = useMemo(() => ({
    activeShopSlug,
    activeShop,
    shopsList,
    isLoading,
    error,
    isPaused,
    isPublicRoute,
    resolvedPin,
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
    forceSyncNow,
    activeThemeId,
    setShopTheme
  }), [
    activeShopSlug,
    activeShop,
    shopsList,
    isLoading,
    error,
    isPaused,
    isPublicRoute,
    resolvedPin,
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
    forceSyncNow,
    activeThemeId,
    setShopTheme
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
