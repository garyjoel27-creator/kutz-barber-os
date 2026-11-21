import { getStore } from '@netlify/blobs';

// Memory store fallback for local tests and environments without Netlify credentials
const memoryStore = new Map();

export const STORE_NAME = 'kutz_platform';
export const DEFAULT_SHOP_SLUG = 'kutz-madrid';

export const DEFAULT_SHOP_CONFIG = {
  slug: 'kutz-madrid',
  name: 'KUTZ // BARBER STUDIO',
  pin: '1234',
  status: 'active',
  phone: '+34 912 345 678',
  address: 'Calle de Fuencarral 42, Madrid',
  logo: 'https://luminadesk-gary.netlify.app/logo.png',
  barbers: [
    { id: 'rex', name: 'REX', specialty: 'Degradados & Skin Fade', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300' },
    { id: 'kiko', name: 'KIKO', specialty: 'Corte & Street', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300' },
    { id: 'nico', name: 'NICO', specialty: 'Barba & Tijera', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=300' }
  ],
  services: [
    { id: 'skin-fade', name: 'Skin Fade #000 + Navaja', durationMinutes: 30, price: 18, description: 'Degradado afeitado a cero con navaja y acabado mate' },
    { id: 'taper-fade', name: 'Low Taper + Ritual Toalla', durationMinutes: 35, price: 20, description: 'Taper bajo pulido con toalla caliente infusionada' },
    { id: 'beard-ritual', name: 'Barba & Vapor de Ozono', durationMinutes: 25, price: 15, description: 'Afeitado clásico con vaporizador y bálsamo' },
    { id: 'full-combo', name: 'Full Combo (Corte + Barba)', durationMinutes: 50, price: 30, description: 'Servicio completo de corte degradado y arreglo de barba' }
  ],
  schedule: {
    openTime: '10:00',
    closeTime: '20:30',
    slotIntervalMinutes: 30,
    workDays: [1, 2, 3, 4, 5, 6],
    daysOpen: [1, 2, 3, 4, 5, 6] // Mon-Sat
  },
  createdAt: 1763000000000,
  updatedAt: 1763000000000
};

export const DEFAULT_CLIENTS = [
  {
    id: '1',
    name: 'Marcos Varela',
    phone: '+34 611 223 344',
    treatment: 'Mid Fade + Barba',
    treatments: [
      {
        id: 't-1',
        name: 'Mid Fade + Barba',
        formula: 'Base #0.5 → Peine #1.5 palanca abierta. Barba perfilada con navaja',
        notes: 'Remolino en coronilla derecha; peinar hacia adelante',
        date: '28 Oct 2026',
        timestamp: 1761609600000
      }
    ],
    reliabilityScore: 100,
    noShowCount: 0
  },
  {
    id: '2',
    name: 'Dani Morales',
    phone: '+34 633 445 566',
    treatment: 'Low Taper + Ritual Toalla',
    treatments: [
      {
        id: 't-2',
        name: 'Low Taper + Ritual Toalla',
        formula: 'Taper bajo en patillas y nuca. Tijera texturizada superior',
        notes: 'Piel sensible en cuello; usar loción sin alcohol',
        date: '29 Oct 2026',
        timestamp: 1761696000000
      }
    ],
    reliabilityScore: 95,
    noShowCount: 0
  },
  {
    id: '3',
    name: 'Álex Rivera',
    phone: '+34 622 334 455',
    treatment: 'Skin Fade #000 + Navaja',
    treatments: [
      {
        id: 't-3',
        name: 'Skin Fade #000 + Navaja',
        formula: 'Base Shaver #000 → #0.5 → #1.5. Acabado mate polvo volumen',
        notes: 'Pelo grueso muy denso. Pulir bien zona occipital',
        date: '29 Oct 2026',
        timestamp: 1761696000000
      }
    ],
    reliabilityScore: 100,
    noShowCount: 0
  }
];

export function isBlobsConfigured() {
  if (typeof process === 'undefined' || !process.env) return false;
  return Boolean(
    process.env.NETLIFY_BLOBS_CONTEXT ||
    (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_TOKEN) ||
    (process.env.NETLIFY && process.env.NETLIFY_SITE_ID)
  );
}

export function resetMemoryStore() {
  memoryStore.clear();
  resetShopLocks();
}

export function getKutzStore() {
  let realStore = null;
  if (isBlobsConfigured()) {
    try {
      realStore = getStore({
        name: STORE_NAME,
        consistency: 'strong'
      });
    } catch (err) {
      console.warn('[BlobsClient] Netlify Blobs init fallback to memory:', err?.message);
    }
  }

  const memAdapter = {
    async get(key, options = {}) {
      const val = memoryStore.get(key);
      if (val === undefined || val === null) return null;
      if (options.type === 'json') {
        try {
          return typeof val === 'string' ? JSON.parse(val) : val;
        } catch {
          return null;
        }
      }
      return val;
    },
    async getJSON(key) {
      const val = memoryStore.get(key);
      if (val === undefined || val === null) return null;
      try {
        return typeof val === 'string' ? JSON.parse(val) : val;
      } catch {
        return null;
      }
    },
    async set(key, value) {
      memoryStore.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    async setJSON(key, value) {
      memoryStore.set(key, JSON.stringify(value));
    },
    async delete(key) {
      memoryStore.delete(key);
    },
    async list(options = {}) {
      const prefix = options.prefix || '';
      const blobs = [];
      for (const [k] of memoryStore.entries()) {
        if (k.startsWith(prefix)) {
          blobs.push({ key: k });
        }
      }
      return { blobs };
    }
  };

  if (!realStore) return memAdapter;

  return {
    async get(key, options = {}) {
      try {
        return await realStore.get(key, options);
      } catch {
        return memAdapter.get(key, options);
      }
    },
    async getJSON(key) {
      try {
        if (typeof realStore.getJSON === 'function') {
          return await realStore.getJSON(key);
        }
        return await realStore.get(key, { type: 'json' });
      } catch {
        return memAdapter.getJSON(key);
      }
    },
    async set(key, value) {
      await memAdapter.set(key, value);
      try {
        await realStore.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      } catch {
        // fallback already stored in memoryStore
      }
    },
    async setJSON(key, value) {
      await memAdapter.setJSON(key, value);
      try {
        if (typeof realStore.setJSON === 'function') {
          await realStore.setJSON(key, value);
        } else {
          await realStore.set(key, JSON.stringify(value));
        }
      } catch {
        // fallback already stored in memoryStore
      }
    },
    async delete(key) {
      await memAdapter.delete(key);
      try {
        await realStore.delete(key);
      } catch {
        // ignore
      }
    },
    async list(options = {}) {
      try {
        return await realStore.list(options);
      } catch {
        return memAdapter.list(options);
      }
    }
  };
}

// Phone normalization helper (last 9 digits)
export function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

// Shop Config Accessor with auto-seed fallback
export async function getShopConfig(shopSlug) {
  const store = getKutzStore();
  const key = `shops/${shopSlug}/config`;
  let config = await store.getJSON(key);
  if (!config && (shopSlug === DEFAULT_SHOP_SLUG || shopSlug === 'default')) {
    config = { ...DEFAULT_SHOP_CONFIG, slug: shopSlug };
    await store.setJSON(key, config);
  } else if (!config && shopSlug === 'barberia-rex') {
    config = {
      ...DEFAULT_SHOP_CONFIG,
      slug: 'barberia-rex',
      name: 'KUTZ // Barbería Rex',
      pin: '7890',
      address: 'Avenida Gran Vía 45, Valencia',
      phone: '+34 611 998 877'
    };
    await store.setJSON(key, config);
  } else if (shopSlug === 'joseh-barber' && (!config || Number(config.configVersion || 1) < 2)) {
    config = {
      ...(config || {}),
      slug: 'joseh-barber',
      name: "CM Salón D’ Campodónico",
      subtitle: 'Joseh_barber.style · Master Barber',
      pin: config?.pin || '2023',
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
      },
      updatedAt: Date.now()
    };
    await store.setJSON(key, config);
  } else if (
    (shopSlug === 'campodonico-nails' || shopSlug === 'campodonico-unas') &&
    (!config || Number(config.configVersion || 1) < 2)
  ) {
    config = {
      ...(config || {}),
      slug: shopSlug,
      name: "CM Salón D’ Campodónico · Nails & Beauty",
      subtitle: 'Uñas Acrílicas, Manicura, Pedicura & Estética',
      vertical: 'nails',
      theme: 'rose-luxury',
      pin: config?.pin || '2023',
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
      },
      updatedAt: Date.now()
    };
    await store.setJSON(key, config);
  } else if (
    (shopSlug === 'peluqueria-estetica' || shopSlug === 'salon-estetica') &&
    (!config || Number(config.configVersion || 1) < 2)
  ) {
    config = {
      ...(config || {}),
      slug: shopSlug,
      name: 'Lumina · Peluquería & Estética (Sin Uñas)',
      subtitle: 'Estilismo Femenino, Colorimetría Orgánica & Cabina Facial',
      vertical: 'peluqueria',
      theme: 'rose-luxury',
      pin: config?.pin || '2023',
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
      },
      updatedAt: Date.now()
    };
    await store.setJSON(key, config);
  }
  return config;
}

export async function setShopConfig(shopSlug, config) {
  const store = getKutzStore();
  await store.setJSON(`shops/${shopSlug}/config`, config);
}

// Appointments Accessor
export async function getShopAppointments(shopSlug) {
  const store = getKutzStore();
  const appointments = await store.getJSON(`shops/${shopSlug}/appointments`);
  return Array.isArray(appointments) ? appointments : [];
}

export async function setShopAppointments(shopSlug, appointments) {
  const store = getKutzStore();
  await store.setJSON(`shops/${shopSlug}/appointments`, appointments);
}

// Queue Accessor
export async function getShopQueue(shopSlug) {
  const store = getKutzStore();
  const queue = await store.getJSON(`shops/${shopSlug}/queue`);
  return Array.isArray(queue) ? queue : [];
}

export async function setShopQueue(shopSlug, queue) {
  const store = getKutzStore();
  await store.setJSON(`shops/${shopSlug}/queue`, queue);
}

// Clients Accessor
export async function getShopClients(shopSlug) {
  const store = getKutzStore();
  const key = `shops/${shopSlug}/clients`;
  let clients = await store.getJSON(key);
  if (!clients && (shopSlug === DEFAULT_SHOP_SLUG || shopSlug === 'default')) {
    clients = DEFAULT_CLIENTS;
    await store.setJSON(key, clients);
  } else if (Array.isArray(clients) && shopSlug !== DEFAULT_SHOP_SLUG && shopSlug !== 'default') {
    // Strip any accidentally seeded Madrid demo clients from real tenant shops
    const demoNames = new Set(['Marcos Varela', 'Dani Morales', 'Álex Rivera', 'Mateo "El Flaco" Vargas']);
    const cleaned = clients.filter(c => !(demoNames.has(c?.name) && (String(c?.id) === '1' || String(c?.id) === '2' || String(c?.id) === '3')));
    if (cleaned.length !== clients.length) {
      clients = cleaned;
      await store.setJSON(key, clients);
    }
  }
  return Array.isArray(clients) ? clients : [];
}

export async function setShopClients(shopSlug, clients) {
  const store = getKutzStore();
  await store.setJSON(`shops/${shopSlug}/clients`, clients);
}

// Master Index Accessor
export async function getShopsIndex() {
  const store = getKutzStore();
  let index = await store.getJSON('shops/index');
  if (!index || !Array.isArray(index.shops)) {
    index = {
      shops: [
        {
          slug: DEFAULT_SHOP_SLUG,
          name: DEFAULT_SHOP_CONFIG.name,
          status: 'active',
          barberCount: DEFAULT_SHOP_CONFIG.barbers.length,
          createdAt: DEFAULT_SHOP_CONFIG.createdAt
        }
      ]
    };
    await store.setJSON('shops/index', index);
  }
  return index;
}

export async function setShopsIndex(index) {
  const store = getKutzStore();
  await store.setJSON('shops/index', index);
}

// Per-shop asynchronous mutex queue for atomic serialized mutations
const shopLocks = new Map();

export async function withShopLock(shopSlug, fn) {
  const currentKey = shopSlug || 'global';
  const prevPromise = shopLocks.get(currentKey) || Promise.resolve();

  let release;
  const lockPromise = new Promise((resolve) => {
    release = resolve;
  });

  // Atomically replace the tail of the per-shop queue
  shopLocks.set(currentKey, lockPromise);

  try {
    // Wait for the previous lock holder to finish (catch any previous errors so queue doesn't hang)
    await prevPromise.catch(() => {});
    return await fn();
  } finally {
    release();
    if (shopLocks.get(currentKey) === lockPromise) {
      shopLocks.delete(currentKey);
    }
  }
}

export function resetShopLocks() {
  shopLocks.clear();
}
