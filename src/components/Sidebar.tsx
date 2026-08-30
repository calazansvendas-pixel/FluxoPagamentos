import React from 'react';
import { ActiveTab } from '../types';
import { ConditionKind } from '../utils/calculations';
import { TELAS_APP } from '../config/telasApp';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab, variant?: ConditionKind) => void;
  isCollapsed: boolean;
  // Condição comercial atualmente ativa: necessário porque "Sinal c/ Banco
  // Direto" e "Parcelamento Morar" compartilham a mesma aba ('details'), então
  // só o activeTab não basta para saber qual dos dois itens do menu destacar.
  activeConditionKind?: ConditionKind;
  // Chaves de TELAS_APP liberadas para o usuário logado. undefined = mostra
  // tudo (compatibilidade/uso sem login ainda ligado); Administrador também
  // sempre vê tudo, independente do que estiver na lista.
  telasLiberadas?: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed,
  activeConditionKind,
  telasLiberadas
}) => {
  // Fonte única das telas (src/config/telasApp.ts) — o mesmo painel de
  // permissões do Administrador lê essa lista, então uma aba nova cadastrada
  // ali aparece aqui automaticamente, sem precisar tocar neste arquivo.
  const navItems = telasLiberadas
    ? TELAS_APP.filter(t => telasLiberadas.includes(t.key))
    : TELAS_APP;

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
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              // Itens com "variant" compartilham a aba 'details' com outro item
              // (Sinal c/ Banco Direto x Parcelamento Morar) — só fica ativo o
              // que também bate com a condição comercial selecionada no momento.
              const isActive = item.variant
                ? activeTab === item.tab && activeConditionKind === item.variant
                : activeTab === item.tab;
              return (
                <button
                  key={`${item.tab}-${item.variant || idx}`}
                  onClick={() => onSelectTab(item.tab, item.variant)}
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
