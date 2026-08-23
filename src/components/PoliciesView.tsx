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
  CheckCircle2,
  HardHat,
  KeyRound,
  Coins,
  TrendingUp,
  Calendar,
  CalendarClock,
  AlertTriangle
} from 'lucide-react';
import { CommercialCondition, Product, SelectedUnit, SimulationData } from '../types';
import { formatCurrency, parseCurrency } from '../utils/formatters';
import { calculatePresentValue, ensureProductConditions, calculatePolicyRiskValues, decomposeMorarMonths } from '../utils/calculations';

interface PoliciesViewProps {
  products: Product[];
  activeProductId: string;
  onSelectProduct: (productId: string) => void;
  onSaveProductPolicy: (updatedProduct: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onOpenNewProductModal: () => void;
  onShowToast: (message: string) => void;
  clientIncome: number;
  isFirstHome?: boolean;
  simulationData?: SimulationData;
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
  isFirstHome = true,
  simulationData,
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

  // Estados específicos para a condição "Sinal c/ Morar"
  const [mesesObraStr, setMesesObraStr] = useState<string>('33');
  const [mesesPosStr, setMesesPosStr] = useState<string>('27');
  const [riscoPosStr, setRiscoPosStr] = useState<string>('8,0');
  const [globalSerie1Str, setGlobalSerie1Str] = useState<string>('30,0');
  const [globalSerie2Str, setGlobalSerie2Str] = useState<string>('25,0');
  const [globalSerie3Str, setGlobalSerie3Str] = useState<string>('20,0');
  const [globalSerie4Str, setGlobalSerie4Str] = useState<string>('15,0');
  const [globalSerie5Str, setGlobalSerie5Str] = useState<string>('10,0');
  const [globalSerie6Str, setGlobalSerie6Str] = useState<string>('5,0');

  // Estado das torres habilitadas para simulação nesta política
  const [torresHabilitadas, setTorresHabilitadas] = useState<string[]>([]);

  // Extração de todas as torres e contagem de unidades do empreendimento ativo
  const allTorres = React.useMemo(() => {
    const rows = prodWithConds?.tableInfo?.rows || [];
    return Array.from(new Set(rows.map(r => String(r[1] || '').trim()).filter(t => t !== '')));
  }, [prodWithConds?.tableInfo?.rows]);

  const unitsCountByTorre = React.useMemo(() => {
    const rows = prodWithConds?.tableInfo?.rows || [];
    const counts: Record<string, number> = {};
    rows.forEach(r => {
      const t = String(r[1] || '').trim();
      if (t) {
        counts[t] = (counts[t] || 0) + 1;
      }
    });
    return counts;
  }, [prodWithConds?.tableInfo?.rows]);

  const syncTorresToProduct = (newTorres: string[]) => {
    if (!prodWithConds) return;
    const updatedConditions = (prodWithConds.conditions || []).map(c => {
      if (c.id === activeConditionId) {
        return {
          ...c,
          torresHabilitadas: newTorres
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
      conditions: updatedConditions
    };

    onSaveProductPolicy(updatedProd);
  };

  const handleToggleTorre = (torreName: string) => {
    const next = torresHabilitadas.includes(torreName)
      ? torresHabilitadas.filter(t => t !== torreName)
      : [...torresHabilitadas, torreName];
    setTorresHabilitadas(next);
    syncTorresToProduct(next);
  };

  const handleSelectAllTorres = () => {
    const next = [...allTorres];
    setTorresHabilitadas(next);
    syncTorresToProduct(next);
  };

  const handleDeselectAllTorres = () => {
    const next: string[] = [];
    setTorresHabilitadas(next);
    syncTorresToProduct(next);
  };

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

      // Se a condição ativa atual ainda existir no produto atualizado, mantenha-a
      const currentSelectedCond = prodWithConds.conditions.find(c => c.id === activeConditionId);
      if (currentSelectedCond) {
        loadConditionData(currentSelectedCond);
      } else {
        const firstCond = prodWithConds.conditions[0];
        if (firstCond) {
          setActiveConditionId(firstCond.id);
          loadConditionData(firstCond);
        }
      }
    }
  }, [activeProductId, products]);

  const loadConditionData = (cond: CommercialCondition) => {
    const numP = cond.numParcelas || 72;
    const rr = cond.riscoRendaPct !== undefined ? cond.riscoRendaPct : 30;
    const isMorar = cond.name.toLowerCase().includes('morar');
    const ri = cond.percMaxProSolutoGlobal !== undefined 
      ? cond.percMaxProSolutoGlobal 
      : (cond.riscoImovelPct !== undefined ? cond.riscoImovelPct : (isMorar ? 17 : 25));
    const rp = cond.percMaxPosObra !== undefined 
      ? cond.percMaxPosObra 
      : (cond.riscoPosPct !== undefined ? cond.riscoPosPct : 8.0);
    const m1 = cond.mesesTabela1 !== undefined ? cond.mesesTabela1 : 36;
    const t1 = cond.taxaJuros1 !== undefined ? cond.taxaJuros1 : 0.0;
    const m2 = cond.mesesTabela2 !== undefined ? cond.mesesTabela2 : 72;
    const t2 = cond.taxaJuros2 !== undefined ? cond.taxaJuros2 : 1.0;

    const mo = cond.mesesObra !== undefined ? cond.mesesObra : 33;
    const mp = cond.mesesPos !== undefined ? cond.mesesPos : 27;
    const gs1 = cond.globalSerie1Pct !== undefined ? cond.globalSerie1Pct : 30.0;
    const gs2 = cond.globalSerie2Pct !== undefined ? cond.globalSerie2Pct : 25.0;
    const gs3 = cond.globalSerie3Pct !== undefined ? cond.globalSerie3Pct : 20.0;
    const gs4 = cond.globalSerie4Pct !== undefined ? cond.globalSerie4Pct : 15.0;
    const gs5 = cond.globalSerie5Pct !== undefined ? cond.globalSerie5Pct : 10.0;
    const gs6 = cond.globalSerie6Pct !== undefined ? cond.globalSerie6Pct : 5.0;

    const parsedSinal = parseCurrency(cond.sinalMinimo);
    const formattedSinal = formatCurrency(parsedSinal > 0 ? parsedSinal : 2000);

    const rows = prodWithConds?.tableInfo?.rows || [];
    const prodsTorres = Array.from(new Set(rows.map(r => String(r[1] || '').trim()).filter(t => t !== '')));
    if (cond.torresHabilitadas && Array.isArray(cond.torresHabilitadas)) {
      setTorresHabilitadas(cond.torresHabilitadas);
    } else {
      setTorresHabilitadas(prodsTorres);
    }

    setNumParcelasStr(String(numP));
    setSinalMinimo(formattedSinal);
    setRiscoRendaStr(formatDecimalBR(rr, 1, 2));
    setRiscoImovelStr(formatDecimalBR(ri, 1, 2));
    setRiscoPosStr(formatDecimalBR(rp, 1, 2));
    setMesesTabela1Str(String(m1));
    setTaxaJuros1Str(formatDecimalBR(t1, 2, 2));
    setMesesTabela2Str(String(m2));
    setTaxaJuros2Str(formatDecimalBR(t2, 2, 2));

    setMesesObraStr(String(mo));
    setMesesPosStr(String(mp));
    setGlobalSerie1Str(formatDecimalBR(gs1, 1, 2));
    setGlobalSerie2Str(formatDecimalBR(gs2, 1, 2));
    setGlobalSerie3Str(formatDecimalBR(gs3, 1, 2));
    setGlobalSerie4Str(formatDecimalBR(gs4, 1, 2));
    setGlobalSerie5Str(formatDecimalBR(gs5, 1, 2));
    setGlobalSerie6Str(formatDecimalBR(gs6, 1, 2));

    setPolicyText(cond.policy || '');
  };

  // Dynamic parsed numeric values for live calculations
  const numParcelas = parseInt(numParcelasStr, 10) || 1;
  const riscoRendaPct = parseDecimal(riscoRendaStr, 30);
  const riscoImovelPct = parseDecimal(riscoImovelStr, 25);
  const riscoPosPct = parseDecimal(riscoPosStr, 8);
  const mesesTabela1 = parseInt(mesesTabela1Str, 10) || 1;
  const taxaJuros1 = parseDecimal(taxaJuros1Str, 0);
  const mesesTabela2 = parseInt(mesesTabela2Str, 10) || 1;
  const taxaJuros2 = parseDecimal(taxaJuros2Str, 1);

  // Parâmetros Morar calculados dinamicamente
  const mesesObra = Math.max(0, parseInt(mesesObraStr, 10) || 0);
  const mesesPos = Math.max(0, parseInt(mesesPosStr, 10) || 0);
  const totalMesesMorar = mesesObra + mesesPos;

  const globalSerie1Pct = parseDecimal(globalSerie1Str, 30.0);
  const globalSerie2Pct = parseDecimal(globalSerie2Str, 25.0);
  const globalSerie3Pct = parseDecimal(globalSerie3Str, 20.0);
  const globalSerie4Pct = parseDecimal(globalSerie4Str, 15.0);
  const globalSerie5Pct = parseDecimal(globalSerie5Str, 10.0);
  const globalSerie6Pct = parseDecimal(globalSerie6Str, 5.0);

  // Divisão dinâmica dos meses por séries usando a regra oficial Morar
  const { obra: mObra, pos: mPos } = decomposeMorarMonths(mesesObra, mesesPos);

  const handleSelectCondition = (condId: string) => {
    if (!prodWithConds) return;

    const parsedCurrentSinal = parseCurrency(sinalMinimo);
    const formattedCurrentSinal = formatCurrency(parsedCurrentSinal > 0 ? parsedCurrentSinal : 2000);

    const isCurrentMorar = activeCondObj ? activeCondObj.name.toLowerCase().includes('morar') : false;

    // Salva preventivamente o estado atual da condição antes de trocar
    const updatedConditions = (prodWithConds.conditions || []).map(c => {
      if (c.id === activeConditionId) {
        return {
          ...c,
          numParcelas: isCurrentMorar ? totalMesesMorar : numParcelas,
          sinalMinimo: formattedCurrentSinal,
          riscoRendaPct,
          riscoImovelPct,
          percMaxProSolutoGlobal: riscoImovelPct,
          percMaxPosObra: riscoPosPct,
          riscoPosPct,
          mesesTabela1,
          taxaJuros1,
          mesesTabela2,
          taxaJuros2,
          mesesObra,
          mesesPos,
          globalSerie1Pct,
          globalSerie2Pct,
          globalSerie3Pct,
          globalSerie4Pct,
          globalSerie5Pct,
          globalSerie6Pct,
          torresHabilitadas: torresHabilitadas,
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
      numParcelas: isCurrentMorar ? totalMesesMorar : numParcelas,
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
      torresHabilitadas: allTorres,
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
          torresHabilitadas: torresHabilitadas,
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

    const parsedMesesObra = Math.max(1, parseInt(mesesObraStr, 10) || 33);
    const parsedMesesPos = Math.max(1, parseInt(mesesPosStr, 10) || 27);
    const parsedRiscoPos = parseDecimal(riscoPosStr, 8.0);
    const parsedGlobal1 = parseDecimal(globalSerie1Str, 30.0);
    const parsedGlobal2 = parseDecimal(globalSerie2Str, 25.0);
    const parsedGlobal3 = parseDecimal(globalSerie3Str, 20.0);
    const parsedGlobal4 = parseDecimal(globalSerie4Str, 15.0);
    const parsedGlobal5 = parseDecimal(globalSerie5Str, 10.0);
    const parsedGlobal6 = parseDecimal(globalSerie6Str, 5.0);

    const isCurrentMorar = activeCondObj ? activeCondObj.name.toLowerCase().includes('morar') : false;

    // Atualiza a formatação visual dos inputs ao salvar
    setNumParcelasStr(String(isCurrentMorar ? (parsedMesesObra + parsedMesesPos) : parsedNumParcelas));
    setSinalMinimo(formattedSinalMinimo);
    setRiscoRendaStr(formatDecimalBR(parsedRiscoRenda, 1, 2));
    setRiscoImovelStr(formatDecimalBR(parsedRiscoImovel, 1, 2));
    setRiscoPosStr(formatDecimalBR(parsedRiscoPos, 1, 2));
    setMesesTabela1Str(String(parsedMeses1));
    setTaxaJuros1Str(formatDecimalBR(parsedTaxa1, 2, 2));
    setMesesTabela2Str(String(parsedMeses2));
    setTaxaJuros2Str(formatDecimalBR(parsedTaxa2, 2, 2));

    setMesesObraStr(String(parsedMesesObra));
    setMesesPosStr(String(parsedMesesPos));
    setGlobalSerie1Str(formatDecimalBR(parsedGlobal1, 1, 2));
    setGlobalSerie2Str(formatDecimalBR(parsedGlobal2, 1, 2));
    setGlobalSerie3Str(formatDecimalBR(parsedGlobal3, 1, 2));
    setGlobalSerie4Str(formatDecimalBR(parsedGlobal4, 1, 2));
    setGlobalSerie5Str(formatDecimalBR(parsedGlobal5, 1, 2));
    setGlobalSerie6Str(formatDecimalBR(parsedGlobal6, 1, 2));

    const updatedConditions = (prodWithConds.conditions || []).map(c => {
      if (c.id === activeConditionId) {
        return {
          ...c,
          numParcelas: isCurrentMorar ? (parsedMesesObra + parsedMesesPos) : parsedNumParcelas,
          sinalMinimo: formattedSinalMinimo,
          riscoRendaPct: parsedRiscoRenda,
          riscoImovelPct: parsedRiscoImovel,
          percMaxProSolutoGlobal: parsedRiscoImovel,
          percMaxPosObra: parsedRiscoPos,
          riscoPosPct: parsedRiscoPos,
          mesesTabela1: parsedMeses1,
          taxaJuros1: parsedTaxa1,
          mesesTabela2: parsedMeses2,
          taxaJuros2: parsedTaxa2,
          mesesObra: parsedMesesObra,
          mesesPos: parsedMesesPos,
          globalSerie1Pct: parsedGlobal1,
          globalSerie2Pct: parsedGlobal2,
          globalSerie3Pct: parsedGlobal3,
          globalSerie4Pct: parsedGlobal4,
          globalSerie5Pct: parsedGlobal5,
          globalSerie6Pct: parsedGlobal6,
          torresHabilitadas: torresHabilitadas,
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
      numParcelas: isCurrentMorar ? (parsedMesesObra + parsedMesesPos) : parsedNumParcelas,
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
  let propertyEvaluation = 0;
  let propertyITBI = 0;
  const selUnit = selectedUnits?.[activeProductId];

  if (selUnit && selUnit.torre && selUnit.unidade && prodWithConds?.tableInfo?.rows) {
    const matchingRow = prodWithConds.tableInfo.rows.find(
      r => String(r[1] || '').trim().toLowerCase() === selUnit.torre.trim().toLowerCase() &&
           String(r[2] || '').trim().toLowerCase() === selUnit.unidade.trim().toLowerCase()
    );
    if (matchingRow) {
      if (matchingRow[6] !== undefined) propertyEvaluation = parseCurrency(matchingRow[6]);
      if (matchingRow[7] !== undefined) propertyPrice = parseCurrency(matchingRow[7]);
      const itbi1 = matchingRow[8] !== undefined ? parseCurrency(matchingRow[8]) : 0;
      const itbi2 = matchingRow[9] !== undefined ? parseCurrency(matchingRow[9]) : 0;
      propertyITBI = (isFirstHome ?? true) ? (itbi1 || itbi2) : (itbi2 || itbi1);
    }
  }

  const activeCondObj = prodWithConds?.conditions.find(c => c.id === activeConditionId);
  const currentCondition = activeCondObj || prodWithConds?.conditions[0];

  let valorAtoPremiado = 0;
  if (currentCondition && prodWithConds && (propertyPrice > 0 || propertyEvaluation > 0)) {
    const riskCalc = calculatePolicyRiskValues(
      prodWithConds,
      currentCondition,
      clientIncome,
      numParcelas,
      propertyPrice,
      propertyITBI,
      propertyEvaluation,
      undefined,
      simulationData?.financing || Infinity,
      simulationData?.subsidy || 0,
      simulationData?.fgts || 0,
      simulationData?.finPercent || 0.80
    );
    valorAtoPremiado = riskCalc.atoPremiado || 0;
  }

  const isMorarCondition = activeCondObj 
    ? activeCondObj.name.toLowerCase().includes('morar') 
    : false;

  const baseMaiorVendaAvaliacao = Math.max(propertyPrice, propertyEvaluation);
  const totalBaseRiscoImovel = isMorarCondition
    ? (propertyPrice > 0 ? Math.max(0, propertyPrice + propertyITBI) : 0)
    : (baseMaiorVendaAvaliacao > 0 
        ? Math.max(0, (baseMaiorVendaAvaliacao + propertyITBI) - valorAtoPremiado) 
        : 0);
  const riscoImovelVal = totalBaseRiscoImovel > 0 ? totalBaseRiscoImovel * (riscoImovelPct / 100) : 0;
  
  // Para Sinal c/ Morar: Base = Preço + ITBI (Sem deduzir Ato Premiado)
  const baseCalculoMorar = propertyPrice > 0 ? Math.max(0, propertyPrice + propertyITBI) : 0;
  const proSolutoGlobalMorar = baseCalculoMorar > 0 
    ? Math.round(baseCalculoMorar * (riscoImovelPct / 100) * 100) / 100 
    : 0;
  const tetoPosGlobalMorar = baseCalculoMorar > 0 
    ? Math.round(baseCalculoMorar * (riscoPosPct / 100) * 100) / 100 
    : 0;
  const minRiskVal = (vpVal > 0 && riscoImovelVal > 0) ? Math.min(vpVal, riscoImovelVal) : 0;

  // Renda base considerada para os cálculos de Morar
  const baseIncomeForMorar = clientIncome > 0 ? clientIncome : 0;

  // Tetos calculados em tempo real para Morar
  const parcGlobal1 = baseIncomeForMorar * (globalSerie1Pct / 100);
  const parcGlobal2 = baseIncomeForMorar * (globalSerie2Pct / 100);
  const parcGlobal3 = baseIncomeForMorar * (globalSerie3Pct / 100);
  const parcGlobal4 = baseIncomeForMorar * (globalSerie4Pct / 100);
  const parcGlobal5 = baseIncomeForMorar * (globalSerie5Pct / 100);
  const parcGlobal6 = baseIncomeForMorar * (globalSerie6Pct / 100);
  
  const totalObraBucketArr = mObra || [0,0,0,0,0,0];
  const totalPosBucketArr = mPos || [0,0,0,0,0,0];

  // Obra (baldes 1/2/3, índices 0/1/2) e Pós-Obra (baldes 3/4/5/6, índices 2/3/4/5)
  // usam escadas de peso independentes — não são o mesmo balde dividido em duas
  // fases, então não podem ser somados pelo mesmo índice antes de multiplicar pelo peso.
  const capacidadeTotalFluxo = (totalObraBucketArr[0] * parcGlobal1) +
                               (totalObraBucketArr[1] * parcGlobal2) +
                               (totalObraBucketArr[2] * parcGlobal3) +
                               (totalPosBucketArr[2] * parcGlobal3) +
                               (totalPosBucketArr[3] * parcGlobal4) +
                               (totalPosBucketArr[4] * parcGlobal5) +
                               (totalPosBucketArr[5] * parcGlobal6);

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

          {/* SEÇÃO: TORRES DISPONÍVEIS PARA SIMULAÇÃO */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span>Torres Disponíveis para Simulação</span>
                    {allTorres.length > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                        torresHabilitadas.length === allTorres.length
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : torresHabilitadas.length > 0
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {torresHabilitadas.length === allTorres.length
                          ? 'TODAS LIBERADAS'
                          : torresHabilitadas.length > 0
                          ? `PARCIALMENTE LIBERADAS (${torresHabilitadas.length} de ${allTorres.length})`
                          : 'NENHUMA LIBERADA'}
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Defina quais torres deste empreendimento estarão visíveis no Simulador para a condição <strong className="text-sky-700">{activeCondObj?.name || '--'}</strong>.
                  </p>
                </div>
              </div>

              {allTorres.length > 0 && (
                <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={handleSelectAllTorres}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px] transition-all cursor-pointer"
                  >
                    Marcar Todas
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllTorres}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg text-[11px] transition-all cursor-pointer"
                  >
                    Desmarcar Todas
                  </button>
                </div>
              )}
            </div>

            {allTorres.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Nenhuma torre identificada na tabela deste empreendimento. Importe a planilha de vendas na aba <strong>Importar Tabela</strong> para mapear as torres e unidades.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                {allTorres.map(torreName => {
                  const isChecked = torresHabilitadas.includes(torreName);
                  const unitCount = unitsCountByTorre[torreName] || 0;
                  return (
                    <div
                      key={torreName}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleToggleTorre(torreName)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          handleToggleTorre(torreName);
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                        isChecked
                          ? 'bg-sky-50/80 hover:bg-sky-50 border-sky-300 text-slate-900 shadow-2xs'
                          : 'bg-slate-50/60 hover:bg-slate-100/70 border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pointer-events-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer pointer-events-none"
                        />
                        <div className="truncate">
                          <span className={`text-xs font-bold block truncate ${isChecked ? 'text-slate-900' : 'text-slate-500'}`}>
                            {torreName}
                          </span>
                          <span className={`text-[10px] font-medium block truncate ${isChecked ? 'text-slate-500' : 'text-slate-400'}`}>
                            {unitCount} {unitCount === 1 ? 'unidade' : 'unidades'}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border transition-colors ${
                        isChecked
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}>
                        {isChecked ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {allTorres.length > 0 && torresHabilitadas.length === 0 && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Atenção: Nenhuma torre está liberada nesta política. Os corretores não conseguirão simular unidades nesta condição até que ao menos uma torre seja ativada.</span>
              </div>
            )}
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
              {isMorarCondition && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                  Condição Sinal c/ Morar ({totalMesesMorar}x)
                </span>
              )}
            </div>

            {isMorarCondition ? (
              /* ========================================================================= */
              /* LAYOUT EXCLUSIVO PARA CONDIÇÃO: SINAL C/ MORAR                            */
              /* ========================================================================= */
              <div className="space-y-4">
                {/* 1. BLOCO GERAL DE PRAZOS E SINAL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
                  {/* SINAL MÍNIMO */}
                  <div className="lg:col-span-3">
                    <label className="block font-semibold text-slate-700 mb-1 text-xs">
                      Sinal Mínimo (R$)
                    </label>
                    <input
                      type="text"
                      value={sinalMinimo}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setSinalMinimo(e.target.value)}
                      onBlur={() => {
                        const parsed = parseCurrency(sinalMinimo);
                        setSinalMinimo(formatCurrency(parsed > 0 ? parsed : 2000));
                      }}
                      placeholder="Ex: R$ 2.000,00"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-bold text-emerald-600 focus:outline-none focus:border-sky-600 text-xs"
                    />
                  </div>

                  {/* MESES DE OBRA */}
                  <div className="lg:col-span-3">
                    <label className="block font-semibold text-slate-700 mb-1 text-xs truncate" title="Meses de Obra (INCC)">
                      Meses de Obra
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={mesesObraStr}
                        onChange={(e) => setMesesObraStr(e.target.value)}
                        onBlur={() => {
                          const val = Math.max(1, parseInt(mesesObraStr, 10) || 33);
                          setMesesObraStr(String(val));
                        }}
                        className="w-full pl-3 pr-7 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-center focus:outline-none focus:border-sky-600 text-xs"
                      />
                      <span className="absolute right-3 font-extrabold text-slate-400 text-xs pointer-events-none">M</span>
                    </div>
                  </div>

                  {/* MESES PÓS-OBRA */}
                  <div className="lg:col-span-3">
                    <label className="block font-semibold text-slate-700 mb-1 text-xs truncate" title="Meses Pós-Obra (IPCA)">
                      Meses Pós-Obra
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={mesesPosStr}
                        onChange={(e) => setMesesPosStr(e.target.value)}
                        onBlur={() => {
                          const val = Math.max(1, parseInt(mesesPosStr, 10) || 27);
                          setMesesPosStr(String(val));
                        }}
                        className="w-full pl-3 pr-7 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-center focus:outline-none focus:border-sky-600 text-xs"
                      />
                      <span className="absolute right-3 font-extrabold text-slate-400 text-xs pointer-events-none">M</span>
                    </div>
                  </div>

                  {/* TOTAL DE MESES (INFORMATIVO) */}
                  <div className="lg:col-span-3">
                    <label className="block font-semibold text-slate-700 mb-1 text-xs truncate" title="Total de Meses da Condição">
                      Total Meses
                    </label>
                    <div className="px-3 py-2 bg-sky-50 border border-sky-200 rounded-xl font-black text-sky-700 text-center text-xs">
                      {totalMesesMorar} Meses (Obra + Pós)
                    </div>
                  </div>
                </div>

                {/* 1.1 TRAVAS GLOBAIS DE RISCO DA POLÍTICA MORAR */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
                  {/* CAMPO 1: % MAX PRÓ-SOLUTO GLOBAL */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block font-bold text-slate-800 text-xs truncate" title="Limite máximo do Pró-soluto sobre a base (Preço + ITBI)">
                        % Max Pró-Soluto Global
                      </label>
                      <span className="text-[10px] text-slate-500 font-bold">Padrão: 17,0%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-1.5 leading-tight">
                      Limite máximo do Pró-soluto sobre a base (Preço + ITBI)
                    </p>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={riscoImovelStr}
                        onChange={(e) => setRiscoImovelStr(e.target.value)}
                        onBlur={() => {
                          const val = parseDecimal(riscoImovelStr, 17.0);
                          setRiscoImovelStr(formatDecimalBR(val, 1, 2));
                        }}
                        className="w-full pl-3 pr-7 py-2 bg-white border border-slate-300 rounded-xl font-bold text-indigo-700 text-center focus:outline-none focus:border-indigo-600 text-xs"
                      />
                      <span className="absolute right-3 font-extrabold text-slate-400 text-xs pointer-events-none">%</span>
                    </div>
                  </div>

                  {/* CAMPO 2: % MAX PÓS-OBRA */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block font-bold text-slate-800 text-xs truncate" title="Teto de comprometimento exclusivo da fase Pós-Obra">
                        % Max Pós-Obra
                      </label>
                      <span className="text-[10px] text-slate-500 font-bold">Padrão: 8,0%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-1.5 leading-tight">
                      Teto de comprometimento exclusivo da fase Pós-Obra
                    </p>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={riscoPosStr}
                        onChange={(e) => setRiscoPosStr(e.target.value)}
                        onBlur={() => {
                          const val = parseDecimal(riscoPosStr, 8.0);
                          setRiscoPosStr(formatDecimalBR(val, 1, 2));
                        }}
                        className="w-full pl-3 pr-7 py-2 bg-white border border-slate-300 rounded-xl font-bold text-purple-700 text-center focus:outline-none focus:border-purple-600 text-xs"
                      />
                      <span className="absolute right-3 font-extrabold text-slate-400 text-xs pointer-events-none">%</span>
                    </div>
                  </div>
                </div>

                
                {/* 2. BLOCO: SÉRIES DE COMPROMETIMENTO DE RENDA (BLOCOS DE 12 MESES) */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-amber-50 text-amber-700">
                        <HardHat className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                        Séries de Comprometimento de Renda (Blocos de 12 Meses)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { title: 'Série 1 (Ano 1)', val: globalSerie1Str, set: setGlobalSerie1Str, def: 30.0, parc: parcGlobal1 },
                      { title: 'Série 2 (Ano 2)', val: globalSerie2Str, set: setGlobalSerie2Str, def: 25.0, parc: parcGlobal2 },
                      { title: 'Série 3 (Ano 3)', val: globalSerie3Str, set: setGlobalSerie3Str, def: 20.0, parc: parcGlobal3 },
                      { title: 'Série 4 (Ano 4)', val: globalSerie4Str, set: setGlobalSerie4Str, def: 15.0, parc: parcGlobal4 },
                      { title: 'Série 5 (Ano 5)', val: globalSerie5Str, set: setGlobalSerie5Str, def: 10.0, parc: parcGlobal5 },
                      { title: 'Série 6 (Ano 6)', val: globalSerie6Str, set: setGlobalSerie6Str, def: 5.0, parc: parcGlobal6 },
                    ].map((serie, index) => (
                      <div key={index} className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-700">{serie.title}</span>
                          {clientIncome > 0 && (
                            <span className="font-semibold text-emerald-600 text-[10px]">
                              Teto Renda: {formatCurrency(serie.parc)}/mês
                            </span>
                          )}
                        </div>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={serie.val}
                            onChange={(e) => serie.set(e.target.value)}
                            onBlur={() => {
                              const parsed = parseDecimal(serie.val, serie.def);
                              serie.set(formatDecimalBR(parsed, 1, 2));
                            }}
                            className="w-full pl-3 pr-7 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 text-center focus:outline-none focus:border-sky-600 text-xs"
                          />
                          <span className="absolute right-2.5 font-extrabold text-slate-500 text-xs pointer-events-none">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. CARDS DE RESUMO E RISCO DO EMPREENDIMENTO */}
                <div className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">

                  {/* CARD 1: CAPACIDADE TOTAL DE FLUXO */}
                  <div className="bg-emerald-50/90 p-3.5 rounded-xl border border-emerald-200/90 flex flex-col justify-between space-y-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                        <Coins className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="block font-bold text-emerald-950 text-[11px] uppercase tracking-wider truncate">
                          Capacidade Total Fluxo
                        </span>
                        <span className="text-[10px] text-emerald-700 font-medium block truncate">
                          Total Baseado na Renda
                        </span>
                      </div>
                    </div>
                    <div className="pt-1">
                      <input
                        type="text"
                        readOnly
                        value={formatCurrency(capacidadeTotalFluxo)}
                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-extrabold text-emerald-700 text-center text-sm shadow-2xs cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* CARD 2: PRÓ-SOLUTO GLOBAL (17%) */}
                  <div className="bg-indigo-50/90 p-3.5 rounded-xl border border-indigo-200/90 flex flex-col justify-between space-y-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-800 shrink-0">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="block font-bold text-indigo-950 text-[11px] uppercase tracking-wider truncate">
                          Pró-Soluto Global ({formatDecimalBR(riscoImovelPct, 1, 2)}%)
                        </span>
                        <span className="text-[10px] text-indigo-700 font-medium block truncate">
                          Teto Máximo de Fluxo da Base
                        </span>
                      </div>
                    </div>
                    <div className="pt-1">
                      <input
                        type="text"
                        readOnly
                        value={formatCurrency(proSolutoGlobalMorar)}
                        className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl font-extrabold text-indigo-700 text-center text-sm shadow-2xs cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* CARD 3: TETO PÓS-OBRA (8%) */}
                  <div className="bg-purple-50/90 p-3.5 rounded-xl border border-purple-200/90 flex flex-col justify-between space-y-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-100 text-purple-800 shrink-0">
                        <CalendarClock className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="block font-bold text-purple-950 text-[11px] uppercase tracking-wider truncate">
                          Teto Pós-Obra ({formatDecimalBR(riscoPosPct, 1, 2)}%)
                        </span>
                        <span className="text-[10px] text-purple-700 font-medium block truncate">
                          Trava Máxima no Pós-Chaves
                        </span>
                      </div>
                    </div>
                    <div className="pt-1">
                      <input
                        type="text"
                        readOnly
                        value={formatCurrency(tetoPosGlobalMorar)}
                        className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl font-extrabold text-purple-700 text-center text-sm shadow-2xs cursor-not-allowed"
                      />
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              /* ========================================================================= */
              /* LAYOUT PADRÃO PARA CONDIÇÃO: SINAL C/ BANCO DIRETO                        */
              /* ========================================================================= */
              <div className="space-y-4">
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
                      onFocus={(e) => e.target.select()}
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
                      <label className="block font-semibold text-slate-700 mb-1 truncate" title="Valor do Risco (Maior valor Venda/Avaliação + ITBI - Ato Premiado) * %">
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
                          =(Maior valor Venda/Avaliação + ITBI - Ato Premiado) * % Risco
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
            )}

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

