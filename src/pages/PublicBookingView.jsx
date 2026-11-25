import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Scissors,
  Calendar,
  Clock,
  Users,
  MapPin,
  Phone,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Lock,
  MessageSquare,
  User,
  Smartphone,
  ArrowRight,
  ShieldCheck,
  CalendarPlus,
  Bookmark,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import {
  buildCustomerPortalUrl,
  buildEmergencyPhoneLink,
  buildWhatsAppUrl,
  clearPublicClientProfile,
  downloadAppointmentIcs,
  loadSavedPublicClientProfile,
  normalizeShopSlug,
  savePublicClientProfile,
  getShopLocalDateTime,
  getShopVertical,
  isFemaleVertical,
} from '../lib/shopUtils';
import { BarberPinLockModal } from '../components/QRPosterModal';
import LegalComplianceModal from '../components/LegalComplianceModal';
import { soundFx } from '../lib/soundFx';

const STYLE_PILLS = [
  'Lo mismo de siempre',
  'Skin Fade #000',
  'Low Taper Fade',
  'Mullet / Crop Urbano',
  'Corte Clásico + Barba',
];

const NAILS_STYLE_PILLS = [
  'Lo mismo de siempre',
  'Almendra Natural / Nude',
  'Francesa / Baby Boomer',
  'Acrílicas Talla S/M',
  'Color Liso + Brillo Glazed',
  'Pedicura Spa Relajante',
];

const SALON_ESTETICA_STYLE_PILLS = [
  'Lo mismo de siempre',
  'Retoque de Raíz / Canas',
  'Balayage / Iluminación Suave',
  'Hidratación / Brillo Espejo',
  'Piel Luminosa / Efecto Lifting',
  'Cejas & Pestañas Naturales',
];

const SERVICE_CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'corte', label: '✂️ Cortes' },
  { id: 'barba', label: '🪒 Barba & Cejas' },
  { id: 'color', label: '🎨 Color & Facial' },
];

const NAILS_SERVICE_CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'acrilicas', label: '💅 Acrílicas' },
  { id: 'manicura', label: '✨ Manicura' },
  { id: 'pedicura', label: '🦶 Pedicura & Spa' },
  { id: 'facial', label: '🌸 Facial & Retiros' },
];

const SALON_ESTETICA_SERVICE_CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'peluqueria', label: '💇‍♀️ Peluquería & Color' },
  { id: 'facial', label: '💆‍♀️ Estética Facial' },
  { id: 'corporal', label: '🌿 Corporal & Mirada' },
];

function classifyServiceCategory(service, vertical = 'barber') {
  const cat = String(service?.category || '').toLowerCase();
  const name = String(service?.name || '').toLowerCase();

  if (vertical === 'nails') {
    if (cat === 'acrilicas' || name.includes('acrilic') || name.includes('acrílic')) return 'acrilicas';
    if (cat === 'manicura' || name.includes('manicura')) return 'manicura';
    if (cat === 'pedicura' || name.includes('pedicura')) return 'pedicura';
    return 'facial';
  }

  if (vertical === 'peluqueria') {
    if (
      cat === 'peluqueria' ||
      name.includes('corte') ||
      name.includes('brushing') ||
      name.includes('color') ||
      name.includes('tinte') ||
      name.includes('balayage') ||
      name.includes('keratina') ||
      name.includes('botox')
    ) {
      return 'peluqueria';
    }
    if (
      cat === 'facial' ||
      name.includes('facial') ||
      name.includes('radiofrecuencia') ||
      name.includes('peeling')
    ) {
      return 'facial';
    }
    return 'corporal';
  }

  if (
    name.includes('tinte') ||
    name.includes('mecha') ||
    name.includes('color') ||
    name.includes('mascarilla') ||
    name.includes('facial')
  ) {
    return 'color';
  }
  if (
    !name.includes('corte') &&
    (name.includes('barba') ||
      name.includes('ceja') ||
      name.includes('perfilado') ||
      name.includes('lavado'))
  ) {
    return 'barba';
  }
  return 'corte';
}

function parseTimeToMins(val, fallbackMins = 600) {
  if (typeof val === 'number') return val * 60;
  if (typeof val === 'string' && val.includes(':')) {
    const [hh, mm] = val.split(':').map(Number);
    if (!isNaN(hh) && !isNaN(mm)) return hh * 60 + mm;
  }
  return fallbackMins;
}

function getDayBoundsMinutes(schedule = {}, selectedDate = null) {
  let dayHours = null;
  if (selectedDate && schedule?.hoursByDay) {
    const parts = String(selectedDate).split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const dow = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
      dayHours = schedule.hoursByDay[dow] || schedule.hoursByDay[String(dow)] || null;
    }
  }
  const openMins = parseTimeToMins(
    dayHours?.openTime ?? schedule.openTime ?? schedule.startHour,
    10 * 60
  );
  const closeMins = parseTimeToMins(
    dayHours?.closeTime ?? schedule.closeTime ?? schedule.endHour,
    20 * 60
  );
  const step = Number(schedule.slotMinutes || schedule.slotIntervalMinutes || 30);
  return { openMins, closeMins, step, closed: Boolean(dayHours?.closed) };
}

function getUpcomingWorkingDates(workDays = [1, 2, 3, 4, 5, 6], count = 6, shop = null) {
  const result = [];
  const localNow = getShopLocalDateTime(shop, new Date());
  const [baseY, baseM, baseD] = localNow.isoDate.split('-').map(Number);
  const cursor = new Date(baseY, baseM - 1, baseD, 12, 0, 0);
  let safety = 0;

  while (result.length < count && safety < 21) {
    const dayOfWeek = cursor.getDay();
    if (workDays.includes(dayOfWeek) || (dayOfWeek === 0 && workDays.includes(7))) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${d}`;
      const isToday = safety === 0;
      const isTomorrow = safety === 1;
      const labelDay = isToday
        ? 'Hoy'
        : isTomorrow
        ? 'Mañana'
        : cursor.toLocaleDateString('es-ES', { weekday: 'short' });
      const labelNum = cursor.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
      });
      result.push({ iso, labelDay, labelNum, isToday });
    }
    cursor.setDate(cursor.getDate() + 1);
    safety++;
  }
  return result;
}

function buildScheduleSlots(schedule = {}, selectedDate = null) {
  const slots = [];
  const { openMins, closeMins, step, closed } = getDayBoundsMinutes(
    schedule,
    selectedDate
  );
  if (closed) return slots;

  let mins = openMins;
  while (mins + step <= closeMins) {
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
    mins += step;
  }
  return slots;
}

export default function PublicBookingView() {
  const { shopSlug: routeSlug } = useParams();
  const navigate = useNavigate();
  const {
    activeShop,
    activeShopSlug,
    switchShop,
    isPaused: contextPaused,
    verifyAndUnlockShopPin,
  } = useShop();

  // Sincronizar tienda si la URL trae /r/:shopSlug
  useEffect(() => {
    if (routeSlug) {
      const clean = normalizeShopSlug(routeSlug);
      if (clean && clean !== activeShopSlug) {
        switchShop(clean);
      }
    }
  }, [routeSlug, activeShopSlug, switchShop]);

  const [publicShop, setPublicShop] = useState(null);
  const [remotePaused, setRemotePaused] = useState(false);
  const effectiveShop = publicShop || activeShop;
  const activeVertical = getShopVertical(effectiveShop, routeSlug || activeShopSlug);
  const isFemale = isFemaleVertical(activeVertical);
  const activeStylePills =
    activeVertical === 'nails'
      ? NAILS_STYLE_PILLS
      : activeVertical === 'peluqueria'
      ? SALON_ESTETICA_STYLE_PILLS
      : STYLE_PILLS;
  const activeServiceCategories =
    activeVertical === 'nails'
      ? NAILS_SERVICE_CATEGORIES
      : activeVertical === 'peluqueria'
      ? SALON_ESTETICA_SERVICE_CATEGORIES
      : SERVICE_CATEGORIES;
  const isPaused =
    remotePaused ||
    contextPaused ||
    String(effectiveShop?.status || '').toLowerCase() === 'paused';

  const shopName = effectiveShop?.name || 'KUTZ // BARBER OS';
  const shopAddress = effectiveShop?.address || 'Calle Mayor 14, Madrid';
  const shopPhone = effectiveShop?.phone || '+34 600 123 456';

  const barbers = useMemo(
    () =>
      Array.isArray(effectiveShop?.barbers) && effectiveShop.barbers.length > 0
        ? effectiveShop.barbers
        : [
            { id: 'rex', name: 'Rex', role: 'Master Barber' },
            { id: 'kiko', name: 'Kiko', role: 'Fade Specialist' },
            { id: 'nico', name: 'Nico', role: 'Barba & Tijera' },
          ],
    [effectiveShop]
  );

  const services = useMemo(
    () =>
      Array.isArray(effectiveShop?.services) && effectiveShop.services.length > 0
        ? effectiveShop.services
        : [
            { id: 'skin-fade', name: 'Skin Fade #000 + Navaja', durationMinutes: 30, price: 20 },
            { id: 'taper-fade', name: 'Low Taper + Ritual Toalla', durationMinutes: 30, price: 22 },
            { id: 'full-combo', name: 'Combo Completo (Corte + Barba)', durationMinutes: 45, price: 32 },
          ],
    [effectiveShop]
  );

  const upcomingDates = useMemo(
    () =>
      getUpcomingWorkingDates(
        effectiveShop?.schedule?.workDays || [1, 2, 3, 4, 5, 6],
        6,
        effectiveShop
      ),
    [effectiveShop]
  );

  const [bookingMode, setBookingMode] = useState('appointment'); // 'appointment' | 'walkin'
  const [serviceCategory, setServiceCategory] = useState('all');
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id || 's1');
  const [selectedBarberId, setSelectedBarberId] = useState(() =>
    barbers.length === 1 ? barbers[0].id : 'any'
  );
  const [selectedDate, setSelectedDate] = useState(
    () => upcomingDates[0]?.iso || getShopLocalDateTime(effectiveShop, new Date()).isoDate
  );

  useEffect(() => {
    if (barbers.length === 1) {
      setSelectedBarberId(barbers[0].id);
    }
  }, [barbers]);

  useEffect(() => {
    if (
      upcomingDates.length > 0 &&
      !upcomingDates.some((d) => d.iso === selectedDate)
    ) {
      setSelectedDate(upcomingDates[0].iso);
    }
  }, [upcomingDates, selectedDate]);

  const allSlots = useMemo(
    () => buildScheduleSlots(effectiveShop?.schedule || {}, selectedDate),
    [effectiveShop, selectedDate]
  );

  const selectedDayOfWeek = useMemo(() => {
    const parts = String(selectedDate || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return new Date().getDay();
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
  }, [selectedDate]);

  const isMonToThu = selectedDayOfWeek >= 1 && selectedDayOfWeek <= 4;
  const isFriOrSat = selectedDayOfWeek === 5 || selectedDayOfWeek === 6;

  const [selectedSlot, setSelectedSlot] = useState('11:00');
  const [selectedStyle, setSelectedStyle] = useState(STYLE_PILLS[0]);
  const [savedProfile, setSavedProfile] = useState(() => loadSavedPublicClientProfile(activeShopSlug));
  const [clientName, setClientName] = useState(() => savedProfile?.clientName || '');
  const [clientPhone, setClientPhone] = useState(() => savedProfile?.clientPhone || '');
  const [notes, setNotes] = useState('');
  // RGPD 1st-Layer Consent — BOTH UNCHECKED BY DEFAULT
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedWhatsapp, setAcceptedWhatsapp] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmationTicket, setConfirmationTicket] = useState(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [copiedPortalLink, setCopiedPortalLink] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);

  const portalUrl = useMemo(() => buildCustomerPortalUrl('', activeShopSlug), [activeShopSlug]);

  useEffect(() => {
    const profile = loadSavedPublicClientProfile(activeShopSlug);
    setSavedProfile(profile);
    if (profile?.clientName) setClientName(profile.clientName);
    if (profile?.clientPhone) setClientPhone(profile.clientPhone);
  }, [activeShopSlug]);

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const handleResetSavedProfile = () => {
    soundFx.playClick();
    clearPublicClientProfile(activeShopSlug);
    setSavedProfile(null);
    setClientName('');
    setClientPhone('');
  };

  const handleCopyPortalLink = async () => {
    soundFx.playClick();
    try {
      await navigator.clipboard?.writeText(portalUrl);
    } catch {
      // ignore
    }
    setCopiedPortalLink(true);
    setTimeout(() => setCopiedPortalLink(false), 2500);
  };

  const handleTriggerInstall = async () => {
    if (!installPromptEvent) return;
    soundFx.playClick();
    try {
      await installPromptEvent.prompt();
      setInstallPromptEvent(null);
    } catch {
      // ignore
    }
  };

  // Estado público real del servidor (Cero acceso a BD privada local)
  const [serverAvailability, setServerAvailability] = useState(null);
  const [serverBusyIntervals, setServerBusyIntervals] = useState([]);
  const [serverClosedOnDate, setServerClosedOnDate] = useState(false);
  const [sessionBookings, setSessionBookings] = useState([]);
  const [publicQueueCount, setPublicQueueCount] = useState(0);

  const selectedService =
    services.find((s) => s.id === selectedServiceId) || services[0];
  const selectedBarber =
    selectedBarberId === 'any'
      ? { id: 'any', name: barbers.length === 1 ? barbers[0].name : 'Cualquier Barbero' }
      : barbers.find((b) => b.id === selectedBarberId) || {
          id: barbers[0]?.id || 'any',
          name: barbers[0]?.name || 'Cualquier Barbero',
        };

  // Filtered services for easy mobile browsing without nested scroll traps
  const filteredServices = useMemo(() => {
    if (serviceCategory === 'all') return services;
    return services.filter((s) => classifyServiceCategory(s, activeVertical) === serviceCategory);
  }, [services, serviceCategory, activeVertical]);

  // Cargar disponibilidad pública real desde Netlify Blobs (/public-state)
  useEffect(() => {
    let cancelled = false;
    if (typeof fetch !== 'undefined' && activeShopSlug) {
      const dur = Number(selectedService?.durationMinutes) || 30;
      fetch(
        `/api/shops/${encodeURIComponent(
          activeShopSlug
        )}/public-state?date=${encodeURIComponent(
          selectedDate
        )}&durationMinutes=${encodeURIComponent(dur)}`
      )
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          return { ok: res.ok, status: res.status, data };
        })
        .then(({ ok, status, data }) => {
          if (cancelled) return;
          if (
            status === 403 ||
            status === 404 ||
            data?.paused === true ||
            data?.error === 'shop_inactive'
          ) {
            if (data?.error === 'shop_inactive' || data?.paused) {
              setRemotePaused(true);
              if (data?.shop) setPublicShop(data.shop);
            }
            return;
          }
          if (!ok || !data || !data.success) return;
          setRemotePaused(String(data.shop?.status || '').toLowerCase() === 'paused');
          if (data.shop) {
            setPublicShop(data.shop);
          }
          if (Array.isArray(data.availability)) {
            setServerAvailability(data.availability);
          }
          if (Array.isArray(data.busyIntervals)) {
            setServerBusyIntervals(data.busyIntervals);
          }
          setServerClosedOnDate(Boolean(data.closedOnDate));
          if (data.queue && typeof data.queue.count === 'number') {
            setPublicQueueCount(data.queue.count);
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [activeShopSlug, selectedDate, selectedService?.durationMinutes]);

  // Calcular disponibilidad real por intervalos [slotStart, slotStart + durationMinutes) y límite de cierre
  const slotsWithAvailability = useMemo(() => {
    if (serverClosedOnDate) return [];
    const workDays = effectiveShop?.schedule?.workDays || [1, 2, 3, 4, 5, 6];
    const isDayOpen =
      workDays.includes(selectedDayOfWeek) ||
      (selectedDayOfWeek === 0 && workDays.includes(7));
    if (!isDayOpen) return [];

    const { closeMins } = getDayBoundsMinutes(
      effectiveShop?.schedule || {},
      selectedDate
    );
    const reqDuration = Math.max(
      15,
      Number(selectedService?.durationMinutes) || 30
    );
    const localNow = getShopLocalDateTime(effectiveShop, new Date());
    const isToday = selectedDate === localNow.isoDate;

    const allBusy = [
      ...serverBusyIntervals,
      ...sessionBookings
        .filter((b) => b.date === selectedDate)
        .map((b) => ({
          start: b.timeSlot || b.time,
          durationMinutes: Number(b.durationMinutes) || 30,
          barberId: b.barberId || 'any',
          isBlock: false,
        })),
    ];

    return allSlots.map((time) => {
      const slotStart = parseTimeToMins(time, 0);
      const slotEnd = slotStart + reqDuration;

      // 1. Must finish at or before closing time
      if (slotEnd > closeMins) {
        return { time, available: false, reason: 'exceeds_close' };
      }

      // 2. If today, filter out hours that have already passed in shop's local timezone
      if (isToday && slotStart <= localNow.totalMinutes) {
        return { time, available: false, reason: 'past' };
      }

      // 3. Check interval overlap against busyIntervals
      const overlapsBusy = (interval, targetBarberId) => {
        const bStart = parseTimeToMins(interval.start, -1);
        if (bStart < 0) return false;
        const bEnd = bStart + Math.max(15, Number(interval.durationMinutes) || 30);
        if (!(slotStart < bEnd && slotEnd > bStart)) return false;

        if (barbers.length <= 1) return true;
        if (interval.isBlock && (!interval.barberId || interval.barberId === 'any')) {
          return true;
        }
        if (
          !targetBarberId ||
          targetBarberId === 'any' ||
          !interval.barberId ||
          interval.barberId === 'any'
        ) {
          return interval.barberId === targetBarberId || !interval.barberId || interval.barberId === 'any';
        }
        return String(interval.barberId) === String(targetBarberId);
      };

      let isOccupied = false;
      if (barbers.length <= 1) {
        isOccupied = allBusy.some((b) => overlapsBusy(b, barbers[0]?.id));
      } else if (selectedBarberId && selectedBarberId !== 'any') {
        isOccupied = allBusy.some((b) => overlapsBusy(b, selectedBarberId));
      } else {
        // Multi-barber 'any': occupied if global block or all barbers busy in this interval
        const hasGlobalBusy = allBusy.some(
          (b) => (!b.barberId || b.barberId === 'any') && overlapsBusy(b, 'any')
        );
        const allBarbersBusy = barbers.every((barberObj) =>
          allBusy.some((b) => overlapsBusy(b, barberObj.id))
        );
        isOccupied = hasGlobalBusy || allBarbersBusy;
      }

      // Cross-check with serverAvailability when busyIntervals was not present
      if (!isOccupied && Array.isArray(serverAvailability) && allBusy.length === 0) {
        const serverSlot = serverAvailability.find((s) => s.time === time);
        if (serverSlot) {
          if (selectedBarberId && selectedBarberId !== 'any' && Array.isArray(serverSlot.barbers)) {
            const bSlot = serverSlot.barbers.find((b) => b.barberId === selectedBarberId);
            if (bSlot && !bSlot.available) isOccupied = true;
          } else if (!serverSlot.available) {
            isOccupied = true;
          }
        }
      }

      return { time, available: !isOccupied };
    });
  }, [
    serverClosedOnDate,
    effectiveShop,
    selectedDayOfWeek,
    selectedDate,
    selectedService,
    serverBusyIntervals,
    sessionBookings,
    allSlots,
    barbers,
    selectedBarberId,
    serverAvailability,
  ]);

  const morningSlots = useMemo(
    () => slotsWithAvailability.filter((s) => parseTimeToMins(s.time) < 14 * 60),
    [slotsWithAvailability]
  );
  const afternoonSlots = useMemo(
    () => slotsWithAvailability.filter((s) => parseTimeToMins(s.time) >= 14 * 60),
    [slotsWithAvailability]
  );

  // Asegurar que el slot seleccionado esté libre
  useEffect(() => {
    const current = slotsWithAvailability.find((s) => s.time === selectedSlot);
    if (!current || !current.available) {
      const firstFree = slotsWithAvailability.find((s) => s.available);
      if (firstFree) setSelectedSlot(firstFree.time);
    }
  }, [slotsWithAvailability, selectedSlot]);

  // Enviar solicitud de cita (Modo 1: Día y Hora)
  const handleAppointmentSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (isPaused) {
      setFormError('Esta barbería está temporalmente en pausa y no admite reservas online.');
      return;
    }

    if (!clientName.trim() || !clientPhone.trim()) {
      setFormError('Por favor, escribe tu nombre y tu móvil de contacto.');
      return;
    }

    const cleanDigits = clientPhone.replace(/\D/g, '');
    if (cleanDigits.length < 9) {
      setFormError('Introduce un número de teléfono válido (mínimo 9 dígitos).');
      return;
    }

    if (!acceptedPrivacy) {
      setFormError('Debes aceptar la política de privacidad para reservar.');
      return;
    }

    const chosenSlotObj = slotsWithAvailability.find((s) => s.time === selectedSlot);
    if (!chosenSlotObj || !chosenSlotObj.available) {
      setFormError('La hora seleccionada no está disponible para la duración de este servicio. Elige otra hora libre.');
      return;
    }

    soundFx.playClick();
    soundFx.triggerHaptic(15);
    setSubmitting(true);

    const now = Date.now();
    const effectiveBarberId =
      barbers.length === 1 ? barbers[0].id : selectedBarberId;
    const effectiveBarberName =
      barbers.length === 1 ? barbers[0].name : selectedBarber.name;

    const newAppointment = {
      id: `apt-${now}-${Math.random().toString(36).slice(2, 6)}`,
      shopSlug: activeShopSlug,
      type: 'appointment',
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      barberId: effectiveBarberId,
      barberName: effectiveBarberName,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      price: selectedService.price,
      priceLabel: selectedService.priceLabel || `${selectedService.price}€`,
      durationMinutes: Number(selectedService.durationMinutes) || 30,
      date: selectedDate,
      timeSlot: selectedSlot,
      time: selectedSlot,
      indicativeStyle: selectedStyle,
      notes: notes.trim(),
      rgpdConsent: {
        acceptedPrivacy: true,
        acceptedWhatsapp: Boolean(acceptedWhatsapp),
        acceptedAt: new Date(now).toISOString(),
        policyVersion: '2026.1',
      },
      status: 'pending',
      createdAt: now,
    };

    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch(
          `/api/shops/${encodeURIComponent(activeShopSlug)}/booking`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAppointment),
          }
        ).catch(() => null);

        if (res && !res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 403 || errData?.paused || errData?.error === 'shop_inactive') {
            setRemotePaused(true);
          }
          setFormError(
            errData?.message ||
              (res.status === 409
                ? 'Ese hueco acaba de ser reservado o se solapa con otra cita. Por favor elige otra hora.'
                : 'No se pudo registrar la reserva en ese horario. Revisa la hora seleccionada.')
          );
          setSubmitting(false);
          return;
        }
      }

      const nextSaved = {
        clientName: newAppointment.clientName,
        clientPhone: newAppointment.clientPhone,
        lastServiceId: selectedService.id,
        lastServiceName: selectedService.name,
      };
      savePublicClientProfile(activeShopSlug, nextSaved);
      setSavedProfile(nextSaved);

      setSessionBookings((prev) => [...prev, newAppointment]);
      setConfirmationTicket({
        mode: 'appointment',
        id: newAppointment.id.slice(-6).toUpperCase(),
        clientName: newAppointment.clientName,
        clientPhone: newAppointment.clientPhone,
        serviceName: selectedService.name,
        durationMinutes: Number(selectedService.durationMinutes) || 30,
        price: selectedService.priceLabel || `${selectedService.price}€`,
        barberName: effectiveBarberName,
        date: selectedDate,
        timeSlot: selectedSlot,
        style: selectedStyle,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Enviar solicitud de turno rápido hoy (Modo 2: Cola en Vivo)
  const handleWalkInSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (isPaused) {
      setFormError('Esta barbería está temporalmente en pausa.');
      return;
    }

    if (!clientName.trim() || !clientPhone.trim()) {
      setFormError('Escribe tu nombre y tu móvil para avisarte cuando te toque.');
      return;
    }

    const cleanDigits = clientPhone.replace(/\D/g, '');
    if (cleanDigits.length < 9) {
      setFormError('Introduce un número de teléfono válido (mínimo 9 dígitos).');
      return;
    }

    if (!acceptedPrivacy) {
      setFormError('Debes aceptar la política de privacidad para reservar.');
      return;
    }

    soundFx.playClick();
    soundFx.triggerHaptic(15);
    setSubmitting(true);

    const now = Date.now();
    let nextPosition = publicQueueCount + 1;
    let waitMinutes = nextPosition * 15;
    const targetBarberName =
      barbers.length === 1
        ? barbers[0].name
        : selectedBarberId === 'any'
        ? 'Cualquiera'
        : selectedBarber.name;

    const newWalkIn = {
      id: `wq-${now}`,
      shopSlug: activeShopSlug,
      type: 'walkin',
      name: clientName.trim(),
      phone: clientPhone.trim(),
      service: `${selectedService.name} (${selectedService.priceLabel || `${selectedService.price}€`})`,
      barber: targetBarberName,
      indicativeStyle: selectedStyle,
      position: nextPosition,
      waitMinutes,
      status: 'waiting',
      createdAt: now,
    };

    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch(
          `/api/shops/${encodeURIComponent(activeShopSlug)}/booking`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'walkin',
              clientName: newWalkIn.name,
              clientPhone: newWalkIn.phone,
              barberId: newWalkIn.barber,
              serviceId: newWalkIn.service,
              indicativeStyle: newWalkIn.indicativeStyle,
              rgpdConsent: {
                acceptedPrivacy: true,
                acceptedWhatsapp: Boolean(acceptedWhatsapp),
                acceptedAt: new Date(now).toISOString(),
                policyVersion: '2026.1',
              },
            }),
          }
        ).catch(() => null);

        if (res && !res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 403 || errData?.paused || errData?.error === 'shop_inactive') {
            setRemotePaused(true);
          }
          setFormError(
            errData?.message || 'No se pudo apuntar a la cola en este momento.'
          );
          setSubmitting(false);
          return;
        }

        if (res && res.ok) {
          const resData = await res.json().catch(() => null);
          if (resData?.position) nextPosition = resData.position;
          if (resData?.waitMinutes) waitMinutes = resData.waitMinutes;
        }
      }

      const nextSavedWalkIn = {
        clientName: newWalkIn.name,
        clientPhone: newWalkIn.phone,
        lastServiceId: selectedService.id,
        lastServiceName: selectedService.name,
      };
      savePublicClientProfile(activeShopSlug, nextSavedWalkIn);
      setSavedProfile(nextSavedWalkIn);

      setPublicQueueCount(nextPosition);
      setConfirmationTicket({
        mode: 'walkin',
        id: newWalkIn.id.slice(-5).toUpperCase(),
        clientName: newWalkIn.name,
        serviceName: selectedService.name,
        barberName: newWalkIn.barber,
        position: nextPosition,
        waitMinutes,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderRgpdSection = () => (
    <div
      data-testid="rgpd-booking-section"
      className="p-4 rounded-xl bg-[#101318]/95 border border-[#252A36] space-y-3 text-left"
    >
      <div className="p-3 rounded-xl bg-[#0A0C0F] border border-[#252A36] text-[11px] text-[#D1D5DB] space-y-1 leading-relaxed">
        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#34D399] flex items-center gap-1.5">
          <ShieldCheck size={13} />
          <span>Información básica sobre Protección de Datos (1ª capa · Art. 13 RGPD)</span>
        </p>
        <p><strong className="text-white">Responsable:</strong> {shopName}</p>
        <p><strong className="text-white">Finalidad:</strong> Gestión de la cita y atención al cliente.</p>
        <p><strong className="text-white">Legitimación:</strong> Ejecución del servicio y consentimiento expreso.</p>
        <p><strong className="text-white">Destinatarios:</strong> No cesión a terceros salvo obligación legal; infraestructura cloud segura (Netlify, EU-US Data Privacy Framework).</p>
        <p>
          <strong className="text-white">Derechos:</strong> Acceso, Rectificación, Supresión, Portabilidad y Oposición ante el establecimiento.{' '}
          <button
            type="button"
            onClick={() => setIsLegalModalOpen(true)}
            className="text-[#34D399] underline hover:text-white font-bold cursor-pointer"
          >
            Ver Política de Privacidad y Aviso Legal
          </button>
        </p>
      </div>

      <div className="space-y-2.5">
        <label className="flex items-start gap-2.5 text-xs text-[#E5E7EB] cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedPrivacy}
            onChange={(e) => {
              setAcceptedPrivacy(e.target.checked);
              if (e.target.checked) setFormError('');
            }}
            className="mt-0.5 w-4 h-4 accent-[#10B981] shrink-0 cursor-pointer"
          />
          <span className="leading-snug">
            <strong className="text-[#34D399]">(Obligatorio)</strong> He leído la información básica de privacidad y acepto el tratamiento de mis datos para gestionar mi cita.
          </span>
        </label>

        <label className="flex items-start gap-2.5 text-xs text-[#9CA3AF] cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedWhatsapp}
            onChange={(e) => setAcceptedWhatsapp(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#10B981] shrink-0 cursor-pointer"
          />
          <span className="leading-snug">
            <strong className="text-[#D1D5DB]">(Opcional)</strong> Acepto recibir recordatorios de cita o avisos de hueco libre por WhatsApp.
          </span>
        </label>
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-screen min-h-[100dvh] bg-[#0A0C0F] text-[#F3F4F6] flex flex-col justify-between ${
        isFemale
          ? 'theme-rose-luxury selection:bg-[#EC4899] selection:text-white'
          : 'selection:bg-[#10B981] selection:text-[#07090C]'
      }`}
    >
      {/* Background Ambience con Foto Real Nítida (Barbería, Nail Bar o Salón de Peluquería & Estética) */}
      <div
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
        aria-hidden="true"
      >
        <img
          src={
            activeVertical === 'nails'
              ? 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=85&w=1920'
              : activeVertical === 'peluqueria'
              ? 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=85&w=1920'
              : 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=85&w=1920'
          }
          alt=""
          className="w-full h-full object-cover object-center opacity-65 filter saturate-105 contrast-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0C0F]/55 via-[#0A0C0F]/40 to-[#0A0C0F]/70" />
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-72 ${
            isFemale ? 'bg-[#EC4899]/18' : 'bg-[#10B981]/12'
          } blur-[100px] rounded-full`}
        />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md mx-auto p-4 sm:p-6 flex-1 flex flex-col justify-between">
        <div>
          {/* Shop Header */}
          <div className="text-center pt-3 pb-5 border-b border-[#252A36]">
            <div
              className={`w-14 h-14 mx-auto rounded-2xl ${
                isFemale
                  ? 'bg-[#EC4899] text-white shadow-[0_4px_20px_rgba(236,72,153,0.4)]'
                  : 'bg-[#10B981] text-[#07090C] shadow-[0_4px_20px_rgba(16,185,129,0.35)]'
              } flex items-center justify-center mb-3`}
            >
              {isFemale ? (
                <Sparkles size={28} strokeWidth={2.5} />
              ) : (
                <Scissors size={28} strokeWidth={2.5} />
              )}
            </div>
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${
                isFemale
                  ? 'bg-[#EC4899]/15 border border-[#EC4899]/35 text-[#F9A8D4]'
                  : 'bg-[#10B981]/15 border border-[#10B981]/30 text-[#34D399]'
              } text-[10px] font-bold uppercase mb-1.5`}
            >
              <Sparkles size={11} />
              <span>Reserva Directa QR · Cero Esperas</span>
            </div>
            <h1 className="text-2xl font-serif font-black tracking-tight text-white uppercase leading-none">
              {shopName}
            </h1>
            {effectiveShop?.subtitle && (
              <p
                className={`text-xs font-extrabold ${
                  isFemale ? 'text-[#F9A8D4]' : 'text-[#34D399]'
                } mt-1 tracking-wide`}
              >
                {activeVertical === 'nails'
                  ? '💅 '
                  : activeVertical === 'peluqueria'
                  ? '💇‍♀️ '
                  : '✂️ '}
                {effectiveShop.subtitle}
              </p>
            )}
            <p className="text-xs text-[#9CA3AF] mt-2 flex items-center justify-center gap-1.5">
              <MapPin
                size={13}
                className={`${isFemale ? 'text-[#EC4899]' : 'text-[#10B981]'} shrink-0`}
              />
              <span>{shopAddress}</span>
            </p>

            {effectiveShop?.description && (
              <p className="mt-3 p-3 rounded-xl bg-[#141820]/85 border border-[#252A36] text-[11px] text-[#E5E7EB] leading-relaxed">
                {effectiveShop.description}
              </p>
            )}

            {(effectiveShop?.phone ||
              effectiveShop?.instagramBarber ||
              effectiveShop?.instagramSalon) && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {effectiveShop?.phone && (
                  <a
                    href={buildEmergencyPhoneLink(effectiveShop.phone)}
                    className="px-3 py-2 min-h-[38px] rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[#34D399] text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Phone size={12} />
                    <span>{effectiveShop.phone}</span>
                  </a>
                )}
                {effectiveShop?.instagramBarber && (
                  <a
                    href={`https://www.instagram.com/${effectiveShop.instagramBarber}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 min-h-[38px] rounded-lg bg-[#141820] border border-[#252A36] hover:border-[#10B981]/60 text-white text-xs font-bold inline-flex items-center gap-1"
                  >
                    <span>📸 @{effectiveShop.instagramBarber}</span>
                  </a>
                )}
                {effectiveShop?.instagramSalon && (
                  <a
                    href={`https://www.instagram.com/${effectiveShop.instagramSalon}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 min-h-[38px] rounded-lg bg-[#141820] border border-[#252A36] hover:border-[#10B981]/60 text-[#D1D5DB] text-xs font-bold inline-flex items-center gap-1"
                  >
                    <span>🏛️ @{effectiveShop.instagramSalon}</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Paused Shop Banner */}
          {isPaused ? (
            <div className="my-6 p-5 rounded-2xl bg-[#F59E0B]/15 border-2 border-[#F59E0B]/50 text-left">
              <div className="flex items-center gap-2.5 text-[#F59E0B] font-bold text-sm mb-1.5">
                <AlertTriangle size={18} />
                <span>Barbería Temporalmente en Pausa</span>
              </div>
              <p className="text-xs text-[#FBBF24]/90 leading-relaxed">
                Este salón no está aceptando reservas online en este momento. Por favor contacta directamente por teléfono si necesitas atención.
              </p>
              {shopPhone && (
                <a
                  href={buildEmergencyPhoneLink(shopPhone)}
                  className="mt-3.5 inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#F59E0B] text-[#07090C] text-xs font-black shadow-md"
                >
                  <Phone size={14} />
                  <span>Llamar a {shopPhone}</span>
                </a>
              )}
            </div>
          ) : confirmationTicket ? (
            /* =============================================================== */
            /* TICKET DE CONFIRMACIÓN TRAS ENVIAR RESERVA O TURNO              */
            /* =============================================================== */
            <div className="my-6 p-6 rounded-2xl bg-gradient-to-b from-[#141820] to-[#0E1117] border-2 border-[#10B981] shadow-[0_10px_40px_rgba(16,185,129,0.2)] text-center space-y-4 animate-in fade-in">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#10B981]/20 border border-[#10B981] text-[#34D399] flex items-center justify-center">
                <CheckCircle2 size={30} />
              </div>

              {confirmationTicket.mode === 'appointment' ? (
                <>
                  <div>
                    <span className="px-2.5 py-1 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/50 text-[#FCD34D] text-[11px] font-extrabold uppercase">
                      ⏳ Hueco retenido 10 min · Pendiente de confirmar
                    </span>
                    <h2 className="text-xl font-serif font-black text-white uppercase mt-3">
                      ¡Solicitud Enviada, {confirmationTicket.clientName}!
                    </h2>
                    <p className="text-xs text-[#9CA3AF] mt-1">
                      El barbero ya tiene tu aviso en pantalla junto con tu ficha para aceptarlo en un toque.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0A0C0F] border border-[#252A36] text-left space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#9CA3AF]">Código Reserva:</span>
                      <span className="font-mono font-bold text-[#34D399]">
                        #{confirmationTicket.id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9CA3AF]">Servicio:</span>
                      <span className="font-bold text-white text-right ml-2">
                        {confirmationTicket.serviceName} ({confirmationTicket.price})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9CA3AF]">Barbero:</span>
                      <span className="font-bold text-white">
                        {confirmationTicket.barberName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9CA3AF]">Día y Hora:</span>
                      <span className="font-bold text-[#34D399]">
                        {confirmationTicket.date} · {confirmationTicket.timeSlot}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9CA3AF]">Estilo:</span>
                      <span className="font-semibold text-[#D1D5DB]">
                        {confirmationTicket.style}
                      </span>
                    </div>
                  </div>

                  <a
                    href={buildWhatsAppUrl(
                      shopPhone,
                      `¡Hola! Soy ${confirmationTicket.clientName}, acabo de pedir cita por el QR para el ${confirmationTicket.date} a las ${confirmationTicket.timeSlot} (${confirmationTicket.serviceName}).`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-4 min-h-[46px] rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-xs font-black uppercase flex items-center justify-center gap-2 shadow-lg"
                  >
                    <MessageSquare size={16} />
                    <span>Avisar también por WhatsApp (Opcional)</span>
                  </a>
                </>
              ) : (
                <>
                  <div>
                    <span className="px-2.5 py-1 rounded-full bg-[#10B981]/20 border border-[#10B981]/50 text-[#34D399] text-[11px] font-extrabold uppercase">
                      🟢 En Cola en Vivo · Pantalla TV Actualizada
                    </span>
                    <h2 className="text-2xl font-serif font-black text-white uppercase mt-3">
                      Turno #{confirmationTicket.position}
                    </h2>
                    <p className="text-xs text-[#9CA3AF] mt-1">
                      Tiempo estimado de espera:{' '}
                      <strong className="text-[#34D399]">
                        ~{confirmationTicket.waitMinutes} minutos
                      </strong>
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0A0C0F] border border-[#252A36] text-left space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#9CA3AF]">Cliente:</span>
                      <span className="font-bold text-white">
                        {confirmationTicket.clientName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9CA3AF]">Servicio:</span>
                      <span className="font-bold text-white">
                        {confirmationTicket.serviceName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9CA3AF]">Barbero:</span>
                      <span className="font-bold text-[#34D399]">
                        {confirmationTicket.barberName}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Kit "No Pierdas Tu Acceso" para repetir cita sin escanear QR */}
              <div
                data-testid="repeat-booking-kit"
                className="p-4 rounded-xl bg-[#0A0C0F] border border-[#252A36] text-left space-y-2.5"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#34D399] flex items-center gap-1.5">
                  <Bookmark size={13} />
                  <span>Guarda tu cita y tu enlace para repetir sin QR</span>
                </p>

                <div className="grid grid-cols-1 gap-2">
                  {confirmationTicket.mode === 'appointment' && (
                    <button
                      type="button"
                      data-testid="download-ics-btn"
                      onClick={() => {
                        soundFx.playClick();
                        downloadAppointmentIcs(
                          {
                            title: `${confirmationTicket.serviceName} · ${shopName}`,
                            description: `Barbero: ${confirmationTicket.barberName}`,
                            location: shopAddress,
                            date: confirmationTicket.date,
                            timeSlot: confirmationTicket.timeSlot,
                            durationMinutes: confirmationTicket.durationMinutes || 30,
                            bookingUrl: portalUrl,
                          },
                          `cita-${activeShopSlug}-${confirmationTicket.date}.ics`
                        );
                      }}
                      className="w-full py-2.5 px-3 min-h-[42px] rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] hover:border-[#10B981]/60 text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <CalendarPlus size={15} className="text-[#34D399]" />
                      <span>Guardar en mi Calendario (.ics)</span>
                    </button>
                  )}

                  <a
                    data-testid="save-link-wa-btn"
                    href={buildWhatsAppUrl(
                      '',
                      `💈 Mi enlace directo para reservar cita en ${shopName} sin QR:\n${portalUrl}`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 min-h-[42px] rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#10B981]/40 text-xs font-bold text-[#34D399] flex items-center justify-center gap-2 transition-all"
                  >
                    <MessageSquare size={15} />
                    <span>Guardarme enlace en mi WhatsApp</span>
                  </a>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCopyPortalLink}
                      className="flex-1 py-2 px-3 min-h-[38px] rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-[11px] font-bold text-[#D1D5DB] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedPortalLink ? <Check size={13} className="text-[#34D399]" /> : <Copy size={13} />}
                      <span>{copiedPortalLink ? '¡Enlace copiado!' : 'Copiar enlace directo'}</span>
                    </button>

                    {installPromptEvent && (
                      <button
                        type="button"
                        onClick={handleTriggerInstall}
                        className="flex-1 py-2 px-3 min-h-[38px] rounded-xl bg-[#10B981] text-[#07090C] text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Smartphone size={13} />
                        <span>Instalar en mi móvil</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-[#9CA3AF] leading-snug">
                  💡 <strong className="text-white">Truco:</strong> En tu móvil toca <em>Compartir → Añadir a pantalla de inicio</em> para tener el icono de {shopName} siempre listo.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setConfirmationTicket(null);
                  setAcceptedPrivacy(false);
                  setAcceptedWhatsapp(false);
                }}
                className="w-full py-3 px-4 min-h-[44px] rounded-xl bg-[#1B202B] hover:bg-[#252A36] text-xs font-bold text-[#D1D5DB] cursor-pointer"
              >
                Hacer otra reserva
              </button>
            </div>
          ) : (
            <>
              {savedProfile?.clientName && (
                <div
                  data-testid="returning-client-banner"
                  className="mt-4 p-3.5 rounded-xl bg-[#10B981]/12 border border-[#10B981]/40 flex flex-wrap items-center justify-between gap-2 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">
                      ✨ ¡Hola de nuevo, {savedProfile.clientName.split(' ')[0]}!
                    </p>
                    <p className="text-[11px] text-[#D1D5DB]">
                      Tus datos están listos para reservar en 5 segundos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetSavedProfile}
                    className="px-2.5 py-1.5 rounded-lg bg-[#141820] border border-[#252A36] text-[11px] font-bold text-[#D1D5DB] hover:text-white inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RotateCcw size={11} />
                    <span>Cambiar datos</span>
                  </button>
                </div>
              )}
              {/* Mode Selector Tabs (min-h-44px for ergonomic thumb tapping) */}
              <div className="grid grid-cols-2 gap-2 my-5 p-1 rounded-xl bg-[#141820] border border-[#252A36]">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setBookingMode('appointment');
                    setFormError('');
                  }}
                  className={`py-2.5 px-3 min-h-[44px] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    bookingMode === 'appointment'
                      ? 'bg-[#10B981] text-[#07090C] shadow-[0_2px_10px_rgba(16,185,129,0.3)]'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <Calendar size={14} />
                  <span>Día y Hora</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setBookingMode('walkin');
                    setFormError('');
                  }}
                  className={`py-2.5 px-3 min-h-[44px] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    bookingMode === 'walkin'
                      ? 'bg-[#10B981] text-[#07090C] shadow-[0_2px_10px_rgba(16,185,129,0.3)]'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <Clock size={14} />
                  <span>Cola en Vivo ({publicQueueCount})</span>
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3.5 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/50 text-xs font-bold text-[#FCA5A5]">
                  ⚠️ {formError}
                </div>
              )}

              {/* ============================================================= */}
              {/* MODO 1: RESERVAR DÍA Y HORA                                   */}
              {/* ============================================================= */}
              {bookingMode === 'appointment' ? (
                <form onSubmit={handleAppointmentSubmit} className="space-y-4">
                  {/* 1. Selecciona Servicio (Con pestañas de categoría sin scroll-trap) */}
                  <div className="p-4 rounded-xl bg-[#141820]/90 border border-[#252A36] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-1.5">
                        <Scissors size={14} className="text-[#10B981]" />
                        <span>1. Selecciona Servicio</span>
                      </h3>
                      <span className="text-[11px] font-mono font-bold text-[#34D399]">
                        ⏱ {selectedService?.durationMinutes || 30} min
                      </span>
                    </div>

                    {services.length > 4 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {activeServiceCategories.map((cat) => {
                          const active = serviceCategory === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                soundFx.playClick();
                                setServiceCategory(cat.id);
                              }}
                              className={`py-2 px-2.5 min-h-[40px] rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                active
                                  ? isFemale
                                    ? 'bg-[#EC4899] text-white border-[#F472B6]'
                                    : 'bg-[#10B981] text-[#07090C] border-[#34D399]'
                                  : 'bg-[#101318] text-[#D1D5DB] border-[#252A36]'
                              }`}
                            >
                              {cat.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-2">
                      {filteredServices.map((svc) => {
                        const isSelected = svc.id === selectedService?.id;
                        const isDayRecommended =
                          (svc.dayGroup === 'mon-thu' && isMonToThu) ||
                          (svc.dayGroup === 'fri-sat' && isFriOrSat);
                        return (
                          <button
                            key={svc.id}
                            type="button"
                            onClick={() => {
                              soundFx.playClick();
                              setSelectedServiceId(svc.id);
                            }}
                            className={`w-full p-3 min-h-[54px] rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#10B981]/15 border-[#10B981] shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                : 'bg-[#101318] border-[#252A36] hover:border-[#10B981]/40'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-bold text-white">{svc.name}</p>
                                {isDayRecommended && (
                                  <span className="px-1.5 py-0.5 rounded bg-[#10B981]/20 border border-[#10B981]/50 text-[#34D399] text-[10px] font-black uppercase">
                                    Hoy
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#9CA3AF] mt-0.5">
                                ⏱ {svc.durationMinutes || 60} min
                              </p>
                            </div>
                            <span className="text-xs sm:text-sm font-mono font-black text-[#34D399] shrink-0 text-right">
                              {svc.priceLabel || `${svc.price}€`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Selecciona Barbero (Compacto si solo hay 1 barbero) */}
                  <div className="p-4 rounded-xl bg-[#141820]/90 border border-[#252A36]">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-3 flex items-center gap-1.5">
                      <Users size={14} className="text-[#10B981]" />
                      <span>2. Tu Barbero</span>
                    </h3>
                    {barbers.length === 1 ? (
                      <div className="p-3.5 rounded-xl bg-[#10B981]/15 border border-[#10B981] flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white">{barbers[0].name}</p>
                          <p className="text-xs text-[#34D399]">
                            {barbers[0].role || barbers[0].specialty || 'Master Barber'}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-[#10B981] text-[#07090C] text-[11px] font-black uppercase">
                          ✓ Seleccionado
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            soundFx.playClick();
                            setSelectedBarberId('any');
                          }}
                          className={`p-3 min-h-[52px] rounded-xl border text-center transition-all cursor-pointer ${
                            selectedBarberId === 'any'
                              ? 'bg-[#10B981]/15 border-[#10B981] text-white'
                              : 'bg-[#101318] border-[#252A36] text-[#D1D5DB]'
                          }`}
                        >
                          <p className="text-xs font-bold text-white">Cualquier Barbero</p>
                          <p className="text-[11px] text-[#34D399]">Primer hueco libre</p>
                        </button>

                        {barbers.map((b) => {
                          const isSelected = selectedBarberId === b.id;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                soundFx.playClick();
                                setSelectedBarberId(b.id);
                              }}
                              className={`p-3 min-h-[52px] rounded-xl border text-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#10B981]/15 border-[#10B981] text-white'
                                  : 'bg-[#101318] border-[#252A36] text-[#D1D5DB]'
                              }`}
                            >
                              <p className="text-xs font-bold text-white">{b.name}</p>
                              <p className="text-[11px] text-[#9CA3AF] truncate">
                                {b.role || b.specialty || 'Barbero'}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 3. Día y Hora Disponible (Botones grandes >= 44px en 3 columnas divididos Mañana / Tarde) */}
                  <div className="p-4 rounded-xl bg-[#141820]/90 border border-[#252A36] space-y-3.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-1.5">
                      <Calendar size={14} className="text-[#10B981]" />
                      <span>3. Elige Día y Hora Libre</span>
                    </h3>

                    {/* Selector de días */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      {upcomingDates.map((d) => {
                        const active = d.iso === selectedDate;
                        return (
                          <button
                            key={d.iso}
                            type="button"
                            onClick={() => {
                              soundFx.playClick();
                              setSelectedDate(d.iso);
                            }}
                            className={`py-2.5 px-2 min-h-[50px] rounded-xl border text-center transition-all cursor-pointer ${
                              active
                                ? 'bg-[#10B981] text-[#07090C] border-[#10B981] font-black shadow-md'
                                : 'bg-[#101318] border-[#252A36] text-[#D1D5DB]'
                            }`}
                          >
                            <span className="text-[11px] uppercase block leading-tight">
                              {d.labelDay}
                            </span>
                            <span className="text-xs font-bold block mt-0.5">
                              {d.labelNum}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Grid de horas en 3 columnas amplias (Mañana / Tarde) */}
                    {slotsWithAvailability.length === 0 ? (
                      <div className="p-4 rounded-xl bg-[#0A0C0F] border border-[#252A36] text-center text-xs text-[#FCD34D] font-bold">
                        🔒 La barbería permanece cerrada en la fecha seleccionada. Elige otro día arriba.
                      </div>
                    ) : (
                      <div className="space-y-3 pt-1">
                        {morningSlots.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-bold text-[#9CA3AF] block">
                              ☀️ Mañana
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                              {morningSlots.map(({ time, available }) => {
                                const isChosen = time === selectedSlot && available;
                                return (
                                  <button
                                    key={time}
                                    type="button"
                                    disabled={!available}
                                    onClick={() => {
                                      soundFx.playClick();
                                      setSelectedSlot(time);
                                    }}
                                    className={`py-2.5 px-2 min-h-[44px] rounded-xl text-xs font-mono font-bold border transition-all ${
                                      !available
                                        ? 'bg-[#0A0C0F]/50 border-[#1F2430] text-[#4B5563] line-through cursor-not-allowed'
                                        : isChosen
                                        ? 'bg-[#10B981] text-[#07090C] border-[#34D399] shadow-md cursor-pointer'
                                        : 'bg-[#101318] border-[#252A36] text-white hover:border-[#10B981]/50 cursor-pointer'
                                    }`}
                                  >
                                    {time}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {afternoonSlots.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-bold text-[#9CA3AF] block">
                              🌙 Tarde
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                              {afternoonSlots.map(({ time, available }) => {
                                const isChosen = time === selectedSlot && available;
                                return (
                                  <button
                                    key={time}
                                    type="button"
                                    disabled={!available}
                                    onClick={() => {
                                      soundFx.playClick();
                                      setSelectedSlot(time);
                                    }}
                                    className={`py-2.5 px-2 min-h-[44px] rounded-xl text-xs font-mono font-bold border transition-all ${
                                      !available
                                        ? 'bg-[#0A0C0F]/50 border-[#1F2430] text-[#4B5563] line-through cursor-not-allowed'
                                        : isChosen
                                        ? 'bg-[#10B981] text-[#07090C] border-[#34D399] shadow-md cursor-pointer'
                                        : 'bg-[#101318] border-[#252A36] text-white hover:border-[#10B981]/50 cursor-pointer'
                                    }`}
                                  >
                                    {time}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 4. Datos del Cliente y Estilo */}
                  <div className="p-4 rounded-xl bg-[#141820]/90 border border-[#252A36] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-1.5">
                      <User size={14} className="text-[#10B981]" />
                      <span>4. Tus Datos (Conecta con tu Ficha)</span>
                    </h3>

                    <div className="space-y-2.5">
                      <input
                        type="text"
                        required
                        placeholder="Tu nombre y apellido (ej. Carlos Pérez)"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full px-3.5 py-3 min-h-[46px] rounded-xl bg-[#0A0C0F] border border-[#252A36] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
                      />

                      <div className="relative">
                        <input
                          type="tel"
                          required
                          placeholder="Tu móvil WhatsApp (ej. 622 456 789)"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          className="w-full px-3.5 py-3 min-h-[46px] rounded-xl bg-[#0A0C0F] border border-[#252A36] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
                        />
                        <span className="text-[11px] text-[#34D399] block mt-1 px-1">
                          ✨ Si ya eres cliente, el barbero recibirá tu receta de corte automáticamente.
                        </span>
                      </div>
                    </div>

                    {/* Estilo orientativo */}
                    <div className="pt-1">
                      <span className="text-xs font-bold text-[#9CA3AF] block mb-1.5">
                        {activeVertical === 'nails'
                          ? '¿Qué diseño o estilo te apetece hoy?'
                          : activeVertical === 'peluqueria'
                          ? '¿Qué servicio o resultado buscas hoy?'
                          : '¿Qué estilo buscas hoy?'}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeStylePills.map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              soundFx.playClick();
                              setSelectedStyle(st);
                            }}
                            className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              selectedStyle === st
                                ? isFemale
                                  ? 'bg-[#EC4899] text-white border-[#F472B6]'
                                  : 'bg-[#10B981] text-[#07090C] border-[#34D399]'
                                : 'bg-[#101318] text-[#D1D5DB] border-[#252A36]'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="Nota opcional para el barbero..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[#0A0C0F] border border-[#252A36] text-xs text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
                    />
                  </div>

                  {renderRgpdSection()}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-4 min-h-[50px] rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-sm font-black uppercase tracking-wide flex items-center justify-center gap-2 shadow-[0_6px_25px_rgba(16,185,129,0.35)] cursor-pointer transition-all"
                  >
                    <span>
                      {submitting
                        ? 'Enviando reserva...'
                        : `✓ Solicitar Cita (${selectedSlot})`}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                </form>
              ) : (
                /* ============================================================= */
                /* MODO 2: TURNO RÁPIDO HOY (COLA EN VIVO)                       */
                /* ============================================================= */
                <form onSubmit={handleWalkInSubmit} className="space-y-4">
                  <div className="p-5 rounded-xl bg-[#141820]/90 border border-[#252A36] text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                      Gente en Espera Ahora Mismo
                    </p>
                    <p className="text-4xl font-black text-white my-2">
                      {publicQueueCount}
                    </p>
                    <p className="text-xs text-[#34D399] font-medium">
                      {publicQueueCount === 0
                        ? '● Salón despejado · Pasa casi directo'
                        : `● Espera estimada: ~${publicQueueCount * 15} min`}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#141820]/90 border border-[#252A36] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-1.5">
                      <Smartphone size={14} className="text-[#10B981]" />
                      <span>Apúntate a la Cola desde tu Móvil</span>
                    </h3>

                    <input
                      type="text"
                      required
                      placeholder="Tu nombre (aparecerá en la Pantalla TV)"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full px-3.5 py-3 min-h-[46px] rounded-xl bg-[#0A0C0F] border border-[#252A36] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
                    />

                    <input
                      type="tel"
                      required
                      placeholder="Tu móvil WhatsApp (para avisarte tu turno)"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full px-3.5 py-3 min-h-[46px] rounded-xl bg-[#0A0C0F] border border-[#252A36] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
                    />

                    <div>
                      <span className="text-xs font-bold text-[#9CA3AF] block mb-1.5">
                        Servicio:
                      </span>
                      <div className="grid grid-cols-1 gap-1.5">
                        {services.map((svc) => (
                          <button
                            key={svc.id}
                            type="button"
                            onClick={() => setSelectedServiceId(svc.id)}
                            className={`p-3 min-h-[46px] rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer ${
                              svc.id === selectedService?.id
                                ? 'bg-[#10B981]/15 border-[#10B981] text-white'
                                : 'bg-[#101318] border-[#252A36] text-[#9CA3AF]'
                            }`}
                          >
                            <span className="text-left pr-2">{svc.name}</span>
                            <span className="text-[#34D399] shrink-0">
                              {svc.priceLabel || `${svc.price}€`}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {renderRgpdSection()}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-4 min-h-[50px] rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-sm font-black uppercase tracking-wide flex items-center justify-center gap-2 shadow-[0_6px_25px_rgba(16,185,129,0.35)] cursor-pointer transition-all"
                  >
                    <span>
                      {submitting
                        ? 'Apuntando...'
                        : '⚡ Coger Turno en la Cola Ahora'}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer con acceso protegido por PIN para el barbero */}
        <div className="pt-8 pb-4 text-center border-t border-[#252A36]/50 mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
          <div className="flex items-center gap-2 flex-wrap">
            <span>KUTZ // BARBER OS · Reserva Directa QR</span>
            <button
              type="button"
              onClick={() => setIsLegalModalOpen(true)}
              className="text-[#9CA3AF] hover:text-[#34D399] underline cursor-pointer"
            >
              Privacidad &amp; Aviso Legal
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setIsPinModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-[#141820]/80 border border-[#252A36] text-[#9CA3AF] hover:text-[#34D399] font-semibold cursor-pointer"
          >
            <Lock size={12} />
            <span>Soy el Barbero</span>
          </button>
        </div>
      </div>

      <LegalComplianceModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        shop={effectiveShop}
        shopSlug={activeShopSlug}
        publicOnly={true}
      />

      <BarberPinLockModal
        isOpen={isPinModalOpen}
        expectedPin={activeShop?.pin || '2023'}
        shopName={shopName}
        onVerifyPin={verifyAndUnlockShopPin}
        onCancel={() => setIsPinModalOpen(false)}
        onUnlock={() => {
          setIsPinModalOpen(false);
          navigate(`/?shop=${activeShopSlug}`);
        }}
      />
    </div>
  );
}
