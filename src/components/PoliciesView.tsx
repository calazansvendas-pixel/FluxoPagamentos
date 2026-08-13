import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Layers, PlusCircle, ShieldCheck, Calculator, Building, ShieldAlert, Eraser, Save } from 'lucide-react';
import { CommercialCondition, Product, SelectedUnit } from '../types';
import { formatCurrency, parseCurrency } from '../utils/formatters';
import { calculatePresentValue, ensureProductConditions } from '../utils/calculations';

interface PoliciesViewProps {
  products: Product[];
  activeProductId: string;
  onSelectProduct: (productId: string) => void;
  onSaveProductPolicy: (updatedProduct: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onOpenNewProductModal: () => void;
  onShowToast: (message: string) => void;
  clientIncome: number;
  selectedUnits?: Record<string, SelectedUnit>;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({
  products,
  activeProductId,
  onSelectProduct,
  onSaveProductPolicy,
  onDeleteProduct,
  onOpenNewProductModal,
  onShowToast,
  clientIncome,
  selectedUnits
}) => {
  const activeProd = products.find(p => p.id === activeProductId) || products[0];
  const prodWithConds = activeProd ? ensureProductConditions({ ...activeProd }) : null;

  const [activeConditionId, setActiveConditionId] = useState<string>('');
  
  // Local editable state for current product & condition
  const [productName, setProductName] = useState<string>('');
  const [deliveryDatePhase1, setDeliveryDatePhase1] = useState<string>('');
  const [deliveryDatePhase2, setDeliveryDatePhase2] = useState<string>('');
  const [isFeatured, setIsFeatured] = useState<boolean>(false);

  // Condition parameters state
  const [numParcelas, setNumParcelas] = useState<number>(72);
  const [sinalMinimo, setSinalMinimo] = useState<string>('R$ 2.000,00');
  const [riscoRendaPct, setRiscoRendaPct] = useState<number>(30);
  const [riscoImovelPct, setRiscoImovelPct] = useState<number>(25);
  const [mesesTabela1, setMesesTabela1] = useState<number>(36);
  const [taxaJuros1, setTaxaJuros1] = useState<number>(0.0);
  const [mesesTabela2, setMesesTabela2] = useState<number>(72);
  const [taxaJuros2, setTaxaJuros2] = useState<number>(1.0);
  const [policyText, setPolicyText] = useState<string>('');

  // Sync state when active product changes
  useEffect(() => {
    if (prodWithConds) {
      setProductName(prodWithConds.name);
      setDeliveryDatePhase1(prodWithConds.deliveryDatePhase1 || prodWithConds.deliveryDate || '');
      setDeliveryDatePhase2(prodWithConds.deliveryDatePhase2 || '');
      setIsFeatured(prodWithConds.isFeatured || false);

      const firstCond = prodWithConds.conditions[0];
      if (firstCond) {
        setActiveConditionId(firstCond.id);
        loadConditionData(firstCond);
      }
    }
  }, [activeProductId, products]);

  const loadConditionData = (cond: CommercialCondition) => {
    setNumParcelas(cond.numParcelas || 72);
    setSinalMinimo(cond.sinalMinimo || 'R$ 2.000,00');
    setRiscoRendaPct(cond.riscoRendaPct !== undefined ? cond.riscoRendaPct : 30);
    setRiscoImovelPct(cond.riscoImovelPct !== undefined ? cond.riscoImovelPct : 25);
    setMesesTabela1(cond.mesesTabela1 !== undefined ? cond.mesesTabela1 : 36);
    setTaxaJuros1(cond.taxaJuros1 !== undefined ? cond.taxaJuros1 : 0.0);
    setMesesTabela2(cond.mesesTabela2 !== undefined ? cond.mesesTabela2 : 72);
    setTaxaJuros2(cond.taxaJuros2 !== undefined ? cond.taxaJuros2 : 1.0);
    setPolicyText(cond.policy || '');
  };

  const handleSelectCondition = (condId: string) => {
    setActiveConditionId(condId);
    if (prodWithConds) {
      const cond = prodWithConds.conditions.find(c => c.id === condId);
      if (cond) {
        loadConditionData(cond);
      }
    }
  };

  const handleAddNewCondition = () => {
    if (!prodWithConds) return;
    const condName = prompt("Digite o nome da nova Condição Comercial (ex: Sinal em 36X c/ Morar):");
    if (!condName || !condName.trim()) return;

    const newCondId = `cond_${prodWithConds.id}_${Date.now()}`;
    const newCond: CommercialCondition = {
      id: newCondId,
      name: condName.trim(),
      numParcelas: 72,
      sinalMinimo: 'R$ 2.000,00',
      riscoRendaPct: 30,
      riscoImovelPct: 25,
      mesesTabela1: 36,
      taxaJuros1: 0.0,
      mesesTabela2: 72,
      taxaJuros2: 1.0,
      policy: `POLÍTICA COMERCIAL DA CONDIÇÃO ${condName.toUpperCase()}:\n- Digite aqui as regras comerciais desta opção.`
    };

    const updatedProd: Product = {
      ...prodWithConds,
      name: productName.trim() || prodWithConds.name,
      deliveryDate: deliveryDatePhase1 || deliveryDatePhase2 || '',
      deliveryDatePhase1,
      deliveryDatePhase2,
      isFeatured,
      conditions: [...prodWithConds.conditions, newCond]
    };

    onSaveProductPolicy(updatedProd);
    setActiveConditionId(newCondId);
    loadConditionData(newCond);
    onShowToast(`Nova condição "${condName}" adicionada com sucesso!`);
  };

  const handleDeleteCondition = () => {
    if (!prodWithConds) return;
    if (prodWithConds.conditions.length <= 1) {
      onShowToast("É necessário manter ao menos uma condição comercial por empreendimento.");
      return;
    }

    const remainingConds = prodWithConds.conditions.filter(c => c.id !== activeConditionId);
    const updatedProd: Product = {
      ...prodWithConds,
      name: productName.trim() || prodWithConds.name,
      deliveryDate: deliveryDatePhase1 || deliveryDatePhase2 || '',
      deliveryDatePhase1,
      deliveryDatePhase2,
      isFeatured,
      conditions: remainingConds
    };

    onSaveProductPolicy(updatedProd);
    const nextCond = remainingConds[0];
    setActiveConditionId(nextCond.id);
    loadConditionData(nextCond);
    onShowToast("Condição comercial removida!");
  };

  const handleSavePolicy = () => {
    if (!prodWithConds) return;
    if (!productName.trim()) {
      onShowToast("O nome do empreendimento é obrigatório.");
      return;
    }

    const updatedConditions = prodWithConds.conditions.map(c => {
      if (c.id === activeConditionId) {
        return {
          ...c,
          numParcelas,
          sinalMinimo,
          riscoRendaPct,
          riscoImovelPct,
          mesesTabela1,
          taxaJuros1,
          mesesTabela2,
          taxaJuros2,
          policy: policyText
        };
      }
      return c;
    });

    const updatedProd: Product = {
      ...prodWithConds,
      name: productName.trim(),
      deliveryDate: deliveryDatePhase1 || deliveryDatePhase2 || '',
      deliveryDatePhase1,
      deliveryDatePhase2,
      isFeatured,
      conditions: updatedConditions
    };

    onSaveProductPolicy(updatedProd);
    onShowToast(`Política e regras do empreendimento "${productName}" salvas!`);
  };

  // CALCULATIONS FOR DISPLAY CARDS
  // Only calculate values if simulation income / selected unit data exists
  const rendaVal = clientIncome > 0 ? clientIncome * (riscoRendaPct / 100) : 0;

  const appliedRatePct = (numParcelas <= mesesTabela1) ? taxaJuros1 : taxaJuros2;
  const vpVal = rendaVal > 0 ? calculatePresentValue(appliedRatePct, numParcelas, rendaVal) : 0;

  let propertyPrice = 0;
  let propertyITBI = 0;
  const selUnit = selectedUnits?.[activeProductId];

  if (selUnit && selUnit.torre && selUnit.unidade && prodWithConds?.tableInfo?.rows) {
    const matchingRow = prodWithConds.tableInfo.rows.find(
      r => String(r[1]).trim() === selUnit.torre.trim() && String(r[2]).trim() === selUnit.unidade.trim()
    );
    if (matchingRow) {
      if (matchingRow[7] !== undefined) propertyPrice = parseCurrency(matchingRow[7]);
      if (matchingRow[8] !== undefined) propertyITBI = parseCurrency(matchingRow[8]);
    }
  }

  const totalBaseImovel = propertyPrice + propertyITBI;
  const riscoImovelVal = totalBaseImovel > 0 ? totalBaseImovel * (riscoImovelPct / 100) : 0;
  const minRiskVal = (vpVal > 0 && riscoImovelVal > 0) ? Math.min(vpVal, riscoImovelVal) : 0;

  const activeCondObj = prodWithConds?.conditions.find(c => c.id === activeConditionId);

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-sky-600 font-bold block">
            Gestão Comercial & Regras de Cálculo
          </span>
          <h1 className="text-xl font-bold font-heading text-slate-900">
            Políticas e Regras dos Empreendimentos
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Selecione o empreendimento e a condição comercial para configurar regras e políticas específicas de crédito.
          </p>
        </div>
        <button
          onClick={onOpenNewProductModal}
          type="button"
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Empreendimento</span>
        </button>
      </div>

      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        
        {/* 1. SELETOR DE EMPREENDIMENTO */}
        <div className="bg-sky-50/60 p-4 rounded-xl border border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-sky-600 uppercase tracking-wider mb-1.5">
              1. Selecione o Empreendimento para Visualizar / Editar
            </label>
            <select
              value={activeProductId}
              onChange={(e) => onSelectProduct(e.target.value)}
              className="w-full bg-white font-bold text-slate-900 border border-slate-300 rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-sky-600 text-xs shadow-xs cursor-pointer"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <span className="text-[10px] font-bold text-amber-700 uppercase bg-amber-50 px-2.5 py-1 rounded border border-amber-200 shrink-0">
              {isFeatured ? 'Destaque Principal' : 'Empreendimento'}
            </span>
            <button
              onClick={() => onDeleteProduct(activeProductId)}
              type="button"
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 bg-rose-50 px-3 py-2 rounded-xl border border-rose-100 transition-all shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir</span>
            </button>
          </div>
        </div>

        {/* FORMULÁRIO DE EDIÇÃO DO EMPREENDIMENTO */}
        <div className="space-y-5 text-xs pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nome do Empreendimento *
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-sky-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Previsão de Entrega - 1ª Fase
              </label>
              <input
                type="date"
                value={deliveryDatePhase1}
                onChange={(e) => setDeliveryDatePhase1(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-sky-600 cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Previsão de Entrega - 2ª Fase <span className="font-normal text-slate-400">(Opcional)</span>
              </label>
              <input
                type="date"
                value={deliveryDatePhase2}
                onChange={(e) => setDeliveryDatePhase2(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-sky-600 cursor-pointer"
              />
            </div>
          </div>

          {/* 2. SELETOR DE CONDIÇÃO COMERCIAL */}
          <div className="bg-gradient-to-br from-amber-50/80 via-amber-50/30 to-white p-4 rounded-xl border border-amber-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <label className="block text-xs font-extrabold text-amber-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>2. Selecione a Condição Comercial para Configurar a Política</span>
                </label>
                <select
                  value={activeConditionId}
                  onChange={(e) => handleSelectCondition(e.target.value)}
                  className="w-full bg-white font-bold text-slate-900 border border-amber-300 rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-sky-600 text-xs shadow-xs cursor-pointer"
                >
                  {prodWithConds?.conditions.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={handleAddNewCondition}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Nova Condição</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCondition}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-semibold rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Condição</span>
                </button>
              </div>
            </div>
          </div>

          {/* PARÂMETROS DA POLÍTICA DE CRÉDITO PARA A CONDIÇÃO SELECIONADA */}
          <div className="bg-gradient-to-r from-sky-50/80 via-slate-50 to-white p-4 rounded-xl border border-sky-100 space-y-4">
            <div className="flex items-center justify-between border-b border-sky-100 pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Parâmetros da Política de Crédito (<span className="text-sky-600 font-extrabold">{activeCondObj?.name || '--'}</span>)
                </span>
              </div>
            </div>

            {/* PRIMEIRA LINHA DE PARÂMETROS DA POLÍTICA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              
              {/* 1. NÚMERO DE PARCELAS COM "X" INTERNO */}
              <div className="lg:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1 truncate" title="Número de Parcelas">
                  1. Nº Parcelas
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={numParcelas}
                    onChange={(e) => setNumParcelas(parseInt(e.target.value, 10) || 1)}
                    className="w-full pl-3 pr-7 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-center focus:outline-none focus:border-sky-600"
                  />
                  <span className="absolute right-3 font-extrabold text-slate-500 text-xs pointer-events-none">X</span>
                </div>
              </div>

              {/* 2. SINAL MÍNIMO */}
              <div className="lg:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">
                  2. Sinal Mínimo
                </label>
                <input
                  type="text"
                  value={sinalMinimo}
                  onChange={(e) => setSinalMinimo(e.target.value)}
                  placeholder="Ex: R$ 2.000,00 ou 5%"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-semibold text-emerald-600 focus:outline-none focus:border-sky-600"
                />
              </div>

              {/* 3. RISCO DA RENDA (%) E VALOR CALCULADO */}
              <div className="lg:col-span-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 truncate" title="Risco da Renda (%)">
                    3. Risco Renda %
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={riscoRendaPct}
                      onChange={(e) => setRiscoRendaPct(parseFloat(e.target.value) || 0)}
                      className="w-full pl-2 pr-6 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-center focus:outline-none focus:border-sky-600"
                    />
                    <span className="absolute right-2.5 font-extrabold text-slate-500 text-xs pointer-events-none">%</span>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 truncate" title="Valor Calculado da Renda">
                    Valor Renda
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formatCurrency(rendaVal)}
                    className="w-full px-2 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 text-center cursor-not-allowed text-xs truncate"
                  />
                </div>
              </div>

              {/* 4. RISCO DO IMÓVEL (%) E VALOR CALCULADO */}
              <div className="lg:col-span-4 grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 truncate" title="Risco do Imóvel (%)">
                    4. Risco Imóvel %
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={riscoImovelPct}
                      onChange={(e) => setRiscoImovelPct(parseFloat(e.target.value) || 0)}
                      className="w-full pl-2 pr-6 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-center focus:outline-none focus:border-sky-600"
                    />
                    <span className="absolute right-2.5 font-extrabold text-slate-500 text-xs pointer-events-none">%</span>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 truncate" title="Valor do Risco (Preço Venda + ITBI) * %">
                    Val. Risco Imóvel
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formatCurrency(riscoImovelVal)}
                    className="w-full px-2 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-emerald-700 text-center cursor-not-allowed text-xs truncate"
                  />
                </div>
              </div>

            </div>

            {/* SEGUNDA LINHA: FAIXAS DE TAXA DE JUROS POR PRAZO DE PARCELAS */}
            <div className="pt-3 border-t border-sky-100/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              {/* FAIXA 1 */}
              <div className="lg:col-span-6 grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 truncate text-[11px]" title="Até Qtd. Meses (Faixa 1)">
                    5. Prazo Faixa 1 (Meses)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={mesesTabela1}
                      onChange={(e) => setMesesTabela1(parseInt(e.target.value, 10) || 1)}
                      className="w-full pl-2 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 text-center focus:outline-none focus:border-sky-600 text-xs"
                    />
                    <span className="absolute right-2 font-bold text-slate-400 text-[10px] pointer-events-none">M</span>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 truncate text-[11px]" title="Taxa Juros Faixa 1 (% a.m.)">
                    Taxa Juros 1 (% a.m.)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={taxaJuros1}
                      onChange={(e) => setTaxaJuros1(parseFloat(e.target.value) || 0)}
                      className="w-full pl-2 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-emerald-600 text-center focus:outline-none focus:border-sky-600 text-xs"
                    />
                    <span className="absolute right-1.5 font-bold text-slate-400 text-[10px] pointer-events-none">% a.m.</span>
                  </div>
                </div>
              </div>

              {/* FAIXA 2 */}
              <div className="lg:col-span-6 grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 truncate text-[11px]" title="Até Qtd. Meses (Faixa 2)">
                    6. Prazo Faixa 2 (Meses)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={mesesTabela2}
                      onChange={(e) => setMesesTabela2(parseInt(e.target.value, 10) || 1)}
                      className="w-full pl-2 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 text-center focus:outline-none focus:border-sky-600 text-xs"
                    />
                    <span className="absolute right-2 font-bold text-slate-400 text-[10px] pointer-events-none">M</span>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 truncate text-[11px]" title="Taxa Juros Faixa 2 (% a.m.)">
                    Taxa Juros 2 (% a.m.)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={taxaJuros2}
                      onChange={(e) => setTaxaJuros2(parseFloat(e.target.value) || 0)}
                      className="w-full pl-2 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-emerald-600 text-center focus:outline-none focus:border-sky-600 text-xs"
                    />
                    <span className="absolute right-1.5 font-bold text-slate-400 text-[10px] pointer-events-none">% a.m.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* TERCEIRA LINHA: VALOR PRESENTE (VP EXCEL) E LIMITES DE RISCO (3 CARDS DIVIDIDOS EM 1/3 CADA) */}
            <div className="pt-3 border-t border-sky-100/80 grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
              
              {/* 1/3: VP RISCO RENDA */}
              <div className="bg-emerald-50/90 p-3.5 rounded-xl border border-emerald-200/90 flex flex-col justify-between space-y-2 shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block font-bold text-emerald-950 text-[11px] uppercase tracking-wider truncate">
                      7. VP Risco Renda
                    </span>
                    <span className="text-[10px] text-emerald-700 font-medium block truncate">
                      Aplicado: {appliedRatePct.toFixed(2)}% a.m. ({numParcelas}x)
                    </span>
                  </div>
                </div>
                <div className="pt-1">
                  <input
                    type="text"
                    readOnly
                    value={formatCurrency(vpVal)}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-extrabold text-emerald-700 text-center text-sm shadow-2xs cursor-not-allowed"
                  />
                </div>
              </div>

              {/* 2/3: VALOR RISCO DO IMÓVEL */}
              <div className="bg-sky-50/90 p-3.5 rounded-xl border border-sky-200/90 flex flex-col justify-between space-y-2 shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-sky-100 text-sky-600 shrink-0">
                    <Building className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block font-bold text-slate-900 text-[11px] uppercase tracking-wider truncate">
                      8. Val. Risco Imóvel
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium block truncate">
                      =(Preço Venda + ITBI) * % Risco
                    </span>
                  </div>
                </div>
                <div className="pt-1">
                  <input
                    type="text"
                    readOnly
                    value={formatCurrency(riscoImovelVal)}
                    className="w-full px-3 py-2 bg-white border border-sky-300 rounded-xl font-extrabold text-sky-600 text-center text-sm shadow-2xs cursor-not-allowed"
                  />
                </div>
              </div>

              {/* 3/3: MÍNIMO ENTRE VP E RISCO IMÓVEL */}
              <div className="bg-amber-50/90 p-3.5 rounded-xl border border-amber-200/90 flex flex-col justify-between space-y-2 shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block font-bold text-amber-950 text-[11px] uppercase tracking-wider truncate">
                      9. Mínimo (VP x Imóvel)
                    </span>
                    <span className="text-[10px] text-amber-700 font-medium block truncate">
                      Limite Máximo p/ Pró-Soluto Total
                    </span>
                  </div>
                </div>
                <div className="pt-1">
                  <input
                    type="text"
                    readOnly
                    value={formatCurrency(minRiskVal)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-extrabold text-amber-800 text-center text-sm shadow-2xs cursor-not-allowed"
                  />
                </div>
              </div>

            </div>

          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block font-semibold text-slate-700">
                Regras de Cálculo e Política Comercial da Condição Selecionada
              </label>
              <button
                type="button"
                onClick={() => setPolicyText('')}
                className="text-[11px] font-semibold text-slate-500 hover:text-sky-600 flex items-center gap-1 cursor-pointer"
              >
                <Eraser className="w-3 h-3" />
                <span>Limpar Quadro</span>
              </button>
            </div>
            <textarea
              rows={6}
              value={policyText}
              onChange={(e) => setPolicyText(e.target.value)}
              placeholder="Digite as novas regras comerciais e de cálculo para esta condição..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-sky-600"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="editProductFeatured"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="rounded text-sky-600 focus:ring-sky-600 cursor-pointer"
            />
            <label htmlFor="editProductFeatured" className="font-semibold text-slate-700 cursor-pointer">
              Definir como Empreendimento em Destaque
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSavePolicy}
              type="button"
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
