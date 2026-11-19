/**
 * Authoritative Interface Contracts and Reference Implementations
 * Strictly derived from ORIGINAL_REQUEST.md and PROJECT.md
 */

export const MORPH_WATERMARK = 'LuminaDesk • Atelier & Clinical Management';

export const CLINICAL_PROTOCOLS = {
  peeling: {
    keywords: ['peeling', 'quimico', 'ácido', 'glicolico', 'salicilico', 'retinoico'],
    protocol: 'Protocolo de Cuidados Post-Peeling Químico: SPF 50+, limpiador syndet suave, hidratación reparadora.'
  },
  laser: {
    keywords: ['laser', 'diodo', 'depilacion', 'fototipo', 'potencia', 'eritema'],
    protocol: 'Guía Clínica para Láser Diodo en Cabina: Fototipos I-VI, protección zafiro, gel aloe post-sesión.'
  },
  whatsapp: {
    keywords: ['whatsapp', 'mensaje', 'recordatorio', 'enviar', 'consejo'],
    protocol: 'Mensaje de Seguimiento para WhatsApp: Personalizado, hidratación, SPF 50+, agradecimiento.'
  },
  rosacea: {
    keywords: ['rosacea', 'reactiva', 'sensible', 'rojez', 'cuperosis', 'calmante'],
    protocol: 'Protocolo de Cabina para Piel Reactiva / Rosácea: Niacinamida, Bisabolol, evitar AHA agresivos.'
  },
  consentimiento: {
    keywords: ['consentimiento', 'legal', 'firma', 'formulario', 'contrato'],
    protocol: 'Checklist de Consentimiento Informado: Embarazo/lactancia, fotosensibilizantes, fototipo Fitzpatrick.'
  }
};

/**
 * Normalizes text for case- and accent-insensitive matching
 */
export function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Parses date string (Spanish or ISO) into Date object
 */
export function parseTreatmentDate(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'number') return new Date(dateStr);

  // Check ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return new Date(dateStr);
  }

  // Handle Spanish short dates like "12 Oct 2026" or "15 may 2026"
  const spanishMonths = {
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11
  };
  const parts = dateStr.toLowerCase().replace(/,/g, '').split(/\s+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const monthPrefix = parts[1].slice(0, 3);
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && spanishMonths[monthPrefix] !== undefined && !isNaN(year)) {
      return new Date(year, spanishMonths[monthPrefix], day);
    }
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * CONTRACT R1: Voice Dictation Streaming
 */
export function appendVoiceTranscript(existingNotes, transcript) {
  if (!transcript || !transcript.trim()) return existingNotes || '';
  const cleanTranscript = transcript.trim();
  if (!existingNotes || !existingNotes.trim()) {
    return cleanTranscript;
  }
  const trimmedExisting = existingNotes.trim();
  const lastChar = trimmedExisting.slice(-1);
  if (['.', ',', ';', ':', '!', '?'].includes(lastChar)) {
    return `${trimmedExisting} ${cleanTranscript}`;
  }
  return `${trimmedExisting}. ${cleanTranscript}`;
}

export function checkSpeechSupport(windowObj) {
  if (!windowObj) return false;
  return Boolean(windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition);
}

/**
 * CONTRACT R2: Retention Insights Engine
 */
export function calculateRetentionInsights(client, referenceDate = new Date()) {
  if (!client || !Array.isArray(client.treatments) || client.treatments.length === 0) {
    return [];
  }

  const insights = [];
  const refTime = referenceDate instanceof Date ? referenceDate.getTime() : new Date(referenceDate).getTime();

  // Find latest Botox treatment
  const botoxTreatments = client.treatments
    .filter(t => {
      const name = normalizeText(t.name);
      const notes = normalizeText(t.notes);
      return name.includes('botox') || name.includes('toxina') || notes.includes('botox') || notes.includes('toxina');
    })
    .sort((a, b) => {
      const dateA = parseTreatmentDate(a.date).getTime();
      const dateB = parseTreatmentDate(b.date).getTime();
      return dateB - dateA;
    });

  if (botoxTreatments.length > 0) {
    const latest = botoxTreatments[0];
    const treatmentTime = parseTreatmentDate(latest.date).getTime();
    const elapsedDays = Math.max(0, Math.floor((refTime - treatmentTime) / (1000 * 60 * 60 * 24)));
    const thresholdDays = 90; // 3-4 months / 90-120 days

    if (elapsedDays >= thresholdDays) {
      const urgency = elapsedDays >= 100 ? 'alta' : 'sugerida';
      insights.push({
        id: `retention-botox-${client.id}-${latest.id}`,
        type: 'botox',
        title: 'Retoque de Toxina Botulínica Sugerido',
        treatmentName: latest.name,
        lastDate: latest.date,
        elapsedDays,
        thresholdDays,
        urgency,
        message: `Han transcurrido ${elapsedDays} días desde la última aplicación de neuromodulador. La fuerza muscular comienza a recuperarse.`,
        suggestedAction: {
          type: 'rebook',
          treatmentName: 'Retoque Toxina Botulínica'
        },
        whatsappDraft: `Hola ${client.name} ✨ Desde LuminaDesk queríamos recordarte que han pasado ${elapsedDays} días desde tu sesión de ${latest.name}. Este es el momento ideal para tu retoque preventivo.`
      });
    }
  }

  // Find latest Filler treatment
  const fillerTreatments = client.treatments
    .filter(t => {
      const name = normalizeText(t.name);
      const notes = normalizeText(t.notes);
      return name.includes('relleno') || name.includes('hialuronico') || name.includes('filler') || notes.includes('hialuronico') || notes.includes('filler');
    })
    .sort((a, b) => {
      const dateA = parseTreatmentDate(a.date).getTime();
      const dateB = parseTreatmentDate(b.date).getTime();
      return dateB - dateA;
    });

  if (fillerTreatments.length > 0) {
    const latest = fillerTreatments[0];
    const treatmentTime = parseTreatmentDate(latest.date).getTime();
    const elapsedDays = Math.max(0, Math.floor((refTime - treatmentTime) / (1000 * 60 * 60 * 24)));
    const thresholdDays = 270; // 9-12 months / 270-365 days

    if (elapsedDays >= thresholdDays) {
      const urgency = elapsedDays >= 320 ? 'alta' : (elapsedDays >= 290 ? 'media' : 'sugerida');
      insights.push({
        id: `retention-filler-${client.id}-${latest.id}`,
        type: 'filler',
        title: 'Revisión y Retoque de Relleno Dérmico',
        treatmentName: latest.name,
        lastDate: latest.date,
        elapsedDays,
        thresholdDays,
        urgency,
        message: `Han transcurrido ${elapsedDays} días desde tu relleno dérmico. Se recomienda valoración de volumen y persistencia dérmica.`,
        suggestedAction: {
          type: 'rebook',
          treatmentName: 'Revisión Ácido Hialurónico'
        },
        whatsappDraft: `Hola ${client.name} ✨ Te saludamos desde LuminaDesk. Han transcurrido ${elapsedDays} días desde tu sesión de ${latest.name}. Te sugerimos agendar una valoración dérmica de mantenimiento.`
      });
    }
  }

  return insights;
}

/**
 * CONTRACT R3: Lumina Morph Visualizer
 */
export function validateMorphEligibility(photos) {
  if (!photos || !Array.isArray(photos)) {
    return { eligible: false, count: 0, reason: 'No se encontraron fotografías para este paciente.' };
  }
  const validPhotos = photos.filter(p => p && (typeof p === 'string' ? p.trim().length > 0 : (p.url || p.before || p.after)));
  if (validPhotos.length < 2) {
    return {
      eligible: false,
      count: validPhotos.length,
      reason: 'Lumina Morph requiere al menos 2 fotografías (Antes y Después) para generar la transición temporal.'
    };
  }
  return { eligible: true, count: validPhotos.length };
}

export function calculateMorphOpacity(scrubPercent) {
  const clamped = Math.max(0, Math.min(100, Number(scrubPercent) || 0));
  return Number((clamped / 100).toFixed(4));
}

export function getMorphCycleDuration(speedMultiplier) {
  switch (speedMultiplier) {
    case 0.5: return 4000;
    case 2: return 1000;
    case 1:
    default: return 2000;
  }
}

/**
 * CONTRACT R4: Lumina Concierge Intent Engine
 */
export function processConciergeQuery(rawQuery, clients = [], referenceDate = new Date()) {
  const query = (rawQuery || '').trim();
  if (!query) {
    return {
      intent: 'empty',
      response: 'Por favor indica tu consulta clínica u operativa sobre pacientes, retoques o protocolos.'
    };
  }

  const normalized = normalizeText(query);

  // Intent 1: Retention & Follow-up queries
  const retentionKeywords = ['seguimiento', 'retoque', 'botox', 'relleno', 'pendientes', 'proximo', 'proxima', 'vencido'];
  if (retentionKeywords.some(k => normalized.includes(k))) {
    const overdueList = [];
    for (const client of clients) {
      const insights = calculateRetentionInsights(client, referenceDate);
      if (insights.length > 0) {
        overdueList.push({
          client,
          insights
        });
      }
    }

    if (overdueList.length === 0) {
      return {
        intent: 'retention_followup',
        matches: 0,
        response: '🌟 No hay pacientes con retoques vencidos en este momento. Todos los historiales de Botox y Relleno están al día.'
      };
    }

    const patientSummaries = overdueList.map(item => {
      const types = item.insights.map(i => `${i.title} (${i.elapsedDays} días)`).join(', ');
      return `• **${item.client.name}**: ${types} [Urgencia: ${item.insights[0].urgency.toUpperCase()}]`;
    });

    return {
      intent: 'retention_followup',
      matches: overdueList.length,
      overdueList,
      response: `📋 **Pacientes que requieren seguimiento o retoque (${overdueList.length}):**\n${patientSummaries.join('\n')}\n\nPuedes abrir sus expedientes para agendar la sesión o enviar el recordatorio vía WhatsApp.`
    };
  }

  // Intent 2: Statistics & Clinic Metrics
  const statsKeywords = ['cuantos', 'estadisticas', 'resumen', 'totales', 'metricas', 'balance'];
  if (statsKeywords.some(k => normalized.includes(k))) {
    const totalClients = clients.length;
    let totalTreatments = 0;
    let treatmentsWithPhotos = 0;

    for (const c of clients) {
      const ts = c.treatments || [];
      totalTreatments += ts.length;
      for (const t of ts) {
        if (t.photos?.before || t.photos?.after) {
          treatmentsWithPhotos++;
        }
      }
    }

    return {
      intent: 'statistics',
      stats: { totalClients, totalTreatments, treatmentsWithPhotos },
      response: `📊 **Resumen Estadístico de Cabina:**\n• **Pacientes Registrados: ${totalClients}**\n• **Sesiones Realizadas: ${totalTreatments}**\n• **Evoluciones Fotográficas: ${treatmentsWithPhotos}**\n• **Estado del Sistema:** Offline-first activo con respaldo en LocalStorage.`
    };
  }

  // Intent 3: Specific Patient Lookup
  for (const client of clients) {
    const clientNorm = normalizeText(client.name);
    // Check if query contains the client's first or full name
    const firstName = clientNorm.split(' ')[0];
    if ((firstName.length >= 3 && normalized.includes(firstName)) || normalized.includes(clientNorm)) {
      const treatments = client.treatments || [];
      const allergies = client.allergies || 'Sin alergias registradas';
      const notes = client.notes || 'Sin especificaciones';
      const lastVisit = client.lastVisit || (treatments[0]?.date || 'Sin visitas');

      return {
        intent: 'patient_lookup',
        patient: client,
        response: `👤 **Expediente de ${client.name}:**\n• **Última Visita:** ${lastVisit}\n• **Historial Dérmico / Alergias:** ${allergies}\n• **Preferencias:** ${notes}\n• **Sesiones Registradas:** ${treatments.length}\n• **Teléfono:** ${client.phone || 'No registrado'}`
      };
    }
  }

  // Intent 4: Skincare Clinical Knowledge Base
  for (const [key, item] of Object.entries(CLINICAL_PROTOCOLS)) {
    if (item.keywords.some(k => normalized.includes(k))) {
      return {
        intent: 'protocol_knowledge',
        protocolKey: key,
        response: item.protocol
      };
    }
  }

  // Fallback intent
  return {
    intent: 'fallback',
    response: `🔬 **Recomendación Clínica LuminaDesk:**\nRespecto a "${query}": Se aconseja priorizar la integridad de la barrera cutánea y registrar parámetros exactos en la ficha del paciente.`
  };
}

/**
 * CONTRACT R5: Image Compression & Storage Protection
 */
export function calculateRetinaDimensions(width, height, maxWidth = 1200, maxHeight = 1200) {
  let targetWidth = width;
  let targetHeight = height;

  if (targetWidth > targetHeight) {
    if (targetWidth > maxWidth) {
      targetHeight = Math.round((targetHeight * maxWidth) / targetWidth);
      targetWidth = maxWidth;
    }
  } else {
    if (targetHeight > maxHeight) {
      targetWidth = Math.round((targetWidth * maxHeight) / targetHeight);
      targetHeight = maxHeight;
    }
  }

  return { width: targetWidth, height: targetHeight };
}

export class MockLocalStorageWithQuota {
  constructor(quotaBytes = 5 * 1024 * 1024) {
    this.quotaBytes = quotaBytes;
    this.store = new Map();
    this.usedBytes = 0;
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    const strVal = String(value);
    const existing = this.store.get(key) || '';
    const diff = strVal.length - existing.length;

    if (this.usedBytes + diff > this.quotaBytes) {
      const err = new Error('QuotaExceededError: DOMException 22');
      err.name = 'QuotaExceededError';
      err.code = 22;
      throw err;
    }

    this.store.set(key, strVal);
    this.usedBytes += diff;
  }

  removeItem(key) {
    if (this.store.has(key)) {
      this.usedBytes -= this.store.get(key).length;
      this.store.delete(key);
    }
  }

  clear() {
    this.store.clear();
    this.usedBytes = 0;
  }
}
