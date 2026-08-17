import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  RotateCcw, 
  KeyRound, 
  AlertTriangle, 
  FileSpreadsheet, 
  Printer, 
  Layers, 
  Coins, 
  Receipt,
  ChevronDown,
  FileCheck2,
  Building,
  Check
} from 'lucide-react';
import { CommercialCondition, Product, SelectedUnit, SimulationData } from '../types';
import { formatCurrency, formatM2, parseCurrency, formatDeliveryText } from '../utils/formatters';
import { calculatePolicyRiskValues, ensureProductConditions, decomposeMorarMonths, calculateMorarFlowEngine, calcularDescontoAtoPremiado } from '../utils/calculations';
import { PdfExportModalMorar, MorarFaixa } from './PdfExportModalMorar';

interface FichaMorarProps {
  product: Product | null;
  condition: CommercialCondition | null;
  products?: Product[];
  onSelectProduct?: (product: Product, conditionId: string) => void;
  onSelectCondition?: (condition: CommercialCondition) => void;
  simulationData: SimulationData;
  selectedUnits: Record<string, SelectedUnit>;
  onUnitSelectChange: (productId: string, unit: SelectedUnit) => void;
  onBackToSimulator: () => void;
  onNavigateToImport: (productId: string) => void;
  onShowToast: (message: string) => void;
}

export const FichaMorar: React.FC<FichaMorarProps> = ({
  product,
  condition,
  products = [],
  onSelectProduct,
  onSelectCondition,
  simulationData,
  selectedUnits,
  onUnitSelectChange,
  onBackToSimulator,
  onNavigateToImport,
  onShowToast
}) => {
  // Produto e Condição atuais com fallback para o primeiro disponível
  const currentProd = useMemo(() => {
    if (product) return product;
    if (products && products.length > 0) return products[0];
    return null;
  }, [product, products]);

  const currentCond = useMemo(() => {
    if (!currentProd) return null;
    const prodWithConds = ensureProductConditions({ ...currentProd });
    if (condition) {
      const match = prodWithConds.conditions.find(c => c.id === condition.id);
      if (match) return match;
    }
    return prodWithConds.conditions[0] || null;
  }, [currentProd, condition]);

  const [selectedTorre, setSelectedTorre] = useState<string>('');
  const [selectedUnidade, setSelectedUnidade] = useState<string>('');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [isFirstHomeLocal, setIsFirstHomeLocal] = useState<boolean>(simulationData.isFirstHome ?? true);

  // Estados dos Blocos de Pagamento Morar
  const [dataAto, setDataAto] = useState<string>('agosto, 2026');
  const [valAtoManual, setValAtoManual] = useState<number | null>(null);
  const [atoInputText, setAtoInputText] = useState<string>('');
  const [isEditingAto, setIsEditingAto] = useState<boolean>(false);

  // Estados dos Cards de ITBI no Ato e Ato Premiado (Padronizados)
  const [valAtoITBI, setValAtoITBI] = useState<number>(0);
  const [itbiAtoInputText, setItbiAtoInputText] = useState<string>('');
  const [isEditingAtoITBI, setIsEditingAtoITBI] = useState<boolean>(false);
  const [isAtoPremiadoEnabled, setIsAtoPremiadoEnabled] = useState<boolean>(true);
  const [isAtoZerado, setIsAtoZerado] = useState<boolean>(false);

  // Faixas de Obra (INCC) - Padrão Morar: 12x, 12x, 9x, 0x (Total 33 meses)
  const [dataObra, setDataObra] = useState<string>('setembro, 2026');
  const [faixasObra, setFaixasObra] = useState<MorarFaixa[]>([
    { qtd: 12, valor: 0 },
    { qtd: 12, valor: 0 },
    { qtd: 9, valor: 0 },
    { qtd: 0, valor: 0 }
  ]);
  const [obraQtdText, setObraQtdText] = useState<string>('');
  const [isEditingObraTotal, setIsEditingObraTotal] = useState<boolean>(false);
  const [isManualObra, setIsManualObra] = useState<boolean>(false);

  // Faixas de Pós-Obra (IPCA+1%) - Padrão Morar: 3x, 12x, 12x, 0x (Total 27 meses)
  const [dataPos, setDataPos] = useState<string>('junho, 2029');
  const [faixasPos, setFaixasPos] = useState<MorarFaixa[]>([
    { qtd: 3, valor: 0 },
    { qtd: 12, valor: 0 },
    { qtd: 12, valor: 0 },
    { qtd: 0, valor: 0 }
  ]);
  const [posQtdText, setPosQtdText] = useState<string>('');
  const [isEditingPosTotal, setIsEditingPosTotal] = useState<boolean>(false);
  const [isManualPos, setIsManualPos] = useState<boolean>(false);

  // Taxas e Registro (IGPM+1%)
  const [dataITBI, setDataITBI] = useState<string>('setembro, 2026');
  const [itbiTotalManual, setItbiTotalManual] = useState<number | null>(null);
  const [isEditingITBITotal, setIsEditingITBITotal] = useState<boolean>(false);
  const [itbiInputText, setItbiInputText] = useState<string>('');

  const [itbiObraQtd, setItbiObraQtd] = useState<number>(33);
  const [itbiObraValorManual, setItbiObraValorManual] = useState<number | null>(null);
  const [isEditingItbiObraVal, setIsEditingItbiObraVal] = useState<boolean>(false);
  const [itbiObraValText, setItbiObraValText] = useState<string>('');

  const [itbiPosQtd, setItbiPosQtd] = useState<number>(27);
  const [itbiPosValorManual, setItbiPosValorManual] = useState<number | null>(null);
  const [isEditingItbiPosVal, setIsEditingItbiPosVal] = useState<boolean>(false);
  const [itbiPosValText, setItbiPosValText] = useState<string>('');

  

  // Sincronizar isFirstHomeLocal
  useEffect(() => {
    setIsFirstHomeLocal(simulationData.isFirstHome ?? true);
  }, [simulationData.isFirstHome]);

  // Sincronizar seleção de torre/unidade
  useEffect(() => {
    if (currentProd) {
      const saved = selectedUnits[currentProd.id];
      if (saved && (saved.torre || saved.unidade)) {
        setSelectedTorre(saved.torre || '');
        setSelectedUnidade(saved.unidade || '');
      } else {
        setSelectedTorre('');
        setSelectedUnidade('');
      }
    }
  }, [currentProd?.id, selectedUnits]);

  // Atualização e Reset Automático ao Trocar Torre / Unidade
  useEffect(() => {
    setIsAtoZerado(false);
    setValAtoManual(null);
    setAtoInputText('');
    setIsEditingAto(false);
    setValAtoITBI(0);
    setItbiAtoInputText('');
    setIsEditingAtoITBI(false);
    setIsManualObra(false);
    setIsManualPos(false);
    setItbiTotalManual(null);
    setItbiObraValorManual(null);
    setItbiPosValorManual(null);
  }, [selectedTorre, selectedUnidade]);

  // Limpeza ao trocar de produto ou condição
  useEffect(() => {
    setIsAtoZerado(false);
    setValAtoManual(null);
    setAtoInputText('');
    setIsEditingAto(false);
    setValAtoITBI(0);
    setItbiAtoInputText('');
    setIsEditingAtoITBI(false);
    setIsAtoPremiadoEnabled(true);
    setIsManualObra(false);
    setIsManualPos(false);
    setItbiTotalManual(null);
    setItbiObraValorManual(null);
    setItbiPosValorManual(null);
  }, [currentProd?.id, currentCond?.id]);

  if (!currentProd || !currentCond) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-4">
        <p className="text-slate-600 font-medium text-sm">Nenhum empreendimento selecionado para análise.</p>
        <button
          type="button"
          onClick={onBackToSimulator}
          className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-semibold hover:bg-sky-700 cursor-pointer"
        >
          Ir para o Simulador
        </button>
      </div>
    );
  }

  const tableRows = currentProd.tableInfo?.rows || [];
  const uniqueTorres = React.useMemo(() => {
    return Array.from(new Set(tableRows.map(r => String(r[1] || '').trim()).filter(t => t !== '')));
  }, [tableRows]);

  // Torres habilitadas para simulação nesta política comercial
  const availableTorres = React.useMemo(() => {
    if (currentCond?.torresHabilitadas === undefined) return uniqueTorres;
    const allowed = (currentCond.torresHabilitadas || []).map(t => String(t || '').trim().toLowerCase());
    return uniqueTorres.filter(t => allowed.includes(String(t || '').trim().toLowerCase()));
  }, [uniqueTorres, currentCond?.torresHabilitadas]);

  // Regra de Fallback e Troca: Ao alternar de produto ou modalidade, validar torre e unidade
  useEffect(() => {
    if (!currentProd) return;

    if (availableTorres.length > 0) {
      if (!selectedTorre || !availableTorres.some(t => t.toLowerCase() === selectedTorre.toLowerCase())) {
        const fallbackTorre = availableTorres[0];
        setSelectedTorre(fallbackTorre);

        const unitsOfFallback = Array.from(new Set(
          tableRows
            .filter(r => String(r[1] || '').trim().toLowerCase() === fallbackTorre.toLowerCase())
            .map(r => String(r[2] || '').trim())
            .filter(u => u !== '')
        ));

        const newUnidade = (selectedUnidade && unitsOfFallback.some(u => String(u).toLowerCase() === selectedUnidade.toLowerCase()))
          ? selectedUnidade
          : (unitsOfFallback[0] || '');

        setSelectedUnidade(newUnidade);
        onUnitSelectChange(currentProd.id, { torre: fallbackTorre, unidade: newUnidade });
      } else {
        const unitsOfCurrent = Array.from(new Set(
          tableRows
            .filter(r => String(r[1] || '').trim().toLowerCase() === selectedTorre.toLowerCase())
            .map(r => String(r[2] || '').trim())
            .filter(u => u !== '')
        ));

        if (selectedUnidade && !unitsOfCurrent.some(u => String(u).toLowerCase() === selectedUnidade.toLowerCase())) {
          const newUnidade = unitsOfCurrent[0] || '';
          setSelectedUnidade(newUnidade);
          onUnitSelectChange(currentProd.id, { torre: selectedTorre, unidade: newUnidade });
        }
      }
    } else {
      if (selectedTorre || selectedUnidade) {
        setSelectedTorre('');
        setSelectedUnidade('');
        onUnitSelectChange(currentProd.id, { torre: '', unidade: '' });
      }
    }
  }, [availableTorres, currentProd?.id, currentCond?.id]);

  const filteredUnits = selectedTorre 
    ? Array.from(new Set(
        tableRows
          .filter(r => String(r[1] || '').trim().toLowerCase() === selectedTorre.toLowerCase())
          .map(r => String(r[2] || '').trim())
          .filter(u => u !== '')
      ))
    : [];

  const matchingRow = (selectedTorre && selectedUnidade)
    ? tableRows.find(r => 
        String(r[1] || '').trim().toLowerCase() === selectedTorre.toLowerCase() &&
        String(r[2] || '').trim().toLowerCase() === selectedUnidade.toLowerCase()
      )
    : null;

  const hasUnitSelected = Boolean(selectedTorre && selectedUnidade && matchingRow);

  const fase = matchingRow ? String(matchingRow[0] || '1ª') : '-';
  const tipologia = matchingRow ? String(matchingRow[5] || '2 Quartos') : '-';
  const areaPriv = matchingRow ? formatM2(matchingRow[3]) : '0,00 m²';
  const areaQuintal = matchingRow ? formatM2(matchingRow[4]) : '0,00 m²';

  const price = hasUnitSelected && matchingRow ? parseCurrency(matchingRow[7]) : 0;
  const evaluation = hasUnitSelected && matchingRow ? parseCurrency(matchingRow[6]) : 0;

  const itbiValTabela = (hasUnitSelected && matchingRow) 
    ? (isFirstHomeLocal ? parseCurrency(matchingRow[8]) : parseCurrency(matchingRow[9]))
    : 0;

  const handleTorreChange = (torre: string) => {
    setSelectedTorre(torre);
    setSelectedUnidade('');
    setIsManualObra(false);
    setIsManualPos(false);
    setItbiTotalManual(null);
    setItbiObraValorManual(null);
    setItbiPosValorManual(null);
    if (currentProd) {
      onUnitSelectChange(currentProd.id, { torre, unidade: '' });
    }
  };

  const handleUnidadeChange = (unidade: string) => {
    setSelectedUnidade(unidade);
    setIsManualObra(false);
    setIsManualPos(false);
    setItbiTotalManual(null);
    setItbiObraValorManual(null);
    setItbiPosValorManual(null);
    if (currentProd) {
      onUnitSelectChange(currentProd.id, { torre: selectedTorre, unidade });
    }
  };

  const handleProductDropdownChange = (prodId: string) => {
    const targetProd = products.find(p => p.id === prodId);
    if (targetProd && onSelectProduct) {
      const prodWithConds = ensureProductConditions({ ...targetProd });
      const firstCond = prodWithConds.conditions[0];
      onSelectProduct(prodWithConds, firstCond?.id || '');
    }
  };

  const handleConditionDropdownChange = (condId: string) => {
    const targetCond = currentProd.conditions.find(c => c.id === condId);
    if (targetCond && onSelectCondition) {
      onSelectCondition(targetCond);
    }
  };

  const handleResetFicha = () => {
    setSelectedTorre('');
    setSelectedUnidade('');
    setValAtoManual(null);
    setAtoInputText('');
    setIsEditingAto(false);
    setValAtoITBI(0);
    setItbiAtoInputText('');
    setIsEditingAtoITBI(false);
    setIsAtoPremiadoEnabled(true);
    setIsManualObra(false);
    setIsManualPos(false);
    setItbiTotalManual(null);
    setItbiObraValorManual(null);
    setItbiPosValorManual(null);
    if (currentProd) {
      onUnitSelectChange(currentProd.id, { torre: '', unidade: '' });
    }
    onShowToast('Ficha Morar limpa com sucesso. Os dados da simulação foram mantidos.');
  };

  const limparFluxoPagamento = () => {
    setValAtoManual(null);
    setAtoInputText('');
    setIsEditingAto(false);
    setValAtoITBI(0);
    setItbiAtoInputText('');
    setIsEditingAtoITBI(false);
    setIsAtoPremiadoEnabled(true);
    setIsManualObra(false);
    setIsManualPos(false);
    if (onShowToast) {
      onShowToast('Fluxo de pagamento redefinido para as condições padrão.');
    }
  };

  // CÁLCULOS FINANCEIROS E RECURSOS
  const income = simulationData.income;
  const rawSubsidy = hasUnitSelected ? simulationData.subsidy : 0;
  const rawFGTS = hasUnitSelected ? simulationData.fgts : 0;
  const inputFinancing = simulationData.financing;
  const percent = simulationData.finPercent;
  const maxAllowed = (hasUnitSelected && evaluation > 0) ? (evaluation * percent) : 0;

  const sinalMinimoPolicy = currentCond?.sinalMinimo ? parseCurrency(currentCond.sinalMinimo) : 2000;
  const sinalMinimoVal = sinalMinimoPolicy > 0 ? sinalMinimoPolicy : 2000;

  // 1. VALOR BASE: Maior entre Preço de Tabela e Avaliação Bancária
  const valorBase = hasUnitSelected ? Math.max(price, evaluation) : 0;

  let rawMaxFinanc = 0;
  if (hasUnitSelected) {
    if (inputFinancing > 0 && maxAllowed > 0) {
      rawMaxFinanc = Math.min(inputFinancing, maxAllowed);
    } else if (inputFinancing > 0 && price > 0) {
      rawMaxFinanc = Math.min(inputFinancing, price);
    } else if (evaluation > 0) {
      rawMaxFinanc = maxAllowed;
    } else {
      rawMaxFinanc = inputFinancing;
    }
  }

  const valorAvaliacao = (hasUnitSelected && evaluation > 0) ? evaluation : price;
  const precoTabelaMenosSinalMin = (hasUnitSelected && price > 0) ? Math.max(0, price - sinalMinimoVal) : 0;
  const tetoMaximo = (hasUnitSelected && price > 0)
    ? Math.min(valorAvaliacao, precoTabelaMenosSinalMin)
    : 0;

  const somaRecursos = hasUnitSelected ? (rawMaxFinanc + rawSubsidy + rawFGTS) : 0;
  const totalNegociado = hasUnitSelected ? Math.min(somaRecursos, tetoMaximo) : 0;
  const totalNegoc = totalNegociado;

  let maxFinanc = rawMaxFinanc;
  let fgts = rawFGTS;
  let subsidy = rawSubsidy;

  if (hasUnitSelected && somaRecursos > tetoMaximo) {
    let excesso = somaRecursos - tetoMaximo;
    const abateFinanc = Math.min(maxFinanc, excesso);
    maxFinanc -= abateFinanc;
    excesso -= abateFinanc;

    if (excesso > 0) {
      const abateFGTS = Math.min(fgts, excesso);
      fgts -= abateFGTS;
      excesso -= abateFGTS;
    }

    if (excesso > 0) {
      const abateSubsidy = Math.min(subsidy, excesso);
      subsidy -= abateSubsidy;
      excesso -= abateSubsidy;
    }
  }

  // ITBI / REGISTRO TOTAL (Taxas cartorárias do empreendimento/unidade)
  const despCartoriasCalculadas = hasUnitSelected 
    ? (itbiValTabela > 0 ? itbiValTabela : (price * 0.0441))
    : 0;

  const valorTotalITBI = itbiTotalManual !== null ? itbiTotalManual : despCartoriasCalculadas;
  const atoITBIValidado = Math.min(valAtoITBI, valorTotalITBI);
  const saldoITBI = Math.max(0, valorTotalITBI - atoITBIValidado);
  const despCartoriasEfetivas = valorTotalITBI;

  // DIVISÃO POR FASES (OBRA VS PÓS-OBRA)
  const totalParcObra = faixasObra.reduce((acc, f) => acc + (Number(f.qtd) || 0), 0);
  const totalParcPos = faixasPos.reduce((acc, f) => acc + (Number(f.qtd) || 0), 0);
  const totalParcMorar = totalParcObra + totalParcPos;

  // Motor Base Morar (sem ato manual) para estabelecer o padrão de piso/sugestão e risco da política
  const morarEngineBase = useMemo(() => {
    if (!hasUnitSelected || price <= 0) return null;
    const mesesObraPadrao = currentCond?.mesesObra ?? 33;
    const mesesObraParam = totalParcObra > 0 ? totalParcObra : mesesObraPadrao;
    const mesesPosParam = totalParcObra < mesesObraPadrao ? 0 : (totalParcPos > 0 ? totalParcPos : (currentCond?.mesesPos ?? 27));

    const globalPct: [number, number, number, number, number, number] = [
      currentCond?.globalSerie1Pct ?? 30.0,
      currentCond?.globalSerie2Pct ?? 25.0,
      currentCond?.globalSerie3Pct ?? 20.0,
      currentCond?.globalSerie4Pct ?? 15.0,
      currentCond?.globalSerie5Pct ?? 10.0,
      currentCond?.globalSerie6Pct ?? 5.0
    ];

    const proSolutoGlobalParam = currentCond?.percMaxProSolutoGlobal ?? currentCond?.riscoImovelPct ?? 17.0;
    const posObraGlobalParam = currentCond?.percMaxPosObra ?? currentCond?.riscoPosPct ?? 8.0;

    return calculateMorarFlowEngine({
      precoTabela: price,
      avaliacaoBanco: evaluation,
      itbiRegistro: despCartoriasEfetivas,
      renda: income,
      financiamento: maxFinanc,
      subsidio: subsidy,
      fgts: fgts,
      percentualRiscoGeral: proSolutoGlobalParam,
      percentualRiscoPos: posObraGlobalParam,
      mesesObra: mesesObraParam,
      mesesPos: mesesPosParam,
      globalSeriesPct: globalPct,
      sinalMinimo: sinalMinimoVal,
      isAtoPremiadoEnabled,
      isAtoZerado,
      atoITBI: atoITBIValidado
    });
  }, [hasUnitSelected, price, evaluation, despCartoriasEfetivas, income, maxFinanc, subsidy, fgts, currentCond, sinalMinimoVal, isAtoPremiadoEnabled, isAtoZerado, atoITBIValidado, totalParcObra, totalParcPos]);

  // Piso do Ato Sugerido Inicial e Saldo de Pró-Soluto padrão
  const atoSugeridoResidual = hasUnitSelected ? (morarEngineBase?.atoResidual ?? 0) : 0;
  const valorAtoEfetivo = valAtoManual !== null ? valAtoManual : atoSugeridoResidual;

  // Desconto do Ato Premiado baseado no Ato Efetivo
  const descontoAtoPremiadoCalculado = calcularDescontoAtoPremiado(valorAtoEfetivo);
  const descontoAto = (!isAtoZerado && isAtoPremiadoEnabled) ? descontoAtoPremiadoCalculado : 0;

  // =========================================================================
  // CASCATA COMPLETA DE AMORTIZAÇÃO PROGRESSIVA (REGRA MORAR):
  // Quando o Ato (Imóvel) ultrapassa o valor necessário para cobrir o Sinal:
  // Etapa 1 (Pró-Soluto): Zera as parcelas das séries da construtora (R$ 0,00 líquido).
  // Etapa 2 (Amortização do Financiamento): O excedente abate o Financiamento bancário (Total Negoc.).
  // Etapa 3 (Amortização do FGTS): Se o financiamento zerar, o restante abate o FGTS.
  // Etapa 4 (Amortização do Subsídio): Se o FGTS zerar, o restante abate o subsídio.
  // =========================================================================
  const sinalImovelInicial = hasUnitSelected ? Math.max(0, Math.round((price - (maxFinanc + subsidy + fgts)) * 100) / 100) : 0;
  const sinalLiquidoImovelNecessario = hasUnitSelected ? Math.max(0, Math.round((sinalImovelInicial - descontoAto) * 100) / 100) : 0;

  // 1ª Etapa: Verificação do Pró-Soluto da Construtora e Excedente
  const saldoProSolutoRestante = hasUnitSelected 
    ? Math.max(0, Math.round((sinalLiquidoImovelNecessario - valorAtoEfetivo) * 100) / 100)
    : 0;

  const excedenteAto = hasUnitSelected && valorAtoEfetivo > sinalLiquidoImovelNecessario
    ? Math.max(0, Math.round((valorAtoEfetivo - sinalLiquidoImovelNecessario) * 100) / 100)
    : 0;

  // 2ª Etapa: Abatimento do Financiamento Bancário (Total Negoc. / Financiamento)
  const financiamentoAbatido = Math.min(maxFinanc, excedenteAto);
  const maxFinancEfetivo = Math.max(0, Math.round((maxFinanc - financiamentoAbatido) * 100) / 100);
  const excedenteAposFinanc = Math.max(0, Math.round((excedenteAto - financiamentoAbatido) * 100) / 100);

  // 3ª Etapa: Abatimento do FGTS
  const fgtsAbatido = Math.min(fgts, excedenteAposFinanc);
  const fgtsEfetivo = Math.max(0, Math.round((fgts - fgtsAbatido) * 100) / 100);
  const excedenteAposFGTS = Math.max(0, Math.round((excedenteAposFinanc - fgtsAbatido) * 100) / 100);

  // 4ª Etapa: Abatimento do Subsídio (se aplicável)
  const subsidyAbatido = Math.min(subsidy, excedenteAposFGTS);
  const subsidyEfetivo = Math.max(0, Math.round((subsidy - subsidyAbatido) * 100) / 100);

  // RATEIO DO ITBI/REGISTRO
  const itbiObraTotalMeses = itbiObraQtd > 0 ? itbiObraQtd : (totalParcObra > 0 ? totalParcObra : 33);
  const itbiPosTotalMeses = itbiPosQtd !== undefined ? itbiPosQtd : (totalParcPos >= 0 ? totalParcPos : 0);
  const itbiTotalMeses = itbiObraTotalMeses + itbiPosTotalMeses;

  const itbiCalculadoMes = (hasUnitSelected && itbiTotalMeses > 0 && saldoITBI > 0)
    ? Math.round((saldoITBI / itbiTotalMeses) * 100) / 100
    : 0;

  const itbiParcelaObraValor = itbiObraTotalMeses > 0 
    ? (itbiObraValorManual !== null ? itbiObraValorManual : (itbiPosTotalMeses === 0 ? Math.round((saldoITBI / itbiObraTotalMeses) * 100) / 100 : itbiCalculadoMes))
    : 0;
  const itbiParcelaPosValor = itbiPosTotalMeses > 0
    ? (itbiPosValorManual !== null ? itbiPosValorManual : itbiCalculadoMes)
    : 0;

  // SOMA DAS PARCELAS DE CADA FASE (LÍQUIDO MORAR)
  const somaTotalObra = faixasObra.reduce((acc, f) => {
    const valLiq = saldoProSolutoRestante <= 0 ? 0 : (Number(f.valor) || 0);
    return acc + ((Number(f.qtd) || 0) * valLiq);
  }, 0);
  const somaTotalPos = faixasPos.reduce((acc, f) => {
    const valLiq = saldoProSolutoRestante <= 0 ? 0 : (Number(f.valor) || 0);
    return acc + ((Number(f.qtd) || 0) * valLiq);
  }, 0);
  const somaTotalParceladoMorar = Math.round((somaTotalObra + somaTotalPos) * 100) / 100;

  // SOMA TOTAL DO ITBI PARCELADO E TOTAIS POR FASE C/ ITBI
  const somaITBIObra = itbiObraTotalMeses * itbiParcelaObraValor;
  const somaITBIPos = itbiPosTotalMeses * itbiParcelaPosValor;
  const somaTotalITBI = Math.round((somaITBIObra + somaITBIPos) * 100) / 100;
  const itbiTotalEfetivo = Math.round(((Number(atoITBIValidado) || 0) + somaTotalITBI) * 100) / 100;

  // TOTAIS EFETIVOS RECALCULADOS APÓS CASCATA
  const totalNegocEfetivo = hasUnitSelected ? Math.round((maxFinancEfetivo + subsidyEfetivo + fgtsEfetivo) * 100) / 100 : 0;
  const sinalTotalSemITBIEfetivo = hasUnitSelected ? Math.max(0, Math.round((price - totalNegocEfetivo) * 100) / 100) : 0;
  const sinalLiquidoTotalEfetivo = hasUnitSelected ? Math.max(0, Math.round((sinalTotalSemITBIEfetivo - descontoAto) * 100) / 100) : 0;
  const sinalTotalComITBIEfetivo = hasUnitSelected 
    ? Math.round((sinalTotalSemITBIEfetivo + (itbiTotalEfetivo > 0 ? itbiTotalEfetivo : despCartoriasEfetivas)) * 100) / 100 
    : 0;

  // PARCELAS LÍQUIDAS EFETIVAS DA CONSTRUTORA
  const somaParcelasLiquidasEfetivas = saldoProSolutoRestante <= 0 
    ? 0 
    : (isManualObra || isManualPos ? somaTotalParceladoMorar : saldoProSolutoRestante);

  const totalFaseObraComITBI = saldoProSolutoRestante <= 0 
    ? Math.round(somaITBIObra * 100) / 100
    : Math.round((somaTotalObra + somaITBIObra) * 100) / 100;

  const totalFasePosComITBI = saldoProSolutoRestante <= 0
    ? Math.round(somaITBIPos * 100) / 100
    : Math.round((somaTotalPos + somaITBIPos) * 100) / 100;

  // MAX FLUXO (PARCELAS MORAR + ITBI PARCELADO)
  const maxFluxoEfetivo = Math.round((somaParcelasLiquidasEfetivas + somaTotalITBI) * 100) / 100;

  // TOTALIZADOR DISTRIBUÍDO EM TEMPO REAL
  // Distribuído = Ato (Imóvel) + Desconto Ato + ITBI no Ato + Parcelas Líquidas da Construtora + ITBI Parcelado Total
  const totalDistribuido = Math.round(
    ((Number(valorAtoEfetivo) || 0) + (Number(descontoAto) || 0) + (Number(atoITBIValidado) || 0) + somaParcelasLiquidasEfetivas + somaTotalITBI) * 100
  ) / 100;

  // DIFERENÇA EM TEMPO REAL ENTRE DISTRIBUÍDO E COM ITBI
  const diferencaDistribuicao = Math.round((totalDistribuido - sinalTotalComITBIEfetivo) * 100) / 100;
  const isDistribuicaoValidada = hasUnitSelected && Math.abs(diferencaDistribuicao) <= 0.10;

  // CURVA OFICIAL MORAR DE DISTRIBUIÇÃO AUTOMÁTICA
  // Calcula dinamicamente as séries por teto de renda, extração do ITBI e fechamento do ato residual
  const aplicarDistribuicaoOficialMorar = () => {
    if (!hasUnitSelected || (sinalTotalSemITBIEfetivo <= 0 && price <= 0)) return;

    const mesesObraPadrao = currentCond?.mesesObra ?? 33;
    const mesesObraParam = totalParcObra > 0 ? totalParcObra : mesesObraPadrao;
    const mesesPosParam = totalParcObra < mesesObraPadrao ? 0 : (totalParcPos > 0 ? totalParcPos : (currentCond?.mesesPos ?? 27));

    const globalPct: [number, number, number, number, number, number] = [
      currentCond?.globalSerie1Pct ?? 30.0,
      currentCond?.globalSerie2Pct ?? 25.0,
      currentCond?.globalSerie3Pct ?? 20.0,
      currentCond?.globalSerie4Pct ?? 15.0,
      currentCond?.globalSerie5Pct ?? 10.0,
      currentCond?.globalSerie6Pct ?? 5.0
    ];

    const proSolutoGlobalParam = currentCond?.percMaxProSolutoGlobal ?? currentCond?.riscoImovelPct ?? 17.0;
    const posObraGlobalParam = currentCond?.percMaxPosObra ?? currentCond?.riscoPosPct ?? 8.0;

    const engineResult = calculateMorarFlowEngine({
      precoTabela: price,
      avaliacaoBanco: evaluation,
      itbiRegistro: despCartoriasEfetivas,
      renda: income,
      financiamento: maxFinanc,
      subsidio: subsidy,
      fgts: fgts,
      percentualRiscoGeral: proSolutoGlobalParam,
      percentualRiscoPos: posObraGlobalParam,
      mesesObra: mesesObraParam,
      mesesPos: mesesPosParam,
      globalSeriesPct: globalPct,
      sinalMinimo: sinalMinimoVal,
      atoITBI: atoITBIValidado,
      isAtoPremiadoEnabled,
      isAtoZerado
    });

    const mObraArr = engineResult.obraSeries.map(s => ({ qtd: s.qtd, valor: s.parcelaLiquida, serieIndex: s.serieIndex }));
    const mPosArr = mesesPosParam === 0
      ? [{ qtd: 0, valor: 0, serieIndex: 0 }, { qtd: 0, valor: 0, serieIndex: 1 }, { qtd: 0, valor: 0, serieIndex: 2 }, { qtd: 0, valor: 0, serieIndex: 3 }]
      : engineResult.posSeries.map(s => ({ qtd: s.qtd, valor: s.parcelaLiquida, serieIndex: s.serieIndex }));

    setFaixasObra(mObraArr);
    setFaixasPos(mPosArr);
    setValAtoManual(engineResult.atoResidual);
    setAtoInputText(formatCurrency(engineResult.atoResidual));
    setItbiObraValorManual(engineResult.parcelaMensalITBI);
    setItbiPosValorManual(mesesPosParam === 0 ? 0 : engineResult.parcelaMensalITBI);
    setItbiObraQtd(mObraArr.reduce((a, b) => a + b.qtd, 0));
    setItbiPosQtd(mesesPosParam === 0 ? 0 : mPosArr.reduce((a, b) => a + b.qtd, 0));
    setIsManualObra(false);
    setIsManualPos(false);

    if (onShowToast) {
      onShowToast('Distribuição oficial da Morar calculada e aplicada com sucesso!');
    }
  };

  // Inicialização inteligente e automática quando a unidade é selecionada ou o sinal líquido é atualizado
  useEffect(() => {
    if (!isManualObra && !isManualPos && hasUnitSelected && valAtoManual === null && sinalLiquidoTotalEfetivo > 0) {
      const mesesObraParam = currentCond?.mesesObra ?? 33;
      const mesesPosParam = currentCond?.mesesPos ?? 27;

      const globalPct: [number, number, number, number, number, number] = [
        currentCond?.globalSerie1Pct ?? 30.0,
        currentCond?.globalSerie2Pct ?? 25.0,
        currentCond?.globalSerie3Pct ?? 20.0,
        currentCond?.globalSerie4Pct ?? 15.0,
        currentCond?.globalSerie5Pct ?? 10.0,
        currentCond?.globalSerie6Pct ?? 5.0
      ];

      const proSolutoGlobalParam = currentCond?.percMaxProSolutoGlobal ?? currentCond?.riscoImovelPct ?? 17.0;
      const posObraGlobalParam = currentCond?.percMaxPosObra ?? currentCond?.riscoPosPct ?? 8.0;

      const engineResult = calculateMorarFlowEngine({
        precoTabela: price,
        avaliacaoBanco: evaluation,
        itbiRegistro: despCartoriasEfetivas,
        renda: income,
        financiamento: maxFinanc,
        subsidio: subsidy,
        fgts: fgts,
        percentualRiscoGeral: proSolutoGlobalParam,
        percentualRiscoPos: posObraGlobalParam,
        mesesObra: mesesObraParam,
        mesesPos: mesesPosParam,
        globalSeriesPct: globalPct,
        sinalMinimo: sinalMinimoVal,
        atoITBI: atoITBIValidado,
        isAtoPremiadoEnabled,
        isAtoZerado
      });

      const mObraArr = engineResult.obraSeries.map(s => ({ qtd: s.qtd, valor: s.parcelaLiquida, serieIndex: s.serieIndex }));
      const mPosArr = engineResult.posSeries.map(s => ({ qtd: s.qtd, valor: s.parcelaLiquida, serieIndex: s.serieIndex }));

      setFaixasObra(mObraArr);
      setFaixasPos(mPosArr);
      setValAtoManual(engineResult.atoResidual);
      setAtoInputText(formatCurrency(engineResult.atoResidual));
      setItbiObraValorManual(engineResult.parcelaMensalITBI);
      setItbiPosValorManual(engineResult.parcelaMensalITBI);
      setItbiObraQtd(mObraArr.reduce((a, b) => a + b.qtd, 0));
      setItbiPosQtd(mPosArr.reduce((a, b) => a + b.qtd, 0));
    }
  }, [sinalLiquidoTotalEfetivo, hasUnitSelected, isManualObra, isManualPos, valAtoManual, sinalMinimoVal, currentCond, income, despCartoriasEfetivas, atoITBIValidado, price, evaluation, maxFinanc, subsidy, fgts, isAtoZerado, isAtoPremiadoEnabled]);

  // AÇÃO DE AJUSTAR FLUXO (REBALANCEAMENTO INSTANTÂNEO DO ATO OU DA CURVA)
  const handleAjustarFluxo = () => {
    if (valAtoManual !== null) {
      // Se o Ato foi editado manualmente, ajusta o Ato para absorver a diferença residual exata
      const novoAto = Math.max(0, Math.round((valAtoManual - diferencaDistribuicao) * 100) / 100);
      setValAtoManual(novoAto);
      setAtoInputText(formatCurrency(novoAto));
      if (onShowToast) {
        onShowToast(`Ato ajustado para ${formatCurrency(novoAto)} para igualar 100% ao valor Com ITBI.`);
      }
    } else {
      // Se o Ato for automático, aplica a curva oficial Morar
      aplicarDistribuicaoOficialMorar();
    }
  };

  const mesesObraPadraoPolitica = currentCond?.mesesObra ?? 33;
  const mesesPosPadraoPolitica = currentCond?.mesesPos ?? 27;

  // Função centralizada para aplicar e recalcular fluxo com nova quantidade de meses de Obra
  const recalcularFluxoObraMeses = (novoTotalObra: number) => {
    if (novoTotalObra <= 0) return;

    const globalPct: [number, number, number, number, number, number] = [
      currentCond?.globalSerie1Pct ?? 30.0,
      currentCond?.globalSerie2Pct ?? 25.0,
      currentCond?.globalSerie3Pct ?? 20.0,
      currentCond?.globalSerie4Pct ?? 15.0,
      currentCond?.globalSerie5Pct ?? 10.0,
      currentCond?.globalSerie6Pct ?? 5.0
    ];

    const proSolutoGlobalParam = currentCond?.percMaxProSolutoGlobal ?? currentCond?.riscoImovelPct ?? 17.0;
    const posObraGlobalParam = currentCond?.percMaxPosObra ?? currentCond?.riscoPosPct ?? 8.0;

    // Regra 1: Se o usuário reduziu os meses de Obra abaixo do padrão da política:
    if (novoTotalObra < mesesObraPadraoPolitica) {
      // 1. Zerar o período de Pós-Obra
      // 2. Concentração Total do ITBI na Obra
      setItbiObraQtd(novoTotalObra);
      setItbiPosQtd(0);
      setItbiObraValorManual(null);
      setItbiPosValorManual(0);

      const engineResult = calculateMorarFlowEngine({
        precoTabela: price,
        avaliacaoBanco: evaluation,
        itbiRegistro: despCartoriasEfetivas,
        renda: income,
        financiamento: maxFinanc,
        subsidio: subsidy,
        fgts: fgts,
        percentualRiscoGeral: proSolutoGlobalParam,
        percentualRiscoPos: posObraGlobalParam,
        mesesObra: novoTotalObra,
        mesesPos: 0,
        globalSeriesPct: globalPct,
        sinalMinimo: sinalMinimoVal,
        atoITBI: atoITBIValidado,
        isAtoPremiadoEnabled,
        isAtoZerado
      });

      const mObraArr = engineResult.obraSeries.map(s => ({ qtd: s.qtd, valor: s.parcelaLiquida, serieIndex: s.serieIndex }));
      const mPosArr = [
        { qtd: 0, valor: 0, serieIndex: 0 },
        { qtd: 0, valor: 0, serieIndex: 1 },
        { qtd: 0, valor: 0, serieIndex: 2 },
        { qtd: 0, valor: 0, serieIndex: 3 }
      ];

      setFaixasObra(mObraArr);
      setFaixasPos(mPosArr);
      setValAtoManual(engineResult.atoResidual);
      setAtoInputText(formatCurrency(engineResult.atoResidual));
      setItbiObraValorManual(engineResult.parcelaMensalITBI);
      setItbiPosValorManual(0);
      setIsManualObra(false);
      setIsManualPos(false);

      if (onShowToast) {
        onShowToast(`Obra reduzida para ${novoTotalObra} meses. Pós-Obra zerado e ITBI (${formatCurrency(engineResult.parcelaMensalITBI)}/mês) concentrado na Obra.`);
      }
    } else {
      // Regra 2: Usuário restaurou o padrão da política ou ampliou
      const novoPos = totalParcPos > 0 ? totalParcPos : mesesPosPadraoPolitica;
      setItbiObraQtd(novoTotalObra);
      setItbiPosQtd(novoPos);
      setItbiObraValorManual(null);
      setItbiPosValorManual(null);

      const engineResult = calculateMorarFlowEngine({
        precoTabela: price,
        avaliacaoBanco: evaluation,
        itbiRegistro: despCartoriasEfetivas,
        renda: income,
        financiamento: maxFinanc,
        subsidio: subsidy,
        fgts: fgts,
        percentualRiscoGeral: proSolutoGlobalParam,
        percentualRiscoPos: posObraGlobalParam,
        mesesObra: novoTotalObra,
        mesesPos: novoPos,
        globalSeriesPct: globalPct,
        sinalMinimo: sinalMinimoVal,
        atoITBI: atoITBIValidado,
        isAtoPremiadoEnabled,
        isAtoZerado
      });

      const mObraArr = engineResult.obraSeries.map(s => ({ qtd: s.qtd, valor: s.parcelaLiquida, serieIndex: s.serieIndex }));
      const mPosArr = engineResult.posSeries.map(s => ({ qtd: s.qtd, valor: s.parcelaLiquida, serieIndex: s.serieIndex }));

      setFaixasObra(mObraArr);
      setFaixasPos(mPosArr);
      setValAtoManual(engineResult.atoResidual);
      setAtoInputText(formatCurrency(engineResult.atoResidual));
      setItbiObraValorManual(engineResult.parcelaMensalITBI);
      setItbiPosValorManual(engineResult.parcelaMensalITBI);
      setIsManualObra(false);
      setIsManualPos(false);

      if (onShowToast) {
        onShowToast(`Prazo de Obra restaurado para ${novoTotalObra} meses com divisão padrão de Pós-Obra (${novoPos} meses).`);
      }
    }
  };

  // Função centralizada para aplicar e recalcular fluxo com nova quantidade de meses de Pós-Obra
  const recalcularFluxoPosMeses = (novoTotalPos: number) => {
    if (novoTotalPos < 0) return;

    const globalPct: [number, number, number, number, number, number] = [
      currentCond?.globalSerie1Pct ?? 30.0,
      currentCond?.globalSerie2Pct ?? 25.0,
      currentCond?.globalSerie3Pct ?? 20.0,
      currentCond?.globalSerie4Pct ?? 15.0,
      currentCond?.globalSerie5Pct ?? 10.0,
      currentCond?.globalSerie6Pct ?? 5.0
    ];

    const proSolutoGlobalParam = currentCond?.percMaxProSolutoGlobal ?? currentCond?.riscoImovelPct ?? 17.0;
    const posObraGlobalParam = currentCond?.percMaxPosObra ?? currentCond?.riscoPosPct ?? 8.0;

    const mesesObraAtual = totalParcObra > 0 ? totalParcObra : mesesObraPadraoPolitica;

    setItbiObraQtd(mesesObraAtual);
    setItbiPosQtd(novoTotalPos);
    setItbiObraValorManual(null);
    setItbiPosValorManual(null);

    const engineResult = calculateMorarFlowEngine({
      precoTabela: price,
      avaliacaoBanco: evaluation,
      itbiRegistro: despCartoriasEfetivas,
      renda: income,
      financiamento: maxFinanc,
      subsidio: subsidy,
      fgts: fgts,
      percentualRiscoGeral: proSolutoGlobalParam,
      percentualRiscoPos: posObraGlobalParam,
      mesesObra: mesesObraAtual,
      mesesPos: novoTotalPos,
      globalSeriesPct: globalPct,
      sinalMinimo: sinalMinimoVal,
      atoITBI: atoITBIValidado,
      isAtoPremiadoEnabled,
      isAtoZerado
    });

    const mObraArr = engineResult.obraSeries.map(s => ({ qtd: s.qtd, valor: s.parcelaLiquida, serieIndex: s.serieIndex }));
    const mPosArr = novoTotalPos === 0
      ? [{ qtd: 0, valor: 0, serieIndex: 0 }, { qtd: 0, valor: 0, serieIndex: 1 }, { qtd: 0, valor: 0, serieIndex: 2 }, { qtd: 0, valor: 0, serieIndex: 3 }]
      : engineResult.posSeries.map(s => ({ qtd: s.qtd, valor: s.parcelaLiquida, serieIndex: s.serieIndex }));

    setFaixasObra(mObraArr);
    setFaixasPos(mPosArr);
    setValAtoManual(engineResult.atoResidual);
    setAtoInputText(formatCurrency(engineResult.atoResidual));
    setItbiObraValorManual(engineResult.parcelaMensalITBI);
    setItbiPosValorManual(novoTotalPos > 0 ? engineResult.parcelaMensalITBI : 0);
    setIsManualObra(false);
    setIsManualPos(false);

    if (onShowToast) {
      onShowToast(`Pós-Obra ajustado para ${novoTotalPos} meses (${mesesObraAtual + novoTotalPos} meses totais). ITBI rediluído para ${formatCurrency(engineResult.parcelaMensalITBI)}/mês.`);
    }
  };

  // Manipuladores de edição das faixas
  const handleUpdateFaixaObra = (index: number, field: 'qtd' | 'valor', value: number) => {
    if (field === 'qtd') {
      const copy = [...faixasObra];
      copy[index] = { ...copy[index], qtd: value };
      const newTotal = copy.reduce((acc, f) => acc + (Number(f.qtd) || 0), 0);
      recalcularFluxoObraMeses(newTotal);
      return;
    }
    setIsManualObra(true);
    setFaixasObra(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleUpdateFaixaPos = (index: number, field: 'qtd' | 'valor', value: number) => {
    if (field === 'qtd') {
      const copy = [...faixasPos];
      copy[index] = { ...copy[index], qtd: value };
      const newTotal = copy.reduce((acc, f) => acc + (Number(f.qtd) || 0), 0);
      recalcularFluxoPosMeses(newTotal);
      return;
    }
    setIsManualPos(true);
    setFaixasPos(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleFinishAtoEdit = (rawText: string) => {
    setIsEditingAto(false);
    const parsed = parseCurrency(rawText);
    const pisoMinimo = atoSugeridoResidual || 0;

    if (rawText.trim() === '' || isNaN(parsed) || parsed < pisoMinimo) {
      if (!isNaN(parsed) && parsed > 0 && parsed < pisoMinimo && onShowToast) {
        onShowToast(`O valor informado no Ato (${formatCurrency(parsed)}) é inferior ao Ato Sugerido de ${formatCurrency(pisoMinimo)}. Valor redefinido para o piso.`);
      }
      setValAtoManual(null);
      setAtoInputText(formatCurrency(pisoMinimo));
      aplicarDistribuicaoOficialMorar();
      return;
    }

    // Aporte maior ou igual ao piso mínimo
    setValAtoManual(parsed);
    setAtoInputText(formatCurrency(parsed));

    const descAtoCalculado = (!isAtoZerado && isAtoPremiadoEnabled) ? calcularDescontoAtoPremiado(parsed) : 0;
    const sinalImovelBase = Math.max(0, price - maxFinanc - subsidy - fgts);
    const sinalLiqImovel = Math.max(0, Math.round((sinalImovelBase - descAtoCalculado) * 100) / 100);

    // Se o aporte for suficiente para cobrir ou exceder o Sinal Líquido do Imóvel:
    if (parsed >= sinalLiqImovel) {
      setFaixasObra(prev => prev.map(f => ({ ...f, valor: 0 })));
      setFaixasPos(prev => prev.map(f => ({ ...f, valor: 0 })));
      setIsManualObra(false);
      setIsManualPos(false);

      if (onShowToast) {
        const excedenteFinanc = Math.max(0, Math.round((parsed - sinalLiqImovel) * 100) / 100);
        if (excedenteFinanc > 0) {
          onShowToast(`Ato definido em ${formatCurrency(parsed)}. Pró-soluto 100% quitado e excedente de ${formatCurrency(excedenteFinanc)} amortizado no Financiamento/FGTS.`);
        } else if (descAtoCalculado > 0) {
          onShowToast(`Ato definido em ${formatCurrency(parsed)}. Pró-soluto zerado. Desconto do Ato Premiado de ${formatCurrency(descAtoCalculado)} aplicado.`);
        } else {
          onShowToast(`Ato definido em ${formatCurrency(parsed)}. Pró-soluto 100% coberto pelo Ato.`);
        }
      }
      return;
    }

    // Aporte intermediário (abate parte do Pró-Soluto e redistribui o saldo restante)
    const mesesObraParam = totalParcObra < mesesObraPadraoPolitica ? totalParcObra : mesesObraPadraoPolitica;
    const mesesPosParam = totalParcObra < mesesObraPadraoPolitica ? 0 : mesesPosPadraoPolitica;
    const globalPct: [number, number, number, number, number, number] = [
      currentCond?.globalSerie1Pct ?? 30.0,
      currentCond?.globalSerie2Pct ?? 25.0,
      currentCond?.globalSerie3Pct ?? 20.0,
      currentCond?.globalSerie4Pct ?? 15.0,
      currentCond?.globalSerie5Pct ?? 10.0,
      currentCond?.globalSerie6Pct ?? 5.0
    ];

    const engineResult = calculateMorarFlowEngine({
      precoTabela: price,
      avaliacaoBanco: evaluation,
      itbiRegistro: despCartoriasEfetivas,
      renda: income,
      financiamento: maxFinanc,
      subsidio: subsidy,
      fgts: fgts,
      percentualRiscoGeral: currentCond?.percMaxProSolutoGlobal ?? currentCond?.riscoImovelPct ?? 17.0,
      percentualRiscoPos: currentCond?.percMaxPosObra ?? currentCond?.riscoPosPct ?? 8.0,
      mesesObra: mesesObraParam,
      mesesPos: mesesPosParam,
      globalSeriesPct: globalPct,
      sinalMinimo: sinalMinimoVal,
      atoITBI: atoITBIValidado,
      isAtoPremiadoEnabled,
      isAtoZerado,
      atoManual: parsed
    });

    const mObraArr = engineResult.obraSeries.map(s => ({ qtd: s.qtd, valor: s.parcelaLiquida, serieIndex: s.serieIndex }));
    const mPosArr = mesesPosParam === 0 
      ? [{ qtd: 0, valor: 0, serieIndex: 0 }, { qtd: 0, valor: 0, serieIndex: 1 }, { qtd: 0, valor: 0, serieIndex: 2 }, { qtd: 0, valor: 0, serieIndex: 3 }]
      : engineResult.posSeries.map(s => ({ qtd: s.qtd, valor: s.parcelaLiquida, serieIndex: s.serieIndex }));

    setFaixasObra(mObraArr);
    setFaixasPos(mPosArr);
    setIsManualObra(false);
    setIsManualPos(false);

    if (onShowToast) {
      if (engineResult.atoPremiado > 0) {
        onShowToast(`Ato definido em ${formatCurrency(parsed)}. Desconto do Ato Premiado calculado em ${formatCurrency(engineResult.atoPremiado)}.`);
      } else {
        onShowToast(`Ato definido em ${formatCurrency(parsed)}. Séries redistribuídas proporcionalmente sobre o novo saldo.`);
      }
    }
  };

  const handleFinishITBIEdit = (rawText: string) => {
    setIsEditingAtoITBI(false);
    const parsed = parseCurrency(rawText);
    const maxITBI = valorTotalITBI > 0 ? valorTotalITBI : 0;

    let finalVal = 0;
    if (rawText.trim() === '' || isNaN(parsed) || parsed <= 0) {
      finalVal = 0;
      setValAtoITBI(0);
      setItbiAtoInputText('');
    } else if (hasUnitSelected && maxITBI > 0 && parsed > maxITBI) {
      if (onShowToast) {
        onShowToast(`O valor do Pagamento do ITBI no Ato não pode exceder o total de ${formatCurrency(maxITBI)}. Ajustado para o teto.`);
      }
      finalVal = maxITBI;
      setValAtoITBI(finalVal);
      setItbiAtoInputText(formatCurrency(finalVal));
    } else {
      finalVal = parsed;
      setValAtoITBI(finalVal);
      setItbiAtoInputText(formatCurrency(finalVal));
    }

    setItbiObraValorManual(null);
    setItbiPosValorManual(null);

    // Recalcular o rateio de ITBI e séries
    const mesesObraParam = totalParcObra < mesesObraPadraoPolitica ? totalParcObra : mesesObraPadraoPolitica;
    const mesesPosParam = totalParcObra < mesesObraPadraoPolitica ? 0 : (totalParcPos >= 0 ? totalParcPos : mesesPosPadraoPolitica);
    const globalPct: [number, number, number, number, number, number] = [
      currentCond?.globalSerie1Pct ?? 30.0,
      currentCond?.globalSerie2Pct ?? 25.0,
      currentCond?.globalSerie3Pct ?? 20.0,
      currentCond?.globalSerie4Pct ?? 15.0,
      currentCond?.globalSerie5Pct ?? 10.0,
      currentCond?.globalSerie6Pct ?? 5.0
    ];

    const engineResult = calculateMorarFlowEngine({
      precoTabela: price,
      avaliacaoBanco: evaluation,
      itbiRegistro: despCartoriasEfetivas,
      renda: income,
      financiamento: maxFinanc,
      subsidio: subsidy,
      fgts: fgts,
      percentualRiscoGeral: currentCond?.percMaxProSolutoGlobal ?? currentCond?.riscoImovelPct ?? 17.0,
      percentualRiscoPos: currentCond?.percMaxPosObra ?? currentCond?.riscoPosPct ?? 8.0,
      mesesObra: mesesObraParam,
      mesesPos: mesesPosParam,
      globalSeriesPct: globalPct,
      sinalMinimo: sinalMinimoVal,
      atoITBI: finalVal,
      isAtoPremiadoEnabled,
      isAtoZerado,
      atoManual: valAtoManual !== null ? valAtoManual : undefined
    });

    const mObraArr = engineResult.obraSeries.map(s => ({ qtd: s.qtd, valor: s.parcelaLiquida, serieIndex: s.serieIndex }));
    const mPosArr = mesesPosParam === 0 
      ? [{ qtd: 0, valor: 0, serieIndex: 0 }, { qtd: 0, valor: 0, serieIndex: 1 }, { qtd: 0, valor: 0, serieIndex: 2 }, { qtd: 0, valor: 0, serieIndex: 3 }]
      : engineResult.posSeries.map(s => ({ qtd: s.qtd, valor: s.parcelaLiquida, serieIndex: s.serieIndex }));

    setFaixasObra(mObraArr);
    setFaixasPos(mPosArr);
    setItbiObraValorManual(engineResult.parcelaMensalITBI);
    setItbiPosValorManual(mesesPosParam === 0 ? 0 : engineResult.parcelaMensalITBI);
    setIsManualObra(false);
    setIsManualPos(false);

    if (onShowToast) {
      if (finalVal >= maxITBI && maxITBI > 0) {
        onShowToast(`ITBI quitado no Ato (${formatCurrency(finalVal)}). Parcela mensal de ITBI zerada.`);
      } else if (finalVal > 0) {
        onShowToast(`ITBI no Ato definido em ${formatCurrency(finalVal)}. Saldo de ITBI restante diluído a ${formatCurrency(engineResult.parcelaMensalITBI)}/mês.`);
      } else {
        onShowToast(`ITBI no Ato zerado. Valor total diluído a ${formatCurrency(engineResult.parcelaMensalITBI)}/mês.`);
      }
    }
  };

  const handleTotalObraParcelasChange = (newTotal: number) => {
    if (newTotal <= 0) return;
    recalcularFluxoObraMeses(newTotal);
  };

  const handleTotalPosParcelasChange = (newTotal: number) => {
    if (newTotal < 0) return;
    recalcularFluxoPosMeses(newTotal);
  };

  const deliveryText = currentProd.deliveryDate 
    ? formatDeliveryText(currentProd.deliveryDate)
    : (fase.includes('2') && currentProd.deliveryDatePhase2)
      ? formatDeliveryText(currentProd.deliveryDatePhase2)
      : currentProd.deliveryDatePhase1
        ? formatDeliveryText(currentProd.deliveryDatePhase1)
        : '';

  const hasTable = tableRows.length > 0;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      
      {/* BARRA SUPERIOR DE AÇÃO E NAVEGAÇÃO */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onBackToSimulator}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar</span>
          </button>
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* DROPDOWN DE EMPREENDIMENTO */}
            {products && products.length > 1 && onSelectProduct ? (
              <div className="relative inline-block">
                <select
                  value={currentProd.id}
                  onChange={(e) => handleProductDropdownChange(e.target.value)}
                  className="appearance-none bg-sky-50 hover:bg-sky-100 text-sky-700 font-extrabold text-xs sm:text-sm pl-3 pr-7 py-1.5 rounded-lg border border-sky-200 uppercase tracking-wide cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id} className="text-slate-800 font-semibold bg-white">
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-sky-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <span className="text-xs sm:text-sm font-extrabold text-sky-600 bg-sky-50 px-3 py-1 rounded-lg border border-sky-100 uppercase tracking-wide">
                {currentProd.name}
              </span>
            )}

            {/* DROPDOWN DE CONDIÇÃO COMERCIAL */}
            {currentProd.conditions && currentProd.conditions.length > 0 && onSelectCondition ? (
              <div className="relative inline-block">
                <select
                  value={currentCond.id}
                  onChange={(e) => handleConditionDropdownChange(e.target.value)}
                  className="appearance-none bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs pl-2.5 pr-6 py-1.5 rounded-lg border border-slate-200/80 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  {currentProd.conditions.map(c => (
                    <option key={c.id} value={c.id} className="text-slate-800 font-medium bg-white">
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <span className="text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
                {currentCond.name}
              </span>
            )}

            {deliveryText && (
              <span
                id="badge-data-entrega-morar"
                className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Chaves ➔ {deliveryText}</span>
              </span>
            )}
          </div>
        </div>

        {/* BOTÃO EXPORTAR PDF / IMPRIMIR */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="px-3.5 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            title="Exportar Ficha Morar em PDF / Imprimir"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* ALERTA: TABELA DE VENDAS NÃO IMPORTADA */}
      {!hasTable && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">Tabela de Vendas Não Importada</h4>
              <p className="text-xs font-medium text-amber-800 mt-0.5">
                Atenção: É necessário importar a tabela de vendas para este empreendimento.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToImport(currentProd.id)}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Importar Tabela (Excel)</span>
          </button>
        </div>
      )}

      {/* CARD DO IMÓVEL E CLIENTE CENTRALIZADOS */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm space-y-2.5 w-full overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-500 font-medium">
              Cliente: <strong className="text-slate-900">{simulationData.clientName || 'Cliente Não Informado'}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-medium">
              Imobiliária: <strong className="text-slate-900">{simulationData.agency?.trim() || 'Imobiliária Não Informada'}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetFicha}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
            title="Limpar Ficha Morar"
          >
            <RotateCcw className="w-3 h-3 text-sky-600" />
            <span>Limpar</span>
          </button>
        </div>

        {/* LINHA 1: TORRE, UNIDADE, FASE, TIPOLOGIA */}
        <div className="grid grid-cols-12 gap-2 text-xs w-full">
          <div className="col-span-2 bg-sky-50/60 p-2 rounded-lg border border-sky-100 flex flex-col items-center justify-center text-center min-w-0">
            <label className="block text-[10px] text-sky-600 font-bold uppercase mb-0.5 text-center whitespace-nowrap">
              TORRE *
            </label>
            <select
              value={selectedTorre}
              onChange={(e) => handleTorreChange(e.target.value)}
              className="w-full bg-white font-bold text-slate-900 border border-slate-200 rounded-md py-1 px-1 focus:outline-none focus:border-sky-600 text-xs cursor-pointer text-center"
            >
              <option value="">--</option>
              {availableTorres.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2 bg-sky-50/60 p-2 rounded-lg border border-sky-100 flex flex-col items-center justify-center text-center min-w-0">
            <label className="block text-[10px] text-sky-600 font-bold uppercase mb-0.5 text-center whitespace-nowrap">
              UNIDADE *
            </label>
            <select
              value={selectedUnidade}
              onChange={(e) => handleUnidadeChange(e.target.value)}
              disabled={!selectedTorre}
              className="w-full bg-white font-bold text-slate-900 border border-slate-200 rounded-md py-1 px-1 focus:outline-none focus:border-sky-600 text-xs cursor-pointer text-center disabled:opacity-50"
            >
              <option value="">--</option>
              {filteredUnits.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2 bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex flex-col items-center justify-center text-center min-w-0">
            <span className="block text-[10px] text-slate-400 font-medium text-center mb-0.5 whitespace-nowrap">Fase</span>
            <input
              id="campo-fase-morar"
              type="text"
              value={fase}
              readOnly
              className="w-full bg-transparent font-bold text-slate-700 text-center focus:outline-none cursor-not-allowed text-xs"
            />
          </div>

          <div className="col-span-6 bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex flex-col items-center justify-center text-center min-w-0">
            <span className="block text-[10px] text-slate-400 font-medium text-center mb-0.5 whitespace-nowrap">Tipologia</span>
            <input
              type="text"
              value={tipologia}
              readOnly
              className="w-full bg-transparent font-bold text-slate-700 text-center focus:outline-none cursor-not-allowed truncate text-xs"
              title={tipologia}
            />
          </div>
        </div>

        {/* LINHA 2: ÁREA PRIVATIVA, QUINTAL, PREÇO DE TABELA, AVALIAÇÃO BANCÁRIA */}
        <div className="grid grid-cols-12 gap-2 text-xs w-full">
          <div className="col-span-2 bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex flex-col items-center justify-center text-center min-w-0">
            <span className="block text-[10px] text-slate-400 font-medium text-center mb-0.5 whitespace-nowrap">Área Privativa</span>
            <input
              type="text"
              value={areaPriv}
              readOnly
              className="w-full bg-transparent font-bold text-slate-700 text-center focus:outline-none cursor-not-allowed text-xs whitespace-nowrap"
            />
          </div>

          <div className="col-span-2 bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex flex-col items-center justify-center text-center min-w-0">
            <span className="block text-[10px] text-slate-400 font-medium text-center mb-0.5 whitespace-nowrap">Quintal</span>
            <input
              type="text"
              value={areaQuintal}
              readOnly
              className="w-full bg-transparent font-bold text-slate-700 text-center focus:outline-none cursor-not-allowed text-xs whitespace-nowrap"
            />
          </div>

          <div className="col-span-4 bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex flex-col items-center justify-center text-center min-w-0">
            <span className="block text-[10px] text-slate-400 font-medium text-center mb-0.5 whitespace-nowrap">Preço de Tabela</span>
            <input
              type="text"
              value={formatCurrency(price)}
              readOnly
              className="w-full bg-transparent font-bold text-slate-900 text-center focus:outline-none cursor-not-allowed text-xs whitespace-nowrap"
            />
          </div>

          <div className="col-span-4 bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex flex-col items-center justify-center text-center min-w-0">
            <span className="block text-[10px] text-slate-400 font-medium text-center mb-0.5 whitespace-nowrap">Avaliação Bancária</span>
            <input
              type="text"
              value={formatCurrency(evaluation)}
              readOnly
              className="w-full bg-transparent font-bold text-emerald-600 text-center focus:outline-none cursor-not-allowed text-xs whitespace-nowrap"
            />
          </div>
        </div>
      </div>

      {/* CORPO DA PÁGINA: GRID DE 2 COLUNAS IDÊNTICO AO DETAILSVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        
        {/* ================= COLUNA DA ESQUERDA: DADOS DA APROVAÇÃO DE CRÉDITO ================= */}
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  1. Dados da Aprovação de Crédito
                </h3>
              </div>
              {hasUnitSelected && valorBase > 0 && (
                <div className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  Valor Base: <strong className="text-slate-800">{formatCurrency(valorBase)}</strong>
                </div>
              )}
            </div>

            {/* SUBCOLUNAS LADO A LADO: RECURSOS DO CLIENTE & OPERAÇÃO BANCÁRIA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block border-b border-slate-200 pb-1 mb-1.5">
                    Recursos do Cliente
                  </span>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">Renda:</span>
                    <strong className="text-slate-800 font-semibold">{formatCurrency(income)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">Subsídio:</span>
                    <strong className="text-emerald-600 font-semibold">{formatCurrency(subsidyEfetivo)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">FGTS:</span>
                    <strong className="text-sky-600 font-semibold">{formatCurrency(fgtsEfetivo)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 mt-1">
                    <span className="text-slate-600">Desconto Ato:</span>
                    <strong className="text-emerald-600 font-semibold">{formatCurrency(descontoAto)}</strong>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block border-b border-slate-200 pb-1 mb-1.5">
                    Operação Bancária
                  </span>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">Max Financ:</span>
                    <strong className="text-sky-600 font-bold">{formatCurrency(maxFinancEfetivo)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">Total Negoc:</span>
                    <strong className="text-slate-800 font-semibold">{formatCurrency(totalNegocEfetivo)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">Sinal Total (s/ ITBI):</span>
                    <strong className="text-amber-700 font-bold">{formatCurrency(sinalTotalSemITBIEfetivo)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 mt-1">
                    <span className="text-slate-600">Sinal Líquido:</span>
                    <strong className="text-amber-800 font-black">{formatCurrency(sinalLiquidoTotalEfetivo)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* TOTAIS COM ITBI E DISTRIBUIÇÃO */}
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex justify-between items-center px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <span className="text-slate-600 font-medium">ITBI / Registro Total:</span>
                <strong className="text-emerald-700 font-bold">{formatCurrency(itbiTotalEfetivo > 0 ? itbiTotalEfetivo : despCartoriasEfetivas)}</strong>
              </div>
              <div className="flex justify-between items-center px-3 py-1.5 bg-emerald-50/60 rounded-lg border border-emerald-100">
                <span className="text-emerald-900 font-bold">Total com ITBI:</span>
                <strong className="text-emerald-800 font-black text-xs sm:text-sm">{formatCurrency(sinalTotalComITBIEfetivo)}</strong>
              </div>
            </div>

            {/* VALIDAÇÃO AUTOMÁTICA EM TEMPO REAL: TOTAL DISTRIBUÍDO */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 bg-sky-50 px-3.5 rounded-lg border border-sky-100 mt-3 gap-2 transition-colors">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800">Distribuído:</span>
                {hasUnitSelected && (
                  isDistribuicaoValidada ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      100% Validado
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAjustarFluxo}
                      className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-all cursor-pointer flex items-center gap-1"
                      title="Clique para recalcular e rebalancear automaticamente o fluxo"
                    >
                      <RotateCcw className="w-2.5 h-2.5 text-amber-700" />
                      <span>Ajustar Fluxo ({diferencaDistribuicao > 0 ? `+${formatCurrency(diferencaDistribuicao)}` : formatCurrency(diferencaDistribuicao)})</span>
                    </button>
                  )
                )}
              </div>
              <strong className="text-xs sm:text-sm font-black text-sky-700">
                {formatCurrency(totalDistribuido)}
              </strong>
            </div>
          </div>

          {/* BANNER AVISO COMERCIAL MORAR */}
          <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              <strong>Obs:</strong> As parcelas que compõem o sinal e ITBI tem vencimento juntas, ou seja, na mesma data.
            </p>
          </div>
        </div>

        {/* ================= COLUNA DA DIREITA: FLUXO DE ENTRADA C/ CONSTRUTORA & FAIXAS MORAR ================= */}
        <div className="space-y-4">
          
          {/* BLOCO 2: FLUXO DE ENTRADA C/ CONSTRUTORA */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                  <Building className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  2. FLUXO DE ENTRADA C/ CONSTRUTORA
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={aplicarDistribuicaoOficialMorar}
                  className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="Distribuir automaticamente segundo a regra oficial da Morar"
                >
                  <Layers className="w-3 h-3 text-sky-600" />
                  <span>Distribuir Morar</span>
                </button>
                <button
                  type="button"
                  onClick={limparFluxoPagamento}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                  title="Redefinir Fluxo de Entrada"
                >
                  <RotateCcw className="w-3 h-3 text-sky-600" />
                  <span>Limpar</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* LINHA DE ENTRADA: 3 COLUNAS (ATO IMÓVEL, ITBI NO ATO, ATO PREMIADO) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* CAMPO 1: ATO (IMÓVEL) */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">
                      Ato (Imóvel)
                    </label>
                  </div>
                  <input
                    type="text"
                    value={isEditingAto ? atoInputText : (valorAtoEfetivo > 0 ? formatCurrency(valorAtoEfetivo) : '')}
                    onFocus={() => {
                      setIsEditingAto(true);
                      setAtoInputText(valorAtoEfetivo > 0 ? formatCurrency(valorAtoEfetivo) : '');
                    }}
                    onChange={(e) => {
                      setAtoInputText(e.target.value);
                    }}
                    onBlur={(e) => {
                      handleFinishAtoEdit(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleFinishAtoEdit(atoInputText);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="R$ 0,00"
                    className="w-full bg-white px-2 py-1 rounded-md border border-slate-200 font-bold text-slate-800 text-center focus:outline-none focus:border-sky-600 text-xs transition-all whitespace-nowrap"
                  />
                </div>

                {/* CAMPO 2: ITBI NO ATO */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-sky-800 uppercase whitespace-nowrap">
                      ITBI no Ato
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsFirstHomeLocal(prev => !prev)}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                        isFirstHomeLocal
                          ? 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                      title="Alternar entre Com Desconto e Sem Desconto no ITBI"
                    >
                      {isFirstHomeLocal ? 'Com Desc.' : 'Sem Desc.'}
                    </button>
                  </div>
                  <input
                    id="input-pagamento-itbi-ato-morar"
                    type="text"
                    value={isEditingAtoITBI ? itbiAtoInputText : (valAtoITBI > 0 ? formatCurrency(valAtoITBI) : '')}
                    onFocus={() => {
                      setIsEditingAtoITBI(true);
                      setItbiAtoInputText(valAtoITBI > 0 ? formatCurrency(valAtoITBI) : '');
                    }}
                    onChange={(e) => {
                      setItbiAtoInputText(e.target.value);
                      const parsed = parseCurrency(e.target.value);
                      if (!isNaN(parsed) && parsed >= 0) {
                        if (hasUnitSelected && valorTotalITBI > 0 && parsed > valorTotalITBI) {
                          setValAtoITBI(valorTotalITBI);
                        } else {
                          setValAtoITBI(parsed);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      handleFinishITBIEdit(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleFinishITBIEdit(itbiAtoInputText);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="R$ 0,00"
                    className="w-full bg-white px-2 py-1 rounded-md border border-slate-200 font-bold text-sky-900 text-center focus:outline-none focus:border-sky-600 text-xs transition-all whitespace-nowrap"
                  />
                </div>

                {/* ATO PREMIADO */}
                <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-amber-800 uppercase whitespace-nowrap">
                      Ato Premiado
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAtoZerado(prev => !prev);
                        setValAtoManual(null);
                        setIsManualObra(false);
                        setIsManualPos(false);
                      }}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                        !isAtoZerado && isAtoPremiadoEnabled 
                          ? 'bg-amber-200 text-amber-900 hover:bg-amber-300' 
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {!isAtoZerado && isAtoPremiadoEnabled ? 'Zerar' : 'Aplicar'}
                    </button>
                  </div>
                  <div className="mt-auto pt-1 text-center">
                    <span className="font-extrabold text-amber-800 text-xs whitespace-nowrap">
                      {!isAtoZerado && isAtoPremiadoEnabled && descontoAto > 0 ? formatCurrency(descontoAto) : 'R$ 0,00'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: CORREÇÃO INCC - OBRA (INTERATIVO) */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Correção INCC - Obra
                  </h3>
                  <div className="flex items-center bg-sky-50 px-1.5 py-0.5 rounded-md border border-sky-100">
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={isEditingObraTotal ? obraQtdText : totalParcObra}
                      onFocus={() => {
                        setIsEditingObraTotal(true);
                        setObraQtdText(String(totalParcObra));
                      }}
                      onChange={(e) => setObraQtdText(e.target.value)}
                      onBlur={(e) => {
                        setIsEditingObraTotal(false);
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) {
                          handleTotalObraParcelasChange(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="morar-input w-8 bg-transparent text-center font-black text-sky-700 text-[11px] focus:outline-none"
                      title="Total de Parcelas da Fase de Obra"
                    />
                    <span className="text-[11px] font-black text-sky-700">X</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium text-[11px]">A partir de:</span>
                  <input
                    type="text"
                    value={dataObra}
                    onChange={(e) => setDataObra(e.target.value)}
                    className="morar-input bg-slate-50 hover:bg-slate-100 focus:bg-white border border-dashed border-slate-200 hover:border-slate-300 focus:border-sky-500 rounded-md px-2 py-0.5 text-xs font-bold text-slate-800 w-32 text-center transition-all focus:outline-none"
                    placeholder="Ex: setembro, 2026"
                  />
                </div>
              </div>
            </div>

            {/* LISTA / GRID DE LINHAS DINÂMICAS DE OBRA */}
            <div className="space-y-2 text-xs">
              {faixasObra
                .map((faixa, originalIndex) => ({ faixa, originalIndex }))
                .filter(({ faixa }) => {
                  const valorLiquido = saldoProSolutoRestante <= 0 ? 0 : (Number(faixa.valor) || 0);
                  const meses = Number(faixa.qtd) || 0;
                  const itbiMensal = Number(itbiParcelaObraValor) || 0;
                  return meses > 0 && (valorLiquido > 0 || itbiMensal > 0);
                })
                .map(({ faixa, originalIndex }, index) => {
                  const valorLiquido = saldoProSolutoRestante <= 0 ? 0 : (Number(faixa.valor) || 0);
                  const subtotalSerie = (Number(faixa.qtd) || 0) * valorLiquido;
                  const parcelaBrutaComITBI = valorLiquido + itbiParcelaObraValor;
                  const displayIndex = (faixa as any).serieIndex !== undefined ? (faixa as any).serieIndex + 1 : originalIndex + 1;

                  return (
                    <div key={originalIndex} className="bg-slate-50/70 hover:bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 space-y-1.5 transition-colors">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4 flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-400">S{displayIndex}:</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={faixa.qtd}
                            onChange={(e) => handleUpdateFaixaObra(originalIndex, 'qtd', parseInt(e.target.value, 10) || 0)}
                            className="morar-input w-11 bg-white hover:bg-slate-100 focus:bg-white px-1 py-1 rounded border border-dashed border-slate-300 font-bold text-sky-700 text-center text-xs focus:outline-none focus:border-sky-500 transition-all"
                            title="Quantidade de Parcelas"
                          />
                          <span className="font-bold text-slate-600 text-xs">X de</span>
                        </div>

                        <div className="col-span-5">
                          <input
                            type="text"
                            value={valorLiquido > 0 ? formatCurrency(valorLiquido) : (saldoProSolutoRestante <= 0 ? 'R$ 0,00' : '')}
                            onChange={(e) => {
                              const parsed = parseCurrency(e.target.value);
                              handleUpdateFaixaObra(originalIndex, 'valor', isNaN(parsed) ? 0 : parsed);
                            }}
                            placeholder="R$ 0,00"
                            className="morar-input w-full bg-white hover:bg-slate-100 focus:bg-white px-2 py-1 rounded border border-dashed border-slate-300 font-bold text-slate-800 text-right text-xs focus:outline-none focus:border-sky-500 transition-all"
                            title="Valor Líquido Morar"
                          />
                        </div>

                        <div className="col-span-3 text-right">
                          <span className="text-[9px] text-slate-400 block font-medium">Subtotal</span>
                          <strong className="text-[11px] text-slate-800 font-bold">
                            {formatCurrency(subtotalSerie)}
                          </strong>
                        </div>
                      </div>

                      {/* DETALHE DO RATEIO DO ITBI + PARCELA BRUTA */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 bg-white/70 px-2 py-0.5 rounded border border-slate-100">
                        <span>+ ITBI: <strong className="text-emerald-700">{formatCurrency(itbiParcelaObraValor)}</strong></span>
                        <span>Parcela Bruta: <strong className="text-slate-900 font-bold">{formatCurrency(parcelaBrutaComITBI)}/mês</strong></span>
                      </div>
                    </div>
                  );
                })}

              <div className="flex justify-between items-center px-2 pt-1 text-[11px] text-slate-500 font-medium border-t border-slate-100 mt-1">
                <span>Total Fase Obra (c/ ITBI):</span>
                <strong className="text-slate-900 font-bold">{formatCurrency(totalFaseObraComITBI)}</strong>
              </div>
            </div>
          </div>

          {/* CARD 3: CORREÇÃO IPCA+1% - PÓS (INTERATIVO) */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Correção IPCA+1% - Pós
                  </h3>
                  <div className="flex items-center bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={isEditingPosTotal ? posQtdText : totalParcPos}
                      onFocus={() => {
                        setIsEditingPosTotal(true);
                        setPosQtdText(String(totalParcPos));
                      }}
                      onChange={(e) => setPosQtdText(e.target.value)}
                      onBlur={(e) => {
                        setIsEditingPosTotal(false);
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) {
                          handleTotalPosParcelasChange(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="morar-input w-8 bg-transparent text-center font-black text-indigo-700 text-[11px] focus:outline-none"
                      title="Total de Parcelas da Fase Pós-Obra"
                    />
                    <span className="text-[11px] font-black text-indigo-700">X</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium text-[11px]">A partir de:</span>
                  <input
                    type="text"
                    value={dataPos}
                    onChange={(e) => setDataPos(e.target.value)}
                    className="morar-input bg-slate-50 hover:bg-slate-100 focus:bg-white border border-dashed border-slate-200 hover:border-slate-300 focus:border-sky-500 rounded-md px-2 py-0.5 text-xs font-bold text-slate-800 w-32 text-center transition-all focus:outline-none"
                    placeholder="Ex: junho, 2029"
                  />
                </div>
              </div>
            </div>

            {/* LISTA / GRID DE LINHAS DINÂMICAS DE PÓS-OBRA */}
            <div className="space-y-2 text-xs">
              {totalParcPos === 0 && (
                <div className="py-3 px-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center">
                  <p className="text-[11px] text-slate-500 font-medium">
                    Período Pós-Obra inativo (0 meses). Fluxo de parcelas e ITBI 100% concentrados na Obra.
                  </p>
                </div>
              )}
              {faixasPos
                .map((faixa, originalIndex) => ({ faixa, originalIndex }))
                .filter(({ faixa }) => {
                  const valorLiquido = saldoProSolutoRestante <= 0 ? 0 : (Number(faixa.valor) || 0);
                  const meses = Number(faixa.qtd) || 0;
                  const itbiMensal = Number(itbiParcelaPosValor) || 0;
                  return meses > 0 && (valorLiquido > 0 || itbiMensal > 0);
                })
                .map(({ faixa, originalIndex }, index) => {
                  const valorLiquido = saldoProSolutoRestante <= 0 ? 0 : (Number(faixa.valor) || 0);
                  const subtotalSerie = (Number(faixa.qtd) || 0) * valorLiquido;
                  const parcelaBrutaComITBI = valorLiquido + itbiParcelaPosValor;
                  const displayIndex = (faixa as any).serieIndex !== undefined ? (faixa as any).serieIndex + 1 : originalIndex + 1;

                  return (
                    <div key={originalIndex} className="bg-slate-50/70 hover:bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 space-y-1.5 transition-colors">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4 flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-400">S{displayIndex}:</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={faixa.qtd}
                            onChange={(e) => handleUpdateFaixaPos(originalIndex, 'qtd', parseInt(e.target.value, 10) || 0)}
                            className="morar-input w-11 bg-white hover:bg-slate-100 focus:bg-white px-1 py-1 rounded border border-dashed border-slate-300 font-bold text-indigo-700 text-center text-xs focus:outline-none focus:border-indigo-500 transition-all"
                            title="Quantidade de Parcelas"
                          />
                          <span className="font-bold text-slate-600 text-xs">X de</span>
                        </div>

                        <div className="col-span-5">
                          <input
                            type="text"
                            value={valorLiquido > 0 ? formatCurrency(valorLiquido) : (saldoProSolutoRestante <= 0 ? 'R$ 0,00' : '')}
                            onChange={(e) => {
                              const parsed = parseCurrency(e.target.value);
                              handleUpdateFaixaPos(originalIndex, 'valor', isNaN(parsed) ? 0 : parsed);
                            }}
                            placeholder="R$ 0,00"
                            className="morar-input w-full bg-white hover:bg-slate-100 focus:bg-white px-2 py-1 rounded border border-dashed border-slate-300 font-bold text-slate-800 text-right text-xs focus:outline-none focus:border-indigo-500 transition-all"
                            title="Valor Líquido Morar"
                          />
                        </div>

                        <div className="col-span-3 text-right">
                          <span className="text-[9px] text-slate-400 block font-medium">Subtotal</span>
                          <strong className="text-[11px] text-slate-800 font-bold">
                            {formatCurrency(subtotalSerie)}
                          </strong>
                        </div>
                      </div>

                      {/* DETALHE DO RATEIO DO ITBI + PARCELA BRUTA */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 bg-white/70 px-2 py-0.5 rounded border border-slate-100">
                        <span>+ ITBI: <strong className="text-emerald-700">{formatCurrency(itbiParcelaPosValor)}</strong></span>
                        <span>Parcela Bruta: <strong className="text-slate-900 font-bold">{formatCurrency(parcelaBrutaComITBI)}/mês</strong></span>
                      </div>
                    </div>
                  );
                })}

              <div className="flex justify-between items-center px-2 pt-1 text-[11px] text-slate-500 font-medium border-t border-slate-100 mt-1">
                <span>Total Fase Pós-Obra (c/ ITBI):</span>
                <strong className="text-slate-900 font-bold">{formatCurrency(totalFasePosComITBI)}</strong>
              </div>
            </div>
          </div>

          {/* CARD 4: CORREÇÃO IGPM+1% (TAXAS E REGISTRO / ITBI INTERATIVO) */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Receipt className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Correção IGPM+1% (Taxas e Registro)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFirstHomeLocal(prev => !prev)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    isFirstHomeLocal
                      ? 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                  title="Alternar entre Com Desconto e Sem Desconto no ITBI"
                >
                  {isFirstHomeLocal ? '1º Imóvel (Com Desc.)' : '2º Imóvel (Sem Desc.)'}
                </button>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* ITBI / REGISTRO TOTAL */}
              <div className="flex justify-between items-center bg-emerald-50/60 hover:bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 transition-colors">
                <div>
                  <span className="text-xs font-bold text-emerald-900 block">ITBI / Registro Total:</span>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium mt-0.5">
                    <span>A partir de:</span>
                    <input
                      type="text"
                      value={dataITBI}
                      onChange={(e) => setDataITBI(e.target.value)}
                      className="morar-input bg-transparent hover:bg-white/60 focus:bg-white border-b border-dashed border-emerald-300 font-bold text-emerald-900 px-1 py-0.5 text-[10px] w-24 text-center focus:outline-none"
                      placeholder="Data início"
                    />
                  </div>
                </div>
                <div className="w-36 text-right">
                  <input
                    type="text"
                    value={isEditingITBITotal ? itbiInputText : (despCartoriasEfetivas > 0 ? formatCurrency(despCartoriasEfetivas) : '')}
                    onFocus={() => {
                      setIsEditingITBITotal(true);
                      setItbiInputText(despCartoriasEfetivas > 0 ? String(despCartoriasEfetivas) : '');
                    }}
                    onChange={(e) => setItbiInputText(e.target.value)}
                    onBlur={(e) => {
                      setIsEditingITBITotal(false);
                      const parsed = parseCurrency(e.target.value);
                      if (!isNaN(parsed) && parsed >= 0) {
                        setItbiTotalManual(parsed);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="R$ 0,00"
                    className="morar-input w-full bg-white hover:bg-emerald-50/50 focus:bg-white px-2 py-1 rounded border border-dashed border-emerald-300 font-black text-emerald-800 text-right text-xs sm:text-sm transition-all focus:outline-none"
                    title="Valor Total de ITBI e Registro"
                  />
                </div>
              </div>

              {/* DISCRIMINAÇÃO: ITBI NO ATO E SALDO RESTANTE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/80">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[11px] font-medium text-slate-600">ITBI Pago no Ato:</span>
                  <strong className="text-xs font-bold text-emerald-700">
                    {atoITBIValidado > 0 ? formatCurrency(atoITBIValidado) : 'R$ 0,00'}
                  </strong>
                </div>
                <div className="flex justify-between items-center px-1 border-t sm:border-t-0 sm:border-l border-slate-200 pt-1.5 sm:pt-0 sm:pl-2.5">
                  <span className="text-[11px] font-medium text-slate-600">Saldo Restante a Parcelar:</span>
                  <strong className="text-xs font-bold text-slate-900">
                    {saldoITBI > 0 ? formatCurrency(saldoITBI) : 'R$ 0,00'}
                  </strong>
                </div>
              </div>

              {/* DISTRIBUIÇÃO DAS PARCELAS RESTANTES: OBRA E PÓS-OBRA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* OBRA */}
                <div className="bg-slate-50 hover:bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/80 space-y-1.5 text-center transition-colors">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Obra:</span>
                    <span className="text-[10px] text-slate-400 font-medium">{itbiObraTotalMeses} meses</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={itbiObraQtd}
                      onChange={(e) => setItbiObraQtd(parseInt(e.target.value, 10) || 1)}
                      className="morar-input w-10 bg-white hover:bg-slate-100 focus:bg-white px-1 py-0.5 rounded border border-dashed border-slate-300 font-bold text-slate-800 text-center text-xs focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-600">X de</span>
                    <input
                      type="text"
                      value={isEditingItbiObraVal ? itbiObraValText : (itbiParcelaObraValor > 0 ? formatCurrency(itbiParcelaObraValor) : 'R$ 0,00')}
                      onFocus={() => {
                        setIsEditingItbiObraVal(true);
                        setItbiObraValText(itbiParcelaObraValor > 0 ? String(itbiParcelaObraValor) : '');
                      }}
                      onChange={(e) => setItbiObraValText(e.target.value)}
                      onBlur={(e) => {
                        setIsEditingItbiObraVal(false);
                        const parsed = parseCurrency(e.target.value);
                        if (!isNaN(parsed) && parsed >= 0) {
                          setItbiObraValorManual(parsed);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      placeholder="R$ 0,00"
                      className="morar-input w-24 bg-white hover:bg-slate-100 focus:bg-white px-1.5 py-0.5 rounded border border-dashed border-slate-300 font-bold text-slate-900 text-right text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* PÓS OBRA */}
                <div className="bg-slate-50 hover:bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/80 space-y-1.5 text-center transition-colors">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Pós Obra:</span>
                    <span className="text-[10px] text-slate-400 font-medium">{itbiPosTotalMeses} meses</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={itbiPosQtd}
                      onChange={(e) => setItbiPosQtd(parseInt(e.target.value, 10) || 0)}
                      className="morar-input w-10 bg-white hover:bg-slate-100 focus:bg-white px-1 py-0.5 rounded border border-dashed border-slate-300 font-bold text-slate-800 text-center text-xs focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-600">X de</span>
                    <input
                      type="text"
                      value={isEditingItbiPosVal ? itbiPosValText : (itbiParcelaPosValor > 0 ? formatCurrency(itbiParcelaPosValor) : 'R$ 0,00')}
                      onFocus={() => {
                        setIsEditingItbiPosVal(true);
                        setItbiPosValText(itbiParcelaPosValor > 0 ? String(itbiParcelaPosValor) : '');
                      }}
                      onChange={(e) => setItbiPosValText(e.target.value)}
                      onBlur={(e) => {
                        setIsEditingItbiPosVal(false);
                        const parsed = parseCurrency(e.target.value);
                        if (!isNaN(parsed) && parsed >= 0) {
                          setItbiPosValorManual(parsed);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      placeholder="R$ 0,00"
                      className="morar-input w-24 bg-white hover:bg-slate-100 focus:bg-white px-1.5 py-0.5 rounded border border-dashed border-slate-300 font-bold text-slate-900 text-right text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* MODAL DE EXPORTAÇÃO PDF ESPECÍFICO MORAR */}
      {isPdfModalOpen && (
        <PdfExportModalMorar
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          product={currentProd}
          condition={currentCond}
          simulationData={simulationData}
          selectedTorre={selectedTorre}
          selectedUnidade={selectedUnidade}
          fase={fase}
          tipologia={tipologia}
          areaPriv={areaPriv}
          areaQuintal={areaQuintal}
          price={price}
          evaluation={evaluation}
          deliveryText={deliveryText}
          income={income}
          subsidy={subsidyEfetivo}
          fgts={fgtsEfetivo}
          desconto={descontoAto}
          maxFinanc={maxFinancEfetivo}
          totalNegoc={totalNegocEfetivo}
          sinalTotal={sinalTotalSemITBIEfetivo}
          comITBI={sinalTotalComITBIEfetivo}
          distribuido={totalDistribuido}
          dataAto={dataAto}
          valorAto={valorAtoEfetivo}
          dataObra={dataObra}
          totalParcObra={totalParcObra}
          faixasObra={faixasObra}
          dataPos={dataPos}
          totalParcPos={totalParcPos}
          faixasPos={faixasPos}
          dataITBI={dataITBI}
          valorITBI={itbiTotalEfetivo > 0 ? itbiTotalEfetivo : despCartoriasEfetivas}
          itbiObraQtd={itbiObraQtd}
          itbiObraValor={itbiParcelaObraValor}
          itbiPosQtd={itbiPosQtd}
          itbiPosValor={itbiParcelaPosValor}
        />
      )}

    </div>
  );
};
