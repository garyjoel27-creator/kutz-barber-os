/**
 * src/lib/shopUtils.js
 * Pure Utility Library & Data Fixtures for Multi-Shop Architecture
 * 
 * Features:
 * - Pure slug normalization and validation functions
 * - Default shop fixtures for kutz-madrid and barberia-rex
 * - 4-tier tenant resolution cascade (path -> query -> localStorage -> fallback)
 * - Canonical customer portal and barber hub URL constructors
 */

export const DEFAULT_SHOP_SLUG = 'kutz-madrid';

export const DEFAULT_SHOP_CONFIG = {
  slug: 'kutz-madrid',
  name: 'KUTZ // BARBER OS Central',
  pin: '1234',
  logo: 'https://luminadesk-gary.netlify.app/kutz-logo.png',
  address: 'Calle Mayor 14, Local 2, Madrid',
  phone: '600123456',
  status: 'active',
  barbers: [
    { id: 'b1', name: 'Gary "Master"', role: 'Master Barber', available: true },
    { id: 'b2', name: 'Mateo Vargas', role: 'Fade Specialist', available: true },
    { id: 'b3', name: 'Dani Silva', role: 'Stylist & Beard', available: true }
  ],
  services: [
    { id: 's1', name: 'Skin Fade Clásico', durationMinutes: 30, price: 20 },
    { id: 's2', name: 'Barba Ritual & Toalla Caliente', durationMinutes: 30, price: 18 },
    { id: 's3', name: 'Combo Completo KUTZ (Pelo + Barba)', durationMinutes: 45, price: 35 }
  ],
  schedule: {
    startHour: 9,
    endHour: 20,
    slotMinutes: 30,
    workDays: [1, 2, 3, 4, 5, 6] // Mon-Sat
  }
};

export const DEFAULT_SHOP_FIXTURE = DEFAULT_SHOP_CONFIG;

export const SHOP_REX_CONFIG = {
  slug: 'barberia-rex',
  name: 'KUTZ // Barbería Rex',
  pin: '7890',
  logo: 'https://luminadesk-gary.netlify.app/rex-logo.png',
  address: 'Avenida Gran Vía 45, Valencia',
  phone: '611998877',
  status: 'active',
  barbers: [
    { id: 'b-rex-1', name: 'Rex "The Blade"', role: 'Master Barber', available: true },
    { id: 'b-rex-2', name: 'Nico Fade', role: 'Fade Specialist', available: true }
  ],
  services: [
    { id: 's-rex-1', name: 'Fade Express', durationMinutes: 30, price: 18 },
    { id: 's-rex-2', name: 'Barba Ritual', durationMinutes: 30, price: 15 },
    { id: 's-rex-3', name: 'Combo VIP', durationMinutes: 45, price: 30 }
  ],
  schedule: {
    startHour: 10,
    endHour: 21,
    slotMinutes: 30,
    workDays: [1, 2, 3, 4, 5, 6]
  }
};

export const SHOP_REX_FIXTURE = SHOP_REX_CONFIG;

export const SHOP_JOSEH_CONFIG = {
  slug: 'joseh-barber',
  name: "CM Salón D’ Campodónico",
  subtitle: 'Joseh_barber.style · Master Barber',
  pin: '2023',
  timezone: 'Atlantic/Canary',
  logo: 'https://luminadesk-gary.netlify.app/logo.png',
  address: 'Av. Alcalde Ginés de la Hoz, 2, Bajo Izq., 35500 Arrecife, Lanzarote',
  phone: '689 014 014',
  description:
    'Barbero profesional con más de 10 años de experiencia 🌟🌟🌟🌟🌟 (4.8/5 en Arrecife). Especialista en degradados de alta precisión (Skin Fade & Taper), visagismo, perfilado de barba a navaja, colorimetría masculina y asesoramiento de imagen VIP.',
  instagramBarber: 'joseh_barber.style',
  instagramSalon: 'cm.salondcampodonico',
  googleReviewUrl:
    "https://www.google.com/maps/search/?api=1&query=CM+Sal%C3%B3n+D%27+Campod%C3%B3nico+Av.+Alcalde+Gin%C3%A9s+de+la+Hoz+2+Arrecife",
  status: 'active',
  configVersion: 2,
  barbers: [
    {
      id: 'joseh',
      name: 'José (Joseh_barber.style)',
      role: 'Master Barber · +10 años exp. 🌟🌟🌟🌟🌟',
      specialty: 'Degradados, Barba & Color',
      available: true
    }
  ],
  services: [
    { id: 's1', name: 'Lunes a jueves Corte (incluye cejas)', durationMinutes: 60, price: 20, priceLabel: '20€', dayGroup: 'mon-thu' },
    { id: 's2', name: 'Viernes y Sábado Corte', durationMinutes: 60, price: 20, priceLabel: '20€', dayGroup: 'fri-sat' },
    { id: 's3', name: 'Viernes y Sábado Corte y cejas', durationMinutes: 60, price: 23, priceLabel: '23€', dayGroup: 'fri-sat' },
    { id: 's4', name: 'Corte y barba (incluye cejas)', durationMinutes: 60, price: 30, priceLabel: '30€', dayGroup: 'all' },
    { id: 's5', name: 'Barba (incluye contornos y cejas)', durationMinutes: 30, price: 15, priceLabel: '15€', dayGroup: 'all' },
    { id: 's6', name: 'Cejas', durationMinutes: 15, price: 5, priceLabel: '5€', dayGroup: 'all' },
    { id: 's7', name: 'Lavado cabello', durationMinutes: 15, price: 5, priceLabel: '5€', dayGroup: 'all' },
    { id: 's8', name: 'Perfilados (incluye cejas)', durationMinutes: 30, price: 10, priceLabel: '10€', dayGroup: 'all' },
    { id: 's9', name: 'Tinte semipermanente en cejas', durationMinutes: 15, price: 5, priceLabel: '5€', dayGroup: 'all' },
    { id: 's10', name: 'Tinte semipermanente en barba', durationMinutes: 30, price: 10, priceLabel: '10€', dayGroup: 'all' },
    { id: 's11', name: 'Mascarilla facial con exfoliante', durationMinutes: 30, price: 15, priceLabel: '15€', dayGroup: 'all' },
    { id: 's12', name: 'Mechas o mechón', durationMinutes: 60, price: 20, priceLabel: 'desde 20€/35€', dayGroup: 'all' },
    { id: 's13', name: 'Mechas o mechón blanco', durationMinutes: 90, price: 40, priceLabel: '40€/50€', dayGroup: 'all' },
    { id: 's14', name: 'Tinte superior', durationMinutes: 60, price: 25, priceLabel: 'desde 25€/45€', dayGroup: 'all' },
    { id: 's15', name: 'Tinte completo blanco', durationMinutes: 120, price: 60, priceLabel: 'desde 60€/70€/80€/100€', dayGroup: 'all' },
    { id: 's16', name: 'Color semipermanente añadido', durationMinutes: 15, price: 5, priceLabel: '5€ cada uno', dayGroup: 'all' }
  ],
  schedule: {
    startHour: 9,
    endHour: 20,
    openTime: '10:00',
    closeTime: '18:00',
    slotMinutes: 60,
    slotIntervalMinutes: 60,
    workDays: [1, 2, 3, 4, 5, 6],
    hoursByDay: {
      1: { openTime: '10:00', closeTime: '18:00' },
      2: { openTime: '10:00', closeTime: '18:00' },
      3: { openTime: '10:00', closeTime: '18:00' },
      4: { openTime: '10:00', closeTime: '18:00' },
      5: { openTime: '09:00', closeTime: '20:30' },
      6: { openTime: '09:00', closeTime: '15:00' }
    }
  }
};

export const SHOP_CAMPODONICO_NAILS_CONFIG = {
  slug: 'campodonico-nails',
  name: "CM Salón D’ Campodónico · Nails & Beauty",
  subtitle: 'Uñas Acrílicas, Manicura, Pedicura & Estética',
  vertical: 'nails',
  theme: 'rose-luxury',
  pin: '2023',
  timezone: 'Atlantic/Canary',
  logo: 'https://luminadesk-gary.netlify.app/logo.png',
  address: 'Av. Alcalde Ginés de la Hoz, 2, Bajo Izq., 35500 Arrecife, Lanzarote',
  phone: '638 877 945',
  description:
    'Estudio especializado en Uñas Acrílicas esculpidas (Tallas S, M y L), Rellenos de alta precisión, Manicura Semipermanente con refuerzo, Pedicura completa & Spa e Higiene Facial profunda en Arrecife, Lanzarote.',
  instagramSalon: 'cm.salondcampodonico',
  googleReviewUrl:
    "https://www.google.com/maps/search/?api=1&query=CM+Sal%C3%B3n+D%27+Campod%C3%B3nico+Av.+Alcalde+Gin%C3%A9s+de+la+Hoz+2+Arrecife",
  status: 'active',
  configVersion: 2,
  barbers: [
    {
      id: 'campodonico-nails-1',
      name: 'Especialista Nails (D’ Campodónico)',
      chair: 'MESA NAILS 1',
      role: 'Master Nail Artist · Acrílicas, Gel & Nail Art',
      specialty: 'Uñas Acrílicas & Manicura',
      available: true
    },
    {
      id: 'campodonico-spa-2',
      name: 'Especialista Pedicura & Cabina Facial',
      chair: 'CABINA SPA 2',
      role: 'Pedicura Spa & Cuidado Facial',
      specialty: 'Pedicura Completa & Higiene Facial',
      available: true
    }
  ],
  services: [
    { id: 'cn1', name: 'Uñas acrílicas Talla S', durationMinutes: 90, price: 45, priceLabel: '45€', category: 'acrilicas', dayGroup: 'all' },
    { id: 'cn2', name: 'Uñas acrílicas Talla M/L', durationMinutes: 105, price: 50, priceLabel: '50€', category: 'acrilicas', dayGroup: 'all' },
    { id: 'cn3', name: 'Relleno acrílico', durationMinutes: 75, price: 35, priceLabel: '35€', category: 'acrilicas', dayGroup: 'all' },
    { id: 'cn4', name: 'Manicura semipermanente con refuerzo', durationMinutes: 60, price: 25, priceLabel: '25€', category: 'manicura', dayGroup: 'all' },
    { id: 'cn5', name: 'Manicura / Limpieza tradicional', durationMinutes: 45, price: 20, priceLabel: '20€', category: 'manicura', dayGroup: 'all' },
    { id: 'cn6', name: 'Pedicura completa & Spa', durationMinutes: 60, price: 30, priceLabel: '30€', category: 'pedicura', dayGroup: 'all' },
    { id: 'cn7', name: 'Retiro semipermanente', durationMinutes: 15, price: 5, priceLabel: '5€', category: 'retiros', dayGroup: 'all' },
    { id: 'cn8', name: 'Retiro tradicional', durationMinutes: 15, price: 3, priceLabel: '3€', category: 'retiros', dayGroup: 'all' },
    { id: 'cn9', name: 'Reparación uña caída', durationMinutes: 15, price: 3, priceLabel: '3€', category: 'retiros', dayGroup: 'all' },
    { id: 'cn10', name: 'Higiene facial profunda', durationMinutes: 60, price: 35, priceLabel: '35€', category: 'facial', dayGroup: 'all' }
  ],
  schedule: {
    startHour: 9,
    endHour: 20,
    openTime: '10:00',
    closeTime: '19:00',
    slotMinutes: 30,
    slotIntervalMinutes: 30,
    workDays: [1, 2, 3, 4, 5, 6],
    hoursByDay: {
      1: { openTime: '10:00', closeTime: '19:00' },
      2: { openTime: '10:00', closeTime: '19:00' },
      3: { openTime: '10:00', closeTime: '19:00' },
      4: { openTime: '10:00', closeTime: '19:00' },
      5: { openTime: '09:30', closeTime: '20:00' },
      6: { openTime: '09:30', closeTime: '15:00' }
    }
  }
};

export const SHOP_SALON_ESTETICA_CONFIG = {
  slug: 'peluqueria-estetica',
  name: 'Lumina · Peluquería & Estética (Sin Uñas)',
  subtitle: 'Estilismo Femenino, Colorimetría Orgánica & Cabina Facial',
  vertical: 'peluqueria',
  theme: 'rose-luxury',
  pin: '2023',
  timezone: 'Atlantic/Canary',
  logo: 'https://luminadesk-gary.netlify.app/logo.png',
  address: 'Av. Alcalde Ginés de la Hoz, 2, 35500 Arrecife, Lanzarote',
  phone: '638 877 945',
  description:
    'Salón de Peluquería Femenina y Centro de Estética Avanzada. Especialistas en Colorimetría Orgánica, Mechas Balayage, Bótox Capilar, Higiene Facial con Ultrasonidos, Radiofrecuencia, Drenaje Corporal y Diseño de Mirada.',
  instagramSalon: 'cm.salondcampodonico',
  googleReviewUrl:
    "https://www.google.com/maps/search/?api=1&query=CM+Sal%C3%B3n+D%27+Campod%C3%B3nico+Av.+Alcalde+Gin%C3%A9s+de+la+Hoz+2+Arrecife",
  status: 'active',
  configVersion: 2,
  barbers: [
    {
      id: 'estilista-color',
      name: 'Elena (Colorimetría & Balayage)',
      chair: 'TOCADOR 1',
      role: 'Directora de Salón · Colorista & Mechas',
      specialty: 'Balayage, Babylights & Tinte Orgánico',
      available: true
    },
    {
      id: 'estilista-corte',
      name: 'Sofía (Corte, Brushing & Keratina)',
      chair: 'TOCADOR 2',
      role: 'Estilista Capilar · Visagismo & Tratamientos',
      specialty: 'Corte, Brushing & Botox Capilar',
      available: true
    },
    {
      id: 'cabina-facial',
      name: 'Valeria (Cabina Facial & Corporal)',
      chair: 'CABINA ESTÉTICA 3',
      role: 'Especialista Estética Facial & Mirada',
      specialty: 'Higiene Facial, Radiofrecuencia & Cejas',
      available: true
    }
  ],
  services: [
    { id: 'pe1', name: 'Corte y Peinado / Brushing', durationMinutes: 60, price: 32, priceLabel: '32€', category: 'peluqueria', dayGroup: 'all' },
    { id: 'pe2', name: 'Color / Tinte de Raíz Orgánico', durationMinutes: 75, price: 38, priceLabel: '38€', category: 'peluqueria', dayGroup: 'all' },
    { id: 'pe3', name: 'Mechas Balayage / Babylights + Matiz', durationMinutes: 120, price: 85, priceLabel: '85€', category: 'peluqueria', dayGroup: 'all' },
    { id: 'pe4', name: 'Tratamiento Hidratación / Keratina / Botox Capilar', durationMinutes: 75, price: 55, priceLabel: '55€', category: 'peluqueria', dayGroup: 'all' },
    { id: 'pe5', name: 'Higiene Facial Profunda + Ultrasonidos', durationMinutes: 60, price: 45, priceLabel: '45€', category: 'facial', dayGroup: 'all' },
    { id: 'pe6', name: 'Radiofrecuencia / Rejuvenecimiento Facial', durationMinutes: 60, price: 50, priceLabel: '50€', category: 'facial', dayGroup: 'all' },
    { id: 'pe7', name: 'Peeling Luminosidad & Vitaminas', durationMinutes: 45, price: 48, priceLabel: '48€', category: 'facial', dayGroup: 'all' },
    { id: 'pe8', name: 'Masaje Relajante / Drenaje Corporal', durationMinutes: 60, price: 40, priceLabel: '40€', category: 'corporal', dayGroup: 'all' },
    { id: 'pe9', name: 'Diseño de Cejas & Lifting de Pestañas', durationMinutes: 45, price: 30, priceLabel: '30€', category: 'mirada', dayGroup: 'all' }
  ],
  schedule: {
    startHour: 9,
    endHour: 20,
    openTime: '09:30',
    closeTime: '19:30',
    slotMinutes: 30,
    slotIntervalMinutes: 30,
    workDays: [1, 2, 3, 4, 5, 6],
    hoursByDay: {
      1: { openTime: '09:30', closeTime: '19:30' },
      2: { openTime: '09:30', closeTime: '19:30' },
      3: { openTime: '09:30', closeTime: '19:30' },
      4: { openTime: '09:30', closeTime: '19:30' },
      5: { openTime: '09:30', closeTime: '20:00' },
      6: { openTime: '09:30', closeTime: '15:00' }
    }
  }
};

/**
 * Resolves the active specialty vertical ('barber' | 'nails' | 'peluqueria')
 */
export function getShopVertical(shop = null, slug = '', businessMode = '') {
  const cleanSlug = normalizeShopSlug(slug || shop?.slug || '');
  if (
    cleanSlug === 'campodonico-nails' ||
    cleanSlug === 'campodonico-unas' ||
    shop?.vertical === 'nails' ||
    businessMode === 'nails'
  ) {
    return 'nails';
  }
  if (
    cleanSlug === 'peluqueria-estetica' ||
    cleanSlug === 'salon-estetica' ||
    shop?.vertical === 'peluqueria' ||
    shop?.vertical === 'estetica' ||
    businessMode === 'peluqueria' ||
    businessMode === 'estetica'
  ) {
    return 'peluqueria';
  }
  return 'barber';
}

export function isFemaleVertical(verticalOrSlug = '') {
  const v = String(verticalOrSlug || '').toLowerCase();
  return (
    v === 'nails' ||
    v === 'peluqueria' ||
    v === 'estetica' ||
    v.includes('nails') ||
    v.includes('unas') ||
    v.includes('peluqueria') ||
    v.includes('estetica')
  );
}

/**
 * Normalizes tenant shop slugs to lowercase alphanumeric with single hyphens
 */
export function normalizeShopSlug(rawSlug) {
  if (!rawSlug || typeof rawSlug !== 'string') return '';
  return rawSlug
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Sanitizes shop names removing HTML/script tags
 */
export function sanitizeShopName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  return rawName.replace(/<[^>]*>/g, '').trim();
}

/**
 * Validates tenant configuration schema
 */
export function validateTenantConfig(config) {
  if (!config || typeof config !== 'object') {
    return { valid: false, error: 'Config must be an object' };
  }
  if (!config.slug || typeof config.slug !== 'string' || !/^[a-z0-9-]+$/.test(config.slug)) {
    return { valid: false, error: 'Slug must be lowercase alphanumeric with hyphens' };
  }
  if (config.slug.length > 64) {
    return { valid: false, error: 'El slug no puede superar 64 caracteres', code: 'ERR_SLUG_TOO_LONG' };
  }
  if (!config.name || typeof config.name !== 'string' || config.name.trim().length === 0) {
    return { valid: false, error: 'Shop name is required' };
  }
  if (!config.pin || typeof config.pin !== 'string' || !/^\d{4}$/.test(config.pin)) {
    return { valid: false, error: 'El PIN debe tener 4 dígitos numéricos' };
  }
  if (!Array.isArray(config.barbers) || config.barbers.length === 0) {
    return { valid: false, error: 'Debe asignar al menos un barbero activo' };
  }
  if (!Array.isArray(config.services) || config.services.length === 0) {
    return { valid: false, error: 'Debe asignar al menos un servicio' };
  }
  return { valid: true };
}

/**
 * 4-tier tenant slug resolution cascade:
 * Tier 1: URL path /r/:shopSlug
 * Tier 2: URL query param ?shop=:slug or ?shopSlug=:slug
 * Tier 3: LocalStorage kutz_active_shop_slug
 * Tier 4: Default fallback 'kutz-madrid'
 */
export function resolveTenantSlug(location = null, storage = null) {
  // Tier 1: URL path
  if (location) {
    const pathname = typeof location === 'string' ? location : location.pathname;
    if (pathname && typeof pathname === 'string') {
      const match = pathname.match(/^\/r\/([^/?#]+)/i);
      if (match && match[1]) {
        let raw = match[1];
        try {
          raw = decodeURIComponent(raw);
        } catch {
          // ignore uri decode error
        }
        const normalized = normalizeShopSlug(raw);
        if (normalized) return normalized;
      }
    }

    // Tier 2: URL search params
    const search = typeof location === 'string'
      ? (location.includes('?') ? location.slice(location.indexOf('?')) : '')
      : location.search;
    if (search && typeof search === 'string') {
      try {
        const params = new URLSearchParams(search);
        const querySlug = params.get('shop') || params.get('shopSlug');
        if (querySlug) {
          const normalized = normalizeShopSlug(querySlug);
          if (normalized) return normalized;
        }
      } catch {
        // ignore search params error
      }
    }
  }

  // Tier 3: LocalStorage preference
  const effectiveStorage = storage 
    || (typeof window !== 'undefined' ? window.localStorage : null) 
    || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
  if (effectiveStorage && typeof effectiveStorage.getItem === 'function') {
    try {
      const stored = effectiveStorage.getItem('kutz_active_shop_slug');
      if (stored) {
        const normalized = normalizeShopSlug(stored);
        if (normalized) return normalized;
      }
    } catch {
      // ignore storage error
    }
  }

  // Tier 4: Default fallback
  return DEFAULT_SHOP_SLUG;
}

/**
 * Constructs canonical customer portal booking URL
 */
export function buildCustomerPortalUrl(origin, slug) {
  const defaultOrigin =
    typeof window !== 'undefined' && /^https?:\/\//i.test(window.location?.origin || '')
      ? window.location.origin
      : 'https://luminadesk-gary.netlify.app';
  const cleanOrigin = (origin || defaultOrigin).replace(/\/+$/, '');
  const cleanSlug = normalizeShopSlug(slug) || DEFAULT_SHOP_SLUG;
  return `${cleanOrigin}/r/${cleanSlug}`;
}

/**
 * Generates an RFC 5545 .ics calendar file containing the appointment & direct rebooking URL
 */
export function buildAppointmentIcsContent({
  title = 'Cita en Barbería',
  description = '',
  location = '',
  date = '',
  timeSlot = '10:00',
  durationMinutes = 30,
  bookingUrl = '',
} = {}) {
  const safeDate = String(date || '').replace(/[^0-9]/g, '');
  const [hhRaw, mmRaw] = String(timeSlot || '10:00').split(':');
  const startH = Math.max(0, Math.min(23, Number(hhRaw) || 10));
  const startM = Math.max(0, Math.min(59, Number(mmRaw) || 0));
  const dur = Math.max(15, Number(durationMinutes) || 30);

  let y = 2026;
  let mo = 1;
  let d = 1;
  if (safeDate.length === 8) {
    y = Number(safeDate.slice(0, 4));
    mo = Number(safeDate.slice(4, 6));
    d = Number(safeDate.slice(6, 8));
  } else {
    const now = new Date();
    y = now.getFullYear();
    mo = now.getMonth() + 1;
    d = now.getDate();
  }

  const startDt = new Date(Date.UTC(y, mo - 1, d, startH, startM, 0));
  const endDt = new Date(startDt.getTime() + dur * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const fmtLocal = (dt) =>
    `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00`;
  const stamp = fmtLocal(new Date()) + 'Z';
  const esc = (s) =>
    String(s || '')
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');

  const fullDesc = bookingUrl
    ? `${description ? `${description}\n` : ''}Volver a reservar directo: ${bookingUrl}`
    : description;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KUTZ Barber OS//Reservas//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}-${Math.random().toString(36).slice(2, 8)}@kutz-barber`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${fmtLocal(startDt)}`,
    `DTEND:${fmtLocal(endDt)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(fullDesc)}`,
    location ? `LOCATION:${esc(location)}` : null,
    bookingUrl ? `URL:${bookingUrl}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}

export function downloadAppointmentIcs(params = {}, filename = 'cita-barberia.ics') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const content = buildAppointmentIcsContent(params);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function getPublicClientProfileKey(slug) {
  return `kutz_public_client_profile_${normalizeShopSlug(slug) || DEFAULT_SHOP_SLUG}`;
}

export function loadSavedPublicClientProfile(slug, storage = null) {
  const s = storage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!s) return null;
  try {
    const raw = s.getItem(getPublicClientProfileKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || (!parsed.clientName && !parsed.clientPhone)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePublicClientProfile(slug, profile, storage = null) {
  const s = storage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!s || !profile) return;
  try {
    s.setItem(
      getPublicClientProfileKey(slug),
      JSON.stringify({
        clientName: String(profile.clientName || '').trim(),
        clientPhone: String(profile.clientPhone || '').trim(),
        lastServiceId: profile.lastServiceId || '',
        lastServiceName: profile.lastServiceName || '',
        savedAt: new Date().toISOString(),
      })
    );
  } catch {
    // ignore
  }
}

export function clearPublicClientProfile(slug, storage = null) {
  const s = storage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!s) return;
  try {
    s.removeItem(getPublicClientProfileKey(slug));
  } catch {
    // ignore
  }
}

export function buildSalonVCardContent({
  name = 'KUTZ Barber',
  phone = '',
  address = '',
  bookingUrl = '',
  instagram = '',
} = {}) {
  const cleanName = String(name || 'Barbería').replace(/[\r\n;]/g, ' ').trim();
  const cleanPhone = String(phone || '').replace(/[^\d+\s-]/g, '').trim();
  const cleanAddress = String(address || '').replace(/[\r\n;]/g, ' ').trim();
  const noteParts = [
    bookingUrl ? `Reserva tu cita online en 10 segundos: ${bookingUrl}` : '',
    instagram ? `Instagram: ${instagram}` : '',
  ].filter(Boolean);

  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${cleanName}`,
    `ORG:${cleanName}`,
    cleanPhone ? `TEL;TYPE=CELL,VOICE:${cleanPhone}` : null,
    cleanAddress ? `ADR;TYPE=WORK:;;${cleanAddress};;;;` : null,
    bookingUrl ? `URL:${bookingUrl}` : null,
    noteParts.length ? `NOTE:${noteParts.join(' | ')}` : null,
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\r\n');
}

export function downloadSalonVCard(params = {}, filename = 'contacto-barberia.vcf') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const content = buildSalonVCardContent(params);
  const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function buildWhatsAppAutoReplyTemplate(shopName = 'nuestra barbería', portalUrl = '') {
  return `¡Hola! 💈 Gracias por escribir a ${shopName}.\nPara ver huecos libres y reservar cita en 10 segundos sin esperar, toca aquí 👉 ${portalUrl}`;
}

/**
 * Constructs barber hub management URL with tenant query parameter
 */
export function buildBarberHubUrl(slug, origin = '') {
  const cleanSlug = normalizeShopSlug(slug) || DEFAULT_SHOP_SLUG;
  const prefix = origin ? origin.replace(/\/+$/, '') : '';
  return `${prefix}/?shop=${cleanSlug}`;
}

/**
 * Constructs emergency tel: URL with normalized phone
 */
export function buildEmergencyPhoneLink(shopPhone) {
  if (!shopPhone || typeof shopPhone !== 'string') return '';
  const digits = shopPhone.replace(/[^\d+]/g, '');
  if (!digits) return '';
  return `tel:${digits}`;
}

/**
 * Normalizes Spanish 9-digit phones with '34' prefix for WhatsApp wa.me links
 */
export function formatWhatsAppPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits || digits.length < 9) return '';
  if (digits.length === 9) {
    return `34${digits}`;
  }
  return digits;
}

/**
 * Constructs a valid WhatsApp wa.me click-to-chat URL with normalized country prefix
 */
export function buildWhatsAppUrl(phone, text = '') {
  const waPhone = formatWhatsAppPhone(phone);
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return waPhone ? `https://wa.me/${waPhone}${query}` : `https://wa.me/${query}`;
}

/**
 * Returns local date (YYYY-MM-DD) and minutes in the shop's timezone (Atlantic/Canary or Europe/Madrid)
 */
export function getShopLocalDateTime(shop = null, now = new Date()) {
  const dateObj = now instanceof Date ? now : new Date(now);
  const addressStr = String(shop?.address || '').toLowerCase();
  const isCanary =
    shop?.timezone === 'Atlantic/Canary' ||
    shop?.slug === 'joseh-barber' ||
    addressStr.includes('lanzarote') ||
    addressStr.includes('arrecife') ||
    addressStr.includes('canarias') ||
    addressStr.includes('tenerife') ||
    addressStr.includes('las palmas');
  const timeZone = shop?.timezone || (isCanary ? 'Atlantic/Canary' : 'Europe/Madrid');

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(dateObj);
    const map = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }
    const year = Number(map.year);
    const month = Number(map.month);
    const day = Number(map.day);
    const hours = Number(map.hour === '24' ? '0' : map.hour);
    const minutes = Number(map.minute);
    const isoDate = `${map.year}-${map.month}-${map.day}`;
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return {
      isoDate,
      hours,
      minutes,
      totalMinutes: hours * 60 + minutes,
      dayOfWeek,
      timeZone
    };
  } catch {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const h = dateObj.getHours();
    const min = dateObj.getMinutes();
    return {
      isoDate: `${y}-${m}-${d}`,
      hours: h,
      minutes: min,
      totalMinutes: h * 60 + min,
      dayOfWeek: dateObj.getDay(),
      timeZone
    };
  }
}

/**
 * Validates if a pathname corresponds to a standalone public booking page
 */
export function isPublicBookingPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  const segments = decoded.split('/').filter(Boolean);
  const resolved = [];
  for (const seg of segments) {
    if (seg === '..') resolved.pop();
    else if (seg !== '.') resolved.push(seg);
  }
  const normalized = '/' + resolved.join('/');
  return normalized === '/reservar' || normalized.startsWith('/r/');
}
