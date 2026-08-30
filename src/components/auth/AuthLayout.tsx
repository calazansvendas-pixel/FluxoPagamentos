import React from 'react';
import { Building2 } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

// Casca visual compartilhada pelas telas de Login e Criar conta: mesma marca e
// paleta do resto do app (ver Header.tsx), mas sem os controles de navegação —
// ninguém vê o Simulador antes de logar.
export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col text-slate-900 bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-100 via-sky-50 to-white border border-sky-200 flex items-center justify-center text-sky-600 shadow-xs">
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
      </header>
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
};
