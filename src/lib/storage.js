/**
 * LocalStorage Safe Storage Layer for KUTZ // BARBER OS & LuminaDesk
 * Provides QuotaExceededError boundary and corrupted JSON recovery with telemetry
 */

export const STORAGE_KEYS = {
  CLIENTS: 'luminadesk_clients',
  WALKIN_QUEUE: 'kutz_walkin_queue',
  WAITLIST: 'kutz_waitlist',
  BARBER_SEEDED: 'kutz_barber_clients_seeded_v1',
  BUSINESS_MODE: 'luminadesk_business_mode',
  BARBER_MODE: 'kutz_barber_mode_v1'
};

/**
 * Safely writes a value to localStorage with QuotaExceededError protection
 */
export function safeSetItem(
  key,
  value,
  storage = (typeof window !== 'undefined' ? window.localStorage : null),
  onAlert = null
) {
  if (!storage) return { success: false, reason: 'no-storage' };
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    storage.setItem(key, serialized);
    return { success: true, quotaExceeded: false };
  } catch (err) {
    console.error('Error de cuota de almacenamiento en localStorage:', err);
    const isQuota = err.name === 'QuotaExceededError' || err.code === 22 || err.number === -2147024882;
    if (isQuota) {
      const alertMsg = 'Aviso de almacenamiento: El espacio local de fotos está casi lleno. Te recomendamos limpiar historiales antiguos o conectar Firebase.';
      if (typeof onAlert === 'function') {
        onAlert(alertMsg);
      } else if (typeof alert === 'function') {
        alert(alertMsg);
      }
      return { success: false, quotaExceeded: true, error: err };
    }
    return { success: false, quotaExceeded: false, error: err };
  }
}

/**
 * Safely reads and parses a value from localStorage with corrupted JSON recovery
 */
export function safeGetItem(
  key,
  fallback = null,
  storage = (typeof window !== 'undefined' ? window.localStorage : null)
) {
  if (!storage) return fallback;
  try {
    const item = storage.getItem(key);
    if (item === null || item === undefined) return fallback;
    try {
      return JSON.parse(item);
    } catch {
      console.warn('Error al leer de localStorage (JSON corrupto):', key);
      return fallback;
    }
  } catch (err) {
    console.warn('Error al acceder a localStorage:', err);
    return fallback;
  }
}

/**
 * Saves clients array to storage with non-blocking QuotaExceededError handling
 */
export function saveClientsToStorage(
  clients,
  storage = (typeof window !== 'undefined' ? window.localStorage : null),
  onAlert = null
) {
  return safeSetItem(STORAGE_KEYS.CLIENTS, clients, storage, onAlert);
}

/**
 * Loads clients array from storage with automatic corrupted JSON recovery
 */
export function loadClientsFromStorage(
  storage = (typeof window !== 'undefined' ? window.localStorage : null),
  fallbackClients = []
) {
  if (!storage) return fallbackClients;
  try {
    const saved = storage.getItem(STORAGE_KEYS.CLIENTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(c => {
          if (String(c.id) === '3' && c.name === 'Carlota Mendoza') {
            return fallbackClients[2] || c;
          }
          return c;
        });
      }
    }
  } catch (err) {
    console.warn('Error al leer de localStorage:', err);
  }
  return fallbackClients;
}
