/**
 * Authoritative Interface Contracts, Mathematical Models, and In-Memory Mocks
 * for KUTZ // BARBER OS QR Booking Engine & Multi-Shop Platform (Features 1–12)
 * Strictly derived from ORIGINAL_REQUEST.md, PROJECT.md, and TEST_INFRA.md
 */

import { MockLocalStorageWithQuota } from './contracts.mjs';

// ============================================================================
// 1. IN-MEMORY NETLIFY BLOBS EMULATOR (Zero Cloud Credentials Required)
// ============================================================================

export class MockBlobsStore {
  constructor(storeName = 'kutz_platform') {
    this.storeName = storeName;
    this.data = new Map();
  }

  async get(key, options = {}) {
    if (!this.data.has(key)) return null;
    const val = this.data.get(key);
    if (options.type === 'json') {
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    }
    return val;
  }

  async getJSON(key) {
    return this.get(key, { type: 'json' });
  }

  async set(key, value) {
    if (typeof value === 'object' && value !== null) {
      this.data.set(key, JSON.stringify(value));
    } else {
      this.data.set(key, String(value));
    }
  }

  async setJSON(key, value) {
    this.data.set(key, JSON.stringify(value));
  }

  async delete(key) {
    return this.data.delete(key);
  }

  async list(options = {}) {
    const prefix = options.prefix || '';
    const blobs = [];
    for (const key of this.data.keys()) {
      if (key.startsWith(prefix)) {
        blobs.push({ key });
      }
    }
    return { blobs };
  }

  clear() {
    this.data.clear();
  }
}

export const mockBlobsPlatform = new MockBlobsStore('kutz_platform');

// ============================================================================
// 2. AUTHORITATIVE FIXTURES & DATA SCHEMAS
// ============================================================================

export const DEFAULT_SHOP_FIXTURE = {
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
    workDays: [1, 2, 3, 4, 5, 6] // Mon-Sat (Sunday closed)
  }
};

export const SHOP_REX_FIXTURE = {
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

export const INITIAL_CLIENTS_FIXTURE = [
  {
    id: '3',
    name: 'Álex Rivera',
    phone: '+34 622 456 789',
    formula: 'Base Shaver #000 → #0.5 (1 dedo) → #1.5 especial palanca a la mitad → #2 y #3 en conexión',
    notes: 'Remolino pronunciado en coronilla derecha. Piel sensible reactiva tras afeitado.',
    vipBono: { active: true, totalSessions: 4, usedSessions: 1, cutsRemaining: 3 },
    reliabilityScore: 100,
    lastVisit: '10 Oct 2026'
  },
  {
    id: '1',
    name: 'Mateo Vargas',
    phone: '+34 600 123 456',
    formula: 'Base Shaver #000 → #0.5 a 1 dedo → #1.5 palanca abierta → #3 en conexión',
    notes: 'Prefiere peinado hacia la derecha con pomada mate.',
    vipBono: { active: true, totalSessions: 4, usedSessions: 3, cutsRemaining: 1 },
    reliabilityScore: 100,
    lastVisit: '01 Nov 2026'
  },
  {
    id: '2',
    name: 'Carlos Mendoza',
    phone: '622334455',
    formula: 'Taper Fade Bajo #0.5 → Tijera texturizada arriba',
    notes: 'Degradado medio sin marcar patillas.',
    vipBono: { active: false, totalSessions: 0, usedSessions: 0, cutsRemaining: 0 },
    reliabilityScore: 90,
    lastVisit: '15 Oct 2026'
  }
];

// ============================================================================
// 3. UTILITY CONTRACTS & ALGORITHMS (Normalization, Holds, Privacy)
// ============================================================================

/**
 * Normalizes customer phone numbers to clean 9-digit format (Spanish standard)
 * or international digits if starting with '+'
 */
export function normalizePhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  const trimmed = rawPhone.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+')) {
    // Preserve international format digits (e.g. "+33 6 12 34 56 78" -> "33612345678")
    // If it's Spanish +34, strip the 34 country code for standard 9-digit matching
    if (digits.startsWith('34') && digits.length === 11) {
      return digits.slice(2);
    }
    return digits;
  }

  // Double zero prefix standard 0034...
  if (digits.startsWith('0034') && digits.length === 13) {
    return digits.slice(4);
  }

  if (digits.length >= 9) {
    return digits.slice(-9);
  }
  return digits;
}

/**
 * Formats a normalized phone for WhatsApp wa.me links
 */
export function formatWhatsAppPhone(phone) {
  const norm = normalizePhone(phone);
  if (!norm) return '';
  // If 9 digits (Spanish standard), prefix with 34
  if (norm.length === 9) {
    return `34${norm}`;
  }
  // Otherwise if already includes country prefix, return as is
  return norm;
}

/**
 * Builds standard WhatsApp deep links with URI encoding
 */
export function buildWhatsAppUrl(phone, text) {
  const waPhone = formatWhatsAppPhone(phone);
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Generates WhatsApp confirmation URL
 */
export function generateWhatsAppConfirmUrl(phone, clientName, serviceName, date, timeSlot, address) {
  const msg = `¡Hola ${clientName}! Tu cita para "${serviceName}" en KUTZ está confirmada para el ${date} a las ${timeSlot}. Te esperamos en ${address}.`;
  return buildWhatsAppUrl(phone, msg);
}

/**
 * Generates WhatsApp rescheduling URL
 */
export function generateWhatsAppRescheduleUrl(phone, clientName, timeSlot, alternativeSlots = []) {
  let altText = '';
  if (alternativeSlots.length > 0) {
    altText = ` Te propongo como alternativa hoy a las ${alternativeSlots.join(' o ')}.`;
  }
  const msg = `Hola ${clientName}, lamentablemente el horario de las ${timeSlot} no está disponible.${altText} ¿Te viene bien cambiarlo?`;
  return buildWhatsAppUrl(phone, msg);
}

/**
 * Validates public state boundary for GDPR compliance (zero leakage of private CRM data)
 */
export function validatePublicStateGdprBoundary(publicState) {
  if (!publicState || typeof publicState !== 'object') {
    return { valid: false, violations: ['Invalid public state payload'] };
  }
  const violations = [];
  const serialized = JSON.stringify(publicState).toLowerCase();

  // Strict privacy checks: No recipes, no formulas, no client notes, no full phone lists
  if (serialized.includes('#000') || serialized.includes('shaver') || serialized.includes('palanca')) {
    violations.push('CRM cutting recipe leaked in public state');
  }
  if (serialized.includes('remolino') || serialized.includes('piel reactiva') || serialized.includes('sensible')) {
    violations.push('Private client clinical/skin notes leaked in public state');
  }
  if (publicState.clients && Array.isArray(publicState.clients)) {
    violations.push('Full clients roster array present in public state');
  }
  if (serialized.includes('clientphone') || serialized.includes('clientname')) {
    violations.push('Private client PII (phone or name) leaked in public state');
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

/**
 * Anti-collision temporary slot hold engine (10-minute hold TTL)
 */
export class SlotHoldManager {
  constructor(defaultTtlSeconds = 600) {
    this.defaultTtl = defaultTtlSeconds * 1000;
    this.holds = new Map(); // key: `${shopSlug}:${barberId}:${date}:${timeSlot}`
  }

  acquireHold(shopSlug, barberId, date, timeSlot, clientPhone, ttlMs = this.defaultTtl) {
    const key = `${shopSlug}:${barberId}:${date}:${timeSlot}`;
    const now = Date.now();

    if (this.holds.has(key)) {
      const existing = this.holds.get(key);
      if (now < existing.expiresAt) {
        if (existing.clientPhone === normalizePhone(clientPhone)) {
          return { success: true, renewed: true, hold: existing };
        }
        return { success: false, reason: 'slot_held_by_other', expiresAt: existing.expiresAt };
      }
    }

    const hold = {
      key,
      shopSlug,
      barberId,
      date,
      timeSlot,
      clientPhone: normalizePhone(clientPhone),
      createdAt: now,
      expiresAt: now + ttlMs
    };
    this.holds.set(key, hold);
    return { success: true, renewed: false, hold };
  }

  releaseHold(shopSlug, barberId, date, timeSlot) {
    const key = `${shopSlug}:${barberId}:${date}:${timeSlot}`;
    return this.holds.delete(key);
  }

  isHeld(shopSlug, barberId, date, timeSlot) {
    const key = `${shopSlug}:${barberId}:${date}:${timeSlot}`;
    if (!this.holds.has(key)) return false;
    const hold = this.holds.get(key);
    if (Date.now() >= hold.expiresAt) {
      this.holds.delete(key);
      return false;
    }
    return true;
  }

  getHold(shopSlug, barberId, date, timeSlot) {
    const key = `${shopSlug}:${barberId}:${date}:${timeSlot}`;
    if (!this.isHeld(shopSlug, barberId, date, timeSlot)) return null;
    return this.holds.get(key);
  }

  clear() {
    this.holds.clear();
  }
}

// ============================================================================
// 4. PHONE MATCHING & 3D RECIPE AUTO-LINKING CONTRACT (§11)
// ============================================================================

export function matchClientByPhone(phone, clientsList) {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 9) {
    return { matchFound: false, client: null, isNewClient: true };
  }

  const matches = (clientsList || []).filter(c => normalizePhone(c.phone) === normalized);
  if (matches.length > 0) {
    // If multiple legacy matches exist, pick most recent visit
    const found = matches[0];
    return {
      matchFound: true,
      client: found,
      recipe: found.formula || 'Sin receta registrada',
      notes: found.notes || '',
      vipBono: found.vipBono || { active: false, cutsRemaining: 0 },
      isNewClient: false,
      multipleMatches: matches.length > 1
    };
  }

  return {
    matchFound: false,
    client: null,
    isNewClient: true
  };
}

export function createNewClientFromBooking(bookingPayload) {
  const normalized = normalizePhone(bookingPayload.clientPhone);
  const style = bookingPayload.indicativeStyle || 'Estilo Clásico / A consultar en sillón';
  return {
    id: `client-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: bookingPayload.clientName || 'Cliente QR',
    phone: bookingPayload.clientPhone,
    normalizedPhone: normalized,
    indicativeStyle: style,
    formula: `Estilo Orientativo Inicial: ${style}`,
    notes: bookingPayload.notes || 'Registrado automáticamente vía portal QR móvil',
    vipBono: { active: false, totalSessions: 0, usedSessions: 0, cutsRemaining: 0 },
    reliabilityScore: 100,
    treatments: [],
    createdAt: new Date().toISOString()
  };
}

// ============================================================================
// 5. TENANT CONFIGURATION SCHEMA & VALIDATION (§3, §4)
// ============================================================================

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

// ============================================================================
// 6. BARBER SECURITY PIN & TEST BYPASS (§8)
// ============================================================================

export function checkPinTestBypass(navigatorObj = globalThis.navigator) {
  return navigatorObj && navigatorObj.webdriver === true;
}

export function simulatePinKeypadInput(currentBuffer, key) {
  if (key === 'clear') return '';
  if (key === 'backspace') return currentBuffer.slice(0, -1);
  if (/^\d$/.test(key) && currentBuffer.length < 4) {
    return currentBuffer + key;
  }
  return currentBuffer;
}

// ============================================================================
// 7. CONTRACT REFERENCE IMPLEMENTATION FOR NETLIFY FUNCTIONS V2
// ============================================================================

export async function executeBookingFunctionContract(req, store = mockBlobsPlatform, holdManager = new SlotHoldManager()) {
  const url = new URL(req.url, 'http://localhost');
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Expected path format: /api/shops/:shopSlug/booking or /api/shops/:shopSlug/public-state
  let rawSlug = 'kutz-madrid';
  try {
    rawSlug = pathParts[2] ? decodeURIComponent(pathParts[2]) : 'kutz-madrid';
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid URI encoding in shop slug' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  const shopSlug = rawSlug.trim();
  const subRoute = pathParts[3] || 'public-state';

  // Slug security validation against path traversal
  if (shopSlug.includes('..') || shopSlug.includes('/') || shopSlug.includes('\\') || !/^[a-zA-Z0-9_-]+$/.test(shopSlug)) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid shop slug format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Slug length validation
  if (shopSlug.length > 64) {
    return new Response(JSON.stringify({ success: false, error: 'Slug exceeds maximum length of 64 characters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Verify shop exists in store
  let config = await store.get(`shops/${shopSlug}/config`, { type: 'json' });
  if (!config) {
    if (shopSlug === 'kutz-madrid') {
      config = DEFAULT_SHOP_FIXTURE;
    } else if (shopSlug === 'barberia-rex') {
      config = SHOP_REX_FIXTURE;
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Shop not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Check paused shop status
  if (config.status === 'paused') {
    return new Response(JSON.stringify({ success: false, error: 'Barbería temporalmente pausada', paused: true }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // GET: Public state
  if (req.method === 'GET' && subRoute === 'public-state') {
    const queue = (await store.get(`shops/${shopSlug}/queue`, { type: 'json' })) || [];
    const appointments = (await store.get(`shops/${shopSlug}/appointments`, { type: 'json' })) || [];
    const targetDate = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Compute wait minutes
    const waitingItems = queue.filter(q => q.status === 'waiting');
    const estimatedWaitMinutes = waitingItems.reduce((acc, curr) => acc + (curr.durationMinutes || 20), 0);

    // Filter appointments for date to calculate availability
    const now = Date.now();
    const dayAppointments = appointments.filter(a => {
      if (a.date !== targetDate) return false;
      if (a.status === 'confirmed' || a.status === 'seated' || a.status === 'finished') return true;
      if (a.status === 'pending' && a.holdExpiresAt && a.holdExpiresAt > now) return true;
      return false;
    });
    const bookedTimes = new Set(dayAppointments.map(a => `${a.barberId}:${a.timeSlot}`));

    const activeBarbers = (config.barbers || []).filter(b => b.available !== false);
    const slots = [];
    const standardHours = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
                           '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'];

    for (const time of standardHours) {
      for (const barber of activeBarbers) {
        const isBooked = bookedTimes.has(`${barber.id}:${time}`);
        const isHeld = holdManager.isHeld(shopSlug, barber.id, targetDate, time);
        slots.push({
          time,
          barberId: barber.id,
          available: !isBooked && !isHeld
        });
      }
    }

    const publicState = {
      success: true,
      shop: {
        slug: config.slug,
        name: config.name,
        logo: config.logo,
        address: config.address,
        phone: config.phone,
        status: config.status,
        barbers: activeBarbers.map(b => ({ id: b.id, name: b.name, role: b.role })),
        services: config.services,
        schedule: config.schedule
      },
      availability: {
        date: targetDate,
        slots
      },
      queue: {
        count: waitingItems.length,
        waitMinutes: estimatedWaitMinutes,
        entries: waitingItems.map((item, idx) => ({
          position: idx + 1,
          ticket: item.ticket || `#W${String(idx + 1).padStart(2, '0')}`,
          waitMinutes: (idx + 1) * 20
        }))
      }
    };

    return new Response(JSON.stringify(publicState), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // POST: Create booking (Mode 1 appointment or Mode 2 walkin)
  if (req.method === 'POST' && subRoute === 'booking') {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Empty or malformed payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ success: false, error: 'Empty or malformed payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { type, clientName, clientPhone, barberId, serviceId, date, timeSlot, indicativeStyle, notes } = body;

    // Required fields check
    if (!clientName || !clientPhone) {
      return new Response(JSON.stringify({ success: false, error: 'clientName and clientPhone are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Phone validation (minimum 9 digits)
    const normalizedPhone = normalizePhone(clientPhone);
    if (!normalizedPhone || normalizedPhone.length < 9) {
      return new Response(JSON.stringify({ success: false, error: 'Introduce un teléfono válido de 9 dígitos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Notes length boundary check (max 250)
    if (notes && notes.length > 250) {
      return new Response(JSON.stringify({ success: false, error: 'Notes exceed 250 character limit' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // MODE 1: Appointment booking
    if (type === 'appointment') {
      if (!date || !timeSlot) {
        return new Response(JSON.stringify({ success: false, error: 'date and timeSlot are required for appointments' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check operating hours boundary
      const [hour, min] = timeSlot.split(':').map(Number);
      const startH = config.schedule?.startHour ?? 9;
      const endH = config.schedule?.endHour ?? 20;

      if (hour < startH || hour > endH || (hour === endH && min > 0)) {
        return new Response(JSON.stringify({ success: false, error: 'Horario fuera del horario comercial' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check closed business day (e.g. Sunday = 0)
      const appointmentDate = new Date(date);
      const dayOfWeek = appointmentDate.getUTCDay(); // 0 = Sun
      if (config.schedule?.workDays && !config.schedule.workDays.includes(dayOfWeek)) {
        return new Response(JSON.stringify({ success: false, error: 'La barbería permanece cerrada este día' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Service duration boundary check (e.g. 45 min service at 19:30 when close is 20:00)
      const selectedService = (config.services || []).find(s => s.id === serviceId);
      const duration = selectedService?.durationMinutes || 30;
      const finishHour = hour + Math.floor((min + duration) / 60);
      const finishMin = (min + duration) % 60;
      if (finishHour > endH || (finishHour === endH && finishMin > 0)) {
        return new Response(JSON.stringify({ success: false, error: 'El servicio supera la hora de cierre del local' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Allocate barber if "any"
      let assignedBarberId = barberId;
      if (!assignedBarberId || assignedBarberId === 'any' || assignedBarberId === 'Cualquiera') {
        const availableBarber = (config.barbers || []).find(b => b.available !== false);
        assignedBarberId = availableBarber ? availableBarber.id : 'b1';
      }

      // Check existing appointments for slot collision
      const now = Date.now();
      const existingAppointments = (await store.get(`shops/${shopSlug}/appointments`, { type: 'json' })) || [];
      const alreadyBooked = existingAppointments.some(a => {
        if (a.date !== date || a.timeSlot !== timeSlot || a.barberId !== assignedBarberId) return false;
        if (a.status === 'confirmed' || a.status === 'seated' || a.status === 'finished') return true;
        if (a.status === 'pending' && a.holdExpiresAt && a.holdExpiresAt > now) return true;
        return false;
      });
      if (alreadyBooked) {
        return new Response(JSON.stringify({ success: false, error: 'Horario ya reservado', code: 'SLOT_COLLISION' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Acquire hold lock
      const holdResult = holdManager.acquireHold(shopSlug, assignedBarberId, date, timeSlot, clientPhone);
      if (!holdResult.success) {
        return new Response(JSON.stringify({ success: false, error: 'Slot currently held', code: 'SLOT_HELD' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const bookingId = `book-${Date.now()}`;
      const newAppointment = {
        id: bookingId,
        shopSlug,
        type: 'appointment',
        clientName,
        clientPhone: normalizedPhone,
        rawPhone: clientPhone,
        barberId: assignedBarberId,
        serviceId: serviceId || 's1',
        serviceName: selectedService?.name || 'Corte',
        date,
        timeSlot,
        durationMinutes: duration,
        indicativeStyle: indicativeStyle || 'Skin Fade Clásico',
        notes: notes || '',
        status: 'pending',
        holdExpiresAt: holdResult.hold.expiresAt,
        createdAt: new Date().toISOString()
      };

      existingAppointments.push(newAppointment);
      await store.setJSON(`shops/${shopSlug}/appointments`, existingAppointments);

      return new Response(JSON.stringify({
        success: true,
        bookingId,
        status: 'pending',
        appointment: newAppointment,
        holdExpiresAt: holdResult.hold.expiresAt
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // MODE 2: Walk-in live queue
    if (type === 'walkin') {
      const existingQueue = (await store.get(`shops/${shopSlug}/queue`, { type: 'json' })) || [];

      // Capacity limit check (e.g. max 20)
      if (existingQueue.filter(q => q.status === 'waiting').length >= 20) {
        return new Response(JSON.stringify({ success: false, error: 'Cola completa por hoy. Por favor reserva cita previa.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Duplicate phone in queue check
      const duplicate = existingQueue.find(q => q.clientPhone === normalizedPhone && q.status === 'waiting');
      if (duplicate) {
        return new Response(JSON.stringify({
          success: true,
          ticketId: duplicate.id,
          ticket: duplicate.ticket,
          position: duplicate.position,
          waitMinutes: duplicate.waitMinutes,
          alreadyInQueue: true
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const ticketNumber = existingQueue.length + 1;
      const ticketId = `wq-${Date.now()}`;
      const position = existingQueue.filter(q => q.status === 'waiting').length + 1;
      const waitMinutes = (position - 1) * 20;

      const newQueueItem = {
        id: ticketId,
        ticket: `#W${String(ticketNumber).padStart(2, '0')}`,
        shopSlug,
        type: 'walkin',
        clientName,
        clientPhone: normalizedPhone,
        rawPhone: clientPhone,
        barberId: barberId || 'any',
        serviceId: serviceId || 's1',
        indicativeStyle: indicativeStyle || 'Low Taper Fade',
        status: 'waiting',
        position,
        waitMinutes,
        durationMinutes: 20,
        createdAt: new Date().toISOString()
      };

      existingQueue.push(newQueueItem);
      await store.setJSON(`shops/${shopSlug}/queue`, existingQueue);

      return new Response(JSON.stringify({
        success: true,
        bookingId: ticketId,
        ticketId,
        ticket: newQueueItem.ticket,
        status: 'waiting',
        position,
        waitMinutes
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid booking type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // DELETE: Self-cancellation from mobile client
  if (req.method === 'DELETE' && subRoute === 'booking') {
    const ticketId = url.searchParams.get('ticketId');
    if (!ticketId) {
      return new Response(JSON.stringify({ success: false, error: 'ticketId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const queue = (await store.get(`shops/${shopSlug}/queue`, { type: 'json' })) || [];
    const index = queue.findIndex(q => q.id === ticketId);
    if (index === -1) {
      return new Response(JSON.stringify({ success: false, error: 'Ticket not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    queue.splice(index, 1);
    // Renumber remaining waiting positions
    let pos = 1;
    for (const item of queue) {
      if (item.status === 'waiting') {
        item.position = pos;
        item.waitMinutes = (pos - 1) * 20;
        pos++;
      }
    }
    await store.setJSON(`shops/${shopSlug}/queue`, queue);

    return new Response(JSON.stringify({ success: true, message: 'Ticket cancelled' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function executeSyncFunctionContract(req, store = mockBlobsPlatform, holdManager = new SlotHoldManager()) {
  const url = new URL(req.url, 'http://localhost');
  const pathParts = url.pathname.split('/').filter(Boolean);
  const shopSlug = pathParts[2] || 'kutz-madrid';

  // Slug traversal check
  if (shopSlug.includes('..') || !/^[a-z0-9-]+$/.test(shopSlug)) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid shop slug' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let config = await store.get(`shops/${shopSlug}/config`, { type: 'json' });
  if (!config) {
    if (shopSlug === 'kutz-madrid') config = DEFAULT_SHOP_FIXTURE;
    else if (shopSlug === 'barberia-rex') config = SHOP_REX_FIXTURE;
    else {
      return new Response(JSON.stringify({ success: false, error: 'Shop not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Security: PIN Header verification
  const pinHeader = req.headers.get('x-shop-pin');
  if (!pinHeader) {
    return new Response(JSON.stringify({ success: false, error: 'PIN header x-shop-pin is required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  if (pinHeader !== config.pin) {
    return new Response(JSON.stringify({ success: false, error: `Invalid PIN for shop ${shopSlug}` }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // GET: Barber Sync Snapshot
  if (req.method === 'GET') {
    const appointments = (await store.get(`shops/${shopSlug}/appointments`, { type: 'json' })) || [];
    const queue = (await store.get(`shops/${shopSlug}/queue`, { type: 'json' })) || [];
    let clients = (await store.get(`shops/${shopSlug}/clients`, { type: 'json' }));
    if (!clients) {
      clients = INITIAL_CLIENTS_FIXTURE;
      await store.setJSON(`shops/${shopSlug}/clients`, clients);
    }

    return new Response(JSON.stringify({
      success: true,
      appointments,
      queue,
      clients,
      config
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // POST: Barber Action Dispatch
  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Empty or malformed payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!body || !body.action) {
      return new Response(JSON.stringify({ success: false, error: 'Action is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { action, payload = {} } = body;
    const appointments = (await store.get(`shops/${shopSlug}/appointments`, { type: 'json' })) || [];
    const queue = (await store.get(`shops/${shopSlug}/queue`, { type: 'json' })) || [];
    let clients = (await store.get(`shops/${shopSlug}/clients`, { type: 'json' })) || INITIAL_CLIENTS_FIXTURE;

    // Action: Approve appointment
    if (action === 'approve') {
      const apt = appointments.find(a => a.id === payload.bookingId);
      if (!apt) {
        return new Response(JSON.stringify({ success: false, error: 'Appointment not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Idempotency check: already confirmed
      if (apt.status === 'confirmed') {
        return new Response(JSON.stringify({ success: true, updatedState: apt, idempotent: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      apt.status = 'confirmed';

      // Auto-link client profile & recipe
      const match = matchClientByPhone(apt.clientPhone, clients);
      if (match.matchFound) {
        apt.clientCardId = match.client.id;
        apt.recipeFormula = match.recipe;
        apt.vipBono = match.vipBono;
      } else {
        // Auto-create client profile with chosen style
        const newClient = createNewClientFromBooking(apt);
        clients.push(newClient);
        await store.setJSON(`shops/${shopSlug}/clients`, clients);
        apt.clientCardId = newClient.id;
        apt.recipeFormula = newClient.formula;
      }

      await store.setJSON(`shops/${shopSlug}/appointments`, appointments);

      const whatsappUrl = generateWhatsAppConfirmUrl(
        apt.clientPhone,
        apt.clientName,
        apt.serviceName || 'Corte',
        apt.date,
        apt.timeSlot,
        config.address
      );

      return new Response(JSON.stringify({
        success: true,
        updatedState: apt,
        whatsappUrl
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Action: Reject appointment
    if (action === 'reject') {
      const apt = appointments.find(a => a.id === payload.bookingId);
      if (!apt) {
        return new Response(JSON.stringify({ success: false, error: 'Appointment not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      apt.status = 'rejected';
      apt.rejectReason = payload.reason || 'Rechazada por barbero';
      holdManager.releaseHold(shopSlug, apt.barberId, apt.date, apt.timeSlot);
      await store.setJSON(`shops/${shopSlug}/appointments`, appointments);

      const whatsappUrl = generateWhatsAppRescheduleUrl(
        apt.clientPhone,
        apt.clientName,
        apt.timeSlot,
        ['12:30', '16:00']
      );

      return new Response(JSON.stringify({
        success: true,
        updatedState: apt,
        whatsappUrl
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Action: Seat client in chair
    if (action === 'seat') {
      const apt = appointments.find(a => a.id === payload.bookingId);
      if (!apt) {
        return new Response(JSON.stringify({ success: false, error: 'Appointment not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      apt.status = 'seated';
      apt.chairId = payload.chairId || 1;
      apt.seatedAt = new Date().toISOString();

      // If client has active VIP bono, debit 1 session
      if (apt.clientCardId) {
        const client = clients.find(c => c.id === apt.clientCardId);
        if (client && client.vipBono && client.vipBono.active && client.vipBono.cutsRemaining > 0) {
          client.vipBono.cutsRemaining -= 1;
          client.vipBono.usedSessions = (client.vipBono.usedSessions || 0) + 1;
          await store.setJSON(`shops/${shopSlug}/clients`, clients);
        }
      }

      await store.setJSON(`shops/${shopSlug}/appointments`, appointments);

      return new Response(JSON.stringify({ success: true, updatedState: apt }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Action: Seat walk-in from queue
    if (action === 'seat_walkin') {
      const item = queue.find(q => q.id === payload.queueId || q.id === payload.ticketId);
      if (!item) {
        return new Response(JSON.stringify({ success: false, error: 'Queue item not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      item.status = 'in_chair';
      item.chairId = payload.chairId || 1;
      item.seatedAt = new Date().toISOString();

      // Renumber remaining queue items
      let pos = 1;
      for (const q of queue) {
        if (q.status === 'waiting') {
          q.position = pos;
          q.waitMinutes = (pos - 1) * 20;
          pos++;
        }
      }

      await store.setJSON(`shops/${shopSlug}/queue`, queue);
      return new Response(JSON.stringify({ success: true, updatedState: item }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Action: Finish cut and record recipe updates
    if (action === 'finish') {
      const apt = appointments.find(a => a.id === payload.bookingId);
      if (apt) {
        apt.status = 'completed';
        apt.finishedAt = new Date().toISOString();
        if (payload.formula) {
          apt.recipeFormula = payload.formula;
        }
        await store.setJSON(`shops/${shopSlug}/appointments`, appointments);
      }
      return new Response(JSON.stringify({ success: true, updatedState: apt }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, error: `Unknown action ${action}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function executeAdminFunctionContract(req, store = mockBlobsPlatform) {
  const url = new URL(req.url, 'http://localhost');
  const pathParts = url.pathname.split('/').filter(Boolean);
  const shopSlug = pathParts[3]; // e.g. /api/admin/shops/:shopSlug

  // Master admin authorization check
  const adminKey = req.headers.get('x-admin-key');
  if (adminKey !== 'kutz-superadmin-2026') {
    return new Response(JSON.stringify({ success: false, error: 'Acceso no autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // GET: List all registered shops
  if (req.method === 'GET' && !shopSlug) {
    const index = (await store.get('shops/index', { type: 'json' })) || ['kutz-madrid'];
    const shops = [];
    for (const slug of index) {
      const cfg = await store.get(`shops/${slug}/config`, { type: 'json' });
      if (cfg) {
        shops.push({
          slug: cfg.slug,
          name: cfg.name,
          status: cfg.status || 'active',
          barberCount: cfg.barbers?.length || 0,
          serviceCount: cfg.services?.length || 0,
          pin: cfg.pin
        });
      }
    }
    return new Response(JSON.stringify({ success: true, shops }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // POST: Create new shop
  if (req.method === 'POST') {
    const body = await req.json();
    const validation = validateTenantConfig(body);
    if (!validation.valid) {
      return new Response(JSON.stringify({ success: false, error: validation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const index = (await store.get('shops/index', { type: 'json' })) || ['kutz-madrid'];
    if (index.includes(body.slug)) {
      return new Response(JSON.stringify({ success: false, error: 'El identificador de barbería ya existe' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Save config and update index
    await store.setJSON(`shops/${body.slug}/config`, body);
    await store.setJSON(`shops/${body.slug}/appointments`, []);
    await store.setJSON(`shops/${body.slug}/queue`, []);
    index.push(body.slug);
    await store.setJSON('shops/index', index);

    return new Response(JSON.stringify({ success: true, slug: body.slug, shop: body }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // PATCH / PUT: Update shop config
  if ((req.method === 'PATCH' || req.method === 'PUT') && shopSlug) {
    const body = await req.json();
    let cfg = await store.get(`shops/${shopSlug}/config`, { type: 'json' });
    if (!cfg) {
      return new Response(JSON.stringify({ success: false, error: 'Shop not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updated = { ...cfg, ...body };
    await store.setJSON(`shops/${shopSlug}/config`, updated);

    return new Response(JSON.stringify({ success: true, shop: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: false, error: 'Route not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ============================================================================
// 8. OFFLINE-FIRST SYNCHRONIZATION ENGINE SIMULATOR (§2)
// ============================================================================

export class OfflineSyncEngine {
  constructor(shopSlug, options = {}) {
    this.shopSlug = shopSlug;
    this.storage = options.storage || new MockLocalStorageWithQuota();
    this.store = options.store || mockBlobsPlatform;
    this.holdManager = options.holdManager || new SlotHoldManager();
    this.isOnline = options.isOnline !== undefined ? options.isOnline : true;
    this.outboxKey = `kutz_${shopSlug}_outbox`;
    this.appointmentsKey = `kutz_${shopSlug}_appointments`;
    this.queueKey = `kutz_${shopSlug}_queue`;
  }

  setOnlineStatus(online) {
    this.isOnline = Boolean(online);
  }

  getOutbox() {
    const raw = this.storage.getItem(this.outboxKey);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      this.storage.setItem(this.outboxKey, JSON.stringify([]));
      return [];
    }
  }

  saveOutbox(outbox) {
    try {
      this.storage.setItem(this.outboxKey, JSON.stringify(outbox));
    } catch (err) {
      if (err.name === 'QuotaExceededError') {
        // Evict non-essential cache to preserve outbox
        this.storage.removeItem(`kutz_${this.shopSlug}_cache_logs`);
        this.storage.setItem(this.outboxKey, JSON.stringify(outbox));
      } else {
        throw err;
      }
    }
  }

  async dispatchAction(actionObj) {
    if (!this.isOnline) {
      // Buffer in outbox
      const outbox = this.getOutbox();
      const queuedItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        shopSlug: this.shopSlug,
        action: actionObj.action,
        payload: actionObj.payload,
        timestamp: Date.now(),
        retryCount: 0
      };
      outbox.push(queuedItem);
      this.saveOutbox(outbox);
      return { success: true, queued: true, actionId: queuedItem.id };
    }

    // Online execution: dispatch to Netlify Functions contract
    const req = new Request(`http://localhost/api/shops/${this.shopSlug}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shop-pin': '1234'
      },
      body: JSON.stringify(actionObj)
    });

    const res = await executeSyncFunctionContract(req, this.store, this.holdManager);
    return res.json();
  }

  async flushOutbox() {
    if (!this.isOnline) return { success: false, reason: 'offline' };
    const outbox = this.getOutbox();
    if (outbox.length === 0) return { success: true, processed: 0 };

    const failed = [];
    let processed = 0;

    for (const item of outbox) {
      const req = new Request(`http://localhost/api/shops/${this.shopSlug}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shop-pin': '1234'
        },
        body: JSON.stringify({ action: item.action, payload: item.payload })
      });

      try {
        const res = await executeSyncFunctionContract(req, this.store, this.holdManager);
        if (res.status >= 200 && res.status < 300) {
          processed++;
        } else {
          item.retryCount = (item.retryCount || 0) + 1;
          failed.push(item);
        }
      } catch {
        item.retryCount = (item.retryCount || 0) + 1;
        failed.push(item);
      }
    }

    this.saveOutbox(failed);
    return { success: failed.length === 0, processed, remaining: failed.length };
  }
}

// ============================================================================
// EXTENDED CONTRACT HELPERS & CONSTANTS FOR REMEDIATION (Features 2, 4, 5, 7, 8, 9, 12)
// ============================================================================

export const SYNC_INTERVAL_MS = 5000;
export const POLLING_INTERVAL_MS = 5000;
export const MOBILE_TOUCH_TARGET_MIN_PX = 44;

export const BOOKING_MODES = {
  APPOINTMENT: 'appointment',
  WALKIN: 'walkin'
};

/**
 * Validates route isolation: customer portal routes vs private barber routes
 */
export function isPublicBookingPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  // Resolve path traversal sequences safely
  const segments = decoded.split('/').filter(Boolean);
  const resolved = [];
  for (const seg of segments) {
    if (seg === '..') resolved.pop();
    else if (seg !== '.') resolved.push(seg);
  }
  const normalized = '/' + resolved.join('/');
  return normalized === '/reservar' || normalized.startsWith('/r/');
}

/**
 * Validates polling interval start based on environment safety rules
 */
export function shouldStartPollingInterval({ isTestEnv = false, isBrowser = true, documentHidden = false } = {}) {
  if (isTestEnv) return false;
  if (!isBrowser) return false;
  if (documentHidden) return false;
  return true;
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
 * Constructs canonical customer portal booking URL
 */
export function buildCustomerPortalUrl(origin, slug) {
  const cleanOrigin = (origin || 'https://luminadesk-gary.netlify.app').replace(/\/+$/, '');
  const cleanSlug = normalizeShopSlug(slug);
  return `${cleanOrigin}/r/${cleanSlug}`;
}

/**
 * Constructs barber hub management URL with tenant query parameter
 */
export function buildBarberHubUrl(slug, origin = '') {
  const cleanSlug = normalizeShopSlug(slug);
  const prefix = origin ? origin.replace(/\/+$/, '') : '';
  return `${prefix}/?shop=${cleanSlug}`;
}

/**
 * Constructs emergency tel: URL with normalized phone
 */
export function buildEmergencyPhoneLink(shopPhone) {
  const digits = normalizePhone(shopPhone);
  if (!digits) return '';
  return `tel:${digits}`;
}

/**
 * Validates touch target dimensions against minimum 44x44px standard
 */
export function validateTouchTargetMetrics({ width, height }) {
  const w = Number(width);
  const h = Number(height);
  const pass = !isNaN(w) && !isNaN(h) && w >= MOBILE_TOUCH_TARGET_MIN_PX && h >= MOBILE_TOUCH_TARGET_MIN_PX;
  return {
    pass,
    width: w,
    height: h,
    minRequired: MOBILE_TOUCH_TARGET_MIN_PX,
    error: pass ? null : `Touch target ${w}x${h}px is below minimum ${MOBILE_TOUCH_TARGET_MIN_PX}x${MOBILE_TOUCH_TARGET_MIN_PX}px`
  };
}

/**
 * Calculates dynamic wait time based on queue position
 */
export function calculateDynamicWaitMinutes(position, minutesPerClient = 20) {
  const pos = Math.max(1, parseInt(position, 10) || 1);
  return (pos - 1) * minutesPerClient;
}

/**
 * Simulates PIN keypad verification with 5-attempt rate-limiting lockout
 */
export function verifyPinWithRateLimit(enteredPin, correctPin, priorFailures = 0) {
  if (priorFailures >= 5) {
    return {
      authenticated: false,
      lockedOut: true,
      lockoutDurationSeconds: 30,
      attemptsRemaining: 0,
      error: 'Demasiados intentos fallidos. Bloqueado por 30 segundos.'
    };
  }
  const isMatch = String(enteredPin) === String(correctPin);
  const newFailures = isMatch ? 0 : priorFailures + 1;
  const lockedOut = newFailures >= 5;
  return {
    authenticated: isMatch,
    lockedOut,
    lockoutDurationSeconds: lockedOut ? 30 : 0,
    attemptsRemaining: Math.max(0, 5 - newFailures),
    error: isMatch ? null : (lockedOut ? 'Demasiados intentos fallidos. Bloqueado por 30 segundos.' : 'PIN incorrecto')
  };
}

/**
 * Validates QR code URL payload for cleanliness (zero tracking parameters)
 */
export function validateQrPayload(payloadUrl) {
  try {
    const parsed = new URL(payloadUrl);
    const hasTracking = Array.from(parsed.searchParams.keys()).some(k => 
      k.startsWith('utm_') || k === 'fbclid' || k === 'gclid'
    );
    const isValidPath = parsed.pathname.startsWith('/r/');
    const isHttps = parsed.protocol === 'https:';
    return {
      valid: !hasTracking && isValidPath && isHttps,
      isHttps,
      isValidPath,
      hasTracking,
      slug: parsed.pathname.split('/')[2] || ''
    };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Generates printable poster export filename
 */
export function buildPrintablePosterFilename(slug) {
  const cleanSlug = normalizeShopSlug(slug);
  return `cartel-qr-${cleanSlug}.png`;
}

/**
 * Truncates long shop titles cleanly for poster headers
 */
export function formatPosterTitle(shopName, maxChars = 40) {
  const sanitized = sanitizeShopName(shopName);
  if (sanitized.length <= maxChars) return sanitized;
  return sanitized.slice(0, maxChars).trim() + '…';
}

/**
 * Generates client-side pure SVG QR code placeholder markup without network calls
 */
export function generateClientSideQrSvg(dataUrl, size = 256) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="QR Code"><rect width="${size}" height="${size}" fill="#FFFFFF"/><path d="M10 10h60v60h-60z" fill="#000000"/><text x="10" y="240" font-size="8" fill="#666666">${dataUrl}</text></svg>`;
}

/**
 * Production origin security validator
 */
export function validateProductionOrigin(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return {
      valid: parsed.protocol === 'https:',
      isHttps: parsed.protocol === 'https:',
      host: parsed.hostname,
      isNetlifyDomain: parsed.hostname.endsWith('netlify.app')
    };
  } catch {
    return { valid: false, error: 'Malformed URL' };
  }
}

/**
 * Validates accessibility properties for interactive buttons and inputs
 */
export function validateButtonAccessibility(descriptor) {
  const hasLabel = Boolean(descriptor?.['aria-label'] && descriptor['aria-label'].trim().length > 0);
  const hasRole = descriptor?.role === 'button' || descriptor?.tagName === 'BUTTON';
  return { valid: hasLabel && hasRole, hasLabel, hasRole };
}

/**
 * Validates mode switching between canonical booking modes (appointment / walkin)
 */
export function switchBookingMode(current, target) {
  if (!Object.values(BOOKING_MODES).includes(target)) {
    throw new Error(`Invalid booking mode: ${target}`);
  }
  return target;
}

/**
 * Debounced submit handler model for preventing rapid duplicate submissions
 */
export function createDebouncedSubmitHandler(waitMs = 300) {
  let isPending = false;
  let callCount = 0;
  return {
    submit: () => {
      if (isPending) return false;
      isPending = true;
      callCount++;
      return true;
    },
    reset: () => {
      isPending = false;
    },
    getCallCount: () => callCount,
    isPending: () => isPending,
    waitMs
  };
}

/**
 * Copies text with modern Clipboard API when available or fallback prompt
 */
export function copyToClipboardWithFallback(url, hasClipboardApi) {
  if (!url || typeof url !== 'string') {
    throw new Error('Valid URL string is required for clipboard copy');
  }
  if (!hasClipboardApi) {
    return { method: 'prompt_fallback', text: url, success: true };
  }
  return { method: 'clipboard_api', text: url, success: true };
}

/**
 * Safely triggers window.print() with error boundary handling
 */
export function safeTriggerPrint(windowObj = globalThis) {
  try {
    if (windowObj && typeof windowObj.print === 'function') {
      windowObj.print();
      return { success: true, printed: true, cancelled: false };
    }
    return { success: false, printed: false, error: 'print_not_supported' };
  } catch (err) {
    return { success: false, printed: false, cancelled: true, error: err?.message || 'print_failed' };
  }
}


