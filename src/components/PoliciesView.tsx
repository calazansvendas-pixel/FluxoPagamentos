import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Layers, 
  PlusCircle, 
  ShieldCheck, 
  Calculator, 
  Building, 
  ShieldAlert, 
  Eraser, 
  Save, 
  X, 
  Sparkles, 
  CheckCircle2 
} from 'lucide-react';
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

// Helpers para conversão e formatação robusta de decimais e inteiros
const parseDecimal = (val: string | number | undefined, defaultVal = 0): number => {
  if (val === undefined || val === null) return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const cleaned = String(val).trim().replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? defaultVal : parsed;
};

const formatDecimalBR = (num: number, minDec = 1, maxDec = 2): string => {
  if (isNaN(num)) return '0';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: minDec, maximumFractionDigits: maxDec });
};

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

  // String states for flexible decimal and numeric inputs (accepts both ',' and '.')
  const [numParcelasStr, setNumParcelasStr] = useState<string>('72');
  const [sinalMinimo, setSinalMinimo] = useState<string>('R$ 2.000,00');
  const [riscoRendaStr, setRiscoRendaStr] = useState<string>('30,0');
  const [riscoImovelStr, setRiscoImovelStr] = useState<string>('25,0');
  const [mesesTabela1Str, setMesesTabela1Str] = useState<string>('36');
  const [taxaJuros1Str, setTaxaJuros1Str] = useState<string>('0,00');
  const [mesesTabela2Str, setMesesTabela2Str] = useState<string>('72');
  const [taxaJuros2Str, setTaxaJuros2Str] = useState<string>('1,00');
  const [policyText, setPolicyText] = useState<string>('');

  // Modal State for New Commercial Condition
  const [isNewConditionModalOpen, setIsNewConditionModalOpen] = useState<boolean>(false);
  const [newConditionName, setNewConditionName] = useState<string>('');
  const newCondInputRef = useRef<HTMLInputElement>(null);

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
    const numP = cond.numParcelas || 72;
    const rr = cond.riscoRendaPct !== undefined ? cond.riscoRendaPct : 30;
    const ri = cond.riscoImovelPct !== undefined ? cond.riscoImovelPct : 25;
    const m1 = cond.mesesTabela1 !== undefined ? cond.mesesTabela1 : 36;
    const t1 = cond.taxaJuros1 !== undefined ? cond.taxaJuros1 : 0.0;
    const m2 = cond.mesesTabela2 !== undefined ? cond.mesesTabela2 : 72;
    const t2 = cond.taxaJuros2 !== undefined ? cond.taxaJuros2 : 1.0;

    const parsedSinal = parseCurrency(cond.sinalMinimo);
    const formattedSinal = formatCurrency(parsedSinal > 0 ? parsedSinal : 2000);

    setNumParcelasStr(String(numP));
    setSinalMinimo(formattedSinal);
    setRiscoRendaStr(formatDecimalBR(rr, 1, 2));
    setRiscoImovelStr(formatDecimalBR(ri, 1, 2));
    setMesesTabela1Str(String(m1));
    setTaxaJuros1Str(formatDecimalBR(t1, 2, 2));
    setMesesTabela2Str(String(m2));
    setTaxaJuros2Str(formatDecimalBR(t2, 2, 2));
    setPolicyText(cond.policy || '');
  };

  // Dynamic parsed numeric values for live calculations
  const numParcelas = parseInt(numParcelasStr, 10) || 1;
  const riscoRendaPct = parseDecimal(riscoRendaStr, 30);
  const riscoImovelPct = parseDecimal(riscoImovelStr, 25);
  const mesesTabela1 = parseInt(mesesTabela1Str, 10) || 1;
  const taxaJuros1 = parseDecimal(taxaJuros1Str, 0);
  const mesesTabela2 = parseInt(mesesTabela2Str, 10) || 1;
  const taxaJuros2 = parseDecimal(taxaJuros2Str, 1);

  const handleSelectCondition = (condId: string) => {
    if (!prodWithConds) return;

    const parsedCurrentSinal = parseCurrency(sinalMinimo);
    const formattedCurrentSinal = formatCurrency(parsedCurrentSinal > 0 ? parsedCurrentSinal : 2000);

    // Salva preventivamente o estado atual da condição antes de trocar
    const updatedConditions = (prodWithConds.conditions || []).map(c => {
      if (c.id === activeConditionId) {
        return {
          ...c,
          numParcelas,
          sinalMinimo: formattedCurrentSinal,
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
      name: productName.trim() || prodWithConds.name,
      deliveryDate: deliveryDatePhase1 || deliveryDatePhase2 || '',
      deliveryDatePhase1,
      deliveryDatePhase2,
      isFeatured,
      numParcelas,
      conditions: updatedConditions
    };
    onSaveProductPolicy(updatedProd);

    setActiveConditionId(condId);
    const targetCond = updatedConditions.find(c => c.id === condId);
    if (targetCond) {
      loadConditionData(targetCond);
    }
  };

  const handleOpenNewConditionModal = () => {
    setNewConditionName('');
    setIsNewConditionModalOpen(true);
    setTimeout(() => {
      newCondInputRef.current?.focus();
    }, 60);
  };

  const handleConfirmNewCondition = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prodWithConds) return;
    const trimmedName = newConditionName.trim();
    if (!trimmedName) {
      onShowToast("Informe um nome para a nova condição comercial.");
      return;
    }

    const newCondId = `cond_${prodWithConds.id}_${Date.now()}`;
    const newCond: CommercialCondition = {
      id: newCondId,
      name: trimmedName,
      numParcelas: 72,
      sinalMinimo: 'R$ 2.000,00',
      riscoRendaPct: 30,
      riscoImovelPct: 25,
      mesesTabela1: 36,
      taxaJuros1: 0.0,
      mesesTabela2: 72,
      taxaJuros2: 1.0,
      policy: `POLÍTICA COMERCIAL DA CONDIÇÃO ${trimmedName.toUpperCase()}:\n- Parcelamento da entrada em até 72x.\n- Sinal mínimo a partir de R$ 2.000,00.\n- Taxa de 0,00% a.m. até 36 meses e 1,00% a.m. até 72 meses.`
    };

    const parsedCurrentSinal = parseCurrency(sinalMinimo);
    const formattedCurrentSinal = formatCurrency(parsedCurrentSinal > 0 ? parsedCurrentSinal : 2000);

    // Salvar as edições atuais da condição em tela
    const currentConditionsUpdated = (prodWithConds.conditions || []).map(c => {
      if (c.id === activeConditionId) {
        return {
          ...c,
          numParcelas,
          sinalMinimo: formattedCurrentSinal,
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
      name: productName.trim() || prodWithConds.name,
      deliveryDate: deliveryDatePhase1 || deliveryDatePhase2 || '',
      deliveryDatePhase1,
      deliveryDatePhase2,
      isFeatured,
      conditions: [...currentConditionsUpdated, newCond]
    };

    onSaveProductPolicy(updatedProd);
    setActiveConditionId(newCondId);
    loadConditionData(newCond);
    setIsNewConditionModalOpen(false);
    setNewConditionName('');
    onShowToast(`Nova condição "${trimmedName}" criada com sucesso!`);
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

    // Coleta o estado completo e normaliza os inputs decimais e inteiros
    const parsedNumParcelas = Math.max(1, parseInt(numParcelasStr, 10) || 72);
    const parsedSinalMinimoNum = parseCurrency(sinalMinimo);
    const formattedSinalMinimo = formatCurrency(parsedSinalMinimoNum > 0 ? parsedSinalMinimoNum : 2000);
    const parsedRiscoRenda = parseDecimal(riscoRendaStr, 30);
    const parsedRiscoImovel = parseDecimal(riscoImovelStr, 25);
    const parsedMeses1 = Math.max(1, parseInt(mesesTabela1Str, 10) || 36);
    const parsedTaxa1 = parseDecimal(taxaJuros1Str, 0);
    const parsedMeses2 = Math.max(1, parseInt(mesesTabela2Str, 10) || 72);
    const parsedTaxa2 = parseDecimal(taxaJuros2Str, 1);

    // Atualiza a formatação visual dos inputs ao salvar
    setNumParcelasStr(String(parsedNumParcelas));
    setSinalMinimo(formattedSinalMinimo);
    setRiscoRendaStr(formatDecimalBR(parsedRiscoRenda, 1, 2));
    setRiscoImovelStr(formatDecimalBR(parsedRiscoImovel, 1, 2));
    setMesesTabela1Str(String(parsedMeses1));
    setTaxaJuros1Str(formatDecimalBR(parsedTaxa1, 2, 2));
    setMesesTabela2Str(String(parsedMeses2));
    setTaxaJuros2Str(formatDecimalBR(parsedTaxa2, 2, 2));

    const updatedConditions = (prodWithConds.conditions || []).map(c => {
      if (c.id === activeConditionId) {
        return {
          ...c,
          numParcelas: parsedNumParcelas,
          sinalMinimo: formattedSinalMinimo,
          riscoRendaPct: parsedRiscoRenda,
          riscoImovelPct: parsedRiscoImovel,
          mesesTabela1: parsedMeses1,
          taxaJuros1: parsedTaxa1,
          mesesTabela2: parsedMeses2,
          taxaJuros2: parsedTaxa2,
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
      numParcelas: parsedNumParcelas,
      conditions: updatedConditions
    };

    onSaveProductPolicy(updatedProd);
    onShowToast("✓ Alterações salvas com sucesso!");
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

  const quickConditionSuggestions = [
    'Sinal em 36X c/ Direto',
    'À Vista c/ Desconto',
    'Sinal em 48X Morar',
    'Direto Construtora 60X'
  ];

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
                  onClick={handleOpenNewConditionModal}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
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
                    type="text"
                    inputMode="numeric"
                    value={numParcelasStr}
                    onChange={(e) => setNumParcelasStr(e.target.value)}
                    onBlur={() => {
                      const val = Math.max(1, parseInt(numParcelasStr, 10) || 72);
                      setNumParcelasStr(String(val));
                    }}
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
                  onBlur={() => {
                    const parsed = parseCurrency(sinalMinimo);
                    setSinalMinimo(formatCurrency(parsed > 0 ? parsed : 2000));
                  }}
                  placeholder="Ex: 5000, 5000,00 ou R$ 5.000,00"
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
                      type="text"
                      inputMode="decimal"
                      value={riscoRendaStr}
                      onChange={(e) => setRiscoRendaStr(e.target.value)}
                      onBlur={() => {
                        const parsed = parseDecimal(riscoRendaStr, 30);
                        setRiscoRendaStr(formatDecimalBR(parsed, 1, 2));
                      }}
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
                      type="text"
                      inputMode="decimal"
                      value={riscoImovelStr}
                      onChange={(e) => setRiscoImovelStr(e.target.value)}
                      onBlur={() => {
                        const parsed = parseDecimal(riscoImovelStr, 25);
                        setRiscoImovelStr(formatDecimalBR(parsed, 1, 2));
                      }}
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
                      type="text"
                      inputMode="numeric"
                      value={mesesTabela1Str}
                      onChange={(e) => setMesesTabela1Str(e.target.value)}
                      onBlur={() => {
                        const val = Math.max(1, parseInt(mesesTabela1Str, 10) || 36);
                        setMesesTabela1Str(String(val));
                      }}
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
                      type="text"
                      inputMode="decimal"
                      value={taxaJuros1Str}
                      onChange={(e) => setTaxaJuros1Str(e.target.value)}
                      onBlur={() => {
                        const parsed = parseDecimal(taxaJuros1Str, 0);
                        setTaxaJuros1Str(formatDecimalBR(parsed, 2, 2));
                      }}
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
                      type="text"
                      inputMode="numeric"
                      value={mesesTabela2Str}
                      onChange={(e) => setMesesTabela2Str(e.target.value)}
                      onBlur={() => {
                        const val = Math.max(1, parseInt(mesesTabela2Str, 10) || 72);
                        setMesesTabela2Str(String(val));
                      }}
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
                      type="text"
                      inputMode="decimal"
                      value={taxaJuros2Str}
                      onChange={(e) => setTaxaJuros2Str(e.target.value)}
                      onBlur={() => {
                        const parsed = parseDecimal(taxaJuros2Str, 1);
                        setTaxaJuros2Str(formatDecimalBR(parsed, 2, 2));
                      }}
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

      {/* MODAL: NOVA CONDIÇÃO COMERCIAL */}
      {isNewConditionModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNewConditionModalOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsNewConditionModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 relative">
            <button
              type="button"
              onClick={() => setIsNewConditionModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Nova Condição Comercial
                </h3>
                <p className="text-xs text-slate-500">
                  Empreendimento: <span className="font-semibold text-slate-700">{productName || activeProd.name}</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmNewCondition} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nome da Condição Comercial *
                </label>
                <input
                  ref={newCondInputRef}
                  type="text"
                  value={newConditionName}
                  onChange={(e) => setNewConditionName(e.target.value)}
                  placeholder="Ex: Sinal em 36X c/ Direto, À Vista c/ Desconto..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600 transition-all"
                />
              </div>

              {/* SUGESTÕES RÁPIDAS */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Sugestões rápidas:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickConditionSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setNewConditionName(sug)}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition-all cursor-pointer border border-slate-200/60"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Valores padrão inicializados:
                </p>
                <p className="text-slate-500">
                  72 Parcelas, Sinal Mínimo R$ 2.000,00, Risco Renda 30%, Risco Imóvel 25%, Prazos e Taxas (0% até 36m / 1% até 72m). Todos editáveis após a criação.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewConditionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newConditionName.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Criar Condição</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

