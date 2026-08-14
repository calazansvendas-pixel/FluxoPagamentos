import React, { useState, useEffect } from 'react';
import { ArrowLeft, RotateCcw, KeyRound, FileCheck2, Calculator, ShieldCheck, Building, Coins, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { CommercialCondition, Product, SelectedUnit, SimulationData } from '../types';
import { formatCurrency, formatM2, parseCurrency, formatDateMonthYear, formatDeliveryText } from '../utils/formatters';
import { calculatePolicyRiskValues, ensureProductConditions, calculatePricePMT } from '../utils/calculations';

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
  const currentCond = condition || (currentProd ? ensureProductConditions({ ...currentProd }).conditions[0] : null);

  // LÓGICA DE DEFINIÇÃO DO PRAZO PADRÃO (INITIAL SUGGESTION / TETO MÁXIMO)
  // a) SE Prazo Faixa 2 estiver cadastrada e > 0: valor padrão = Faixa 2 (ex: 72x)
  // b) SE apenas Prazo Faixa 1 estiver cadastrada (ou Faixa 2 for 0/vazia): valor padrão = Faixa 1 (ex: 60x)
  const faixa1Meses = currentCond?.mesesTabela1;
  const faixa2Meses = currentCond?.mesesTabela2;
  const temFaixa2 = faixa2Meses !== undefined && faixa2Meses !== null && Number(faixa2Meses) > 0;
  const temFaixa1 = faixa1Meses !== undefined && faixa1Meses !== null && Number(faixa1Meses) > 0;

  const limiteMaximoParcelas = temFaixa2
    ? Number(faixa2Meses)
    : (temFaixa1 ? Number(faixa1Meses) : (currentCond?.numParcelas || currentProd?.numParcelas || 60));

  const [selectedTorre, setSelectedTorre] = useState<string>('');
  const [selectedUnidade, setSelectedUnidade] = useState<string>('');

  const [valAto, setValAto] = useState<number>(0);
  const [valAtoITBI, setValAtoITBI] = useState<number>(0);
  const [valAtoPremiado, setValAtoPremiado] = useState<number>(0);
  const [valParc2, setValParc2] = useState<number>(0);
  const [valParc3, setValParc3] = useState<number>(0);

  const [qtdMensais, setQtdMensais] = useState<number>(limiteMaximoParcelas);

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
  }, [currentProd, selectedUnits]);

  useEffect(() => {
    if (currentCond) {
      setQtdMensais(limiteMaximoParcelas);
    }
  }, [currentCond, limiteMaximoParcelas]);

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
      setQtdMensais(limiteMaximoParcelas);
    }
    if (currentProd) {
      onUnitSelectChange(currentProd.id, { torre, unidade: '' });
    }
  };

  const handleUnidadeChange = (unidade: string) => {
    setSelectedUnidade(unidade);
    if (currentCond) {
      setQtdMensais(limiteMaximoParcelas);
    }
    if (currentProd) {
      onUnitSelectChange(currentProd.id, { torre: selectedTorre, unidade });
    }
  };

  // Função isolada de limpeza exclusiva da Ficha de Análise
  const handleResetFicha = () => {
    setSelectedTorre('');
    setSelectedUnidade('');
    setValAto(0);
    setValAtoITBI(0);
    setValAtoPremiado(0);
    setValParc2(0);
    setValParc3(0);
    if (currentCond) {
      setQtdMensais(limiteMaximoParcelas);
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
  // b) Não pode ultrapassar o Preço de Tabela deduzido do sinal mínimo de R$ 2.000,00.
  const valorAvaliacao = (hasUnitSelected && evaluation > 0) ? evaluation : price;
  const precoTabelaMenosSinalMin = (hasUnitSelected && price > 0) ? Math.max(0, price - 2000) : 0;
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
    0
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

      // i) Pagamento Ato (Sinal Efetivo) = (Sinal Total c/ ITBI) - Pró-Soluto Líquido;
      pagamentoAtoSinalEfetivo = Math.max(0, sinalTotalComITBI - proSolutoLiquido);

      // Ato Bruto Apurado = (Sinal Total c/ ITBI antes do desconto) - Pró-Soluto Líquido
      const atoBrutoCalculado = Math.max(0, (gapInicial + despCartorias) - proSolutoLiquido);

      // j) novoAtoPremiado = Exatamente 10% do Pagamento Ato (Sinal Efetivo), caso o Ato Bruto seja >= 5000
      const novoAtoPremiado = (atoBrutoCalculado >= 5000) 
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

    // 1. TRAVA DO ATO MÍNIMO (PISO DE R$ 2.000,00) & REDISTRIBUIÇÃO OBRIGATÓRIA
    if (pagamentoAtoSinalEfetivo < 2000) {
      pagamentoAtoSinalEfetivo = 2000;
      atoPremiadoAtual = 0; // Regra dos 10% não se aplica pois 2000 não atinge 5k
      const baseDividaTotal = gapInicial + despCartorias;
      proSolutoLiquido = Math.max(0, baseDividaTotal - pagamentoAtoSinalEfetivo);
      riscoMaximoApuradoBruto = proSolutoLiquido / (1 - 0.0020029);
      taxaBancaria = riscoMaximoApuradoBruto * 0.0020029;
    }
  }

  const atoMinimoCalculado = hasUnitSelected ? Math.max(2000, pagamentoAtoSinalEfetivo) : 0;
  const sinalTotalOriginal = gapInicial;

  // 1. CAMPO 1: "PAGAMENTO ATO (IMÓVEL)" - valAto
  const mens30d = valParc2 || 0;
  const mens60d = valParc3 || 0;
  const somaMensais = mens30d + mens60d;

  const atoImovelDigitado = valAto > 0 ? valAto : atoMinimoCalculado;
  const descontoImovelDigitado = (atoImovelDigitado >= 5000) ? Math.min(atoImovelDigitado * 0.10, 5000) : 0;
  const necessidadeTotalEntrada = atoImovelDigitado + descontoImovelDigitado;

  // As mensais absorvem parte da entrada requerida. Target restante para (AtoEfetivo + AtoPremiado):
  const targetAtoEComposto = Math.max(0, necessidadeTotalEntrada - somaMensais);

  let atoAposMensais = 2000;
  let novoAtoPremiado = 0;
  let atoAbsorvido = 0;
  let sobraParaAmortizar = 0;

  if (targetAtoEComposto < 2000) {
    // Trava de R$ 2.000,00 do Ato Mínimo
    atoAposMensais = 2000;
    novoAtoPremiado = 0;
    atoAbsorvido = Math.min(Math.max(0, atoImovelDigitado - 2000), somaMensais);
    sobraParaAmortizar = somaMensais - atoAbsorvido;
  } else {
    // Loop de equalização e convergência iterativa entre Ato Efetivo e Ato Premiado
    let currAtoEfetivo = targetAtoEComposto;
    let currAtoPremiado = 0;

    for (let iter = 0; iter < 100; iter++) {
      const atoBruto = currAtoEfetivo + currAtoPremiado;
      const novoDesc = (atoBruto >= 5000 && currAtoEfetivo >= 4500)
        ? Math.min(currAtoEfetivo * 0.10, 5000)
        : 0;

      const lacuna = targetAtoEComposto - (currAtoEfetivo + novoDesc);
      currAtoPremiado = novoDesc;

      if (Math.abs(lacuna) < 0.0001) {
        break;
      }
      currAtoEfetivo += lacuna;
    }

    if (currAtoEfetivo < 2000) {
      currAtoEfetivo = 2000;
      currAtoPremiado = 0;
    }

    atoAposMensais = currAtoEfetivo;
    novoAtoPremiado = currAtoPremiado;
    atoAbsorvido = necessidadeTotalEntrada - (atoAposMensais + novoAtoPremiado);
    sobraParaAmortizar = 0;
  }

  // Abatimento 2 & 3 (Excesso das mensais vai para Financiamento, FGTS e Subsídio):
  let maxFinancEfetivo = maxFinanc;
  let fgtsEfetivo = fgts;
  let subsidyEfetivo = subsidy;

  if (sobraParaAmortizar > 0) {
    if (sobraParaAmortizar <= maxFinancEfetivo) {
      maxFinancEfetivo -= sobraParaAmortizar;
    } else {
      const sobraAposFinanc = sobraParaAmortizar - maxFinancEfetivo;
      maxFinancEfetivo = 0;

      if (sobraAposFinanc <= fgtsEfetivo) {
        fgtsEfetivo -= sobraAposFinanc;
      } else {
        const sobraAposFGTS = sobraAposFinanc - fgtsEfetivo;
        fgtsEfetivo = 0;
        subsidyEfetivo = Math.max(0, subsidyEfetivo - sobraAposFGTS);
      }
    }
  }

  const poderDePagamentoImovel = atoAposMensais + novoAtoPremiado;
  const novoSinalTotal = Math.max(0, price - (maxFinancEfetivo + subsidyEfetivo + fgtsEfetivo));

  // 2. CAMPO 2: "PAGAMENTO ITBI NO ATO" - valAtoITBI
  const valorTotalITBI = despCartorias;
  const atoITBIValidado = Math.min(valAtoITBI, valorTotalITBI);
  const saldoITBI = Math.max(0, valorTotalITBI - atoITBIValidado);
  const sobrasITBI = saldoITBI;

  // 3. NOVO FECHAMENTO DIRETO E MATEMÁTICO DO PRÓ-SOLUTO LÍQUIDO:
  // NovoProSolutoLiquido = (PrecoTabela + SaldoITBI) - (MaxFinanc + Subsidio + FGTS + AtoImovel + AtoPremiado + Mensal30D + Mensal60D + AtoITBI)
  const proSolutoTetoMaximo = hasUnitSelected ? proSolutoLiquido : 0;
  const precoTabelaComITBI = price + valorTotalITBI;
  const totalRecursosAplicados = maxFinancEfetivo + subsidyEfetivo + fgtsEfetivo + atoAposMensais + novoAtoPremiado + mens30d + mens60d + atoITBIValidado;
  let proSolutoTotalLiquido = Math.max(0, precoTabelaComITBI - totalRecursosAplicados);

  // 4. TRAVA RIGOROSA DO PRÓ-SOLUTO LÍQUIDO & REDIRECIONAMENTO AUTOMÁTICO DO EXCESSO PARA O ATO
  if (hasUnitSelected && proSolutoTetoMaximo > 0 && proSolutoTotalLiquido > proSolutoTetoMaximo + 0.0001) {
    const excessoCredito = proSolutoTotalLiquido - proSolutoTetoMaximo;
    const metaEntradaComposto = (atoAposMensais + novoAtoPremiado) + excessoCredito;

    let currAtoEfetivo = Math.max(2000, metaEntradaComposto);
    let currAtoPremiado = 0;

    if (metaEntradaComposto < 2000) {
      currAtoEfetivo = 2000;
      currAtoPremiado = 0;
    } else {
      // Loop de equalização e convergência iterativa entre Ato Efetivo e Ato Premiado para o excesso
      for (let iter = 0; iter < 100; iter++) {
        const atoBrutoCalculado = currAtoEfetivo + currAtoPremiado;
        const novoDesc = (atoBrutoCalculado >= 5000 && currAtoEfetivo >= 4500)
          ? Math.min(currAtoEfetivo * 0.10, 5000)
          : 0;

        const lacuna = metaEntradaComposto - (currAtoEfetivo + novoDesc);
        currAtoPremiado = novoDesc;

        if (Math.abs(lacuna) < 0.0001) {
          break;
        }
        currAtoEfetivo += lacuna;
      }
    }

    atoAposMensais = currAtoEfetivo;
    novoAtoPremiado = currAtoPremiado;

    // Recalcula total de recursos e fixa Pró-Soluto no teto máximo
    const totalRecursosAtualizado = maxFinancEfetivo + subsidyEfetivo + fgtsEfetivo + atoAposMensais + novoAtoPremiado + mens30d + mens60d + atoITBIValidado;
    proSolutoTotalLiquido = Math.min(proSolutoTetoMaximo, Math.max(0, precoTabelaComITBI - totalRecursosAtualizado));
  }

  // Sobra do Imóvel (Sinal Restante do Imóvel)
  const sobrasImovel = Math.max(0, proSolutoTotalLiquido - sobrasITBI);

  // Recalculo do Pró-Soluto Bruto (Risco Máximo) revertendo a taxa bancária de 0,20029%
  const proSolutoTotalBruto = proSolutoTotalLiquido > 0 ? (proSolutoTotalLiquido / (1 - 0.0020029)) : 0;
  const taxaBancariaEfetiva = proSolutoTotalBruto * 0.0020029;

  const totalNegocEfetivo = hasUnitSelected ? (maxFinancEfetivo + subsidyEfetivo + fgtsEfetivo) : 0;
  const sinalTotal = novoSinalTotal;
  const descontoAto = novoAtoPremiado;
  const despCartoriasEfetivas = saldoITBI;

  const atoEfetivo = atoAposMensais + atoITBIValidado;
  const atoBruto = atoEfetivo + descontoAto;

  const tetoMinimo = hasUnitSelected ? riscoMaximoApuradoBruto : 0;

  // Sync valAtoPremiado com descontoAto diretamente no campo "ATO PREMIADO"
  useEffect(() => {
    if (hasUnitSelected) {
      setValAtoPremiado(descontoAto);
    } else {
      setValAtoPremiado(0);
    }
  }, [hasUnitSelected, descontoAto]);

  // Sync valAto inicial/elevado quando unidade é selecionada ou necessidade de Ato aumenta
  useEffect(() => {
    if (hasUnitSelected) {
      const minAto = Math.max(atoMinimoCalculado, atoAposMensais);
      if (valAto === 0 || valAto < minAto) {
        setValAto(minAto);
      }
    } else {
      setValAto(0);
      setValAtoITBI(0);
    }
  }, [hasUnitSelected, atoMinimoCalculado, atoAposMensais]);

  // Função para resetar exclusivamente o Fluxo de Pagamento (Quadros 2 e 3)
  const limparFluxoPagamento = () => {
    setValAto(atoMinimoCalculado);
    setValAtoITBI(0);
    setValParc2(0);
    setValParc3(0);
    setQtdMensais(limiteMaximoParcelas);
    if (onShowToast) {
      onShowToast('Fluxo de pagamento redefinido para as condições padrão.');
    }
  };

  // Pró-Soluto (Sinal Restante Imóvel)
  const proSoluto = sobrasImovel;

  // Taxa de juros da política de crédito (a.m.)
  const meses1 = currentCond?.mesesTabela1 || 36;
  const taxa1 = currentCond?.taxaJuros1 !== undefined ? currentCond.taxaJuros1 : 0;
  const taxa2 = currentCond?.taxaJuros2 !== undefined ? currentCond.taxaJuros2 : 1.9;
  const appliedRatePct = (qtdMensais <= meses1) ? taxa1 : taxa2;

  // Cálculo das parcelas mensais utilizando a fórmula da Tabela Price (PGTO Excel):
  // PMT = PGTO(appliedRatePct, qtdMensais, -proSolutoTotalBruto)
  const parcela = (hasUnitSelected && proSolutoTotalBruto > 0 && qtdMensais > 0)
    ? calculatePricePMT(proSolutoTotalBruto, appliedRatePct, qtdMensais)
    : 0;

  const limiteRenda = (income && income > 0) ? income * 0.35 : 0;
  const isExceededParc2 = limiteRenda > 0 && mens30d > limiteRenda;
  const isExceededParc3 = limiteRenda > 0 && mens60d > limiteRenda;

  const totalEntradaMorar = atoAposMensais + atoITBIValidado + mens30d + mens60d + novoAtoPremiado;

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
              <div className="space-y-2 bg-slate-50/60 p-3.5 rounded-xl border border-slate-100">
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
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-600 flex items-center gap-1">
                    <span>Desconto Construtora (Ato):</span>
                  </span>
                  <strong className="text-emerald-600 font-semibold">{formatCurrency(descontoAto)}</strong>
                </div>
              </div>

              <div className="space-y-2 bg-slate-50/60 p-3.5 rounded-xl border border-slate-100">
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
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-600">Sinal Total:</span>
                  <strong className="text-amber-600 font-bold">{formatCurrency(sinalTotal)}</strong>
                </div>
              </div>
            </div>

            {/* Destaque Com ITBI */}
            <div className="bg-gradient-to-r from-amber-50 to-amber-100/60 p-3.5 rounded-xl border border-amber-200/80 text-xs shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-amber-700" />
                  <span className="text-amber-900 font-bold">Sinal Total Com ITBI e Despesas:</span>
                </div>
                <strong className="text-slate-900 font-extrabold text-sm">
                  {formatCurrency(sinalTotal + despCartoriasEfetivas)}
                </strong>
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
                    value={atoAposMensais > 0 ? formatCurrency(atoAposMensais) : ''}
                    onChange={(e) => {
                      const inputVal = parseCurrency(e.target.value);
                      const saldoDevedorTotal = sinalTotalOriginal + maxFinanc;
                      let maxAtoPermitido = saldoDevedorTotal;
                      if (saldoDevedorTotal >= 55000) {
                        maxAtoPermitido = saldoDevedorTotal - 5000;
                      } else if (saldoDevedorTotal >= 5500) {
                        maxAtoPermitido = saldoDevedorTotal / 1.10;
                      }

                      if (hasUnitSelected && saldoDevedorTotal > 0 && inputVal > maxAtoPermitido + 0.01) {
                        alert("O valor digitado excede o saldo devedor total (Construtora + Banco). O Ato foi ajustado para o valor exato necessário para quitar 100% do financiamento.");
                        setValAto(maxAtoPermitido);
                      } else {
                        setValAto(inputVal);
                      }
                    }}
                    onBlur={() => {
                      if (hasUnitSelected && (sinalTotalOriginal > 0 || maxFinanc > 0)) {
                        const saldoDevedorTotal = sinalTotalOriginal + maxFinanc;
                        let maxAtoPermitido = saldoDevedorTotal;
                        if (saldoDevedorTotal >= 55000) {
                          maxAtoPermitido = saldoDevedorTotal - 5000;
                        } else if (saldoDevedorTotal >= 5500) {
                          maxAtoPermitido = saldoDevedorTotal / 1.10;
                        }

                        if (valAto > maxAtoPermitido + 0.01) {
                          alert("O valor digitado excede o saldo devedor total (Construtora + Banco). O Ato foi ajustado para o valor exato necessário para quitar 100% do financiamento.");
                          setValAto(maxAtoPermitido);
                        } else if (valAto < atoMinimoCalculado - 0.01) {
                          alert("Não existe a possibilidade de diminuir o valor do Ato (Imóvel), pois ele já está no limite do risco calculated.");
                          setValAto(atoMinimoCalculado);
                        }
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
                <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-amber-800 uppercase">
                      Ato Premiado
                    </label>
                  </div>
                  <input
                    type="text"
                    value={valAtoPremiado > 0 ? formatCurrency(valAtoPremiado) : ''}
                    onChange={(e) => setValAtoPremiado(parseCurrency(e.target.value))}
                    placeholder="R$ 0,00"
                    className="w-full bg-white px-2 py-1 rounded-lg border border-amber-300 font-extrabold text-amber-800 text-center focus:outline-none focus:border-amber-500 text-xs transition-all"
                  />
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
                        return;
                      }
                      const val = parseInt(rawVal, 10);
                      if (isNaN(val)) return;

                      if (val > limiteMaximoParcelas) {
                        setQtdMensais(limiteMaximoParcelas);
                        alert("A quantidade máxima de parcelas permitida pela política de vendas para este empreendimento é de " + limiteMaximoParcelas + "x.");
                        return;
                      }
                      if (val < 1) {
                        setQtdMensais(1);
                        return;
                      }
                      setQtdMensais(val);
                    }}
                    onBlur={() => {
                      if (!qtdMensais || qtdMensais < 1) {
                        setQtdMensais(1);
                      } else if (qtdMensais > limiteMaximoParcelas) {
                        setQtdMensais(limiteMaximoParcelas);
                        alert("A quantidade máxima de parcelas permitida pela política de vendas para este empreendimento é de " + limiteMaximoParcelas + "x.");
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
                <span className="font-bold text-slate-900">Pró-Soluto Líquido c/ ITBI:</span>
                <strong className="font-extrabold text-sky-600 text-base">{formatCurrency(proSolutoTotalLiquido)}</strong>
              </div>


            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
