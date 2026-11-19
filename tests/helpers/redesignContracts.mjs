/**
 * Authoritative Interface Contracts, Mathematical Models, and Reference Implementations
 * for KUTZ // BARBER OS Redesign & Usability Overhaul (Requirements R1–R5)
 * Strictly derived from ORIGINAL_REQUEST.md, PROJECT.md, and TEST_INFRA.md
 */

// ============================================================================
// 1. WCAG 2.1 AAA CONTRAST & COLOR METRICS (§R1)
// ============================================================================

export function hexToRgb(hex) {
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return { r, g, b };
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    return { r, g, b };
  }
  if (cleanHex.length === 8) {
    // With alpha: assume blended over #0A0C0F background
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    const a = parseInt(cleanHex.slice(6, 8), 16) / 255;
    return {
      r: Math.round(r * a + 10 * (1 - a)),
      g: Math.round(g * a + 12 * (1 - a)),
      b: Math.round(b * a + 15 * (1 - a))
    };
  }
  return { r: 0, g: 0, b: 0 };
}

/**
 * Calculates sRGB relative luminance according to W3C WCAG 2.1 spec
 */
export function calculateRelativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(val => {
    const s = val / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates WCAG contrast ratio between two hex colors: (L1 + 0.05) / (L2 + 0.05)
 */
export function calculateContrastRatio(colorHex1, colorHex2) {
  const rgb1 = hexToRgb(colorHex1);
  const rgb2 = hexToRgb(colorHex2);
  const lum1 = calculateRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = calculateRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function isWcagAA(ratio, isLargeText = false) {
  return isLargeText ? ratio >= 3.0 : ratio >= 4.5;
}

export function isWcagAAA(ratio, isLargeText = false) {
  return isLargeText ? ratio >= 4.5 : ratio >= 7.0;
}

export const THEME_PALETTE = {
  canvas: '#0A0C0F',
  canvasSubtle: '#101318',
  surface: '#141820',
  surfaceHover: '#1B202B',
  border: '#252A36',
  emerald: '#10B981',
  emeraldLight: '#34D399',
  emeraldDark: '#059669',
  espresso: '#F3F4F6',
  espressoSoft: '#D1D5DB',
  mocha: '#9CA3AF',
  taupe: '#6B7280',
  amber: '#F59E0B'
};

// ============================================================================
// 2. ATMOSPHERIC BACKDROP VALIDATION CONTRACT (§R1)
// ============================================================================

export const ATMOSPHERIC_SPECS = {
  requiredElements: [
    'backdrop-blur',
    'bg-[#0A0C0F]',
    'bg-[#101318]',
    'border-[#252A36]'
  ],
  layers: [
    { name: 'Layer 1: Base Barber Background Photo / Textures', required: true },
    { name: 'Layer 2: Studio Lighting & Scrim Overlays', required: true },
    { name: 'Layer 3: Dark Scrim Veladuras (Contrast Preserving)', required: true },
    { name: 'Layer 4: Frosted Glassmorphism Surfaces (Backdrop Blur)', required: true }
  ]
};

export function validateAtmosphericStructure(sourceCode) {
  if (!sourceCode || typeof sourceCode !== 'string') {
    return { valid: false, missing: ['sourceCode'] };
  }
  const missing = [];
  if (!sourceCode.includes('backdrop-blur') && !sourceCode.includes('backdrop_blur')) {
    missing.push('backdrop-blur');
  }
  if (!sourceCode.includes('#0A0C0F') && !sourceCode.includes('bg-canvas')) {
    missing.push('dark canvas background');
  }
  if (!sourceCode.includes('#101318') && !sourceCode.includes('#141820')) {
    missing.push('obsidian surface styling');
  }
  return {
    valid: missing.length === 0,
    missing,
    hasBackdropBlur: sourceCode.includes('backdrop-blur'),
    hasDarkScrim: sourceCode.includes('0A0C0F') || sourceCode.includes('rgba(0, 0, 0')
  };
}

// ============================================================================
// 3. GPU 3D TRANSFORM UTILITIES CONTRACT (§R2)
// ============================================================================

export const REQUIRED_3D_TRANSFORMS = [
  { className: 'perspective-1000', property: 'perspective', expectedValue: '1000px' },
  { className: 'transform-style-3d', property: 'transform-style', expectedValue: 'preserve-3d' },
  { className: 'backface-hidden', property: 'backface-visibility', expectedValue: 'hidden' },
  { className: 'rotate-y-180', property: 'transform', expectedValue: 'rotateY(180deg)' }
];

export function validate3DTransformCss(cssContent) {
  if (!cssContent || typeof cssContent !== 'string') {
    return { valid: false, missingClasses: REQUIRED_3D_TRANSFORMS.map(t => t.className) };
  }
  const missingClasses = [];
  for (const transform of REQUIRED_3D_TRANSFORMS) {
    if (!cssContent.includes(transform.className)) {
      missingClasses.push(transform.className);
    }
  }
  return {
    valid: missingClasses.length === 0,
    missingClasses,
    hasPerspective: cssContent.includes('perspective') || cssContent.includes('perspective-1000'),
    hasPreserve3D: cssContent.includes('preserve-3d') || cssContent.includes('transform-style-3d'),
    hasBackfaceHidden: cssContent.includes('backface-visibility') || cssContent.includes('backface-hidden'),
    hasRotateY180: cssContent.includes('rotateY(180deg)') || cssContent.includes('rotate-y-180')
  };
}

export function simulate3DCardFlip(currentDegrees = 0) {
  const isCurrentlyFront = currentDegrees % 360 === 0;
  const targetDegrees = isCurrentlyFront ? currentDegrees + 180 : currentDegrees - 180;
  const isFrontVisible = (targetDegrees % 360) === 0;
  const isBackVisible = Math.abs(targetDegrees % 360) === 180;

  return {
    initialAngle: currentDegrees,
    finalAngle: targetDegrees,
    isFlipped: isBackVisible,
    frontFaceTransform: `rotateY(${targetDegrees}deg)`,
    backFaceTransform: `rotateY(${targetDegrees + 180}deg)`,
    isFrontVisible,
    isBackVisible
  };
}

// ============================================================================
// 4. CLIENT STORE EXTENSIONS & FADE ALERT ENGINE (§R2)
// ============================================================================

export function parseBarberDate(dateVal, timestampVal) {
  if (timestampVal && !isNaN(Number(timestampVal))) {
    return new Date(Number(timestampVal));
  }
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'number') return new Date(dateVal);

  const str = String(dateVal).trim();
  if (/^\d{10,}$/.test(str)) {
    return new Date(Number(str));
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return new Date(str);
  }

  const spanishMonths = {
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11
  };
  const clean = str.toLowerCase().replace(/,/g, '').replace(/\bde\b/g, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const month = spanishMonths[parts[1].slice(0, 3)];
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Evaluates Fade urgency and days remaining based on standard urban barbershop 15-21 day cycle
 */
export function getFadeAlert(client, referenceDate = new Date()) {
  if (!client) {
    return { alertLevel: 'normal', label: 'Sin datos', daysRemaining: 21, elapsedDays: 0, requiresRetouch: false };
  }

  const refTime = referenceDate instanceof Date ? referenceDate.getTime() : new Date(referenceDate).getTime();
  const treatments = Array.isArray(client.treatments) ? client.treatments : [];

  const barberKeywords = ['fade', 'degradado', 'taper', 'mullet', 'crop', 'barba', 'navaja', 'corte', 'ritual', 'shaver'];
  const barberServices = treatments.filter(t => {
    const name = (t.name || '').toLowerCase();
    const notes = (t.notes || '').toLowerCase();
    const formula = (t.formula || '').toLowerCase();
    return barberKeywords.some(kw => name.includes(kw) || notes.includes(kw) || formula.includes(kw));
  }).sort((a, b) => {
    const tA = parseBarberDate(a.date, a.timestamp).getTime();
    const tB = parseBarberDate(b.date, b.timestamp).getTime();
    return tB - tA;
  });

  if (barberServices.length === 0) {
    return {
      alertLevel: 'normal',
      label: 'Nuevo cliente',
      daysRemaining: 15,
      elapsedDays: 0,
      badgeColor: '#10B981',
      requiresRetouch: false
    };
  }

  const latest = barberServices[0];
  const lastTime = parseBarberDate(latest.date, latest.timestamp).getTime();
  const elapsedDays = Math.max(0, Math.floor((refTime - lastTime) / (1000 * 60 * 60 * 24)));

  if (elapsedDays >= 21) {
    return {
      alertLevel: 'urgent',
      label: `🔥 Retoque urgente (${elapsedDays}d)`,
      daysRemaining: 0,
      elapsedDays,
      badgeColor: '#EF4444',
      requiresRetouch: true
    };
  } else if (elapsedDays >= 15) {
    const remaining = 21 - elapsedDays;
    return {
      alertLevel: 'warning',
      label: `Retoque en ${remaining} días`,
      daysRemaining: remaining,
      elapsedDays,
      badgeColor: '#F59E0B',
      requiresRetouch: true
    };
  } else {
    const remaining = 15 - elapsedDays;
    return {
      alertLevel: 'normal',
      label: 'Fade fresco',
      daysRemaining: remaining,
      elapsedDays,
      badgeColor: '#10B981',
      requiresRetouch: false
    };
  }
}

export function updateClientContract(clientsList, id, patch) {
  if (!Array.isArray(clientsList) || !id) return clientsList || [];
  return clientsList.map(c => {
    if (String(c.id) === String(id)) {
      return { ...c, ...patch };
    }
    return c;
  });
}

export function quickAddSessionContract(clientsList, id, sessionData) {
  if (!Array.isArray(clientsList) || !id || !sessionData) return clientsList || [];
  const now = new Date();
  const sessionTimestamp = sessionData.timestamp || (sessionData.date ? parseBarberDate(sessionData.date).getTime() : Date.now());
  const newTreatment = {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: sessionData.serviceName || 'Corte & Fade en Sillón',
    date: sessionData.date || `${now.getDate()} ${['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][now.getMonth()]} ${now.getFullYear()}`,
    timestamp: sessionTimestamp,
    formula: sessionData.formula || 'Base Shaver #000 -> #0.5 -> #1.5',
    notes: sessionData.notes || '',
    ritual: sessionData.ritual || '',
    barber: sessionData.barber || 'Barbero Titular'
  };

  return clientsList.map(c => {
    if (String(c.id) === String(id)) {
      const existing = Array.isArray(c.treatments) ? c.treatments : [];
      return {
        ...c,
        lastService: newTreatment.name,
        lastVisit: newTreatment.date,
        treatments: [newTreatment, ...existing]
      };
    }
    return c;
  });
}

// ============================================================================
// 5. 3D BENTO FLIP CARD INTERACTION MODEL (§R2)
// ============================================================================

export function createBentoCardState(client, isHero = false) {
  return {
    client,
    isHero,
    isFlipped: false,
    flipCount: 0,
    audioTriggered: false,
    hapticTriggered: false
  };
}

export function triggerCardFlip(cardState, soundFx = null) {
  const nextFlipped = !cardState.isFlipped;
  const audioTriggered = soundFx?.playFlip ? soundFx.playFlip() : true;
  const hapticTriggered = soundFx?.triggerHaptic ? soundFx.triggerHaptic(12) : true;

  return {
    ...cardState,
    isFlipped: nextFlipped,
    flipCount: cardState.flipCount + 1,
    audioTriggered,
    hapticTriggered
  };
}

// ============================================================================
// 6. PROCEDURAL WEB AUDIO SYNTHESIS & HAPTICS CONTRACT (§R4)
// ============================================================================

export class MockAudioParam {
  constructor(defaultValue = 0) {
    this.value = defaultValue;
    this.events = [];
  }
  setValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'setValueAtTime', value: val, time });
  }
  exponentialRampToValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'exponentialRampToValueAtTime', value: val, time });
  }
  linearRampToValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'linearRampToValueAtTime', value: val, time });
  }
}

export class MockAudioNode {
  constructor(type = 'generic') {
    this.type = type;
    this.nodeCategory = type;
    this.connectedTo = null;
    this.frequency = new MockAudioParam(440);
    this.gain = new MockAudioParam(1);
    this.started = false;
    this.stopped = false;
  }
  connect(dest) {
    this.connectedTo = dest;
    return dest;
  }
  start(time = 0) {
    this.started = true;
    this.startTime = time;
  }
  stop(time = 0) {
    this.stopped = true;
    this.stopTime = time;
  }
}

export class MockAudioContext {
  constructor(initialState = 'running') {
    this.state = initialState;
    this.currentTime = 0;
    this.destination = new MockAudioNode('destination');
    this.createdNodes = [];
    this.resumed = false;
  }
  resume() {
    this.state = 'running';
    this.resumed = true;
    return Promise.resolve();
  }
  createOscillator() {
    const osc = new MockAudioNode('oscillator');
    this.createdNodes.push(osc);
    return osc;
  }
  createGain() {
    const gain = new MockAudioNode('gain');
    this.createdNodes.push(gain);
    return gain;
  }
  createBiquadFilter() {
    const filter = new MockAudioNode('filter');
    this.createdNodes.push(filter);
    return filter;
  }
}

export class MockNavigator {
  constructor(hasVibrate = true) {
    this.vibrateLogs = [];
    if (hasVibrate) {
      this.vibrate = (pattern) => {
        this.vibrateLogs.push(pattern);
        return true;
      };
    }
  }
}

/**
 * Authoritative soundFx procedural synthesizer model strictly following PROJECT.md
 */
export const SoundFxEngine = {
  playFlip(ctx = null) {
    const audioCtx = ctx || (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : new MockAudioContext());
    if (audioCtx.state === 'suspended') {
      try {
        const p = audioCtx.resume();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch {}
    }
    const now = audioCtx.currentTime || 0;

    // Procedural frequency sweep: 180Hz -> 320Hz over 120ms
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.12);

    return {
      played: true,
      sweepStart: 180,
      sweepEnd: 320,
      durationMs: 120,
      wave: 'sine'
    };
  },

  playClick(ctx = null) {
    const audioCtx = ctx || (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : new MockAudioContext());
    if (audioCtx.state === 'suspended') {
      try {
        const p = audioCtx.resume();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch {}
    }
    const now = audioCtx.currentTime || 0;

    // Transient pulse: 600Hz -> 200Hz over 30ms
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.03);

    return {
      played: true,
      startFreq: 600,
      endFreq: 200,
      durationMs: 30,
      wave: 'triangle'
    };
  },

  triggerHaptic(duration = 10, navObj = null) {
    const nav = navObj || (typeof navigator !== 'undefined' ? navigator : null);
    if (nav && typeof nav.vibrate === 'function') {
      try {
        const safeDuration = Math.max(0, Math.min(duration, 500));
        return nav.vibrate(safeDuration);
      } catch {
        return false;
      }
    }
    return false;
  }
};

// ============================================================================
// 7. DASHBOARD DECLUTTERING & COGNITIVE GLANCE CONTRACT (§R3)
// ============================================================================

export function evaluateDashboardCognitiveGlance(viewportElements) {
  // Owner glance comprehension criteria:
  // 1. Live Chairs view in foreground
  // 2. Active walk-in queue / waitlist visible
  // 3. Quick action for today's clients
  // 4. Secondary metrics hidden inside drawers/accordions
  const primaryVisible = viewportElements.filter(e => e.isPrimary && !e.isCollapsed);
  const secondaryCollapsed = viewportElements.filter(e => !e.isPrimary && e.isCollapsed);

  return {
    comprehensionWithin3Seconds: primaryVisible.length <= 5 && secondaryCollapsed.length >= 2,
    primaryCount: primaryVisible.length,
    secondaryCollapsedCount: secondaryCollapsed.length,
    hasChairs: primaryVisible.some(e => e.id === 'chairs'),
    hasWalkInQueue: primaryVisible.some(e => e.id === 'walkin-queue'),
    hasQuickActions: primaryVisible.some(e => e.id === 'quick-actions')
  };
}

// ============================================================================
// 8. BENTO GRID RESPONSIVE ERGONOMICS CONTRACT (§R2, §R4)
// ============================================================================

export function getBentoGridColumns(viewportWidth) {
  if (viewportWidth < 640) {
    return { columns: 1, isMobile: true, heroSpansAll: true };
  } else if (viewportWidth < 1024) {
    return { columns: 2, isTablet: true, heroSpansAll: false };
  } else {
    return { columns: 3, isDesktop: true, heroSpansAll: false };
  }
}

// ============================================================================
// 9. REAL-WORLD BARBER WORKLOAD FIXTURES (§Tier 4)
// ============================================================================

export const MOCK_BARBERSHOP_STATE = {
  chairs: [
    { id: 1, name: 'Sillón 01 (Master)', barber: 'Marcos Fade', status: 'occupied', client: 'Álex Rivera', service: 'Skin Fade Alto #000', elapsedMin: 18 },
    { id: 2, name: 'Sillón 02 (Razor)', barber: 'Dani Razor', status: 'occupied', client: 'Carlos Gómez', service: 'Barba Ritual Vapor', elapsedMin: 25 },
    { id: 3, name: 'Sillón 03 (Texture)', barber: 'Mateo Crop', status: 'available', client: null, service: null, elapsedMin: 0 }
  ],
  walkInQueue: [
    { id: 'w1', name: 'Javier Peña', service: 'Mid Drop Fade', waitTimeMinutes: 12, phone: '+34600112233' },
    { id: 'w2', name: 'Lucas Vidal', service: 'Taper Fade + Barba', waitTimeMinutes: 24, phone: '+34611223344' },
    { id: 'w3', name: 'Enrique Soto', service: 'Afeitado Clásico', waitTimeMinutes: 35, phone: '+34622334455' }
  ],
  vipClients: [
    {
      id: '3',
      name: 'Álex Rivera',
      phone: '+34 622 11 22 33',
      photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600',
      bonos: [{ id: 'b1', name: 'Bono 5 Skin Fades VIP', totalSessions: 5, usedSessions: 3, active: true }],
      treatments: [
        {
          id: 't-101',
          name: 'Skin Fade Alto + Ritual Barba',
          date: '10 Oct 2026',
          timestamp: new Date('2026-10-10T11:00:00Z').getTime(),
          formula: 'Shaver #000 -> #0.5 palanca abierta -> #1.5 conector. Tijera superior 4cm textura',
          notes: 'Remolino izquierdo en coronilla; no tocar demasiado arriba. Piel sensible tras afeitado navaja.',
          ritual: 'Toalla caliente con mentol + aftershave sin alcohol'
        }
      ]
    },
    {
      id: '4',
      name: 'Carlos Mendoza',
      phone: '+34 633 44 55 66',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=600',
      bonos: [],
      treatments: [
        {
          id: 't-102',
          name: 'Low Taper Fade',
          date: '28 Sep 2026',
          timestamp: new Date('2026-09-28T16:00:00Z').getTime(),
          formula: 'Guarda #1 -> #2 suave. Mantener volumen en laterales.',
          notes: 'Piel reactiva en nuca.',
          ritual: 'Aceite de barba sándalo'
        }
      ]
    }
  ]
};
