/**
 * src/lib/syncService.js
 * Dual-Layer Offline-First Synchronization Client for KUTZ Barber OS & LuminaDesk
 * 
 * Features:
 * 1. Multi-tenant partitioning: shop-namespaced localStorage keys (kutz_${shopSlug}_*)
 * 2. Background polling: 5-second interval when online and document is active
 * 3. Outbox queue: pending barber actions queued in kutz_${shopSlug}_outbox during offline/failures
 * 4. Slot holding logic: 10-minute hold TTL for pending QR bookings with automatic expiration
 * 5. Environment resilience: 100% safe in Node.js, headless runners, and browser runtimes
 */

import { safeGetItem, safeSetItem, STORAGE_KEYS } from './storage.js';
import { DEFAULT_SHOP_CONFIG, SHOP_REX_CONFIG, SHOP_JOSEH_CONFIG, normalizeShopSlug } from './shopUtils.js';

// Configuration Constants
export const SYNC_INTERVAL_MS = 5000;
export const HOLD_DURATION_MS = 10 * 60 * 1000; // 10 minutes
export const DEFAULT_SHOP_SLUG = 'kutz-madrid';

export const SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  ONLINE: 'online',
  OFFLINE: 'offline',
  ERROR: 'error'
};

// Safe Environment Detection
const isBrowser = typeof window !== 'undefined';
const isNavigatorOnline = () => {
  if (!isBrowser || typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
};

// In-memory storage fallback when localStorage is completely absent in Node
const fallbackMemoryStorage = new Map();
const memoryStorageAdapter = {
  getItem: (key) => (fallbackMemoryStorage.has(key) ? fallbackMemoryStorage.get(key) : null),
  setItem: (key, val) => { fallbackMemoryStorage.set(key, String(val)); },
  removeItem: (key) => { fallbackMemoryStorage.delete(key); },
  clear: () => { fallbackMemoryStorage.clear(); }
};

export function getEffectiveStorage(customStorage = null) {
  if (customStorage) return customStorage;
  if (isBrowser && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  return memoryStorageAdapter;
}

/**
 * Generates shop-isolated localStorage keys
 */
export function getShopStorageKeys(shopSlug = DEFAULT_SHOP_SLUG) {
  const slug = shopSlug || DEFAULT_SHOP_SLUG;
  return {
    APPOINTMENTS: `kutz_${slug}_appointments`,
    QUEUE: `kutz_${slug}_queue`,
    CLIENTS: `kutz_${slug}_clients`,
    CONFIG: `kutz_${slug}_config`,
    OUTBOX: `kutz_${slug}_outbox`,
    LAST_SYNC: `kutz_${slug}_last_sync`
  };
}

/**
 * Default shop configuration fixture for fallback/offline initialization
 */
export function getDefaultShopConfig(shopSlug = DEFAULT_SHOP_SLUG) {
  return {
    slug: shopSlug || DEFAULT_SHOP_SLUG,
    name: 'KUTZ // BARBER STUDIO',
    address: 'Calle de Fuencarral 42, 28004 Madrid',
    phone: '+34 912 345 678',
    pin: '1234',
    status: 'active',
    logo: 'https://luminadesk-gary.netlify.app/logo.png',
    schedule: {
      openTime: '10:00',
      closeTime: '20:30',
      slotIntervalMinutes: 30,
      workDays: [1, 2, 3, 4, 5, 6]
    },
    barbers: [
      { id: 'rex', name: 'REX', chair: 'SILLÓN 1', specialty: 'Degradados & Skin Fade', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300' },
      { id: 'kiko', name: 'KIKO', chair: 'SILLÓN 2', specialty: 'Corte & Street', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300' },
      { id: 'nico', name: 'NICO', chair: 'SILLÓN 3', specialty: 'Barba & Tijera', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=300' }
    ],
    services: [
      { id: 'skin-fade', name: 'Skin Fade #000 + Navaja', durationMinutes: 30, price: 18, category: 'corte', indicativeStyle: 'Skin Fade' },
      { id: 'taper-fade', name: 'Low Taper + Ritual Toalla', durationMinutes: 35, price: 20, category: 'combo', indicativeStyle: 'Taper Fade' },
      { id: 'beard-ritual', name: 'Barba & Vapor de Ozono', durationMinutes: 25, price: 15, category: 'barba' },
      { id: 'full-combo', name: 'Full Combo (Corte + Barba)', durationMinutes: 50, price: 30, category: 'combo' }
    ]
  };
}

/**
 * Calculates hold expiration timestamp
 */
export function calculateHoldExpiration(fromTimestamp = Date.now(), holdMinutes = 10) {
  return new Date(fromTimestamp + holdMinutes * 60 * 1000).toISOString();
}

/**
 * Checks if a pending appointment currently has an active slot hold
 */
export function isSlotHeld(appointment, now = Date.now()) {
  if (!appointment || appointment.status !== 'pending') return false;
  if (!appointment.holdExpiresAt) return false;
  const expires = typeof appointment.holdExpiresAt === 'number'
    ? appointment.holdExpiresAt
    : new Date(appointment.holdExpiresAt).getTime();
  return !isNaN(expires) && expires > now;
}

/**
 * Sweeper: Identifies and marks expired pending appointments
 */
export function cleanExpiredHolds(appointments = [], now = Date.now()) {
  if (!Array.isArray(appointments)) return { updatedAppointments: [], hasChanges: false, expiredCount: 0 };

  let expiredCount = 0;
  const updatedAppointments = appointments.map(apt => {
    if (apt.status === 'pending' && apt.holdExpiresAt) {
      const expires = typeof apt.holdExpiresAt === 'number'
        ? apt.holdExpiresAt
        : new Date(apt.holdExpiresAt).getTime();
      if (!isNaN(expires) && expires <= now) {
        expiredCount++;
        return {
          ...apt,
          status: 'expired',
          updatedAt: new Date(now).toISOString()
        };
      }
    }
    return apt;
  });

  return {
    updatedAppointments,
    hasChanges: expiredCount > 0,
    expiredCount
  };
}

/**
 * Checks whether a specific time slot is free or collided
 */
export function isSlotAvailable(
  appointments = [],
  date,
  time,
  durationMinutes = 30,
  barberId = 'any',
  excludeId = null,
  now = Date.now()
) {
  if (!Array.isArray(appointments) || !date || !time) return true;

  const toMinutes = (timeStr) => {
    const [h, m] = String(timeStr).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const reqStart = toMinutes(time);
  const reqEnd = reqStart + Number(durationMinutes || 30);

  return !appointments.some(apt => {
    if (apt.id === excludeId) return false;
    if (apt.date !== date) return false;

    // Ignore canceled, rejected or completed appointments
    if (apt.status === 'rejected' || apt.status === 'cancelled' || apt.status === 'completed' || apt.status === 'expired') {
      return false;
    }

    // Expired pending holds do NOT block
    if (apt.status === 'pending') {
      if (!isSlotHeld(apt, now)) return false;
    } else if (apt.status !== 'confirmed' && apt.status !== 'seated') {
      return false;
    }

    // Barber check
    const aptBarber = apt.barberId || apt.barber;
    if (barberId !== 'any' && aptBarber !== 'any' && aptBarber !== barberId) {
      return false;
    }

    const aptTime = apt.timeSlot || apt.time;
    const aptStart = toMinutes(aptTime);
    const aptEnd = aptStart + Number(apt.durationMinutes || 30);

    // Overlap condition: start < aptEnd && end > aptStart
    return reqStart < aptEnd && reqEnd > aptStart;
  });
}

/**
 * Loads entire local state for a shop with automatic legacy migration
 */
export function loadLocalShopState(shopSlug = DEFAULT_SHOP_SLUG, customStorage = null) {
  const storage = getEffectiveStorage(customStorage);
  const keys = getShopStorageKeys(shopSlug);

  // 1. Config
  let config = safeGetItem(keys.CONFIG, null, storage);
  if (!config || (shopSlug === 'joseh-barber' && Number(config.configVersion || 1) < 2)) {
    if (shopSlug === 'joseh-barber') {
      config = { ...SHOP_JOSEH_CONFIG, pin: config?.pin || SHOP_JOSEH_CONFIG.pin };
    } else if (!config) {
      config = getDefaultShopConfig(shopSlug);
    }
    safeSetItem(keys.CONFIG, config, storage);
  }

  // 2. Appointments
  let appointments = safeGetItem(keys.APPOINTMENTS, [], storage);
  if (!Array.isArray(appointments)) appointments = [];
  const { updatedAppointments, hasChanges } = cleanExpiredHolds(appointments);
  if (hasChanges) {
    appointments = updatedAppointments;
    safeSetItem(keys.APPOINTMENTS, appointments, storage);
  }

  // 3. Queue (Walk-in)
  let queue = safeGetItem(keys.QUEUE, null, storage);
  if (!Array.isArray(queue)) {
    if (shopSlug === DEFAULT_SHOP_SLUG) {
      queue = safeGetItem(STORAGE_KEYS.WALKIN_QUEUE, [], storage);
    } else {
      queue = [];
    }
    safeSetItem(keys.QUEUE, queue, storage);
  }

  // 4. Clients
  let clients = safeGetItem(keys.CLIENTS, null, storage);
  if (!Array.isArray(clients) || clients.length === 0) {
    if (shopSlug === DEFAULT_SHOP_SLUG) {
      clients = safeGetItem(STORAGE_KEYS.CLIENTS, [], storage);
    } else {
      clients = [];
    }
    if (clients && clients.length > 0) {
      safeSetItem(keys.CLIENTS, clients, storage);
    }
  }

  const lastSyncedAt = safeGetItem(keys.LAST_SYNC, null, storage);

  return {
    shopSlug,
    config,
    appointments,
    queue: Array.isArray(queue) ? queue : [],
    clients: Array.isArray(clients) ? clients : [],
    lastSyncedAt
  };
}

/**
 * Saves state directly to shop-namespaced storage
 */
export function saveLocalShopState(shopSlug = DEFAULT_SHOP_SLUG, state = {}, customStorage = null) {
  const storage = getEffectiveStorage(customStorage);
  const keys = getShopStorageKeys(shopSlug);
  let allSuccess = true;

  if (state.config) {
    const res = safeSetItem(keys.CONFIG, state.config, storage);
    if (!res.success) allSuccess = false;
  }
  if (state.appointments) {
    const res = safeSetItem(keys.APPOINTMENTS, state.appointments, storage);
    if (!res.success) allSuccess = false;
  }
  if (state.queue) {
    const res = safeSetItem(keys.QUEUE, state.queue, storage);
    if (!res.success) allSuccess = false;
  }
  if (state.clients) {
    const res = safeSetItem(keys.CLIENTS, state.clients, storage);
    if (!res.success) allSuccess = false;
  }
  if (state.lastSyncedAt) {
    safeSetItem(keys.LAST_SYNC, state.lastSyncedAt, storage);
  }

  return { success: allSuccess };
}

/**
 * Outbox management
 */
export function getOutbox(shopSlug = DEFAULT_SHOP_SLUG, customStorage = null) {
  const storage = getEffectiveStorage(customStorage);
  const keys = getShopStorageKeys(shopSlug);
  const outbox = safeGetItem(keys.OUTBOX, [], storage);
  return Array.isArray(outbox) ? outbox : [];
}

export function addToOutbox(shopSlug = DEFAULT_SHOP_SLUG, action, payload, customStorage = null) {
  const storage = getEffectiveStorage(customStorage);
  const keys = getShopStorageKeys(shopSlug);
  const outbox = getOutbox(shopSlug, storage);
  const item = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    shopSlug,
    action,
    payload,
    createdAt: Date.now(),
    retryCount: 0
  };
  outbox.push(item);
  safeSetItem(keys.OUTBOX, outbox, storage);
  return item;
}

export function removeFromOutbox(shopSlug = DEFAULT_SHOP_SLUG, actionId, customStorage = null) {
  const storage = getEffectiveStorage(customStorage);
  const keys = getShopStorageKeys(shopSlug);
  const outbox = getOutbox(shopSlug, storage);
  const filtered = outbox.filter(item => item.id !== actionId);
  safeSetItem(keys.OUTBOX, filtered, storage);
  return filtered.length !== outbox.length;
}

export function clearOutbox(shopSlug = DEFAULT_SHOP_SLUG, customStorage = null) {
  const storage = getEffectiveStorage(customStorage);
  const keys = getShopStorageKeys(shopSlug);
  safeSetItem(keys.OUTBOX, [], storage);
  return true;
}

/**
 * Flushes pending outbox actions to the server
 */
export async function flushOutbox(shopSlug = DEFAULT_SHOP_SLUG, pin = '', customFetch = null, customStorage = null) {
  const storage = getEffectiveStorage(customStorage);
  const outbox = getOutbox(shopSlug, storage);
  if (outbox.length === 0) return { processed: 0, remaining: 0, errors: [] };
  if (!isNavigatorOnline()) return { processed: 0, remaining: outbox.length, errors: ['Offline'] };

  const fetcher = customFetch || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetcher) return { processed: 0, remaining: outbox.length, errors: ['No fetch implementation'] };

  const remaining = [];
  const errors = [];
  let processed = 0;

  for (let i = 0; i < outbox.length; i++) {
    const item = outbox[i];
    try {
      const response = await fetcher(`/api/shops/${encodeURIComponent(shopSlug)}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shop-pin': pin || ''
        },
        body: JSON.stringify({ action: item.action, payload: item.payload })
      });

      if (response.ok) {
        processed++;
      } else if (response.status >= 400 && response.status < 500) {
        // Validation / client error: drop after 5 retries to avoid poison pill
        item.retryCount = (item.retryCount || 0) + 1;
        if (item.retryCount < 5) {
          remaining.push(item);
        }
        errors.push(`HTTP ${response.status} for action ${item.action}`);
      } else {
        // Server / gateway error: preserve current item and all subsequent items
        item.retryCount = (item.retryCount || 0) + 1;
        remaining.push(item);
        for (let j = i + 1; j < outbox.length; j++) {
          remaining.push(outbox[j]);
        }
        break; // Stop loop on server failure
      }
    } catch (err) {
      item.retryCount = (item.retryCount || 0) + 1;
      remaining.push(item);
      for (let j = i + 1; j < outbox.length; j++) {
        remaining.push(outbox[j]);
      }
      errors.push(err.message);
      break; // Network unreachable
    }
  }

  const keys = getShopStorageKeys(shopSlug);
  safeSetItem(keys.OUTBOX, remaining, storage);

  return { processed, remaining: remaining.length, errors };
}

/**
 * Remote State Synchronization (Network + Storage Fallback)
 */
export async function fetchRemoteShopState(shopSlug = DEFAULT_SHOP_SLUG, pin = '', options = {}) {
  const fetcher = options.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  if (!isNavigatorOnline() || !fetcher) {
    return { success: false, isOffline: true };
  }

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), options.timeoutMs || 4000) : null;

    const response = await fetcher(`/api/shops/${encodeURIComponent(shopSlug)}/sync`, {
      method: 'GET',
      headers: {
        'x-shop-pin': pin || '',
        'Accept': 'application/json'
      },
      signal: controller ? controller.signal : undefined
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        authRequired: response.status === 401,
        error: `HTTP ${response.status}`
      };
    }

    const remoteData = await response.json();
    return { success: true, data: remoteData };
  } catch (err) {
    return { success: false, isOffline: true, error: err.message };
  }
}

/**
 * High-Level Hybrid Sync:
 * Flushes outbox, queries remote state, updates local cache, falls back seamlessly
 */
export async function syncShopData(shopSlug = DEFAULT_SHOP_SLUG, pin = '', options = {}) {
  const storage = getEffectiveStorage(options.storage);

  // 1. Flush any pending actions if online
  if (isNavigatorOnline()) {
    await flushOutbox(shopSlug, pin, options.fetch, storage).catch(() => {});
  }

  // 2. Attempt remote fetch
  const remoteResult = await fetchRemoteShopState(shopSlug, pin, options);

  if (remoteResult.success && remoteResult.data) {
    const remote = remoteResult.data;
    const { updatedAppointments } = cleanExpiredHolds(remote.appointments || []);
    const baseCfg = remote.config || getDefaultShopConfig(shopSlug);

    const mergedSnapshot = {
      shopSlug,
      config: pin ? { ...baseCfg, pin: baseCfg.pin || pin } : baseCfg,
      appointments: updatedAppointments,
      queue: remote.queue || [],
      clients: remote.clients || [],
      lastSyncedAt: new Date().toISOString()
    };

    saveLocalShopState(shopSlug, mergedSnapshot, storage);

    return {
      data: mergedSnapshot,
      source: 'network',
      syncStatus: SYNC_STATUS.ONLINE
    };
  }

  // 3. Fallback to Local Storage
  const localSnapshot = loadLocalShopState(shopSlug, storage);

  return {
    data: localSnapshot,
    source: 'local',
    authRequired: Boolean(remoteResult.authRequired),
    syncStatus: remoteResult.isOffline ? SYNC_STATUS.OFFLINE : SYNC_STATUS.ERROR
  };
}

/**
 * Dispatches an action with optimistic local mutation + remote push/outbox
 */
export async function dispatchBarberAction(
  shopSlug = DEFAULT_SHOP_SLUG,
  action,
  payload = {},
  pin = '',
  customFetch = null,
  customStorage = null
) {
  const storage = getEffectiveStorage(customStorage);
  const local = loadLocalShopState(shopSlug, storage);
  let localUpdated = false;

  // 1. Apply Optimistic Mutation Locally
  if (action === 'approve') {
    const appointmentId = payload?.appointmentId || payload?.id;
    local.appointments = local.appointments.map(apt => {
      if (apt.id === appointmentId) {
        localUpdated = true;
        return {
          ...apt,
          status: 'confirmed',
          holdExpiresAt: null,
          updatedAt: new Date().toISOString()
        };
      }
      return apt;
    });
  } else if (action === 'reject') {
    const appointmentId = payload?.appointmentId || payload?.id;
    local.appointments = local.appointments.map(apt => {
      if (apt.id === appointmentId) {
        localUpdated = true;
        return {
          ...apt,
          status: 'rejected',
          holdExpiresAt: null,
          rejectionReason: payload?.reason || '',
          updatedAt: new Date().toISOString()
        };
      }
      return apt;
    });
  } else if (action === 'seat') {
    if (payload?.appointmentId) {
      local.appointments = local.appointments.map(apt => {
        if (apt.id === payload.appointmentId) {
          localUpdated = true;
          return { ...apt, status: 'seated', chairId: payload.chairId, updatedAt: new Date().toISOString() };
        }
        return apt;
      });
    } else if (payload?.queueId) {
      local.queue = local.queue.map(q => {
        if (q.id === payload.queueId) {
          localUpdated = true;
          return { ...q, status: 'in_chair', chairId: payload.chairId };
        }
        return q;
      });
    }
  } else if (action === 'add_walkin') {
    local.queue = [...local.queue, payload];
    localUpdated = true;
  } else if (action === 'remove_walkin') {
    local.queue = local.queue.filter(q => q.id !== payload?.id && q.id !== payload?.queueId);
    localUpdated = true;
  } else if (action === 'add_appointment') {
    local.appointments = [...local.appointments, payload];
    localUpdated = true;
  } else if (action === 'update_duration') {
    const appointmentId = payload?.appointmentId || payload?.id;
    const clamped = Math.max(15, Math.min(180, Number(payload?.durationMinutes) || 60));
    local.appointments = local.appointments.map(apt => {
      if (apt.id === appointmentId) {
        localUpdated = true;
        return { ...apt, durationMinutes: clamped, updatedAt: new Date().toISOString() };
      }
      return apt;
    });
  } else if (action === 'reschedule') {
    const appointmentId = payload?.appointmentId || payload?.id;
    const clampedDur = payload?.durationMinutes
      ? Math.max(15, Math.min(240, Number(payload.durationMinutes)))
      : null;
    local.appointments = local.appointments.map(apt => {
      if (apt.id === appointmentId) {
        localUpdated = true;
        return {
          ...apt,
          ...(payload?.timeSlot ? { timeSlot: payload.timeSlot, time: payload.timeSlot } : {}),
          ...(payload?.date ? { date: payload.date } : {}),
          ...(clampedDur !== null ? { durationMinutes: clampedDur } : {}),
          ...(payload?.clientName !== undefined ? { clientName: payload.clientName } : {}),
          ...(payload?.clientPhone !== undefined ? { clientPhone: payload.clientPhone } : {}),
          ...(payload?.serviceId !== undefined ? { serviceId: payload.serviceId } : {}),
          ...(payload?.serviceName !== undefined ? { serviceName: payload.serviceName } : {}),
          ...(payload?.barberId !== undefined ? { barberId: payload.barberId } : {}),
          ...(payload?.barberName !== undefined ? { barberName: payload.barberName } : {}),
          ...(payload?.price !== undefined ? { price: payload.price } : {}),
          ...(payload?.isBlock !== undefined ? { isBlock: Boolean(payload.isBlock) } : {}),
          updatedAt: new Date().toISOString()
        };
      }
      return apt;
    });
  } else if (action === 'delete_appointment') {
    const appointmentId = payload?.appointmentId || payload?.id;
    local.appointments = local.appointments.filter(apt => String(apt.id) !== String(appointmentId));
    localUpdated = true;
  } else if (action === 'upsert_client') {
    const clientObj = payload?.client || payload;
    if (clientObj && clientObj.id) {
      const idx = local.clients.findIndex(c => String(c.id) === String(clientObj.id));
      if (idx !== -1) {
        local.clients = local.clients.map((c, i) => (i === idx ? { ...c, ...clientObj } : c));
      } else {
        local.clients = [clientObj, ...local.clients];
      }
      localUpdated = true;
    }
  } else if (action === 'delete_client') {
    const clientId = payload?.clientId || payload?.id;
    local.clients = local.clients.filter(c => String(c.id) !== String(clientId));
    localUpdated = true;
  } else if (action === 'update_shop_schedule') {
    local.config = {
      ...(local.config || {}),
      ...(payload?.schedule
        ? {
            schedule: {
              ...(local.config?.schedule || {}),
              ...payload.schedule,
              hoursByDay: {
                ...(local.config?.schedule?.hoursByDay || {}),
                ...(payload.schedule?.hoursByDay || {})
              }
            }
          }
        : {}),
      ...(Array.isArray(payload?.services) ? { services: payload.services } : {}),
      ...(payload?.walkInOpen !== undefined ? { walkInOpen: Boolean(payload.walkInOpen) } : {})
    };
    localUpdated = true;
  }

  if (localUpdated) {
    saveLocalShopState(shopSlug, local, storage);
  }

  // 2. Attempt remote dispatch
  let remoteSynced = false;
  const fetcher = customFetch || (typeof fetch !== 'undefined' ? fetch : null);

  if (isNavigatorOnline() && fetcher) {
    try {
      const response = await fetcher(`/api/shops/${encodeURIComponent(shopSlug)}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shop-pin': pin || ''
        },
        body: JSON.stringify({ action, payload })
      });

      if (response.ok) {
        remoteSynced = true;
      } else {
        addToOutbox(shopSlug, action, payload, storage);
      }
    } catch {
      addToOutbox(shopSlug, action, payload, storage);
    }
  } else {
    addToOutbox(shopSlug, action, payload, storage);
  }

  return {
    success: true,
    localUpdated,
    remoteSynced,
    data: local
  };
}

/**
 * Background Sync Engine Class
 * Manages 5s polling, document visibility throttling, window events, and outbox flushes
 */
export class SyncEngine {
  constructor(options = {}) {
    this.shopSlug = options.shopSlug || DEFAULT_SHOP_SLUG;
    this.pin = options.pin || '';
    this.intervalMs = options.intervalMs || SYNC_INTERVAL_MS;
    this.customFetch = options.fetch || null;
    this.customStorage = options.storage || null;
    this.timerId = null;
    this.status = SYNC_STATUS.IDLE;
    this.listeners = {
      data: new Set(),
      status: new Set(),
      outbox: new Set(),
      auth: new Set(),
      error: new Set()
    };

    this._onOnline = this._onOnline.bind(this);
    this._onOffline = this._onOffline.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
  }

  start() {
    if (this.timerId) return;

    // Initial sync
    this.forceSync();

    // Attach browser window events safely
    if (isBrowser) {
      window.addEventListener('online', this._onOnline);
      window.addEventListener('offline', this._onOffline);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', this._onVisibilityChange);
      }
    }

    // Schedule 5-second interval
    this.timerId = setInterval(() => {
      if (isBrowser && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      this.forceSync();
    }, this.intervalMs);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    if (isBrowser) {
      window.removeEventListener('online', this._onOnline);
      window.removeEventListener('offline', this._onOffline);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this._onVisibilityChange);
      }
    }
    this._setStatus(SYNC_STATUS.IDLE);
  }

  switchShop(newSlug, newPin = null) {
    const cleanSlug = normalizeShopSlug(newSlug);
    if (!cleanSlug || cleanSlug === this.shopSlug) return;
    this.shopSlug = cleanSlug;
    if (newPin !== null && newPin !== undefined) {
      this.pin = String(newPin);
    }
    if (this.timerId) {
      this.forceSync();
    }
  }

  async forceSync() {
    this._setStatus(SYNC_STATUS.SYNCING);
    try {
      const result = await syncShopData(this.shopSlug, this.pin, {
        fetch: this.customFetch,
        storage: this.customStorage
      });
      this._setStatus(result.syncStatus);
      this._emit('auth', Boolean(result.authRequired));
      this._emit('data', result.data);
      this._emit('outbox', getOutbox(this.shopSlug, this.customStorage));
      return result;
    } catch (err) {
      this._setStatus(SYNC_STATUS.ERROR);
      this._emit('error', err);
      const local = loadLocalShopState(this.shopSlug, this.customStorage);
      this._emit('data', local);
      return { data: local, syncStatus: SYNC_STATUS.ERROR };
    }
  }

  async dispatch(action, payload) {
    const result = await dispatchBarberAction(
      this.shopSlug,
      action,
      payload,
      this.pin,
      this.customFetch,
      this.customStorage
    );
    this._emit('data', result.data);
    this._emit('outbox', getOutbox(this.shopSlug, this.customStorage));
    return result;
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].add(callback);
    }
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].delete(callback);
    }
  }

  getStatus() {
    return this.status;
  }

  destroy() {
    this.stop();
    Object.values(this.listeners).forEach(set => set.clear());
  }

  _setStatus(status) {
    if (this.status !== status) {
      this.status = status;
      this._emit('status', status);
    }
  }

  _emit(event, payload) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try {
          cb(payload);
        } catch (err) {
          console.warn(`Error in sync listener [${event}]:`, err);
        }
      });
    }
  }

  _onOnline() {
    this.forceSync();
  }

  _onOffline() {
    this._setStatus(SYNC_STATUS.OFFLINE);
  }

  _onVisibilityChange() {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.forceSync();
    }
  }
}

/**
 * Factory helper for clean declarative hook integration
 */
export function createSyncService(options = {}) {
  return new SyncEngine(options);
}

// ============================================================================
// Multi-Shop Tenant Administration & Provisioning Helpers
// ============================================================================

export const SHOPS_INDEX_STORAGE_KEY = 'kutz_shops_index';

export function getLocalShopsIndex(customStorage = null) {
  const storage = getEffectiveStorage(customStorage);
  const raw = storage.getItem(SHOPS_INDEX_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fallback
    }
  }
  // Default fallback index
  const defaultIndex = [
    {
      slug: DEFAULT_SHOP_CONFIG.slug,
      name: DEFAULT_SHOP_CONFIG.name,
      status: DEFAULT_SHOP_CONFIG.status,
      barberCount: DEFAULT_SHOP_CONFIG.barbers.length,
      pin: DEFAULT_SHOP_CONFIG.pin,
      phone: DEFAULT_SHOP_CONFIG.phone,
      address: DEFAULT_SHOP_CONFIG.address,
      servicesCount: DEFAULT_SHOP_CONFIG.services.length
    },
    {
      slug: SHOP_REX_CONFIG.slug,
      name: SHOP_REX_CONFIG.name,
      status: SHOP_REX_CONFIG.status,
      barberCount: SHOP_REX_CONFIG.barbers.length,
      pin: SHOP_REX_CONFIG.pin,
      phone: SHOP_REX_CONFIG.phone,
      address: SHOP_REX_CONFIG.address,
      servicesCount: SHOP_REX_CONFIG.services.length
    }
  ];
  try {
    storage.setItem(SHOPS_INDEX_STORAGE_KEY, JSON.stringify(defaultIndex));
    // Also ensure configs are seeded if missing
    if (!storage.getItem(`kutz_${DEFAULT_SHOP_CONFIG.slug}_config`)) {
      storage.setItem(`kutz_${DEFAULT_SHOP_CONFIG.slug}_config`, JSON.stringify(DEFAULT_SHOP_CONFIG));
    }
    if (!storage.getItem(`kutz_${SHOP_REX_CONFIG.slug}_config`)) {
      storage.setItem(`kutz_${SHOP_REX_CONFIG.slug}_config`, JSON.stringify(SHOP_REX_CONFIG));
    }
  } catch {
    // ignore storage error
  }
  return defaultIndex;
}

export function saveLocalShopsIndex(shops, customStorage = null) {
  const storage = getEffectiveStorage(customStorage);
  try {
    storage.setItem(SHOPS_INDEX_STORAGE_KEY, JSON.stringify(shops));
  } catch {
    // ignore storage error
  }
}

/**
 * Super-Admin: Fetches all registered shops
 */
export async function fetchAdminShops(adminKey = 'kutz-superadmin-2026', options = {}) {
  const fetcher = options.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  const storage = getEffectiveStorage(options.storage);

  if (isNavigatorOnline() && fetcher) {
    try {
      const res = await fetcher('/api/admin/shops', {
        headers: {
          'x-admin-key': adminKey
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.shops)) {
          saveLocalShopsIndex(data.shops, storage);
          return { success: true, shops: data.shops, source: 'network' };
        }
      }
    } catch {
      // Network failure, use local
    }
  }

  const localShops = getLocalShopsIndex(storage);
  return { success: true, shops: localShops, source: 'cache' };
}

/**
 * Super-Admin: Provisions a new barbershop tenant
 */
export async function provisionShop(shopData, adminKey = 'kutz-superadmin-2026', options = {}) {
  const cleanSlug = normalizeShopSlug(shopData.slug);
  const fullShop = {
    ...shopData,
    slug: cleanSlug,
    status: shopData.status || 'active',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const fetcher = options.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  const storage = getEffectiveStorage(options.storage);

  // Check duplicate locally
  const localIndex = getLocalShopsIndex(storage);
  if (localIndex.some(s => s.slug === cleanSlug)) {
    return { success: false, error: 'Ya existe una barbería con este slug.', status: 409 };
  }

  let networkSuccess = false;
  let responseData = null;

  if (isNavigatorOnline() && fetcher) {
    try {
      const res = await fetcher('/api/admin/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify(fullShop)
      });
      if (res.status === 409) {
        const errJson = await res.json().catch(() => ({}));
        return { success: false, error: errJson.message || errJson.error || 'Ya existe una barbería con este slug.', status: 409 };
      }
      if (res.ok) {
        networkSuccess = true;
        responseData = await res.json().catch(() => null);
      }
    } catch {
      // offline fallback
    }
  }

  // Update local storage
  const summary = {
    slug: cleanSlug,
    name: fullShop.name,
    status: fullShop.status,
    barberCount: fullShop.barbers?.length || 1,
    servicesCount: fullShop.services?.length || 1,
    pin: fullShop.pin,
    phone: fullShop.phone || '',
    address: fullShop.address || '',
    createdAt: fullShop.createdAt
  };
  localIndex.push(summary);
  saveLocalShopsIndex(localIndex, storage);

  try {
    storage.setItem(`kutz_${cleanSlug}_config`, JSON.stringify(fullShop));
    storage.setItem(`kutz_${cleanSlug}_appointments`, JSON.stringify([]));
    storage.setItem(`kutz_${cleanSlug}_queue`, JSON.stringify([]));
    storage.setItem(`kutz_${cleanSlug}_clients`, JSON.stringify([]));
  } catch {
    // ignore storage error
  }

  return {
    success: true,
    slug: cleanSlug,
    shop: responseData?.shop || fullShop,
    synced: networkSuccess
  };
}

/**
 * Super-Admin: 1-Click status toggle (active <-> paused)
 */
export async function updateShopStatus(slug, status, adminKey = 'kutz-superadmin-2026', options = {}) {
  const cleanSlug = normalizeShopSlug(slug);
  const normalizedStatus = String(status).toLowerCase() === 'paused' ? 'paused' : 'active';
  const fetcher = options.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  const storage = getEffectiveStorage(options.storage);

  if (isNavigatorOnline() && fetcher) {
    try {
      const res = await fetcher(`/api/admin/shops/${encodeURIComponent(cleanSlug)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ status: normalizedStatus })
      });
      if (res.ok) {
        const data = await res.json();
        // Update local
        const index = getLocalShopsIndex(storage).map(s => s.slug === cleanSlug ? { ...s, status: normalizedStatus } : s);
        saveLocalShopsIndex(index, storage);
        return { success: true, slug: cleanSlug, status: normalizedStatus, shop: data.shop };
      }
    } catch {
      // fallback to local
    }
  }

  // Update local state
  const index = getLocalShopsIndex(storage).map(s => s.slug === cleanSlug ? { ...s, status: normalizedStatus } : s);
  saveLocalShopsIndex(index, storage);

  try {
    const rawConfig = storage.getItem(`kutz_${cleanSlug}_config`);
    if (rawConfig) {
      const parsed = JSON.parse(rawConfig);
      parsed.status = normalizedStatus;
      parsed.updatedAt = Date.now();
      storage.setItem(`kutz_${cleanSlug}_config`, JSON.stringify(parsed));
    }
  } catch {
    // ignore storage error
  }

  return { success: true, slug: cleanSlug, status: normalizedStatus };
}

/**
 * Super-Admin: Update shop details (pricing, barbers, schedule)
 */
export async function updateShopConfig(slug, updates, adminKey = 'kutz-superadmin-2026', options = {}) {
  const cleanSlug = normalizeShopSlug(slug);
  const fetcher = options.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  const storage = getEffectiveStorage(options.storage);

  if (isNavigatorOnline() && fetcher) {
    try {
      const res = await fetcher(`/api/admin/shops/${encodeURIComponent(cleanSlug)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, slug: cleanSlug, shop: data.shop };
      }
    } catch {
      // fallback to local
    }
  }

  // Local update
  let updatedShop = null;
  try {
    const raw = storage.getItem(`kutz_${cleanSlug}_config`);
    if (raw) {
      const parsed = JSON.parse(raw);
      updatedShop = { ...parsed, ...updates, slug: cleanSlug, updatedAt: Date.now() };
      storage.setItem(`kutz_${cleanSlug}_config`, JSON.stringify(updatedShop));
    }
  } catch {
    // ignore storage error
  }

  return { success: true, slug: cleanSlug, shop: updatedShop };
}

