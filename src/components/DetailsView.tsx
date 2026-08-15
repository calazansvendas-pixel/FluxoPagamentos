import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, RotateCcw, KeyRound, FileCheck2, Calculator, ShieldCheck, Building, Coins, AlertTriangle, FileSpreadsheet, PieChart, TrendingUp } from 'lucide-react';
import { CommercialCondition, Product, SelectedUnit, SimulationData } from '../types';
import { formatCurrency, formatM2, parseCurrency, formatDateMonthYear, formatDeliveryText } from '../utils/formatters';
import { calculatePolicyRiskValues, ensureProductConditions, calculatePricePMT, calcularParcelaPrice } from '../utils/calculations';

interface DetailsViewProps {
  product: Product | null;
  condition: CommercialCondition | null;
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
  simulationData,
  selectedUnits,
  onUnitSelectChange,
  onBackToSimulator,
  onNavigateToImport,
  onShowToast
}) => {
  const currentProd = product || null;
  const currentCond = useMemo(() => {
    if (!currentProd) return null;
    const prodWithConds = ensureProductConditions({ ...currentProd });
    if (condition) {
      const match = prodWithConds.conditions.find(c => c.id === condition.id);
      if (match) return match;
    }
    return condition || prodWithConds.conditions[0];
  }, [currentProd, condition]);

  // LÓGICA DE DEFINIÇÃO DO PRAZO PADRÃO (HERDADO DINAMICAMENTE DA POLÍTICA DE CRÉDITO)
  const condNumParcelas = Number(currentCond?.numParcelas) || Number(currentProd?.numParcelas) || 60;

  // Carrega os valores de Prazo Faixa 1 e Prazo Faixa 2 do produto/condição selecionado
  const prazoFaixa1 = Number(currentCond?.mesesTabela1) || 0;
  const prazoFaixa2 = Number(currentCond?.mesesTabela2) || 0;
  const limiteMaximoParcelas = Math.max(prazoFaixa1, prazoFaixa2, condNumParcelas, 1);

  const [selectedTorre, setSelectedTorre] = useState<string>('');
  const [selectedUnidade, setSelectedUnidade] = useState<string>('');

  const [valAtoManual, setValAtoManual] = useState<number | null>(null);
  const [atoInputText, setAtoInputText] = useState<string>('');
  const [isEditingAto, setIsEditingAto] = useState<boolean>(false);
  const [valAtoITBI, setValAtoITBI] = useState<number>(0);
  const [isAtoPremiadoEnabled, setIsAtoPremiadoEnabled] = useState<boolean>(true);
  const [valParc2, setValParc2] = useState<number>(0);
  const [valParc3, setValParc3] = useState<number>(0);

  const [qtdMensais, setQtdMensais] = useState<number>(condNumParcelas);

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
        setValParc3(0);
      }
    }
  }, [currentProd?.id, selectedUnits]);

  // 2. FUNÇÃO E EFFECT DISPARADOS AO TROCAR DE EMPREENDIMENTO OU ATUALIZAR A POLÍTICA DE CRÉDITO:
  // Garante a limpeza do estado residual na memória e a sincronização dinâmica da Qtd. Mensais para o valor configurado na condição comercial.
  useEffect(() => {
    if (currentProd && currentCond) {
      setValAtoManual(null);
      setAtoInputText('');
      setIsEditingAto(false);
      setValAtoITBI(0);
      setValParc2(0);
      setValParc3(0);
      setQtdMensais(condNumParcelas);
      setIsAtoPremiadoEnabled(true);
    }
  }, [currentProd?.id, currentCond?.id, currentCond?.numParcelas, condNumParcelas]);

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

  // Get table rows for current product
  const tableRows = currentProd.tableInfo?.rows || [];
  const uniqueTorres = Array.from(new Set(tableRows.map(r => String(r[1] || '').trim()).filter(t => t !== '')));

  // Filter units by selected torre
  const filteredUnits = selectedTorre 
    ? Array.from(new Set(
        tableRows
          .filter(r => String(r[1] || '').trim().toLowerCase() === selectedTorre.toLowerCase())
          .map(r => String(r[2] || '').trim())
          .filter(u => u !== '')
      ))
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
  const areaPriv = matchingRow ? formatM2(matchingRow[3]) : '0,00 m²';
  const areaQuintal = matchingRow ? formatM2(matchingRow[4]) : '0,00 m²';

  const price = hasUnitSelected && matchingRow ? parseCurrency(matchingRow[7]) : 0;
  const evaluation = hasUnitSelected && matchingRow ? parseCurrency(matchingRow[6]) : 0;

  // ITBI depends on whether it's 1º Imóvel or 2º Imóvel
  const itbiVal = (hasUnitSelected && matchingRow) 
    ? (simulationData.isFirstHome ? parseCurrency(matchingRow[8]) : parseCurrency(matchingRow[9]))
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

  // Função isolada de limpeza exclusiva da Ficha de Análise
  const handleResetFicha = () => {
    setSelectedTorre('');
    setSelectedUnidade('');
    setValAtoManual(null);
    setAtoInputText('');
    setIsEditingAto(false);
    setValAtoITBI(0);
    setIsAtoPremiadoEnabled(true);
    setValParc2(0);
    setValParc3(0);
    if (currentCond) {
      setQtdMensais(condNumParcelas);
    }
    if (currentProd) {
      onUnitSelectChange(currentProd.id, { torre: '', unidade: '' });
    }
    onShowToast('Ficha de Análise limpa com sucesso. Os dados da simulação foram mantidos.');
  };

  // FINANCIAL CALCULATIONS
  const income = simulationData.income;
  const rawSubsidy = hasUnitSelected ? simulationData.subsidy : 0;
  const rawFGTS = hasUnitSelected ? simulationData.fgts : 0;
  const inputFinancing = simulationData.financing;

  const percent = simulationData.finPercent;
  const maxAllowed = (hasUnitSelected && evaluation > 0) ? (evaluation * percent) : 0;

  // Sinal Mínimo configurado na Política de Crédito da condição selecionada
  const sinalMinimoPolicy = currentCond?.sinalMinimo ? parseCurrency(currentCond.sinalMinimo) : 2000;
  const sinalMinimoVal = sinalMinimoPolicy > 0 ? sinalMinimoPolicy : 2000;

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

  const atoImovelDigitado = (valAtoManual !== null && valAtoManual >= atoMinimoCalculado)
    ? valAtoManual
    : atoMinimoCalculado;

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

  // CASCATA OBRIGATÓRIA DE AMORTIZAÇÃO DO SALDO EXCEDENTE:
  // Saldo Excedente = (Valor Digitado no Ato - Valor Sugerido Inicial) + sobras de mensais
  const excedenteAto = Math.max(0, atoImovelDigitado - atoMinimoCalculado);
  let saldoExcedente = excedenteAto + saldoParaAbater;

  // Base do Pró-Soluto do Imóvel (apenas a parcela da construtora, excluindo ITBI)
  const proSolutoImovelBase = hasUnitSelected 
    ? Math.max(0, riscoMaximoApuradoBruto - despCartorias) 
    : 0;

  // a) 1º Nível - Abater o Pró-Soluto do Imóvel
  let proSolutoImovelAbatido = 0;
  let novoProSolutoImovel = proSolutoImovelBase;
  if (saldoExcedente > 0) {
    proSolutoImovelAbatido = Math.min(proSolutoImovelBase, saldoExcedente);
    novoProSolutoImovel = proSolutoImovelBase - proSolutoImovelAbatido;
    saldoExcedente -= proSolutoImovelAbatido;
  }

  // b) 2º Nível - Abater o Financiamento Bancário
  let maxFinancEfetivo = maxFinanc;
  let bancoAbatido = 0;
  if (saldoExcedente > 0) {
    bancoAbatido = Math.min(maxFinancEfetivo, saldoExcedente);
    maxFinancEfetivo -= bancoAbatido;
    saldoExcedente -= bancoAbatido;
  }

  // c) 3º Nível - Abater o FGTS e Subsídio
  let fgtsEfetivo = fgts;
  let fgtsAbatido = 0;
  if (saldoExcedente > 0) {
    fgtsAbatido = Math.min(fgtsEfetivo, saldoExcedente);
    fgtsEfetivo -= fgtsAbatido;
    saldoExcedente -= fgtsAbatido;
  }

  let subsidyEfetivo = subsidy;
  let subsidyAbatido = 0;
  if (saldoExcedente > 0) {
    subsidyAbatido = Math.min(subsidyEfetivo, saldoExcedente);
    subsidyEfetivo -= subsidyAbatido;
    saldoExcedente -= subsidyAbatido;
  }

  // 3. REGRA ISOLADA PARA DESPESAS CARTORÁRIAS & ITBI:
  // O saldo de ITBI e Despesas Cartorárias NUNCA deve ser amortizado pelo excedente do Pagamento do Ato.
  // O ITBI/Despesas só é reduzido/abatido se o usuário preencher expressamente o campo "PAGAMENTO ITBI NO ATO".
  const valorTotalITBI = despCartorias;
  const atoITBIValidado = Math.min(valAtoITBI, valorTotalITBI);
  const saldoITBI = Math.max(0, valorTotalITBI - atoITBIValidado);
  const despCartoriasEfetivas = saldoITBI;

  const totalNegocEfetivo = hasUnitSelected ? (maxFinancEfetivo + subsidyEfetivo + fgtsEfetivo) : 0;
  const sinalTotal = Math.max(0, price - totalNegocEfetivo);
  const descontoAto = isAtoPremiadoEnabled ? novoAtoPremiado : 0;

  // 1. REGRA DE DEDUÇÃO NO PRÓ-SOLUTO (SINAL RESTANTE):
  // Pró-Soluto (Sinal Restante) = Sinal Total - Pagamento Ato (Imóvel) - Pagamento ITBI no Ato - 1ª Mensal - 2ª Mensal - Ato Premiado (Desconto Ato)
  const proSolutoSinalRestante = hasUnitSelected
    ? Math.max(0, sinalTotal - atoAposMensais - atoITBIValidado - mens30d - mens60d - descontoAto)
    : 0;
  const proSoluto = proSolutoSinalRestante;

  // Pró-Soluto Total c/ ITBI (Risco Máx) = Pró-Soluto (Sinal Restante) + Despesas Cartorárias & ITBI
  const proSolutoTotalParcelado = hasUnitSelected
    ? Math.max(0, proSolutoSinalRestante + despCartorias)
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

  // Função para resetar exclusivamente o Fluxo de Pagamento (Quadros 2 e 3)
  const limparFluxoPagamento = () => {
    setValAtoManual(null);
    setAtoInputText('');
    setIsEditingAto(false);
    setValAtoITBI(0);
    setValParc2(0);
    setValParc3(0);
    setQtdMensais(condNumParcelas);
    setIsAtoPremiadoEnabled(true);
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
  // Identifique o Maior Valor entre o Preço e a Avaliação:
  // ValorBaseImovel = Math.max(PrecoTabela, AvaliacaoBanco)
  // Base Líquida c/ ITBI = (ValorBaseImovel + Despesas Cartorárias & ITBI) - Ato Premiado (se aplicado) - Outros Descontos aplicados
  const valorBaseImovel = hasUnitSelected ? Math.max(price, evaluation) : 0;
  const baseVendaLiquidaComITBI = hasUnitSelected
    ? Math.max(0, (valorBaseImovel + valorTotalITBI) - descontoAto)
    : 0;

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

  // Função auxiliar para renderizar Gráficos de Pizza Sólidos com percentuais internos refinados
  const renderSolidPie = (
    pct: number,
    colorPrimary: string,
    colorSecondary: string = '#cbd5e1',
    primaryTextColor: string = '#ffffff',
    secondaryTextColor: string = '#334155'
  ) => {
    const cx = 50;
    const cy = 50;
    const r = 45; // Aumentado em ~15% (de 40 para 45 no viewBox de 100x100)
    const clampedPct = Math.min(100, Math.max(0, pct));
    const restPct = Math.max(0, 100 - clampedPct);

    // Centroide de um setor circular de raio r com ângulo theta (em radianos) a partir do centro:
    // distância do centro ao centroide = (2/3) * r * (sin(theta/2) / (theta/2))
    // Para setores típicos, isso varia entre 0.55r e 0.67r, garantindo que o texto nunca encoste nas bordas.
    const calcCentroidRadius = (sliceAngleDeg: number) => {
      const theta = (sliceAngleDeg * Math.PI) / 180;
      if (theta <= 0.001) return r * 0.6;
      const factor = (2 / 3) * (Math.sin(theta / 2) / (theta / 2));
      // Clamp para garantir posição ideal e segura de respiro
      return r * Math.min(0.68, Math.max(0.48, factor));
    };

    if (clampedPct >= 100) {
      return (
        <svg className="w-44 h-44 mx-auto drop-shadow-xs select-none" viewBox="0 0 100 100">
          <circle cx={cx} cy={cy} r={r} fill={colorPrimary} />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fill={primaryTextColor}
            fontSize="8"
            fontWeight="500"
            className="tracking-tight"
          >
            100%
          </text>
        </svg>
      );
    }

    if (clampedPct <= 0) {
      return (
        <svg className="w-44 h-44 mx-auto drop-shadow-xs select-none" viewBox="0 0 100 100">
          <circle cx={cx} cy={cy} r={r} fill={colorSecondary} />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fill={secondaryTextColor}
            fontSize="8"
            fontWeight="500"
            className="tracking-tight"
          >
            100%
          </text>
        </svg>
      );
    }

    const angle = (clampedPct / 100) * 360;
    const rad = (angle - 90) * (Math.PI / 180);
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    const largeArcFlag = clampedPct > 50 ? 1 : 0;

    const pathD = `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArcFlag} 1 ${x} ${y} Z`;

    // Centroide da Fatia 1 (Destaque)
    const midAngle1 = angle / 2;
    const rLabel1 = calcCentroidRadius(angle);
    const rad1 = (midAngle1 - 90) * (Math.PI / 180);
    const textX1 = cx + rLabel1 * Math.cos(rad1);
    const textY1 = cy + rLabel1 * Math.sin(rad1);

    // Centroide da Fatia 2 (Neutro/Restante)
    const restAngle = 360 - angle;
    const midAngle2 = angle + (restAngle / 2);
    const rLabel2 = calcCentroidRadius(restAngle);
    const rad2 = (midAngle2 - 90) * (Math.PI / 180);
    const textX2 = cx + rLabel2 * Math.cos(rad2);
    const textY2 = cy + rLabel2 * Math.sin(rad2);

    return (
      <svg className="w-44 h-44 mx-auto drop-shadow-xs select-none" viewBox="0 0 100 100">
        {/* Fatia 2 (Círculo de Fundo Neutro) */}
        <circle cx={cx} cy={cy} r={r} fill={colorSecondary} />
        {/* Fatia 1 (Arco Primário de Destaque) */}
        <path d={pathD} fill={colorPrimary} />
        {/* Linhas de Separação Brancas Nítidas */}
        <line x1={cx} y1={cy} x2={cx} y2={cy - r} stroke="#ffffff" strokeWidth="1.5" />
        <line x1={cx} y1={cy} x2={x} y2={y} stroke="#ffffff" strokeWidth="1.5" />

        {/* Rótulo Interno Fatia 1 */}
        {clampedPct >= 5 && (
          <text
            x={textX1}
            y={textY1}
            textAnchor="middle"
            dominantBaseline="central"
            fill={primaryTextColor}
            fontSize="7"
            fontWeight="500"
            className="tracking-tight"
          >
            {clampedPct.toFixed(2)}%
          </text>
        )}

        {/* Rótulo Interno Fatia 2 */}
        {restPct >= 5 && (
          <text
            x={textX2}
            y={textY2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={secondaryTextColor}
            fontSize="7"
            fontWeight="500"
            className="tracking-tight"
          >
            {restPct.toFixed(2)}%
          </text>
        )}
      </svg>
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

  return (
    <div className="w-full space-y-6 animate-fade-in">
      
      {/* BARRA SUPERIOR DE AÇÃO E NAVEGAÇÃO */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={onBackToSimulator}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar</span>
          </button>
          <div className="flex items-center gap-3.5 flex-wrap">
            <span className="text-sm font-extrabold text-sky-600 bg-sky-50 px-3.5 py-1 rounded-lg border border-sky-100 uppercase tracking-wide">
              {currentProd.name}
            </span>
            <span className="text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200/80">
              {currentCond.name}
            </span>
            {deliveryText && (
              <span
                id="badge-data-entrega"
                className="text-xs font-bold text-amber-800 bg-amber-50 px-3.5 py-1.5 rounded-lg border border-amber-200 flex items-center gap-2 shadow-2xs"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Chaves ➔ {deliveryText}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ALERTA: TABELA DE VENDAS NÃO IMPORTADA */}
      {!hasTable && (
        <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
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
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importar Tabela (Excel)</span>
          </button>
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL: FICHA x FLUXO (GRID 12 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUNA ESQUERDA: DADOS DA APROVAÇÃO (6 COLS) */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* CARD 1: DADOS DA UNIDADE E CLIENTE CENTRALIZADOS */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-500 font-medium">
                  Cliente: <strong className="text-slate-900">{simulationData.clientName || 'Cliente Não Informado'}</strong>
                </span>
                <span className="text-slate-500 font-medium">
                  Imobiliária: <strong className="text-slate-900">{simulationData.agency || 'Calazans Imóveis'}</strong>
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

            {/* LINHA 1: TORRE, UNIDADE, FASE, TIPOLOGIA CENTRALIZADOS */}
            <div className="grid grid-cols-12 gap-2 text-xs">
              <div className="col-span-12 sm:col-span-3 bg-sky-50/60 p-2 rounded-lg border border-sky-100 flex flex-col items-center justify-center text-center">
                <label className="block text-[10px] text-sky-600 font-bold uppercase mb-0.5 text-center">
                  TORRE *
                </label>
                <select
                  value={selectedTorre}
                  onChange={(e) => handleTorreChange(e.target.value)}
                  className="w-full bg-white font-bold text-slate-900 border border-slate-200 rounded-md py-1 px-1 focus:outline-none focus:border-sky-600 text-xs cursor-pointer text-center"
                >
                  <option value="">-- Selecione --</option>
                  {uniqueTorres.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-12 sm:col-span-3 bg-sky-50/60 p-2 rounded-lg border border-sky-100 flex flex-col items-center justify-center text-center">
                <label className="block text-[10px] text-sky-600 font-bold uppercase mb-0.5 text-center">
                  UNIDADE *
                </label>
                <select
                  value={selectedUnidade}
                  onChange={(e) => handleUnidadeChange(e.target.value)}
                  disabled={!selectedTorre}
                  className="w-full bg-white font-bold text-slate-900 border border-slate-200 rounded-md py-1 px-1 focus:outline-none focus:border-sky-600 text-xs cursor-pointer text-center disabled:opacity-50"
                >
                  <option value="">-- Selecione --</option>
                  {filteredUnits.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-6 sm:col-span-2 bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex flex-col items-center justify-center text-center">
                <span className="block text-[10px] text-slate-400 font-medium text-center mb-0.5">Fase</span>
                <input
                  id="campo-fase"
                  type="text"
                  value={fase}
                  readOnly
                  className="w-full bg-transparent font-bold text-slate-700 text-center focus:outline-none cursor-not-allowed"
                />
              </div>

              <div className="col-span-6 sm:col-span-4 bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex flex-col items-center justify-center text-center">
                <span className="block text-[10px] text-slate-400 font-medium text-center mb-0.5">Tipologia</span>
                <input
                  type="text"
                  value={tipologia}
                  readOnly
                  className="w-full bg-transparent font-bold text-slate-700 text-center focus:outline-none cursor-not-allowed truncate"
                  title={tipologia}
                />
              </div>
            </div>

            {/* LINHA 2: METRAGENS + VALORES DE TABELA CENTRALIZADOS */}
            <div className="grid grid-cols-12 gap-2 text-xs">
              <div className="col-span-6 sm:col-span-3 bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex flex-col items-center justify-center text-center">
                <span className="block text-[10px] text-slate-400 font-medium text-center mb-0.5">M² Priv.</span>
                <input
                  type="text"
                  value={areaPriv}
                  readOnly
                  className="w-full bg-transparent font-bold text-slate-700 text-center focus:outline-none cursor-not-allowed text-xs"
                />
              </div>

              <div className="col-span-6 sm:col-span-3 bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex flex-col items-center justify-center text-center">
                <span className="block text-[10px] text-slate-400 font-medium text-center mb-0.5">M² Quintal</span>
                <input
                  type="text"
                  value={areaQuintal}
                  readOnly
                  className="w-full bg-transparent font-bold text-slate-700 text-center focus:outline-none cursor-not-allowed text-xs"
                />
              </div>

              <div className="col-span-12 sm:col-span-3 bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex flex-col items-center justify-center text-center">
                <span className="block text-[10px] text-slate-400 font-medium text-center mb-0.5">Preço Tabela</span>
                <input
                  type="text"
                  value={formatCurrency(price)}
                  readOnly
                  className="w-full bg-transparent font-bold text-slate-900 text-center focus:outline-none cursor-not-allowed text-xs"
                />
              </div>

              <div className="col-span-12 sm:col-span-3 bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex flex-col items-center justify-center text-center">
                <span className="block text-[10px] text-slate-400 font-medium text-center mb-0.5">Avaliação Banco</span>
                <input
                  type="text"
                  value={formatCurrency(evaluation)}
                  readOnly
                  className="w-full bg-transparent font-bold text-emerald-600 text-center focus:outline-none cursor-not-allowed text-xs"
                />
              </div>
            </div>
          </div>

          {/* CARD 2: DADOS DA APROVAÇÃO DE CRÉDITO */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  1. Dados da Aprovação de Crédito
                </h3>
              </div>
            </div>

            {/* GRID DE DADOS DA APROVAÇÃO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50/60 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block border-b border-slate-200/60 pb-1 mb-1">
                    Recursos do Cliente
                  </span>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/40">
                    <span className="text-slate-600">Renda:</span>
                    <strong className="text-slate-800 font-semibold">{formatCurrency(income)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/40">
                    <span className="text-slate-600">Subsídio:</span>
                    <strong className="text-emerald-600 font-semibold">{formatCurrency(subsidyEfetivo)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/40">
                    <span className="text-slate-600">FGTS:</span>
                    <strong className="text-sky-600 font-semibold">{formatCurrency(fgtsEfetivo)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 mt-2.5">
                    <span className="text-slate-600">Desconto Ato:</span>
                    <strong className="text-emerald-600 font-semibold">{formatCurrency(descontoAto)}</strong>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/60 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block border-b border-slate-200/60 pb-1 mb-1">
                    Operação Bancária
                  </span>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/40">
                    <span className="text-slate-600">Max Financ:</span>
                    <strong className="text-sky-600 font-bold">{formatCurrency(maxFinancEfetivo)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/40">
                    <span className="text-slate-600">Total Negoc:</span>
                    <strong className="text-slate-800 font-semibold">{formatCurrency(totalNegocEfetivo)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/40">
                    <span className="text-slate-600">Sinal Total:</span>
                    <strong className="text-amber-600 font-bold">{formatCurrency(sinalTotal)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 mt-2.5">
                    <span className="text-slate-600">Sinal + ITBI:</span>
                    <strong className="text-emerald-600 font-bold">{formatCurrency(sinalTotal + despCartoriasEfetivas)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TERMOS LEGAIS */}
          <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-[10px] text-amber-900 leading-relaxed">
            <strong>Informações importantes:</strong> Estas informações referem-se apenas a uma simulação. As condições da operação e a efetivação dos resultados estão condicionadas à aprovação de crédito e à contratação junto ao parceiro financeiro.
          </div>

        </div>

        {/* COLUNA DIREITA: FLUXO MORAR + BANCO DIRETO (6 COLS) */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* QUADRO 1: FLUXO DE PAGAMENTO C/ MORAR CONSTRUTORA */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                  <Building className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  2. Fluxo de Pagamento c/ Morar Construtora
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={limparFluxoPagamento}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                  title="Limpar Fluxo de Pagamento"
                >
                  <RotateCcw className="w-3 h-3 text-sky-600" />
                  <span>Limpar</span>
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {/* 1ª LINHA: ATO (IMÓVEL), ATO (ITBI) E ATO PREMIADO */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* CAMPO 1: PAGAMENTO ATO (IMÓVEL) */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">
                      Pagamento Ato (Imóvel)
                    </label>
                  </div>
                  <input
                    type="text"
                    value={isEditingAto ? atoInputText : (atoAposMensais > 0 ? formatCurrency(atoAposMensais) : '')}
                    onFocus={() => {
                      setIsEditingAto(true);
                      setAtoInputText(atoAposMensais > 0 ? formatCurrency(atoAposMensais) : '');
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
                    className="w-full bg-white px-2 py-1 rounded-lg border border-slate-200 font-bold text-slate-800 text-center focus:outline-none focus:border-sky-600 text-xs transition-all"
                  />

                </div>

                {/* CAMPO 2: PAGAMENTO ITBI NO ATO */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-sky-800 uppercase">
                      Pagamento ITBI no Ato
                    </label>
                    <span className="text-[9px] text-sky-700 font-bold bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                      Sem Desconto
                    </span>
                  </div>
                  <input
                    type="text"
                    value={valAtoITBI > 0 ? formatCurrency(valAtoITBI) : ''}
                    onChange={(e) => {
                      const inputVal = parseCurrency(e.target.value);
                      if (hasUnitSelected && despCartorias > 0 && inputVal > despCartorias) {
                        alert(`O valor do Pagamento do ITBI no Ato não pode exceder o valor total do ITBI/Despesas Cartorárias (${formatCurrency(despCartorias)}).`);
                        setValAtoITBI(despCartorias);
                      } else {
                        setValAtoITBI(inputVal);
                      }
                    }}
                    onBlur={() => {
                      if (hasUnitSelected && despCartorias > 0 && valAtoITBI > despCartorias) {
                        alert(`O valor do Pagamento do ITBI no Ato não pode exceder o valor total do ITBI/Despesas Cartorárias (${formatCurrency(despCartorias)}).`);
                        setValAtoITBI(despCartorias);
                      }
                    }}
                    placeholder="R$ 0,00"
                    className="w-full bg-white px-2 py-1 rounded-lg border border-slate-200 font-bold text-sky-900 text-center focus:outline-none focus:border-sky-600 text-xs transition-all"
                  />
                </div>

                {/* ATO PREMIADO */}
                <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-amber-800 uppercase">
                      Ato Premiado
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAtoPremiadoEnabled(prev => !prev);
                      }}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                        isAtoPremiadoEnabled 
                          ? 'bg-amber-200 text-amber-900 hover:bg-amber-300' 
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {isAtoPremiadoEnabled ? 'Zerar' : 'Aplicar'}
                    </button>
                  </div>
                  <div className="mt-auto">
                    <span className="font-extrabold text-amber-800 text-sm">
                      {isAtoPremiadoEnabled && descontoAto > 0 ? formatCurrency(descontoAto) : 'R$ 0,00'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2ª LINHA: 1ª MENSAL (30D) E 2ª MENSAL (60D) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1ª MENSAL (30D) */}
                <div className={`p-2.5 rounded-xl border transition-all ${
                  isExceededParc2 ? 'bg-red-50/90 border-red-500' : 'bg-slate-50 border-slate-200/80'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className={`block text-[10px] font-bold uppercase ${
                      isExceededParc2 ? 'text-red-900' : 'text-slate-500'
                    }`}>
                      1ª Mensal (30d)
                    </label>
                  </div>
                  <input
                    type="text"
                    value={valParc2 > 0 ? formatCurrency(valParc2) : ''}
                    onChange={(e) => setValParc2(parseCurrency(e.target.value))}
                    onBlur={() => {
                      if (valParc2 > 0 && valParc2 < 200) {
                        setValParc2(200);
                        if (onShowToast) onShowToast('O valor mínimo para parcelas mensais é R$ 200,00.');
                      }
                    }}
                    placeholder="R$ 0,00"
                    className={`w-full px-2 py-1 rounded-lg font-bold text-center text-xs transition-all focus:outline-none ${
                      isExceededParc2
                        ? 'bg-red-100 border-2 border-red-500 text-red-900 focus:border-red-600'
                        : 'bg-white border border-slate-200 text-slate-800 focus:border-sky-600'
                    }`}
                  />
                  {isExceededParc2 && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100/80 p-1.5 rounded-lg border border-red-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span>Atenção: parcela excede 35% da renda (Máx: {formatCurrency(limiteRenda)})!</span>
                    </div>
                  )}
                </div>

                {/* 2ª MENSAL (60D) */}
                <div className={`p-2.5 rounded-xl border transition-all ${
                  isExceededParc3 ? 'bg-red-50/90 border-red-500' : 'bg-slate-50 border-slate-200/80'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className={`block text-[10px] font-bold uppercase ${
                      isExceededParc3 ? 'text-red-900' : 'text-slate-500'
                    }`}>
                      2ª Mensal (60d)
                    </label>
                  </div>
                  <input
                    type="text"
                    value={valParc3 > 0 ? formatCurrency(valParc3) : ''}
                    onChange={(e) => setValParc3(parseCurrency(e.target.value))}
                    onBlur={() => {
                      if (valParc3 > 0 && valParc3 < 200) {
                        setValParc3(200);
                        if (onShowToast) onShowToast('O valor mínimo para parcelas mensais é R$ 200,00.');
                      }
                    }}
                    placeholder="R$ 0,00"
                    className={`w-full px-2 py-1 rounded-lg font-bold text-center text-xs transition-all focus:outline-none ${
                      isExceededParc3
                        ? 'bg-red-100 border-2 border-red-500 text-red-900 focus:border-red-600'
                        : 'bg-white border border-slate-200 text-slate-800 focus:border-sky-600'
                    }`}
                  />
                  {isExceededParc3 && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100/80 p-1.5 rounded-lg border border-red-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span>Atenção: parcela excede 35% da renda (Máx: {formatCurrency(limiteRenda)})!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* QUADRO 2: PARCELAMENTO PRÓ-SOLUTO & BANCO DIRETO */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                  <Coins className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  3. Parcelamento Pró-Soluto / Banco Direto
                </h3>
              </div>
            </div>

            {/* LEGENDA DE AMORTIZAÇÃO REPOSICIONADA */}
            <div className="flex justify-between items-center text-[10px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              <span>Amortização: <strong className="text-slate-700 font-semibold">Tabela Price</strong></span>
              <span>Juros: <strong className="text-sky-700 font-bold">{appliedRatePct.toFixed(2)}% a.m.</strong></span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-center">
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
                    className="w-full bg-white px-2 py-1 rounded-lg border border-slate-200 font-bold text-sky-600 text-center focus:outline-none focus:border-sky-600 text-xs"
                  />
                  <span className="absolute right-2 text-xs font-extrabold text-slate-400 pointer-events-none">X</span>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">1ª Parcela</span>
                <strong className="text-slate-900 font-bold text-sm block mt-1">
                  {formatCurrency(parcela)}
                </strong>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Última Parcela</span>
                <strong className="text-slate-900 font-bold text-sm block mt-1">
                  {formatCurrency(parcela)}
                </strong>
              </div>
            </div>

            <div className="space-y-2 text-xs pt-1">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2 px-1">
                <span className="text-slate-500 font-medium">
                  Despesas Cartorárias & ITBI<span className="ml-1.5 text-[11px] text-slate-400 font-normal">(Total: {formatCurrency(valorTotalITBI)}):</span>
                </span>
                <strong className="text-slate-800 font-semibold">{formatCurrency(saldoITBI)}</strong>
              </div>

              <div className="flex justify-between items-center border-b border-slate-100 pb-2 px-1">
                <span className="text-slate-500 font-medium">Pró-Soluto (Sinal Restante):</span>
                <strong className="text-slate-900 font-bold">{formatCurrency(proSoluto)}</strong>
              </div>

              <div className="flex justify-between items-center pt-2 text-sm bg-sky-50/80 p-3.5 rounded-xl border border-sky-100">
                <span className="font-bold text-slate-900">Pró-Soluto Total c/ ITBI (Risco Máx):</span>
                <strong className="font-extrabold text-sky-600 text-base">{formatCurrency(proSolutoTotalPainel)}</strong>
              </div>

            </div>
          </div>

          {/* CARD 4: INDICADORES DE RISCO DA OPERAÇÃO (GRÁFICOS DE PIZZA SÓLIDOS) */}
          <div className="bg-white p-4 sm:p-4.5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
            {/* Cabeçalho de Bases Compartilhadas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                  <PieChart className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  4. Indicadores de Risco / Comprometimento
                </h3>
              </div>
              <div className="flex items-center flex-wrap gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-200/80 text-slate-600">
                  <span className="text-slate-400 font-medium">Base Líquida c/ ITBI:</span>
                  <strong className="font-bold text-slate-800">{formatCurrency(baseVendaLiquidaComITBI)}</strong>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-200/80 text-slate-600">
                  <span className="text-slate-400 font-medium">Base da Renda:</span>
                  <strong className="font-bold text-slate-800">{formatCurrency(baseRendaInformada)}</strong>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* COLUNA 1: RISCO PARCELA / COMPROMETIMENTO */}
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 flex flex-col justify-between space-y-1.5">
                <div className="border-b border-slate-200/60 pb-1.5">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-600" />
                    Risco Parcela / Comprometimento
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    1ª Parcela sobre a Base da Renda
                  </p>
                </div>

                {/* Gráfico de Pizza Sólido sem sobreposição de textos */}
                <div className="py-0.5 flex items-center justify-center overflow-visible">
                  {renderSolidPie(pctRiscoParcelaRenda, '#0284c7', '#cbd5e1')}
                </div>

                {/* Resumo de Valor Inferior */}
                <div className="w-full">
                  <div className="flex flex-col items-center justify-center py-2 px-3 text-center bg-slate-50 border border-slate-100 rounded-xl shadow-2xs overflow-hidden w-full">
                    <span className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
                      <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0" />
                      1ª Parcela
                    </span>
                    <strong className="text-sm font-semibold text-slate-800 mt-0.5 whitespace-nowrap truncate">
                      {formatCurrency(valorRiscoParcela)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* COLUNA 2: RISCO PRÓ-SOLUTO TOTAL */}
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 flex flex-col justify-between space-y-1.5">
                <div className="border-b border-slate-200/60 pb-1.5">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                    Risco Pró-Soluto Total
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Pró-Soluto Total c/ ITBI sobre a Base Líquida com ITBI
                  </p>
                </div>

                {/* Gráfico de Pizza Sólido sem sobreposição de textos */}
                <div className="py-0.5 flex items-center justify-center overflow-visible">
                  {renderSolidPie(pctRiscoProSoluto, '#4f46e5', '#cbd5e1')}
                </div>

                {/* Resumo de Valor Inferior */}
                <div className="w-full">
                  <div className="flex flex-col items-center justify-center py-2 px-3 text-center bg-slate-50 border border-slate-100 rounded-xl shadow-2xs overflow-hidden w-full">
                    <span className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                      Pró-Soluto Total
                    </span>
                    <strong className="text-sm font-semibold text-slate-800 mt-0.5 whitespace-nowrap truncate">
                      {formatCurrency(valorRiscoProSoluto)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
