import {
  getShopConfig,
  getShopAppointments,
  setShopAppointments,
  getShopQueue,
  setShopQueue,
  normalizePhone,
  withShopLock
} from './lib/blobsClient.js';

export const config = {
  path: [
    "/api/shops/:shopSlug/public-state",
    "/api/shops/:shopSlug/booking"
  ]
};

// Helper to convert time format (string HH:MM or number hours) to minutes
function getScheduleMinutes(timeVal, defaultVal) {
  if (typeof timeVal === 'number') {
    return timeVal * 60;
  }
  if (typeof timeVal === 'string' && timeVal.includes(':')) {
    const [h, m] = timeVal.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
  }
  return defaultVal;
}

// Resolve local date & time in shop's timezone (Atlantic/Canary or Europe/Madrid)
function getShopLocalNow(shop = null, nowMs = Date.now()) {
  const dateObj = new Date(nowMs);
  const addressStr = String(shop?.address || '').toLowerCase();
  const isCanary =
    shop?.timezone === 'Atlantic/Canary' ||
    shop?.slug === 'joseh-barber' ||
    addressStr.includes('lanzarote') ||
    addressStr.includes('arrecife') ||
    addressStr.includes('canarias');
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
    for (const p of parts) map[p.type] = p.value;
    const h = Number(map.hour === '24' ? '0' : map.hour);
    const m = Number(map.minute);
    return {
      isoDate: `${map.year}-${map.month}-${map.day}`,
      totalMinutes: h * 60 + m,
      timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      timeZone
    };
  } catch {
    const isoDate = dateObj.toISOString().split('T')[0];
    const h = dateObj.getUTCHours();
    const m = dateObj.getUTCMinutes();
    return {
      isoDate,
      totalMinutes: h * 60 + m,
      timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      timeZone: 'UTC'
    };
  }
}

// Resolve effective duration of an appointment
function getAppointmentDuration(apt, shop) {
  if (apt?.durationMinutes && !isNaN(Number(apt.durationMinutes))) {
    return Math.max(15, Number(apt.durationMinutes));
  }
  if (apt?.serviceId && Array.isArray(shop?.services)) {
    const svc = shop.services.find(s => s.id === apt.serviceId || s.name === apt.serviceId);
    if (svc?.durationMinutes) return Math.max(15, Number(svc.durationMinutes));
  }
  return Number(shop?.schedule?.slotMinutes || shop?.schedule?.slotIntervalMinutes || 30);
}

// Checks whether an existing appointment applies to a specific barber
function appointmentMatchesBarber(apt, barberObj, allBarbers = []) {
  if (!apt) return false;
  // In a single-barber shop (e.g. joseh-barber), every appointment or block occupies the sole barber
  if (allBarbers.length <= 1) return true;
  if (apt.isBlock && (!apt.barberId || apt.barberId === 'any')) return true;
  const aptBarberId = String(apt.barberId || apt.barber || '').trim();
  const aptBarberName = String(apt.barberName || apt.barber || '').trim().toLowerCase();
  if (!aptBarberId || aptBarberId === 'any') return true;
  if (barberObj?.id && aptBarberId === String(barberObj.id)) return true;
  if (barberObj?.name && (aptBarberName === String(barberObj.name).toLowerCase() || aptBarberId.toLowerCase() === String(barberObj.name).toLowerCase())) {
    return true;
  }
  // If aptBarberId doesn't match any current barber ID in shop config (legacy migrated ID), treat as blocking first barber
  const matchesKnownBarber = allBarbers.some(
    b => String(b.id) === aptBarberId || String(b.name || '').toLowerCase() === aptBarberName
  );
  if (!matchesKnownBarber && allBarbers[0]?.id === barberObj?.id) {
    return true;
  }
  return false;
}

// Generates time slots between openTime and closeTime based on slotIntervalMinutes
function generateTimeSlots(openTime = '10:00', closeTime = '20:30', intervalMinutes = 30) {
  const slots = [];
  const openMins = getScheduleMinutes(openTime, 10 * 60);
  const endMinutes = getScheduleMinutes(closeTime, 20 * 60 + 30);
  const step = Number(intervalMinutes) || 30;
  let currentMinutes = openMins;

  while (currentMinutes + step <= endMinutes) {
    const h = String(Math.floor(currentMinutes / 60)).padStart(2, '0');
    const m = String(currentMinutes % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
    currentMinutes += step;
  }
  return slots;
}

export default async function handler(request, context) {
  const url = new URL(request.url);
  const method = request.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-shop-pin, x-admin-key'
      }
    });
  }

  // Extract shopSlug from context params, url pathname, or query string
  let shopSlug = context?.params?.shopSlug;
  if (!shopSlug) {
    const match = url.pathname.match(/\/api\/shops\/([^/]+)/);
    shopSlug = match ? match[1] : (url.searchParams.get('shop') || url.searchParams.get('shopSlug'));
  }

  if (!shopSlug) {
    return new Response(JSON.stringify({ success: false, error: 'missing_shop_slug', message: 'Identificador de barbería no especificado.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const shop = await getShopConfig(shopSlug);
  if (!shop) {
    return new Response(JSON.stringify({ success: false, error: 'shop_not_found', message: 'Esta barbería no existe.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (String(shop.status || '').toLowerCase() === 'paused') {
    return new Response(JSON.stringify({
      success: false,
      error: 'shop_inactive',
      paused: true,
      message: 'Esta barbería está temporalmente en pausa.',
      shop: {
        slug: shop.slug,
        name: shop.name,
        subtitle: shop.subtitle || '',
        address: shop.address,
        phone: shop.phone,
        status: 'paused'
      }
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // --- ROUTE 1: GET /api/shops/:shopSlug/public-state ---
  if (method === 'GET' && (url.pathname.includes('/public-state') || url.searchParams.get('action') === 'public-state')) {
    const now = Date.now();
    const localNow = getShopLocalNow(shop, now);
    const targetDate = url.searchParams.get('date') || localNow.isoDate;
    const requestedServiceId = url.searchParams.get('serviceId');
    const requestedDurationParam = Number(url.searchParams.get('durationMinutes'));

    const appointments = await getShopAppointments(shopSlug);
    const queue = await getShopQueue(shopSlug);

    // Active appointments for target date: confirmed, seated, or unexpired pending holds
    const dayAppointments = appointments.filter(a => {
      if (a.date !== targetDate) return false;
      if (a.status === 'confirmed' || a.status === 'seated') return true;
      if (a.status === 'pending' && a.holdExpiresAt && a.holdExpiresAt > now) return true;
      return false;
    });

    const targetDateParts = String(targetDate).split('-').map(Number);
    const isValidTargetDate = targetDateParts.length === 3 && !targetDateParts.some(isNaN);
    const targetDayOfWeek = isValidTargetDate
      ? new Date(Date.UTC(targetDateParts[0], targetDateParts[1] - 1, targetDateParts[2])).getUTCDay()
      : new Date().getDay();

    const openDays = shop.schedule?.workDays || shop.schedule?.daysOpen || [1, 2, 3, 4, 5, 6];
    const daySchedule = shop.schedule?.hoursByDay?.[targetDayOfWeek] || shop.schedule?.hoursByDay?.[String(targetDayOfWeek)] || {};
    const isDayOpen =
      !daySchedule.closed &&
      (openDays.includes(targetDayOfWeek) || (targetDayOfWeek === 0 && openDays.includes(7)));

    const dayOpenTime = daySchedule.openTime ?? shop.schedule?.openTime ?? shop.schedule?.startHour ?? '10:00';
    const dayCloseTime = daySchedule.closeTime ?? shop.schedule?.closeTime ?? shop.schedule?.endHour ?? '20:30';
    const closeMinutes = getScheduleMinutes(dayCloseTime, 20 * 60 + 30);
    const defaultStep = Number(shop.schedule?.slotMinutes || shop.schedule?.slotIntervalMinutes || 30);

    let effectiveReqDuration = defaultStep;
    if (!isNaN(requestedDurationParam) && requestedDurationParam >= 15) {
      effectiveReqDuration = requestedDurationParam;
    } else if (requestedServiceId && Array.isArray(shop.services)) {
      const matchedSvc = shop.services.find(s => s.id === requestedServiceId || s.name === requestedServiceId);
      if (matchedSvc?.durationMinutes) effectiveReqDuration = Number(matchedSvc.durationMinutes);
    }

    const timeSlots = isDayOpen
      ? generateTimeSlots(dayOpenTime, dayCloseTime, defaultStep)
      : [];

    const barbers = Array.isArray(shop.barbers) && shop.barbers.length > 0
      ? shop.barbers
      : [{ id: 'b1', name: 'Barbero' }];

    const availability = timeSlots.map(time => {
      const slotStart = getScheduleMinutes(time, 0);
      const slotEnd = slotStart + effectiveReqDuration;
      const fitsBeforeClose = slotEnd <= closeMinutes;
      const isPast = targetDate === localNow.isoDate && slotStart <= localNow.totalMinutes;

      const barberAvailability = barbers.map(b => {
        if (!fitsBeforeClose) {
          return { barberId: b.id, available: false };
        }
        const isBooked = dayAppointments.some(a => {
          if (!appointmentMatchesBarber(a, b, barbers)) return false;
          const aptTime = a.timeSlot || a.time;
          const aptStart = getScheduleMinutes(aptTime, -1);
          if (aptStart < 0) return false;
          const aptEnd = aptStart + getAppointmentDuration(a, shop);
          return slotStart < aptEnd && slotEnd > aptStart;
        });
        return { barberId: b.id, available: !isBooked };
      });
      const anyAvailable = fitsBeforeClose && barberAvailability.some(b => b.available);
      return {
        time,
        available: anyAvailable,
        isPast,
        barbers: barberAvailability
      };
    });

    // Anonymized busy intervals for instant client-side service duration recalculation (ZERO PII)
    const busyIntervals = dayAppointments.map(a => ({
      start: a.timeSlot || a.time,
      durationMinutes: getAppointmentDuration(a, shop),
      barberId: barbers.length <= 1 ? (barbers[0]?.id || 'any') : (a.barberId || 'any'),
      isBlock: Boolean(a.isBlock)
    }));

    // GDPR Boundary: Strict anonymization. Zero names, phone numbers, or recipes exposed
    const activeWaitingQueue = queue.filter(q => q.status === 'waiting');
    const anonymizedQueue = {
      count: activeWaitingQueue.length,
      waitMinutes: activeWaitingQueue.reduce((acc, q) => acc + (Number(q.waitMinutes) || 20), 0),
      entries: activeWaitingQueue.map((_q, idx) => ({
        position: idx + 1,
        waitMinutes: (idx + 1) * 20
      }))
    };

    const publicState = {
      success: true,
      shop: {
        slug: shop.slug,
        name: shop.name,
        subtitle: shop.subtitle || '',
        address: shop.address,
        phone: shop.phone,
        logo: shop.logo,
        status: shop.status || 'active',
        walkInOpen: shop.walkInOpen !== false,
        description: shop.description || '',
        instagramBarber: shop.instagramBarber || '',
        instagramSalon: shop.instagramSalon || '',
        googleReviewUrl: shop.googleReviewUrl || '',
        barbers: shop.barbers,
        services: shop.services,
        schedule: shop.schedule
      },
      date: targetDate,
      closedOnDate: !isDayOpen,
      availability,
      busyIntervals,
      queue: anonymizedQueue
    };

    return new Response(JSON.stringify(publicState), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  }

  // --- ROUTE 2: POST /api/shops/:shopSlug/booking ---
  if (method === 'POST' && (url.pathname.includes('/booking') || url.searchParams.get('action') === 'booking')) {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'invalid_json', message: 'Cuerpo de solicitud inválido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const { type, clientName, clientPhone, indicativeStyle } = body;
    if (!clientName || !clientPhone) {
      return new Response(JSON.stringify({ success: false, error: 'validation_error', message: 'Nombre y teléfono son obligatorios.' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (body.rgpdConsent?.acceptedPrivacy !== true) {
      return new Response(JSON.stringify({
        success: false,
        error: 'rgpd_consent_required',
        message: 'Debes aceptar la política de privacidad para reservar.'
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const rgpdConsentRecord = {
      acceptedPrivacy: true,
      acceptedWhatsapp: Boolean(body.rgpdConsent?.acceptedWhatsapp),
      acceptedAt: typeof body.rgpdConsent?.acceptedAt === 'string' && body.rgpdConsent.acceptedAt
        ? body.rgpdConsent.acceptedAt
        : new Date().toISOString(),
      policyVersion: String(body.rgpdConsent?.policyVersion || '2026.1')
    };

    const normalizedClientPhone = normalizePhone(clientPhone);

    // MODE 1: APPOINTMENT (Día y Hora)
    if (type === 'appointment') {
      const { barberId, serviceId, date, timeSlot, time, notes } = body;
      const slotTime = timeSlot || time;
      if (!date || !slotTime) {
        return new Response(JSON.stringify({ success: false, error: 'missing_time_slot', message: 'Fecha y hora requeridas.' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Schedule & Work Days Validation
      const openDays = shop.schedule?.workDays || shop.schedule?.daysOpen || [1, 2, 3, 4, 5, 6];
      const dateParts = String(date).split('-').map(Number);
      if (dateParts.length !== 3 || dateParts.some(isNaN)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'shop_closed_on_date',
          message: 'Fecha inválida.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      const dateObj = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
      if (isNaN(dateObj.getTime())) {
        return new Response(JSON.stringify({
          success: false,
          error: 'shop_closed_on_date',
          message: 'Fecha inválida.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      const dayOfWeek = dateObj.getUTCDay(); // 0 is Sunday, 1..6 is Mon..Sat
      const dayHrs = shop.schedule?.hoursByDay?.[dayOfWeek] || shop.schedule?.hoursByDay?.[String(dayOfWeek)] || {};
      const isOpen = !dayHrs.closed && (openDays.includes(dayOfWeek) || (dayOfWeek === 0 && openDays.includes(7)));
      if (!isOpen) {
        return new Response(JSON.stringify({
          success: false,
          error: 'shop_closed_on_date',
          message: 'La barbería permanece cerrada este día.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Operating Hours & Service Duration Validation
      const [sh, sm] = String(slotTime).split(':').map(Number);
      if (isNaN(sh) || isNaN(sm)) {
        return new Response(JSON.stringify({ success: false, error: 'outside_business_hours', message: 'Formato de hora inválido.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const matchedService = Array.isArray(shop.services)
        ? shop.services.find(s => s.id === serviceId || s.name === serviceId)
        : null;
      const durationMinutes = Math.max(
        15,
        Math.min(
          240,
          Number(body.durationMinutes) ||
            Number(matchedService?.durationMinutes) ||
            Number(shop.schedule?.slotMinutes || shop.schedule?.slotIntervalMinutes || 30)
        )
      );

      const slotMinutes = sh * 60 + sm;
      const openMinutes = getScheduleMinutes(dayHrs.openTime ?? shop.schedule?.openTime ?? shop.schedule?.startHour, 10 * 60);
      const closeMinutes = getScheduleMinutes(dayHrs.closeTime ?? shop.schedule?.closeTime ?? shop.schedule?.endHour, 20 * 60 + 30);

      if (slotMinutes < openMinutes || slotMinutes >= closeMinutes || (slotMinutes + durationMinutes) > closeMinutes) {
        return new Response(JSON.stringify({
          success: false,
          error: 'outside_business_hours',
          message: (slotMinutes + durationMinutes) > closeMinutes && slotMinutes < closeMinutes
            ? `El servicio seleccionado (${durationMinutes} min) supera la hora de cierre (${dayHrs.closeTime || shop.schedule?.closeTime || '20:30'}).`
            : 'Horario fuera del horario comercial.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Atomic lock per shop to prevent race conditions & double-booking
      return await withShopLock(shopSlug, async () => {
        const appointments = await getShopAppointments(shopSlug);
        const now = Date.now();
        const barbers = Array.isArray(shop.barbers) && shop.barbers.length > 0
          ? shop.barbers
          : [{ id: 'b1', name: 'Barbero' }];

        const reqStart = slotMinutes;
        const reqEnd = slotMinutes + durationMinutes;

        // Active appointments for target date
        const activeDayApts = appointments.filter(a => {
          if (a.date !== date) return false;
          if (a.status === 'confirmed' || a.status === 'seated') return true;
          if (a.status === 'pending' && a.holdExpiresAt && a.holdExpiresAt > now) return true;
          return false;
        });

        const overlapsApt = (a) => {
          const aptTime = a.timeSlot || a.time;
          const aptStart = getScheduleMinutes(aptTime, -1);
          if (aptStart < 0) return false;
          const aptEnd = aptStart + getAppointmentDuration(a, shop);
          return reqStart < aptEnd && reqEnd > aptStart;
        };

        let collision = false;
        let assignedBarber = null;

        if (barbers.length <= 1) {
          // Single-barber shop: any active overlapping appointment or block collides
          collision = activeDayApts.some(a => overlapsApt(a));
          assignedBarber = barbers[0];
        } else if (barberId && barberId !== 'any') {
          const targetBarber = barbers.find(b => b.id === barberId || b.name === barberId) || { id: barberId, name: barberId };
          assignedBarber = targetBarber;
          collision = activeDayApts.some(a => overlapsApt(a) && appointmentMatchesBarber(a, targetBarber, barbers));
        } else {
          // Multi-barber shop with barberId === 'any': find first free barber in that interval
          const globalCollision = activeDayApts.some(a => overlapsApt(a) && (!a.barberId || a.barberId === 'any'));
          if (globalCollision) {
            collision = true;
          } else {
            const freeBarber = barbers.find(b => !activeDayApts.some(a => overlapsApt(a) && appointmentMatchesBarber(a, b, barbers)));
            if (!freeBarber) {
              collision = true;
            } else {
              assignedBarber = freeBarber;
            }
          }
        }

        if (collision) {
          return new Response(JSON.stringify({
            success: false,
            error: 'slot_unavailable',
            message: 'El hueco seleccionado ya no está disponible o se solapa con otra cita.'
          }), {
            status: 409,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const holdDurationMs = 10 * 60 * 1000; // 10 minutes
        const resolvedBarberId = (barberId && barberId !== 'any')
          ? barberId
          : (barbers.length === 1 ? barbers[0].id : 'any');
        const resolvedBarberName = body.barberName || assignedBarber?.name || (resolvedBarberId === 'any' ? 'Cualquier Barbero' : resolvedBarberId);

        const newAppointment = {
          id: `apt-${now}-${Math.random().toString(36).slice(2, 7)}`,
          shopSlug,
          type: 'appointment',
          clientName: String(clientName).trim(),
          clientPhone: normalizedClientPhone,
          rawPhone: clientPhone,
          barberId: resolvedBarberId,
          barberName: resolvedBarberName,
          serviceId: matchedService?.id || serviceId || 'skin-fade',
          serviceName: body.serviceName || matchedService?.name || serviceId || 'Skin Fade',
          durationMinutes,
          price: body.price ?? matchedService?.price ?? 20,
          priceLabel: matchedService?.priceLabel || (matchedService?.price !== undefined ? `${matchedService.price}€` : ''),
          date,
          timeSlot: slotTime,
          time: slotTime,
          indicativeStyle: indicativeStyle || '',
          notes: notes || '',
          rgpdConsent: rgpdConsentRecord,
          status: 'pending',
          createdAt: now,
          holdExpiresAt: now + holdDurationMs
        };

        appointments.push(newAppointment);
        await setShopAppointments(shopSlug, appointments);

        return new Response(JSON.stringify({
          success: true,
          bookingId: newAppointment.id,
          status: 'pending',
          holdExpiresAt: newAppointment.holdExpiresAt,
          appointment: newAppointment,
          message: 'Solicitud enviada con éxito. El barbero revisará tu reserva en unos instantes.'
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      });
    }

    // MODE 2: LIVE QUEUE (Turno Rápido Hoy)
    if (type === 'walkin') {
      const { barberId, serviceId } = body;
      return await withShopLock(shopSlug, async () => {
        const queue = await getShopQueue(shopSlug);
        const now = Date.now();
        const localNow = getShopLocalNow(shop, now);
        const waitingCount = queue.filter(q => q.status === 'waiting').length;
        const position = waitingCount + 1;
        const waitMinutes = position * 20;

        const newQueueItem = {
          id: `wq-${now}-${Math.random().toString(36).slice(2, 7)}`,
          shopSlug,
          type: 'walkin',
          name: String(clientName).trim(),
          phone: normalizedClientPhone,
          rawPhone: clientPhone,
          barber: barberId || (shop.barbers?.length === 1 ? shop.barbers[0].name : 'Cualquiera'),
          service: serviceId || (shop.services?.[0]?.name || 'Skin Fade Express'),
          indicativeStyle: indicativeStyle || '',
          rgpdConsent: rgpdConsentRecord,
          position,
          waitMinutes,
          status: 'waiting',
          timeIn: localNow.timeStr,
          createdAt: now
        };

        queue.push(newQueueItem);
        await setShopQueue(shopSlug, queue);

        return new Response(JSON.stringify({
          success: true,
          bookingId: newQueueItem.id,
          status: 'waiting',
          position,
          waitMinutes,
          message: `¡Te has apuntado a la cola! Eres el número #${position} en turno (~${waitMinutes} min).`
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'invalid_type', message: 'Tipo de reserva debe ser "appointment" o "walkin".' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  return new Response(JSON.stringify({ success: false, error: 'not_found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
