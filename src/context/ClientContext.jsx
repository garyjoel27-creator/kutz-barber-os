import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { saveClientsToStorage, loadClientsFromStorage, safeGetItem, safeSetItem, STORAGE_KEYS } from '../lib/storage';
import { ShopContext } from './ShopContext';
import { DEFAULT_SHOP_SLUG, buildWhatsAppUrl, isPublicBookingPath } from '../lib/shopUtils';
import { dispatchBarberAction, getShopStorageKeys } from '../lib/syncService';

const ClientContext = createContext();

export const useClients = () => useContext(ClientContext);

/**
 * Normaliza cadenas de texto para búsquedas clínicas insensibles a mayúsculas y acentos
 */
export function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Normaliza fechas procedentes de cadenas en español, ISO o timestamps numéricos
 */
export function parseTreatmentDate(dateValue, timestampValue) {
  if (timestampValue !== undefined && timestampValue !== null && !isNaN(Number(timestampValue))) {
    return new Date(Number(timestampValue));
  }
  if (!dateValue) return new Date();
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'number') return new Date(dateValue);

  const strVal = String(dateValue).trim();

  // Timestamp en formato string numérico
  if (/^\d{10,}$/.test(strVal)) {
    return new Date(Number(strVal));
  }

  // Formato ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(strVal)) {
    const parsedIso = new Date(strVal);
    if (!isNaN(parsedIso.getTime())) return parsedIso;
  }

  // Formato de fechas en español (ej. "12 Oct 2026", "23 sep 2026", "15 de mayo de 2026")
  const spanishMonths = {
    ene: 0, enero: 0,
    feb: 1, febrero: 1,
    mar: 2, marzo: 2,
    abr: 3, abril: 3,
    may: 4, mayo: 4,
    jun: 5, junio: 5,
    jul: 6, julio: 6,
    ago: 7, agosto: 7,
    sep: 8, sept: 8, septiembre: 8, setiembre: 8,
    oct: 9, octubre: 9,
    nov: 10, noviembre: 10,
    dic: 11, diciembre: 11
  };

  const cleanStr = strVal.toLowerCase().replace(/,/g, '').replace(/\bde\b/g, '').trim();
  const parts = cleanStr.split(/\s+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const monthPrefix = parts[1].slice(0, 3);
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && spanishMonths[monthPrefix] !== undefined && !isNaN(year)) {
      return new Date(year, spanishMonths[monthPrefix], day);
    }
  }

  const parsed = new Date(strVal);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Motor clínico de retención predictiva Lumina Insights™
 * Evalúa las ventanas biológicas de degradación para Toxina Botulínica y Rellenos Dérmicos
 */
export function calculateRetentionInsights(client, referenceDate = Date.now()) {
  if (!client || !Array.isArray(client.treatments) || client.treatments.length === 0) {
    return [];
  }

  const insights = [];
  const refTime = referenceDate instanceof Date 
    ? referenceDate.getTime() 
    : (typeof referenceDate === 'number' 
        ? referenceDate 
        : (referenceDate ? new Date(referenceDate).getTime() : Date.now()));

  // 1. Evaluación de Toxina Botulínica / Botox / Neuromodulador
  // Términos: botox, toxina, neuromodulador, frente, patas de gallo, glabela
  const botoxKeywords = ['botox', 'toxina', 'neuromodulador', 'frente', 'patas de gallo', 'glabela'];
  const botoxTreatments = client.treatments
    .filter(t => {
      const normName = normalizeText(t.name);
      const normNotes = normalizeText(t.notes);
      return botoxKeywords.some(kw => normName.includes(kw) || normNotes.includes(kw));
    })
    .sort((a, b) => {
      const dateA = parseTreatmentDate(a.date, a.timestamp).getTime();
      const dateB = parseTreatmentDate(b.date, b.timestamp).getTime();
      return dateB - dateA; // Más reciente primero
    });

  if (botoxTreatments.length > 0) {
    const latest = botoxTreatments[0];
    const treatmentTime = parseTreatmentDate(latest.date, latest.timestamp).getTime();
    const elapsedDays = Math.max(0, Math.floor((refTime - treatmentTime) / (1000 * 60 * 60 * 24)));
    const thresholdDays = 90; // Intervalo recomendado: 3 a 4 meses (90 a 120 días)

    if (elapsedDays >= thresholdDays) {
      const urgency = elapsedDays >= 120 ? 'high' : 'upcoming';
      const statusLabel = elapsedDays >= 120 ? 'Retoque Prioritario' : 'Ventana de Retoque';
      const message = `Han transcurrido ${elapsedDays} días desde la última aplicación de neuromodulador (${latest.name}). La fuerza contráctil muscular comienza a restablecerse; se recomienda calibración y retoque para preservar los resultados y prevenir la fijación de arrugas dinámicas.`;
      const whatsappDraft = `Hola ${client.name || ''} ✨ Te saludamos desde LuminaDesk. Han transcurrido ${elapsedDays} días desde tu sesión de ${latest.name}. Este es el momento ideal para tu retoque preventivo de mantenimiento. ¿Deseas que coordinemos tu próxima cita en cabina?`;

      insights.push({
        id: `retention-botox-${client.id}-${latest.id}`,
        type: 'botox',
        title: 'Retoque de Toxina Botulínica Sugerido',
        treatmentName: latest.name,
        lastDate: latest.date,
        elapsedDays,
        thresholdDays,
        urgency,
        urgencyLevel: elapsedDays >= 115 ? 'alta' : (elapsedDays >= 100 ? 'media' : 'sugerida'),
        statusLabel,
        message,
        suggestedAction: 'Agendar Retoque Botox',
        suggestedTreatmentName: 'Retoque Toxina Botulínica',
        suggestedActionObj: {
          type: 'rebook',
          treatmentName: 'Retoque Toxina Botulínica',
          actionLabel: 'Agendar Retoque Botox'
        },
        whatsappDraft
      });
    }
  }

  // 2. Evaluación de Rellenos Dérmicos / Ácido Hialurónico
  // Términos: filler, hialurónico, ácido hialuronico, labios, relleno, pómulos, ojeras
  const fillerKeywords = ['filler', 'hialuronico', 'acido hialuronico', 'labios', 'relleno', 'pomulos', 'ojeras'];
  const fillerTreatments = client.treatments
    .filter(t => {
      const normName = normalizeText(t.name);
      const normNotes = normalizeText(t.notes);
      return fillerKeywords.some(kw => normName.includes(kw) || normNotes.includes(kw));
    })
    .sort((a, b) => {
      const dateA = parseTreatmentDate(a.date, a.timestamp).getTime();
      const dateB = parseTreatmentDate(b.date, b.timestamp).getTime();
      return dateB - dateA;
    });

  if (fillerTreatments.length > 0) {
    const latest = fillerTreatments[0];
    const treatmentTime = parseTreatmentDate(latest.date, latest.timestamp).getTime();
    const elapsedDays = Math.max(0, Math.floor((refTime - treatmentTime) / (1000 * 60 * 60 * 24)));
    const thresholdDays = 270; // Intervalo recomendado: 9 a 12 meses (270 a 365 días)

    if (elapsedDays >= thresholdDays) {
      const urgency = elapsedDays >= 365 ? 'high' : 'upcoming';
      const statusLabel = elapsedDays >= 365 ? 'Retoque Prioritario' : 'Ventana de Retoque';
      const message = `Han transcurrido ${elapsedDays} días desde tu aplicación de relleno dérmico / ácido hialurónico (${latest.name}). En esta ventana temporal se aconseja una revisión clínica para valorar volumen, integración tisular y necesidad de retoque de soporte.`;
      const whatsappDraft = `Hola ${client.name || ''} ✨ Te contactamos desde LuminaDesk. Han transcurrido ${elapsedDays} días desde tu sesión de ${latest.name}. Te sugerimos una valoración dérmica de mantenimiento para evaluar el volumen y armonía de tus resultados. ¿Te gustaría agendar una revisión?`;

      insights.push({
        id: `retention-filler-${client.id}-${latest.id}`,
        type: 'filler',
        title: 'Revisión y Retoque de Relleno Dérmico',
        treatmentName: latest.name,
        lastDate: latest.date,
        elapsedDays,
        thresholdDays,
        urgency,
        urgencyLevel: elapsedDays >= 320 ? 'alta' : (elapsedDays >= 290 ? 'media' : 'sugerida'),
        statusLabel,
        message,
        suggestedAction: 'Agendar Retoque Relleno',
        suggestedTreatmentName: 'Revisión Ácido Hialurónico',
        suggestedActionObj: {
          type: 'rebook',
          treatmentName: 'Revisión Ácido Hialurónico',
          actionLabel: 'Agendar Retoque Relleno'
        },
        whatsappDraft
      });
    }
  }

  // 3. Evaluación Estética: Mirada (Pestañas/Cejas) y Manicura/Uñas (Ciclo 21 días)
  const nailsLashesKeywords = [
    'manicura', 'semipermanente', 'acrigel', 'lifting de pestanas', 
    'extension de pestanas', 'laminado de cejas', 'microblading'
  ];
  const nailsLashesTreatments = client.treatments
    .filter(t => {
      const normName = normalizeText(t.name);
      const normNotes = normalizeText(t.notes);
      return nailsLashesKeywords.some(kw => normName.includes(kw) || normNotes.includes(kw));
    })
    .sort((a, b) => parseTreatmentDate(b.date, b.timestamp).getTime() - parseTreatmentDate(a.date, a.timestamp).getTime());

  if (nailsLashesTreatments.length > 0) {
    const latest = nailsLashesTreatments[0];
    const treatmentTime = parseTreatmentDate(latest.date, latest.timestamp).getTime();
    const elapsedDays = Math.max(0, Math.floor((refTime - treatmentTime) / (1000 * 60 * 60 * 24)));
    const thresholdDays = 21; // Ciclo de 3 semanas para uñas/pestañas/cejas

    if (elapsedDays >= thresholdDays) {
      const urgency = elapsedDays >= 28 ? 'high' : 'upcoming';
      const statusLabel = elapsedDays >= 28 ? 'Mantenimiento Prioritario' : 'Ciclo 3 Semanas';
      const message = `Han transcurrido ${elapsedDays} días desde el servicio de ${latest.name}. Por el crecimiento natural de la lámina ungueal / ciclo piloso de pestañas y cejas, es el momento óptimo para realizar el mantenimiento o relleno.`;
      const whatsappDraft = `Hola ${client.name || ''} ✨ Te escribimos desde nuestro salón en LuminaDesk. Ya han pasado ${elapsedDays} días desde tu sesión de ${latest.name} y toca tu mantenimiento para que sigas luciéndolo impecable. ¿Te reservamos hueco esta semana?`;

      insights.push({
        id: `retention-estetica-mirada-${client.id}-${latest.id}`,
        type: 'estetica_mirada',
        title: 'Mantenimiento de Mirada / Manicura (Ciclo 21 días)',
        treatmentName: latest.name,
        lastDate: latest.date,
        elapsedDays,
        thresholdDays,
        urgency,
        urgencyLevel: elapsedDays >= 28 ? 'alta' : 'sugerida',
        statusLabel,
        message,
        suggestedAction: 'Agendar Mantenimiento',
        suggestedTreatmentName: `Mantenimiento ${latest.name}`,
        suggestedActionObj: {
          type: 'rebook',
          treatmentName: `Mantenimiento ${latest.name}`,
          actionLabel: 'Agendar Mantenimiento'
        },
        whatsappDraft
      });
    }
  }

  // 4. Evaluación Estética Cabina: Láser Diodo, Indiba, Radiofrecuencia, Dermapen (Ciclo 35 días)
  const cabinKeywords = ['laser diodo', 'radiofrecuencia indiba', 'indiba', 'maderoterapia', 'dermapen'];
  const cabinTreatments = client.treatments
    .filter(t => {
      const normName = normalizeText(t.name);
      const normNotes = normalizeText(t.notes);
      return cabinKeywords.some(kw => normName.includes(kw) || normNotes.includes(kw));
    })
    .sort((a, b) => parseTreatmentDate(b.date, b.timestamp).getTime() - parseTreatmentDate(a.date, a.timestamp).getTime());

  if (cabinTreatments.length > 0) {
    const latest = cabinTreatments[0];
    const treatmentTime = parseTreatmentDate(latest.date, latest.timestamp).getTime();
    const elapsedDays = Math.max(0, Math.floor((refTime - treatmentTime) / (1000 * 60 * 60 * 24)));
    const thresholdDays = 35; // Ciclo de 5 semanas para sesiones de cabina/láser

    if (elapsedDays >= thresholdDays) {
      const urgency = elapsedDays >= 45 ? 'high' : 'upcoming';
      const statusLabel = elapsedDays >= 45 ? 'Siguiente Sesión' : 'Ventana de Cabina';
      const message = `Han transcurrido ${elapsedDays} días desde la sesión de ${latest.name}. Para mantener la eficacia acumulativa del protocolo en cabina (fase anágena / síntesis de colágeno), se recomienda programar la siguiente sesión.`;
      const whatsappDraft = `Hola ${client.name || ''} ✨ Te saludamos desde cabina. Han pasado ${elapsedDays} días desde tu última sesión de ${latest.name}. Para no perder el ritmo de tu protocolo y maximizar resultados, ¿agendamos tu siguiente sesión esta semana?`;

      insights.push({
        id: `retention-estetica-cabina-${client.id}-${latest.id}`,
        type: 'estetica_cabina',
        title: 'Continuidad de Protocolo en Cabina',
        treatmentName: latest.name,
        lastDate: latest.date,
        elapsedDays,
        thresholdDays,
        urgency,
        urgencyLevel: elapsedDays >= 45 ? 'alta' : 'sugerida',
        statusLabel,
        message,
        suggestedAction: 'Agendar Sesión Cabina',
        suggestedTreatmentName: latest.name,
        suggestedActionObj: {
          type: 'rebook',
          treatmentName: latest.name,
          actionLabel: 'Agendar Sesión Cabina'
        },
        whatsappDraft
      });
    }
  }

  // 5. Evaluación Peluquería & Colorimetría: Raíz / Tinte / Balayage / Keratina (Ciclo 28-45 días)
  const hairKeywords = [
    'coloracion raiz', 'cobertura de canas', 'retoque de raiz', 'tinte inoa', 
    'balayage', 'babylights', 'matiz gloss', 'alisado organico', 'keratina'
  ];
  const hairTreatments = client.treatments
    .filter(t => {
      const normName = normalizeText(t.name);
      const normNotes = normalizeText(t.notes);
      return hairKeywords.some(kw => normName.includes(kw) || normNotes.includes(kw));
    })
    .sort((a, b) => parseTreatmentDate(b.date, b.timestamp).getTime() - parseTreatmentDate(a.date, a.timestamp).getTime());

  if (hairTreatments.length > 0) {
    const latest = hairTreatments[0];
    const treatmentTime = parseTreatmentDate(latest.date, latest.timestamp).getTime();
    const elapsedDays = Math.max(0, Math.floor((refTime - treatmentTime) / (1000 * 60 * 60 * 24)));
    const thresholdDays = 28; // 4 semanas para raíz o matiz

    if (elapsedDays >= thresholdDays) {
      const urgency = elapsedDays >= 40 ? 'high' : 'upcoming';
      const statusLabel = elapsedDays >= 40 ? 'Retoque de Color' : 'Ventana de Color / Matiz';
      const message = `Han transcurrido ${elapsedDays} días desde el servicio técnico de ${latest.name} (crecimiento medio de raíz ~1.2 cm). Momento ideal para repasar raíz, refrescar el matiz Gloss o hidratar la fibra capilar.`;
      const whatsappDraft = `Hola ${client.name || ''} ✨ Te escribimos desde el salón. Hace ${elapsedDays} días de tu ${latest.name}. Ya tenemos guardada tu fórmula exacta en tu ficha para cuando quieras repasar raíz o devolverle el brillo al color. ¿Te buscamos cita?`;

      insights.push({
        id: `retention-peluqueria-${client.id}-${latest.id}`,
        type: 'peluqueria',
        title: 'Retoque de Colorimetría / Matiz Capilar',
        treatmentName: latest.name,
        lastDate: latest.date,
        elapsedDays,
        thresholdDays,
        urgency,
        urgencyLevel: elapsedDays >= 40 ? 'alta' : 'sugerida',
        statusLabel,
        message,
        suggestedAction: 'Agendar Cita Color',
        suggestedTreatmentName: `Retoque ${latest.name}`,
        suggestedActionObj: {
          type: 'rebook',
          treatmentName: `Retoque ${latest.name}`,
          actionLabel: 'Agendar Cita Color'
        },
        whatsappDraft
      });
    }
  }

  // 6. Evaluación Barbería Urbana: Skin Fade, Taper, Corte & Barba (Ciclo 15-21 días)
  const barberKeywords = [
    'fade', 'degradado', 'taper', 'mullet', 'crop', 'barba', 
    'navaja', 'shaver', 'corte', 'afeitado', 'ritual', 'peine', ' Contorno'
  ];
  const barberTreatments = client.treatments
    .filter(t => {
      const normName = normalizeText(t.name);
      const normNotes = normalizeText(t.notes);
      const normFormula = normalizeText(t.formula);
      return barberKeywords.some(kw => {
        const cleanKw = normalizeText(kw);
        return normName.includes(cleanKw) || normNotes.includes(cleanKw) || normFormula.includes(cleanKw);
      });
    })
    .sort((a, b) => parseTreatmentDate(b.date, b.timestamp).getTime() - parseTreatmentDate(a.date, a.timestamp).getTime());

  if (barberTreatments.length > 0) {
    const latest = barberTreatments[0];
    const treatmentTime = parseTreatmentDate(latest.date, latest.timestamp).getTime();
    const elapsedDays = Math.max(0, Math.floor((refTime - treatmentTime) / (1000 * 60 * 60 * 24)));
    const thresholdDays = 15; // Ciclo ideal de Fade y Barba: 15 a 21 días

    if (elapsedDays >= thresholdDays) {
      const urgency = elapsedDays >= 21 ? 'high' : 'upcoming';
      const statusLabel = elapsedDays >= 21 ? 'Fade Vencido (+21d)' : 'Ventana de Fade (15-21d)';
      const message = `Han pasado ${elapsedDays} días desde su último ${latest.name}. El degradado a piel (#0/#0.5) y la línea de navaja en barba ya han perdido definición (~0.7 cm de crecimiento). Momento clave para refrescar el Fade.`;
      const whatsappDraft = `¡Qué pasa ${client.name || ''} 💈! Te escribimos desde KUTZ // BARBER STUDIO. Ya hace ${elapsedDays} días de tu último ${latest.name} y toca refrescar ese degradado y perfilar la barba para mantener el flow limpio. Tenemos tu receta de peines guardada en tu ficha, ¿te reservamos sillón esta semana? 🔥`;

      insights.push({
        id: `retention-barber-${client.id}-${latest.id}`,
        type: 'barber',
        title: 'Refresco de Skin Fade & Perfilado de Barba',
        treatmentName: latest.name,
        lastDate: latest.date,
        elapsedDays,
        thresholdDays,
        urgency,
        urgencyLevel: elapsedDays >= 21 ? 'alta' : 'sugerida',
        statusLabel,
        message,
        suggestedAction: 'Agendar Corte / Fade',
        suggestedTreatmentName: `Retoque ${latest.name}`,
        suggestedActionObj: {
          type: 'rebook',
          treatmentName: `Retoque ${latest.name}`,
          actionLabel: 'Agendar Corte / Fade'
        },
        whatsappDraft
      });
    }
  }

  // Ordenar por urgencia ('high' primero) y secundariamente por días transcurridos
  const urgencyWeight = { high: 2, upcoming: 1 };
  return insights.sort((a, b) => {
    const weightDiff = (urgencyWeight[b.urgency] || 0) - (urgencyWeight[a.urgency] || 0);
    if (weightDiff !== 0) return weightDiff;
    return b.elapsedDays - a.elapsedDays;
  });
}

/**
 * Motor de alerta de degradado y ciclo de retoque urbano (15-21 días)
 * @param {object} client - Ficha del cliente
 * @param {Date|number|string} referenceDate - Fecha de referencia para cálculo temporal
 * @returns {object} { alertLevel, label, daysRemaining, elapsedDays, daysElapsed, badgeColor, requiresRetouch }
 */
export function getFadeAlert(client, referenceDate = new Date()) {
  if (!client) {
    return {
      alertLevel: 'normal',
      label: 'Sin datos',
      daysRemaining: 21,
      elapsedDays: 0,
      daysElapsed: 0,
      badgeColor: '#10B981',
      requiresRetouch: false
    };
  }

  const refTime = referenceDate instanceof Date 
    ? referenceDate.getTime() 
    : (typeof referenceDate === 'number' 
        ? referenceDate 
        : (referenceDate ? new Date(referenceDate).getTime() : Date.now()));
  const treatments = Array.isArray(client.treatments) ? client.treatments : [];

  const barberKeywords = ['fade', 'degradado', 'taper', 'mullet', 'crop', 'barba', 'navaja', 'corte', 'ritual', 'shaver'];
  const barberServices = treatments.filter(t => {
    const name = (t.name || '').toLowerCase();
    const notes = (t.notes || '').toLowerCase();
    const formula = (t.formula || '').toLowerCase();
    return barberKeywords.some(kw => name.includes(kw) || notes.includes(kw) || formula.includes(kw));
  }).sort((a, b) => {
    const tA = parseTreatmentDate(a.date, a.timestamp).getTime();
    const tB = parseTreatmentDate(b.date, b.timestamp).getTime();
    return tB - tA;
  });

  if (barberServices.length === 0) {
    return {
      alertLevel: 'normal',
      label: 'Nuevo cliente',
      daysRemaining: 15,
      elapsedDays: 0,
      daysElapsed: 0,
      badgeColor: '#10B981',
      requiresRetouch: false
    };
  }

  const latest = barberServices[0];
  const lastTime = parseTreatmentDate(latest.date, latest.timestamp).getTime();
  const elapsedDays = Math.max(0, Math.floor((refTime - lastTime) / (1000 * 60 * 60 * 24)));

  if (elapsedDays >= 21) {
    return {
      alertLevel: 'urgent',
      label: `🔥 Fade Vencido (+${elapsedDays}d)`,
      daysRemaining: 0,
      elapsedDays,
      daysElapsed: elapsedDays,
      badgeColor: '#EF4444',
      requiresRetouch: true
    };
  } else if (elapsedDays >= 15) {
    const remaining = 21 - elapsedDays;
    return {
      alertLevel: 'warning',
      label: remaining <= 2 ? `🔥 Retoque en ${remaining} días` : `✂️ Ventana de Fade (${remaining}d)`,
      daysRemaining: remaining,
      elapsedDays,
      daysElapsed: elapsedDays,
      badgeColor: '#F59E0B',
      requiresRetouch: true
    };
  } else {
    const remaining = 15 - elapsedDays;
    return {
      alertLevel: 'normal',
      label: remaining <= 2 ? `🔥 Retoque en ${remaining} días` : 'Fade fresco',
      daysRemaining: remaining,
      elapsedDays,
      daysElapsed: elapsedDays,
      badgeColor: '#10B981',
      requiresRetouch: false
    };
  }
}

/**
 * Perfiles de Especialidad del Negocio (Barbería Urbana por defecto + modos compatibles)
 */
export const BUSINESS_MODES = {
  barber: {
    id: 'barber',
    shortName: 'Barbería & Fade',
    badge: 'Barbería Urbana & Fade Studio',
    heroTitle: 'Panel de Sillón & Barber Studio',
    heroSubtitle: 'Control de recetas de corte, graduaciones de Fade (#000 a #3), rituales de barba a navaja, bonos VIP y evolución Antes/Después.',
    clientSingular: 'Cliente',
    clientPlural: 'Clientes',
    directoryTitle: 'Directorio de Clientes & Recetas de Corte',
    sessionButtonLabel: 'Registrar Corte / Receta',
    sessionModalTitle: 'Nuevo Servicio en Sillón (Corte & Barba)',
    formulaLabel: 'Receta Técnica de Corte (Peines / Guías, Altura de Fade y Barba)',
    formulaPlaceholder: 'Ej. Base Shaver #000 → #0.5 (1 dedo) → #1.5 palanca abierta en conexión | Superior: Crop a tijera | Barba: Perfilado a navaja + Toalla Caliente...',
    allergyLabel: 'Sensibilidad en Piel / Cuero Cabelludo (Shaver, Navaja o Tintes)',
    allergyPlaceholder: 'Ej. Piel sensible en nuca al pasar Shaver, foliculitis en cuello, irritación con aftershave con alcohol, remolino doble en coronilla...',
    notesLabel: 'Morfología Craneal, Remolinos & Producto de Styling',
    notesPlaceholder: 'Ej. Hueso occipital pronunciado (bajar el fade medio dedo). Usa Polvos de Textura Mate o Pomada base agua. Toma café solo con hielo...',
    quickTreatments: [
      'Skin Fade Alto + Perfilado de Barba & Toalla Caliente',
      'Low Taper Fade + Texturizado Superior a Tijera',
      'Mid Drop Fade + Crop Urbano & Polvos Mate',
      'Burst Fade / Mullet Moderno + Diseño Cejas a Navaja',
      'Ritual Clásico de Barba con Vapor de Ozono & Navaja',
      'Decoloración Global Platino / Mechas Gorro + Matiz'
    ],
    rgpdBadge: 'RGPD Imagen Reels/TikTok + Piel',
    rgpdCustodyText: 'Durante relación activa con la barbería (Borrado inmediato disponible)',
    rgpdTreatmentClause: 'Autorizo la apertura de mi ficha de cliente en la barbería, el registro de notas sobre sensibilidad dérmica al afeitado o productos capilares, y la realización de los servicios de corte, barbería y cuidado masculino solicitados.'
  },
  estetica: {
    id: 'estetica',
    shortName: 'Estética & Cabina',
    badge: 'Centro de Estética Avanzada',
    heroTitle: 'Panel de Cabina & Recepción Estética',
    heroSubtitle: 'Gestión integral de protocolos faciales, corporales, láser, diseño de mirada, uñas y evolución visual.',
    clientSingular: 'Clienta',
    clientPlural: 'Clientas',
    directoryTitle: 'Directorio de Clientas & Cabina',
    sessionButtonLabel: 'Registrar Sesión en Cabina',
    sessionModalTitle: 'Nueva Sesión de Estética',
    formulaLabel: 'Parámetros Técnicos / Activos / Tono',
    formulaPlaceholder: 'Ej. Láser Diodo 18J/cm² (Fototipo III) | Lifting pestañas molde M + Tinte negro | Esmalte Semipermanente Nude #04...',
    allergyLabel: 'Sensibilidades, Alergias o Contraindicaciones',
    allergyPlaceholder: 'Ej. Piel reactiva/rosácea, alergia a acrilatos (uñas), cianoacrilato (pegamento pestañas), cera caliente, embarazo...',
    notesLabel: 'Rutina en Casa (Home Care) & Preferencias de Cabina',
    notesPlaceholder: 'Ej. Usa limpiador suave + SPF 50. Prefiere camilla templada, música relajante e infusión de frutos rojos...',
    quickTreatments: [
      'Lifting de Pestañas & Laminado de Cejas',
      'Láser Diodo Alta Potencia',
      'Radiofrecuencia Indiba Facial',
      'Manicura Rusa Semipermanente',
      'Maderoterapia & Presoterapia Corporal',
      'Dermapen Microneedling con Vitaminas'
    ],
    rgpdBadge: 'Art. 9 RGPD + Imagen Redes',
    rgpdCustodyText: 'Durante relación activa (Derecho de supresión inmediato disponible)',
    rgpdTreatmentClause: 'Autorizo la apertura de mi ficha estética, el registro de alergias o sensibilidades cutáneas (Art. 9 RGPD) y la aplicación de los tratamientos de estética avanzada, aparatología, mirada o cuidado ungueal solicitados.'
  },
  peluqueria: {
    id: 'peluqueria',
    shortName: 'Peluquería & Color',
    badge: 'Salón de Peluquería & Colorimetría',
    heroTitle: 'Panel de Salón, Tocador & Colorimetría',
    heroSubtitle: 'Recetario exacto de fórmulas de color al gramo, oxidantes, historial de mechas, tratamientos capilares y evolución.',
    clientSingular: 'Clienta',
    clientPlural: 'Clientas',
    directoryTitle: 'Directorio de Clientas & Pasaporte de Color',
    sessionButtonLabel: 'Registrar Servicio / Fórmula',
    sessionModalTitle: 'Nuevo Servicio de Peluquería & Color',
    formulaLabel: 'Receta de Colorimetría / Mezcla Exacta (Gramos, Volúmenes y Tiempo)',
    formulaPlaceholder: 'Ej. Raíz: 30g Inoa 6.1 + 15g 6.0 (Ox. 20 vol, 35 min) | Medios/Puntas: Gloss Dialight 9.12 + 10.21 (Ox. 6 vol, 15 min) + Olaplex Nº1...',
    allergyLabel: 'Alergias Capilares (Test PPD 48h) & Cuero Cabelludo',
    allergyPlaceholder: 'Ej. Alergia a PPD (parafenilendiamina), sensibilidad al amoníaco, cuero cabelludo sensible/descamación, test de alergia 48h superado...',
    notesLabel: 'Diagnóstico de Fibra Capilar & Productos en Casa',
    notesPlaceholder: 'Ej. Porosidad media-alta en puntas, base natural altura 5. Lleva a casa Champú Bain Lumière y Mascarilla Ácida...',
    quickTreatments: [
      'Balayage de Autor & Matiz Gloss',
      'Coloración Raíz (Cobertura de Canas)',
      'Alisado Orgánico / Keratina',
      'Babylights & Contorno Iluminado',
      'Tratamiento Bótox Capilar Profundo',
      'Corte de Visagismo & Brushing'
    ],
    rgpdBadge: 'RGPD Test Alergia PPD + Imagen',
    rgpdCustodyText: 'Durante relación activa (Derecho de supresión inmediato disponible)',
    rgpdTreatmentClause: 'Autorizo la apertura de mi ficha técnica capilar, el registro de pruebas de sensibilidad/alergia a tintes (PPD / Art. 9 RGPD) y la realización de los servicios de peluquería y colorimetría solicitados.'
  },
  clinica: {
    id: 'clinica',
    shortName: 'Clínica Médica',
    badge: 'Clínica de Medicina Estética',
    heroTitle: 'Panel de Cabina Médica & Recepción',
    heroSubtitle: 'Gestión clínica de alta precisión para medicina estética, trazabilidad de viales, fórmulas y evolución dérmica.',
    clientSingular: 'Paciente',
    clientPlural: 'Pacientes',
    directoryTitle: 'Directorio de Pacientes & Historial Clínico',
    sessionButtonLabel: 'Registrar Sesión en Cabina',
    sessionModalTitle: 'Nueva Sesión Médica / Dermoestética',
    formulaLabel: 'Producto, Nº Lote Sanitario (AEMPS) y Dosis (UI / ml)',
    formulaPlaceholder: 'Ej. Vistabel Lote #C8841 (Cad 11/2027) — 30 UI en tercio superior | Juvederm Ultra Smile 0.8ml Lote #A412...',
    allergyLabel: 'Alergias Médicas, Medicación o Contraindicaciones',
    allergyPlaceholder: 'Ej. Alergia a lidocaína/anestésicos tópicos, látex, anticoagulantes, herpes labial recurrente, enfermedades autoinmunes...',
    notesLabel: 'Preferencias de Cabina & Pauta Dermoestética',
    notesPlaceholder: 'Ej. Requiere crema anestésica EMLA 30 min antes. Fototipo III Fitzpatrick. Pauta domiciliaria con Retinol 0.3%...',
    quickTreatments: [
      'Toxina Botulínica Frente y Glabela',
      'Ácido Hialurónico Hidratación y Volumen Labial',
      'Peeling Químico Médico Renovador',
      'Bioestimuladores de Colágeno / Polinucleótidos',
      'Mesoterapia Facial con Vitaminas + HA',
      'Láser Médico Vascular / Despigmentante'
    ],
    rgpdBadge: 'Art. 9 RGPD + Ley 41/2002',
    rgpdCustodyText: 'Mínimo 5 años obligatorios (Ley 41/2002 de Autonomía del Paciente)',
    rgpdTreatmentClause: 'Autorizo la apertura de mi historia clínica dermoestética, el tratamiento de mis datos de salud (Art. 9.2.h RGPD y Ley 41/2002) y la realización de los procedimientos médico-estéticos acordados.'
  }
};

export const INITIAL_BARBER_CLIENTS = [
  { 
    id: '1', 
    name: 'Mateo "El Flaco" Vargas', 
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=600',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=600',
    phone: '+34 600 123 456', 
    email: 'mateo.vargas@ejemplo.com', 
    allergies: 'Sensibilidad leve en nuca si se apura con Shaver en seco. Usar siempre espuma pre-shave o gel transparente antes de pasar cuchilla.', 
    notes: 'Le gusta el Mid Drop Fade bien comprimido detrás de la oreja y textura rota arriba con Polvos Mate. Escucha trap/hip-hop en sillón y pide agua con gas fría.', 
    lastVisit: '08 Oct 2026', 
    treatment: 'Mid Drop Fade + Crop Texturizado & Polvos Mate',
    bonos: [
      {
        id: 'b-101',
        name: 'Bono Crew: 4 Cortes Skin/Mid Fade Mensual',
        totalSessions: 4,
        usedSessions: 3,
        price: '68€',
        notes: 'Mantenimiento quincenal de degradado y contornos.',
        createdAt: '2026-08-10',
        status: 'active'
      }
    ],
    treatments: [
      {
        id: 1,
        date: '08 Oct 2026',
        timestamp: new Date('2026-10-08T17:00:00Z').getTime(),
        name: 'Mid Drop Fade + Crop Texturizado & Polvos Mate',
        formula: 'Base Shaver #000 → #0.5 a 1 dedo → #1.5 palanca abierta → #3 en conexión | Superior: Crop texturizado a tijera entresacadora | Acabado: Polvos Mate + Cera Seca',
        notes: 'Degradado en caída detrás del hueso occipital para respetar remolino superior. Contorno frontal marcado suave sin recesión.',
        ritual: 'Toalla caliente aromatizada + aftershave sin alcohol',
        photos: {
          before: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=800',
          after: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=800'
        }
      },
      {
        id: 2,
        date: '2026-09-18',
        timestamp: new Date('2026-09-18T18:00:00Z').getTime(),
        name: 'Perfilado Express de Contornos + Barba Candado',
        formula: 'Base Shaver #000 en patillas y nuca → #1 en transición | Navaja con gel frío + Aftershave Bálsamo',
        notes: 'Repaso rápido entre cortes para evento de fin de semana.',
        ritual: 'Bálsamo frío calmante',
        photos: null
      }
    ],
    consent: {
      signed: true,
      signedAt: '2026-10-08T17:00:00Z',
      formattedDate: '08 Oct 2026, 17:00',
      permissions: {
        treatment: true,
        photosPrivate: true,
        photosMarketing: true,
        communications: true
      },
      legalNoticeVersion: 'RGPD-2026-v2.1',
      legalCustodian: 'KUTZ // BARBER OS Studio'
    }
  },
  {
    id: '2',
    name: 'Dani Morales',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=600',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=600',
    phone: '+34 611 987 321',
    email: 'dani.morales@ejemplo.com',
    allergies: 'Sin alergias cutáneas. Evitar ceras muy grasas o con brillo excesivo.',
    notes: 'Lleva Burst Fade / Mullet moderno con nuca larga texturizada a navaja. Le gusta línea (freestyle sutil) en ceja izquierda.',
    lastVisit: '18 Oct 2026',
    treatment: 'Burst Fade Mullet + Diseño de Cejas a Navaja',
    bonos: [
      {
        id: 'b-201',
        name: 'Pack Trimestral 3 Cortes + Ritual de Barba',
        totalSessions: 3,
        usedSessions: 2,
        price: '75€',
        notes: 'Incluye lavado detox con menta y arreglo de cejas.',
        createdAt: '2026-07-20',
        status: 'active'
      }
    ],
    treatments: [
      {
        id: 201,
        date: '18 Oct 2026',
        timestamp: new Date('2026-10-18T12:30:00Z').getTime(),
        name: 'Burst Fade Mullet + Diseño de Cejas a Navaja',
        formula: 'Base Shaver #000 en contornos → Burst semicircular en sienes (#0.5 a #2 y #3 en caída) | Nuca desconectada a tijera y navaja | Cejas perfiladas con cuchilla nueva + Sea Salt Spray',
        notes: 'Se mantiene el largo de la nuca y se da mucho movimiento arriba con difusor y spray de sal marina.',
        ritual: 'Lavado detox con champú de árbol de té y menta',
        photos: {
          before: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=800',
          after: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=800'
        }
      }
    ],
    consent: {
      signed: true,
      signedAt: '2026-10-18T12:20:00Z',
      formattedDate: '18 Oct 2026, 12:20',
      permissions: {
        treatment: true,
        photosPrivate: true,
        photosMarketing: true,
        communications: true
      },
      legalNoticeVersion: 'RGPD-2026-v2.1',
      legalCustodian: 'KUTZ // BARBER OS Studio'
    }
  },
  {
    id: '3',
    name: 'Álex Rivera',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=600',
    photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=600',
    phone: '+34 622 456 789',
    email: 'alex.rivera@ejemplo.com',
    allergies: 'Piel sensible en el cuello bajo al pasar Shaver o navaja a contrapelo. Aplicar siempre piedra de alumbre y bálsamo Aftershave sin alcohol.',
    notes: 'Remolino fuerte en coronilla derecha (dejar 2 cm extra de peso para que no se levante). Hueso occipital pronunciado: bajar la guía #0 medio dedo. En casa usa Polvos de Textura Mate y Aceite de Barba de Cedro. Café solo con hielo en sillón.',
    lastVisit: '10 Oct 2026',
    treatment: 'Skin Fade Alto + Perfilado de Barba & Toalla Caliente',
    bonos: [
      {
        id: 'b-301',
        name: 'Membresía VIP: 4 Cortes Skin Fade + Ritual de Barba',
        totalSessions: 4,
        usedSessions: 1,
        price: '95€',
        notes: 'Incluye corte degradado a piel, perfilado de barba con vapor de ozono, toalla caliente y bebida en sillón.',
        createdAt: '2026-10-10',
        status: 'active'
      }
    ],
    treatments: [
      {
        id: 301,
        date: '10 Oct 2026',
        timestamp: new Date('2026-10-10T16:00:00Z').getTime(),
        name: 'Skin Fade Alto + Perfilado de Barba & Toalla Caliente',
        formula: 'Base Shaver #000 → #0.5 (1 dedo) → #1.5 especial palanca a la mitad → #2 y #3 en conexión | Superior: Tijera Point Cutting | Barba: Degradada desde patilla (#0.5 a #2) + Navaja con gel transparente + Toalla Caliente',
        notes: 'Remolino en coronilla derecha: degradado limpio pulido con Shaver en la base sin marcar línea. Barba encuadrada a navaja respetando ancho de pómulo y mandíbula. Acabado con polvos voluminizadores mate y aceite templado en barba.',
        ritual: 'Toalla caliente con aceite esencial de eucalipto + vapor de ozono',
        photos: {
          before: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=800',
          after: 'https://images.unsplash.com/photo-1621607512214-68297480165e?auto=format&fit=crop&q=80&w=800'
        }
      },
      {
        id: 302,
        date: '22 Sep 2026',
        timestamp: new Date('2026-09-22T11:00:00Z').getTime(),
        name: 'Low Taper Fade + Ritual de Barba con Ozono',
        formula: 'Base Shaver #000 en nuca y patillas → Taper limpio (#0 a #1.5 y #3 en caída) | Barba rebajada a peine #2 a favor de pelo + Vapor de Ozono + Aceite de Argán',
        notes: 'Mantenimiento de contornos y nutrición profunda de barba. Excelente respuesta de la piel al vapor templado antes de la cuchilla.',
        ritual: 'Vapor de ozono + toalla templada',
        photos: {
          before: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=800',
          after: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=800'
        }
      }
    ],
    consent: {
      signed: true,
      signedAt: '2026-09-22T10:45:00Z',
      formattedDate: '22 Sep 2026, 10:45',
      permissions: {
        treatment: true,
        photosPrivate: true,
        photosMarketing: true,
        communications: true
      },
      legalNoticeVersion: 'RGPD-2026-v2.1',
      legalCustodian: 'KUTZ // BARBER OS Studio'
    }
  }
];

export const ClientProvider = ({ children }) => {
  const shopCtx = useContext(ShopContext);
  const activeShopSlug = shopCtx?.activeShopSlug || DEFAULT_SHOP_SLUG;
  const activeShop = shopCtx?.activeShop || null;
  const lastSyncTime = shopCtx?.lastSyncTime || null;
  const effectivePin = shopCtx?.resolvedPin || activeShop?.pin || '';

  const isPublicRoute =
    shopCtx?.isPublicRoute !== undefined
      ? Boolean(shopCtx.isPublicRoute)
      : typeof window !== 'undefined' && isPublicBookingPath(window.location?.pathname || '');

  // Helper to filter out fake Madrid demo clients from real tenant barbershops
  const stripDemoMadridClients = useCallback((list, slug) => {
    if (!Array.isArray(list)) return [];
    if (slug === DEFAULT_SHOP_SLUG || slug === 'default') return list;
    const demoNames = new Set([
      'Mateo "El Flaco" Vargas',
      'Marcos Varela',
      'Dani Morales',
      'Álex Rivera'
    ]);
    return list.filter(
      (c) =>
        !(
          demoNames.has(c?.name) &&
          (String(c?.id) === '1' || String(c?.id) === '2' || String(c?.id) === '3')
        )
    );
  }, []);

  // Modo de negocio activo ('barber' por defecto para Barbería Urbana)
  const [businessMode, setBusinessMode] = useState(() => {
    try {
      const savedBarberVersion = localStorage.getItem('kutz_barber_mode_v1');
      if (!savedBarberVersion) {
        localStorage.setItem('kutz_barber_mode_v1', 'true');
        localStorage.setItem('luminadesk_business_mode', 'barber');
        return 'barber';
      }
      const savedMode = localStorage.getItem('luminadesk_business_mode');
      if (savedMode && BUSINESS_MODES[savedMode]) return savedMode;
    } catch {
      // Ignorar errores de acceso a localStorage
    }
    return 'barber';
  });

  useEffect(() => {
    try {
      localStorage.setItem('luminadesk_business_mode', businessMode);
    } catch {
      // Ignorar errores de almacenamiento
    }
  }, [businessMode]);

  const activeModeConfig = BUSINESS_MODES[businessMode] || BUSINESS_MODES.barber;

  // Load tenant-isolated clients list
  const loadTenantClients = useCallback(
    (slug, forPublic = isPublicRoute) => {
      if (forPublic) {
        return [];
      }
      const keys = getShopStorageKeys(slug);
      try {
        const tenantSaved =
          typeof window !== 'undefined' ? localStorage.getItem(keys.CLIENTS) : null;
        if (tenantSaved) {
          const parsed = JSON.parse(tenantSaved);
          if (Array.isArray(parsed)) {
            return stripDemoMadridClients(parsed, slug);
          }
        }

        // Only kutz-madrid uses INITIAL_BARBER_CLIENTS demo seed
        if (slug === DEFAULT_SHOP_SLUG || slug === 'default') {
          const migratedToBarber =
            typeof window !== 'undefined'
              ? localStorage.getItem(STORAGE_KEYS.BARBER_SEEDED)
              : null;
          const saved =
            typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.CLIENTS) : null;

          if (!migratedToBarber && saved) {
            const parsedOld = JSON.parse(saved);
            const hasOldFemaleDemo =
              Array.isArray(parsedOld) &&
              parsedOld.some((c) => c.name === 'Elena García' || c.name === 'Carlota Mendoza');
            if (hasOldFemaleDemo) {
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.BARBER_SEEDED, 'true');
              }
              saveClientsToStorage(INITIAL_BARBER_CLIENTS);
              return INITIAL_BARBER_CLIENTS;
            }
          }

          const loaded = loadClientsFromStorage(
            typeof window !== 'undefined' ? window.localStorage : null,
            INITIAL_BARBER_CLIENTS
          );
          if (typeof window !== 'undefined' && !migratedToBarber) {
            localStorage.setItem(STORAGE_KEYS.BARBER_SEEDED, 'true');
          }
          return loaded;
        }
      } catch (err) {
        console.warn('Error al leer de localStorage:', err);
      }
      return slug === DEFAULT_SHOP_SLUG ? INITIAL_BARBER_CLIENTS : [];
    },
    [stripDemoMadridClients, isPublicRoute]
  );

  const [clients, setClients] = useState(() => loadTenantClients(activeShopSlug, isPublicRoute));

  // --- 1. ESTADO DE COLA VIVA (WALK-IN QUEUE) AISLADO POR BARBERÍA ---
  const loadTenantQueue = useCallback((slug, forPublic = isPublicRoute) => {
    if (forPublic) {
      return [];
    }
    const keys = getShopStorageKeys(slug);
    try {
      const savedTenantQueue = safeGetItem(keys.QUEUE, null);
      if (Array.isArray(savedTenantQueue)) return savedTenantQueue;
      if (slug === DEFAULT_SHOP_SLUG) {
        const savedLegacy = localStorage.getItem('kutz_walkin_queue');
        if (savedLegacy) return JSON.parse(savedLegacy);
        return [
          {
            id: 'wq-1',
            name: 'Hugo Navarro',
            phone: '+34 622 334 455',
            service: 'Skin Fade Express',
            waitMinutes: 12,
            barber: 'REX',
            status: 'waiting',
            timeIn: '17:40'
          },
          {
            id: 'wq-2',
            name: 'Carlos "Capi" Ruiz',
            phone: '+34 633 445 566',
            service: 'Perfilado Barba + Toalla',
            waitMinutes: 25,
            barber: 'KIKO',
            status: 'waiting',
            timeIn: '17:52'
          }
        ];
      }
    } catch {
      // ignore
    }
    return [];
  }, [isPublicRoute]);

  const [walkInQueue, setWalkInQueue] = useState(() => loadTenantQueue(activeShopSlug, isPublicRoute));

  // --- 2. LISTA DE ESPERA Y RELLENA HUECOS FLASH AISLADA POR BARBERÍA ---
  const loadTenantWaitlist = useCallback((slug, forPublic = isPublicRoute) => {
    if (forPublic) {
      return [];
    }
    try {
      const savedTenant = localStorage.getItem(`kutz_${slug}_waitlist`);
      if (savedTenant) return JSON.parse(savedTenant);
      if (slug === DEFAULT_SHOP_SLUG) {
        const saved = localStorage.getItem('kutz_waitlist');
        if (saved) return JSON.parse(saved);
        return [
          {
            id: 'wl-1',
            clientName: 'Santi Giménez',
            phone: '+34 688 112 233',
            service: 'Skin Fade + Barba',
            preferredBarber: 'REX',
            requestedSlot: 'Hoy tarde (17:00-20:00)',
            createdAt: 'Hoy 16:30'
          },
          {
            id: 'wl-2',
            clientName: 'Adrián "Busta" Ramos',
            phone: '+34 699 554 332',
            service: 'Corte Clásico & Peine #2',
            preferredBarber: 'Cualquiera',
            requestedSlot: 'Cualquier hueco libre',
            createdAt: 'Hoy 15:45'
          }
        ];
      }
    } catch {
      // ignore
    }
    return [];
  }, [isPublicRoute]);

  const [waitlist, setWaitlist] = useState(() => loadTenantWaitlist(activeShopSlug, isPublicRoute));
  // Tracks which tenant slug the current clients/queue/waitlist state belongs to so persistence effects never cross-contaminate on switch
  const [hydratedSlug, setHydratedSlug] = useState(() => (isPublicRoute ? null : activeShopSlug));

  // Re-hydrate tenant clients & queue whenever activeShopSlug, route privacy, or remote sync completes
  useEffect(() => {
    if (isPublicRoute) {
      setHydratedSlug(null);
      return;
    }
    setClients(loadTenantClients(activeShopSlug, false));
    setWalkInQueue(loadTenantQueue(activeShopSlug, false));
    setWaitlist(loadTenantWaitlist(activeShopSlug, false));
    setHydratedSlug(activeShopSlug);
  }, [activeShopSlug, lastSyncTime, isPublicRoute, loadTenantClients, loadTenantQueue, loadTenantWaitlist]);

  // Persist walkInQueue to tenant storage (only when state is hydrated for activeShopSlug)
  useEffect(() => {
    if (isPublicRoute || hydratedSlug !== activeShopSlug) return;
    try {
      const keys = getShopStorageKeys(activeShopSlug);
      safeSetItem(keys.QUEUE, walkInQueue);
      if (activeShopSlug === DEFAULT_SHOP_SLUG) {
        localStorage.setItem('kutz_walkin_queue', JSON.stringify(walkInQueue));
      }
    } catch (e) {
      console.warn('Error guardando walkInQueue:', e);
    }
  }, [walkInQueue, activeShopSlug, isPublicRoute, hydratedSlug]);

  // Persist waitlist to tenant storage (only when state is hydrated for activeShopSlug)
  useEffect(() => {
    if (isPublicRoute || hydratedSlug !== activeShopSlug) return;
    try {
      localStorage.setItem(`kutz_${activeShopSlug}_waitlist`, JSON.stringify(waitlist));
      if (activeShopSlug === DEFAULT_SHOP_SLUG) {
        localStorage.setItem('kutz_waitlist', JSON.stringify(waitlist));
      }
    } catch (e) {
      console.warn('Error guardando waitlist:', e);
    }
  }, [waitlist, activeShopSlug, isPublicRoute, hydratedSlug]);

  // Guardar clientes con protección contra QuotaExceededError y aislamiento por barbería
  useEffect(() => {
    if (isPublicRoute || hydratedSlug !== activeShopSlug) return;
    const keys = getShopStorageKeys(activeShopSlug);
    safeSetItem(keys.CLIENTS, clients);
    if (activeShopSlug === DEFAULT_SHOP_SLUG) {
      saveClientsToStorage(clients);
    }
  }, [clients, activeShopSlug, isPublicRoute, hydratedSlug]);

  // Helper to sync client mutation to Netlify Blobs
  const syncClientUpsert = useCallback(
    (clientObj) => {
      if (isPublicRoute || !clientObj) return;
      dispatchBarberAction(
        activeShopSlug,
        'upsert_client',
        clientObj,
        effectivePin
      ).catch(() => {});
    },
    [activeShopSlug, effectivePin, isPublicRoute]
  );

  const addWalkIn = (entry) => {
    const defaultBarberName = activeShop?.barbers?.[0]?.name || 'Cualquiera';
    const defaultServiceName = activeShop?.services?.[0]?.name || 'Corte Skin Fade';
    const newEntry = {
      id: entry?.id || `wq-${Date.now()}`,
      shopSlug: activeShopSlug,
      name: entry.name || 'Cliente Walk-In',
      phone: entry.phone || '',
      service: entry.service || defaultServiceName,
      barber: entry.barber || defaultBarberName,
      waitMinutes: Number(entry.waitMinutes) || 20,
      status: 'waiting',
      timeIn: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    };
    setWalkInQueue((prev) => [...prev, newEntry]);
    if (!isPublicRoute) {
      dispatchBarberAction(
        activeShopSlug,
        'add_walkin',
        newEntry,
        effectivePin
      ).catch(() => {});
    }
    return newEntry;
  };

  const removeWalkIn = (queueId) => {
    setWalkInQueue((prev) => prev.filter((q) => q.id !== queueId));
    if (!isPublicRoute) {
      dispatchBarberAction(
        activeShopSlug,
        'remove_walkin',
        { queueId },
        effectivePin
      ).catch(() => {});
    }
  };

  const notifyWalkInWhatsApp = (queueId) => {
    const item = walkInQueue.find((q) => q.id === queueId);
    if (!item) return;
    const shopLabel = activeShop?.name || 'KUTZ // BARBER STUDIO';
    const barberLabel = item.barber || activeShop?.barbers?.[0]?.name || 'tu barbero';
    const draft = `¡Buenas ${item.name}! 💈 Tu turno en ${shopLabel} está listo en aproximadamente 10 minutos con ${barberLabel}. Pasa al local para ir preparando el sillón. ¡Te esperamos!`;
    const cleanPhone = (item.phone || '').replace(/\D/g, '');
    if (cleanPhone.length >= 9 && typeof window !== 'undefined') {
      window.open(buildWhatsAppUrl(item.phone, draft), '_blank', 'noopener,noreferrer');
    }
    return draft;
  };

  const addWaitlistEntry = (entry) => {
    const newEntry = {
      id: `wl-${Date.now()}`,
      clientName: entry.clientName || 'Cliente en Espera',
      phone: entry.phone || '',
      service: entry.service || activeShop?.services?.[0]?.name || 'Skin Fade',
      preferredBarber: entry.preferredBarber || activeShop?.barbers?.[0]?.name || 'Cualquiera',
      requestedSlot: entry.requestedSlot || 'Próximo hueco',
      createdAt: 'Ahora'
    };
    setWaitlist((prev) => [newEntry, ...prev]);
    return newEntry;
  };

  const removeWaitlistEntry = (id) => {
    setWaitlist((prev) => prev.filter((w) => w.id !== id));
  };

  const notifyFlashSlot = (waitlistEntry, slotTime = '18:15', barberName = null) => {
    const shopLabel = activeShop?.name || 'la barbería';
    const targetBarber = barberName || activeShop?.barbers?.[0]?.name || 'tu barbero';
    const cleanPhone = (waitlistEntry.phone || '').replace(/\D/g, '');
    const draft = `¡Qué pasa ${waitlistEntry.clientName.split(' ')[0]}! ⚡ Se acaba de liberar un hueco flash en ${shopLabel} hoy a las ${slotTime} con ${targetBarber}. Como estabas en lista de espera, tienes 10 MINUTOS para confirmarme si te lo guardo antes de pasarlo al siguiente. ¿Te lo quedas? 🔥`;
    if (cleanPhone.length >= 9 && typeof window !== 'undefined') {
      window.open(buildWhatsAppUrl(waitlistEntry.phone, draft), '_blank', 'noopener,noreferrer');
    }
    return draft;
  };

  // --- 3. GESTIÓN DE FIABILIDAD Y NO-SHOWS POR CLIENTE ---
  const recordNoShow = (clientId) => {
    setClients((prev) =>
      prev.map((c) => {
        if (String(c.id) === String(clientId)) {
          const count = (c.noShowCount || 0) + 1;
          const reliability = Math.max(15, 100 - count * 35);
          const updated = {
            ...c,
            noShowCount: count,
            reliabilityScore: reliability,
            isWalkInOnly: count >= 2,
            lastNoShowDate: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
          };
          syncClientUpsert(updated);
          return updated;
        }
        return c;
      })
    );
  };

  const recordCompletedVisit = (clientId) => {
    setClients((prev) =>
      prev.map((c) => {
        if (String(c.id) === String(clientId)) {
          const updated = {
            ...c,
            completedVisits: (c.completedVisits || 0) + 1,
            reliabilityScore: Math.min(100, (c.reliabilityScore || 100) + 10)
          };
          syncClientUpsert(updated);
          return updated;
        }
        return c;
      })
    );
  };

  // Añadir un nuevo cliente (preservando treatment y treatments si vienen de reserva QR)
  const addClient = (clientData) => {
    const newClient = {
      lastVisit: 'Alta nueva',
      reliabilityScore: 100,
      noShowCount: 0,
      bonos: [],
      ...clientData,
      id: clientData?.id ? String(clientData.id) : Date.now().toString(),
      treatment: clientData?.treatment || 'Sin tratamiento previo',
      treatments: Array.isArray(clientData?.treatments) ? clientData.treatments : []
    };
    setClients((prev) => [newClient, ...prev]);
    syncClientUpsert(newClient);
    return newClient;
  };

  // Obtener un cliente específico (comparación segura por string)
  const getClient = (id) => {
    return clients.find((c) => String(c.id) === String(id));
  };

  // Actualizar datos de un cliente (patch inmutable seguro)
  const updateClient = (clientId, patch) => {
    if (!clientId || !patch) return;
    setClients((prev) =>
      prev.map((c) => {
        if (String(c.id) === String(clientId)) {
          const updated = { ...c, ...patch };
          syncClientUpsert(updated);
          return updated;
        }
        return c;
      })
    );
  };

  // Eliminar ficha de cliente
  const deleteClient = (clientId) => {
    if (!clientId) return;
    setClients((prev) => prev.filter((c) => String(c.id) !== String(clientId)));
    if (!isPublicRoute) {
      dispatchBarberAction(
        activeShopSlug,
        'delete_client',
        { clientId },
        effectivePin
      ).catch(() => {});
    }
  };

  // Añadir sesión rápida a tratamientos directamente desde tarjeta 3D o vista de cliente
  const quickAddSession = (clientId, sessionData = {}) => {
    if (!clientId || !sessionData) return null;
    const now = new Date();
    const sessionTimestamp =
      sessionData.timestamp ||
      (sessionData.date ? parseTreatmentDate(sessionData.date).getTime() : Date.now());
    const dateStr =
      sessionData.date ||
      `${now.getDate()} ${['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][now.getMonth()]} ${now.getFullYear()}`;
    const newSession = {
      id: sessionData.id || `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: sessionData.serviceName || sessionData.name || 'Corte & Fade en Sillón',
      date: dateStr,
      timestamp: sessionTimestamp,
      formula: sessionData.formula || 'Base Shaver #000 → #0.5 → #1.5',
      notes: sessionData.notes || '',
      ritual: sessionData.ritual || '',
      barber: sessionData.barber || activeShop?.barbers?.[0]?.name || 'Barbero Titular',
      photos: sessionData.photos || null
    };

    setClients((prev) =>
      prev.map((c) => {
        if (String(c.id) === String(clientId)) {
          const existing = Array.isArray(c.treatments) ? c.treatments : [];
          const updated = {
            ...c,
            lastService: newSession.name,
            lastVisit: newSession.date,
            treatment: newSession.name,
            treatments: [newSession, ...existing]
          };
          syncClientUpsert(updated);
          return updated;
        }
        return c;
      })
    );

    return newSession;
  };

  // Añadir tratamiento a un cliente
  const addTreatment = (clientId, treatmentData) => {
    const newTreatmentId = treatmentData.id || Date.now();
    const treatmentTimestamp = treatmentData.timestamp || Date.now();
    const newTreatment = {
      ...treatmentData,
      id: newTreatmentId,
      timestamp: treatmentTimestamp,
      date:
        treatmentData.date ||
        new Date(treatmentTimestamp).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
      photos: treatmentData.photos || null
    };

    setClients((prevClients) =>
      prevClients.map((client) => {
        if (String(client.id) === String(clientId)) {
          const updated = {
            ...client,
            lastVisit: newTreatment.date,
            treatment: newTreatment.name,
            treatments: [newTreatment, ...(client.treatments || [])]
          };
          syncClientUpsert(updated);
          return updated;
        }
        return client;
      })
    );

    return newTreatment;
  };

  // Actualizar fotos de un tratamiento (Antes y Después) con comparación estricta de IDs
  const addPhotoToTreatment = (clientId, treatmentId, type, photoUrl) => {
    setClients((prevClients) =>
      prevClients.map((client) => {
        if (String(client.id) === String(clientId)) {
          const updatedTreatments = (client.treatments || []).map((t) => {
            if (String(t.id) === String(treatmentId)) {
              return {
                ...t,
                photos: {
                  ...(t.photos || {}),
                  [type]: photoUrl // 'before' o 'after'
                }
              };
            }
            return t;
          });
          const updated = { ...client, treatments: updatedTreatments };
          syncClientUpsert(updated);
          return updated;
        }
        return client;
      })
    );
  };

  // Actualizar consentimiento informado RGPD y firma digital
  const updateClientConsent = (clientId, consentData) => {
    setClients((prev) =>
      prev.map((client) => {
        if (String(client.id) === String(clientId)) {
          const updated = {
            ...client,
            consent: consentData
          };
          syncClientUpsert(updated);
          return updated;
        }
        return client;
      })
    );
  };

  // Importar o restaurar copia de seguridad completa de clientes
  const importClientsBackup = (importedClients) => {
    if (Array.isArray(importedClients) && importedClients.length > 0) {
      setClients(importedClients);
      importedClients.forEach((c) => syncClientUpsert(c));
      return true;
    }
    return false;
  };

  // Añadir un nuevo bono o pack a un cliente
  const addBono = (clientId, bonoData) => {
    const newBono = {
      id: bonoData.id || `bono-${Date.now()}`,
      name: bonoData.name || 'Bono de Sesiones',
      totalSessions: Number(bonoData.totalSessions) || 5,
      usedSessions: Number(bonoData.usedSessions) || 0,
      price: bonoData.price || '',
      notes: bonoData.notes || '',
      createdAt: bonoData.createdAt || new Date().toISOString(),
      status:
        (Number(bonoData.usedSessions) || 0) >= (Number(bonoData.totalSessions) || 5)
          ? 'completed'
          : 'active'
    };

    setClients((prev) =>
      prev.map((client) => {
        if (String(client.id) === String(clientId)) {
          const existingBonos = Array.isArray(client.bonos) ? client.bonos : [];
          const updated = {
            ...client,
            bonos: [newBono, ...existingBonos]
          };
          syncClientUpsert(updated);
          return updated;
        }
        return client;
      })
    );

    return newBono;
  };

  // Consumir 1 sesión de un bono y registrar automáticamente el tratamiento
  const consumeBonoSession = (clientId, bonoId, sessionNotes = '') => {
    let createdTreatment = null;

    setClients((prev) =>
      prev.map((client) => {
        if (String(client.id) === String(clientId)) {
          const existingBonos = Array.isArray(client.bonos) ? client.bonos : [];

          const updatedBonos = existingBonos.map((b) => {
            if (String(b.id) === String(bonoId)) {
              const newUsed = Math.min(b.totalSessions, (Number(b.usedSessions) || 0) + 1);
              return {
                ...b,
                usedSessions: newUsed,
                status: newUsed >= b.totalSessions ? 'completed' : 'active'
              };
            }
            return b;
          });

          // Crear automáticamente el registro de tratamiento
          const targetBono = existingBonos.find((b) => String(b.id) === String(bonoId));
          if (targetBono && (Number(targetBono.usedSessions) || 0) < targetBono.totalSessions) {
            const sessionNum = (Number(targetBono.usedSessions) || 0) + 1;
            const remaining = targetBono.totalSessions - sessionNum;
            const timestamp = Date.now();
            const dateStr = new Date(timestamp).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });

            createdTreatment = {
              id: Date.now(),
              name: `Sesión ${sessionNum}/${targetBono.totalSessions} — ${targetBono.name}`,
              formula: `Bono Activo #${targetBono.id} (${remaining} restante${remaining === 1 ? '' : 's'})`,
              notes:
                sessionNotes ||
                `Sesión ${sessionNum} de ${targetBono.totalSessions} consumida del bono. ${remaining === 0 ? '¡Bono completado con éxito!' : `Restan ${remaining} sesiones pendientes.`}`,
              timestamp,
              date: dateStr,
              photos: null
            };

            const updated = {
              ...client,
              lastVisit: dateStr,
              treatment: createdTreatment.name,
              bonos: updatedBonos,
              treatments: [createdTreatment, ...(client.treatments || [])]
            };
            syncClientUpsert(updated);
            return updated;
          }

          const updated = { ...client, bonos: updatedBonos };
          syncClientUpsert(updated);
          return updated;
        }
        return client;
      })
    );

    return createdTreatment;
  };

  // Eliminar o archivar un bono
  const deleteBono = (clientId, bonoId) => {
    setClients((prev) =>
      prev.map((client) => {
        if (String(client.id) === String(clientId)) {
          const existingBonos = Array.isArray(client.bonos) ? client.bonos : [];
          const updated = {
            ...client,
            bonos: existingBonos.filter((b) => String(b.id) !== String(bonoId))
          };
          syncClientUpsert(updated);
          return updated;
        }
        return client;
      })
    );
  };

  return (
    <ClientContext.Provider
      value={{
        clients,
        addClient,
        getClient,
        updateClient,
        deleteClient,
        quickAddSession,
        getFadeAlert,
        addTreatment,
        addPhotoToTreatment,
        updateClientConsent,
        importClientsBackup,
        calculateRetentionInsights,
        addBono,
        consumeBonoSession,
        deleteBono,
        businessMode,
        setBusinessMode,
        activeModeConfig,
        BUSINESS_MODES,
        // Nuevos sistemas añadidos para KUTZ OS:
        walkInQueue,
        addWalkIn,
        removeWalkIn,
        notifyWalkInWhatsApp,
        waitlist,
        addWaitlistEntry,
        removeWaitlistEntry,
        notifyFlashSlot,
        recordNoShow,
        recordCompletedVisit
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
