import React from 'react';
import { Building2, Calendar, Menu, RotateCcw } from 'lucide-react';

interface HeaderProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  onResetAll: () => void;
  onToggleSidebar: () => void;
  onNavigateHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDate,
  onDateChange,
  onResetAll,
  onToggleSidebar,
  onNavigateHome
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* LOGO E BOTÃO TOGGLE SIDEBAR */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-800 transition-all focus:outline-none cursor-pointer"
            title="Alternar Menu Lateral"
          >
            <Menu className="w-5 h-5 text-sky-600" />
          </button>

          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={onNavigateHome}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-100 via-sky-50 to-white border border-sky-200 flex items-center justify-center text-sky-600 shadow-xs group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <div className="flex items-baseline">
                <span className="text-xl text-slate-900 font-bold tracking-tight">CALAZANS</span>
                <span className="text-xs text-sky-600 ml-1.5 uppercase font-light tracking-widest">IMOB</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Simulador & Políticas Comerciais</p>
            </div>
          </div>
        </div>

        {/* CONTROLES DO CABEÇALHO */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onResetAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-slate-600 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            title="Limpar formulário e iniciar nova simulação"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nova Simulação</span>
          </button>

          <div className="hidden md:flex items-center gap-2 bg-slate-50 px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-sky-600" />
            <span className="font-medium">Hoje é:</span>
            <input 
              type="date" 
              value={currentDate} 
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent border-none text-slate-900 font-semibold focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
