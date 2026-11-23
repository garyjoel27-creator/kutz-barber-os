import React, { useRef, useState, useEffect } from 'react';
import { 
  Camera, Calendar, Sparkles, ArrowLeft, Plus, X, Heart, 
  ShieldAlert, Image as ImageIcon, Loader2, CheckCircle2,
  Mic, MessageSquare, Clock, ShieldCheck, FileText, PenTool, Download,
  Ticket, Scissors, Copy, Check, Trash2, Flame, Film
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import PhotoCompare from '../components/PhotoCompare';
import LuminaMorphModal from '../components/LuminaMorphModal';
import RGPDConsentModal from '../components/RGPDConsentModal';
import ReelStudioModal from '../components/ReelStudioModal';
import { useClients } from '../context/ClientContext';
import { useShop } from '../context/ShopContext';
import { compressImage } from '../lib/imageUtils';

const ClientProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeShop, activeShopSlug } = useShop();
  const { 
    getClient, 
    addTreatment, 
    addPhotoToTreatment, 
    updateClientConsent,
    deleteClient,
    calculateRetentionInsights,
    addBono,
    consumeBonoSession,
    deleteBono,
    businessMode,
    activeModeConfig
  } = useClients();
  const isNailsMode = businessMode === 'nails';
  const isPeluqueriaEsteticaMode = businessMode === 'peluqueria' || businessMode === 'estetica';
  const isFemaleMode = isNailsMode || isPeluqueriaEsteticaMode;
  
  // Modal de Consentimiento RGPD y Firma Digital
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [consentModalTab, setConsentModalTab] = useState('form');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [arsopolNotice, setArsopolNotice] = useState('');
  
  // Refs para los inputs de archivo (Cámara directa vs Galería/Archivo)
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  
  // Estados para subida y procesamiento
  const [activeUpload, setActiveUpload] = useState({ treatmentId: null, type: null });
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState('');

  // Pestañas fluidas del perfil ('sessions' | 'gallery' | 'rgpd')
  const [activeProfileTab, setActiveProfileTab] = useState('sessions');

  // Modal para nueva sesión
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({ name: '', formula: '', notes: '' });

  // Modal y estado para Bonos & Membresías VIP
  const [isNewBonoModalOpen, setIsNewBonoModalOpen] = useState(false);
  const [bonoForm, setBonoForm] = useState({ name: '', totalSessions: 4, price: '', notes: '' });
  const [bonoNotice, setBonoNotice] = useState('');
  const [copiedFormulaNotice, setCopiedFormulaNotice] = useState('');

  // Estados para Morph (Visual Time-Lapse Player) y Reel Studio 9:16
  const [isMorphOpen, setIsMorphOpen] = useState(false);
  const [morphPhotos, setMorphPhotos] = useState([]);
  const [morphTreatmentName, setMorphTreatmentName] = useState('');
  const [isReelStudioOpen, setIsReelStudioOpen] = useState(false);

  // Estados y referencias para Dictado por Voz en Sillón
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const recognitionRef = useRef(null);
  const baselineNotesRef = useRef('');

  const SpeechRecognition = typeof window !== 'undefined' 
    ? (window.SpeechRecognition || window.webkitSpeechRecognition) 
    : null;
  const isSpeechSupported = !!SpeechRecognition;

  // Retención predictiva & avisos de retoque de Fade
  const [copiedDraftId, setCopiedDraftId] = useState(null);

  // Control de Dictado por Voz (Unconditional Hook Hygiene)
  const stopVoiceDictation = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const startVoiceDictation = () => {
    if (!isSpeechSupported) {
      setSpeechError('El dictado por voz requiere Google Chrome, Edge o Safari.');
      return;
    }
    setSpeechError(null);

    try {
      if (recognitionRef.current) {
        stopVoiceDictation();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

      baselineNotesRef.current = sessionForm.notes ? sessionForm.notes.trim() : '';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';
          if (result.isFinal) {
            finalTranscript += text + ' ';
          } else {
            interimTranscript += text;
          }
        }

        const currentSpoken = (finalTranscript + interimTranscript).trim();
        const combined = baselineNotesRef.current
          ? `${baselineNotesRef.current} ${currentSpoken}`
          : currentSpoken;

        setSessionForm((prev) => ({
          ...prev,
          notes: combined
        }));
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setSpeechError('Permiso de micrófono denegado en el navegador.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Aviso de dictado: ${event.error}`);
        }
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setSpeechError('No se pudo activar el micrófono.');
      setIsListening(false);
      recognitionRef.current = null;
    }
  };

  const toggleVoiceDictation = () => {
    if (isListening) {
      stopVoiceDictation();
    } else {
      startVoiceDictation();
    }
  };

  useEffect(() => {
    if (!isNewSessionOpen && isListening) {
      stopVoiceDictation();
      setSpeechError(null);
    }
  }, [isNewSessionOpen, isListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const client = getClient(id);

  if (!client) {
    return (
      <div className="luxury-card p-12 text-center space-y-4 max-w-lg mx-auto my-12">
        <h2 className="text-2xl font-serif font-bold text-white">Ficha de Cliente no encontrada</h2>
        <p className="text-xs text-[#9CA3AF]">El registro solicitado no existe o fue eliminado.</p>
        <button 
          onClick={() => navigate('/clients')} 
          className="btn-author text-xs py-2.5 px-6 mx-auto cursor-pointer"
        >
          Regresar al Directorio
        </button>
      </div>
    );
  }

  const treatments = client.treatments || [];
  const bonos = client.bonos || [];
  const lastFormulaTreatment = treatments.find(t => t.formula && String(t.formula).trim().length > 0);

  // Fotos acumuladas de todo el historial para Morph Global
  const allClientPhotos = treatments.flatMap((t) => {
    const list = [];
    if (t.photos?.before) {
      list.push({
        url: t.photos.before,
        label: `Antes — ${t.name}`,
        type: 'before',
        date: t.date || ''
      });
    }
    if (t.photos?.after) {
      list.push({
        url: t.photos.after,
        label: `Después — ${t.name}`,
        type: 'after',
        date: t.date || ''
      });
    }
    return list;
  });

  const handleOpenTreatmentMorph = (treatment) => {
    const photosList = [];
    if (treatment.photos?.before) {
      photosList.push({
        url: treatment.photos.before,
        label: 'Antes',
        type: 'before',
        date: treatment.date || ''
      });
    }
    if (treatment.photos?.after) {
      photosList.push({
        url: treatment.photos.after,
        label: 'Después',
        type: 'after',
        date: treatment.date || ''
      });
    }
    setMorphPhotos(photosList);
    setMorphTreatmentName(treatment.name);
    setIsMorphOpen(true);
  };

  const handleOpenGlobalMorph = () => {
    if (allClientPhotos.length < 2) return;
    setMorphPhotos(allClientPhotos);
    setMorphTreatmentName('Evolución de Estilo & Fade');
    setIsMorphOpen(true);
  };

  // Retención predictiva & avisos de retoque de Fade
  const insights = (client && calculateRetentionInsights) 
    ? calculateRetentionInsights(client) 
    : [];

  const handleScheduleTouchUp = (insight) => {
    const treatmentTitle = insight.suggestedTreatmentName || 'Refresco Skin Fade & Barba';
    const notes = `Retoque programado tras ${insight.elapsedDays} días del último ${insight.treatmentName}.`;
    setSessionForm({
      name: treatmentTitle,
      formula: lastFormulaTreatment?.formula || '',
      notes: notes
    });
    setIsNewSessionOpen(true);
  };

  const handleNotifyWhatsApp = (insight) => {
    const draft = insight.whatsappDraft || '';
    const rawPhone = client.phone ? String(client.phone).replace(/[^\d+]/g, '') : '';
    const cleanDigits = rawPhone.replace(/\D/g, '');

    if (cleanDigits.length >= 9) {
      const url = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(draft)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigator.clipboard.writeText(draft);
      setCopiedDraftId(insight.id);
      setUploadSuccessMessage('Mensaje de WhatsApp copiado al portapapeles.');
      setTimeout(() => {
        setCopiedDraftId(null);
        setUploadSuccessMessage('');
      }, 3500);
    }
  };

  const openPhotoSelector = (treatmentId, type) => {
    setActiveUpload({ treatmentId, type });
    setIsPhotoPickerOpen(true);
  };

  const handleFileProcess = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file || !activeUpload.treatmentId) {
      setIsPhotoPickerOpen(false);
      return;
    }

    try {
      setIsProcessingPhoto(true);
      setIsPhotoPickerOpen(false);

      const compressedBase64 = await compressImage(file, 1200, 1200, 0.78);
      addPhotoToTreatment(client.id, activeUpload.treatmentId, activeUpload.type, compressedBase64);
      
      setUploadSuccessMessage(
        `Foto "${activeUpload.type === 'before' ? 'Antes' : 'Después'}" guardada en el Lookbook.`
      );
      setTimeout(() => setUploadSuccessMessage(''), 3500);
    } catch (err) {
      console.error('Error al procesar la fotografía:', err);
      alert('Hubo un inconveniente al procesar la imagen.');
    } finally {
      setIsProcessingPhoto(false);
      setActiveUpload({ treatmentId: null, type: null });
    }
  };

  const handleCreateSession = (e) => {
    e.preventDefault();
    if (!sessionForm.name) return;
    if (isListening) {
      stopVoiceDictation();
    }
    addTreatment(client.id, {
      name: sessionForm.name,
      formula: sessionForm.formula || '',
      notes: sessionForm.notes || 'Sin observaciones adicionales.'
    });
    setSessionForm({ name: '', formula: '', notes: '' });
    setSpeechError(null);
    setIsNewSessionOpen(false);
  };

  const handleQuickSessionWithPhoto = (type) => {
    const newTreatment = addTreatment(client.id, {
      name: 'Skin Fade + Perfilado de Barba',
      notes: 'Corte y degradado registrado con captura fotográfica en sillón.'
    });
    openPhotoSelector(newTreatment.id, type);
  };

  const handleCreateBono = (e) => {
    e.preventDefault();
    if (!bonoForm.name) return;
    addBono(client.id, {
      name: bonoForm.name,
      totalSessions: Number(bonoForm.totalSessions) || 4,
      price: bonoForm.price || '',
      notes: bonoForm.notes || ''
    });
    setBonoForm({ name: '', totalSessions: 4, price: '', notes: '' });
    setIsNewBonoModalOpen(false);
    setBonoNotice('¡Nuevo Bono VIP creado y activado para el cliente!');
    setTimeout(() => setBonoNotice(''), 3500);
  };

  const handleConsumeBono = (bonoId) => {
    const result = consumeBonoSession(client.id, bonoId);
    if (result) {
      setBonoNotice(`¡1 Corte descontado del Bono VIP! Se ha registrado la visita de hoy en el historial.`);
    } else {
      setBonoNotice('Este bono ya ha agotado todas sus sesiones.');
    }
    setTimeout(() => setBonoNotice(''), 4000);
  };

  const handleDeleteBono = (bonoId) => {
    if (window.confirm('¿Seguro que deseas eliminar este bono del cliente?')) {
      deleteBono(client.id, bonoId);
      setBonoNotice('Bono eliminado correctamente.');
      setTimeout(() => setBonoNotice(''), 3000);
    }
  };

  const handleCopyFormula = (formulaText, treatmentName = '') => {
    setSessionForm(prev => ({
      ...prev,
      name: prev.name || treatmentName || '',
      formula: formulaText
    }));
    setCopiedFormulaNotice('Receta de peines copiada para el corte de hoy');
    setIsNewSessionOpen(true);
    setTimeout(() => setCopiedFormulaNotice(''), 3000);
  };

  const handleAppendBarberSpec = (term) => {
    setSessionForm(prev => {
      const current = prev.formula ? prev.formula.trim() : '';
      if (!current) return { ...prev, formula: term };
      if (current.includes(term)) return prev;
      return { ...prev, formula: `${current} | ${term}` };
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      
      {/* Inputs de Cámara y Galería */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={cameraInputRef} 
        className="hidden" 
        onChange={handleFileProcess} 
      />
      <input 
        type="file" 
        accept="image/*" 
        ref={galleryInputRef} 
        className="hidden" 
        onChange={handleFileProcess} 
      />

      {/* Notificación flotante de éxito */}
      {uploadSuccessMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#161920] text-white px-5 py-3 rounded-2xl shadow-2xl border border-[#10B981]/50 flex items-center space-x-3 animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 size={18} className="text-[#10B981]" />
          <span className="text-xs font-medium">{uploadSuccessMessage}</span>
        </div>
      )}

      {/* Overlay de procesamiento de foto */}
      {isProcessingPhoto && (
        <div className="fixed inset-0 bg-[#090B0E]/75 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-[#161920] p-7 rounded-3xl border border-[#262B36] shadow-2xl flex flex-col items-center space-y-3">
            <Loader2 className="animate-spin text-[#10B981]" size={32} />
            <h4 className="text-sm font-serif font-bold text-white">Procesando foto del corte...</h4>
            <p className="text-[11px] text-[#9CA3AF] text-center max-w-xs">
              Optimizando nitidez del Fade para el Lookbook Antes/Después.
            </p>
          </div>
        </div>
      )}

      {/* Navegación Superior */}
      <div className="flex items-center justify-between pb-3 border-b border-[#262B36]">
        <button 
          onClick={() => navigate('/clients')} 
          className="inline-flex items-center text-xs font-mono font-bold text-[#34D399] hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft size={16} className="mr-1.5 group-hover:-translate-x-1 transition-transform" />
          <span>Volver al Directorio</span>
        </button>

        <span className="text-[11px] text-[#9CA3AF] font-mono">
          FICHA BARBER #{String(client.id).slice(-6)}
        </span>
      </div>

      {/* Header Ficha Cliente — Streetwear Matte & Acid Volt */}
      <div className="bg-[#161920] rounded-3xl p-6 sm:p-8 border border-[#262B36] shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center space-x-5">
          {client.avatar ? (
            <img 
              src={client.avatar} 
              alt={client.name} 
              className="w-18 h-18 rounded-2xl object-cover border-2 border-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.25)] shrink-0" 
            />
          ) : (
            <div className="w-18 h-18 rounded-2xl bg-[#1C2029] border-2 border-[#10B981]/50 text-[#10B981] font-mono text-2xl flex items-center justify-center font-bold shrink-0">
              {client.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1.5 mb-2">
              <span className="text-[10px] uppercase font-mono font-bold tracking-[0.18em] text-[#090B0E] bg-[#10B981] px-2.5 py-0.5 rounded-md">
                {String(client.id) === '3' ? '★ CLIENTE VIP DEMO' : 'CREW BARBERÍA'}
              </span>

              {/* Pill estado Reels/RGPD */}
              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md border ${
                client.consent?.signed 
                  ? 'bg-[#10B981]/15 text-[#34D399] border-[#10B981]/40' 
                  : 'bg-[#F59E0B]/15 text-[#FBBF24] border-[#F59E0B]/40'
              }`}>
                {client.consent?.signed ? '✓ REELS & RGPD OK' : '⚠️ FIRMA PENDIENTE'}
              </span>

              {/* Pill sensibilidad navaja/shaver */}
              {client.allergies && (
                <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-[#F59E0B]/15 text-[#FBBF24] border border-[#F59E0B]/30 flex items-center space-x-1">
                  <ShieldAlert size={11} className="mr-0.5" />
                  <span>Piel Sensible / Aviso Shaver</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
              {client.name}
            </h1>
            <p className="text-xs text-[#9CA3AF] font-mono mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span>WhatsApp: <strong className="text-white">{client.phone || 'No registrado'}</strong></span>
              {client.email && <span>IG/Email: <strong className="text-[#34D399]">{client.email}</strong></span>}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <button 
            type="button"
            onClick={() => setIsReelStudioOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#141820] text-white hover:bg-[#1B202B] border border-[#10B981]/50 text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer group shadow-sm"
            title="Generar vídeo vertical 9:16 para Instagram Reels y TikTok"
          >
            <Film size={14} className="text-[#10B981] group-hover:scale-110 transition-transform" />
            <span>Reel Studio 9:16</span>
          </button>

          {allClientPhotos.length >= 2 && (
            <button 
              type="button"
              onClick={handleOpenGlobalMorph}
              className="px-4 py-2.5 rounded-xl bg-[#1C2029] text-white hover:bg-[#252A36] border border-[#10B981]/40 text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer group"
              title="Ver transición animada Antes/Después"
            >
              <Sparkles size={14} className="text-[#10B981] group-hover:rotate-12 transition-transform" />
              <span>KUTZ Morph™</span>
            </button>
          )}

          <button 
            onClick={() => setIsNewSessionOpen(true)}
            className="btn-author w-full sm:w-auto text-xs py-2.5 px-5 cursor-pointer flex items-center justify-center space-x-2"
          >
            <Plus size={15} />
            <span>Registrar Corte / Receta</span>
          </button>
        </div>
      </div>

      {/* Barra de Pestañas Fluidas (Tabs) */}
      <div className="flex items-center space-x-2 border-b border-[#262B36] pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveProfileTab('sessions')}
          className={`flex items-center space-x-2 px-5 py-3 rounded-xl text-xs font-serif font-bold transition-all cursor-pointer shrink-0 ${
            activeProfileTab === 'sessions'
              ? 'bg-[#10B981] text-[#090B0E] shadow-[0_0_20px_rgba(16,185,129,0.25)]'
              : 'bg-[#161920] text-[#9CA3AF] hover:text-white border border-[#262B36]'
          }`}
        >
          <Scissors size={15} />
          <span>Recetas de Corte & Bonos VIP</span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
            activeProfileTab === 'sessions' ? 'bg-[#090B0E]/20 text-[#090B0E]' : 'bg-[#1C2029] text-[#34D399]'
          }`}>
            {treatments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveProfileTab('gallery')}
          className={`flex items-center space-x-2 px-5 py-3 rounded-xl text-xs font-serif font-bold transition-all cursor-pointer shrink-0 ${
            activeProfileTab === 'gallery'
              ? 'bg-[#10B981] text-[#090B0E] shadow-[0_0_20px_rgba(16,185,129,0.25)]'
              : 'bg-[#161920] text-[#9CA3AF] hover:text-white border border-[#262B36]'
          }`}
        >
          <Camera size={15} />
          <span>Lookbook Antes / Después & Morph</span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
            activeProfileTab === 'gallery' ? 'bg-[#090B0E]/20 text-[#090B0E]' : 'bg-[#1C2029] text-[#34D399]'
          }`}>
            {allClientPhotos.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveProfileTab('rgpd')}
          className={`flex items-center space-x-2 px-5 py-3 rounded-xl text-xs font-serif font-bold transition-all cursor-pointer shrink-0 ${
            activeProfileTab === 'rgpd'
              ? 'bg-[#10B981] text-[#090B0E] shadow-[0_0_20px_rgba(16,185,129,0.25)]'
              : 'bg-[#161920] text-[#9CA3AF] hover:text-white border border-[#262B36]'
          }`}
        >
          <ShieldCheck size={15} />
          <span>Cráneo, Remolinos & Permiso Reels</span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
            activeProfileTab === 'rgpd' ? 'bg-[#090B0E]/20 text-[#090B0E]' : 'bg-[#1C2029] text-[#34D399]'
          }`}>
            {client.consent?.signed ? 'OK ✓' : 'Pendiente'}
          </span>
        </button>
      </div>

      {/* CONTENIDO DE LA PESTAÑA 1: RECETAS DE CORTE & BONOS VIP */}
      {activeProfileTab === 'sessions' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* NUEVO: MAPA TÉCNICO DE SILLÓN / NAIL BAR / CABINA // BLUEPRINT 4 ZONAS (Lectura rápida a 1 metro) */}
          <div className={`luxury-card p-5 sm:p-6 border-l-4 ${isFemaleMode ? 'border-l-[#EC4899]' : 'border-l-[#10B981]'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#252A36]">
              <div>
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded ${isFemaleMode ? 'bg-[#EC4899] text-white' : 'bg-[#10B981] text-[#07090C]'} uppercase`}>
                    BLUEPRINT // 4 ZONAS
                  </span>
                  <span className={`text-[10px] font-mono ${isFemaleMode ? 'text-[#F9A8D4]' : 'text-[#34D399]'} uppercase tracking-wider`}>
                    {isNailsMode
                      ? 'ARQUITECTURA DE UÑAS, TALLA, BASE & CUTÍCULA'
                      : isPeluqueriaEsteticaMode
                      ? 'FÓRMULA DE COLORIMETRÍA, FIBRA & CABINA ESTÉTICA'
                      : 'MAPA DE MÁQUINA, CRÁNEO & NAVAJA'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-serif font-bold text-white uppercase mt-1">
                  {isNailsMode
                    ? `Diseño Maestro de Uñas — ${client.name}`
                    : isPeluqueriaEsteticaMode
                    ? `Pasaporte Técnico de Color & Cabina — ${client.name}`
                    : `Receta Maestra en Sillón — ${client.name}`}
                </h3>
              </div>

              {lastFormulaTreatment?.formula && (
                <button
                  type="button"
                  onClick={() => handleCopyFormula(lastFormulaTreatment.formula, lastFormulaTreatment.name)}
                  className="btn-author-secondary text-xs py-2 px-3.5 cursor-pointer self-start sm:self-auto"
                >
                  <Copy size={13} className={isFemaleMode ? 'text-[#EC4899]' : 'text-[#10B981]'} />
                  <span>{isNailsMode ? 'Repetir Diseño Hoy ⚡' : isPeluqueriaEsteticaMode ? 'Repetir Fórmula Hoy ⚡' : 'Repetir Receta Hoy ⚡'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4">
              {/* Zona 1 */}
              <div className="p-3.5 rounded-xl bg-[#0E1117] border border-[#252A36]">
                <span className={`text-[10px] font-mono font-bold ${isFemaleMode ? 'text-[#F472B6]' : 'text-[#10B981]'} uppercase block`}>
                  {isNailsMode
                    ? '[ZONA 01] FORMA, TALLA & BASE'
                    : isPeluqueriaEsteticaMode
                    ? '[ZONA 01] FÓRMULA COLOR / CABINA'
                    : '[ZONA 01] LATERALES & FADE'}
                </span>
                <p className="text-xs font-mono font-bold text-white mt-1.5 leading-snug">
                  {lastFormulaTreatment?.formula
                    ? lastFormulaTreatment.formula.split('|')[0]
                    : isNailsMode
                    ? 'Forma Almendra · Talla M · Acrílico Cover Pink'
                    : isPeluqueriaEsteticaMode
                    ? 'Raíz Tinte Orgánico 7.1 (20 vol) + Matiz Gloss 9.21'
                    : 'Skin Fade #000 Shaver → #0.5 → #1.5'}
                </p>
                <span className={`inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded ${isFemaleMode ? 'bg-[#EC4899]/15 text-[#F9A8D4] border border-[#EC4899]/30' : 'bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30'}`}>
                  {isNailsMode
                    ? 'Sellado de cutícula con torno ruso'
                    : isPeluqueriaEsteticaMode
                    ? 'Fórmula verificada en salón'
                    : 'Palanca abierta en transición'}
                </span>
              </div>

              {/* Zona 2 */}
              <div className="p-3.5 rounded-xl bg-[#0E1117] border border-[#252A36]">
                <span className={`text-[10px] font-mono font-bold ${isFemaleMode ? 'text-[#F9A8D4]' : 'text-[#34D399]'} uppercase block`}>
                  {isNailsMode
                    ? '[ZONA 02] LÁMINA UNGUEAL & CRECIMIENTO'
                    : isPeluqueriaEsteticaMode
                    ? '[ZONA 02] DIAGNÓSTICO CAPILAR / PIEL'
                    : '[ZONA 02] CRÁNEO & REMOLINOS'}
                </span>
                <p className="text-xs text-[#D1D5DB] mt-1.5 leading-snug">
                  {client.skinType || client.notes || 'Sin observaciones especiales anotadas.'}
                </p>
              </div>

              {/* Zona 3 */}
              <div className="p-3.5 rounded-xl bg-[#0E1117] border border-[#252A36]">
                <span className={`text-[10px] font-mono font-bold ${isFemaleMode ? 'text-[#F9A8D4]' : 'text-[#34D399]'} uppercase block`}>
                  {isNailsMode
                    ? '[ZONA 03] TONO, EFECTO & TOP COAT'
                    : isPeluqueriaEsteticaMode
                    ? '[ZONA 03] ACABADO & PROTOCOLO'
                    : '[ZONA 03] TOP & ACABADO'}
                </span>
                <p className="text-xs text-[#D1D5DB] mt-1.5 leading-snug">
                  {lastFormulaTreatment?.formula?.split('|')[1] ||
                    lastFormulaTreatment?.notes ||
                    (isNailsMode
                      ? 'Baby Boomer / Efecto Chrome Pearl + Aceite de almendras.'
                      : isPeluqueriaEsteticaMode
                      ? 'Brushing ondas suaves + Sérum sellador de puntas / Velo colágeno.'
                      : 'Tijera texturizada en frontal + Polvos mate de volumen.')}
                </p>
              </div>

              {/* Zona 4 */}
              <div className="p-3.5 rounded-xl bg-[#0E1117] border border-[#F59E0B]/40">
                <span className="text-[10px] font-mono font-bold text-[#FBBF24] uppercase flex items-center">
                  <ShieldAlert size={12} className="mr-1" />
                  {isNailsMode
                    ? '[ZONA 04] CUTÍCULA, LÁMPARA & ACRILATOS'
                    : isPeluqueriaEsteticaMode
                    ? '[ZONA 04] ALERGIAS PPD & SENSIBILIDAD'
                    : '[ZONA 04] BARBA & PIEL'}
                </span>
                <p className="text-xs text-[#F3F4F6] mt-1.5 leading-snug">
                  {client.allergies || 'Sin alergias ni sensibilidades reportadas.'}
                </p>
              </div>
            </div>
          </div>

          {/* Banner KUTZ Radar (Alertas de Retoque de Fade 15-21 días) */}
          {insights.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#262B36]">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/15 text-[#FBBF24] flex items-center justify-center">
                    <Flame size={15} />
                  </div>
                  <h3 className="text-sm font-serif font-bold text-white tracking-wide uppercase">
                    Radar de Retención KUTZ • Alerta de Refresco de Fade
                  </h3>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-[#FBBF24] bg-[#F59E0B]/15 px-2.5 py-1 rounded-md border border-[#F59E0B]/30">
                  Ciclo 15-21 Días Activo
                </span>
              </div>

              <div className="space-y-3">
                {insights.map((insight) => {
                  return (
                    <div 
                      key={insight.id}
                      className="luxury-card p-5 sm:p-6 border border-[#F59E0B]/50 relative overflow-hidden"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262B36]">
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-[#FBBF24]">
                              AVISO DE SILLÓN
                            </span>
                            <span className="text-[10px] text-[#6B7280]">•</span>
                            <span className="text-xs text-[#34D399] font-mono font-bold flex items-center">
                              <Clock size={12} className="mr-1 text-[#10B981]" />
                              Hace {insight.elapsedDays} días del último corte
                            </span>
                          </div>
                          <h4 className="text-base font-serif font-bold text-white mt-1 uppercase">
                            {insight.title}
                          </h4>
                          <p className="text-[11px] text-[#9CA3AF] font-mono">
                            Último servicio: <strong className="text-white">{insight.treatmentName}</strong> ({insight.lastDate})
                          </p>
                        </div>

                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-mono font-bold bg-[#F59E0B]/20 text-[#FBBF24] border border-[#F59E0B]/40 self-start sm:self-auto">
                          <span className="w-2 h-2 rounded-full bg-[#FBBF24] animate-ping"></span>
                          <span>{insight.statusLabel}</span>
                        </span>
                      </div>

                      <p className="py-3 text-xs text-[#D1D5DB] leading-relaxed">
                        {insight.message}
                      </p>

                      {/* Borrador WhatsApp con 1 clic */}
                      <div className="bg-[#0E1117] p-3.5 rounded-xl border border-[#252A36] text-[11px] text-[#9CA3AF] mb-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono uppercase font-bold text-[#10B981] flex items-center">
                            <MessageSquare size={12} className="mr-1.5" /> Plantilla WhatsApp lista para enviar a {client.name}
                          </span>
                          <span className="font-mono text-[10px] text-[#9CA3AF]">{client.phone}</span>
                        </div>
                        <p className="italic text-white bg-[#141820] p-3 rounded-lg border border-[#252A36] font-mono">
                          "{insight.whatsappDraft}"
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#262B36]">
                        <button
                          type="button"
                          onClick={() => handleNotifyWhatsApp(insight)}
                          className="btn-author-secondary text-xs py-2 px-4 cursor-pointer"
                        >
                          <MessageSquare size={14} />
                          <span>{copiedDraftId === insight.id ? '✓ Copiado' : 'Enviar WhatsApp ⚡'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleScheduleTouchUp(insight)}
                          className="btn-author text-xs py-2 px-4 cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>Registrar Retoque Hoy</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aviso / Notificación de Bonos */}
          {bonoNotice && (
            <div className="p-3.5 rounded-xl bg-[#10B981]/15 border border-[#10B981] text-xs text-[#34D399] font-mono font-bold flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center space-x-2">
                <CheckCircle2 size={16} className="text-[#10B981]" />
                <span>{bonoNotice}</span>
              </div>
              <button onClick={() => setBonoNotice('')} className="text-[#34D399] hover:text-white cursor-pointer">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Aviso de Receta Copiada */}
          {copiedFormulaNotice && (
            <div className="p-3.5 rounded-xl bg-[#141820] border border-[#10B981] text-xs text-[#34D399] font-mono font-bold flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center space-x-2">
                <Copy size={15} className="text-[#10B981]" />
                <span>{copiedFormulaNotice}</span>
              </div>
              <button onClick={() => setCopiedFormulaNotice('')} className="text-[#9CA3AF] hover:text-white cursor-pointer">
                <X size={14} />
              </button>
            </div>
          )}

          {/* MÓDULO DE BONOS VIP & MEMBRESÍAS DE CORTE (ESTILO BACKSTAGE VIP PASS) */}
          <div className="luxury-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#252A36]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] flex items-center justify-center">
                  <Ticket size={19} />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#10B981] uppercase tracking-wider block">
                    VIP BACKSTAGE PASS // LOYALTY
                  </span>
                  <h3 className="text-base font-serif font-bold text-white uppercase">
                    Bonos VIP & Membresías de Sillón
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNewBonoModalOpen(true)}
                className="btn-author-secondary text-xs py-2 px-3.5 cursor-pointer"
              >
                <Plus size={13} />
                <span>Nuevo Pass VIP</span>
              </button>
            </div>

            {bonos.length === 0 ? (
              <div className="p-5 rounded-xl bg-[#0E1117] border border-[#252A36] text-center space-y-2">
                <p className="text-xs text-[#9CA3AF] font-mono">
                  Este cliente no tiene ningún Pass VIP o membresía de cortes activa.
                </p>
                <button
                  type="button"
                  onClick={() => setIsNewBonoModalOpen(true)}
                  className="text-xs text-[#10B981] font-mono font-bold hover:underline cursor-pointer uppercase"
                >
                  + Emitir Pass VIP 4 Cortes Skin Fade + Barba
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bonos.map((bono, bIdx) => {
                  const used = Number(bono.usedSessions) || 0;
                  const total = Number(bono.totalSessions) || 4;
                  const remaining = Math.max(0, total - used);
                  const isCompleted = remaining === 0;

                  return (
                    <div 
                      key={bono.id} 
                      className={`vip-pass-card p-5 space-y-4 ${
                        isCompleted ? 'opacity-65 border-l-[#6B7280]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 pb-3 border-b border-dashed border-[#2A3140]">
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded ${
                              isCompleted 
                                ? 'bg-[#252A36] text-[#9CA3AF]' 
                                : 'bg-[#10B981] text-[#07090C]'
                            }`}>
                              {isCompleted ? 'PASS AGOTADO' : '★ VIP PASS ACTIVO'}
                            </span>
                            <span className="text-[10px] font-mono text-[#9CA3AF]">
                              SN//KZ-0{bIdx + 1}
                            </span>
                            {bono.price && (
                              <span className="text-xs font-mono font-bold text-[#34D399] bg-[#0E1117] px-2 py-0.5 rounded border border-[#252A36]">
                                {bono.price}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-serif font-bold text-white mt-2 uppercase">
                            {bono.name}
                          </h4>
                          {bono.notes && (
                            <p className="text-[11px] text-[#9CA3AF] mt-0.5 font-mono">
                              {bono.notes}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteBono(bono.id)}
                          className="text-[#6B7280] hover:text-rose-400 p-1 transition-colors cursor-pointer"
                          title="Eliminar Pass VIP"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Progreso visual de sesiones estilo bloques industriales */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-[#D1D5DB] text-[11px] uppercase">
                            CONSUMIDOS: {used}/{total} CORTES
                          </span>
                          <span className={`text-[11px] font-bold uppercase ${remaining > 0 ? 'text-[#34D399]' : 'text-[#9CA3AF]'}`}>
                            {remaining > 0 ? `QUEDAN ${remaining} DISPONIBLES` : 'COMPLETADO'}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          {Array.from({ length: total }).map((_, idx) => (
                            <div
                              key={idx}
                              className={`h-3.5 flex-1 rounded transition-all flex items-center justify-center text-[8px] font-mono font-bold ${
                                idx < used 
                                  ? 'bg-[#10B981] text-[#07090C] shadow-[0_0_10px_rgba(16,185,129,0.4)]' 
                                  : 'bg-[#0E1117] border border-[#2A3140] text-[#6B7280]'
                              }`}
                              title={`Corte ${idx + 1}`}
                            >
                              {idx < used ? '✓' : idx + 1}
                            </div>
                          ))}
                        </div>
                      </div>

                      {!isCompleted && (
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleConsumeBono(bono.id)}
                            className="btn-author text-xs py-2 px-4 cursor-pointer"
                          >
                            <Ticket size={14} />
                            <span>Consumir 1 Sesión ⚡</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cronología de Cortes & Recetas de Peines */}
          <div className="flex items-center justify-between pb-2 border-b border-[#262B36]">
            <h2 className="text-lg font-serif font-bold text-white flex items-center">
              <Scissors size={18} className="mr-2 text-[#10B981]" />
              Historial de Cortes, Graduación de Peines & Barba
            </h2>
            <button 
              onClick={() => setIsNewSessionOpen(true)}
              className="text-xs px-3.5 py-2 rounded-xl bg-[#1C2029] text-[#34D399] hover:bg-[#252A36] border border-[#10B981]/30 font-mono font-bold flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus size={13} />
              <span>Nuevo Corte</span>
            </button>
          </div>

          {treatments.length === 0 ? (
            <div className="bg-[#161920] rounded-3xl p-10 text-center space-y-4 border border-[#262B36]">
              <div className="w-14 h-14 rounded-2xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center mx-auto">
                <Scissors size={24} />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-white">Aún no hay cortes registrados</h3>
                <p className="text-xs text-[#9CA3AF] max-w-sm mx-auto mt-1">
                  Guarda la primera receta de peines y altura del Fade o haz la foto del "Antes" en el sillón.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button 
                  onClick={() => handleQuickSessionWithPhoto('before')}
                  className="btn-author text-xs py-2.5 px-5 cursor-pointer"
                >
                  <Camera size={14} className="mr-1.5 inline" />
                  <span>Foto "Antes"</span>
                </button>
                <button 
                  onClick={() => setIsNewSessionOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-[#1C2029] border border-[#262B36] text-white hover:bg-[#252A36] text-xs font-mono font-bold cursor-pointer"
                >
                  <span>Anotar Receta</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {treatments.map((t) => (
                <div key={t.id} className="bg-[#161920] rounded-3xl p-6 border border-[#262B36] shadow-lg space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262B36]">
                    <div>
                      <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-[#10B981]">
                        SERVICIO BARBER // SILLÓN
                      </span>
                      <h3 className="text-lg font-serif font-bold text-white mt-0.5">{t.name}</h3>
                      <p className="text-xs text-[#9CA3AF] font-mono">Fecha: <strong className="text-white">{t.date}</strong></p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => openPhotoSelector(t.id, 'before')} 
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border flex items-center transition-all cursor-pointer ${
                          t.photos?.before 
                            ? 'bg-[#10B981]/15 text-[#34D399] border-[#10B981]/40' 
                            : 'bg-[#1C2029] text-[#D1D5DB] border-[#262B36] hover:border-[#10B981]/40'
                        }`}
                      >
                        <Camera size={13} className="mr-1.5" />
                        {t.photos?.before ? 'Cambiar "Antes"' : '📸 Foto "Antes"'}
                      </button>

                      <button 
                        onClick={() => openPhotoSelector(t.id, 'after')} 
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border flex items-center transition-all cursor-pointer ${
                          t.photos?.after 
                            ? 'bg-[#10B981]/15 text-[#34D399] border-[#10B981]/40' 
                            : 'bg-[#1C2029] text-[#34D399] border-[#262B36] hover:border-[#10B981]/40'
                        }`}
                      >
                        <Camera size={13} className="mr-1.5" />
                        {t.photos?.after ? 'Cambiar "Después"' : '📸 Foto "Después"'}
                      </button>
                    </div>
                  </div>

                  {/* Receta Técnica de Peines / Fade con botón para Replicar */}
                  {t.formula && (
                    <div className="p-4 rounded-2xl bg-[#14171D] border border-[#10B981]/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#10B981] flex items-center mb-1">
                          <Scissors size={12} className="mr-1.5 text-[#10B981]" />
                          Receta Exacta de Peines, Fade & Barba:
                        </span>
                        <p className="font-mono text-xs text-white leading-relaxed">{t.formula}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyFormula(t.formula, t.name)}
                        className="self-start sm:self-auto px-3 py-2 rounded-xl bg-[#1C2029] border border-[#10B981]/40 hover:bg-[#10B981] hover:text-[#090B0E] text-[#34D399] text-[11px] font-mono font-bold flex items-center space-x-1.5 cursor-pointer shrink-0 transition-all"
                        title="Repetir exactamente este corte hoy"
                      >
                        <Copy size={12} />
                        <span>Repetir Receta</span>
                      </button>
                    </div>
                  )}

                  {/* Observaciones */}
                  <div className="p-3.5 rounded-2xl bg-[#1C2029] border border-[#262B36] text-xs text-[#D1D5DB] leading-relaxed">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#9CA3AF] block mb-0.5">
                      Acabado & Notas del Barbero:
                    </span>
                    {t.notes}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO DE LA PESTAÑA 2: LOOKBOOK ANTES / DESPUÉS & MORPH */}
      {activeProfileTab === 'gallery' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262B36]">
            <div>
              <h2 className="text-lg font-serif font-bold text-white flex items-center">
                <Camera size={18} className="mr-2 text-[#10B981]" />
                Lookbook Antes / Después & KUTZ Morph™
              </h2>
              <p className="text-xs text-[#9CA3AF] font-mono">
                {allClientPhotos.length} fotos de cortes registradas en la ficha de {client.name}
              </p>
            </div>

            {allClientPhotos.length >= 2 && (
              <button
                type="button"
                onClick={handleOpenGlobalMorph}
                className="px-4 py-2.5 rounded-xl bg-[#10B981] text-[#090B0E] hover:bg-[#34D399] text-xs font-serif font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-lg"
              >
                <Sparkles size={14} />
                <span>Reproducir KUTZ Morph™ Time-Lapse</span>
              </button>
            )}
          </div>

          {/* Banner de Estado RGPD para Instagram Reels / TikTok */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            client.consent?.permissions?.photosMarketing 
              ? 'bg-[#10B981]/10 border-[#10B981]/40 text-[#34D399]' 
              : 'bg-[#F59E0B]/10 border-[#F59E0B]/40 text-[#FBBF24]'
          }`}>
            <div className="flex items-center space-x-3 text-xs">
              <ShieldCheck size={20} />
              <div>
                <strong className="block font-serif text-white">
                  {client.consent?.permissions?.photosMarketing 
                    ? '✓ Publicación en Instagram Reels & TikTok Autorizada' 
                    : 'Uso Interno de Sillón (No subir a Redes)'}
                </strong>
                <span className="text-[11px] text-[#D1D5DB]">
                  {client.consent?.permissions?.photosMarketing 
                    ? 'El cliente firmó el permiso de imagen para publicar su cambio de look en el Instagram/TikTok de la barbería.' 
                    : 'Solicita la firma en pantalla antes de compartir en redes sociales.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setConsentModalTab('form');
                setIsConsentModalOpen(true);
              }}
              className="text-[11px] font-mono font-bold px-3 py-1.5 rounded-xl bg-[#161920] border border-current cursor-pointer hover:opacity-80"
            >
              Ver Firma
            </button>
          </div>

          {/* Comparadores Antes / Después por cada corte */}
          {treatments.filter(t => t.photos?.before || t.photos?.after).length === 0 ? (
            <div className="bg-[#161920] rounded-3xl p-10 text-center space-y-4 border border-[#262B36]">
              <div className="w-14 h-14 rounded-2xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center mx-auto">
                <Camera size={24} />
              </div>
              <h3 className="text-lg font-serif font-bold text-white">Aún no hay fotos en el Lookbook</h3>
              <p className="text-xs text-[#9CA3AF] max-w-sm mx-auto">
                Sube la foto del "Antes" y "Después" del corte para activar la cortinilla interactiva y el vídeo Morph.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (treatments[0]) {
                    openPhotoSelector(treatments[0].id, 'before');
                  } else {
                    handleQuickSessionWithPhoto('before');
                  }
                }}
                className="btn-author text-xs py-2.5 px-5 mx-auto cursor-pointer"
              >
                📸 Subir Primera Foto
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {treatments.filter(t => t.photos?.before || t.photos?.after).map((t) => (
                <div key={t.id} className="bg-[#161920] rounded-3xl p-6 border border-[#262B36] shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#262B36]">
                    <div>
                      <h4 className="text-base font-serif font-bold text-white">{t.name}</h4>
                      <p className="text-xs font-mono text-[#34D399]">{t.date} • {t.formula ? t.formula.slice(0, 65) + '...' : ''}</p>
                    </div>

                    {t.photos?.before && t.photos?.after && (
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setIsReelStudioOpen(true)}
                          className="px-3.5 py-2 rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#07090C] text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer transition-all shadow-[2px_2px_0px_#065F46]"
                        >
                          <Film size={13} />
                          <span>Reel 9:16 🎬</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTreatmentMorph(t)}
                          className="px-3.5 py-2 rounded-xl bg-[#1C2029] hover:bg-[#10B981] text-[#34D399] hover:text-[#090B0E] border border-[#10B981]/40 text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer transition-all"
                        >
                          <Sparkles size={13} />
                          <span>Morph Corte</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {t.photos?.before && t.photos?.after ? (
                    <PhotoCompare before={t.photos.before} after={t.photos.after} />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {t.photos?.before && (
                        <div className="relative rounded-2xl overflow-hidden border border-[#262B36]">
                          <span className="absolute top-3 left-3 bg-[#0F1115]/85 text-white text-[10px] font-mono tracking-wider uppercase font-bold px-3 py-1 rounded-lg">
                            ANTES
                          </span>
                          <img src={t.photos.before} alt="Antes" className="w-full h-64 object-cover" />
                        </div>
                      )}
                      {t.photos?.after && (
                        <div className="relative rounded-2xl overflow-hidden border border-[#262B36]">
                          <span className="absolute top-3 right-3 bg-[#10B981] text-[#090B0E] text-[10px] font-mono tracking-wider uppercase font-bold px-3 py-1 rounded-lg">
                            DESPUÉS // FRESH CUT
                          </span>
                          <img src={t.photos.after} alt="Después" className="w-full h-64 object-cover" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO DE LA PESTAÑA 3: CRÁNEO, REMOLINOS & PERMISO REELS/RGPD */}
      {activeProfileTab === 'rgpd' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
          
          {/* Card Sensibilidades Piel / Shaver */}
          <div className="bg-[#161920] rounded-3xl p-6 border-l-4 border-l-[#F59E0B] border border-[#262B36] shadow-lg space-y-3">
            <div className="flex items-center space-x-2 text-[#FBBF24]">
              <ShieldAlert size={20} />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#FBBF24]">
                Sensibilidad en Piel (Shaver, Navaja o Tinte)
              </h3>
            </div>
            <p className="text-xs text-[#E5E7EB] leading-relaxed bg-[#14171D] p-4 rounded-2xl border border-[#262B36]">
              {client.allergies || 'Sin sensibilidades reportadas en la ficha.'}
            </p>
          </div>

          {/* Card Morfología Craneal & Remolinos */}
          <div className="bg-[#161920] rounded-3xl p-6 border-l-4 border-l-[#10B981] border border-[#262B36] shadow-lg space-y-3">
            <div className="flex items-center space-x-2 text-[#34D399]">
              <Heart size={20} />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#34D399]">
                Morfología Craneal, Remolinos & Styling
              </h3>
            </div>
            <p className="text-xs text-[#E5E7EB] leading-relaxed bg-[#14171D] p-4 rounded-2xl border border-[#262B36]">
              {client.notes || 'Sin especificaciones personales anotadas.'}
            </p>
          </div>

          {/* Card Consentimiento RGPD & Derechos de Imagen Reels */}
          <div className="bg-[#161920] rounded-3xl p-6 border border-[#262B36] shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[#10B981]">
                <ShieldCheck size={20} />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Permisos de Imagen (Reels / TikTok) & RGPD
                </h3>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md ${
                client.consent?.signed ? 'bg-[#10B981]/15 text-[#34D399]' : 'bg-[#F59E0B]/15 text-[#FBBF24]'
              }`}>
                {client.consent?.signed ? 'Firmado ✓' : 'Pendiente'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#14171D] border border-[#262B36] text-xs space-y-2 font-mono">
              <div className="flex justify-between text-[11px] border-b border-[#262B36] pb-1.5">
                <span className="text-[#9CA3AF]">Fecha de firma:</span>
                <strong className="text-white">{client.consent?.formattedDate || 'Pendiente'}</strong>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9CA3AF]">1. Ficha Técnica Barber:</span>
                <span className={client.consent?.permissions?.treatment ? 'text-[#34D399] font-bold' : 'text-[#6B7280]'}>
                  {client.consent?.permissions?.treatment ? '✓ Autorizado' : 'Pendiente'}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9CA3AF]">2. Fotos Lookbook Interno:</span>
                <span className={client.consent?.permissions?.photosPrivate ? 'text-[#34D399] font-bold' : 'text-[#6B7280]'}>
                  {client.consent?.permissions?.photosPrivate ? '✓ Autorizado' : 'No'}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9CA3AF]">3. Instagram Reels / TikTok:</span>
                <span className={client.consent?.permissions?.photosMarketing ? 'text-[#34D399] font-bold' : 'text-[#6B7280]'}>
                  {client.consent?.permissions?.photosMarketing ? '✓ Autorizado' : 'No'}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9CA3AF]">4. Avisos Corte WhatsApp:</span>
                <span className={client.consent?.permissions?.communications ? 'text-[#34D399] font-bold' : 'text-[#6B7280]'}>
                  {client.consent?.permissions?.communications ? '✓ Autorizado' : 'No'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setConsentModalTab('form');
                  setIsConsentModalOpen(true);
                }}
                className="py-2.5 px-3 rounded-xl border border-[#262B36] bg-[#1C2029] text-white hover:border-[#10B981]/50 text-xs font-mono font-bold flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <PenTool size={13} className="text-[#10B981]" />
                <span>{client.consent?.signed ? 'Editar Firma' : 'Firmar en Pantalla'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConsentModalTab('document');
                  setIsConsentModalOpen(true);
                }}
                className="py-2.5 px-3 rounded-xl bg-[#10B981] text-[#090B0E] hover:bg-[#34D399] text-xs font-serif font-bold flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <FileText size={13} />
                <span>Ver Certificado</span>
              </button>
            </div>
          </div>

          {/* Card Privacidad & Derechos ARSOPOL (Art. 15-21 RGPD) */}
          <div
            data-testid="arsopol-panel"
            className="bg-[#161920] rounded-3xl p-6 border border-[#262B36] shadow-lg space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#34D399] flex items-center gap-1.5">
                <ShieldCheck size={16} />
                <span>Privacidad &amp; Derechos ARSOPOL</span>
              </h3>
              <span className="text-[10px] font-mono text-[#9CA3AF]">Art. 15–21 RGPD</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#14171D] border border-[#262B36] text-xs space-y-2 font-mono">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9CA3AF]">Responsable:</span>
                <strong className="text-white truncate ml-2">{activeShop?.name || 'KUTZ BARBER'}</strong>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9CA3AF]">Historial / Fotos:</span>
                <strong className="text-white">{treatments.length} cortes · {allClientPhotos.length} fotos</strong>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9CA3AF]">Marketing / WhatsApp:</span>
                <span className={(client.consent?.permissions?.photosMarketing || client.consent?.permissions?.communications || client.consent?.permissions?.whatsappReminders) ? 'text-[#34D399] font-bold' : 'text-[#9CA3AF]'}>
                  {(client.consent?.permissions?.photosMarketing || client.consent?.permissions?.communications || client.consent?.permissions?.whatsappReminders) ? 'Activos' : 'Sin permisos opcionales'}
                </span>
              </div>
              {client.consent?.revokedAt && (
                <div className="text-[10px] text-[#FBBF24] pt-1 border-t border-[#262B36]">
                  Permisos opcionales revocados: {new Date(client.consent.revokedAt).toLocaleString('es-ES')}
                </div>
              )}
            </div>

            {arsopolNotice && (
              <div className="p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#34D399] text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>{arsopolNotice}</span>
              </div>
            )}

            <div className="space-y-2.5">
              {/* 1. Portabilidad (Art. 20 RGPD) */}
              <button
                type="button"
                onClick={() => {
                  const safeSlug = String(client.name || 'cliente')
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '') || 'cliente';
                  const exportPayload = {
                    legalBasis: 'Art. 20 RGPD — Derecho a la Portabilidad de Datos',
                    exportedAt: new Date().toISOString(),
                    policyVersion: '2026.1',
                    responsible: {
                      shopName: activeShop?.name || 'KUTZ // BARBER STUDIO',
                      shopSlug: activeShopSlug || 'kutz-madrid',
                      address: activeShop?.address || '',
                      phone: activeShop?.phone || ''
                    },
                    personalData: {
                      id: client.id,
                      name: client.name,
                      phone: client.phone || '',
                      email: client.email || '',
                      allergies: client.allergies || '',
                      notes: client.notes || '',
                      lastVisit: client.lastVisit || ''
                    },
                    serviceHistory: treatments,
                    bonos,
                    consent: client.consent || { signed: false }
                  };
                  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${safeSlug}-datos-rgpd.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  setArsopolNotice(`Portabilidad exportada: ${safeSlug}-datos-rgpd.json`);
                  setTimeout(() => setArsopolNotice(''), 4000);
                }}
                className="w-full py-2.5 px-3 rounded-xl border border-[#262B36] bg-[#1C2029] hover:bg-[#252A36] text-[#34D399] text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <Download size={14} />
                <span>Portabilidad: Descargar datos JSON</span>
              </button>

              {/* 2. Revocar permisos opcionales */}
              <button
                type="button"
                onClick={() => {
                  const revokedAt = new Date().toISOString();
                  const nextConsent = {
                    ...(client.consent || { signed: false, policyVersion: '2026.1' }),
                    revokedAt,
                    permissions: {
                      ...(client.consent?.permissions || {}),
                      photosMarketing: false,
                      communications: false,
                      whatsappReminders: false
                    }
                  };
                  updateClientConsent(client.id, nextConsent);
                  setArsopolNotice('Permisos opcionales (Redes/Reels y WhatsApp) revocados y sincronizados.');
                  setTimeout(() => setArsopolNotice(''), 4500);
                }}
                className="w-full py-2.5 px-3 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#FBBF24] text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <ShieldAlert size={14} />
                <span>Revocar permisos opcionales (Redes &amp; WhatsApp)</span>
              </button>

              {/* 3. Derecho de Supresión (Art. 17 RGPD) con confirmación segura */}
              {!isConfirmDeleteOpen ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#FCA5A5] text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Derecho de Supresión (Borrar datos personales)</span>
                </button>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/60 space-y-2.5">
                  <p className="text-[11px] text-[#FECACA] leading-snug">
                    <strong>Confirmación de Supresión (Art. 17 RGPD):</strong> Se eliminarán permanentemente los datos personales, historial y firma de <strong>{client.name}</strong> en este dispositivo y en la nube.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsConfirmDeleteOpen(false)}
                      className="flex-1 py-2 px-3 rounded-lg bg-[#1C2029] text-[#D1D5DB] text-xs font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteClient(client.id);
                        navigate('/clients');
                      }}
                      className="flex-1 py-2 px-3 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-black cursor-pointer"
                    >
                      Confirmar Borrado
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* MODAL 1: Selector de Fuente de Foto (Cámara vs Galería) */}
      {isPhotoPickerOpen && (
        <div className="fixed inset-0 bg-[#090B0E]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#161920] rounded-3xl border border-[#262B36] shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#262B36]">
              <div>
                <h3 className="text-lg font-serif font-bold text-white">
                  Subir Foto "{activeUpload.type === 'before' ? 'Antes' : 'Después'}"
                </h3>
                <p className="text-[11px] text-[#9CA3AF]">Selecciona cómo capturar el corte</p>
              </div>
              <button 
                onClick={() => setIsPhotoPickerOpen(false)}
                className="w-7 h-7 rounded-lg bg-[#1C2029] flex items-center justify-center text-[#9CA3AF] hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full p-4 rounded-2xl border border-[#262B36] hover:border-[#10B981] bg-[#1C2029] transition-all flex items-center space-x-3.5 text-left cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Camera size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Abrir Cámara en Sillón</h4>
                  <p className="text-[11px] text-[#9CA3AF]">Hacer foto directa ahora mismo</p>
                </div>
              </button>

              <button
                onClick={() => galleryInputRef.current?.click()}
                className="w-full p-4 rounded-2xl border border-[#262B36] hover:border-[#10B981] bg-[#1C2029] transition-all flex items-center space-x-3.5 text-left cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 text-[#34D399] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ImageIcon size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Elegir del Carrete / Galería</h4>
                  <p className="text-[11px] text-[#9CA3AF]">Subir foto guardada en el móvil o PC</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Registrar Nuevo Corte & Receta de Peines */}
      {isNewSessionOpen && (
        <div className="fixed inset-0 bg-[#090B0E]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#161920] rounded-3xl border border-[#262B36] shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#262B36] flex justify-between items-center bg-[#14171D]">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#10B981] block">
                  NUEVA RECETA DE SILLÓN
                </span>
                <h3 className="text-xl font-serif font-bold text-white">
                  Registrar Corte, Fade & Barba
                </h3>
                <p className="text-xs text-[#9CA3AF] font-mono">Cliente: {client.name}</p>
              </div>
              <button 
                onClick={() => {
                  if (isListening) stopVoiceDictation();
                  setSpeechError(null);
                  setIsNewSessionOpen(false);
                }}
                className="w-8 h-8 rounded-xl bg-[#1C2029] border border-[#262B36] text-[#9CA3AF] hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="p-6 space-y-4">
              {/* Servicios frecuentes de Barbería */}
              {activeModeConfig?.quickTreatments && (
                <div>
                  <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#10B981] mb-1.5">
                    Cortes & Rituales Frecuentes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeModeConfig.quickTreatments.map((qt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSessionForm(prev => ({ ...prev, name: qt }))}
                        className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          sessionForm.name === qt
                            ? 'bg-[#10B981] text-[#090B0E] font-bold border-[#10B981]'
                            : 'bg-[#1C2029] text-[#D1D5DB] border-[#262B36] hover:border-[#10B981]/50'
                        }`}
                      >
                        + {qt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">
                  Servicio Realizado *
                </label>
                <input 
                  type="text" 
                  required
                  value={sessionForm.name} 
                  onChange={e => setSessionForm({...sessionForm, name: e.target.value})} 
                  className="w-full px-4 py-3 bg-[#1C2029] border border-[#262B36] rounded-xl text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981] transition-all"
                  placeholder="Ej. Skin Fade Alto + Perfilado de Barba a Navaja..." 
                />
              </div>

              {/* Receta Técnica de Peines, Fade y Barba */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#D1D5DB]">
                    Receta de Corte (Peines / Guías, Altura de Fade y Barba)
                  </label>
                  <span className="text-[10px] font-mono text-[#10B981] font-bold flex items-center">
                    <Scissors size={11} className="mr-1" />
                    Guard Specs
                  </span>
                </div>

                {/* Botón inteligente: Copiar última receta utilizada */}
                {lastFormulaTreatment && (
                  <div className="mb-2.5 p-2.5 rounded-xl bg-[#14171D] border border-[#10B981]/30 flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0 flex-1 mr-2">
                      <Copy size={13} className="text-[#10B981] shrink-0" />
                      <span className="text-[11px] text-[#9CA3AF] truncate font-mono">
                        Última receta: <strong className="text-white">{lastFormulaTreatment.formula}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSessionForm(prev => ({ ...prev, formula: lastFormulaTreatment.formula }))}
                      className="text-[11px] font-mono font-bold px-2.5 py-1 bg-[#10B981] text-[#090B0E] rounded-lg cursor-pointer shrink-0 transition-all"
                    >
                      Usar igual
                    </button>
                  </div>
                )}

                <input 
                  type="text" 
                  value={sessionForm.formula || ''} 
                  onChange={e => setSessionForm({...sessionForm, formula: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-[#1C2029] border border-[#262B36] rounded-xl text-xs font-mono text-[#34D399] placeholder-[#6B7280] focus:outline-none focus:border-[#10B981] transition-all"
                  placeholder="Ej. Shaver #000 → #0.5 (1 dedo) → #1.5 abierta | Superior: Tijera | Barba: Navaja + Toalla Caliente" 
                />

                {/* Asistente Rápido de Receta en 1 Clic (Adaptado a Uñas / Peluquería & Estética / Barbería) */}
                <div className="mt-2.5 p-3 rounded-xl bg-[#14171D] border border-[#262B36] space-y-2.5">
                  <div className={`flex items-center space-x-1.5 text-[10px] font-mono font-bold uppercase tracking-wider ${isFemaleMode ? 'text-[#F472B6]' : 'text-[#10B981]'}`}>
                    <Scissors size={12} />
                    <span>
                      {isNailsMode
                        ? 'Constructor Rápido de Diseño de Uñas (Pulsa para añadir):'
                        : isPeluqueriaEsteticaMode
                        ? 'Constructor Rápido de Colorimetría & Cabina (Pulsa para añadir):'
                        : 'Constructor Rápido de Receta Barber (Pulsa para añadir):'}
                    </span>
                  </div>

                  {/* Grupo 1 */}
                  <div>
                    <span className="text-[10px] font-mono text-[#9CA3AF] block mb-1">
                      {isNailsMode
                        ? '1. Forma & Talla de Uña:'
                        : isPeluqueriaEsteticaMode
                        ? '1. Colorimetría, Raíz & Oxidantes:'
                        : '1. Peines / Guías de Máquina:'}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(isNailsMode
                        ? ['Forma Almendra', 'Forma Coffin / Ballerina', 'Cuadrada Suave (Squoval)', 'Talla S', 'Talla M', 'Talla L']
                        : isPeluqueriaEsteticaMode
                        ? ['Raíz Tinte Orgánico (20 vol)', 'Balayage Mano Alzada', 'Babylights + Money Piece', 'Matiz Gloss (6 vol, 12m)', 'Protector Plex Paso 1+2']
                        : ['Shaver #000', 'Guía #0 (Al ras)', 'Guía #0.5 (Media)', 'Guía #1', 'Guía #1.5 (Especial)', 'Guía #2', 'Guía #3']
                      ).map(guard => (
                        <button
                          key={guard}
                          type="button"
                          onClick={() => handleAppendBarberSpec(guard)}
                          className="text-[10px] font-mono px-2 py-1 rounded-md bg-[#1C2029] border border-[#262B36] hover:border-[#10B981] text-[#34D399] transition-colors cursor-pointer"
                        >
                          + {guard}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grupo 2 */}
                  <div>
                    <span className="text-[10px] font-mono text-[#9CA3AF] block mb-1">
                      {isNailsMode
                        ? '2. Sistema Acrílico / Gel / Nivelación:'
                        : isPeluqueriaEsteticaMode
                        ? '2. Tratamiento Capilar & Brushing:'
                        : '2. Tipo de Fade & Superior:'}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(isNailsMode
                        ? ['Acrílico Cover Pink', 'Relleno Acrílico', 'Base Rubber Rosada #02', 'Nivelación Ápice', 'Torno Manicura Rusa']
                        : isPeluqueriaEsteticaMode
                        ? ['Bótox Capilar Ácido Hialurónico', 'Alisado Keratina Orgánica', 'Corte Visagismo & Capas', 'Brushing Ondas Suaves']
                        : ['Skin Fade Alto', 'Mid Drop Fade', 'Low Taper Fade', 'Burst Fade / Mullet', 'Superior a Tijera Point Cutting']
                      ).map(fade => (
                        <button
                          key={fade}
                          type="button"
                          onClick={() => handleAppendBarberSpec(fade)}
                          className="text-[10px] font-mono px-2 py-1 rounded-md bg-[#1C2029] border border-[#262B36] hover:border-[#10B981] text-[#D1D5DB] transition-colors cursor-pointer"
                        >
                          + {fade}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grupo 3 */}
                  <div>
                    <span className="text-[10px] font-mono text-[#9CA3AF] block mb-1">
                      {isNailsMode
                        ? '3. Efecto, Color & Spa:'
                        : isPeluqueriaEsteticaMode
                        ? '3. Protocolo en Cabina Facial & Mirada:'
                        : '3. Ritual de Barba & Styling:'}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(isNailsMode
                        ? ['Baby Boomer Milky', 'Francesa Micro Blanca', 'Efecto Chrome Pearl Glazed', 'Pedicura Spa Sales Marinas', 'Aceite Cutículas Almendra']
                        : isPeluqueriaEsteticaMode
                        ? ['Higiene Facial + Ultrasonidos', 'Radiofrecuencia Facial 40°C', 'Peeling Luminosidad Vit C', 'Masaje Drenaje Corporal', 'Diseño Cejas & Lifting Pestañas']
                        : ['Perfilado a Navaja', 'Toalla Caliente + Ozono', 'Polvos de Textura Mate', 'Piedra Alumbre + Bálsamo']
                      ).map(beard => (
                        <button
                          key={beard}
                          type="button"
                          onClick={() => handleAppendBarberSpec(beard)}
                          className="text-[10px] font-mono px-2 py-1 rounded-md bg-[#1C2029] border border-[#262B36] hover:border-[#10B981] text-[#FBBF24] transition-colors cursor-pointer"
                        >
                          + {beard}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#D1D5DB]">
                    Notas de Acabado & Remolinos
                  </label>
                  <button
                    type="button"
                    onClick={toggleVoiceDictation}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      isListening
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : 'bg-[#1C2029] text-[#34D399] border border-[#262B36] hover:border-[#10B981]'
                    }`}
                  >
                    <Mic size={13} className={isListening ? 'animate-pulse text-rose-400' : 'text-[#10B981]'} />
                    <span>{isListening ? 'Detener Voz' : 'Dictar por Voz'}</span>
                  </button>
                </div>

                {isListening && (
                  <div className="mb-2 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-mono text-rose-300">
                      🎙️ Escuchando notas del barbero...
                    </span>
                  </div>
                )}

                {speechError && (
                  <div className="mb-2 p-2.5 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl text-xs text-[#FBBF24]">
                    {speechError}
                  </div>
                )}

                <textarea 
                  value={sessionForm.notes} 
                  onChange={e => setSessionForm({...sessionForm, notes: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-[#1C2029] border border-[#262B36] rounded-xl text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981] transition-all h-20 resize-none"
                  placeholder="Ej. Remolino en coronilla controlado dejando 2cm. Quedó brutal el perfilado de barba..." 
                />
              </div>

              <div className="pt-3 flex justify-end space-x-3 border-t border-[#262B36]">
                <button 
                  type="button" 
                  onClick={() => {
                    if (isListening) stopVoiceDictation();
                    setSpeechError(null);
                    setIsNewSessionOpen(false);
                  }} 
                  className="px-4 py-2 text-xs font-mono font-bold text-[#9CA3AF] hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-author text-xs py-2.5 px-6 cursor-pointer"
                >
                  Guardar Receta en Historial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: KUTZ Morph Visual Time-Lapse Player */}
      <LuminaMorphModal
        isOpen={isMorphOpen}
        onClose={() => setIsMorphOpen(false)}
        photos={morphPhotos}
        clientName={client.name}
        treatmentName={morphTreatmentName}
        marketingAuthorized={client.consent?.permissions?.photosMarketing ?? false}
      />

      {/* MODAL 4: Consentimiento Informado RGPD & Firma Digital */}
      <RGPDConsentModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        client={client}
        onSaveConsent={updateClientConsent}
        initialTab={consentModalTab}
      />

      {/* MODAL 5: Crear Nuevo Bono VIP & Pack de Cortes */}
      {isNewBonoModalOpen && (
        <div className="fixed inset-0 bg-[#090B0E]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#161920] rounded-3xl border border-[#262B36] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#262B36] flex justify-between items-center bg-[#14171D]">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
                  <Ticket size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">
                    Nuevo Bono VIP / Membresía
                  </h3>
                  <p className="text-xs text-[#9CA3AF] font-mono">Cliente: {client.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsNewBonoModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#1C2029] border border-[#262B36] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleCreateBono} className="p-6 space-y-4">
              {/* Sugerencias Rápidas de Bonos */}
              <div>
                <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#10B981] mb-1.5">
                  {isNailsMode
                    ? 'Packs de Uñas, Manicura & Pedicura Más Vendidos:'
                    : isPeluqueriaEsteticaMode
                    ? 'Packs de Peluquería & Cabina Estética Más Vendidos:'
                    : 'Packs de Barbería Más Vendidos:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(isNailsMode
                    ? [
                        { name: 'Bono Nails VIP: 4 Rellenos Acrílicos + Hidratación', sessions: 4, price: '125€' },
                        { name: 'Pack 4 Manicuras Semipermanentes con Refuerzo', sessions: 4, price: '90€' },
                        { name: 'Pack 3 Manicuras Refuerzo + Pedicura Completa & Spa', sessions: 3, price: '145€' },
                        { name: 'Bono 3 Higienes Faciales Profundas + Manicura', sessions: 3, price: '135€' }
                      ]
                    : isPeluqueriaEsteticaMode
                    ? [
                        { name: 'Bono Color & Brushing: 4 Retoques de Raíz + Peinado', sessions: 4, price: '140€' },
                        { name: 'Bono Cabina Facial: 4 Sesiones Radiofrecuencia + Vitaminas', sessions: 4, price: '175€' },
                        { name: 'Membresía Salón & Cabina: 4 Botox Capilar + Higiene Facial', sessions: 4, price: '190€' },
                        { name: 'Bono Relax: 4 Masajes Drenaje Corporal + Mirada', sessions: 4, price: '150€' }
                      ]
                    : [
                        { name: 'Membresía VIP: 4 Cortes Skin Fade + Barba', sessions: 4, price: '95€' },
                        { name: 'Bono Crew: 4 Cortes Fade Mensual', sessions: 4, price: '68€' },
                        { name: 'Pack Trimestral 3 Cortes + Ritual Barba', sessions: 3, price: '75€' },
                        { name: 'Bono 5 Perfilados de Barba & Toalla Caliente', sessions: 5, price: '65€' }
                      ]
                  ).map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBonoForm({
                        name: sug.name,
                        totalSessions: sug.sessions,
                        price: sug.price,
                        notes: 'Incluye bebida de cortesía en sillón y prioridad de agenda.'
                      })}
                      className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#1C2029] text-[#34D399] border border-[#262B36] hover:border-[#10B981] transition-all cursor-pointer"
                    >
                      + {sug.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">
                  Nombre del Bono o Membresía *
                </label>
                <input 
                  type="text" 
                  required
                  value={bonoForm.name} 
                  onChange={e => setBonoForm({ ...bonoForm, name: e.target.value })} 
                  className="w-full px-4 py-2.5 bg-[#1C2029] border border-[#262B36] rounded-xl text-sm text-white focus:outline-none focus:border-[#10B981] transition-all"
                  placeholder="Ej. Membresía 4 Cortes Skin Fade..." 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">
                    Nº de Cortes *
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    max="50"
                    required
                    value={bonoForm.totalSessions} 
                    onChange={e => setBonoForm({ ...bonoForm, totalSessions: parseInt(e.target.value, 10) || 1 })} 
                    className="w-full px-4 py-2.5 bg-[#1C2029] border border-[#262B36] rounded-xl text-sm text-white focus:outline-none focus:border-[#10B981] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">
                    Precio Pack
                  </label>
                  <input 
                    type="text" 
                    value={bonoForm.price} 
                    onChange={e => setBonoForm({ ...bonoForm, price: e.target.value })} 
                    className="w-full px-4 py-2.5 bg-[#1C2029] border border-[#262B36] rounded-xl text-sm text-white focus:outline-none focus:border-[#10B981] transition-all"
                    placeholder="Ej. 85€" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">
                  Detalles incluidos
                </label>
                <textarea 
                  value={bonoForm.notes} 
                  onChange={e => setBonoForm({ ...bonoForm, notes: e.target.value })} 
                  className="w-full px-4 py-2 bg-[#1C2029] border border-[#262B36] rounded-xl text-xs text-white focus:outline-none focus:border-[#10B981] transition-all h-20 resize-none"
                  placeholder="Ej. Incluye lavado detox, cejas a navaja y bebida..." 
                />
              </div>

              <div className="pt-3 flex justify-end space-x-3 border-t border-[#262B36]">
                <button 
                  type="button" 
                  onClick={() => setIsNewBonoModalOpen(false)} 
                  className="px-4 py-2 text-xs font-mono font-bold text-[#9CA3AF] hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-author text-xs py-2.5 px-6 cursor-pointer flex items-center space-x-1.5"
                >
                  <Check size={14} />
                  <span>Activar Bono VIP</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reel Studio 9:16 */}
      <ReelStudioModal
        isOpen={isReelStudioOpen}
        onClose={() => setIsReelStudioOpen(false)}
        client={client}
        treatment={treatments[0]}
      />
    </div>
  );
};

export default ClientProfile;
