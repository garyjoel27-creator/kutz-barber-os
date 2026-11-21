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
  // Términos: botox, toxina, neuromodulador, frente, patas de gallo, glabela (excluyendo botox capilar)
  const botoxKeywords = ['botox', 'toxina', 'neuromodulador', 'frente', 'patas de gallo', 'glabela'];
  const botoxTreatments = client.treatments
    .filter(t => {
      const normName = normalizeText(t.name);
      const normNotes = normalizeText(t.notes);
      if (normName.includes('botox capilar') || normNotes.includes('botox capilar')) return false;
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
  // Términos: filler, hialurónico, ácido hialuronico, labios, relleno, pómulos, ojeras (excluyendo relleno acrílico de uñas)
  const fillerKeywords = ['filler', 'hialuronico', 'acido hialuronico', 'labios', 'relleno', 'pomulos', 'ojeras'];
  const fillerTreatments = client.treatments
    .filter(t => {
      const normName = normalizeText(t.name);
      const normNotes = normalizeText(t.notes);
      if (normName.includes('relleno acrilico') || normNotes.includes('relleno acrilico') || normName.includes('acrilic')) return false;
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

  // 3. Evaluación Estética: Mirada (Pestañas/Cejas) y Manicura/Uñas Acrílicas (Ciclo 18-21 días)
  const nailsLashesKeywords = [
    'manicura', 'semipermanente', 'acrigel', 'lifting de pestanas', 
    'extension de pestanas', 'laminado de cejas', 'microblading',
    'unas acrilicas', 'relleno acrilico', 'pedicura', 'base rubber'
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
    const thresholdDays = 18; // Ciclo de 18-21 días para relleno de uñas/pestañas/cejas

    if (elapsedDays >= thresholdDays) {
      const urgency = elapsedDays >= 24 ? 'high' : 'upcoming';
      const statusLabel = elapsedDays >= 24 ? 'Relleno Prioritario' : 'Ciclo 3 Semanas';
      const message = `Han transcurrido ${elapsedDays} días desde el servicio de ${latest.name}. Por el crecimiento natural de la uña (~2.5 mm) / ciclo de pestañas y cejas, es el momento óptimo para realizar el relleno o mantenimiento y evitar levantamientos.`;
      const whatsappDraft = `Hola ${client.name || ''} 💅✨ Te escribimos desde CM Salón D’ Campodónico. Ya han pasado ${elapsedDays} días desde tus ${latest.name} y toca tu relleno/mantenimiento para que sigas luciéndolas impecables. Tenemos tu diseño y talla guardados en tu ficha, ¿te reservamos cita esta semana?`;

      insights.push({
        id: `retention-estetica-mirada-${client.id}-${latest.id}`,
        type: 'estetica_mirada',
        title: 'Relleno de Uñas / Mantenimiento (Ciclo 18-21 días)',
        treatmentName: latest.name,
        lastDate: latest.date,
        elapsedDays,
        thresholdDays,
        urgency,
        urgencyLevel: elapsedDays >= 24 ? 'alta' : 'sugerida',
        statusLabel,
        message,
        suggestedAction: 'Agendar Relleno / Manicura',
        suggestedTreatmentName: `Relleno ${latest.name}`,
        suggestedActionObj: {
          type: 'rebook',
          treatmentName: `Relleno ${latest.name}`,
          actionLabel: 'Agendar Relleno / Manicura'
        },
        whatsappDraft
      });
    }
  }

  // 4. Evaluación Estética Cabina: Higiene Facial, Radiofrecuencia, Láser Diodo, Indiba, Dermapen (Ciclo 28-35 días)
  const cabinKeywords = [
    'laser diodo', 'radiofrecuencia indiba', 'indiba', 'maderoterapia', 'dermapen',
    'higiene facial profunda', 'radiofrecuencia', 'rejuvenecimiento facial', 'ultrasonidos', 'drenaje corporal'
  ];
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
    const thresholdDays = 28; // Ciclo de 4-5 semanas para sesiones de cabina facial/corporal

    if (elapsedDays >= thresholdDays) {
      const urgency = elapsedDays >= 40 ? 'high' : 'upcoming';
      const statusLabel = elapsedDays >= 40 ? 'Siguiente Sesión' : 'Ventana de Cabina';
      const message = `Han transcurrido ${elapsedDays} días desde la sesión de ${latest.name}. Para mantener la luminosidad, oxigenación y síntesis de colágeno del protocolo en cabina, se recomienda programar la siguiente sesión.`;
      const whatsappDraft = `Hola ${client.name || ''} ✨ Te saludamos desde cabina estética. Han pasado ${elapsedDays} días desde tu última sesión de ${latest.name}. Para mantener la piel radiante y continuar tu protocolo, ¿agendamos tu próxima cita esta semana?`;

      insights.push({
        id: `retention-estetica-cabina-${client.id}-${latest.id}`,
        type: 'estetica_cabina',
        title: 'Continuidad de Protocolo Facial / Corporal en Cabina',
        treatmentName: latest.name,
        lastDate: latest.date,
        elapsedDays,
        thresholdDays,
        urgency,
        urgencyLevel: elapsedDays >= 40 ? 'alta' : 'sugerida',
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

  // 5. Evaluación Peluquería & Colorimetría: Raíz / Tinte / Balayage / Keratina / Botox Capilar (Ciclo 28-45 días)
  const hairKeywords = [
    'coloracion raiz', 'cobertura de canas', 'retoque de raiz', 'tinte inoa', 'tinte de raiz',
    'balayage', 'babylights', 'matiz gloss', 'alisado organico', 'keratina', 'botox capilar', 'brushing'
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

  // 1. Detectar servicios de Uñas, Manicura & Pedicura (Ciclo relleno 18-21 días)
  const nailsKeywords = ['acrilic', 'uñas', 'unas', 'manicura', 'semipermanente', 'pedicura', 'base rubber', 'baby boomer', 'almendra'];
  const nailsServices = treatments.filter(t => {
    const name = normalizeText(t.name || '');
    const notes = normalizeText(t.notes || '');
    const formula = normalizeText(t.formula || '');
    return nailsKeywords.some(kw => {
      const cleanKw = normalizeText(kw);
      return name.includes(cleanKw) || notes.includes(cleanKw) || formula.includes(cleanKw);
    });
  }).sort((a, b) => {
    const tA = parseTreatmentDate(a.date, a.timestamp).getTime();
    const tB = parseTreatmentDate(b.date, b.timestamp).getTime();
    return tB - tA;
  });

  if (nailsServices.length > 0) {
    const latest = nailsServices[0];
    const lastTime = parseTreatmentDate(latest.date, latest.timestamp).getTime();
    const elapsedDays = Math.max(0, Math.floor((refTime - lastTime) / (1000 * 60 * 60 * 24)));
    if (elapsedDays >= 21) {
      return {
        alertLevel: 'urgent',
        label: `💅 Relleno Vencido (+${elapsedDays}d)`,
        daysRemaining: 0,
        elapsedDays,
        daysElapsed: elapsedDays,
        badgeColor: '#EC4899',
        requiresRetouch: true
      };
    } else if (elapsedDays >= 15) {
      const remaining = 21 - elapsedDays;
      return {
        alertLevel: 'warning',
        label: remaining <= 3 ? `💅 Relleno en ${remaining} días` : `✨ Ventana Relleno (${remaining}d)`,
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
        label: '💅 Uñas recién hechas',
        daysRemaining: remaining,
        elapsedDays,
        daysElapsed: elapsedDays,
        badgeColor: '#EC4899',
        requiresRetouch: false
      };
    }
  }

  // 2. Detectar servicios de Peluquería Femenina & Estética en Cabina (Sin uñas, Ciclo 21-28 días)
  const salonEsteticaKeywords = [
    'balayage', 'babylights', 'tinte', 'raiz', 'coloracion', 'keratina', 'botox capilar',
    'brushing', 'peinado', 'higiene facial', 'radiofrecuencia', 'rejuvenecimiento',
    'peeling', 'masaje', 'drenaje', 'ultrasonidos', 'lifting de pestanas'
  ];
  const salonServices = treatments.filter(t => {
    const name = normalizeText(t.name || '');
    const notes = normalizeText(t.notes || '');
    const formula = normalizeText(t.formula || '');
    return salonEsteticaKeywords.some(kw => {
      const cleanKw = normalizeText(kw);
      return name.includes(cleanKw) || notes.includes(cleanKw) || formula.includes(cleanKw);
    });
  }).sort((a, b) => {
    const tA = parseTreatmentDate(a.date, a.timestamp).getTime();
    const tB = parseTreatmentDate(b.date, b.timestamp).getTime();
    return tB - tA;
  });

  if (salonServices.length > 0) {
    const latest = salonServices[0];
    const lastTime = parseTreatmentDate(latest.date, latest.timestamp).getTime();
    const elapsedDays = Math.max(0, Math.floor((refTime - lastTime) / (1000 * 60 * 60 * 24)));
    if (elapsedDays >= 28) {
      return {
        alertLevel: 'urgent',
        label: `✨ Retoque Raíz/Cabina (+${elapsedDays}d)`,
        daysRemaining: 0,
        elapsedDays,
        daysElapsed: elapsedDays,
        badgeColor: '#EC4899',
        requiresRetouch: true
      };
    } else if (elapsedDays >= 18) {
      const remaining = 28 - elapsedDays;
      return {
        alertLevel: 'warning',
        label: remaining <= 3 ? `✨ Retoque en ${remaining} días` : `💆‍♀️ Ventana Retoque (${remaining}d)`,
        daysRemaining: remaining,
        elapsedDays,
        daysElapsed: elapsedDays,
        badgeColor: '#F59E0B',
        requiresRetouch: true
      };
    } else {
      const remaining = 18 - elapsedDays;
      return {
        alertLevel: 'normal',
        label: '✨ Color y Piel al día',
        daysRemaining: remaining,
        elapsedDays,
        daysElapsed: elapsedDays,
        badgeColor: '#EC4899',
        requiresRetouch: false
      };
    }
  }

  // 3. Barbería Urbana (Fade, Taper, Corte & Barba — Ciclo 15-21 días)
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
 * Perfiles de Especialidad del Negocio (Barbería Urbana por defecto + Uñas & Manicura + Peluquería & Estética)
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
  nails: {
    id: 'nails',
    shortName: 'Uñas, Manicura & Pedicura',
    badge: "CM Salón D’ Campodónico · Nails & Beauty",
    heroTitle: 'Panel de Nail Bar, Manicura & Pedicura Spa',
    heroSubtitle: 'Recetario exacto de formas (Almendra/Coffin/Cuadrada), tallas S/M/L, bases acrílicas/rubber, tonos, alertas de relleno 18-21 días y bonos VIP.',
    clientSingular: 'Clienta',
    clientPlural: 'Clientas',
    directoryTitle: 'Directorio de Clientas & Diseño de Uñas 3D',
    sessionButtonLabel: 'Registrar Uñas / Diseño',
    sessionModalTitle: 'Nuevo Servicio de Uñas, Manicura o Pedicura',
    formulaLabel: 'Fórmula de Uñas (Forma, Talla S/M/L, Sistema Acrílico/Rubber y Color/Efecto)',
    formulaPlaceholder: 'Ej. Forma Almendra · Talla M · Relleno Acrílico Cover Pink → Efecto Chrome Pearl / Baby Boomer · Fresa llama suave en cutícula...',
    allergyLabel: 'Sensibilidad en Cutícula, Lámpara UV/LED o Alergia a Acrilatos / HEMA',
    allergyPlaceholder: 'Ej. Cutícula muy fina (bajas RPM), alergia a HEMA (usar base HEMA-free), usar modo Low Heat en lámpara LED, onicofagia...',
    notesLabel: 'Largo Preferido, Forma de Lámina Ungueal & Gustos de la Clienta',
    notesPlaceholder: 'Ej. Le gusta forma Almendra estilizada en Talla M. Crecimiento rápido (relleno cada 18 días). Toma café con leche de avena...',
    quickTreatments: [
      'Uñas acrílicas Talla S',
      'Uñas acrílicas Talla M/L',
      'Relleno acrílico',
      'Manicura semipermanente con refuerzo',
      'Manicura / Limpieza tradicional',
      'Pedicura completa & Spa',
      'Higiene facial profunda'
    ],
    rgpdBadge: 'RGPD Alergias Acrilatos + Reels',
    rgpdCustodyText: 'Durante relación activa con el salón (Derecho de supresión inmediato disponible)',
    rgpdTreatmentClause: 'Autorizo la apertura de mi ficha técnica de uñas y estética, el registro de sensibilidades en cutícula o alergias a acrilatos/gel (Art. 9 RGPD), y la realización de los servicios de manicura, uñas esculpidas, pedicura o cuidado facial solicitados.'
  },
  estetica: {
    id: 'estetica',
    shortName: 'Estética & Cabina',
    badge: 'Centro de Estética Avanzada',
    heroTitle: 'Panel de Cabina & Recepción Estética',
    heroSubtitle: 'Gestión integral de protocolos faciales, corporales, radiofrecuencia, diseño de mirada y evolución visual.',
    clientSingular: 'Clienta',
    clientPlural: 'Clientas',
    directoryTitle: 'Directorio de Clientas & Cabina',
    sessionButtonLabel: 'Registrar Sesión en Cabina',
    sessionModalTitle: 'Nueva Sesión de Estética',
    formulaLabel: 'Parámetros Técnicos / Activos / Protocolo de Cabina',
    formulaPlaceholder: 'Ej. Higiene Facial + Ultrasonidos → Radiofrecuencia 40°C (20 min) + Vial Ácido Hialurónico | Lifting pestañas molde M...',
    allergyLabel: 'Sensibilidades, Alergias o Contraindicaciones en Piel',
    allergyPlaceholder: 'Ej. Piel reactiva/rosácea, alergia a ácidos glicólicos, cianoacrilato (pegamento pestañas), embarazo...',
    notesLabel: 'Rutina en Casa (Home Care) & Preferencias de Cabina',
    notesPlaceholder: 'Ej. Usa limpiador suave + SPF 50. Prefiere camilla templada, música relajante e infusión de frutos rojos...',
    quickTreatments: [
      'Higiene Facial Profunda + Ultrasonidos',
      'Radiofrecuencia / Rejuvenecimiento Facial',
      'Peeling Luminosidad & Vitaminas',
      'Masaje Relajante / Drenaje Corporal',
      'Diseño de Cejas & Lifting de Pestañas'
    ],
    rgpdBadge: 'Art. 9 RGPD + Imagen Redes',
    rgpdCustodyText: 'Durante relación activa (Derecho de supresión inmediato disponible)',
    rgpdTreatmentClause: 'Autorizo la apertura de mi ficha estética, el registro de alergias o sensibilidades cutáneas (Art. 9 RGPD) y la aplicación de los tratamientos de estética avanzada, aparatología o mirada solicitados.'
  },
  peluqueria: {
    id: 'peluqueria',
    shortName: 'Peluquería & Estética (Sin Uñas)',
    badge: 'Salón de Peluquería, Colorimetría & Estética Facial',
    heroTitle: 'Panel de Peluquería, Colorimetría & Cabina Estética',
    heroSubtitle: 'Recetario exacto de fórmulas de tinte al gramo, mechas Balayage, tratamientos de keratina y protocolos faciales y corporales en cabina.',
    clientSingular: 'Clienta',
    clientPlural: 'Clientas',
    directoryTitle: 'Directorio de Clientas · Pasaporte de Color & Cabina',
    sessionButtonLabel: 'Registrar Servicio / Fórmula',
    sessionModalTitle: 'Nuevo Servicio de Peluquería o Cabina Estética',
    formulaLabel: 'Fórmula Técnica de Colorimetría / Cabina (Gramos, Volúmenes, Activos y Tiempo)',
    formulaPlaceholder: 'Ej. Raíz: 30g Tinte Orgánico 7.1 + 15g 8.3 (Ox. 20 vol, 35 min) → Matiz Gloss 9.21 + Olaplex Nº1 | Cabina: Radiofrecuencia Facial + Vitamina C...',
    allergyLabel: 'Alergias Capilares (Test PPD 48h), Cuero Cabelludo o Sensibilidad Facial',
    allergyPlaceholder: 'Ej. Alergia a PPD/amoníaco, cuero cabelludo sensible, piel con rosácea en mejillas, test de sensibilidad 48h superado...',
    notesLabel: 'Diagnóstico de Fibra Capilar, Tipo de Piel & Rutina en Casa',
    notesPlaceholder: 'Ej. Base natural altura 6, porosidad media en puntas. En cabina prefiere camilla templada. Usa champú sin sulfatos y sérum hialurónico...',
    quickTreatments: [
      'Corte y Peinado / Brushing',
      'Color / Tinte de Raíz Orgánico',
      'Mechas Balayage / Babylights + Matiz',
      'Tratamiento Hidratación / Keratina / Botox Capilar',
      'Higiene Facial Profunda + Ultrasonidos',
      'Radiofrecuencia / Rejuvenecimiento Facial',
      'Peeling Luminosidad & Vitaminas',
      'Masaje Relajante / Drenaje Corporal',
      'Diseño de Cejas & Lifting de Pestañas'
    ],
    rgpdBadge: 'RGPD Test Alergia PPD + Cabina',
    rgpdCustodyText: 'Durante relación activa (Derecho de supresión inmediato disponible)',
    rgpdTreatmentClause: 'Autorizo la apertura de mi ficha técnica de peluquería y estética, el registro de pruebas de sensibilidad a tintes o cosméticos (Art. 9 RGPD) y la realización de los servicios capilares, faciales o corporales solicitados.'
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

export const INITIAL_NAILS_CLIENTS = [
  {
    id: '1',
    name: 'Valeria Betancor',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600',
    phone: '+34 638 877 945',
    email: 'valeria.betancor@ejemplo.com',
    allergies: 'Cutícula fina y sensible en dedos anulares. Usar fresa llama aro rojo a bajas RPM y primer sin ácido (HEMA-Free).',
    notes: 'Le encanta la forma Almendra estilizada en Talla M y tonos Milky / Baby Boomer. Pide café con leche de avena.',
    lastVisit: '04 Oct 2026',
    treatment: 'Uñas acrílicas Talla M/L + Baby Boomer',
    bonos: [
      {
        id: 'bn-101',
        name: 'Bono Nails VIP: 4 Rellenos Acrílicos + Hidratación',
        totalSessions: 4,
        usedSessions: 3,
        price: '125€',
        notes: 'Mantenimiento cada 21 días con aceite de cutículas y limado estructural.',
        createdAt: '2026-08-10',
        status: 'active'
      }
    ],
    treatments: [
      {
        id: 401,
        date: '04 Oct 2026',
        timestamp: new Date('2026-10-04T16:30:00Z').getTime(),
        name: 'Uñas acrílicas Talla M/L',
        formula: 'Forma Almendra · Talla M · Acrílico Cover Pink + Milky White (Baby Boomer) · Top Coat Efecto Glazed · Torno ruso suave',
        notes: 'Esculpido con molde sin escalón. Sellado perfecto en zona de cutícula con fresa diamante.',
        ritual: 'Exfoliación de manos con azúcar de rosas + aceite de almendras',
        photos: {
          before: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=80&w=800',
          after: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&q=80&w=800'
        }
      }
    ],
    consent: {
      signed: true,
      signedAt: '2026-10-04T16:20:00Z',
      formattedDate: '04 Oct 2026, 16:20',
      permissions: {
        treatment: true,
        photosPrivate: true,
        photosMarketing: true,
        communications: true
      },
      legalNoticeVersion: 'RGPD-2026-v2.1',
      legalCustodian: "CM Salón D’ Campodónico · Nails & Beauty"
    }
  },
  {
    id: '2',
    name: 'Lucía Perdomo',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=600',
    photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=600',
    phone: '+34 628 441 122',
    email: 'lucia.perdomo@ejemplo.com',
    allergies: 'Sin alergias a acrilatos. Lámina ungueal fina en índices: reforzar siempre ápice con Base Rubber.',
    notes: 'Prefiere uña corta cómoda (Cuadrada Suave / Squoval Talla S) por su trabajo en oficina. Combina manos con Pedicura Spa.',
    lastVisit: '18 Oct 2026',
    treatment: 'Manicura semipermanente con refuerzo + Pedicura completa & Spa',
    bonos: [
      {
        id: 'bn-201',
        name: 'Pack 3 Manicuras Refuerzo + Pedicura Completa & Spa',
        totalSessions: 3,
        usedSessions: 1,
        price: '145€',
        notes: 'Incluye nivelación con Base Rubber y pedicura completa con sales marinas.',
        createdAt: '2026-09-15',
        status: 'active'
      }
    ],
    treatments: [
      {
        id: 402,
        date: '18 Oct 2026',
        timestamp: new Date('2026-10-18T11:30:00Z').getTime(),
        name: 'Manicura semipermanente con refuerzo + Pedicura completa & Spa',
        formula: 'Forma Cuadrada Suave (Squoval) · Talla S · Nivelación Base Rubber Rosada #02 · Color Rojo Cereza #14 · Pedicura Spa sales minerales',
        notes: 'Nivelación de arquitectura en uñas índices. Pedicura completa con retirada de durezas y masaje hidratante.',
        ritual: 'Baño espumoso tibio + manteca de karité en talones',
        photos: {
          before: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&q=80&w=800',
          after: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=80&w=800'
        }
      }
    ],
    consent: {
      signed: true,
      signedAt: '2026-10-18T11:15:00Z',
      formattedDate: '18 Oct 2026, 11:15',
      permissions: {
        treatment: true,
        photosPrivate: true,
        photosMarketing: true,
        communications: true
      },
      legalNoticeVersion: 'RGPD-2026-v2.1',
      legalCustodian: "CM Salón D’ Campodónico · Nails & Beauty"
    }
  },
  {
    id: '3',
    name: 'Carla Mendoza',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=600',
    photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=600',
    phone: '+34 638 877 945',
    email: 'carla.mendoza@ejemplo.com',
    allergies: 'Sensibilidad al calor brusco en lámpara UV/LED: activar siempre botón Low Heat (99s) al polimerizar gel o base.',
    notes: 'Clienta VIP en CM Salón D’ Campodónico (Arrecife). Crecimiento rápido de uña natural (relleno puntual cada 18-21 días). Aprovecha la cita para Higiene Facial Profunda.',
    lastVisit: '28 Sep 2026',
    treatment: 'Relleno acrílico + Efecto Chrome Pearl & Higiene facial profunda',
    bonos: [
      {
        id: 'bn-301',
        name: 'Membresía VIP Campodónico: 4 Rellenos Acrílicos + Nail Art',
        totalSessions: 4,
        usedSessions: 2,
        price: '130€',
        notes: 'Incluye relleno acrílico Talla S/M, efecto Chrome o Francesa y bebida en salón.',
        createdAt: '2026-08-20',
        status: 'active'
      }
    ],
    treatments: [
      {
        id: 403,
        date: '28 Sep 2026',
        timestamp: new Date('2026-09-28T16:00:00Z').getTime(),
        name: 'Relleno acrílico + Higiene facial profunda',
        formula: 'Forma Almendra · Talla M · Relleno Acrílico Cover Rose → Polvo Chrome Pearl Glazed · Francesa Micro Blanca · Aceite de cutículas',
        notes: 'Se rebaja 2 mm el largo para mantener equilibrio del ápice. Sin levantamientos previos. Acabado perlado espejo impecable.',
        ritual: 'Masaje de manos con crema de colágeno + velo facial calmante',
        photos: {
          before: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800',
          after: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&q=80&w=800'
        }
      },
      {
        id: 404,
        date: '07 Sep 2026',
        timestamp: new Date('2026-09-07T17:00:00Z').getTime(),
        name: 'Uñas acrílicas Talla S',
        formula: 'Puesta nueva con molde · Forma Almendra · Talla S/M · Acrílico Nude Petals + Top Brillante',
        notes: 'Primera puesta esculpida desde cero. Excelente adherencia.',
        ritual: 'Hidratación de cutícula con vitamina E',
        photos: {
          before: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&q=80&w=800',
          after: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=80&w=800'
        }
      }
    ],
    consent: {
      signed: true,
      signedAt: '2026-09-07T16:45:00Z',
      formattedDate: '07 Sep 2026, 16:45',
      permissions: {
        treatment: true,
        photosPrivate: true,
        photosMarketing: true,
        communications: true
      },
      legalNoticeVersion: 'RGPD-2026-v2.1',
      legalCustodian: "CM Salón D’ Campodónico · Nails & Beauty"
    }
  }
];

export const INITIAL_SALON_ESTETICA_CLIENTS = [
  {
    id: '1',
    name: 'Sofía Cabrera',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600',
    phone: '+34 638 877 945',
    email: 'sofia.cabrera@ejemplo.com',
    allergies: 'Cuero cabelludo sensible a tintes con amoníaco. Usar siempre coloración orgánica sin PPD + aceite protector en contorno.',
    notes: '70% de cana en sienes (empezar aplicación por frontal). Le gusta el flequillo cortina desfilado a la altura del pómulo y ondas al agua suaves.',
    lastVisit: '20 Sep 2026',
    treatment: 'Color / Tinte de Raíz Orgánico + Corte y Peinado / Brushing',
    bonos: [
      {
        id: 'bpe-101',
        name: 'Bono Color & Brushing: 4 Retoques de Raíz + Hidratación',
        totalSessions: 4,
        usedSessions: 2,
        price: '140€',
        notes: 'Mantenimiento mensual de raíz orgánica, lavado spa y peinado Brushing.',
        createdAt: '2026-07-15',
        status: 'active'
      }
    ],
    treatments: [
      {
        id: 501,
        date: '20 Sep 2026',
        timestamp: new Date('2026-09-20T10:30:00Z').getTime(),
        name: 'Color / Tinte de Raíz Orgánico + Corte y Peinado / Brushing',
        formula: 'Raíz: 35g Tinte Orgánico Sin Amoníaco 6.0 + 15g 6.1 (Ox. 20 vol, 35 min) → Emulsión medios/puntas Gloss 7.31 · Brushing ondas suaves',
        notes: 'Cobertura 100% de cana en sienes sin irritación. Despuntado de 1.5 cm en capas largas para dar movimiento.',
        ritual: 'Masaje capilar relajante en lavacabezas + ampolla de proteínas de seda',
        photos: {
          before: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&q=80&w=800',
          after: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800'
        }
      }
    ],
    consent: {
      signed: true,
      signedAt: '2026-09-20T10:15:00Z',
      formattedDate: '20 Sep 2026, 10:15',
      permissions: {
        treatment: true,
        photosPrivate: true,
        photosMarketing: true,
        communications: true
      },
      legalNoticeVersion: 'RGPD-2026-v2.1',
      legalCustodian: 'Lumina · Peluquería & Estética'
    }
  },
  {
    id: '2',
    name: 'Martina Estévez',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=600',
    photo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=600',
    phone: '+34 645 991 200',
    email: 'martina.estevez@ejemplo.com',
    allergies: 'Piel mixta con tendencia a rosácea en mejillas (evitar vapor directo muy caliente y peelings glicólicos fuertes).',
    notes: 'Viene a cabina facial cada 4 semanas. Prefiere camilla templada, luz tenue y masaje craneal mientras actúa la mascarilla. También se hace Lifting de Pestañas.',
    lastVisit: '14 Oct 2026',
    treatment: 'Higiene Facial Profunda + Ultrasonidos & Radiofrecuencia Facial',
    bonos: [
      {
        id: 'bpe-201',
        name: 'Bono Cabina Facial: 4 Sesiones Radiofrecuencia + Vitaminas',
        totalSessions: 4,
        usedSessions: 2,
        price: '175€',
        notes: 'Protocolo reafirmante de colágeno con radiofrecuencia bipolar y ácido hialurónico.',
        createdAt: '2026-08-25',
        status: 'active'
      }
    ],
    treatments: [
      {
        id: 502,
        date: '14 Oct 2026',
        timestamp: new Date('2026-10-14T17:00:00Z').getTime(),
        name: 'Higiene Facial Profunda + Ultrasonidos & Radiofrecuencia',
        formula: 'Doble limpieza enzimática → Espátula Ultrasónica → Radiofrecuencia Facial 40°C (20 min en óvalo y pómulos) → Vial Ácido Hialurónico + Mascarilla Calmante',
        notes: 'Piel mucho más jugosa, poros limpios sin rojeces y efecto tensor inmediato en tercio inferior.',
        ritual: 'Drenaje linfático facial con cuarzo rosa frío + infusión de frutos rojos',
        photos: {
          before: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&q=80&w=800',
          after: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=800'
        }
      }
    ],
    consent: {
      signed: true,
      signedAt: '2026-10-14T16:45:00Z',
      formattedDate: '14 Oct 2026, 16:45',
      permissions: {
        treatment: true,
        photosPrivate: true,
        photosMarketing: true,
        communications: true
      },
      legalNoticeVersion: 'RGPD-2026-v2.1',
      legalCustodian: 'Lumina · Peluquería & Estética'
    }
  },
  {
    id: '3',
    name: 'Elena Lanzarote',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=600',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=600',
    phone: '+34 638 877 945',
    email: 'elena.lanzarote@ejemplo.com',
    allergies: 'Fibra capilar fina en puntas por mechas previas: añadir siempre protector Plex Paso 1 en decoloración y no superar 20 vol.',
    notes: 'Clienta VIP de Peluquería y Estética. Base natural altura 6; le encanta el rubio vainilla perlado frío con contorno iluminado (Money Piece). En cabina alterna Peeling Luminosidad y Diseño de Cejas.',
    lastVisit: '18 Sep 2026',
    treatment: 'Mechas Balayage / Babylights + Matiz & Tratamiento Botox Capilar',
    bonos: [
      {
        id: 'bpe-301',
        name: 'Membresía Salón & Cabina: 4 Sesiones Botox Capilar + Higiene Facial',
        totalSessions: 4,
        usedSessions: 1,
        price: '190€',
        notes: 'Combina nutrición capilar profunda efecto espejo y protocolo de luminosidad facial en cabina.',
        createdAt: '2026-09-18',
        status: 'active'
      }
    ],
    treatments: [
      {
        id: 503,
        date: '18 Sep 2026',
        timestamp: new Date('2026-09-18T11:00:00Z').getTime(),
        name: 'Mechas Balayage / Babylights + Matiz & Botox Capilar',
        formula: 'Contorno Money Piece + Balayage mano alzada (Deco Plex 20 vol) → Esfumado de raíz 7.1 (6 vol) → Matiz Gloss 9.21 + 10.12 (12 min) → Sellado Bótox Capilar Ácido Hialurónico',
        notes: 'Rubio beige perlado luminoso con transición súper natural en raíz para que crezca sin marca. Fibra sellada con brillo espejo.',
        ritual: 'Toalla tibia con aromaterapia en lavacabezas + sérum sellador de puntas',
        photos: {
          before: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&q=80&w=800',
          after: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=800'
        }
      },
      {
        id: 504,
        date: '22 Ago 2026',
        timestamp: new Date('2026-08-22T16:30:00Z').getTime(),
        name: 'Peeling Luminosidad & Vitaminas + Diseño de Cejas & Lifting de Pestañas',
        formula: 'Cabina: Peeling Enzimático + Cóctel Vitamina C 20% + Velo Colágeno | Mirada: Lifting de Pestañas molde M + Tinte Negro Azulado + Diseño Cejas a Hilo',
        notes: 'Mirada abierta natural y piel radiante antes de evento.',
        ritual: 'Masaje facial reafirmante + bruma termal',
        photos: {
          before: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&q=80&w=800',
          after: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=800'
        }
      }
    ],
    consent: {
      signed: true,
      signedAt: '2026-08-22T16:15:00Z',
      formattedDate: '22 Ago 2026, 16:15',
      permissions: {
        treatment: true,
        photosPrivate: true,
        photosMarketing: true,
        communications: true
      },
      legalNoticeVersion: 'RGPD-2026-v2.1',
      legalCustodian: 'Lumina · Peluquería & Estética'
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
    if (
      slug === DEFAULT_SHOP_SLUG ||
      slug === 'default' ||
      slug === 'campodonico-nails' ||
      slug === 'campodonico-unas' ||
      slug === 'peluqueria-estetica' ||
      slug === 'salon-estetica'
    ) {
      return list;
    }
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

  // Modo de negocio activo ('barber' por defecto, sincronizado con la tienda femenina activa si es uñas o peluquería-estética)
  const [businessMode, setBusinessMode] = useState(() => {
    if (activeShopSlug === 'campodonico-nails' || activeShopSlug === 'campodonico-unas') {
      return 'nails';
    }
    if (activeShopSlug === 'peluqueria-estetica' || activeShopSlug === 'salon-estetica') {
      return 'peluqueria';
    }
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
    if (activeShopSlug === 'campodonico-nails' || activeShopSlug === 'campodonico-unas') {
      setBusinessMode('nails');
    } else if (activeShopSlug === 'peluqueria-estetica' || activeShopSlug === 'salon-estetica') {
      setBusinessMode('peluqueria');
    } else if (
      activeShopSlug === 'joseh-barber' ||
      activeShopSlug === 'kutz-madrid' ||
      activeShopSlug === 'barberia-rex'
    ) {
      setBusinessMode('barber');
    }
  }, [activeShopSlug]);

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
          if (Array.isArray(parsed) && parsed.length > 0) {
            return stripDemoMadridClients(parsed, slug);
          }
        }

        // Demo / Tienda 1: CM Salón D' Campodónico · Uñas, Manicura & Pedicura
        if (slug === 'campodonico-nails' || slug === 'campodonico-unas') {
          safeSetItem(keys.CLIENTS, INITIAL_NAILS_CLIENTS);
          return INITIAL_NAILS_CLIENTS;
        }

        // Demo / Tienda 2: Peluquería & Estética Femenina Normal (Sin Uñas)
        if (slug === 'peluqueria-estetica' || slug === 'salon-estetica') {
          safeSetItem(keys.CLIENTS, INITIAL_SALON_ESTETICA_CLIENTS);
          return INITIAL_SALON_ESTETICA_CLIENTS;
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
      if (slug === 'campodonico-nails' || slug === 'campodonico-unas') {
        return INITIAL_NAILS_CLIENTS;
      }
      if (slug === 'peluqueria-estetica' || slug === 'salon-estetica') {
        return INITIAL_SALON_ESTETICA_CLIENTS;
      }
      return slug === DEFAULT_SHOP_SLUG ? INITIAL_BARBER_CLIENTS : [];
    },
    [stripDemoMadridClients, isPublicRoute]
  );

  const [clients, setClients] = useState(() => loadTenantClients(activeShopSlug, isPublicRoute));

  // --- 1. ESTADO DE COLA VIVA (WALK-IN QUEUE) AISLADO POR TIENDA ---
  const loadTenantQueue = useCallback((slug, forPublic = isPublicRoute) => {
    if (forPublic) {
      return [];
    }
    const keys = getShopStorageKeys(slug);
    try {
      const savedTenantQueue = safeGetItem(keys.QUEUE, null);
      if (Array.isArray(savedTenantQueue)) return savedTenantQueue;
      if (slug === 'campodonico-nails' || slug === 'campodonico-unas') {
        return [
          {
            id: 'wq-nails-1',
            name: 'Laura Betancor',
            phone: '+34 638 877 945',
            service: 'Relleno acrílico (35€)',
            waitMinutes: 15,
            barber: 'Especialista Nails (D’ Campodónico)',
            status: 'waiting',
            timeIn: '17:30'
          },
          {
            id: 'wq-nails-2',
            name: 'Marta Cabrera',
            phone: '+34 628 112 233',
            service: 'Manicura semipermanente con refuerzo (25€)',
            waitMinutes: 25,
            barber: 'Especialista Nails (D’ Campodónico)',
            status: 'waiting',
            timeIn: '17:45'
          }
        ];
      }
      if (slug === 'peluqueria-estetica' || slug === 'salon-estetica') {
        return [
          {
            id: 'wq-pe-1',
            name: 'Claudia Perdomo',
            phone: '+34 638 877 945',
            service: 'Corte y Peinado / Brushing (32€)',
            waitMinutes: 15,
            barber: 'Sofía (Corte, Brushing & Keratina)',
            status: 'waiting',
            timeIn: '17:20'
          },
          {
            id: 'wq-pe-2',
            name: 'Irene Morales',
            phone: '+34 655 334 411',
            service: 'Diseño de Cejas & Lifting de Pestañas (30€)',
            waitMinutes: 20,
            barber: 'Valeria (Cabina Facial & Corporal)',
            status: 'waiting',
            timeIn: '17:35'
          }
        ];
      }
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
