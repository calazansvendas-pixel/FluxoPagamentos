import React from 'react';
import { Info } from 'lucide-react';

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-5 right-5 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 z-50 animate-bounce-short">
      <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-300">
        <Info className="w-4 h-4" />
      </div>
      <span className="text-xs font-medium">{message}</span>
    </div>
  );
};
