import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Scissors,
  Tv,
  Flame,
  ShieldCheck,
  Download,
  Upload,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  Clock,
  MessageSquare,
  UserCheck,
  X,
  ArrowRight,
  Sparkles,
  UserPlus,
  QrCode,
  Calendar,
  AlertTriangle,
  Wallet,
  CreditCard,
  Banknote,
  ShoppingBag,
  Star,
} from 'lucide-react';
import { useClients, getFadeAlert } from '../context/ClientContext';
import { useShop } from '../context/ShopContext';
import {
  loadLocalShopState,
  saveLocalShopState,
  dispatchBarberAction,
  calculateHoldExpiration,
} from '../lib/syncService';
import { DEFAULT_SHOP_SLUG, buildWhatsAppUrl, getShopLocalDateTime } from '../lib/shopUtils';
import VisualAgendaTimeline from '../components/VisualAgendaTimeline';
import { soundFx } from '../lib/soundFx';
import { Trash2 } from 'lucide-react';

const QUICK_SERVICES = [
  'Skin Fade (25€)',
  'Fade + Barba (32€)',
  'Solo Barba (15€)',
  'Corte Clásico (20€)',
];

const BARBERS_LIST = ['Cualquiera', 'Rex', 'Kiko', 'Nico'];

const DAY_LABELS_ORDER = [
  { dow: 1, name: 'Lunes', short: 'L' },
  { dow: 2, name: 'Martes', short: 'M' },
  { dow: 3, name: 'Miércoles', short: 'X' },
  { dow: 4, name: 'Jueves', short: 'J' },
  { dow: 5, name: 'Viernes', short: 'V' },
  { dow: 6, name: 'Sábado', short: 'S' },
  { dow: 0, name: 'Domingo', short: 'D' },
];

const SCHEDULE_TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'
];

function buildChairsForShop(shop, slug) {
  if (slug === DEFAULT_SHOP_SLUG) {
    return [
      {
        id: 'SILLÓN 1',
        barber: 'REX',
        specialty: 'Degradados',
        status: 'CUTTING',
        clientId: '3',
        clientName: 'Álex Rivera',
        service: 'Skin Fade #000 + Navaja',
      },
      {
        id: 'SILLÓN 2',
        barber: 'KIKO',
        specialty: 'Corte & Street',
        status: 'WALKIN',
        clientId: null,
        clientName: '',
        service: '',
      },
      {
        id: 'SILLÓN 3',
        barber: 'NICO',
        specialty: 'Barba & Tijera',
        status: 'BEARD',
        clientId: '2',
        clientName: 'Dani Morales',
        service: 'Low Taper + Ritual Toalla',
      },
    ];
  }

  const shopBarbers = Array.isArray(shop?.barbers) && shop.barbers.length > 0
    ? shop.barbers
    : [{ id: 'b1', name: 'Barbero Titular', specialty: 'Master Barber' }];

  return shopBarbers.map((b, idx) => ({
    id: b.chair || `SILLÓN ${idx + 1}`,
    barberId: b.id,
    barber: b.name || `Barbero ${idx + 1}`,
    specialty: b.specialty || b.role || 'Master Barber',
    status: 'WALKIN',
    clientId: null,
    clientName: '',
    service: '',
  }));
}

const CHAIR_STATES = {
  CUTTING: {
    code: 'CUTTING',
    label: 'CORTANDO',
    badgeClass: 'bg-[#10B981]/20 text-[#34D399] border-[#10B981]/50',
    dotClass: 'bg-[#10B981] animate-pulse',
    borderTop: 'border-t-[#10B981]',
  },
  WALKIN: {
    code: 'WALKIN',
    label: 'LIBRE',
    badgeClass: 'bg-[#3B82F6]/20 text-[#60A5FA] border-[#3B82F6]/50',
    dotClass: 'bg-[#60A5FA]',
    borderTop: 'border-t-[#3B82F6]',
  },
  BEARD: {
    code: 'BEARD',
    label: 'BARBA & VAPOR',
    badgeClass: 'bg-[#F59E0B]/20 text-[#FBBF24] border-[#F59E0B]/50',
    dotClass: 'bg-[#FBBF24] animate-pulse',
    borderTop: 'border-t-[#F59E0B]',
  },
};

const Dashboard = () => {
  const {
    clients,
    addClient,
    importClientsBackup,
    businessMode,
    activeModeConfig,
    walkInQueue = [],
    addWalkIn,
    removeWalkIn,
    notifyWalkInWhatsApp,
  } = useClients();
  const {
    activeShop,
    activeShopSlug,
    lastSyncTime,
    needsPinSync,
    forceSyncNow,
    updateShop,
  } = useShop();

  const navigate = useNavigate();
  const outletCtx = useOutletContext() || {};
  const { openKiosk, openNoShow, openReel, openQRPoster } = outletCtx;
  const backupInputRef = useRef(null);

  const [notice, setNotice] = useState('');
  const [isAddingWalkIn, setIsAddingWalkIn] = useState(false);
  const [pickingForChairId, setPickingForChairId] = useState(null);
  const [quickClientName, setQuickClientName] = useState('');

  // Dynamic services & barbers for the active shop (e.g. José's 16 official services & 1 barber, or any future shop)
  const shopQuickServices = useMemo(() => {
    if (Array.isArray(activeShop?.services) && activeShop.services.length > 0) {
      return activeShop.services.slice(0, 6).map(
        (s) => `${s.name} (${s.priceLabel || `${s.price}€`})`
      );
    }
    return QUICK_SERVICES;
  }, [activeShop?.services]);

  const shopBarbersList = useMemo(() => {
    if (Array.isArray(activeShop?.barbers) && activeShop.barbers.length > 0) {
      if (activeShop.barbers.length === 1) {
        return [activeShop.barbers[0].name];
      }
      return ['Cualquiera', ...activeShop.barbers.map((b) => b.name)];
    }
    return BARBERS_LIST;
  }, [activeShop?.barbers]);

  const [walkInForm, setWalkInForm] = useState(() => ({
    name: '',
    phone: '',
    service: shopQuickServices[0] || QUICK_SERVICES[0],
    barber: shopBarbersList[0] || 'Cualquiera',
    waitMinutes: 15,
  }));

  useEffect(() => {
    setWalkInForm((prev) => ({
      ...prev,
      service: shopQuickServices[0] || QUICK_SERVICES[0],
      barber: shopBarbersList[0] || 'Cualquiera',
    }));
  }, [activeShopSlug, shopQuickServices, shopBarbersList]);

  // Paneles administrativos ocultos por defecto para mantener la vista 100% limpia
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [isServiceDurationsOpen, setIsServiceDurationsOpen] = useState(false);
  const [isScheduleEditorOpen, setIsScheduleEditorOpen] = useState(false);
  const [agendaViewMode, setAgendaViewMode] = useState('timeline'); // 'timeline' (Booksy) | 'cards'
  const [commissionRate, setCommissionRate] = useState(50); // % que se lleva el barbero (50%, 60%, 40%)
  const [chairProductAddon, setChairProductAddon] = useState({}); // { 'SILLÓN 1': true/false }
  const [, setReviewTick] = useState(0);

  // Refresh reviewQueue countdown every 30s
  useEffect(() => {
    const t = setInterval(() => setReviewTick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const loadShopReviewQueue = (slug) => {
    try {
      const saved = localStorage.getItem(`kutz_${slug}_review_queue_v2`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    if (slug !== DEFAULT_SHOP_SLUG) return [];
    const now = Date.now();
    return [
      {
        id: 'rev-demo-1',
        clientName: 'Álex Rivera',
        phone: '+34 622 345 678',
        service: 'Skin Fade #000 + Navaja',
        completedAt: now - 35 * 60 * 1000,
        sendAfter: now - 5 * 60 * 1000,
        sent: false,
      },
    ];
  };

  const loadShopDailySales = (slug) => {
    try {
      const saved = localStorage.getItem(`kutz_${slug}_daily_sales_v2`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    if (slug !== DEFAULT_SHOP_SLUG) return [];
    return [
      { id: 's-1', barber: 'REX', clientName: 'Carlos M.', service: 'Skin Fade #000', amount: 25, productAmount: 12, method: 'cash', time: '10:30' },
      { id: 's-2', barber: 'KIKO', clientName: 'Jorge L.', service: 'Fade + Barba', amount: 32, productAmount: 0, method: 'bizum', time: '11:15' },
      { id: 's-3', barber: 'REX', clientName: 'Mateo V.', service: 'Skin Fade #000', amount: 25, productAmount: 0, method: 'bizum', time: '12:00' },
      { id: 's-4', barber: 'NICO', clientName: 'Pedro S.', service: 'Corte Clásico', amount: 20, productAmount: 12, method: 'cash', time: '12:45' },
    ];
  };

  const [reviewQueue, setReviewQueue] = useState(() => loadShopReviewQueue(activeShopSlug));
  const [dailySales, setDailySales] = useState(() => loadShopDailySales(activeShopSlug));
  const [completedToday, setCompletedToday] = useState(() => loadShopDailySales(activeShopSlug).length);

  const [openDrawers] = useState({
    telemetry: false,
    vault: false,
    rgpd: false,
  });

  // Estado interactivo de los sillones del salón (derivado dinámicamente de activeShop.barbers)
  const [chairs, setChairs] = useState(() => buildChairsForShop(activeShop, activeShopSlug));

  useEffect(() => {
    const sales = loadShopDailySales(activeShopSlug);
    setDailySales(sales);
    setCompletedToday(sales.length);
    setReviewQueue(loadShopReviewQueue(activeShopSlug));
    setChairs(buildChairsForShop(activeShop, activeShopSlug));
  }, [activeShopSlug, activeShop]);

  // Tactile Opening Hours Editor State (hoursByDay & workDays)
  const [draftSchedule, setDraftSchedule] = useState(() => ({
    workDays: activeShop?.schedule?.workDays || [1, 2, 3, 4, 5, 6],
    slotMinutes: activeShop?.schedule?.slotMinutes || activeShop?.schedule?.slotIntervalMinutes || 60,
    hoursByDay: {
      1: { openTime: activeShop?.schedule?.hoursByDay?.[1]?.openTime || activeShop?.schedule?.openTime || '10:00', closeTime: activeShop?.schedule?.hoursByDay?.[1]?.closeTime || activeShop?.schedule?.closeTime || '18:00' },
      2: { openTime: activeShop?.schedule?.hoursByDay?.[2]?.openTime || activeShop?.schedule?.openTime || '10:00', closeTime: activeShop?.schedule?.hoursByDay?.[2]?.closeTime || activeShop?.schedule?.closeTime || '18:00' },
      3: { openTime: activeShop?.schedule?.hoursByDay?.[3]?.openTime || activeShop?.schedule?.openTime || '10:00', closeTime: activeShop?.schedule?.hoursByDay?.[3]?.closeTime || activeShop?.schedule?.closeTime || '18:00' },
      4: { openTime: activeShop?.schedule?.hoursByDay?.[4]?.openTime || activeShop?.schedule?.openTime || '10:00', closeTime: activeShop?.schedule?.hoursByDay?.[4]?.closeTime || activeShop?.schedule?.closeTime || '18:00' },
      5: { openTime: activeShop?.schedule?.hoursByDay?.[5]?.openTime || activeShop?.schedule?.openTime || '09:00', closeTime: activeShop?.schedule?.hoursByDay?.[5]?.closeTime || activeShop?.schedule?.closeTime || '20:30' },
      6: { openTime: activeShop?.schedule?.hoursByDay?.[6]?.openTime || activeShop?.schedule?.openTime || '09:00', closeTime: activeShop?.schedule?.hoursByDay?.[6]?.closeTime || activeShop?.schedule?.closeTime || '15:00' },
      0: { openTime: activeShop?.schedule?.hoursByDay?.[0]?.openTime || '10:00', closeTime: activeShop?.schedule?.hoursByDay?.[0]?.closeTime || '15:00' },
    },
  }));

  useEffect(() => {
    const sch = activeShop?.schedule || {};
    const hbd = sch.hoursByDay || {};
    const defOpen = sch.openTime || '10:00';
    const defClose = sch.closeTime || '20:00';
    setDraftSchedule({
      workDays: Array.isArray(sch.workDays) ? sch.workDays : [1, 2, 3, 4, 5, 6],
      slotMinutes: Number(sch.slotMinutes || sch.slotIntervalMinutes || 60),
      hoursByDay: {
        1: { openTime: hbd[1]?.openTime || hbd['1']?.openTime || defOpen, closeTime: hbd[1]?.closeTime || hbd['1']?.closeTime || defClose },
        2: { openTime: hbd[2]?.openTime || hbd['2']?.openTime || defOpen, closeTime: hbd[2]?.closeTime || hbd['2']?.closeTime || defClose },
        3: { openTime: hbd[3]?.openTime || hbd['3']?.openTime || defOpen, closeTime: hbd[3]?.closeTime || hbd['3']?.closeTime || defClose },
        4: { openTime: hbd[4]?.openTime || hbd['4']?.openTime || defOpen, closeTime: hbd[4]?.closeTime || hbd['4']?.closeTime || defClose },
        5: { openTime: hbd[5]?.openTime || hbd['5']?.openTime || defOpen, closeTime: hbd[5]?.closeTime || hbd['5']?.closeTime || defClose },
        6: { openTime: hbd[6]?.openTime || hbd['6']?.openTime || defOpen, closeTime: hbd[6]?.closeTime || hbd['6']?.closeTime || defClose },
        0: { openTime: hbd[0]?.openTime || hbd['0']?.openTime || '10:00', closeTime: hbd[0]?.closeTime || hbd['0']?.closeTime || '15:00' },
      },
    });
  }, [activeShop]);

  const handleSaveShopSchedule = async () => {
    soundFx.playClick();
    soundFx.triggerHaptic(15);
    const updatedSchedule = {
      ...(activeShop?.schedule || {}),
      openTime: draftSchedule.hoursByDay[1]?.openTime || '10:00',
      closeTime: draftSchedule.hoursByDay[1]?.closeTime || '18:00',
      slotMinutes: Number(draftSchedule.slotMinutes) || 60,
      slotIntervalMinutes: Number(draftSchedule.slotMinutes) || 60,
      workDays: draftSchedule.workDays,
      daysOpen: draftSchedule.workDays,
      hoursByDay: draftSchedule.hoursByDay,
    };

    const state = loadLocalShopState(activeShopSlug);
    const nextConfig = { ...activeShop, schedule: updatedSchedule };
    saveLocalShopState(activeShopSlug, { ...state, config: nextConfig });

    await dispatchBarberAction(
      activeShopSlug,
      'update_shop_schedule',
      { schedule: updatedSchedule },
      activeShop?.pin || ''
    );
    if (updateShop) {
      await updateShop(activeShopSlug, { schedule: updatedSchedule }).catch(() => {});
    }
    setIsScheduleEditorOpen(false);
    showToast('✓ Horario de apertura actualizado para la agenda y el QR');
  };

  const showToast = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3200);
  };

  // Terminar el corte actual, registrar cobro/comisión y dejar el sillón libre en 1 toque
  const handleFinishChair = (chairId, paymentMethod = 'cash') => {
    soundFx.playClick();
    soundFx.triggerHaptic(15);

    const targetChair = chairs.find((c) => c.id === chairId);
    if (targetChair && targetChair.status !== 'WALKIN') {
      const priceMatch = String(targetChair.service || '').match(/(\d+)\s*€/);
      const basePrice = priceMatch
        ? Number(priceMatch[1])
        : String(targetChair.service || '').toLowerCase().includes('combo') ||
          String(targetChair.service || '').toLowerCase().includes('barba')
        ? 28
        : 22;
      const hasProduct = Boolean(chairProductAddon[chairId]);
      const productPrice = hasProduct ? 12 : 0;

      const newSale = {
        id: `sale-${Date.now()}`,
        barber: targetChair.barber || 'REX',
        clientName: targetChair.clientName || 'Cliente',
        service: targetChair.service || 'Skin Fade',
        amount: basePrice,
        productAmount: productPrice,
        method: paymentMethod,
        time: new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setDailySales((prev) => {
        const next = [newSale, ...prev];
        try {
          localStorage.setItem(
            `kutz_${activeShopSlug}_daily_sales_v2`,
            JSON.stringify(next)
          );
        } catch {
          // ignore
        }
        return next;
      });

      setChairProductAddon((prev) => ({ ...prev, [chairId]: false }));
      const totalCharged = basePrice + productPrice;
      const methodLabel =
        paymentMethod === 'bizum' ? '📱 Bizum/Tarjeta' : '💵 Efectivo';
      showToast(
        `✓ Cobrado ${totalCharged}€ (${methodLabel}) · Sumado a ${targetChair.barber} (Reseña programada en 30 min)`
      );

      // Programar recordatorio automático de reseña Google a los 30 minutos del corte
      const matched = clients.find(
        (c) =>
          String(c.id) === String(targetChair.clientId) ||
          String(c.name || '').toLowerCase() === String(targetChair.clientName || '').toLowerCase()
      );
      const finishedAt = Date.now();
      const reviewEntry = {
        id: `rev-${finishedAt}`,
        clientName: targetChair.clientName || 'Cliente',
        phone: matched?.phone || '',
        service: targetChair.service || 'Corte',
        completedAt: finishedAt,
        sendAfter: finishedAt + 30 * 60 * 1000,
        sent: false,
      };
      setReviewQueue((prev) => {
        const next = [reviewEntry, ...prev].slice(0, 12);
        try {
          localStorage.setItem(
            `kutz_${activeShopSlug}_review_queue_v2`,
            JSON.stringify(next)
          );
        } catch {
          // ignore
        }
        return next;
      });
    } else {
      showToast(`✓ Corte terminado. ${chairId} libre y listo.`);
    }

    setChairs((prev) =>
      prev.map((ch) =>
        ch.id === chairId
          ? {
              ...ch,
              status: 'WALKIN',
              clientId: null,
              clientName: '',
              service: '',
            }
          : ch
      )
    );
    setCompletedToday((c) => c + 1);
  };

  // Alternar entre Cortando y Barba si está ocupado
  const handleToggleChairType = (chairId) => {
    soundFx.playClick();
    setChairs((prev) =>
      prev.map((ch) => {
        if (ch.id !== chairId) return ch;
        const nextStatus = ch.status === 'BEARD' ? 'CUTTING' : 'BEARD';
        return { ...ch, status: nextStatus };
      })
    );
  };

  // Sentar al primero de la cola en un sillón específico (o en el primero libre)
  const handleSeatNextInChair = (targetChairId = null) => {
    if (!walkInQueue || walkInQueue.length === 0) {
      soundFx.playClick();
      setPickingForChairId(targetChairId);
      return;
    }

    const freeChair = targetChairId
      ? chairs.find((c) => c.id === targetChairId)
      : chairs.find((c) => c.status === 'WALKIN');

    if (!freeChair) {
      soundFx.playClick();
      showToast('Todos los sillones están ocupados. Termina uno primero.');
      return;
    }

    soundFx.playClick();
    soundFx.triggerHaptic(15);
    const nextClient = walkInQueue[0];

    setChairs((prev) =>
      prev.map((ch) =>
        ch.id === freeChair.id
          ? {
              ...ch,
              status: nextClient.service?.toLowerCase().includes('barba')
                ? 'BEARD'
                : 'CUTTING',
              clientId: null,
              clientName: nextClient.name,
              service: nextClient.service || 'Skin Fade',
            }
          : ch
      )
    );

    if (removeWalkIn) {
      removeWalkIn(nextClient.id);
    }
    showToast(`🪑 ¡${nextClient.name} sentado en ${freeChair.id}!`);
  };

  // Sentar manualmente un cliente en un sillón libre
  const handleManualSeat = (chairId, selectedClient) => {
    soundFx.playClick();
    soundFx.triggerHaptic(12);
    setChairs((prev) =>
      prev.map((ch) =>
        ch.id === chairId
          ? {
              ...ch,
              status: 'CUTTING',
              clientId: selectedClient.id || null,
              clientName: selectedClient.name,
              service:
                selectedClient.treatments?.[0]?.name ||
                selectedClient.treatment ||
                'Corte de Cabello',
            }
          : ch
      )
    );
    setPickingForChairId(null);
    setQuickClientName('');
    showToast(`✂️ ${selectedClient.name} en ${chairId}`);
  };

  // Apuntar alguien a la cola rápidamente
  const handleAddWalkInSubmit = (e) => {
    e.preventDefault();
    if (!walkInForm.name.trim()) return;
    soundFx.playClick();
    soundFx.triggerHaptic(12);
    if (addWalkIn) {
      addWalkIn(walkInForm);
    }
    setWalkInForm({
      name: '',
      phone: '',
      service: shopQuickServices[0] || QUICK_SERVICES[0],
      barber: shopBarbersList[0] || 'Cualquiera',
      waitMinutes: 15,
    });
    setIsAddingWalkIn(false);
    showToast(`⏳ ${walkInForm.name} apuntado a la cola`);
  };

  // Mandar WhatsApp rápido (con prefijo 34 normalizado)
  const handleDirectWhatsApp = (client, insight) => {
    soundFx.playClick();
    const firstName = (client.name || 'crack').split(' ')[0];
    const shopLabel = activeShop?.name || 'KUTZ Barber';
    const draft =
      insight?.whatsappDraft ||
      `¡Qué pasa ${firstName}! 💈 Ya toca repasar ese degradado en ${shopLabel}. ¿Te guardamos sitio esta semana? 🔥`;
    const cleanDigits = (client.phone || '').replace(/\D/g, '');
    if (cleanDigits.length >= 9) {
      window.open(
        buildWhatsAppUrl(client.phone, draft),
        '_blank',
        'noopener,noreferrer'
      );
    } else {
      navigate(`/clients/${client.id}`);
    }
  };

  // Copias de seguridad JSON
  const handleExportBackup = () => {
    soundFx.playClick();
    const backupPayload = {
      exportDate: new Date().toISOString(),
      studio: activeModeConfig?.badge || 'KUTZ Barber Studio',
      businessMode,
      totalClients: clients.length,
      clients,
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kutz_barber_copia_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('✓ Copia de seguridad guardada');
  };

  const handleImportBackup = (e) => {
    soundFx.playClick();
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const targetArray = Array.isArray(parsed) ? parsed : parsed.clients;
        if (importClientsBackup && importClientsBackup(targetArray)) {
          showToast(`✓ Restaurados ${targetArray.length} clientes`);
        }
      } catch {
        alert('El archivo no es una copia válida.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const busyChairsCount = chairs.filter((c) => c.status !== 'WALKIN').length;
  const freeChairExists = chairs.some((c) => c.status === 'WALKIN');
  const signedConsents = clients.filter((c) => c.consent?.signed).length;

  // Cálculos automáticos de Caja Diaria y Comisiones de Barberos (derivados de activeShop.barbers)
  const cashierSummary = useMemo(() => {
    let totalServices = 0;
    let totalProducts = 0;
    let cashTotal = 0;
    let bizumTotal = 0;
    const byBarber = {};

    const shopBarbers = Array.isArray(activeShop?.barbers) && activeShop.barbers.length > 0
      ? activeShop.barbers
      : [{ name: 'REX' }, { name: 'KIKO' }, { name: 'NICO' }];

    shopBarbers.forEach((b) => {
      const key = String(b.name || 'Barbero').toUpperCase();
      byBarber[key] = { cuts: 0, servicesRev: 0, productsRev: 0 };
    });

    const defaultBarberKey = String(shopBarbers[0]?.name || 'BARBERO').toUpperCase();

    dailySales.forEach((s) => {
      const srvAmt = Number(s.amount) || 0;
      const prdAmt = Number(s.productAmount) || 0;
      const lineTotal = srvAmt + prdAmt;
      totalServices += srvAmt;
      totalProducts += prdAmt;
      if (s.method === 'bizum') bizumTotal += lineTotal;
      else cashTotal += lineTotal;

      const bKey = String(s.barber || defaultBarberKey).toUpperCase();
      if (!byBarber[bKey]) {
        byBarber[bKey] = { cuts: 0, servicesRev: 0, productsRev: 0 };
      }
      byBarber[bKey].cuts += 1;
      byBarber[bKey].servicesRev += srvAmt;
      byBarber[bKey].productsRev += prdAmt;
    });

    const grandTotal = totalServices + totalProducts;
    const barberRows = Object.entries(byBarber).map(([name, data]) => {
      const barberCutShare = Math.round((data.servicesRev * commissionRate) / 100);
      // 20% extra de comisión por bote de polvo/cera vendido
      const barberProductBonus = Math.round(data.productsRev * 0.2);
      const barberPayout = barberCutShare + barberProductBonus;
      const shopNet = data.servicesRev + data.productsRev - barberPayout;
      return {
        name,
        cuts: data.cuts,
        totalGenerated: data.servicesRev + data.productsRev,
        barberPayout,
        shopNet,
      };
    });

    const totalBarberPayouts = barberRows.reduce((acc, r) => acc + r.barberPayout, 0);
    const totalShopNet = grandTotal - totalBarberPayouts;

    return {
      grandTotal,
      totalServices,
      totalProducts,
      cashTotal,
      bizumTotal,
      barberRows,
      totalBarberPayouts,
      totalShopNet,
    };
  }, [dailySales, commissionRate]);

  // Clientes que llevan +15 días sin venir (para avisar hoy en 1 toque)
  const retouchClients = useMemo(() => {
    return clients
      .map((c) => ({ client: c, alert: getFadeAlert(c) }))
      .filter(({ alert }) => alert.requiresRetouch || alert.elapsedDays >= 14)
      .slice(0, 3);
  }, [clients]);

  const showcaseClients =
    retouchClients.length > 0
      ? retouchClients
      : clients.slice(0, 3).map((c) => ({ client: c, alert: getFadeAlert(c) }));

  // Mantener referencia a openDrawers para contratos internos sin ensuciar la UI
  void openDrawers;

  // =========================================================================
  // MOTOR DE RESERVAS QR & EMPAREJAMIENTO AUTOMÁTICO CON TARJETAS 3D
  // =========================================================================
  const [qrAppointments, setQrAppointments] = useState([]);

  useEffect(() => {
    const state = loadLocalShopState(activeShopSlug);
    const todayIso = getShopLocalDateTime(activeShop, new Date()).isoDate;
    let list = Array.isArray(state.appointments) ? state.appointments : [];

    // Solo sembrar ejemplos demo en kutz-madrid; en joseh-barber y cualquier barbería real mostrar solo citas reales
    const demoSeededKey = `kutz_qr_demo_seeded_${activeShopSlug}_v1`;
    const isSeeded =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(demoSeededKey)
        : true;

    if (activeShopSlug === DEFAULT_SHOP_SLUG && list.length === 0 && !isSeeded) {
      const now = Date.now();
      list = [
        {
          id: `apt-demo-alex-${now}`,
          shopSlug: activeShopSlug,
          type: 'appointment',
          clientName: 'Álex Rivera',
          clientPhone: '+34 622 345 678',
          barberId: 'rex',
          barberName: 'REX',
          serviceId: 'skin-fade',
          serviceName: 'Skin Fade #000 + Navaja',
          price: 25,
          date: todayIso,
          timeSlot: '17:30',
          indicativeStyle: 'Lo mismo de siempre',
          status: 'pending',
          createdAt: now,
          holdExpiresAt: calculateHoldExpiration(now, 10),
        },
        {
          id: `apt-demo-marcos-${now + 1}`,
          shopSlug: activeShopSlug,
          type: 'appointment',
          clientName: 'Marcos Peña',
          clientPhone: '+34 644 890 123',
          barberId: 'kiko',
          barberName: 'KIKO',
          serviceId: 'taper-fade',
          serviceName: 'Low Taper + Barba',
          price: 32,
          date: todayIso,
          timeSlot: '18:00',
          indicativeStyle: 'Low Taper Fade #0.5',
          status: 'pending',
          createdAt: now,
          holdExpiresAt: calculateHoldExpiration(now, 10),
        },
      ];
      saveLocalShopState(activeShopSlug, { ...state, appointments: list });
      try {
        window.localStorage.setItem(demoSeededKey, '1');
      } catch {
        // ignore
      }
    }

    setQrAppointments(list);
  }, [activeShopSlug, activeShop, lastSyncTime]);

  // Cruzar teléfono de cada cita QR con las fichas de Clientes 3D para extraer su receta
  const enrichedAppointments = useMemo(() => {
    const cleanDigits = (p) => String(p || '').replace(/\D/g, '').slice(-9);

    return qrAppointments
      .filter((a) => a.status === 'pending' || a.status === 'confirmed' || a.status === 'expired')
      .map((apt) => {
        const aptDigits = cleanDigits(apt.clientPhone || apt.rawPhone);
        const matchedClient = clients.find((c) => {
          const cDigits = cleanDigits(c.phone);
          if (aptDigits && cDigits && aptDigits === cDigits) return true;
          return (
            String(c.name || '').toLowerCase().trim() ===
            String(apt.clientName || '').toLowerCase().trim()
          );
        });

        const latestFormula =
          matchedClient?.treatments?.[0]?.formula ||
          matchedClient?.formula ||
          '';
        const recipePills = latestFormula
          ? latestFormula
              .split(/\s*(?:→|\+|\/|,)\s*/)
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 4)
          : [];
        const activeBono = (matchedClient?.bonos || []).find(
          (b) => b.status === 'active' && b.usedSessions < b.totalSessions
        );

        return {
          ...apt,
          matchedClient,
          latestFormula,
          recipePills,
          activeBono,
        };
      });
  }, [qrAppointments, clients]);

  // Aprobar cita QR en 1 toque (y crear ficha nueva automáticamente si no era cliente)
  const handleApproveAppointment = async (apt) => {
    soundFx.playClick();
    soundFx.triggerHaptic(15);

    const res = await dispatchBarberAction(
      activeShopSlug,
      'approve',
      { appointmentId: apt.id },
      activeShop?.pin || '1234'
    );
    if (res?.data?.appointments) {
      setQrAppointments(res.data.appointments);
    } else {
      setQrAppointments((prev) =>
        prev.map((a) => (a.id === apt.id ? { ...a, status: 'confirmed' } : a))
      );
    }

    // Si es un cliente nuevo, crear su tarjeta 3D automáticamente con el estilo orientativo
    if (!apt.matchedClient && addClient) {
      addClient({
        name: apt.clientName,
        phone: apt.clientPhone,
        treatment: apt.serviceName || 'Skin Fade',
        notes: `Nuevo por QR · Estilo orientativo pedido: ${
          apt.indicativeStyle || 'Skin Fade'
        }`,
        treatments: [
          {
            id: Date.now(),
            name: apt.serviceName || 'Reserva QR',
            formula: apt.indicativeStyle || 'Pendiente de apuntar peines en primer corte',
            notes: 'Creado automáticamente al aceptar su reserva por QR.',
            date: new Date().toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }),
            timestamp: Date.now(),
          },
        ],
      });
      showToast(
        `✓ Cita de ${apt.clientName} aceptada y su nueva Tarjeta 3D creada.`
      );
    } else {
      showToast(`✓ Cita de ${apt.clientName} (${apt.timeSlot}) confirmada.`);
    }
  };

  // Ajustar duración manual de una cita en agenda (-15m / +15m)
  const handleAdjustAppointmentDuration = async (apt, deltaMinutes) => {
    soundFx.playClick();
    const currentDur = Number(apt.durationMinutes) || 60;
    const nextDur = Math.max(15, Math.min(180, currentDur + deltaMinutes));
    setQrAppointments((prev) =>
      prev.map((a) => (a.id === apt.id ? { ...a, durationMinutes: nextDur } : a))
    );
    await dispatchBarberAction(
      activeShopSlug,
      'update_duration',
      { appointmentId: apt.id, durationMinutes: nextDur },
      activeShop?.pin || '1234'
    );
    showToast(`⏱ Duración de ${apt.clientName} ajustada a ${nextDur} min`);
  };

  // Mover hora, estirar duración o editar cita en la Agenda Visual (estilo Booksy)
  const handleRescheduleAppointment = async (apt, updates) => {
    const nextTime = updates?.timeSlot || apt.timeSlot || apt.time;
    const nextDate = updates?.date || apt.date;
    const nextDur = Math.max(
      15,
      Math.min(240, Number(updates?.durationMinutes) || Number(apt.durationMinutes) || 60)
    );

    const patch = {
      ...updates,
      timeSlot: nextTime,
      time: nextTime,
      date: nextDate,
      durationMinutes: nextDur,
    };

    setQrAppointments((prev) =>
      prev.map((a) => (a.id === apt.id ? { ...a, ...patch } : a))
    );

    await dispatchBarberAction(
      activeShopSlug,
      'reschedule',
      {
        appointmentId: apt.id,
        ...patch,
      },
      activeShop?.pin || ''
    );
    showToast(`🕒 ${patch.clientName || apt.clientName} → ${nextTime} (${nextDur} min)`);
  };

  // Crear cita manual o bloqueo de descanso tocando una hora libre en la Agenda Visual
  const handleAddManualAppointment = async (newAptData) => {
    const now = Date.now();
    const defaultBarber = activeShop?.barbers?.[0];
    const created = {
      id: `apt-man-${now}-${Math.random().toString(36).slice(2, 5)}`,
      shopSlug: activeShopSlug,
      type: 'appointment',
      barberId: newAptData.barberId || defaultBarber?.id || 'any',
      barberName: newAptData.barberName || defaultBarber?.name || 'Barbero',
      ...newAptData,
      time: newAptData.timeSlot,
      createdAt: now,
    };

    setQrAppointments((prev) => [created, ...prev]);
    await dispatchBarberAction(
      activeShopSlug,
      'add_appointment',
      created,
      activeShop?.pin || ''
    );
    showToast(
      created.isBlock
        ? `🔒 Hora ${created.timeSlot} bloqueada (${created.durationMinutes}m)`
        : `✓ Cita de ${created.clientName} añadida a las ${created.timeSlot}`
    );
  };

  // Eliminar cita o bloqueo de descanso de la agenda en 1 toque
  const handleDeleteAppointment = async (apt) => {
    if (!apt?.id) return;
    soundFx.playClick();
    setQrAppointments((prev) => prev.filter((a) => String(a.id) !== String(apt.id)));
    await dispatchBarberAction(
      activeShopSlug,
      'delete_appointment',
      { appointmentId: apt.id },
      activeShop?.pin || ''
    );
    showToast(
      apt.isBlock
        ? `🗑️ Bloqueo de las ${apt.timeSlot || apt.time} eliminado`
        : `🗑️ Cita de ${apt.clientName} eliminada de la agenda`
    );
  };

  // Ajustar duración base de un servicio del catálogo manualmente
  const handleAdjustCatalogServiceDuration = async (serviceId, deltaMinutes) => {
    soundFx.playClick();
    if (!Array.isArray(activeShop?.services)) return;
    const updatedServices = activeShop.services.map((s) => {
      if (s.id !== serviceId) return s;
      const nextDur = Math.max(15, Math.min(240, (Number(s.durationMinutes) || 60) + deltaMinutes));
      return { ...s, durationMinutes: nextDur };
    });
    const state = loadLocalShopState(activeShopSlug);
    const nextConfig = { ...activeShop, services: updatedServices };
    saveLocalShopState(activeShopSlug, { ...state, config: nextConfig });
    await dispatchBarberAction(
      activeShopSlug,
      'update_shop_schedule',
      { services: updatedServices },
      activeShop?.pin || ''
    );
    if (updateShop) {
      await updateShop(activeShopSlug, { services: updatedServices }).catch(() => {});
    }
    showToast('⏱ Duración del servicio actualizada en la agenda');
  };

  // Enviar invitación bonita de Reseña Google por WhatsApp (dinámica para cualquier barbería)
  const handleSendGoogleReviewWhatsApp = (entry) => {
    soundFx.playClick();
    const shopTitle = activeShop?.name || 'Nuestra Barbería';
    const barberHandle =
      activeShop?.subtitle || activeShop?.barbers?.[0]?.name || shopTitle;
    const dynamicSearchQuery = `${shopTitle} ${activeShop?.address || ''}`.trim();
    const reviewLink =
      activeShop?.googleReviewUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dynamicSearchQuery)}`;
    const firstName = String(entry.clientName || 'crack').split(' ')[0];
    const msg = `¡Muchas gracias por tu visita hoy a *${shopTitle}*, ${firstName}! 💈✂️\nHa sido un placer atenderte con *${barberHandle}*.\nSi te ha gustado cómo quedó el corte, nos ayudarías muchísimo dejándonos una reseña de 5 estrellas en Google aquí 👇\n${reviewLink}\n¡Nos vemos en el próximo repaso! 🌟`;

    if (typeof window !== 'undefined') {
      window.open(
        buildWhatsAppUrl(entry.phone, msg),
        '_blank',
        'noopener,noreferrer'
      );
    }

    setReviewQueue((prev) => {
      const next = prev.map((r) => (r.id === entry.id ? { ...r, sent: true } : r));
      try {
        localStorage.setItem(
          `kutz_${activeShopSlug}_review_queue_v2`,
          JSON.stringify(next)
        );
      } catch {
        // ignore
      }
      return next;
    });
    showToast(`⭐ Invitación de reseña lista para ${entry.clientName}`);
  };

  // Rechazar / Proponer otra hora por WhatsApp en 1 toque
  const handleRejectAppointment = async (apt) => {
    soundFx.playClick();
    const res = await dispatchBarberAction(
      activeShopSlug,
      'reject',
      { appointmentId: apt.id, reason: 'Cambio de hora por WhatsApp' },
      activeShop?.pin || '1234'
    );
    if (res?.data?.appointments) {
      setQrAppointments(res.data.appointments);
    } else {
      setQrAppointments((prev) =>
        prev.map((a) => (a.id === apt.id ? { ...a, status: 'rejected' } : a))
      );
    }

    const digits = String(apt.clientPhone || '').replace(/\D/g, '');
    const waPhone = digits.length === 9 ? `34${digits}` : digits;
    if (waPhone.length >= 9 && typeof window !== 'undefined') {
      const msg = `¡Hola ${apt.clientName}! Te escribimos de ${
        activeShop?.name || 'KUTZ Barber'
      }. A las ${
        apt.timeSlot
      } tenemos el sillón a tope, ¿te viene bien media hora después? 💈`;
      window.open(
        `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`,
        '_blank',
        'noopener,noreferrer'
      );
    }
    showToast(`Hueco de las ${apt.timeSlot} liberado.`);
  };

  // Sentar cita QR confirmada directamente en un sillón libre
  const handleSeatAppointmentInChair = async (apt) => {
    soundFx.playClick();
    soundFx.triggerHaptic(15);

    const preferredChair =
      chairs.find(
        (c) =>
          c.status === 'WALKIN' &&
          c.barber.toLowerCase() === String(apt.barberName || '').toLowerCase()
      ) || chairs.find((c) => c.status === 'WALKIN');

    if (!preferredChair) {
      showToast('Termina primero un sillón libre para sentar al cliente.');
      return;
    }

    setChairs((prev) =>
      prev.map((ch) =>
        ch.id === preferredChair.id
          ? {
              ...ch,
              status: String(apt.serviceName || '')
                .toLowerCase()
                .includes('barba')
                ? 'BEARD'
                : 'CUTTING',
              clientId: apt.matchedClient?.id || null,
              clientName: apt.clientName,
              service: apt.serviceName || 'Skin Fade',
            }
          : ch
      )
    );

    const res = await dispatchBarberAction(
      activeShopSlug,
      'seat',
      { appointmentId: apt.id, chairId: preferredChair.id },
      activeShop?.pin || '1234'
    );
    if (res?.data?.appointments) {
      setQrAppointments(res.data.appointments);
    } else {
      setQrAppointments((prev) =>
        prev.map((a) => (a.id === apt.id ? { ...a, status: 'seated' } : a))
      );
    }

    showToast(`🪑 ¡${apt.clientName} sentado en ${preferredChair.id}!`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      <input
        type="file"
        accept=".json"
        ref={backupInputRef}
        className="hidden"
        onChange={handleImportBackup}
      />

      {/* Aviso flotante limpio */}
      {notice && (
        <div className="fixed top-16 right-4 sm:right-6 z-50 bg-[#141820] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#10B981] flex items-center space-x-2.5 animate-in slide-in-from-top-4">
          <CheckCircle2 size={17} className="text-[#10B981] shrink-0" />
          <span className="text-xs font-bold">{notice}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CABECERA CAÑERA & DIRECTA                                             */}
      {/* ===================================================================== */}
      <header className="luxury-card p-5 border-l-4 border-l-[#10B981] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-white tracking-tight uppercase">
              Salón Hoy
            </h1>
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-[#1B202B] border border-[#262C3A] text-[#34D399] font-bold">
              ✂️ {busyChairsCount}/{chairs.length} Sillones ocupados
            </span>
            <span
              className={`px-2.5 py-1 rounded-lg border font-bold ${
                walkInQueue.length > 0
                  ? 'bg-[#3B82F6]/20 border-[#3B82F6]/50 text-[#93C5FD]'
                  : 'bg-[#1B202B] border-[#262C3A] text-[#9CA3AF]'
              }`}
            >
              ⏳ {walkInQueue.length} Esperando
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#1B202B] border border-[#262C3A] text-[#E5E7EB] font-semibold">
              ✅ {completedToday} Cortes hoy
            </span>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setIsCashierOpen((v) => !v);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981] border border-[#10B981]/50 text-[#34D399] hover:text-[#07090C] font-black transition-all cursor-pointer flex items-center gap-1"
              title="Abrir Caja de Hoy y Reparto de Comisiones de Barberos"
            >
              <Wallet size={13} />
              <span>💰 Caja Hoy: {cashierSummary.grandTotal}€ (Comisiones)</span>
            </button>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              if (openQRPoster) openQRPoster();
              else navigate(`/r/${activeShopSlug}`);
            }}
            className="px-3.5 py-2.5 rounded-xl bg-[#10B981]/15 hover:bg-[#10B981]/25 border border-[#10B981]/60 text-[#34D399] text-xs font-extrabold uppercase flex items-center space-x-2 cursor-pointer transition-all"
            title="Ver cartel QR para que los clientes reserven con su móvil"
          >
            <QrCode size={16} />
            <span>Mi Cartel QR</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setIsAddingWalkIn((v) => !v);
            }}
            className="btn-author cursor-pointer"
          >
            <UserPlus size={16} />
            <span>+ Apuntar a la Cola</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              if (openKiosk) openKiosk();
            }}
            className="btn-author-secondary cursor-pointer"
            title="Poner cola en grande para la TV del local"
          >
            <Tv size={16} />
            <span>Pantalla TV</span>
          </button>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* PANEL DE CAJA DIARIA Y REPARTO DE COMISIONES DE BARBEROS (1 TOQUE)    */}
      {/* ===================================================================== */}
      {isCashierOpen && (
        <section className="luxury-card p-5 border-2 border-[#10B981] space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#252A36] pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#10B981] text-[#07090C] flex items-center justify-center font-black shrink-0">
                <Wallet size={20} />
              </div>
              <div>
                <h2 className="text-base font-serif font-black uppercase text-white">
                  Cierre de Caja y Comisiones del Equipo
                </h2>
                <p className="text-xs text-[#9CA3AF]">
                  Calculado al segundo sin calculadora · Efectivo, Bizum y reparto por barbero
                </p>
              </div>
            </div>

            {/* Selector de porcentaje de comisión */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-[#9CA3AF] mr-1">
                Reparto Barbero/Local:
              </span>
              {[
                { rate: 50, label: '50% / 50%' },
                { rate: 60, label: '60% / 40%' },
                { rate: 40, label: '40% / 60%' },
              ].map((opt) => (
                <button
                  key={opt.rate}
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setCommissionRate(opt.rate);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                    commissionRate === opt.rate
                      ? 'bg-[#10B981] text-[#07090C] border-[#34D399]'
                      : 'bg-[#141820] text-[#D1D5DB] border-[#252A36]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCashierOpen(false)}
                className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-white cursor-pointer ml-1"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 4 Indicadores Clave del Bolsillo del Dueño */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0A0C0F] border border-[#252A36]">
              <span className="text-[11px] font-bold text-[#9CA3AF] uppercase block">
                Total Caja Hoy
              </span>
              <span className="text-2xl font-mono font-black text-white mt-0.5 block">
                {cashierSummary.grandTotal}€
              </span>
              <span className="text-[10px] text-[#34D399]">
                🧴 Incluye {cashierSummary.totalProducts}€ en productos
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0A0C0F] border border-[#252A36]">
              <span className="text-[11px] font-bold text-[#9CA3AF] uppercase block">
                💵 Efectivo / 📱 Bizum
              </span>
              <span className="text-lg font-mono font-black text-white mt-1 block">
                {cashierSummary.cashTotal}€ / {cashierSummary.bizumTotal}€
              </span>
              <span className="text-[10px] text-[#9CA3AF]">
                Arqueo exacto de cajón
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0A0C0F] border border-[#F59E0B]/40">
              <span className="text-[11px] font-bold text-[#FCD34D] uppercase block">
                A Pagar a Barberos ({commissionRate}%)
              </span>
              <span className="text-2xl font-mono font-black text-[#FBBF24] mt-0.5 block">
                {cashierSummary.totalBarberPayouts}€
              </span>
              <span className="text-[10px] text-[#9CA3AF]">
                +20% comisión productos
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/60">
              <span className="text-[11px] font-black text-[#34D399] uppercase block">
                Beneficio Limpio Local
              </span>
              <span className="text-2xl font-mono font-black text-[#34D399] mt-0.5 block">
                {cashierSummary.totalShopNet}€
              </span>
              <span className="text-[10px] text-white font-semibold">
                Libre para la barbería hoy
              </span>
            </div>
          </div>

          {/* Desglose Individual por Sillón / Barbero */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {cashierSummary.barberRows.map((row) => (
              <div
                key={row.name}
                className="p-3.5 rounded-xl bg-[#141820] border border-[#252A36] flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-serif font-black text-white uppercase block">
                    ✂️ {row.name} ({row.cuts} cortes)
                  </span>
                  <span className="text-xs text-[#9CA3AF]">
                    Facturado: <strong className="text-white">{row.totalGenerated}€</strong>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-[#FCD34D] block">
                    Su Comisión Hoy
                  </span>
                  <span className="text-base font-mono font-black text-[#34D399]">
                    {row.barberPayout}€
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Botón Enviar Resumen al Dueño por WhatsApp */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                const lines = cashierSummary.barberRows
                  .map(
                    (r) =>
                      `• ${r.name}: ${r.cuts} cortes (${r.totalGenerated}€) -> Comisión: ${r.barberPayout}€`
                  )
                  .join('\n');
                const msg = `📊 *CIERRE DE CAJA KUTZ BARBER*\n💰 *Total Hoy:* ${cashierSummary.grandTotal}€ (💵 Efectivo: ${cashierSummary.cashTotal}€ | 📱 Bizum/Tarjeta: ${cashierSummary.bizumTotal}€)\n\n*Liquidación Barberos (${commissionRate}%):*\n${lines}\n\n✅ *Beneficio Limpio Barbería:* ${cashierSummary.totalShopNet}€`;
                const phone = String(activeShop?.phone || '600123456').replace(
                  /\D/g,
                  ''
                );
                const wa = phone.length === 9 ? `34${phone}` : phone;
                window.open(
                  `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`,
                  '_blank',
                  'noopener,noreferrer'
                );
              }}
              className="px-4 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-xs font-black uppercase flex items-center gap-2 cursor-pointer shadow-md"
            >
              <MessageSquare size={15} />
              <span>📲 Enviar Cierre de Caja al Móvil del Dueño</span>
            </button>
          </div>
        </section>


      )}
      <section className="luxury-card p-5 border border-[#10B981]/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#252A36] pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] flex items-center justify-center shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="text-sm font-serif font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>Reservas por QR y Citas de Hoy</span>
                <span className="px-2 py-0.5 rounded-full bg-[#10B981] text-[#07090C] text-[10px] font-black">
                  {enrichedAppointments.length}
                </span>
              </h2>
              <p className="text-[11px] text-[#9CA3AF]">
                Cuando el cliente reserva con el QR, aquí te sale su hora y su receta de peines conectada automáticamente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Switcher Agenda Visual Táctil (Booksy) vs Tarjetas */}
            <div className="inline-flex p-0.5 rounded-lg bg-[#0A0C0F] border border-[#252A36]">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setAgendaViewMode('timeline');
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-black transition-all cursor-pointer ${
                  agendaViewMode === 'timeline'
                    ? 'bg-[#10B981] text-[#07090C]'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                📅 Agenda Táctil
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setAgendaViewMode('cards');
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  agendaViewMode === 'cards'
                    ? 'bg-[#10B981] text-[#07090C]'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                📋 Tarjetas
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setIsScheduleEditorOpen((v) => !v);
              }}
              className="px-2.5 py-1.5 min-h-[36px] rounded-lg bg-[#141820] hover:bg-[#1B202B] border border-[#10B981]/50 text-[11px] font-bold text-[#34D399] cursor-pointer"
            >
              🕒 Horario apertura
            </button>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setIsServiceDurationsOpen((v) => !v);
              }}
              className="px-2.5 py-1.5 min-h-[36px] rounded-lg bg-[#141820] hover:bg-[#1B202B] border border-[#10B981]/40 text-[11px] font-bold text-[#34D399] cursor-pointer"
            >
              ⏱ Tiempos servicios
            </button>
            {forceSyncNow && (
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  forceSyncNow();
                  showToast('🔄 Sincronizando reservas QR en vivo...');
                }}
                className="px-2.5 py-1.5 min-h-[36px] rounded-lg bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-[11px] font-bold text-[#D1D5DB] cursor-pointer"
              >
                🔄 Actualizar ahora
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                navigate(`/r/${activeShopSlug}`);
              }}
              className="text-xs font-bold text-[#34D399] hover:text-white flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <span>Abrir web de reservas (/r/{activeShopSlug})</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* EDITOR TÁCTIL DE HORARIO DE APERTURA POR DÍA (LUNES A DOMINGO) */}
        {isScheduleEditorOpen && (
          <div className="p-4 rounded-xl bg-[#0A0C0F] border-2 border-[#10B981] space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-2.5">
              <div>
                <span className="text-xs font-black uppercase text-[#34D399] block">
                  🕒 Configurar Horario de Apertura por Día ({activeShop?.name || activeShopSlug})
                </span>
                <span className="text-[11px] text-[#9CA3AF]">
                  Toca para abrir/cerrar días o cambiar la hora de apertura y cierre con 1 dedo
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleEditorOpen(false)}
                className="px-2.5 py-1.5 min-h-[36px] rounded-lg bg-[#141820] text-xs text-[#9CA3AF] hover:text-white cursor-pointer"
              >
                Cerrar ✕
              </button>
            </div>

            <div className="space-y-2">
              {DAY_LABELS_ORDER.map((dayItem) => {
                const isDayOpen = draftSchedule.workDays.includes(dayItem.dow);
                const dayCfg = draftSchedule.hoursByDay[dayItem.dow] || {
                  openTime: '10:00',
                  closeTime: '18:00',
                };
                return (
                  <div
                    key={dayItem.dow}
                    className="p-2.5 rounded-xl bg-[#141820] border border-[#252A36] flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <button
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setDraftSchedule((prev) => {
                            const exists = prev.workDays.includes(dayItem.dow);
                            const nextDays = exists
                              ? prev.workDays.filter((d) => d !== dayItem.dow)
                              : [...prev.workDays, dayItem.dow];
                            return { ...prev, workDays: nextDays };
                          });
                        }}
                        className={`px-3 py-2 min-h-[40px] rounded-lg text-xs font-black border transition-all cursor-pointer ${
                          isDayOpen
                            ? 'bg-[#10B981]/20 border-[#10B981] text-[#34D399]'
                            : 'bg-[#0A0C0F] border-[#252A36] text-[#9CA3AF]'
                        }`}
                      >
                        {isDayOpen ? '🟢 Abierto' : '🔒 Cerrado'}
                      </button>
                      <span className="text-xs font-bold text-white">{dayItem.name}</span>
                    </div>

                    {isDayOpen ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={dayCfg.openTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftSchedule((prev) => ({
                              ...prev,
                              hoursByDay: {
                                ...prev.hoursByDay,
                                [dayItem.dow]: {
                                  ...(prev.hoursByDay[dayItem.dow] || {}),
                                  openTime: val,
                                },
                              },
                            }));
                          }}
                          className="px-2.5 py-2 min-h-[40px] rounded-lg bg-[#0A0C0F] border border-[#252A36] text-xs font-mono font-bold text-white"
                        >
                          {SCHEDULE_TIME_OPTIONS.map((t) => (
                            <option key={`open-${dayItem.dow}-${t}`} value={t}>
                              Abre {t}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-[#9CA3AF]">a</span>
                        <select
                          value={dayCfg.closeTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftSchedule((prev) => ({
                              ...prev,
                              hoursByDay: {
                                ...prev.hoursByDay,
                                [dayItem.dow]: {
                                  ...(prev.hoursByDay[dayItem.dow] || {}),
                                  closeTime: val,
                                },
                              },
                            }));
                          }}
                          className="px-2.5 py-2 min-h-[40px] rounded-lg bg-[#0A0C0F] border border-[#252A36] text-xs font-mono font-bold text-white"
                        >
                          {SCHEDULE_TIME_OPTIONS.map((t) => (
                            <option key={`close-${dayItem.dow}-${t}`} value={t}>
                              Cierra {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-[#6B7280] px-2">
                        Descanso semanal (no admite reservas QR)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#252A36]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#9CA3AF]">Frecuencia de citas en QR:</span>
                {[30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setDraftSchedule((prev) => ({ ...prev, slotMinutes: mins }));
                    }}
                    className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-black border cursor-pointer ${
                      Number(draftSchedule.slotMinutes) === mins
                        ? 'bg-[#10B981] text-[#07090C] border-[#34D399]'
                        : 'bg-[#141820] text-[#D1D5DB] border-[#252A36]'
                    }`}
                  >
                    Cada {mins}m
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleSaveShopSchedule}
                className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-xs font-black uppercase cursor-pointer shadow-md"
              >
                ✓ Guardar Horario de la Barbería
              </button>
            </div>
          </div>
        )}

        {isServiceDurationsOpen && Array.isArray(activeShop?.services) && (
          <div className="p-4 rounded-xl bg-[#0A0C0F] border border-[#10B981]/40 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-[#34D399]">
                ⏱ Recortar o Alargar Duración Manual de Servicios (Agenda)
              </span>
              <button
                type="button"
                onClick={() => setIsServiceDurationsOpen(false)}
                className="text-xs text-[#9CA3AF] hover:text-white cursor-pointer"
              >
                Cerrar ✕
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {activeShop.services.map((srv) => (
                <div
                  key={srv.id}
                  className="p-2.5 rounded-lg bg-[#141820] border border-[#252A36] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{srv.name}</p>
                    <p className="text-[10px] text-[#9CA3AF] font-mono">
                      {srv.durationMinutes || 60} min · {srv.priceLabel || `${srv.price}€`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAdjustCatalogServiceDuration(srv.id, -15)}
                      className="px-2 py-1 rounded bg-[#1B202B] hover:bg-[#252A36] border border-[#262C3A] text-[10px] font-black text-white cursor-pointer"
                    >
                      -15m
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustCatalogServiceDuration(srv.id, 15)}
                      className="px-2 py-1 rounded bg-[#10B981]/20 hover:bg-[#10B981] border border-[#10B981]/50 text-[10px] font-black text-[#34D399] hover:text-[#07090C] cursor-pointer"
                    >
                      +15m
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {needsPinSync && (
          <div className="p-3.5 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/50 text-xs text-[#FCD34D] font-bold">
            🔒 Introduce el PIN de 4 dígitos de {activeShop?.name || activeShopSlug} para descargar sus reservas QR en vivo.
          </div>
        )}

        {agendaViewMode === 'timeline' ? (
          <VisualAgendaTimeline
            appointments={enrichedAppointments}
            services={activeShop?.services || []}
            barberId={activeShop?.barbers?.[0]?.id || 'joseh'}
            barberName={activeShop?.barbers?.[0]?.name || 'José'}
            schedule={activeShop?.schedule || {}}
            shop={activeShop}
            onReschedule={handleRescheduleAppointment}
            onApprove={handleApproveAppointment}
            onSeat={handleSeatAppointmentInChair}
            onOpenClient={(clientId) => navigate(`/clients/${clientId}`)}
            onAddManual={handleAddManualAppointment}
            onDelete={handleDeleteAppointment}
            onOpenScheduleEditor={() => setIsScheduleEditorOpen((v) => !v)}
          />
        ) : enrichedAppointments.length === 0 ? (
          <div className="py-4 text-center text-xs text-[#9CA3AF]">
            No hay solicitudes pendientes del QR ahora mismo. Enseña tu{' '}
            <button
              type="button"
              onClick={() => openQRPoster && openQRPoster()}
              className="text-[#34D399] font-bold underline cursor-pointer"
            >
              Cartel QR
            </button>{' '}
            para recibir citas en directo.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrichedAppointments.map((apt) => {
              const isPending = apt.status === 'pending' || apt.status === 'expired';
              const matched = apt.matchedClient;

              return (
                <div
                  key={apt.id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                    isPending
                      ? 'bg-[#141820]/95 border-[#F59E0B]/60 shadow-[0_4px_20px_rgba(245,158,11,0.1)]'
                      : 'bg-[#101318]/95 border-[#10B981]/60'
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Cabecera de la cita: Hora + Estado + Barbero */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-[#0A0C0F] border border-[#252A36] font-mono text-xs font-black text-[#34D399]">
                          🕒 {apt.timeSlot || apt.time} · {apt.durationMinutes || 60}m
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAdjustAppointmentDuration(apt, -15)}
                            className="px-1.5 py-0.5 rounded bg-[#1B202B] hover:bg-[#252A36] border border-[#262C3A] text-[10px] font-bold text-[#D1D5DB] cursor-pointer"
                            title="Recortar 15 min a esta cita"
                          >
                            -15m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustAppointmentDuration(apt, 15)}
                            className="px-1.5 py-0.5 rounded bg-[#1B202B] hover:bg-[#10B981]/30 border border-[#262C3A] text-[10px] font-bold text-[#34D399] cursor-pointer"
                            title="Alargar 15 min a esta cita"
                          >
                            +15m
                          </button>
                        </div>
                        <span className="text-xs font-bold text-[#D1D5DB]">
                          Con{' '}
                          <strong className="text-white uppercase">
                            {apt.barberName || apt.barberId || 'Cualquiera'}
                          </strong>
                        </span>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          isPending
                            ? 'bg-[#F59E0B]/20 text-[#FCD34D] border border-[#F59E0B]/50'
                            : 'bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/50'
                        }`}
                      >
                        {isPending ? '⏳ Pendiente aprobar' : '✓ Confirmada'}
                      </span>
                    </div>

                    {/* Datos del cliente + Insignia de emparejamiento 3D */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-serif font-black text-white uppercase leading-tight">
                          {apt.clientName}
                        </h3>
                        <p className="text-xs text-[#34D399] font-semibold mt-0.5">
                          ✂️ {apt.serviceName || 'Skin Fade'}{' '}
                          {apt.price ? `(${apt.price}€)` : ''}
                        </p>
                      </div>

                      {matched ? (
                        <button
                          type="button"
                          onClick={() => {
                            soundFx.playClick();
                            navigate(`/clients/${matched.id}`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#10B981]/15 hover:bg-[#10B981] text-[#34D399] hover:text-[#07090C] border border-[#10B981]/40 text-[10px] font-black uppercase transition-all cursor-pointer shrink-0"
                        >
                          ★ Ficha 3D Conectada →
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/40 text-[#93C5FD] text-[10px] font-bold uppercase shrink-0">
                          ✨ Cliente Nuevo (QR)
                        </span>
                      )}
                    </div>

                    {/* CAJA DE RECETA AUTOMÁTICA (La magia para el barbero) */}
                    {matched ? (
                      <div className="p-3 rounded-xl bg-[#0A0C0F] border border-[#252A36] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#9CA3AF]">
                            Receta exacta de sus peines:
                          </span>
                          {apt.activeBono && (
                            <span className="text-[10px] font-bold text-[#34D399]">
                              🎟️ Bono VIP ({apt.activeBono.usedSessions}/
                              {apt.activeBono.totalSessions})
                            </span>
                          )}
                        </div>

                        {apt.recipePills.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {apt.recipePills.map((step, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-[#141820] border border-[#10B981]/40 text-[11px] font-mono font-bold text-white"
                              >
                                {step}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-[#D1D5DB]">
                            {apt.latestFormula || 'Corte habitual en su ficha'}
                          </p>
                        )}

                        {matched.notes && (
                          <p className="text-[11px] text-[#FCD34D] flex items-center gap-1 pt-0.5">
                            <AlertTriangle size={12} className="shrink-0" />
                            <span className="truncate">{matched.notes}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-[#0A0C0F] border border-[#252A36] text-xs text-[#D1D5DB]">
                        <span className="text-[#9CA3AF] font-semibold">
                          Estilo orientativo pedido en el QR:{' '}
                        </span>
                        <strong className="text-[#34D399]">
                          {apt.indicativeStyle || 'Skin Fade #000'}
                        </strong>
                        <span className="block text-[10px] text-[#9CA3AF] mt-1">
                          Al aceptar, se creará su Tarjeta 3D automáticamente para guardar sus peines hoy.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Botones de Acción en 1 Toque */}
                  <div className="pt-2 border-t border-[#252A36] flex items-center gap-2">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApproveAppointment(apt)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-xs font-black uppercase flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                        >
                          <CheckCircle2 size={15} />
                          <span>✓ Aceptar Cita</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRejectAppointment(apt)}
                          className="py-2.5 px-3 rounded-xl bg-[#1B202B] hover:bg-[#EF4444]/20 border border-[#262C3A] hover:border-[#EF4444]/50 text-[#D1D5DB] hover:text-[#FCA5A5] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                          title="Liberar hueco y proponer otra hora por WhatsApp"
                        >
                          <X size={14} />
                          <span>Cambiar Hora</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSeatAppointmentInChair(apt)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-[#3B82F6] hover:bg-[#60A5FA] text-[#07090C] text-xs font-black uppercase flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                        >
                          <UserCheck size={15} />
                          <span>Pasar al Sillón</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            soundFx.playClick();
                            const digits = String(apt.clientPhone || '').replace(
                              /\D/g,
                              ''
                            );
                            const wa =
                              digits.length === 9 ? `34${digits}` : digits;
                            if (wa.length >= 9) {
                              const msg = `¡Hola ${apt.clientName}! Te confirmamos tu cita hoy a las ${apt.timeSlot} en ${
                                activeShop?.name || 'KUTZ Barber'
                              }. ¡Te esperamos! 💈`;
                              window.open(
                                `https://wa.me/${wa}?text=${encodeURIComponent(
                                  msg
                                )}`,
                                '_blank',
                                'noopener,noreferrer'
                              );
                            }
                          }}
                          className="py-2.5 px-3 rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#262C3A] text-[#34D399] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <MessageSquare size={14} />
                          <span>WhatsApp</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteAppointment(apt)}
                          className="p-2.5 rounded-xl bg-[#141820] hover:bg-[#EF4444]/20 border border-[#262C3A] hover:border-[#EF4444]/50 text-[#9CA3AF] hover:text-[#FCA5A5] text-xs font-bold flex items-center justify-center cursor-pointer"
                          title="Eliminar cita de la agenda"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>



      {/* ===================================================================== */}
      {/* MENSAJE AUTOMÁTICO DE RESEÑAS GOOGLE (30 MIN DESPUÉS DEL SERVICIO)     */}
      {/* ===================================================================== */}
      {reviewQueue.length > 0 && (
        <section className="luxury-card p-4 border border-[#F59E0B]/40 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-[#F59E0B] fill-[#F59E0B]" />
              <h2 className="text-xs sm:text-sm font-serif font-black uppercase tracking-wider text-white">
                Reseñas Google Automáticas (30 min post-corte)
              </h2>
            </div>
            <span className="text-[11px] text-[#9CA3AF]">
              Envía en 1 toque el enlace 5⭐ tras atenderles
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {reviewQueue.slice(0, 3).map((entry) => {
              const isReady = Date.now() >= (entry.sendAfter || 0);
              const minsLeft = Math.max(
                1,
                Math.ceil(((entry.sendAfter || 0) - Date.now()) / 60000)
              );
              return (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl bg-[#0A0C0F]/90 border border-[#252A36] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {entry.clientName}
                    </p>
                    <p className="text-[10px] text-[#9CA3AF] truncate">
                      {entry.service}
                    </p>
                    <span
                      className={`text-[10px] font-bold block mt-0.5 ${
                        entry.sent
                          ? 'text-[#34D399]'
                          : isReady
                          ? 'text-[#FCD34D]'
                          : 'text-[#93C5FD]'
                      }`}
                    >
                      {entry.sent
                        ? '✓ Reseña enviada'
                        : isReady
                        ? '🟢 Listo (+30m cumplidos)'
                        : `⏳ Aviso en ${minsLeft} min`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendGoogleReviewWhatsApp(entry)}
                    className={`px-2.5 py-2 rounded-lg text-[11px] font-black shrink-0 cursor-pointer transition-all ${
                      entry.sent
                        ? 'bg-[#141820] border border-[#262C3A] text-[#9CA3AF]'
                        : 'bg-[#F59E0B] hover:bg-[#FBBF24] text-[#07090C]'
                    }`}
                  >
                    ⭐ Pedir 5★
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* FORMULARIO RÁPIDO PARA APUNTAR A ALGUIEN EN 3 SEGUNDOS */}
      {isAddingWalkIn && (
        <form
          onSubmit={handleAddWalkInSubmit}
          className="luxury-card p-5 border border-[#10B981]/60 space-y-4 animate-in fade-in"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-serif font-bold text-white uppercase">
              Apuntar cliente sin cita
            </h3>
            <button
              type="button"
              onClick={() => setIsAddingWalkIn(false)}
              className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              autoFocus
              placeholder="Nombre del cliente (ej. Marcos)..."
              value={walkInForm.name}
              onChange={(e) =>
                setWalkInForm({ ...walkInForm, name: e.target.value })
              }
              className="w-full px-3.5 py-2.5 bg-[#0A0C0F] border border-[#262C3A] rounded-xl text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
            />
            <input
              type="tel"
              placeholder="Móvil WhatsApp (opcional)..."
              value={walkInForm.phone}
              onChange={(e) =>
                setWalkInForm({ ...walkInForm, phone: e.target.value })
              }
              className="w-full px-3.5 py-2.5 bg-[#0A0C0F] border border-[#262C3A] rounded-xl text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
            />
          </div>

          {/* Pastillas de servicio en 1 toque */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#9CA3AF] block">
              ¿Qué se hace? (Toca una opción):
            </span>
            <div className="flex flex-wrap gap-2">
              {shopQuickServices.map((srv) => (
                <button
                  key={srv}
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setWalkInForm({ ...walkInForm, service: srv });
                  }}
                  className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    walkInForm.service === srv
                      ? 'bg-[#10B981] text-[#07090C] border-[#34D399]'
                      : 'bg-[#141820] text-[#D1D5DB] border-[#262C3A] hover:border-[#10B981]/50'
                  }`}
                >
                  {srv}
                </button>
              ))}
            </div>
          </div>

          {/* Barbero preferido */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-xs font-semibold text-[#9CA3AF] mr-1">
                Barbero:
              </span>
              {shopBarbersList.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setWalkInForm({ ...walkInForm, barber: b })}
                  className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-bold border cursor-pointer ${
                    walkInForm.barber === b
                      ? 'bg-white text-[#07090C] border-white'
                      : 'bg-[#141820] text-[#9CA3AF] border-[#262C3A]'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            <button type="submit" className="btn-author cursor-pointer">
              ✓ Apuntar a la Cola
            </button>
          </div>
        </form>
      )}

      {/* ===================================================================== */}
      {/* ZONA PRINCIPAL: SILLONES EN DIRECTO + COLA DE ESPERA                  */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SILLONES DEL SALÓN (8 columnas) */}
        <section className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-serif font-bold uppercase tracking-wider text-white flex items-center space-x-2">
              <Scissors size={16} className="text-[#10B981]" />
              <span>Tus Sillones Ahora</span>
            </h2>
            <span className="text-xs text-[#9CA3AF]">
              Control directo en 1 toque
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {chairs.map((chair) => {
              const st = CHAIR_STATES[chair.status] || CHAIR_STATES.WALKIN;
              const isFree = chair.status === 'WALKIN';
              const isPickingThis = pickingForChairId === chair.id;

              return (
                <div
                  key={chair.id}
                  className={`luxury-card p-5 flex flex-col justify-between border-t-4 min-h-[245px] ${st.borderTop}`}
                >
                  {/* Cabecera del sillón */}
                  <div>
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#252A36]">
                      <div>
                        <span className="text-[11px] font-bold text-[#9CA3AF] uppercase block">
                          {chair.id} · {chair.specialty}
                        </span>
                        <h3 className="text-lg font-serif font-black text-white uppercase leading-tight">
                          {chair.barber}
                        </h3>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center space-x-1.5 shrink-0 ${st.badgeClass}`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${st.dotClass}`}
                        ></span>
                        <span>{st.label}</span>
                      </span>
                    </div>

                    {/* Contenido según Libre o Cortando */}
                    {isFree ? (
                      isPickingThis ? (
                        <div className="mt-3 space-y-2 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#60A5FA]">
                              ¿Quién se sienta?
                            </span>
                            <button
                              type="button"
                              onClick={() => setPickingForChairId(null)}
                              className="text-xs text-[#9CA3AF] hover:text-white cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>

                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              placeholder="Nombre rápido..."
                              value={quickClientName}
                              onChange={(e) => setQuickClientName(e.target.value)}
                              className="flex-1 min-w-0 px-2.5 py-1.5 bg-[#0A0C0F] border border-[#262C3A] rounded-lg text-xs text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (quickClientName.trim()) {
                                  handleManualSeat(chair.id, {
                                    name: quickClientName.trim(),
                                  });
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#10B981] text-[#07090C] text-xs font-bold cursor-pointer shrink-0"
                            >
                              Sentar
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1 pt-1">
                            {clients.slice(0, 3).map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleManualSeat(chair.id, c)}
                                className="px-2 py-1 rounded-md bg-[#141820] hover:bg-[#10B981] hover:text-[#07090C] border border-[#262C3A] text-[11px] font-semibold text-[#E5E7EB] transition-colors cursor-pointer truncate max-w-full"
                              >
                                {c.name.split(' ')[0]}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-5 text-center space-y-1.5 py-2">
                          <p className="text-sm font-bold text-[#93C5FD]">
                            Sillón disponible
                          </p>
                          <p className="text-xs text-[#9CA3AF]">
                            Listo para el próximo corte
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="mt-3.5 space-y-2">
                        <div>
                          <span className="text-[11px] text-[#9CA3AF] block">
                            En el sillón:
                          </span>
                          <p className="text-base font-serif font-bold text-white truncate">
                            {chair.clientName}
                          </p>
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-[#0A0C0F]/90 border border-[#252A36] text-xs font-semibold text-[#34D399] truncate">
                          ✂️ {chair.service}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botones de Acción Claros */}
                  <div className="mt-4 pt-3 border-t border-[#252A36]">
                    {isFree ? (
                      !isPickingThis && (
                        <button
                          type="button"
                          onClick={() => handleSeatNextInChair(chair.id)}
                          className="w-full py-2.5 px-3 rounded-xl bg-[#3B82F6] hover:bg-[#60A5FA] text-[#07090C] text-xs font-black uppercase flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-md"
                        >
                          <UserCheck size={15} />
                          <span>
                            {walkInQueue.length > 0
                              ? `Sentar a ${walkInQueue[0].name.split(' ')[0]}`
                              : '+ Sentar cliente'}
                          </span>
                        </button>
                      )
                    ) : (
                      <div className="space-y-2">
                        {/* Venta cruzada en 1 toque: Bote de Polvo Mate / Cera (+12€) */}
                        <button
                          type="button"
                          onClick={() => {
                            soundFx.playClick();
                            setChairProductAddon((prev) => ({
                              ...prev,
                              [chair.id]: !prev[chair.id],
                            }));
                          }}
                          className={`w-full py-1.5 px-2.5 rounded-lg border text-[11px] font-bold flex items-center justify-between transition-all cursor-pointer ${
                            chairProductAddon[chair.id]
                              ? 'bg-[#F59E0B]/20 border-[#F59E0B] text-[#FCD34D]'
                              : 'bg-[#141820] border-[#252A36] text-[#9CA3AF] hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            <ShoppingBag size={12} />
                            <span>+ Polvo Mate / Cera</span>
                          </span>
                          <span className="font-mono font-black">
                            {chairProductAddon[chair.id] ? '✓ +12€' : '+12€'}
                          </span>
                        </button>

                        {/* Cobro y cierre en 1 toque: Efectivo o Bizum/Tarjeta */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleFinishChair(chair.id, 'cash')}
                            className="btn-author !py-2.5 !px-2 text-[11px] cursor-pointer"
                            title="Cobrar en efectivo, sumar comisión y liberar sillón"
                          >
                            <Banknote size={14} />
                            <span>Terminar corte</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleFinishChair(chair.id, 'bizum')}
                            className="py-2.5 px-2 rounded-xl bg-[#141820] hover:bg-[#10B981] text-[#34D399] hover:text-[#07090C] border border-[#10B981]/50 text-[11px] font-black uppercase flex items-center justify-center gap-1 transition-all cursor-pointer"
                            title="Cobrar por Bizum o Tarjeta, sumar comisión y liberar sillón"
                          >
                            <CreditCard size={14} />
                            <span>📱 Bizum / Tarj.</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] px-0.5">
                          <button
                            type="button"
                            onClick={() => handleToggleChairType(chair.id)}
                            className="text-[#9CA3AF] hover:text-white cursor-pointer"
                          >
                            {chair.status === 'BEARD'
                              ? 'Pasar a Corte'
                              : 'Cambiar a Barba'}
                          </button>

                          {chair.clientId && (
                            <button
                              type="button"
                              onClick={() => {
                                soundFx.playClick();
                                navigate(`/clients/${chair.clientId}`);
                              }}
                              className="text-[#34D399] hover:underline font-bold cursor-pointer"
                            >
                              Ver su ficha →
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>



        {/* COLA DE ESPERA EN TIENDA (4 columnas) */}
        <section className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-serif font-bold uppercase tracking-wider text-white flex items-center space-x-2">
              <Clock size={16} className="text-[#60A5FA]" />
              <span>En Espera</span>
            </h2>

            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setIsAddingWalkIn((v) => !v);
              }}
              className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#141820] hover:bg-[#1B202B] border border-[#262C3A] text-[#34D399] flex items-center space-x-1 cursor-pointer"
            >
              <Plus size={13} />
              <span>Apuntar</span>
            </button>
          </div>

          <div className="luxury-card p-4 space-y-3">
            {walkInQueue.length === 0 ? (
              <div className="py-8 px-4 text-center space-y-2">
                <p className="text-sm font-bold text-[#34D399]">
                  💈 No hay nadie esperando
                </p>
                <p className="text-xs text-[#9CA3AF]">
                  Cuando entre alguien sin cita, apúntalo arriba en 2 segundos.
                </p>
              </div>
            ) : (
              <>
                {/* Siguiente en pasar */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-[#192234] to-[#111622] border border-[#3B82F6]/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-[#3B82F6] text-[#07090C] uppercase">
                      Siguiente
                    </span>
                    <span className="text-xs font-bold text-[#93C5FD]">
                      ~{walkInQueue[0].waitMinutes || 15} min
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-serif font-black text-white uppercase truncate">
                      {walkInQueue[0].name}
                    </h3>
                    <p className="text-xs text-[#D1D5DB] truncate mt-0.5">
                      {walkInQueue[0].service || 'Skin Fade'} · Con{' '}
                      <strong className="text-white">
                        {walkInQueue[0].barber || 'Cualquiera'}
                      </strong>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSeatNextInChair(null)}
                      disabled={!freeChairExists}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                        freeChairExists
                          ? 'bg-[#10B981] hover:bg-[#34D399] text-[#07090C]'
                          : 'bg-[#1B202B] text-[#6B7280] cursor-not-allowed'
                      }`}
                    >
                      <UserCheck size={14} />
                      <span>Pasar al sillón</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        if (notifyWalkInWhatsApp) {
                          notifyWalkInWhatsApp(walkInQueue[0].id);
                        }
                        showToast(
                          `💬 WhatsApp enviado a ${walkInQueue[0].name}`
                        );
                      }}
                      className="py-2.5 px-2 rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#262C3A] text-white text-xs font-bold flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <MessageSquare size={14} className="text-[#10B981]" />
                      <span>Avisar</span>
                    </button>
                  </div>
                </div>

                {/* Demás clientes esperando */}
                {walkInQueue.length > 1 && (
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-semibold text-[#9CA3AF] block px-1">
                      Detrás en la cola ({walkInQueue.length - 1}):
                    </span>
                    {walkInQueue.slice(1).map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl bg-[#0E1117]/90 border border-[#252A36] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            <span className="text-[#60A5FA] mr-1.5">
                              #{idx + 2}
                            </span>
                            {item.name}
                          </p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">
                            {item.service} · ~{item.waitMinutes || 20}m
                          </p>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              soundFx.playClick();
                              if (notifyWalkInWhatsApp) {
                                notifyWalkInWhatsApp(item.id);
                              }
                              showToast(`💬 Aviso enviado a ${item.name}`);
                            }}
                            className="p-2 rounded-lg bg-[#10B981]/15 text-[#34D399] hover:bg-[#10B981] hover:text-[#07090C] cursor-pointer"
                            title="Avisar por WhatsApp"
                          >
                            <MessageSquare size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              soundFx.playClick();
                              if (removeWalkIn) removeWalkIn(item.id);
                            }}
                            className="p-2 rounded-lg text-[#9CA3AF] hover:text-[#EF4444] cursor-pointer"
                            title="Quitar de la cola"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>


      </div>

      {/* ===================================================================== */}
      {/* AVISOS RÁPIDOS DE REPASO (SIN SATURAR LA PANTALLA)                     */}
      {/* ===================================================================== */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1 flex-wrap gap-2">
          <h2 className="text-sm font-serif font-bold uppercase tracking-wider text-white flex items-center space-x-2">
            <Flame size={16} className="text-[#F59E0B]" />
            <span>Toca Avisarles (Llevan tiempo sin venir)</span>
          </h2>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              navigate('/clients');
            }}
            className="text-xs font-bold text-[#34D399] hover:text-white flex items-center space-x-1 cursor-pointer"
          >
            <span>Ver todas las tarjetas 3D ({clients.length})</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {showcaseClients.map(({ client, alert }) => (
            <div
              key={client.id}
              className="luxury-card p-4 flex items-center justify-between gap-3"
            >
              <div
                onClick={() => {
                  soundFx.playClick();
                  navigate(`/clients/${client.id}`);
                }}
                className="flex items-center space-x-3 min-w-0 cursor-pointer group"
              >
                {client.avatar || client.photo ? (
                  <img
                    src={client.avatar || client.photo}
                    alt={client.name}
                    className="w-12 h-12 rounded-xl object-cover border border-[#10B981]/50 shrink-0 group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-[#141820] text-[#10B981] flex items-center justify-center font-bold shrink-0">
                    {client.name?.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-[#34D399] transition-colors">
                    {client.name}
                  </h3>
                  <span
                    className={`text-[11px] font-semibold block truncate ${
                      alert.alertLevel === 'urgent'
                        ? 'text-[#FCA5A5]'
                        : alert.alertLevel === 'warning'
                        ? 'text-[#FCD34D]'
                        : 'text-[#34D399]'
                    }`}
                  >
                    {alert.label}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDirectWhatsApp(client, { whatsappDraft: null })}
                className="px-3 py-2 rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-xs font-bold shrink-0 cursor-pointer transition-all"
              >
                💬 Invitar
              </button>
            </div>
          ))}
        </div>
      </section>



      {/* ===================================================================== */}
      {/* BARRA DISCRETA DE AJUSTES Y COPIAS (OCULTA POR DEFECTO)               */}
      {/* ===================================================================== */}
      <div className="pt-2">
        <div className="luxury-card overflow-hidden">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setIsSettingsOpen((v) => !v);
            }}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-[#1B202B]/50 transition-colors cursor-pointer"
          >
            <span className="text-xs font-bold text-[#9CA3AF] flex items-center space-x-2">
              <ShieldCheck size={15} className="text-[#10B981]" />
              <span>Copias de seguridad, permisos de redes (RGPD) y extras</span>
            </span>
            {isSettingsOpen ? (
              <ChevronUp size={16} className="text-[#9CA3AF]" />
            ) : (
              <ChevronDown size={16} className="text-[#9CA3AF]" />
            )}
          </button>

          {isSettingsOpen && (
            <div className="p-5 pt-2 border-t border-[#252A36] flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
              <div className="text-xs text-[#D1D5DB]">
                <span className="font-bold text-white">
                  {clients.length} clientes guardados
                </span>{' '}
                · {signedConsents}/{clients.length} con permiso firmado para Reels.
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="px-3.5 py-2 rounded-xl bg-[#0A0C0F] hover:bg-[#1B202B] border border-[#10B981]/40 text-xs font-bold text-white flex items-center space-x-1.5 cursor-pointer"
                >
                  <Download size={14} className="text-[#10B981]" />
                  <span>Guardar copia</span>
                </button>

                <button
                  type="button"
                  onClick={() => backupInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-[#0A0C0F] hover:bg-[#1B202B] border border-[#262C3A] text-xs font-bold text-[#D1D5DB] flex items-center space-x-1.5 cursor-pointer"
                >
                  <Upload size={14} className="text-[#34D399]" />
                  <span>Cargar copia</span>
                </button>

                {openNoShow && (
                  <button
                    type="button"
                    onClick={() => openNoShow()}
                    className="px-3.5 py-2 rounded-xl bg-[#F59E0B]/15 hover:bg-[#F59E0B] border border-[#F59E0B]/40 text-xs font-bold text-[#FBBF24] hover:text-[#07090C] cursor-pointer transition-all"
                  >
                    ⚡ Rellenar Huecos
                  </button>
                )}

                {openReel && (
                  <button
                    type="button"
                    onClick={() => openReel()}
                    className="px-3.5 py-2 rounded-xl bg-[#10B981]/15 hover:bg-[#10B981] border border-[#10B981]/40 text-xs font-bold text-[#34D399] hover:text-[#07090C] cursor-pointer transition-all flex items-center space-x-1"
                  >
                    <Sparkles size={13} />
                    <span>Crear Reel</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
