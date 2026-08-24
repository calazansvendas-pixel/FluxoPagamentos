import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, RotateCcw, KeyRound, FileCheck2, Calculator, ShieldCheck, Building, Coins, AlertTriangle, FileSpreadsheet, PieChart, TrendingUp, Printer, FileDown, ChevronDown, Save, Loader2 } from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { CommercialCondition, Product, SelectedUnit, SimulationData } from '../types';
import { formatCurrency, formatM2, formatArea, parseCurrency, formatDateMonthYear, formatDeliveryText } from '../utils/formatters';
import { calculatePolicyRiskValues, ensureProductConditions, calculatePricePMT, calcularParcelaPrice, resolveConditionForTorre, resolverTetoAtoComDesconto, getConditionKind, calcularParcelamentoMorar, monthsBetweenDates, subtractMonthsFromDate, contarSemestraisJunhoDezembro, gerarDatasSemestrais } from '../utils/calculations';
import { PdfExportModal } from './PdfExportModal';
import { EmptySimulationNotice } from './EmptySimulationNotice';
import { FluxoEntradaConstrutora } from './FluxoEntradaConstrutora';
import { PmCampoEditavel } from './PmCampoEditavel';
import { imoveisService } from '../services/imoveisService';

interface DetailsViewProps {
  product: Product | null;
  condition: CommercialCondition | null;
  products?: Product[];
  currentDate?: string;
  onSelectProduct?: (product: Product, conditionId: string) => void;
  onSelectCondition?: (condition: CommercialCondition) => void;
  simulationData: SimulationData;
  selectedUnits: Record<string, SelectedUnit>;
  onUnitSelectChange: (productId: string, unit: SelectedUnit) => void;
  onBackToSimulator: () => void;
  onNavigateToImport: (productId: string) => void;
  onShowToast: (message: string) => void;
}

export const DetailsView: React.FC<DetailsViewProps> = ({
  product,
  condition,
  products = [],
  currentDate,
  onSelectProduct,
  onSelectCondition,
  simulationData,
  selectedUnits,
  onUnitSelectChange,
  onBackToSimulator,
  onNavigateToImport,
  onShowToast
}) => {
  const currentProd = useMemo(() => {
    if (product) return product;
    if (products && products.length > 0) return products[0];
    return null;
  }, [product, products]);

  const [selectedTorre, setSelectedTorre] = useState<string>('');
  const [selectedUnidade, setSelectedUnidade] = useState<string>('');

  // Condição base (1ª Fase) selecionada para o produto atual.
  const baseCond = useMemo(() => {
    if (!currentProd) return null;
    const prodWithConds = ensureProductConditions({ ...currentProd });
    if (condition) {
      const match = prodWithConds.conditions.find(c => c.id === condition.id);
      if (match) return match;
    }
    return condition || prodWithConds.conditions[0];
  }, [currentProd, condition]);

  // Condição efetiva já resolvida para a torre selecionada: se a torre estiver
  // marcada como 2ª Fase na política, os parâmetros de fase2Params sobrescrevem
  // os da condição base.
  const currentCond = useMemo(() => (
    resolveConditionForTorre(baseCond, selectedTorre) || baseCond
  ), [baseCond, selectedTorre]);

  // LÓGICA DE DEFINIÇÃO DO PRAZO PADRÃO (HERDADO DINAMICAMENTE DA POLÍTICA DE CRÉDITO)
  const condNumParcelas = Number(currentCond?.numParcelas) || Number(currentProd?.numParcelas) || 60;

  // Carrega os valores de Prazo Faixa 1 e Prazo Faixa 2 do produto/condição selecionado
  const prazoFaixa1 = Number(currentCond?.mesesTabela1) || 0;
  const prazoFaixa2 = Number(currentCond?.mesesTabela2) || 0;
  const limiteMaximoParcelas = Math.max(prazoFaixa1, prazoFaixa2, condNumParcelas, 1);

  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [isFirstHomeLocal, setIsFirstHomeLocal] = useState<boolean>(simulationData.isFirstHome ?? true);

  const [valAtoManual, setValAtoManual] = useState<number | null>(null);
  const [atoInputText, setAtoInputText] = useState<string>('');
  const [isEditingAto, setIsEditingAto] = useState<boolean>(false);

  const [valAtoITBI, setValAtoITBI] = useState<number>(0);
  const [itbiInputText, setItbiInputText] = useState<string>('');
  const [isEditingITBI, setIsEditingITBI] = useState<boolean>(false);

  const [isAtoPremiadoEnabled, setIsAtoPremiadoEnabled] = useState<boolean>(true);

  const [valParc2, setValParc2] = useState<number>(0);
  const [parc2InputText, setParc2InputText] = useState<string>('');
  const [isEditingParc2, setIsEditingParc2] = useState<boolean>(false);

  const [valParc3, setValParc3] = useState<number>(0);
  const [parc3InputText, setParc3InputText] = useState<string>('');
  const [isEditingParc3, setIsEditingParc3] = useState<boolean>(false);

  const [qtdMensais, setQtdMensais] = useState<number>(condNumParcelas);

  // Condição comercial "Parcelamento Morar": mesmo layout desta tela (Sinal c/
  // Banco Direto), mas com o Bloco 3 substituído por um motor de cálculo próprio
  // (ver calcularParcelamentoMorar em utils/calculations.ts) — sem financiamento/
  // Tabela Price, com Sinal mínimo em % do valor do imóvel, parcelas mensais
  // lineares de obra, intermediárias semestrais, parcela final (chaves) e
  // parcelamento pós-obra, todos calculados a partir da política de crédito.
  const isParcelamentoMorar = getConditionKind(currentCond?.name) === 'parcelamento-morar';

  // Todos os campos da condição "Parcelamento Morar" (quantidade e valor de
  // cada bloco) partem de uma sugestão calculada pela política de crédito, mas
  // são livremente editáveis nesta ficha — resetam ao trocar produto/condição
  // ou ao clicar em "Limpar" (null = usa a sugestão automática).
  const [pmMensalObraValorManual, setPmMensalObraValorManual] = useState<number | null>(null);
  // Qtd. Meses da Mensal de Obra: editável, mas só pode DIMINUIR em relação à
  // sugestão automática (hoje -> habite-se) — nunca aumentar além dela.
  const [pmMesesObraManual, setPmMesesObraManual] = useState<number | null>(null);
  const [pmChavesEnabled, setPmChavesEnabled] = useState<boolean>(true);
  // Ligar/desligar cada intermediária semestral individualmente (índice ->
  // usada ou não). Ausente no mapa = usada (padrão true).
  const [pmSemestralIndividualEnabled, setPmSemestralIndividualEnabled] = useState<Record<number, boolean>>({});
  // Valor de cada intermediária semestral, editável individualmente (índice
  // -> valor manual). Cada uma é independente das demais: editar uma não
  // altera o valor das outras, mas entra no mesmo motor de cálculo, então
  // dispara um novo cálculo geral do fluxo (o Ato absorve a diferença).
  const [pmSemestralValorManual, setPmSemestralValorManual] = useState<Record<number, number>>({});
  // Data de cada intermediária semestral, editável individualmente (índice ->
  // "YYYY-MM"). Quando não há override, usa a data sugerida automaticamente.
  const [pmSemestralDatasManual, setPmSemestralDatasManual] = useState<Record<number, string>>({});
  const [pmChavesValorManual, setPmChavesValorManual] = useState<number | null>(null);
  const [pmQtdPosObraManual, setPmQtdPosObraManual] = useState<number | null>(null);
  const [pmPosObraValorManual, setPmPosObraValorManual] = useState<number | null>(null);

  // Sync isFirstHomeLocal when simulationData.isFirstHome changes
  useEffect(() => {
    setIsFirstHomeLocal(simulationData.isFirstHome ?? true);
  }, [simulationData.isFirstHome]);

  // Sync state when product or unit selection changes
  useEffect(() => {
    if (currentProd) {
      const saved = selectedUnits[currentProd.id];
      if (saved && (saved.torre || saved.unidade)) {
        setSelectedTorre(saved.torre || '');
        setSelectedUnidade(saved.unidade || '');
      } else {
        setSelectedTorre('');
        setSelectedUnidade('');
        setValParc2(0);
        setParc2InputText('');
        setIsEditingParc2(false);
        setValParc3(0);
        setParc3InputText('');
        setIsEditingParc3(false);
      }
    }
  }, [currentProd?.id, selectedUnits]);

  // 2. FUNÇÃO E EFFECT DISPARADOS AO TROCAR DE EMPREENDIMENTO OU ATUALIZAR A POLÍTICA DE CRÉDITO:
  // Garante a limpeza do estado residual na memória, reset da seleção ativa de unidade e sincronização da Qtd. Mensais
  const prevProdCondKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = currentProd ? `${currentProd.id}::${currentCond?.id || ''}` : null;
    const isRealSwitch = prevProdCondKeyRef.current !== null && prevProdCondKeyRef.current !== key;
    prevProdCondKeyRef.current = key;
    // No mount inicial (ex.: reabertura de uma simulação salva via "Editar"), a torre/unidade
    // já vêm restauradas em selectedUnits — não zera aqui, senão a seleção se perde assim que
    // a ficha monta. Só limpa quando o usuário de fato troca de produto/condição já dentro da ficha.
    if (!isRealSwitch) return;

    setSelectedTorre('');
    setSelectedUnidade('');
    setValAtoManual(null);
    setAtoInputText('');
    setIsEditingAto(false);
    setValAtoITBI(0);
    setItbiInputText('');
    setIsEditingITBI(false);
    setValParc2(0);
    setParc2InputText('');
    setIsEditingParc2(false);
    setValParc3(0);
    setParc3InputText('');
    setIsEditingParc3(false);
    setQtdMensais(condNumParcelas);
    setIsAtoPremiadoEnabled(true);
    setPmMensalObraValorManual(null);
    setPmMesesObraManual(null);
    setPmChavesEnabled(true);
    setPmSemestralIndividualEnabled({});
    setPmSemestralValorManual({});
    setPmSemestralDatasManual({});
    setPmChavesValorManual(null);
    setPmQtdPosObraManual(null);
    setPmPosObraValorManual(null);
    if (currentProd) {
      onUnitSelectChange(currentProd.id, { torre: '', unidade: '' });
    }
  }, [currentProd?.id, currentCond?.id, currentCond?.numParcelas, condNumParcelas]);

  // Get table rows for current product
  const tableRows = currentProd?.tableInfo?.rows || [];
  const uniqueTorres = React.useMemo(() => {
    return (Array.from(new Set(tableRows.map(r => String(r[1] || '').trim()).filter(t => t !== ''))) as string[])
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [tableRows]);

  // Torres habilitadas para simulação nesta política comercial (sempre a partir
  // da condição base — não depende de qual torre já está selecionada).
  const availableTorres = React.useMemo(() => {
    if (baseCond?.torresHabilitadas === undefined) return uniqueTorres;
    const allowed = (baseCond.torresHabilitadas || []).map(t => String(t || '').trim().toLowerCase());
    return uniqueTorres.filter(t => allowed.includes(String(t || '').trim().toLowerCase()));
  }, [uniqueTorres, baseCond?.torresHabilitadas]);

  // Validação estrita: se a torre ou unidade selecionada não estiver disponível, reseta a seleção
  useEffect(() => {
    if (!currentProd) return;

    if (selectedTorre) {
      const isTorreValid = availableTorres.some(t => t.toLowerCase() === selectedTorre.toLowerCase());
      if (!isTorreValid) {
        setSelectedTorre('');
        setSelectedUnidade('');
        onUnitSelectChange(currentProd.id, { torre: '', unidade: '' });
        return;
      }

      if (selectedUnidade) {
        const unitsOfCurrent = Array.from(new Set(
          tableRows
            .filter(r => String(r[1] || '').trim().toLowerCase() === selectedTorre.toLowerCase())
            .map(r => String(r[2] || '').trim())
            .filter(u => u !== '')
        ));

        const isUnidadeValid = unitsOfCurrent.some(u => String(u).toLowerCase() === selectedUnidade.toLowerCase());
        if (!isUnidadeValid) {
          setSelectedUnidade('');
          onUnitSelectChange(currentProd.id, { torre: selectedTorre, unidade: '' });
        }
      }
    }
  }, [availableTorres, currentProd?.id, currentCond?.id, tableRows]);

  // Filter units by selected torre
  const filteredUnits = selectedTorre
    ? (Array.from(new Set(
        tableRows
          .filter(r => String(r[1] || '').trim().toLowerCase() === selectedTorre.toLowerCase())
          .map(r => String(r[2] || '').trim())
          .filter(u => u !== '')
      )) as string[]).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    : [];

  // Find exact row if torre and unidade are chosen
  const matchingRow = (selectedTorre && selectedUnidade)
    ? tableRows.find(r => 
        String(r[1] || '').trim().toLowerCase() === selectedTorre.toLowerCase() &&
        String(r[2] || '').trim().toLowerCase() === selectedUnidade.toLowerCase()
      )
    : null;

  const hasUnitSelected = Boolean(selectedTorre && selectedUnidade && matchingRow);

  // Extracted row data
  const fase = matchingRow ? String(matchingRow[0] || '1ª') : '-';
  const tipologia = matchingRow ? String(matchingRow[5] || '2 Quartos') : '-';
  const areaPriv = matchingRow ? formatArea(matchingRow[3]) : '0,00 m²';
  const areaQuintal = matchingRow ? formatArea(matchingRow[4]) : '0,00 m²';

  const price = hasUnitSelected && matchingRow ? parseCurrency(matchingRow[7]) : 0;
  const evaluation = hasUnitSelected && matchingRow ? parseCurrency(matchingRow[6]) : 0;

  // ITBI depends on whether it's 1º Imóvel (Com Desconto) or 2º Imóvel (Sem Desconto)
  const itbiVal = (hasUnitSelected && matchingRow) 
    ? (isFirstHomeLocal ? parseCurrency(matchingRow[8]) : parseCurrency(matchingRow[9]))
    : 0;

  // Handle dropdown changes
  const handleTorreChange = (torre: string) => {
    setSelectedTorre(torre);
    setSelectedUnidade('');
    if (currentCond) {
      setQtdMensais(condNumParcelas);
    }
    if (currentProd) {
      onUnitSelectChange(currentProd.id, { torre, unidade: '' });
    }
  };

  const handleUnidadeChange = (unidade: string) => {
    setSelectedUnidade(unidade);
    if (currentCond) {
      setQtdMensais(condNumParcelas);
    }
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
    if (!currentProd) return;
    const targetCond = currentProd.conditions.find(c => c.id === condId);
    if (targetCond && onSelectCondition) {
      onSelectCondition(targetCond);
    }
  };

  // Função isolada de limpeza exclusiva da Ficha de Análise
  const handleResetFicha = () => {
    setSelectedTorre('');
    setSelectedUnidade('');
    setValAtoManual(null);
    setAtoInputText('');
    setIsEditingAto(false);
    setValAtoITBI(0);
    setItbiInputText('');
    setIsEditingITBI(false);
    setIsAtoPremiadoEnabled(true);
    setValParc2(0);
    setParc2InputText('');
    setIsEditingParc2(false);
    setValParc3(0);
    setParc3InputText('');
    setIsEditingParc3(false);
    if (currentCond) {
      setQtdMensais(condNumParcelas);
    }
    setPmMensalObraValorManual(null);
    setPmMesesObraManual(null);
    setPmChavesEnabled(true);
    setPmSemestralIndividualEnabled({});
    setPmSemestralValorManual({});
    setPmSemestralDatasManual({});
    setPmChavesValorManual(null);
    setPmQtdPosObraManual(null);
    setPmPosObraValorManual(null);
    if (currentProd) {
      onUnitSelectChange(currentProd.id, { torre: '', unidade: '' });
    }
    onShowToast('Ficha de Análise limpa com sucesso. Os dados da simulação foram mantidos.');
  };

  // FINANCIAL CALCULATIONS
  const income = simulationData.income || 0;
  // "Parcelamento Morar" não trabalha com Subsídio, FGTS nem Financiamento
  // Bancário — zerados aqui na origem, mesmo que o corretor tenha digitado
  // algum valor no Simulador, para que também não consumam desnecessariamente
  // o teto/cascata de recursos abaixo.
  const rawSubsidy = (hasUnitSelected && !isParcelamentoMorar) ? (simulationData.subsidy || 0) : 0;
  const rawFGTS = (hasUnitSelected && !isParcelamentoMorar) ? (simulationData.fgts || 0) : 0;
  const inputFinancing = (hasUnitSelected && !isParcelamentoMorar) ? (simulationData.financing || 0) : 0;

  const percent = simulationData.finPercent;
  const maxAllowed = (hasUnitSelected && evaluation > 0) ? (evaluation * percent) : 0;

  // Sinal Mínimo configurado na Política de Crédito da condição selecionada.
  // Em "Parcelamento Morar" o piso é um percentual do valor do imóvel (VGV),
  // não um valor fixo em reais como nas demais condições.
  const pmSinalMinimoPct = currentCond?.pmSinalMinimoPct ?? 10;
  const sinalMinimoPolicy = isParcelamentoMorar
    ? (hasUnitSelected ? Math.round(price * (pmSinalMinimoPct / 100) * 100) / 100 : 0)
    : (currentCond?.sinalMinimo ? parseCurrency(currentCond.sinalMinimo) : 2000);
  const sinalMinimoVal = isParcelamentoMorar
    ? sinalMinimoPolicy
    : (sinalMinimoPolicy > 0 ? sinalMinimoPolicy : 2000);

  // Nunca "inventamos" um valor de financiamento: só usamos exatamente o que
  // foi digitado em "Financiamento Estimado" no Simulador (capado pelo teto
  // do banco/avaliação ou pelo preço, quando aplicável) — se nada foi
  // digitado (ou foi digitado 0), o financiamento considerado é 0, nunca um
  // percentual estimado da avaliação. Vale para toda condição comercial.
  let rawMaxFinanc = 0;
  if (hasUnitSelected && inputFinancing > 0) {
    if (maxAllowed > 0) {
      rawMaxFinanc = Math.min(inputFinancing, maxAllowed);
    } else if (price > 0) {
      rawMaxFinanc = Math.min(inputFinancing, price);
    } else {
      rawMaxFinanc = inputFinancing;
    }
  }

  // 1. DEFINIÇÃO DO TETO MÁXIMO DA OPERAÇÃO:
  // a) Não pode ultrapassar o Valor de Avaliação.
  // b) Não pode ultrapassar o Preço de Tabela deduzido do sinal mínimo da política de crédito.
  const valorAvaliacao = (hasUnitSelected && evaluation > 0) ? evaluation : price;
  const precoTabelaMenosSinalMin = (hasUnitSelected && price > 0) ? Math.max(0, price - sinalMinimoVal) : 0;
  const tetoMaximo = (hasUnitSelected && price > 0)
    ? Math.min(valorAvaliacao, precoTabelaMenosSinalMin)
    : 0;

  // 2. TRAVA DO TOTAL NEGOCIADO
  const somaRecursos = hasUnitSelected ? (rawMaxFinanc + rawSubsidy + rawFGTS) : 0;
  const totalNegociado = hasUnitSelected ? Math.min(somaRecursos, tetoMaximo) : 0;
  const totalNegoc = totalNegociado;

  // 3. ABSORÇÃO DO EXCESSO (CORTE EM CASCATA)
  let maxFinanc = rawMaxFinanc;
  let fgts = rawFGTS;
  let subsidy = rawSubsidy;

  if (hasUnitSelected && somaRecursos > tetoMaximo) {
    let excesso = somaRecursos - tetoMaximo;

    // a) Tire primeiro do Financiamento Bancário (até zerar)
    const abateFinanc = Math.min(maxFinanc, excesso);
    maxFinanc -= abateFinanc;
    excesso -= abateFinanc;

    // b) Se ainda sobrar excesso, tire do FGTS (até zerar)
    if (excesso > 0) {
      const abateFGTS = Math.min(fgts, excesso);
      fgts -= abateFGTS;
      excesso -= abateFGTS;
    }

    // c) Se ainda sobrar, tire do Subsídio
    if (excesso > 0) {
      const abateSubsidy = Math.min(subsidy, excesso);
      subsidy -= abateSubsidy;
      excesso -= abateSubsidy;
    }
  }

  const maxPriceEval = Math.max(price, evaluation);
  // REFLEXO NO GAP INICIAL (SINAL TOTAL)
  const gapInicial = hasUnitSelected ? Math.max(0, price - totalNegoc) : 0;

  const despCartorias = hasUnitSelected
    ? (itbiVal > 0 ? itbiVal : (price * 0.0441))
    : 0;

  // ===================== MOTOR "PARCELAMENTO MORAR" =====================
  // Calculado em paralelo ao motor de "Sinal c/ Banco Direto" logo abaixo — os
  // dois nunca alimentam a tela ao mesmo tempo (isParcelamentoMorar decide
  // qual conjunto de valores é realmente usado), mas manter os dois cálculos
  // sempre executando evita qualquer risco de regressão no fluxo já testado
  // do Banco Direto: nada no bloco original precisou ser alterado ou
  // condicionado para este motor novo existir.
  const isPhase2ParaEntrega = hasUnitSelected && matchingRow ? String(fase).includes('2') : false;
  const deliveryDateRaw = isPhase2ParaEntrega && currentProd?.deliveryDatePhase2
    ? currentProd.deliveryDatePhase2
    : (currentProd?.deliveryDatePhase1 || currentProd?.deliveryDate || '');
  const hojeRef = currentDate || new Date().toISOString().split('T')[0];
  const pmMesesObraAuto = hasUnitSelected ? monthsBetweenDates(hojeRef, deliveryDateRaw) : 0;
  // Qtd. Meses da Mensal de Obra é editável, mas só para DIMINUIR em relação à
  // sugestão automática (hoje -> habite-se) — nunca ultrapassá-la. O teto
  // (máximo) é sempre pmMesesObraAuto; o input já garante isso via `maximo`.
  const pmMesesObraQtd = pmMesesObraManual !== null
    ? Math.min(Math.max(0, pmMesesObraManual), pmMesesObraAuto)
    : pmMesesObraAuto;
  // Se o corretor reduziu o prazo de obra em relação ao sugerido, entende-se
  // que não haverá parcelamento pós-obra (quem paga a obra mais rápido está
  // sinalizando que vai quitar tudo até as chaves) — zera automaticamente.
  const pmObraReduzida = pmMesesObraManual !== null && pmMesesObraQtd < pmMesesObraAuto;

  // Vencimento da parcela intermediária final (chaves): quantidade de meses
  // antes do habite-se definida na política de crédito (não é editável na
  // ficha — é um parâmetro comercial, não algo que varia por simulação).
  const pmChavesMesesAntes = currentCond?.pmParcelaChavesMesesAntes ?? 2;
  const pmChavesDataStr = deliveryDateRaw ? subtractMonthsFromDate(deliveryDateRaw, pmChavesMesesAntes) : '';
  const chavesVencimentoStr = pmChavesDataStr ? formatDateMonthYear(pmChavesDataStr) : '';

  // Intermediárias semestrais: sempre em Junho e Dezembro de cada ano, entre
  // hoje e o vencimento das chaves. Cada uma pode ser ligada/desligada
  // individualmente (padrão: todas ligadas) — permanecem disponíveis mesmo
  // com o prazo de obra reduzido, junto com a Parcela de Chaves.
  const pmSemestraisQtdAuto = hasUnitSelected ? contarSemestraisJunhoDezembro(hojeRef, pmChavesDataStr) : 0;
  const pmSemestraisDatasAuto = hasUnitSelected ? gerarDatasSemestrais(hojeRef, pmSemestraisQtdAuto) : [];
  const pmSemestraisDatas = pmSemestraisDatasAuto.map((dataAuto, idx) => (
    pmSemestralDatasManual[idx] ? `${pmSemestralDatasManual[idx]}-01` : dataAuto
  ));
  const pmSemestraisQtdEfetiva = pmSemestraisDatasAuto.filter((_, idx) => pmSemestralIndividualEnabled[idx] !== false).length;

  // Overrides de valor das intermediárias semestrais alinhados à ordem das
  // HABILITADAS (mesmo índice usado por pm.nSemestrais/pm.valoresSemestrais
  // no motor de cálculo) — pula as desligadas, preservando a ordem
  // cronológica das demais.
  const pmSemestraisEnabledIdxs = pmSemestraisDatasAuto
    .map((_, idx) => idx)
    .filter(idx => pmSemestralIndividualEnabled[idx] !== false);
  const pmSemestraisValoresManuais = pmSemestraisEnabledIdxs.map(idx => (
    pmSemestralValorManual[idx] !== undefined ? pmSemestralValorManual[idx] : null
  ));

  const pmPosObraQtd = pmObraReduzida
    ? 0
    : (pmQtdPosObraManual !== null ? pmQtdPosObraManual : (currentCond?.pmQtdParcelasPosObra ?? 12));

  // Datas de início: a 1ª mensal de obra vence no mês seguinte à venda; a 1ª
  // parcela pós-obra vence no mês seguinte à entrega (habite-se).
  const pmMensalObraDataInicioStr = hasUnitSelected ? subtractMonthsFromDate(hojeRef, -1) : '';
  const pmMensalObraDataInicio = pmMensalObraDataInicioStr ? formatDateMonthYear(pmMensalObraDataInicioStr) : '';
  const pmPosObraDataInicioStr = (hasUnitSelected && deliveryDateRaw) ? subtractMonthsFromDate(deliveryDateRaw, -1) : '';
  const pmPosObraDataInicio = pmPosObraDataInicioStr ? formatDateMonthYear(pmPosObraDataInicioStr) : '';

  // Valor de "Ato (Imóvel)" (opção "À Vista") que quita tudo de uma vez,
  // trazendo o saldo inteiro para o Ato — mesmo mecanismo do Banco Direto:
  // ponto fixo ato* = base - desconto(ato*), calculado sobre o financiamento
  // bancário eventual (maxFinanc) já descontando as mensais 30d/60d (que
  // continuam sendo pagas à parte e são somadas de volta ao final, mesma
  // convenção de valAtoManual). Precisa ser calculado ANTES do motor porque,
  // quando ativo, ele também zera os demais blocos (ver chamada abaixo) —
  // no motor novo eles não são mais "o que sobra do Ato", são calculados de
  // forma independente, então só reduzir o Ato não bastaria para esvaziá-los.
  const pmMensaisAntecipadas = (valParc2 || 0) + (valParc3 || 0);
  const pmBaseAVista = hasUnitSelected
    ? Math.max(0, price - maxFinanc - pmMensaisAntecipadas)
    : 0;
  const pmAtoAposAntecipadasAVistaTarget = hasUnitSelected
    ? resolverTetoAtoComDesconto(pmBaseAVista, isAtoPremiadoEnabled)
    : 0;
  const pmAtoAVistaTarget = pmAtoAposAntecipadasAVistaTarget + pmMensaisAntecipadas;
  const pmIsAVistaActive = hasUnitSelected && valAtoManual !== null && Math.abs(valAtoManual - pmAtoAVistaTarget) < 0.01;

  const pm = calcularParcelamentoMorar({
    price,
    renda: income,
    // Esta condição não trabalha com subsídio nem FGTS — apenas financiamento
    // bancário eventual (maxFinanc), Sinal e o parcelamento direto com a Morar.
    recursos: hasUnitSelected ? maxFinanc : 0,
    valAtoManual,
    isAtoPremiadoEnabled,
    pctSinalMinimo: pmSinalMinimoPct,
    pctRiscoRenda: currentCond?.riscoRendaPct ?? 40,
    mesesObraQtd: pmMesesObraQtd,
    semestraisQtd: pmSemestraisQtdEfetiva,
    posObraQtd: pmPosObraQtd,
    pctSemestralMax: currentCond?.pmParcelaSemestralMaxPct ?? 4,
    pctChavesMax: currentCond?.pmParcelaChavesMaxPct ?? 15,
    pctPosObraMax: currentCond?.pmRiscoProSolutoPosObraPct ?? 5,
    // "À Vista" ativo: zera os demais blocos (todo o saldo já foi
    // direcionado para o Ato acima) — do contrário eles continuariam
    // usando seus tetos normais, já que no motor novo não dependem mais do
    // Ato para existir.
    posObraValorManual: pmIsAVistaActive ? 0 : pmPosObraValorManual,
    chavesValorManual: pmIsAVistaActive ? 0 : pmChavesValorManual,
    semestraisValoresManuais: pmIsAVistaActive ? [] : pmSemestraisValoresManuais,
    mensalObraValorManual: pmIsAVistaActive ? 0 : pmMensalObraValorManual,
    parcelaMinimaMensalObra: currentCond?.pmParcelaMinimaMensalObra ?? 200,
    parcelaMinimaSemestral: currentCond?.pmParcelaMinimaSemestral ?? 200,
    parcelaMinimaPosObra: currentCond?.pmParcelaMinimaPosObra ?? 200,
    mensaisAntecipadas: pmMensaisAntecipadas,
    chavesHabilitada: pmIsAVistaActive ? false : pmChavesEnabled
  });
  // "Sinal Total" no mesmo sentido do Bloco 1 do Banco Direto: o que falta do
  // valor do imóvel antes de descontar o Ato em si (Ato + este saldo = tudo
  // que precisa ser pago fora do Ato: mensais de obra + semestrais + chaves).
  const pmSinalTotal = pm.saldoAPagarDireto + pm.atoEfetivo;

  // --- CÁLCULO ITERATIVO (RESOLUÇÃO DE REFERÊNCIA CIRCULAR COMO NO EXCEL) ---
  const riskCalcInitial = calculatePolicyRiskValues(
    currentProd,
    currentCond,
    income,
    qtdMensais,
    price,
    despCartorias,
    evaluation,
    0,
    inputFinancing,
    rawSubsidy,
    rawFGTS,
    percent
  );
  const vpValRiscoRenda = riskCalcInitial.vpVal;
  const riscoImovelPctDec = (currentCond?.riscoImovelPct !== undefined ? currentCond.riscoImovelPct : 25) / 100;

  let atoPremiadoAtual = 0;
  let iteracoes = 0;

  let sinalTotalSemITBI = 0;
  let sinalTotalComITBI = 0;
  let baseRiscoImovel = 0;
  let valorRiscoImovel = 0;
  let riscoMaximoApuradoBruto = 0;
  let taxaBancaria = 0;
  let proSolutoLiquido = 0;
  let pagamentoAtoSinalEfetivo = 0;

  if (hasUnitSelected && price > 0) {
    while (iteracoes < 1000) {
      // a) Recursos Aprovados = (Max Financiamento + Subsídio + FGTS) -> totalNegoc
      // b) GAP Inicial = (Preço de Tabela) - Recursos Aprovados -> gapInicial
      // c) Sinal Total s/ ITBI = GAP Inicial - atoPremiadoAtual
      sinalTotalSemITBI = Math.max(0, gapInicial - atoPremiadoAtual);

      // d) Sinal Total c/ ITBI = (Sinal Total s/ ITBI) + Despesas Cartorárias e ITBI
      sinalTotalComITBI = sinalTotalSemITBI + despCartorias;

      // e) Base Risco Imóvel = (MAX(Preço Tabela, Avaliação Banco) + ITBI) - atoPremiadoAtual
      baseRiscoImovel = Math.max(0, (maxPriceEval + despCartorias) - atoPremiadoAtual);

      // e) Valor Risco Imóvel = Base Risco Imóvel * (% Risco Imóvel);
      valorRiscoImovel = baseRiscoImovel * riscoImovelPctDec;

      // f) Risco Máximo Apurado (Bruto) = MIN(VP Risco Renda, Valor Risco Imóvel);
      riscoMaximoApuradoBruto = (vpValRiscoRenda > 0) 
        ? Math.min(vpValRiscoRenda, valorRiscoImovel) 
        : valorRiscoImovel;

      // g) Taxa Bancária = Risco Máximo Apurado * 0.0020029;
      taxaBancaria = riscoMaximoApuradoBruto * 0.0020029;

      // h) Pró-Soluto Líquido = Risco Máximo Apurado - Taxa Bancária;
      proSolutoLiquido = Math.max(0, riscoMaximoApuradoBruto - taxaBancaria);

      // i) Pagamento Ato (Sinal Efetivo) = (Sinal Total c/ ITBI) - Risco Máximo Apurado Bruto;
      pagamentoAtoSinalEfetivo = Math.max(0, sinalTotalComITBI - riscoMaximoApuradoBruto);

      // Ato Bruto Apurado = (Sinal Total c/ ITBI antes do desconto) - Risco Máximo Apurado Bruto
      const atoBrutoCalculado = Math.max(0, (gapInicial + despCartorias) - riscoMaximoApuradoBruto);

      // j) novoAtoPremiado = Exatamente 10% do Pagamento Ato (Sinal Efetivo), caso o Ato Bruto seja >= 5000
      const novoAtoPremiado = (isAtoPremiadoEnabled && atoBrutoCalculado >= 5000) 
        ? Math.min(pagamentoAtoSinalEfetivo * 0.10, 5000) 
        : 0;

      // 2. CONDIÇÃO DE PARADA: Tolerância zero para bater os centavos do Excel
      if (Math.abs(novoAtoPremiado - atoPremiadoAtual) < 0.0001) {
        atoPremiadoAtual = novoAtoPremiado;
        break;
      }

      atoPremiadoAtual = novoAtoPremiado;
      iteracoes++;
    }

    // 1. TRAVA DO ATO MÍNIMO (PISO DA POLÍTICA DE CRÉDITO) & REDISTRIBUIÇÃO OBRIGATÓRIA
    if (pagamentoAtoSinalEfetivo < sinalMinimoVal) {
      pagamentoAtoSinalEfetivo = sinalMinimoVal;
      atoPremiadoAtual = 0; // Regra dos 10% não se aplica se não atingir 5k
      const baseDividaTotal = gapInicial + despCartorias;
      riscoMaximoApuradoBruto = Math.max(0, baseDividaTotal - pagamentoAtoSinalEfetivo);
      taxaBancaria = riscoMaximoApuradoBruto * 0.0020029;
      proSolutoLiquido = riscoMaximoApuradoBruto - taxaBancaria;
    }
  }

  const atoMinimoCalculado = hasUnitSelected ? Math.max(sinalMinimoVal, pagamentoAtoSinalEfetivo) : 0;
  const sinalTotalOriginal = gapInicial;

  // 1. LEITURA DO APORTE DAS MENSAIS (1ª MENSAL 30D / 2ª MENSAL 60D)
  const mens30d = valParc2 || 0;
  const mens60d = valParc3 || 0;
  const somaMensais = mens30d + mens60d;

  // Valor de "Ato (Imóvel)" (opção "À Vista") que zera exatamente o Pró-Soluto (Sinal
  // Restante), sem tocar Financiamento/FGTS/Subsídio — ponto fixo ato* = baseAVista -
  // desconto(ato*), calculado sobre os recursos ORIGINAIS (maxFinanc + subsidy + fgts,
  // antes de qualquer abatimento), já descontando as mensais 30d/60d (que continuam
  // sendo pagas à parte). A regra do Ato Premiado usada aqui (10% do Ato, capado em
  // R$5.000, a partir de R$5.000) é a mesma de resolverTetoAtoComDesconto/
  // calcularDescontoAtoPremiado, então a função é reaproveitada.
  const baseAVista = hasUnitSelected
    ? Math.max(0, price - (maxFinanc + subsidy + fgts) - somaMensais)
    : 0;
  const atoAposMensaisAVistaTarget = hasUnitSelected
    ? resolverTetoAtoComDesconto(baseAVista, isAtoPremiadoEnabled)
    : 0;
  // valAtoManual é o Ato ANTES da absorção das mensais (mesma convenção já usada pelo
  // onAtoChange existente do FluxoEntradaConstrutora), então somamos de volta.
  const atoAVistaTarget = atoAposMensaisAVistaTarget + somaMensais;
  const isAVistaActive = hasUnitSelected && valAtoManual !== null && Math.abs(valAtoManual - atoAVistaTarget) < 0.01;

  // Teto Máximo do Ato Imóvel: O valor máximo possível é o saldo que quita integralmente a unidade
  // atoMaximoPossivel = precoTabela - subsidio - descontoAto (usamos atoPremiadoAtual já calculado)
  const atoMaximoPossivel = hasUnitSelected ? Math.max(0, price - subsidy - atoPremiadoAtual) : 0;

  const atoImovelDigitadoBruto = (valAtoManual !== null && valAtoManual >= atoMinimoCalculado)
    ? valAtoManual
    : atoMinimoCalculado;

  const atoImovelDigitado = Math.min(atoImovelDigitadoBruto, atoMaximoPossivel);

  // Se o usuário digitou mensais 30d/60d, abate primeiro do Ato (até o piso configurado da política)
  let saldoParaAbater = somaMensais;
  const disponivelAbatimentoAto = Math.max(0, atoImovelDigitado - sinalMinimoVal);
  const atoAbsorvido = Math.min(disponivelAbatimentoAto, saldoParaAbater);
  let atoAposMensais = atoImovelDigitado - atoAbsorvido;
  saldoParaAbater -= atoAbsorvido;

  // Recálculo do Ato Premiado (desconto da Construtora) para o novo Ato do Imóvel
  let novoAtoPremiado = 0;
  if (isAtoPremiadoEnabled && atoAposMensais >= 4500) {
    let currAtoEfetivo = atoAposMensais;
    let currAtoPremiado = 0;
    for (let iter = 0; iter < 100; iter++) {
      const atoBrutoCalculado = currAtoEfetivo + currAtoPremiado;
      const novoDesc = (atoBrutoCalculado >= 5000 && currAtoEfetivo >= 4500)
        ? Math.min(currAtoEfetivo * 0.10, 5000)
        : 0;

      const lacuna = atoAposMensais - currAtoEfetivo;
      currAtoPremiado = novoDesc;
      if (Math.abs(lacuna) < 0.0001) break;
      currAtoEfetivo += lacuna;
    }
    novoAtoPremiado = currAtoPremiado;
  }

  // CASCATA DE AMORTIZAÇÃO DO FINANCIAMENTO (NOVA REGRA)
  const descontoAto = isAtoPremiadoEnabled ? novoAtoPremiado : 0;

  // 1. Cálculo do Teto dos Recursos Bancários/Negociados:
  // O montante máximo que pode ser negociado via banco/governo não pode ultrapassar o saldo restante do imóvel.
  // Consideramos aqui o aporte direto do Ato.
  const saldoNecessarioImovel = hasUnitSelected 
    ? Math.max(0, price - atoImovelDigitado - descontoAto)
    : 0;

  // 2. Amortização do Excedente no Financiamento:
  const somaRecursosAprovados = maxFinanc + subsidy + fgts;
  let maxFinancEfetivo = maxFinanc;
  let fgtsEfetivo = fgts;
  let subsidyEfetivo = subsidy;

  if (somaRecursosAprovados > saldoNecessarioImovel) {
    let excessoAmortizar = somaRecursosAprovados - saldoNecessarioImovel;

    // Abate primeiramente no campo Max Financ (Financiamento Bancário)
    const abateFinanc = Math.min(maxFinancEfetivo, excessoAmortizar);
    maxFinancEfetivo -= abateFinanc;
    excessoAmortizar -= abateFinanc;

    // Se ainda houver excesso, abate do FGTS
    if (excessoAmortizar > 0) {
      const abateFgts = Math.min(fgtsEfetivo, excessoAmortizar);
      fgtsEfetivo -= abateFgts;
      excessoAmortizar -= abateFgts;
    }

    // Se ainda houver excesso, abate do Subsídio
    if (excessoAmortizar > 0) {
      const abateSubsidy = Math.min(subsidyEfetivo, excessoAmortizar);
      subsidyEfetivo -= abateSubsidy;
      excessoAmortizar -= abateSubsidy;
    }
  }

  // 3. REGRA ISOLADA PARA DESPESAS CARTORÁRIAS & ITBI:
  // O saldo de ITBI e Despesas Cartorárias NUNCA deve ser amortizado pelo excedente do Pagamento do Ato.
  // O ITBI/Despesas só é reduzido/abatido se o usuário preencher expressamente o campo "PAGAMENTO ITBI NO ATO".
  const valorTotalITBI = despCartorias;
  const atoITBIValidado = Math.min(valAtoITBI, valorTotalITBI);
  const saldoITBI = Math.max(0, valorTotalITBI - atoITBIValidado);
  const despCartoriasEfetivas = saldoITBI;

  // Base Líquida c/ ITBI da Operação
  const valorBaseImovel = hasUnitSelected ? Math.max(price, evaluation) : 0;
  const baseVendaLiquidaComITBI = hasUnitSelected
    ? Math.max(0, (valorBaseImovel + valorTotalITBI) - descontoAto)
    : 0;

  // 1. Definição do "Total Negoc.":
  // O campo Total Negoc. representa a soma de todos os recursos da operação bancária/recursos do cliente (Financiamento + Subsídio + FGTS):
  // totalNegoc = maxFinancEfetivo + subsidio + fgts
  const totalNegocEfetivo = hasUnitSelected
    ? (maxFinancEfetivo + subsidyEfetivo + fgtsEfetivo)
    : 0;

  // 2. Definição do "Sinal Total":
  // O Sinal Total deduz o Desconto do Ato Premiado do saldo restante do imóvel:
  // sinalTotal = precoTabela - totalNegoc - descontoAto
  const sinalTotal = hasUnitSelected
    ? Math.max(0, price - totalNegocEfetivo - descontoAto)
    : 0;

  // 3. REGRA DE DEDUÇÃO NO PRÓ-SOLUTO (SINAL RESTANTE):
  // Pró-Soluto (Sinal Restante) = Sinal Total - Pagamento Ato (Imóvel) - 1ª Mensal - 2ª Mensal
  // (Nota: o descontoAto já foi deduzido diretamente na formação do sinalTotal)
  const proSolutoSinalRestante = hasUnitSelected
    ? Math.max(0, sinalTotal - atoAposMensais - mens30d - mens60d)
    : 0;
  const proSoluto = proSolutoSinalRestante;

  // 2. PRÓ-SOLUTO TOTAL C/ ITBI (RISCO MÁX):
  // Isole e utilize o saldo devedor restante das despesas de ITBI/Cartório:
  // ITBI_Restante = Math.max(0, DespesasCartorariasTotal - PagamentoITBINoAto)
  // ProSolutoTotalComITBI = ProSolutoSinalRestante + ITBI_Restante
  const itbiRestante = saldoITBI;
  const proSolutoTotalParcelado = hasUnitSelected
    ? Math.max(0, proSolutoSinalRestante + itbiRestante)
    : 0;
  const proSolutoTotalPainel = proSolutoTotalParcelado;

  const atoEfetivo = atoAposMensais + atoITBIValidado;
  const atoBruto = atoEfetivo + descontoAto;

  // Função utilitária para converter inputs flexíveis em número monetário
  const parseFlexibleCurrency = (input: string | number): number => {
    if (input === null || input === undefined || input === '') return 0;
    if (typeof input === 'number') return isNaN(input) ? 0 : input;

    let str = String(input).trim();
    str = str.replace(/^R\$\s*/i, '').trim();
    if (!str) return 0;

    if (str.includes(',')) {
      const clean = str.replace(/\./g, '').replace(',', '.');
      const val = parseFloat(clean);
      return isNaN(val) ? 0 : val;
    }

    if (str.includes('.')) {
      const parts = str.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
        const clean = str.replace(/\./g, '');
        const val = parseFloat(clean);
        return isNaN(val) ? 0 : val;
      }
      const val = parseFloat(str);
      return isNaN(val) ? 0 : val;
    }

    const val = parseFloat(str);
    return isNaN(val) ? 0 : val;
  };

  // Gatilho executado exclusivamente ao término da digitação (onBlur ou Enter)
  const handleFinishAtoEdit = (rawText: string) => {
    setIsEditingAto(false);
    const inputVal = parseFlexibleCurrency(rawText);
    const maxAtoPermitido = price > 0 ? Math.max(0, price - descontoAto) : 0;

    if (rawText.trim() === '' || inputVal === 0) {
      setValAtoManual(null);
      setAtoInputText('');
      return;
    }

    if (hasUnitSelected && atoMinimoCalculado > 0) {
      if (inputVal < atoMinimoCalculado - 0.01) {
        if (onShowToast) {
          onShowToast(`O valor digitado (${formatCurrency(inputVal)}) é menor que o piso sugerido (${formatCurrency(atoMinimoCalculado)}). Valor restaurado.`);
        }
        setValAtoManual(null);
        setAtoInputText('');
      } else if (maxAtoPermitido > 0 && inputVal > maxAtoPermitido + 0.01) {
        if (onShowToast) {
          onShowToast(`O valor digitado excede o saldo total. O Ato foi ajustado para ${formatCurrency(maxAtoPermitido)}.`);
        }
        setValAtoManual(maxAtoPermitido);
        setAtoInputText(formatCurrency(maxAtoPermitido));
      } else {
        setValAtoManual(inputVal);
        setAtoInputText(formatCurrency(inputVal));
      }
    } else {
      setValAtoManual(inputVal > 0 ? inputVal : null);
      setAtoInputText(inputVal > 0 ? formatCurrency(inputVal) : '');
    }
  };

  // Gatilho executado exclusivamente ao término da digitação do ITBI no Ato (onBlur ou Enter)
  const handleFinishITBIEdit = (rawText: string) => {
    setIsEditingITBI(false);
    const parsed = parseFlexibleCurrency(rawText);
    const maxITBI = despCartorias > 0 ? despCartorias : 0;

    if (rawText.trim() === '' || parsed <= 0) {
      setValAtoITBI(0);
      setItbiInputText('');
      return;
    }

    if (hasUnitSelected && maxITBI > 0 && parsed > maxITBI) {
      if (onShowToast) {
        onShowToast(`O valor do Pagamento do ITBI no Ato não pode exceder o total de ${formatCurrency(maxITBI)}. Ajustado para o teto.`);
      }
      setValAtoITBI(maxITBI);
      setItbiInputText(formatCurrency(maxITBI));
    } else {
      setValAtoITBI(parsed);
      setItbiInputText(formatCurrency(parsed));
    }
  };

  // Gatilho executado exclusivamente ao término da digitação da 1ª Mensal 30d (onBlur ou Enter)
  const handleFinishParc2Edit = (rawText: string) => {
    setIsEditingParc2(false);
    const parsed = parseFlexibleCurrency(rawText);

    if (rawText.trim() === '' || parsed <= 0) {
      setValParc2(0);
      setParc2InputText('');
      return;
    }

    if (parsed > 0 && parsed < 200) {
      setValParc2(200);
      setParc2InputText(formatCurrency(200));
      if (onShowToast) {
        onShowToast('O valor mínimo para parcelas mensais é R$ 200,00.');
      }
    } else {
      setValParc2(parsed);
      setParc2InputText(formatCurrency(parsed));
    }
  };

  // Gatilho executado exclusivamente ao término da digitação da 2ª Mensal 60d (onBlur ou Enter)
  const handleFinishParc3Edit = (rawText: string) => {
    setIsEditingParc3(false);
    const parsed = parseFlexibleCurrency(rawText);

    if (rawText.trim() === '' || parsed <= 0) {
      setValParc3(0);
      setParc3InputText('');
      return;
    }

    if (parsed > 0 && parsed < 200) {
      setValParc3(200);
      setParc3InputText(formatCurrency(200));
      if (onShowToast) {
        onShowToast('O valor mínimo para parcelas mensais é R$ 200,00.');
      }
    } else {
      setValParc3(parsed);
      setParc3InputText(formatCurrency(parsed));
    }
  };

  // Função para resetar exclusivamente o Fluxo de Pagamento (Quadros 2 e 3)
  const limparFluxoPagamento = () => {
    setValAtoManual(null);
    setAtoInputText('');
    setIsEditingAto(false);
    setValAtoITBI(0);
    setItbiInputText('');
    setIsEditingITBI(false);
    setValParc2(0);
    setParc2InputText('');
    setIsEditingParc2(false);
    setValParc3(0);
    setParc3InputText('');
    setIsEditingParc3(false);
    setQtdMensais(condNumParcelas);
    setIsAtoPremiadoEnabled(true);
    setPmMensalObraValorManual(null);
    setPmMesesObraManual(null);
    setPmChavesEnabled(true);
    setPmSemestralIndividualEnabled({});
    setPmSemestralValorManual({});
    setPmSemestralDatasManual({});
    setPmChavesValorManual(null);
    setPmQtdPosObraManual(null);
    setPmPosObraValorManual(null);
    if (onShowToast) {
      onShowToast('Fluxo de pagamento redefinido para as condições padrão.');
    }
  };

  // Taxa de juros da política de crédito (a.m.)
  const meses1 = currentCond?.mesesTabela1 || 36;
  const taxa1 = currentCond?.taxaJuros1 !== undefined ? currentCond.taxaJuros1 : 0;
  const taxa2 = currentCond?.taxaJuros2 !== undefined ? currentCond.taxaJuros2 : 1.9;
  const appliedRatePct = (qtdMensais <= meses1) ? taxa1 : taxa2;

  // 4. CÁLCULO DA BASE LÍQUIDA PARA A PARCELA (DESCONTO DO FATOR DE TAXA):
  const baseCalculoParcela = proSolutoTotalParcelado * 0.997997;

  // 5. CÁLCULO DA PARCELA MENSAL (TABELA PRICE COM TAXA APLICADA):
  const parcela = (hasUnitSelected && baseCalculoParcela > 0 && qtdMensais > 0)
    ? calcularParcelaPrice(appliedRatePct, qtdMensais, baseCalculoParcela)
    : 0;

  const limiteRenda = (income && income > 0) ? income * 0.35 : 0;
  const isExceededParc2 = limiteRenda > 0 && mens30d > limiteRenda;
  const isExceededParc3 = limiteRenda > 0 && mens60d > limiteRenda;

  const totalEntradaMorar = atoAposMensais + atoITBIValidado + mens30d + mens60d + descontoAto;

  // --- INDICADORES DE RISCO DA OPERAÇÃO ---
  const baseRendaInformada = (simulationData.income && simulationData.income > 0) ? simulationData.income : 0;

  // Gráfico 1: "Risco Parcela / Comprometimento" (Fatia 1: 1ª Parcela sobre a Base da Renda | Fatia 2: Restante da Renda)
  const valorRiscoParcela = parcela;
  const pctRiscoParcelaRenda = baseRendaInformada > 0
    ? Math.min(100, Math.max(0, (valorRiscoParcela / baseRendaInformada) * 100))
    : 0;
  const valorRestanteRenda = Math.max(0, baseRendaInformada - valorRiscoParcela);
  const pctRestanteRenda = Math.max(0, 100 - pctRiscoParcelaRenda);

  // Gráfico 2: "Risco Pró-Soluto Total" (Fatia 1: Pró-Soluto Total c/ ITBI sobre a Base Líquida c/ ITBI | Fatia 2: Demais Recursos)
  const valorRiscoProSoluto = proSolutoTotalPainel;
  const pctRiscoProSoluto = baseVendaLiquidaComITBI > 0
    ? Math.min(100, Math.max(0, (valorRiscoProSoluto / baseVendaLiquidaComITBI) * 100))
    : 0;
  const valorRestanteProSoluto = Math.max(0, baseVendaLiquidaComITBI - valorRiscoProSoluto);
  const pctRestanteProSoluto = Math.max(0, 100 - pctRiscoProSoluto);

  // Valores de exibição dos Blocos 1 e 4: quando a condição é "Parcelamento
  // Morar", usam o motor `pm` calculado acima; nas demais condições, mantêm
  // exatamente os valores já calculados pelo fluxo original do Banco Direto
  // (nada muda para elas).
  // Esta condição não trabalha com Subsídio nem FGTS — ficam sempre zerados.
  const displaySubsidy = isParcelamentoMorar ? 0 : subsidyEfetivo;
  const displayFgts = isParcelamentoMorar ? 0 : fgtsEfetivo;
  const displayDescontoAto = isParcelamentoMorar ? pm.descontoAtoPremiado : descontoAto;
  const displayMaxFinanc = isParcelamentoMorar ? maxFinanc : maxFinancEfetivo;
  // totalNegoc (genérico) inclui subsídio/FGTS do Simulador, que não se aplicam
  // ao Parcelamento Morar — aqui o "Total Negoc." é só o financiamento bancário.
  const displayTotalNegoc = isParcelamentoMorar ? maxFinanc : totalNegocEfetivo;
  const displaySinalTotal = isParcelamentoMorar ? pmSinalTotal : sinalTotal;

  const displayPctRiscoParcelaRenda = isParcelamentoMorar ? pm.pctRendaMensalObra : pctRiscoParcelaRenda;
  const displayValorRiscoParcela = isParcelamentoMorar ? pm.valorMensalObra : valorRiscoParcela;
  const displayPctRiscoProSoluto = isParcelamentoMorar ? pm.pctSubtotalAteChaves : pctRiscoProSoluto;
  const displayValorRiscoProSoluto = isParcelamentoMorar ? pm.subtotalAteChaves : valorRiscoProSoluto;
  // "Parcelamento Morar" não soma ITBI à Base Líquida (não entra ITBI/registro
  // nesta condição), mas continua deduzindo o desconto do Ato Premiado.
  const pmBaseLiquida = hasUnitSelected ? Math.max(0, price - pm.descontoAtoPremiado) : 0;
  const displayBaseLiquida = isParcelamentoMorar ? pmBaseLiquida : baseVendaLiquidaComITBI;

  // Função auxiliar para renderizar Gráficos de Pizza Sólidos com percentuais internos
  // refinados — mesmo motor de renderização (Recharts) e mesma identidade visual
  // (raio, borda branca entre fatias, estilo de rótulo) dos gráficos de "Sinal c/
  // Morar", mantendo a lógica própria de cada gráfico daqui: 1 valor de risco/
  // comprometimento (fatia colorida) + o saldo livre (fatia neutra), em vez das 3
  // categorias exaustivas que "Sinal c/ Morar" usa.
  const renderSolidPie = (
    pct: number,
    colorPrimary: string,
    colorSecondary: string = '#cbd5e1',
    primaryTextColor: string = '#ffffff',
    secondaryTextColor: string = '#1e293b'
  ) => {
    const clampedPct = Math.min(100, Math.max(0, pct));
    const restPct = Math.max(0, 100 - clampedPct);

    const formatPct = (val: number) => {
      return (val < 10 && val > 0) ? val.toFixed(2) : val.toFixed(1);
    };

    const isSolo = clampedPct <= 0 || restPct <= 0;
    const data = isSolo
      ? [{ name: 'primary', value: 100, fill: clampedPct > 0 ? colorPrimary : colorSecondary }]
      : [
          { name: 'primary', value: clampedPct, fill: colorPrimary },
          { name: 'secondary', value: restPct, fill: colorSecondary }
        ];

    const calcCentroidRadius = (innerR: number, outerR: number, sliceAngleDeg: number) => {
      const theta = (sliceAngleDeg * Math.PI) / 180;
      if (theta <= 0.001) return outerR * 0.58;
      const factor = (2 / 3) * (Math.sin(theta / 2) / (theta / 2));
      return outerR * Math.min(0.68, Math.max(0.48, factor));
    };

    const renderLabel = (props: any) => {
      const { cx, cy, midAngle, innerRadius, outerRadius, value, name, percent } = props;
      if (value <= 0) return null;
      const isPrimary = name === 'primary';

      if (isSolo) {
        return (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={clampedPct > 0 ? primaryTextColor : secondaryTextColor} fontSize="9" fontWeight="normal">
            {clampedPct > 0 ? '100.0%' : '0.0%'}
          </text>
        );
      }

      if (!isPrimary && value < 18) return null;

      const sliceAngleDeg = (percent || 0) * 360;
      const radius = calcCentroidRadius(innerRadius, outerRadius, sliceAngleDeg);
      const RADIAN = Math.PI / 180;
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);
      const labelText = `${formatPct(value)}%`;

      if (isPrimary && value < 14) {
        return (
          <g>
            <rect x={x - 16} y={y - 6} width="32" height="12" rx="4" fill={colorPrimary} opacity="0.95" />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize="7" fontWeight="normal">
              {labelText}
            </text>
          </g>
        );
      }

      return (
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={isPrimary ? primaryTextColor : secondaryTextColor} fontSize="9" fontWeight="normal">
          {labelText}
        </text>
      );
    };

    return (
      <div className="w-40 h-40 sm:w-48 sm:h-48 mx-auto select-none overflow-visible">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={0}
              outerRadius={64}
              stroke="#ffffff"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              labelLine={false}
              label={renderLabel}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <RechartsTooltip formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name === 'primary' ? 'Comprometimento' : 'Saldo Livre']} />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Dynamic key delivery dates from product policy or selected unit phase
  let deliveryText = '';
  if (hasUnitSelected && matchingRow) {
    const isPhase2 = String(fase).includes('2');
    if (isPhase2 && currentProd.deliveryDatePhase2) {
      deliveryText = formatDateMonthYear(currentProd.deliveryDatePhase2);
    } else if (!isPhase2 && currentProd.deliveryDatePhase1) {
      deliveryText = formatDateMonthYear(currentProd.deliveryDatePhase1);
    } else if (currentProd.deliveryDate) {
      deliveryText = formatDateMonthYear(currentProd.deliveryDate);
    } else {
      deliveryText = formatDeliveryText(
        currentProd.deliveryDatePhase1,
        currentProd.deliveryDatePhase2,
        currentProd.deliveryDate
      );
    }
  } else {
    deliveryText = formatDeliveryText(
      currentProd.deliveryDatePhase1,
      currentProd.deliveryDatePhase2,
      currentProd.deliveryDate
    );
  }

  // Check if sales table exists and is active
  const hasTable = Boolean(
    currentProd.tableInfo &&
    currentProd.tableInfo.active &&
    currentProd.tableInfo.rows &&
    currentProd.tableInfo.rows.length > 0
  );

  const [isSavingSimulation, setIsSavingSimulation] = useState<boolean>(false);

  const handleSaveSimulation = async () => {
    if (!currentProd) return;
    setIsSavingSimulation(true);
    try {
      const dadosCompletos: Record<string, any> = {
        empreendimento_id: currentProd.id,
        empreendimento_nome: currentProd.name,
        condicao_id: currentCond?.id || '',
        condicao_nome: currentCond?.name || '',
        torre: selectedTorre || 'Não Selecionada',
        unidade: selectedUnidade || 'Não Selecionada',
        simulation_data: simulationData,
        cliente_nome: simulationData.clientName || 'Cliente Não Informado',
        renda: baseRendaInformada,
        preco_tabela: price,
        avaliacao_bancaria: evaluation,
        itbi_total: valorTotalITBI,
        financiamento_maximo: displayMaxFinanc,
        subsidio: displaySubsidy,
        fgts: displayFgts,
        recurso_proprio: simulationData.ownResource || 0,
        ato_bruto: isParcelamentoMorar ? (pm.atoEfetivo + pm.descontoAtoPremiado) : atoBruto,
        desconto_ato_premiado: displayDescontoAto,
        ato_liquido: isParcelamentoMorar ? pm.atoEfetivo : atoEfetivo,
        itbi_no_ato: valAtoITBI,
        salvo_em: new Date().toISOString()
      };

      if (isParcelamentoMorar) {
        dadosCompletos.mensais_obra_qtd = pm.nMensaisObra;
        dadosCompletos.mensais_obra_valor = pm.valorMensalObra;
        dadosCompletos.semestrais_qtd = pm.nSemestrais;
        dadosCompletos.semestrais_valor = pm.nSemestrais > 0 ? Math.round((pm.totalSemestrais / pm.nSemestrais) * 100) / 100 : 0;
        dadosCompletos.parcela_chaves_valor = pm.valorChaves;
        dadosCompletos.parcela_chaves_vencimento = chavesVencimentoStr;
        dadosCompletos.pos_obra_qtd = pm.qtdParcelasPosObra;
        dadosCompletos.pos_obra_valor = pm.valorPosObraParcela;
        dadosCompletos.subtotal_ate_chaves = pm.subtotalAteChaves;
        dadosCompletos.pct_subtotal_ate_chaves = pm.pctSubtotalAteChaves;
      } else {
        dadosCompletos.mensais_qtd = qtdMensais;
        dadosCompletos.parcela_mensal = parcela;
        dadosCompletos.pro_soluto_total = proSolutoTotalPainel;
      }

      const res = await imoveisService.salvarSimulacao({
        cliente_nome: simulationData.clientName || 'Cliente Não Informado',
        renda: baseRendaInformada,
        empreendimento_id: currentProd.id,
        dados: dadosCompletos
      });

      if (res.success) {
        onShowToast(`Proposta de ${simulationData.clientName || 'simulação'} salva no Supabase com sucesso!`);
      } else {
        onShowToast(`Proposta registrada: ${res.error || 'Aviso de sincronização'}`);
      }
    } catch (e: any) {
      onShowToast(`Erro ao salvar simulação: ${e?.message || 'Falha na conexão'}`);
    } finally {
      setIsSavingSimulation(false);
    }
  };

  const isFieldDefined = (val: number | null | undefined): boolean => {
    return val !== null && val !== undefined && !isNaN(val) && val >= 0;
  };

  const isIncomeValid = isFieldDefined(simulationData.income);
  const isFinancingValid = isFieldDefined(simulationData.financing);
  const isSubsidyValid = isFieldDefined(simulationData.subsidy);
  const isFgtsValid = isFieldDefined(simulationData.fgts);

  const isSimulationComplete = isIncomeValid && isFinancingValid && isSubsidyValid && isFgtsValid;

  if (!isSimulationComplete) {
    return (
      <EmptySimulationNotice
        onNavigateToSimulator={onBackToSimulator}
        missingItems={{
          income: !isIncomeValid,
          financing: !isFinancingValid,
          subsidy: !isSubsidyValid,
          fgts: !isFgtsValid
        }}
      />
    );
  }

  return (
    <div className="w-full space-y-4 animate-fade-in">
      
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
                id="badge-data-entrega"
                className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Chaves ➔ {deliveryText}</span>
              </span>
            )}
          </div>
        </div>

        {/* BOTÕES DE AÇÃO: SALVAR SIMULAÇÃO & EXPORTAR PDF */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveSimulation}
            disabled={isSavingSimulation}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm shadow-emerald-500/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            title="Salvar proposta/simulação no banco Supabase"
          >
            {isSavingSimulation ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Simulação</span>
              </>
            )}
          </button>

          {/* Exportação em PDF ainda não contempla o layout de "Parcelamento Morar" */}
          {!isParcelamentoMorar && (
            <button
              type="button"
              onClick={() => setIsPdfModalOpen(true)}
              className="px-3.5 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              title="Exportar Ficha de Análise em PDF / Imprimir"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Exportar PDF</span>
            </button>
          )}
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
            title="Limpar Ficha de Análise"
          >
            <RotateCcw className="w-3 h-3 text-sky-600" />
            <span>Limpar</span>
          </button>
        </div>

        {/* LINHA 1: TORRE (col-span-2), UNIDADE (col-span-2), FASE (col-span-2), TIPOLOGIA (col-span-6) */}
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
              id="campo-fase"
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

        {/* LINHA 2: ÁREA PRIVATIVA (col-span-2), QUINTAL (col-span-2), PREÇO DE TABELA (col-span-4), AVALIAÇÃO BANCÁRIA (col-span-4) */}
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

      {/* CORPO DA PÁGINA: GRID DE 2 COLUNAS IDÊNTICO AO PDF */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        
        {/* ================= COLUNA DA ESQUERDA ================= */}
        <div className="space-y-4">
          
          {/* BLOCO 1: DADOS DA APROVAÇÃO DE CRÉDITO */}
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
                    <strong className="text-emerald-600 font-semibold">{formatCurrency(displaySubsidy)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">FGTS:</span>
                    <strong className="text-sky-600 font-semibold">{formatCurrency(displayFgts)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 mt-2">
                    <span className="text-slate-600">Desconto Ato:</span>
                    <strong className="text-emerald-600 font-semibold">{formatCurrency(displayDescontoAto)}</strong>
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
                    <strong className="text-sky-600 font-bold">{formatCurrency(displayMaxFinanc)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">Total Negoc:</span>
                    <strong className="text-slate-800 font-semibold">{formatCurrency(displayTotalNegoc)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">Sinal Total:</span>
                    <strong className="text-amber-600 font-bold">{formatCurrency(displaySinalTotal)}</strong>
                  </div>
                  {/* Esta condição não usa ITBI/registro — "Sinal + ITBI" não se aplica */}
                  {!isParcelamentoMorar && (
                    <div className="flex justify-between items-center py-1 mt-2">
                      <span className="text-slate-600">Sinal + ITBI:</span>
                      <strong className="text-emerald-600 font-bold">{formatCurrency(displaySinalTotal + saldoITBI)}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* BLOCO 4: INDICADORES DE RISCO / COMPROMETIMENTO (REPOSICIONADO NA COLUNA ESQUERDA) */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
            {/* Cabeçalho de Bases Compartilhadas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                  <PieChart className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  4. Indicadores de Risco / Comprometimento
                </h3>
              </div>
              <div className="flex items-center flex-wrap gap-2 text-[10px]">
                <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                  <span className="text-slate-400 font-medium">{isParcelamentoMorar ? 'Base Líquida:' : 'Base Líq. c/ ITBI:'}</span>
                  <strong className="font-bold text-slate-800">{formatCurrency(displayBaseLiquida)}</strong>
                </div>
                <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                  <span className="text-slate-400 font-medium">Base Renda:</span>
                  <strong className="font-bold text-slate-800">{formatCurrency(baseRendaInformada)}</strong>
                </div>
              </div>
            </div>

            {/* GRÁFICOS DE PIZZA LADO A LADO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* SUB-CARD 1: RISCO PARCELA / COMPROMETIMENTO */}
              <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80 flex flex-col justify-between space-y-1">
                <div className="border-b border-slate-200/60 pb-1 text-center">
                  <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-tight flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0" />
                    Risco Parcela / Renda
                  </h4>
                  <p className="text-[9.5px] text-slate-500 mt-0.5">
                    {isParcelamentoMorar ? 'Mensal de Obra sobre a Renda' : '1ª Parcela sobre a Base da Renda'}
                  </p>
                </div>

                <div className="py-1 flex items-center justify-center overflow-visible">
                  {renderSolidPie(displayPctRiscoParcelaRenda, '#0284c7', '#cbd5e1')}
                </div>

                <div className="w-full pt-1.5 border-t border-slate-200/70 text-center space-y-0.5">
                  <div className="flex items-center justify-between px-1 text-[10px]">
                    <span className="text-slate-500 font-medium">Comprometimento:</span>
                    <strong className="text-sky-700 font-bold">
                      {displayPctRiscoParcelaRenda < 10 ? displayPctRiscoParcelaRenda.toFixed(2) : displayPctRiscoParcelaRenda.toFixed(1)}%
                    </strong>
                  </div>
                  <div className="flex items-center justify-between px-1 text-[10px]">
                    <span className="text-slate-500 font-medium">{isParcelamentoMorar ? 'Mensal de Obra:' : '1ª Parcela:'}</span>
                    <strong className="text-slate-800 font-semibold">
                      {formatCurrency(displayValorRiscoParcela)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* SUB-CARD 2: RISCO PRÓ-SOLUTO TOTAL */}
              <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80 flex flex-col justify-between space-y-1">
                <div className="border-b border-slate-200/60 pb-1 text-center">
                  <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-tight flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-violet-600 shrink-0" />
                    {isParcelamentoMorar ? 'Subtotal Até as Chaves' : 'Risco Pró-Soluto Total'}
                  </h4>
                  <p className="text-[9.5px] text-slate-500 mt-0.5">
                    {isParcelamentoMorar ? 'Sinal + Mensais + Semestrais + Chaves s/ Valor do Imóvel' : 'Pró-Soluto Total c/ ITBI s/ Base Líquida'}
                  </p>
                </div>

                <div className="py-1 flex items-center justify-center overflow-visible">
                  {renderSolidPie(displayPctRiscoProSoluto, '#7c3aed', '#cbd5e1')}
                </div>

                <div className="w-full pt-1.5 border-t border-slate-200/70 text-center space-y-0.5">
                  <div className="flex items-center justify-between px-1 text-[10px]">
                    <span className="text-slate-500 font-medium">Comprometimento:</span>
                    <strong className="text-violet-700 font-bold">
                      {displayPctRiscoProSoluto < 10 ? displayPctRiscoProSoluto.toFixed(2) : displayPctRiscoProSoluto.toFixed(1)}%
                    </strong>
                  </div>
                  <div className="flex items-center justify-between px-1 text-[10px]">
                    <span className="text-slate-500 font-medium">{isParcelamentoMorar ? 'Subtotal Até Chaves:' : 'Pró-Soluto Total:'}</span>
                    <strong className="text-slate-800 font-semibold">
                      {formatCurrency(displayValorRiscoProSoluto)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ================= COLUNA DA DIREITA ================= */}
        <div className="space-y-4">
          
          {/* BLOCO 2: FLUXO DE ENTRADA C/ CONSTRUTORA (COMPONENTE PADRONIZADO) */}
          <FluxoEntradaConstrutora
            title="2. FLUXO DE ENTRADA C/ CONSTRUTORA"
            onLimpar={limparFluxoPagamento}
            valorAto={isParcelamentoMorar ? pm.atoEfetivo : atoAposMensais}
            valorAtoMinimo={isParcelamentoMorar ? pm.sinalMinimoCalculado : atoMinimoCalculado}
            valorAtoMaximo={isParcelamentoMorar ? pm.atoMaximoPossivel : (price > 0 ? Math.max(0, price - subsidy - atoPremiadoAtual) : 0)}
            onAtoChange={(novoVal) => {
              setValAtoManual(novoVal);
            }}
            onShowToast={onShowToast}
            hideITBI={isParcelamentoMorar}
            valAtoITBI={valAtoITBI}
            valorTotalITBI={despCartorias}
            isFirstHome={isFirstHomeLocal}
            onToggleFirstHome={() => setIsFirstHomeLocal(prev => !prev)}
            onITBIChange={(novoVal) => setValAtoITBI(novoVal)}
            descontoAto={isParcelamentoMorar ? pm.descontoAtoPremiado : descontoAto}
            isAtoPremiadoActive={isAtoPremiadoEnabled}
            onToggleAtoPremiado={(ativo) => {
              setIsAtoPremiadoEnabled(ativo);
            }}
            isAVistaActive={isParcelamentoMorar ? pmIsAVistaActive : isAVistaActive}
            onToggleAVista={(ativo) => {
              // Mesmo mecanismo de um Ato (Imóvel) digitado manualmente — só que o valor
              // é calculado automaticamente para o ponto exato que zera o saldo a
              // parcelar, ou desfeito para voltar ao fluxo parcelado normal.
              setValAtoManual(ativo ? (isParcelamentoMorar ? pmAtoAVistaTarget : atoAVistaTarget) : null);
            }}
          >
            {/* 2ª LINHA: 2 COLUNAS IGUAIS (1ª MENSAL 30 DIAS E 2ª MENSAL 60 DIAS) — MESMO LAYOUT EM TODAS AS CONDIÇÕES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* 1ª MENSAL (30 DIAS) */}
              <div className={`p-2.5 rounded-lg border transition-all ${
                isExceededParc2 ? 'bg-red-50/90 border-red-500' : 'bg-slate-50 border-slate-200/80'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <label className={`block text-[10px] font-bold uppercase whitespace-nowrap ${
                    isExceededParc2 ? 'text-red-900' : 'text-slate-500'
                  }`}>
                    1ª Mensal (30 Dias)
                  </label>
                </div>
                <input
                  id="input-primeira-mensal-30d"
                  type="text"
                  value={isEditingParc2 ? parc2InputText : (valParc2 > 0 ? formatCurrency(valParc2) : '')}
                  onFocus={(e) => {
                    setIsEditingParc2(true);
                    setParc2InputText(valParc2 > 0 ? String(valParc2) : '');
                    e.target.select();
                  }}
                  onChange={(e) => {
                    setParc2InputText(e.target.value);
                    const parsed = parseFlexibleCurrency(e.target.value);
                    if (parsed >= 0) {
                      setValParc2(parsed);
                    }
                  }}
                  onBlur={(e) => {
                    handleFinishParc2Edit(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleFinishParc2Edit(parc2InputText);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="R$ 0,00"
                  className={`w-full px-2 py-1 rounded-md font-bold text-center text-xs transition-all focus:outline-none whitespace-nowrap ${
                    isExceededParc2
                      ? 'bg-red-100 border-2 border-red-500 text-red-900 focus:border-red-600'
                      : 'bg-white border border-slate-200 text-slate-800 focus:border-sky-600'
                  }`}
                />
                {isExceededParc2 && (
                  <div className="mt-1.5 flex items-center gap-1 text-[9.5px] font-bold text-rose-700 bg-rose-50 p-1 rounded border border-rose-400">
                    <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                    <span>Atenção: parcela excede 35% da renda (máx: {formatCurrency(income * 0.35)})!</span>
                  </div>
                )}
              </div>

              {/* 2ª MENSAL (60 DIAS) */}
              <div className={`p-2.5 rounded-lg border transition-all ${
                isExceededParc3 ? 'bg-red-50/90 border-red-500' : 'bg-slate-50 border-slate-200/80'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <label className={`block text-[10px] font-bold uppercase whitespace-nowrap ${
                    isExceededParc3 ? 'text-red-900' : 'text-slate-500'
                  }`}>
                    2ª Mensal (60 Dias)
                  </label>
                </div>
                <input
                  id="input-segunda-mensal-60d"
                  type="text"
                  value={isEditingParc3 ? parc3InputText : (valParc3 > 0 ? formatCurrency(valParc3) : '')}
                  onFocus={(e) => {
                    setIsEditingParc3(true);
                    setParc3InputText(valParc3 > 0 ? String(valParc3) : '');
                    e.target.select();
                  }}
                  onChange={(e) => {
                    setParc3InputText(e.target.value);
                    const parsed = parseFlexibleCurrency(e.target.value);
                    if (parsed >= 0) {
                      setValParc3(parsed);
                    }
                  }}
                  onBlur={(e) => {
                    handleFinishParc3Edit(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleFinishParc3Edit(parc3InputText);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="R$ 0,00"
                  className={`w-full px-2 py-1 rounded-md font-bold text-center text-xs transition-all focus:outline-none whitespace-nowrap ${
                    isExceededParc3
                      ? 'bg-red-100 border-2 border-red-500 text-red-900 focus:border-red-600'
                      : 'bg-white border border-slate-200 text-slate-800 focus:border-sky-600'
                  }`}
                />
                {isExceededParc3 && (
                  <div className="mt-1.5 flex items-center gap-1 text-[9.5px] font-bold text-rose-700 bg-rose-50 p-1 rounded border border-rose-400">
                    <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                    <span>Atenção: parcela excede 35% da renda (máx: {formatCurrency(income * 0.35)})!</span>
                  </div>
                )}
              </div>
            </div>

          </FluxoEntradaConstrutora>

          {/* BLOCO 3: PARCELAMENTO PRÓ-SOLUTO / BANCO DIRETO — OU PARCELAMENTO MORAR */}
          {isParcelamentoMorar ? (
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                    <Coins className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    3. Parcelamento Morar
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  {pm.nMensaisObra} meses de obra
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* MENSAL DE OBRA: PRIMEIRO QUADRO DO PARCELAMENTO MORAR */}
                <div className={`p-2.5 rounded-lg border ${pm.excedeRiscoRenda || pm.abaixoParcelaMinimaMensalObra ? 'bg-rose-50/60 border-rose-300' : 'bg-slate-50 border-slate-200/80'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Mensal de Obra</span>
                    {pmMensalObraDataInicio && (
                      <span className="text-[9.5px] text-slate-400 font-semibold">A partir de {pmMensalObraDataInicio}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <PmCampoEditavel
                      label="Qtd. Meses"
                      tipo="inteiro"
                      suffix="X"
                      maximo={pmMesesObraAuto}
                      value={pmMesesObraQtd}
                      onCommit={setPmMesesObraManual}
                      onShowToast={onShowToast}
                    />
                    <PmCampoEditavel
                      label="Valor da Parcela"
                      tipo="moeda"
                      minimo={currentCond?.pmParcelaMinimaMensalObra ?? 200}
                      value={pm.valorMensalObra}
                      onCommit={setPmMensalObraValorManual}
                      onShowToast={onShowToast}
                    />
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 whitespace-nowrap">Valor Total</label>
                      <div className="w-full bg-white px-2 py-1.5 rounded-md border border-slate-200 font-bold text-slate-900 text-center text-xs">
                        {formatCurrency(pm.valorMensalObraTotal)}
                      </div>
                    </div>
                  </div>
                  {pm.excedeRiscoRenda && (
                    <div className="mt-1.5 flex items-center gap-1 text-[9.5px] font-bold text-rose-700 bg-rose-100/70 p-1 rounded border border-rose-300">
                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                      <span>Compromete mais de {currentCond?.riscoRendaPct ?? 40}% da renda bruta informada.</span>
                    </div>
                  )}
                  {pm.abaixoParcelaMinimaMensalObra && !pm.excedeRiscoRenda && (
                    <div className="mt-1.5 flex items-center gap-1 text-[9.5px] font-bold text-rose-700 bg-rose-100/70 p-1 rounded border border-rose-300">
                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                      <span>Abaixo da parcela mínima configurada na política.</span>
                    </div>
                  )}
                  {pmObraReduzida && (
                    <div className="mt-1.5 flex items-center gap-1 text-[9.5px] font-bold text-sky-700 bg-sky-50 p-1 rounded border border-sky-200">
                      <AlertTriangle className="w-3 h-3 text-sky-600 shrink-0" />
                      <span>Prazo reduzido do sugerido ({pmMesesObraAuto} meses) — Pós-Obra zerado automaticamente.</span>
                    </div>
                  )}
                </div>

                {/* INTERMEDIÁRIAS SEMESTRAIS: CADA UMA LIGADA/DESLIGADA INDIVIDUALMENTE */}
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Intermediárias Semestrais (Jun/Dez)</span>
                  {pmSemestraisDatasAuto.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {pmSemestraisQtdEfetiva}/{pmSemestraisDatasAuto.length}X
                    </span>
                  )}
                </div>

                {pmSemestraisDatas.map((dataStr, idx) => {
                  const semestralAtiva = pmSemestralIndividualEnabled[idx] !== false;
                  const semestralRank = pmSemestraisEnabledIdxs.indexOf(idx);
                  const semestralValorAtual = semestralRank >= 0 ? (pm.valoresSemestrais[semestralRank] ?? 0) : 0;
                  return (
                    <div key={idx} className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 ${semestralAtiva ? 'bg-slate-50 border-slate-200/80' : 'bg-slate-50/60 border-slate-200/60 opacity-60'}`}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={semestralAtiva}
                          onChange={(e) => setPmSemestralIndividualEnabled(prev => ({ ...prev, [idx]: e.target.checked }))}
                          className="rounded text-sky-600 focus:ring-sky-600 cursor-pointer"
                        />
                        <div>
                          <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Semestral {idx + 1}</span>
                          <input
                            type="month"
                            disabled={!semestralAtiva}
                            value={dataStr.slice(0, 7)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPmSemestralDatasManual(prev => ({ ...prev, [idx]: val }));
                            }}
                            className="bg-white px-2 py-1 rounded-md border border-slate-200 font-semibold text-slate-700 text-xs focus:outline-none focus:border-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </div>
                      </label>
                      {semestralAtiva && (
                        <div className="w-32">
                          <PmCampoEditavel
                            label="Valor"
                            tipo="moeda"
                            minimo={currentCond?.pmParcelaMinimaSemestral ?? 200}
                            value={semestralValorAtual}
                            onCommit={(novoValor) => {
                              setPmSemestralValorManual(prev => {
                                const next = { ...prev };
                                if (novoValor === null) {
                                  delete next[idx];
                                } else {
                                  next[idx] = novoValor;
                                }
                                return next;
                              });
                            }}
                            onShowToast={onShowToast}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* PARCELA FINAL (CHAVES) — LIGAR/DESLIGAR; O VENCIMENTO VEM DA POLÍTICA, NÃO É EDITÁVEL AQUI */}
                <div className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 ${pmChavesEnabled ? 'bg-amber-50 border-amber-200/80' : 'bg-slate-50 border-slate-200/80'}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pmChavesEnabled}
                      onChange={(e) => setPmChavesEnabled(e.target.checked)}
                      className="rounded text-sky-600 focus:ring-sky-600 cursor-pointer"
                    />
                    <div>
                      <span className={`block text-[10px] font-bold uppercase ${pmChavesEnabled ? 'text-amber-700' : 'text-slate-500'}`}>Parcela Chaves</span>
                      {pmChavesEnabled && chavesVencimentoStr && (
                        <span className="block text-[9.5px] text-amber-600 font-semibold mt-0.5">{chavesVencimentoStr}</span>
                      )}
                    </div>
                  </label>
                  {pmChavesEnabled && (
                    <div className="w-32">
                      <PmCampoEditavel
                        label="Valor"
                        tipo="moeda"
                        colorClass="text-amber-800"
                        value={pm.valorChaves}
                        onCommit={setPmChavesValorManual}
                        onShowToast={onShowToast}
                      />
                    </div>
                  )}
                </div>

                {/* PARCELAMENTO PÓS-OBRA — ZERADO AUTOMATICAMENTE SE O PRAZO DE OBRA FOI REDUZIDO */}
                <div className={`p-2.5 rounded-lg border ${pmObraReduzida ? 'bg-slate-50/60 border-slate-200/60 opacity-60' : 'bg-slate-50 border-slate-200/80'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Pós-Obra</span>
                    {!pmObraReduzida && pmPosObraDataInicio && (
                      <span className="text-[9.5px] text-slate-400 font-semibold">A partir de {pmPosObraDataInicio}</span>
                    )}
                  </div>
                  {pmObraReduzida ? (
                    <div className="text-[10px] text-slate-500 font-semibold text-center py-2">
                      Não utilizado — prazo de obra reduzido do sugerido.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                      <PmCampoEditavel
                        label="Qtd. Meses"
                        tipo="inteiro"
                        suffix="X"
                        value={pmPosObraQtd}
                        onCommit={setPmQtdPosObraManual}
                        onShowToast={onShowToast}
                      />
                      <PmCampoEditavel
                        label="Valor da Parcela"
                        tipo="moeda"
                        minimo={currentCond?.pmParcelaMinimaPosObra ?? 200}
                        value={pm.valorPosObraParcela}
                        onCommit={setPmPosObraValorManual}
                        onShowToast={onShowToast}
                      />
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 whitespace-nowrap">Valor Total</label>
                        <div className="w-full bg-white px-2 py-1.5 rounded-md border border-slate-200 font-bold text-slate-900 text-center text-xs">
                          {formatCurrency(pm.valorPosObraTotal)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 text-xs pt-0.5">
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 px-1">
                  <span className="text-slate-500 font-medium">Total Fase Obra (mensais + semestrais):</span>
                  <strong className="text-slate-900 font-bold">{formatCurrency(pm.valorMensalObraTotal + pm.totalSemestrais)}</strong>
                </div>

                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 px-1">
                  <span className="text-slate-500 font-medium">Total Pós-Obra:</span>
                  <strong className="text-slate-900 font-bold">{formatCurrency(pm.valorPosObraTotal)}</strong>
                </div>

                {/* TARJA SUBTOTAL ATÉ AS CHAVES */}
                <div className="flex justify-between items-center bg-sky-50 px-3 py-2 rounded-lg border border-sky-200 mt-1">
                  <span className="text-xs font-semibold text-slate-700">
                    Subtotal até as Chaves: <span className="text-[10.5px] font-normal text-slate-500">({pm.pctSubtotalAteChaves.toFixed(1)}% do imóvel)</span>
                  </span>
                  <strong className="text-sm sm:text-base font-bold text-sky-700">{formatCurrency(pm.subtotalAteChaves)}</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                    <Coins className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    3. Parcelamento Pró-Soluto / Banco Direto
                  </h3>
                </div>
              </div>

              {/* FAIXA DE AMORTIZAÇÃO E JUROS */}
              <div className="flex justify-between items-center text-[10px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80">
                <span>Amortização: <strong className="text-slate-700 font-semibold">Tabela Price</strong></span>
                <span>Juros: <strong className="text-sky-700 font-bold">{appliedRatePct.toFixed(2)}% a.m.</strong></span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-center">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Qtd. Mensais
                  </label>
                  <div className="relative flex items-center justify-center">
                    <input
                      type="number"
                      value={qtdMensais > 0 ? qtdMensais : ''}
                      min="1"
                      max={limiteMaximoParcelas}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        if (rawVal === '') {
                          setQtdMensais(0);
                          setValAtoManual(null);
                          setAtoInputText('');
                          setIsEditingAto(false);
                          return;
                        }
                        const val = parseInt(rawVal, 10);
                        if (isNaN(val)) return;

                        setValAtoManual(null);
                        setAtoInputText('');
                        setIsEditingAto(false);
                        if (val > limiteMaximoParcelas) {
                          setQtdMensais(limiteMaximoParcelas);
                          alert(`O limite máximo para este produto é ${limiteMaximoParcelas}x`);
                          return;
                        }
                        if (val < 1) {
                          setQtdMensais(1);
                          return;
                        }
                        setQtdMensais(val);
                      }}
                      onBlur={() => {
                        setValAtoManual(null);
                        setAtoInputText('');
                        setIsEditingAto(false);
                        if (!qtdMensais || qtdMensais < 1) {
                          setQtdMensais(1);
                        } else if (qtdMensais > limiteMaximoParcelas) {
                          setQtdMensais(limiteMaximoParcelas);
                          alert(`O limite máximo para este produto é ${limiteMaximoParcelas}x`);
                        }
                      }}
                      className="w-full bg-white px-2 py-1 rounded-md border border-slate-200 font-bold text-sky-600 text-center focus:outline-none focus:border-sky-600 text-xs"
                    />
                    <span className="absolute right-2 text-xs font-extrabold text-slate-400 pointer-events-none">X</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-center">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">1ª Parcela</span>
                  <strong className="text-slate-900 font-bold text-xs sm:text-sm block mt-1">
                    {formatCurrency(parcela)}
                  </strong>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-center">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Última Parcela</span>
                  <strong className="text-slate-900 font-bold text-xs sm:text-sm block mt-1">
                    {formatCurrency(parcela)}
                  </strong>
                </div>
              </div>

              <div className="space-y-1.5 text-xs pt-0.5">
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 px-1">
                  <span className="text-slate-500 font-medium">
                    Despesas Cartorárias & ITBI<span className="ml-1 text-[11px] text-slate-400 font-normal">(Total: {formatCurrency(valorTotalITBI)}):</span>
                  </span>
                  <strong className="text-slate-800 font-semibold">{formatCurrency(saldoITBI)}</strong>
                </div>

                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 px-1">
                  <span className="text-slate-500 font-medium">Pró-Soluto (Sinal Restante):</span>
                  <strong className="text-slate-900 font-bold">{formatCurrency(proSoluto)}</strong>
                </div>

                {/* TARJA PRÓ-SOLUTO TOTAL C/ ITBI */}
                <div className="flex justify-between items-center bg-sky-50 px-3 py-2 rounded-lg border border-sky-200 mt-1">
                  <span className="text-xs font-semibold text-slate-700">Pró-Soluto Total c/ ITBI:</span>
                  <strong className="text-sm sm:text-base font-bold text-sky-700">{formatCurrency(proSolutoTotalPainel)}</strong>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* RODAPÉ: AVISO LEGAL FULL-WIDTH (ABAIXO DO GRID DE 2 COLUNAS) */}
      <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed text-justify shadow-sm">
        <strong>Informações importantes:</strong> Estas informações referem-se apenas a uma simulação comercial e análise preliminar de crédito. As condições finais da operação e a efetivação dos resultados dependem de análise e aprovação formal junto ao agente financeiro e à construtora.
      </div>

      {/* MODAL DE EXPORTAÇÃO PDF */}
      {currentProd && currentCond && (
        <PdfExportModal
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
          subsidyEfetivo={subsidyEfetivo}
          fgtsEfetivo={fgtsEfetivo}
          descontoAto={descontoAto}
          maxFinanc={maxFinancEfetivo}
          totalNegocEfetivo={totalNegocEfetivo}
          sinalTotal={sinalTotal}
          despCartoriasEfetivas={despCartoriasEfetivas}
          atoAposMensais={atoAposMensais}
          atoITBIValidado={atoITBIValidado}
          valParc2={valParc2}
          valParc3={valParc3}
          qtdMensais={qtdMensais}
          appliedRatePct={appliedRatePct}
          parcela={parcela}
          valorTotalITBI={valorTotalITBI}
          saldoITBI={saldoITBI}
          proSoluto={proSoluto}
          proSolutoTotalPainel={proSolutoTotalPainel}
          baseVendaLiquidaComITBI={baseVendaLiquidaComITBI}
          baseRendaInformada={baseRendaInformada}
          pctRiscoParcelaRenda={pctRiscoParcelaRenda}
          valorRiscoParcela={valorRiscoParcela}
          pctRiscoProSoluto={pctRiscoProSoluto}
          valorRiscoProSoluto={valorRiscoProSoluto}
        />
      )}

    </div>
  );
};

