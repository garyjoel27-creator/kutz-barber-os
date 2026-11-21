import React, { useState } from 'react';
import { Search, Plus, User, Flame, Ticket, Zap } from 'lucide-react';
import ClientModal from '../components/ClientModal';
import ClientBentoCard from '../components/ClientBentoCard';
import { useClients, getFadeAlert, normalizeText } from '../context/ClientContext';
import { useShop } from '../context/ShopContext';
import { getShopVertical, isFemaleVertical } from '../lib/shopUtils';
import { soundFx } from '../lib/soundFx';

/**
 * Directorio Visual de Clientes / Clientas con Tarjetas 3D Giratorias
 */
const Clients = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'vip' | 'urgent' | 'walkin'
  const { clients, addClient, businessMode } = useClients();
  const shopCtx = useShop();
  const activeVertical = getShopVertical(shopCtx?.activeShop, shopCtx?.activeShopSlug, businessMode);
  const isFemale = isFemaleVertical(activeVertical);

  const handleCreateClient = (newClientData) => {
    addClient(newClientData);
    setIsModalOpen(false);
  };

  const filteredClients = clients.filter((c) => {
    const q = normalizeText(searchQuery);
    const clientName = normalizeText(c.name || '');
    const clientPhone = (c.phone || '').toString();
    const formula = normalizeText(c.treatments?.[0]?.formula || '');
    const treatment = normalizeText(c.treatment || '');

    const matchesSearch =
      !q ||
      clientName.includes(q) ||
      (clientPhone && clientPhone.includes(q)) ||
      formula.includes(q) ||
      treatment.includes(q);

    if (!matchesSearch) return false;

    if (activeFilter === 'urgent' || activeFilter === 'overdue') {
      const alert = getFadeAlert(c);
      return (
        alert.requiresRetouch ||
        alert.alertLevel === 'urgent' ||
        alert.alertLevel === 'warning'
      );
    }
    if (activeFilter === 'vip') {
      return c.bonos?.some((b) => b.totalSessions - b.usedSessions > 0);
    }
    if (activeFilter === 'walkin') {
      return (
        !c.bonos ||
        c.bonos.length === 0 ||
        c.bonos.every((b) => b.totalSessions - b.usedSessions <= 0) ||
        c.isWalkInOnly
      );
    }
    return true;
  });

  const filterTabs = [
    { id: 'all', label: `${isFemale ? 'Todas' : 'Todos'} (${clients.length})`, icon: User },
    { id: 'vip', label: '🎟️ Con Bono VIP', icon: Ticket },
    {
      id: 'urgent',
      label:
        activeVertical === 'nails'
          ? '💅 Toca Relleno'
          : activeVertical === 'peluqueria'
          ? '✨ Toca Retoque'
          : '🔥 Toca Repaso',
      icon: Flame,
    },
    { id: 'walkin', label: '⚡ Sin Bono', icon: Zap },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Cabecera Clara */}
      <header
        className={`luxury-card p-5 sm:p-6 border-l-4 ${
          isFemale ? 'border-l-[#EC4899]' : 'border-l-[#10B981]'
        } flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-black text-white tracking-tight uppercase">
            {activeVertical === 'nails'
              ? 'Tus Clientas · Tarjetas 3D de Uñas'
              : activeVertical === 'peluqueria'
              ? 'Tus Clientas · Pasaporte 3D Color & Cabina'
              : 'Tus Clientes · Tarjetas 3D'}
          </h1>
          <p className="text-xs sm:text-sm text-[#D1D5DB] mt-1">
            {activeVertical === 'nails'
              ? 'Toca una tarjeta para girarla, ver su forma, talla, acrílico/rubber y apuntar su diseño de hoy en 1 toque.'
              : activeVertical === 'peluqueria'
              ? 'Toca una tarjeta para girarla, ver su fórmula exacta de tinte/mechas o protocolo facial y repetir hoy en 1 toque.'
              : 'Toca una tarjeta para girarla, ver con qué peine se corta y apuntar su visita de hoy al instante.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setIsModalOpen(true);
          }}
          className="btn-author self-start sm:self-auto cursor-pointer shrink-0"
        >
          <Plus size={17} />
          <span>{isFemale ? 'Nueva Clienta' : 'Nuevo Cliente'}</span>
        </button>
      </header>

      {/* Buscador & Filtros Rápidos */}
      <div className="space-y-3">
        <div className="relative w-full">
          <Search
            className={`absolute left-4 top-1/2 -translate-y-1/2 ${
              isFemale ? 'text-[#EC4899]' : 'text-[#10B981]'
            }`}
            size={18}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeVertical === 'nails'
                ? 'Buscar por nombre, móvil o diseño (ej. Acrílicas, Almendra, Talla M, Baby Boomer)...'
                : activeVertical === 'peluqueria'
                ? 'Buscar por nombre, móvil o fórmula (ej. Balayage, Tinte 7.1, Higiene Facial, Radiofrecuencia)...'
                : 'Buscar por nombre, móvil o tipo de corte (ej. Skin Fade, #0.5)...'
            }
            className={`w-full pl-11 pr-4 py-3.5 bg-[#141820]/90 backdrop-blur-md border border-[#262C3A] rounded-xl text-sm text-white placeholder-[#6B7280] focus:outline-none ${
              isFemale ? 'focus:border-[#EC4899]' : 'focus:border-[#10B981]'
            } transition-all`}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setActiveFilter(tab.id);
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
                  isActive
                    ? isFemale
                      ? 'bg-[#EC4899] text-white border-[#F472B6] shadow-[2px_2px_0px_#9D174D]'
                      : 'bg-[#10B981] text-[#07090C] border-[#34D399] shadow-[2px_2px_0px_#065F46]'
                    : 'bg-[#141820]/90 backdrop-blur-md text-[#D1D5DB] border-[#262C3A] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rejilla Bento de Tarjetas 3D */}
      {filteredClients.length === 0 ? (
        <div className="luxury-card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center mx-auto">
            <User size={22} />
          </div>
          <h3 className="text-lg font-serif font-bold text-white uppercase">
            No hay clientes aquí
          </h3>
          <p className="text-xs text-[#9CA3AF] max-w-sm mx-auto">
            Prueba a limpiar el buscador o pulsa "Nuevo Cliente" arriba.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => {
            const isHero = String(client.id) === '3' || client.isHero;
            return (
              <div
                key={client.id}
                className={isHero ? 'col-span-1 md:col-span-2' : 'col-span-1'}
              >
                <ClientBentoCard client={client} isHero={isHero} />
              </div>
            );
          })}
        </div>
      )}

      <ClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateClient}
      />
    </div>
  );
};

export default Clients;
