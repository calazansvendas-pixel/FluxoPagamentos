import React from 'react';
import { UserCheck, Wallet, Building, Edit3, ChevronRight, KeyRound } from 'lucide-react';
import { Product, SimulationData } from '../types';
import { formatCurrency, formatDeliveryText } from '../utils/formatters';
import { ensureProductConditions } from '../utils/calculations';

interface SimulatorViewProps {
  simulationData: SimulationData;
  onSimulationDataChange: (data: SimulationData) => void;
  products: Product[];
  selectedConditions: Record<string, string>;
  onSelectCondition: (productId: string, conditionId: string) => void;
  onAdvanceToDetails: (product: Product, conditionId: string) => void;
  onNavigateToPolicies: () => void;
}

export const SimulatorView: React.FC<SimulatorViewProps> = ({
  simulationData,
  onSimulationDataChange,
  products,
  selectedConditions,
  onSelectCondition,
  onAdvanceToDetails,
  onNavigateToPolicies
}) => {
  const handleCurrencyInputChange = (field: keyof SimulationData, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '');
    const numericVal = digits ? parseInt(digits, 10) / 100 : 0;
    onSimulationDataChange({
      ...simulationData,
      [field]: numericVal
    });
  };

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* COLUNA ESQUERDA: DADOS DO CLIENTE E RECURSOS (7 COLS) */}
          <div className="lg:col-span-7 space-y-5 w-full">
            
            {/* 1. IDENTIFICAÇÃO */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                  1. Identificação Geral
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Imobiliária Parcial / Parceira
                  </label>
                  <input
                    type="text"
                    value={simulationData.agency}
                    onChange={(e) => onSimulationDataChange({ ...simulationData, agency: e.target.value })}
                    placeholder="Nome da imobiliária (opcional)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-sky-600 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nome do Cliente *
                  </label>
                  <input
                    type="text"
                    value={simulationData.clientName}
                    onChange={(e) => onSimulationDataChange({ ...simulationData, clientName: e.target.value })}
                    placeholder="Digite o nome do cliente"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-sky-600 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* 2. RECURSOS FINANCEIROS */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                  <Wallet className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                  2. Recursos e Capacidade Financeira
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Renda Familiar Comprovada (R$)
                  </label>
                  <input
                    type="text"
                    value={simulationData.income > 0 ? formatCurrency(simulationData.income) : ''}
                    onChange={(e) => handleCurrencyInputChange('income', e.target.value)}
                    placeholder="R$ 0,00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-sky-600 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Subsídio Concedido (R$)
                  </label>
                  <input
                    type="text"
                    value={simulationData.subsidy > 0 ? formatCurrency(simulationData.subsidy) : ''}
                    onChange={(e) => handleCurrencyInputChange('subsidy', e.target.value)}
                    placeholder="R$ 0,00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-emerald-600 focus:bg-white focus:outline-none focus:border-sky-600 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Saldo do FGTS Utilizável (R$)
                  </label>
                  <input
                    type="text"
                    value={simulationData.fgts > 0 ? formatCurrency(simulationData.fgts) : ''}
                    onChange={(e) => handleCurrencyInputChange('fgts', e.target.value)}
                    placeholder="R$ 0,00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-sky-600 focus:bg-white focus:outline-none focus:border-sky-600 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Valor de Financiamento Estimado (R$)
                  </label>
                  <input
                    type="text"
                    value={simulationData.financing > 0 ? formatCurrency(simulationData.financing) : ''}
                    onChange={(e) => handleCurrencyInputChange('financing', e.target.value)}
                    placeholder="R$ 0,00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-sky-600 transition-all"
                  />
                </div>
              </div>

              {/* OPERAÇÃO E OPÇÕES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="block text-xs font-semibold text-slate-700 mb-2">
                    Percentual de Financiamento
                  </span>
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-700">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="finPercent"
                        value="90"
                        checked={simulationData.finPercent === 0.9}
                        onChange={() => onSimulationDataChange({ ...simulationData, finPercent: 0.9 })}
                        className="text-sky-600 focus:ring-sky-600 cursor-pointer"
                      />
                      <span>90% (Máximo)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="finPercent"
                        value="80"
                        checked={simulationData.finPercent === 0.8}
                        onChange={() => onSimulationDataChange({ ...simulationData, finPercent: 0.8 })}
                        className="text-sky-600 focus:ring-sky-600 cursor-pointer"
                      />
                      <span>80% (Padrão)</span>
                    </label>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="block text-xs font-semibold text-slate-700 mb-2">
                    1º Imóvel do Cliente?
                  </span>
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-700">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="firstHome"
                        value="SIM"
                        checked={simulationData.isFirstHome}
                        onChange={() => onSimulationDataChange({ ...simulationData, isFirstHome: true })}
                        className="text-sky-600 focus:ring-sky-600 cursor-pointer"
                      />
                      <span>SIM</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="firstHome"
                        value="NAO"
                        checked={!simulationData.isFirstHome}
                        onChange={() => onSimulationDataChange({ ...simulationData, isFirstHome: false })}
                        className="text-sky-600 focus:ring-sky-600 cursor-pointer"
                      />
                      <span>NÃO</span>
                    </label>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* COLUNA DIREITA: EMPREENDIMENTOS E CONDIÇÕES (5 COLS) */}
          <div className="lg:col-span-5 w-full">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs w-full">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                    <Building className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    3. Empreendimentos
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onNavigateToPolicies}
                  className="text-[11px] font-semibold text-sky-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" /> Editar Políticas
                </button>
              </div>

              {/* LISTA DE PRODUTOS DINÂMICA */}
              <div className="space-y-3">
                {products.map((p) => {
                  const prodWithConds = ensureProductConditions({ ...p });
                  const selectedCondId = selectedConditions[p.id] || '';
                  const borderBg = p.isFeatured ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-white';
                  const badgeDot = p.isFeatured ? 'bg-amber-500' : 'bg-sky-600';
                  const titleClass = p.isFeatured ? 'text-amber-900' : 'text-slate-900';

                  const deliveryText = formatDeliveryText(p.deliveryDatePhase1, p.deliveryDatePhase2, p.deliveryDate);

                  return (
                    <div key={p.id} className={`p-3.5 rounded-xl border ${borderBg} shadow-2xs w-full hover:shadow-xs transition-shadow`}>
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                        <span className={`text-xs font-bold ${titleClass} uppercase flex items-center gap-1.5`}>
                          <span className={`w-2 h-2 rounded-full ${badgeDot}`}></span> {p.name}
                        </span>
                        {deliveryText && (
                          <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                            <KeyRound className="w-3 h-3 text-sky-600 shrink-0" /> Chaves: {deliveryText}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 w-full">
                        <select
                          value={selectedCondId}
                          onChange={(e) => onSelectCondition(p.id, e.target.value)}
                          className="flex-1 min-w-0 py-2 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-sky-600 cursor-pointer font-medium"
                        >
                          <option value="">-- Selecionar Condição --</option>
                          {prodWithConds.conditions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          disabled={!selectedCondId}
                          onClick={() => onAdvanceToDetails(prodWithConds, selectedCondId)}
                          className={`shrink-0 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 border ${
                            selectedCondId 
                              ? 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 hover:text-sky-800 border-sky-200/80 hover:border-sky-300 cursor-pointer shadow-2xs' 
                              : 'bg-slate-100/60 text-slate-400 border-slate-200/60 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          <span>Avançar</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
};
