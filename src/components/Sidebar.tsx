import React from 'react';
import { Calculator, FileCheck2, Building2, FileSpreadsheet } from 'lucide-react';
import { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isCollapsed: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed
}) => {
  const navItems = [
    {
      id: 'simulator' as ActiveTab,
      label: 'Simulador de Crédito',
      icon: Calculator
    },
    {
      id: 'details' as ActiveTab,
      label: 'Sinal c/ Banco Direto',
      icon: FileCheck2
    },
    {
      id: 'ficha-morar' as ActiveTab,
      label: 'Sinal c/ Morar',
      icon: FileCheck2
    },
    {
      id: 'policies' as ActiveTab,
      label: 'Políticas & Empreendimentos',
      icon: Building2
    },
    {
      id: 'import-table' as ActiveTab,
      label: 'Importar Tabela (Excel)',
      icon: FileSpreadsheet
    }
  ];

  const inactiveClass = "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-left cursor-pointer";
  const activeClass = "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-sky-50 text-sky-600 border border-sky-100 transition-all text-left cursor-pointer shadow-2xs";

  return (
    <aside 
      className={`${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-white border-r border-slate-200 flex-shrink-0 transition-all duration-300 ease-in-out z-20 flex flex-col p-4 shadow-xs`}
    >
      <div className="space-y-6">
        <div>
          {!isCollapsed && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-2">
              Navegação
            </span>
          )}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={isActive ? activeClass : inactiveClass}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-600' : 'text-sky-600/80'}`} />
                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
};
