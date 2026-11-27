import {
  getShopConfig,
  setShopConfig,
  getShopAppointments,
  setShopAppointments,
  getShopQueue,
  setShopQueue,
  getShopClients,
  setShopClients,
  getShopSales,
  setShopSales,
  hashClientIp,
  getRateLimitState,
  setRateLimitState,
  clearRateLimitState,
  appendAuditLog,
  normalizePhone,
  withShopLock
} from './lib/blobsClient.js';

const PIN_MAX_FAILED_ATTEMPTS = 5;
const PIN_LOCKOUT_SECONDS = 900; // 15 minutes
const PIN_LOCKOUT_MS = PIN_LOCKOUT_SECONDS * 1000;

export const config = {
  path: "/api/shops/:shopSlug/sync"
};

// Normalizes Spanish 9-digit phones with '34' country code prefix for WhatsApp wa.me links
export function formatWhatsAppNumber(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits || digits.length < 9) return null;
  if (digits.length === 9) {
    return `34${digits}`;
  }
  return digits;
}

export default async function handler(request, context) {
  const url = new URL(request.url);
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-shop-pin'
      }
    });
  }

  let shopSlug = context?.params?.shopSlug;
  if (!shopSlug) {
    const match = url.pathname.match(/\/api\/shops\/([^/]+)/);
    shopSlug = match ? match[1] : (url.searchParams.get('shop') || url.searchParams.get('shopSlug'));
  }

  if (!shopSlug) {
    return new Response(JSON.stringify({ success: false, error: 'missing_shop_slug' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const shop = await getShopConfig(shopSlug);
  if (!shop) {
    return new Response(JSON.stringify({ success: false, error: 'shop_not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // --- PIN AUTHENTICATION WITH ANTI BRUTE-FORCE RATE LIMITING (5 fails -> 15 min block) ---
  const ipHash = hashClientIp(request);
  const providedPin = request.headers.get('x-shop-pin') || url.searchParams.get('pin');

  const authFailureResponse = await withShopLock(`ratelimit:${shopSlug}:${ipHash}`, async () => {
    const authNow = Date.now();
    const rateLimitState = await getRateLimitState(shopSlug, ipHash);

    if (rateLimitState?.blockedUntil && rateLimitState.blockedUntil > authNow) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateLimitState.blockedUntil - authNow) / 1000));
      return new Response(JSON.stringify({
        success: false,
        error: 'too_many_attempts',
        message: 'Demasiados intentos fallidos. Espera 15 minutos antes de volver a intentarlo.',
        retryAfterSeconds
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Retry-After': String(retryAfterSeconds)
        }
      });
    }

    if (!providedPin || String(providedPin) !== String(shop.pin)) {
      const isExpiredLockout = Boolean(rateLimitState?.blockedUntil && rateLimitState.blockedUntil <= authNow);
      const prevAttempts =
        rateLimitState && !isExpiredLockout
          ? Number(rateLimitState.attempts) || 0
          : 0;
      const nextAttempts = prevAttempts + 1;

      if (nextAttempts >= PIN_MAX_FAILED_ATTEMPTS) {
        const blockedUntil = authNow + PIN_LOCKOUT_MS;
        await setRateLimitState(shopSlug, ipHash, {
          attempts: nextAttempts,
          blockedUntil,
          updatedAt: authNow
        });
        await appendAuditLog(shopSlug, 'pin_lockout', {
          ipHash,
          attempts: nextAttempts,
          lockDurationSeconds: PIN_LOCKOUT_SECONDS
        });
        return new Response(JSON.stringify({
          success: false,
          error: 'too_many_attempts',
          message: 'Demasiados intentos fallidos. Espera 15 minutos antes de volver a intentarlo.',
          retryAfterSeconds: PIN_LOCKOUT_SECONDS
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Retry-After': String(PIN_LOCKOUT_SECONDS)
          }
        });
      }

      await setRateLimitState(shopSlug, ipHash, {
        attempts: nextAttempts,
        blockedUntil: null,
        updatedAt: authNow
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'unauthorized',
        message: 'PIN incorrecto o no suministrado.',
        remainingAttempts: Math.max(0, PIN_MAX_FAILED_ATTEMPTS - nextAttempts)
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Valid PIN: reset brute-force counter immediately
    if (rateLimitState && (rateLimitState.attempts > 0 || rateLimitState.blockedUntil)) {
      await clearRateLimitState(shopSlug, ipHash);
    }
    return null;
  });

  if (authFailureResponse) {
    return authFailureResponse;
  }

  const { pin: _omittedPin, ...safeShopConfig } = shop;

  // --- ROUTE 1: GET /api/shops/:shopSlug/sync ---
  if (method === 'GET') {
    let appointments = await getShopAppointments(shopSlug);
    const queue = await getShopQueue(shopSlug);
    const clients = await getShopClients(shopSlug);
    const dailySales = await getShopSales(shopSlug);
    const now = Date.now();

    // Auto-expire pending holds older than 10 mins
    let hasExpiredChanges = false;
    appointments = appointments.map(a => {
      if (a.status === 'pending' && a.holdExpiresAt && a.holdExpiresAt <= now) {
        hasExpiredChanges = true;
        return { ...a, status: 'expired' };
      }
      return a;
    });

    if (hasExpiredChanges) {
      await setShopAppointments(shopSlug, appointments);
    }

    // Connect phone matching data for barber glanceability
    const enrichedAppointments = appointments.map(apt => {
      const normPhone = normalizePhone(apt.clientPhone || apt.phone);
      const matchedClient = normPhone ? clients.find(c => normalizePhone(c.phone) === normPhone) : null;
      return {
        ...apt,
        matchedClientId: matchedClient ? matchedClient.id : null,
        hasExistingCard: Boolean(matchedClient),
        latestFormula: matchedClient?.treatments?.[0]?.formula || null
      };
    });

    return new Response(JSON.stringify({
      success: true,
      shopSlug,
      timestamp: now,
      config: safeShopConfig,
      appointments: enrichedAppointments,
      queue,
      clients,
      dailySales
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  }

  // --- ROUTE 2: POST /api/shops/:shopSlug/sync ---
  if (method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'invalid_json' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const { action, payload = {} } = body;

    return await withShopLock(shopSlug, async () => {
      const appointments = await getShopAppointments(shopSlug);
      const queue = await getShopQueue(shopSlug);
      const clients = await getShopClients(shopSlug);

      // 1-TOUCH ACTION: APPROVE APPOINTMENT
      if (action === 'approve') {
        const appointmentId = payload?.appointmentId || payload?.id;
        const targetIndex = appointments.findIndex(a => a.id === appointmentId);
        if (targetIndex === -1) {
          return new Response(JSON.stringify({ success: false, error: 'appointment_not_found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const target = appointments[targetIndex];
        target.status = 'confirmed';
        target.holdExpiresAt = null;
        target.confirmedAt = Date.now();

        // Automated Phone Matching & 3D Recetas Connection
        const normPhone = normalizePhone(target.clientPhone || target.phone);
        let matchedClient = normPhone ? clients.find(c => normalizePhone(c.phone) === normPhone) : null;

        if (!matchedClient) {
          // Create fresh 3D client profile automatically
          matchedClient = {
            id: `c-${Date.now()}`,
            name: target.clientName,
            phone: target.clientPhone || target.phone,
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
            indicativeStyle: target.indicativeStyle || 'Skin Fade',
            treatment: target.serviceName || (target.indicativeStyle ? `Corte ${target.indicativeStyle}` : 'Corte Inicial'),
            lastVisit: 'Alta QR',
            treatments: [
              {
                id: `t-${Date.now()}`,
                name: target.serviceName || (target.indicativeStyle ? `Estilo ${target.indicativeStyle}` : 'Corte Inicial'),
                date: target.date,
                timestamp: Date.now(),
                formula: `Estilo inicial: ${target.indicativeStyle || 'Skin Fade'} (Guardar peines tras corte)`,
                notes: target.notes || 'Alta automática desde reserva online QR'
              }
            ],
            reliabilityScore: 100,
            noShowCount: 0,
            bonos: []
          };
          clients.push(matchedClient);
          await setShopClients(shopSlug, clients);
        }

        target.matchedClientId = matchedClient.id;
        appointments[targetIndex] = target;
        await setShopAppointments(shopSlug, appointments);

        // WhatsApp Click-to-Chat confirmation link
        const clientRawPhone = target.rawPhone || target.clientPhone || target.phone || '';
        const waPhone = formatWhatsAppNumber(clientRawPhone);
        const targetTime = target.timeSlot || target.time;
        const waMsg = `¡Buenas ${target.clientName}! 💈 Tu cita en ${shop.name} ha sido CONFIRMADA para el ${target.date} a las ${targetTime} con ${target.barberName || target.barberId || 'tu barbero'}. ¡Te esperamos en ${shop.address}!`;
        const whatsappUrl = waPhone
          ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`
          : null;

        return new Response(JSON.stringify({
          success: true,
          action: 'approve',
          appointment: target,
          matchedClient,
          whatsappUrl
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 1-TOUCH ACTION: REJECT APPOINTMENT
      if (action === 'reject') {
        const appointmentId = payload?.appointmentId || payload?.id;
        const alternativeSlot = payload?.alternativeSlot;
        const targetIndex = appointments.findIndex(a => a.id === appointmentId);
        if (targetIndex === -1) {
          return new Response(JSON.stringify({ success: false, error: 'appointment_not_found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const target = appointments[targetIndex];
        target.status = 'rejected';
        target.holdExpiresAt = null;
        appointments[targetIndex] = target;
        await setShopAppointments(shopSlug, appointments);

        const clientRawPhone = target.rawPhone || target.clientPhone || target.phone || '';
        const waPhone = formatWhatsAppNumber(clientRawPhone);
        const altText = alternativeSlot ? ` ¿Te vendría bien moverla a las ${alternativeSlot}?` : ' Por favor, revisa otros horarios disponibles en la web.';
        const targetTime = target.timeSlot || target.time;
        const waMsg = `Buenas ${target.clientName}, no podemos atender tu cita para el ${target.date} a las ${targetTime}.${altText}`;
        const whatsappUrl = waPhone
          ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`
          : null;

        return new Response(JSON.stringify({
          success: true,
          action: 'reject',
          appointmentId,
          whatsappUrl
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 1-TOUCH ACTION: SEAT IN CHAIR
      if (action === 'seat') {
        const { queueId, chairId, appointmentId } = payload;
        let updatedQueue = queue;
        if (queueId) {
          updatedQueue = queue.filter(q => q.id !== queueId);
          await setShopQueue(shopSlug, updatedQueue);
        }
        if (appointmentId) {
          const aptIndex = appointments.findIndex(a => a.id === appointmentId);
          if (aptIndex !== -1) {
            appointments[aptIndex].status = 'seated';
            appointments[aptIndex].chairId = chairId;
            await setShopAppointments(shopSlug, appointments);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          action: 'seat',
          chairId,
          queueId,
          appointmentId
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 1-TOUCH ACTION: FINISH SERVICE
      if (action === 'finish') {
        const { chairId, clientId, formulaNotes } = payload;
        if (clientId && formulaNotes) {
          const clientIndex = clients.findIndex(c => String(c.id) === String(clientId));
          if (clientIndex !== -1) {
            const client = clients[clientIndex];
            client.treatments = [
              {
                id: `t-${Date.now()}`,
                name: 'Corte en Sillón',
                formula: formulaNotes,
                date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                timestamp: Date.now()
              },
              ...(client.treatments || [])
            ];
            client.completedVisits = (client.completedVisits || 0) + 1;
            clients[clientIndex] = client;
            await setShopClients(shopSlug, clients);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          action: 'finish',
          chairId
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 1-TOUCH ACTION: UPDATE APPOINTMENT DURATION MANUALLY (-15m / +15m)
      if (action === 'update_duration') {
        const appointmentId = payload?.appointmentId || payload?.id;
        const clamped = Math.max(15, Math.min(180, Number(payload?.durationMinutes) || 60));
        const idx = appointments.findIndex(a => a.id === appointmentId);
        if (idx !== -1) {
          appointments[idx].durationMinutes = clamped;
          appointments[idx].updatedAt = Date.now();
          await setShopAppointments(shopSlug, appointments);
        }
        return new Response(JSON.stringify({
          success: true,
          action: 'update_duration',
          appointmentId,
          durationMinutes: clamped
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 1-TOUCH ACTION: RESCHEDULE (DRAG, RESIZE OR EDIT ON VISUAL TIMELINE)
      if (action === 'reschedule') {
        const appointmentId = payload?.appointmentId || payload?.id;
        const idx = appointments.findIndex(a => a.id === appointmentId);
        if (idx !== -1) {
          if (payload?.timeSlot) {
            appointments[idx].timeSlot = payload.timeSlot;
            appointments[idx].time = payload.timeSlot;
          }
          if (payload?.date) {
            appointments[idx].date = payload.date;
          }
          if (payload?.durationMinutes) {
            appointments[idx].durationMinutes = Math.max(15, Math.min(240, Number(payload.durationMinutes)));
          }
          if (payload?.clientName !== undefined) {
            appointments[idx].clientName = payload.clientName;
          }
          if (payload?.clientPhone !== undefined) {
            appointments[idx].clientPhone = payload.clientPhone;
          }
          if (payload?.serviceId !== undefined) {
            appointments[idx].serviceId = payload.serviceId;
          }
          if (payload?.serviceName !== undefined) {
            appointments[idx].serviceName = payload.serviceName;
          }
          if (payload?.barberId !== undefined) {
            appointments[idx].barberId = payload.barberId;
          }
          if (payload?.barberName !== undefined) {
            appointments[idx].barberName = payload.barberName;
          }
          if (payload?.price !== undefined) {
            appointments[idx].price = payload.price;
          }
          if (payload?.isBlock !== undefined) {
            appointments[idx].isBlock = Boolean(payload.isBlock);
          }
          appointments[idx].updatedAt = Date.now();
          await setShopAppointments(shopSlug, appointments);
        }
        return new Response(JSON.stringify({
          success: true,
          action: 'reschedule',
          appointmentId,
          appointment: idx !== -1 ? appointments[idx] : null
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 1-TOUCH ACTION: ADD MANUAL APPOINTMENT OR TIME BLOCK FROM VISUAL TIMELINE
      if (action === 'add_appointment') {
        const defaultBarber = shop.barbers?.[0];
        const newApt = {
          ...payload,
          id: payload?.id || `apt-man-${Date.now()}`,
          shopSlug,
          type: 'appointment',
          barberId: payload?.barberId || defaultBarber?.id || 'any',
          barberName: payload?.barberName || defaultBarber?.name || 'Barbero',
          durationMinutes: Math.max(15, Math.min(240, Number(payload?.durationMinutes) || 60)),
          status: payload?.status || 'confirmed',
          createdAt: payload?.createdAt || Date.now()
        };
        const existingIdx = appointments.findIndex(a => a.id === newApt.id);
        if (existingIdx !== -1) {
          appointments[existingIdx] = newApt;
        } else {
          appointments.push(newApt);
        }
        await setShopAppointments(shopSlug, appointments);
        return new Response(JSON.stringify({
          success: true,
          action: 'add_appointment',
          appointment: newApt
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 1-TOUCH ACTION: DELETE APPOINTMENT OR TIME BLOCK
      if (action === 'delete_appointment') {
        const appointmentId = payload?.appointmentId || payload?.id;
        const updatedAppointments = appointments.filter(a => String(a.id) !== String(appointmentId));
        await setShopAppointments(shopSlug, updatedAppointments);
        return new Response(JSON.stringify({
          success: true,
          action: 'delete_appointment',
          appointmentId
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 1-TOUCH ACTION: ADD WALK-IN TO LIVE QUEUE
      if (action === 'add_walkin') {
        const item = {
          ...payload,
          id: payload?.id || `wq-${Date.now()}`,
          shopSlug,
          status: payload?.status || 'waiting',
          createdAt: payload?.createdAt || Date.now()
        };
        if (!queue.some(q => q.id === item.id)) {
          queue.push(item);
          await setShopQueue(shopSlug, queue);
        }
        return new Response(JSON.stringify({
          success: true,
          action: 'add_walkin',
          item
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 1-TOUCH ACTION: REMOVE WALK-IN FROM LIVE QUEUE
      if (action === 'remove_walkin') {
        const queueId = payload?.queueId || payload?.id;
        const updatedQueue = queue.filter(q => String(q.id) !== String(queueId));
        await setShopQueue(shopSlug, updatedQueue);
        return new Response(JSON.stringify({
          success: true,
          action: 'remove_walkin',
          queueId
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 1-TOUCH ACTION: UPSERT 3D CLIENT CARD
      if (action === 'upsert_client') {
        const clientObj = payload?.client || payload;
        if (!clientObj || !clientObj.id) {
          return new Response(JSON.stringify({ success: false, error: 'missing_client_id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        const idx = clients.findIndex(c => String(c.id) === String(clientObj.id));
        if (idx !== -1) {
          clients[idx] = { ...clients[idx], ...clientObj };
        } else {
          clients.unshift(clientObj);
        }
        await setShopClients(shopSlug, clients);
        await appendAuditLog(shopSlug, 'upsert_client', {
          clientId: String(clientObj.id),
          consentSigned: Boolean(clientObj.consent?.signed),
          revokedAt: clientObj.consent?.revokedAt || null
        });
        return new Response(JSON.stringify({
          success: true,
          action: 'upsert_client',
          client: clientObj
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 1-TOUCH ACTION: DELETE 3D CLIENT CARD
      if (action === 'delete_client') {
        const clientId = payload?.clientId || payload?.id;
        const updatedClients = clients.filter(c => String(c.id) !== String(clientId));
        await setShopClients(shopSlug, updatedClients);
        await appendAuditLog(shopSlug, 'delete_client', {
          clientId: String(clientId || '')
        });
        return new Response(JSON.stringify({
          success: true,
          action: 'delete_client',
          clientId
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 1-TOUCH ACTION: RECORD INTERNAL CASH SALE (Non-fiscal operational control)
      if (action === 'record_sale') {
        const saleObj = payload?.sale || payload;
        if (!saleObj || !saleObj.id) {
          return new Response(JSON.stringify({ success: false, error: 'missing_sale_id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        const sales = await getShopSales(shopSlug);
        const normalizedSale = {
          ...saleObj,
          id: String(saleObj.id),
          shopSlug,
          timestamp: Number(saleObj.timestamp) || Date.now()
        };
        const existingIdx = sales.findIndex(s => String(s.id) === normalizedSale.id);
        if (existingIdx !== -1) {
          sales[existingIdx] = { ...sales[existingIdx], ...normalizedSale };
        } else {
          sales.unshift(normalizedSale);
        }
        await setShopSales(shopSlug, sales);
        return new Response(JSON.stringify({
          success: true,
          action: 'record_sale',
          sale: normalizedSale
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 1-TOUCH ACTION: UPDATE SHOP SCHEDULE / HOURS BY DAY / SERVICES
      if (action === 'update_shop_schedule') {
        const updatedShop = {
          ...shop,
          ...(payload.schedule
            ? {
                schedule: {
                  ...(shop.schedule || {}),
                  ...payload.schedule,
                  hoursByDay: {
                    ...(shop.schedule?.hoursByDay || {}),
                    ...(payload.schedule?.hoursByDay || {})
                  }
                }
              }
            : {}),
          ...(Array.isArray(payload.services) ? { services: payload.services } : {}),
          ...(payload.walkInOpen !== undefined ? { walkInOpen: Boolean(payload.walkInOpen) } : {}),
          ...(typeof payload.themeId === 'string' && payload.themeId.trim() ? { themeId: payload.themeId.trim() } : {}),
          updatedAt: Date.now()
        };
        await setShopConfig(shopSlug, updatedShop);
        await appendAuditLog(shopSlug, 'update_shop_schedule', {
          walkInOpen: updatedShop.walkInOpen !== false,
          servicesCount: Array.isArray(updatedShop.services) ? updatedShop.services.length : 0
        });
        const { pin: _p, ...safeUpdated } = updatedShop;
        return new Response(JSON.stringify({
          success: true,
          action: 'update_shop_schedule',
          config: safeUpdated
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'unknown_action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    });
  }

  return new Response(JSON.stringify({ success: false, error: 'method_not_allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
