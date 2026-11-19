import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, X, Send, Bot, User, Copy, Check
} from 'lucide-react';
import { useClients, normalizeText } from '../context/ClientContext';

const KNOWLEDGE_BASE = {
  fade_peines: {
    keywords: ['fade', 'degradado', 'peine', 'peines', 'guia', 'shaver', 'taper', 'mullet', 'crop', 'navaja', 'barba'],
    response: `💈 **Guía Técnica KUTZ // Graduaciones de Fade & Barba:**
• **Estructura Skin Fade Limpio (Sin líneas):**
  1. **Base:** Trimmer #000 + Shaver dejando 0.5 cm de margen para no crear escalón.
  2. **Transición baja:** Peine **#0.5** (1 dedo de anchura) jugando con palanca a la mitad para borrar línea de #0.
  3. **Zona media (Puente):** Peine **#1.5 especial** palanca abierta conectando con peine **#2** en herradura/parietal.
• **Ritual de Barba & Navaja:**
  - Aplicar gel transparente o espuma pre-shave + **Toalla Caliente (2 min)** para ablandar el folículo.
  - Perfilar pómulo y cuello con cuchilla nueva a 30° de inclinación y cerrar poros con **piedra de alumbre + bálsamo sin alcohol**.`
  },
  mirada_unas: {
    keywords: ['pestañas', 'pestanas', 'lifting', 'laminado', 'cejas', 'manicura', 'uñas', 'unas', 'semipermanente', 'acrigel'],
    response: `👁️ **Protocolo de Diseño de Cejas Masculinas a Navaja:**
• Peinar ceja hacia arriba y recortar puntas largas con tijera recta.
• Tensar bien la piel en tres puntos y perfilar el contorno superior e inferior con navaja en ángulo de 30° usando gel transparente.`
  },
  colorimetria: {
    keywords: ['balayage', 'color', 'tinte', 'matiz', 'mechas', 'oxidante', 'decoloracion', 'canas', 'rubio', 'platino', 'blanco'],
    response: `🎨 **Guía Barber de Platinos, Mechas & Camuflaje de Canas:**
• **Blanco Platino Masculino (Global):**
  - No lavar el cuero cabelludo 24h antes + aplicar protector dérmico.
  - 1ª Deco a 20 vol (respetando 0.5 cm de raíz los primeros 15 min) hasta llegar a fondo amarillo pálido (altura 10).
  - **Matiz:** *10.21 o 9.12 con Ox 6 vol (10-15 min)* para neutralizar reflejo dorado sin apagar el brillo.`
  },
  whatsapp: {
    keywords: ['whatsapp', 'mensaje', 'recordatorio', 'enviar', 'consejo', 'plantilla'],
    response: `💬 **Plantillas de WhatsApp Barber Listas para Copiar:**

**1. Aviso de Refresco de Fade (15-20 días):**
"¡Qué pasa [Nombre] 💈! Te escribimos desde KUTZ Barber Studio. Ya hace 2 semanas y media de tu último Fade y toca refrescar ese degradado y perfilar la barba para el finde. ¿Te guardamos sillón esta semana? 🔥"

**2. Recordatorio de Bono VIP Activo:**
"¡Buenas [Nombre] 💈! Te recordamos que aún tienes sesiones disponibles en tu Bono VIP de corte y barba en KUTZ. Dinos qué día y hora te cuadra mejor y te anotamos."`
  }
};

const PROMPTS_BY_MODE = {
  barber: [
    '🎟️ ¿Quién tiene Bonos VIP activos?',
    '🔥 ¿A quién le toca refrescar el Fade?',
    '📋 Ver receta de Álex Rivera',
    '💈 Guía de peines Skin Fade y Barba',
    '🛡️ ¿Quién tiene permiso para Reels/TikTok?',
    '💬 Plantillas WhatsApp de la Barbería'
  ],
  estetica: [
    '🎟️ ¿Quién tiene bonos activos y saldo?',
    '🔍 ¿Quién necesita retoque o mantenimiento?',
    '🛡️ ¿Quién falta por firmar el RGPD?',
    '💬 Plantillas WhatsApp para clientes'
  ],
  peluqueria: [
    '🎟️ ¿Quién tiene bonos o packs activos?',
    '🔍 ¿A quién le toca retoque?',
    '🎨 Guía Colorimetría y Matices',
    '🛡️ ¿Quién falta por firmar el RGPD?'
  ],
  clinica: [
    '🎟️ Bonos y packs activos',
    '🔍 ¿Quién necesita retoque o seguimiento?',
    '🛡️ Auditoría de firmas RGPD'
  ]
};

const AIAssistantModal = ({ isOpen, onClose, clients: externalClients }) => {
  const clientContext = useClients();
  const clients = externalClients || clientContext?.clients || [];
  const calculateRetentionInsights = clientContext?.calculateRetentionInsights;
  const businessMode = clientContext?.businessMode || 'barber';
  const activeModeConfig = clientContext?.activeModeConfig;

  const suggestedPrompts = PROMPTS_BY_MODE[businessMode] || PROMPTS_BY_MODE.barber;

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: '¡Qué pasa! 💈 Soy tu KUTZ Copilot IA conectado en tiempo real a las fichas de la barbería. Pregúntame por cualquier cliente (ej. "Álex Rivera" o "Mateo"), quién tiene su Skin Fade vencido (+15 días), el saldo de los Bonos VIP o quién autorizó salir en Reels/TikTok.'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const processResponse = (query) => {
    const normQuery = normalizeText(query);
    if (!normQuery) {
      return 'Escribe el nombre de un cliente, "bonos", "retoques fade" o "RGPD".';
    }

    // 1. BÚSQUEDA DIRECTA DE CLIENTE POR NOMBRE EN LA BASE DE DATOS REAL
    const matchedClient = clients.find(c => {
      const fullNorm = normalizeText(c.name);
      if (!fullNorm) return false;
      if (normQuery.includes(fullNorm)) return true;
      const tokens = fullNorm.split(/\s+/).filter(t => t.length >= 3);
      return tokens.some(tok => normQuery.includes(tok));
    });

    if (matchedClient) {
      const clientInsights = calculateRetentionInsights ? calculateRetentionInsights(matchedClient) : [];
      const treatmentsList = matchedClient.treatments || [];
      const rgpdStatus = matchedClient.consent?.signed 
        ? `✅ Firmado (${matchedClient.consent.formattedDate || 'Activo'}) — Reels/TikTok: ${matchedClient.consent.permissions?.photosMarketing ? 'Autorizado' : 'No autorizado'}`
        : `⚠️ PENDIENTE DE FIRMA EN PANTALLA`;

      let resp = `💈 **Ficha Barber en Vivo: ${matchedClient.name}**\n`;
      resp += `• **Teléfono:** ${matchedClient.phone || 'No registrado'}\n`;
      resp += `• **Permiso Reels / RGPD:** ${rgpdStatus}\n`;
      resp += `• **Sensibilidad Piel / Navaja:** ${matchedClient.allergies || 'Ninguna registrada'}\n`;
      resp += `• **Cráneo, Remolinos & Styling:** ${matchedClient.notes || 'Sin notas'}\n\n`;

      if (treatmentsList.length > 0) {
        resp += `✂️ **Últimos Cortes & Recetas de Peines (${treatmentsList.length}):**\n`;
        treatmentsList.slice(0, 3).forEach(t => {
          resp += `  ▫️ **${t.name}** (${t.date})\n`;
          if (t.formula) resp += `     📐 *Receta:* ${t.formula}\n`;
          if (t.notes) resp += `     📝 *Notas:* ${t.notes}\n`;
        });
      } else {
        resp += `📋 *Aún no tiene cortes registrados en su historial.*\n`;
      }

      if (Array.isArray(matchedClient.bonos) && matchedClient.bonos.length > 0) {
        resp += `\n🎟️ **Bonos & Membresías VIP (${matchedClient.bonos.length}):**\n`;
        matchedClient.bonos.forEach(b => {
          const used = Number(b.usedSessions) || 0;
          const total = Number(b.totalSessions) || 4;
          const rem = Math.max(0, total - used);
          resp += `  • **${b.name}**: ${used}/${total} sesiones consumidas · **${rem > 0 ? `${rem} restante${rem === 1 ? '' : 's'}` : 'Completado'}** ${b.price ? `(${b.price})` : ''}\n`;
        });
      }

      if (clientInsights.length > 0) {
        resp += `\n🔥 **Alerta de Retoque Fade:**\n`;
        clientInsights.forEach(ins => {
          resp += `  • **${ins.title}** (${ins.elapsedDays} días transcurridos).\n`;
        });
      }

      return resp;
    }

    // 2. AUDITORÍA EN VIVO DE PERMISOS REELS / RGPD
    const rgpdKeywords = ['rgpd', 'consentimiento', 'firma', 'firmado', 'firmar', 'legal', 'proteccion de datos', 'reels', 'tiktok'];
    if (rgpdKeywords.some(k => normQuery.includes(k))) {
      const signedList = clients.filter(c => c.consent?.signed);
      const pendingList = clients.filter(c => !c.consent?.signed);

      let resp = `🛡️ **Auditoría de Permisos Reels/TikTok & RGPD (KUTZ // OS):**\n`;
      resp += `• **Fichas firmadas:** ${signedList.length} de ${clients.length}\n\n`;

      if (pendingList.length > 0) {
        resp += `⚠️ **Faltan por firmar (${pendingList.length}):**\n`;
        pendingList.forEach(p => {
          resp += `  • **${p.name}** (${p.phone || 'Sin teléfono'}) — Abre su ficha y pulsa *"Firmar en Tablet"*.\n`;
        });
      } else {
        resp += `✅ **¡100% Autorizado!** Todos tus clientes tienen su firma digital y permiso de imagen para subir sus cortes a Instagram Reels y TikTok.\n`;
      }

      return resp;
    }

    // 2.5 CONSULTA Y AUDITORÍA DE BONOS VIP
    const bonoKeywords = ['bono', 'bonos', 'pack', 'packs', 'sesiones restantes', 'saldo', 'membresia', 'vip'];
    if (bonoKeywords.some(k => normQuery.includes(k))) {
      const clientsWithBonos = clients.filter(c => Array.isArray(c.bonos) && c.bonos.length > 0);

      if (clientsWithBonos.length === 0) {
        return `🎟️ **Control de Bonos VIP:**\nActualmente no hay bonos registrados.`;
      }

      let resp = `🎟️ **Auditoría de Bonos & Membresías VIP en KUTZ // OS:**\n\n`;
      clientsWithBonos.forEach(c => {
        resp += `👤 **${c.name}** (${c.phone || 'Sin tel.'}):\n`;
        c.bonos.forEach(b => {
          const used = Number(b.usedSessions) || 0;
          const total = Number(b.totalSessions) || 4;
          const rem = Math.max(0, total - used);
          resp += `  ▫️ **${b.name}**: ${used}/${total} cortes usados — **${rem > 0 ? `${rem} restante${rem === 1 ? '' : 's'}` : 'Finalizado'}** ${b.price ? `(${b.price})` : ''}\n`;
        });
        resp += `\n`;
      });

      resp += `💡 *Tip de sillón:* Entra en la ficha del cliente y pulsa *"Consumir 1 Sesión"* para descontar el corte de hoy automáticamente.`;
      return resp;
    }

    // 3. CONSULTA DE RETENCIÓN Y RETOQUES DE FADE EN VIVO
    const retentionKeywords = [
      'retoque', 'retoques', 'seguimiento', 'mantenimiento', 'contactar', 'llamar', 
      'quien', 'agenda', 'hueco', 'lista', 'paciente', 'pacientes', 
      'clienta', 'clientas', 'cliente', 'clientes', 'oportunidad', 'retencion', 'fade'
    ];

    if (retentionKeywords.some(k => normQuery.includes(k))) {
      if (!clients || clients.length === 0) {
        return `📊 No hay clientes registrados actualmente.`;
      }

      const patientsWithInsights = [];
      clients.forEach(c => {
        const insights = calculateRetentionInsights ? calculateRetentionInsights(c) : [];
        if (insights && insights.length > 0) {
          patientsWithInsights.push({
            id: c.id,
            name: c.name,
            phone: c.phone,
            insights: insights
          });
        }
      });

      if (patientsWithInsights.length === 0) {
        return `💈 Actualmente todos tus clientes tienen su Fade al día. ¡Excelente gestión de sillón!`;
      }

      let resp = `🔥 **Radar de Retoque KUTZ (${patientsWithInsights.length} ${patientsWithInsights.length === 1 ? 'cliente' : 'clientes'} en ventana de corte):**\nSegún el historial de LuminaDesk, estos pacientes necesitan seguimiento:\n\n`;
      patientsWithInsights.forEach(p => {
        resp += `• **${p.name}** (${p.phone || 'Sin tel'}):\n`;
        p.insights.forEach(ins => {
          resp += `   ▫️ *${ins.title}* (${ins.treatmentName}) — **${ins.elapsedDays} días** transcurridos.\n`;
        });
      });
      resp += `\n💡 *Acción rápida:* Entra en su ficha para mandarle el WhatsApp con 1 solo clic.`;
      return resp;
    }

    // 4. PROTOCOLOS TÉCNICOS DE BARBERÍA
    for (const key of Object.keys(KNOWLEDGE_BASE)) {
      const item = KNOWLEDGE_BASE[key];
      if (item.keywords.some(k => normQuery.includes(normalizeText(k)))) {
        return item.response;
      }
    }

    // 5. RESPUESTA INTELIGENTE CON CONTEXTO DE LOS CLIENTES ACTIVOS
    const clientNames = clients.map(c => c.name).join(', ');
    return `💈 **KUTZ Copilot IA (${activeModeConfig?.shortName || 'Barbería & Fade'}):**
Respecto a tu consulta sobre *"${query}"*:
Recuerda anotar siempre la graduación de peines (#000 a #2) y los remolinos en la ficha del cliente para clavar el corte en su próxima visita.

💡 **Consultas rápidas en vivo:**
• Escribe el nombre de cualquiera de tus clientes (**${clientNames || 'Álex Rivera'}**) para ver su receta de Fade y Bono VIP.
• Pregunta *"¿A quién le toca refrescar el Fade?"* o *"¿Quién tiene Bonos VIP activos?"*.`;
  };

  const handleSend = (textToSend = null) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: text
    };

    setMessages(prev => [...prev, userMessage]);
    if (!textToSend) setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const botResponse = processResponse(text);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: botResponse
        }
      ]);
      setIsTyping(false);
    }, 450);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#090B0E]/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-300">
      <div className="bg-[#161920] rounded-3xl border border-[#262B36] shadow-[0_25px_70px_rgba(0,0,0,0.8)] w-full max-w-xl h-[88vh] max-h-[700px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header Asistente Streetwear */}
        <div className="p-5 sm:p-6 border-b border-[#262B36] flex items-center justify-between bg-[#14171D]">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] flex items-center justify-center">
              <Bot size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-serif font-bold text-white">
                  KUTZ Copilot IA
                </h3>
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                <span className="text-[9px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30">
                  BARBER DB LIVE
                </span>
              </div>
              <p className="text-[11px] text-[#9CA3AF]">
                Conectado en vivo a tus recetas de peines, bonos VIP y alertas de Fade
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#1C2029] border border-[#262B36] text-[#9CA3AF] hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Cuerpo de Mensajes */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 bg-[#0F1115]">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex items-start space-x-3 ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs ${
                msg.sender === 'bot' 
                  ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30' 
                  : 'bg-[#10B981] text-[#090B0E] font-bold'
              }`}>
                {msg.sender === 'bot' ? <Sparkles size={14} /> : <User size={14} />}
              </div>

              <div className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                msg.sender === 'bot'
                  ? 'bg-[#161920] border border-[#262B36] text-[#E5E7EB]'
                  : 'bg-[#10B981] text-[#090B0E] font-semibold'
              }`}>
                <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                {/* Botón copiar para mensajes del bot */}
                {msg.sender === 'bot' && (
                  <div className="mt-2.5 pt-2 border-t border-[#262B36] flex justify-end">
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="text-[10px] font-mono text-[#9CA3AF] hover:text-[#34D399] inline-flex items-center space-x-1 cursor-pointer"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check size={11} className="text-[#10B981]" />
                          <span className="text-[#10B981]">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center space-x-2 text-xs text-[#9CA3AF] pl-11">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-bounce"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-bounce [animation-delay:0.4s]"></span>
              <span className="text-[11px] font-mono">Consultando recetas de barbería...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chips de sugerencias rápidas Barber */}
        <div className="px-5 py-2.5 bg-[#14171D] border-t border-[#262B36] flex items-center gap-2 overflow-x-auto no-scrollbar">
          {suggestedPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="shrink-0 text-[11px] font-mono px-3 py-1.5 rounded-xl bg-[#1C2029] text-[#34D399] hover:bg-[#10B981] hover:text-[#090B0E] border border-[#262B36] transition-colors cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Barra de entrada de texto */}
        <div className="p-4 sm:p-5 bg-[#14171D] border-t border-[#262B36]">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center space-x-2"
          >
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe 'Álex Rivera', 'bonos', 'fade', 'retoques'..."
              className="flex-1 px-4 py-3 bg-[#1C2029] border border-[#262B36] rounded-xl text-xs sm:text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981] transition-all"
            />
            <button 
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="btn-author p-3 rounded-xl disabled:opacity-40 cursor-pointer shrink-0"
            >
              <Send size={16} />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default AIAssistantModal;
