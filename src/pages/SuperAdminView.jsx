import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SuperAdminManager from '../components/SuperAdminManager';

export default function SuperAdminView() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0C0F] text-[#F3F4F6] p-4 sm:p-6 lg:p-8 flex flex-col justify-start">
      <div className="max-w-5xl w-full mx-auto mb-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#141820] hover:bg-[#1B202B] border border-[#252A36] text-xs font-bold text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={15} />
          <span>Volver al Salón</span>
        </button>
      </div>

      <div className="w-full">
        <SuperAdminManager showCloseButton={false} />
      </div>
    </div>
  );
}
