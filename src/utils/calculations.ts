import { CommercialCondition, Product, SimulationData } from '../types';
import { parseCurrency } from './formatters';

export interface FinancialParams {
  precoTabela: number;
  avaliacaoBanco: number;
  renda: number;
  subsidio?: number;
  fgts?: number;
  financiamentoAprovado?: number;
  ltvMaximo?: number; // Ex: 0.80 para 80%
  itbiRegistro: number;
  percentualRiscoImovel: number; // Ex: 20 para 20%
  percentualRiscoRenda?: number; // Padrão 35%
  prazoMeses: number; // Ex: 60
  taxaJurosMensal?: number; // Taxa de juros ao mês em % (ex: 1.9 para 1.9%)
  atoManual?: number;
  aportesExtras?: number;
  sinalMinimo?: number;
}

export interface SimulationResult {
  maxFinanciamento: number;
  totalNegociado: number;
  descontoAtoPremiado: number;
  sinalTotal: number;
  totalComITBI: number;
  tetoImovel: number;
  tetoRenda: number;
  proSolutoMaximo: number;
  atoSugerido: number;
  atoEfetivo: number;
  proSolutoRestante: number;
  proSolutoTotal: number;
  baseParcelar: number;
  taxaBancaria: number;
  baseLiquida: number;
  valorParcela: number;
  comprometimentoRenda: number;
  riscoImovelEfetivo: number;
  conferenciaValida: boolean;
}

/**
 * Calcula o Valor Presente (PV) dado PMT, taxa decimal e prazo
 */
export function calcularValorPresente(pmt: number, taxa: number, n: number): number {
  if (taxa <= 0) return (pmt || 0) * (n || 1);
  return (pmt || 0) * ((1 - Math.pow(1 + taxa, -n)) / taxa);
}

/**
 * Calcula a Parcela Mensal (PMT) pela Tabela Price dada PV, taxa decimal e prazo
 */
export function calcularPricePMT(pv: number, taxa: number, n: number): number {
  if (taxa <= 0) return (pv || 0) / (n || 1);
  return ((pv || 0) * taxa) / (1 - Math.pow(1 + taxa, -n));
}

export function calculatePresentValue(ratePerMonthPct: number, numInstallments: number, monthlyPayment: number): number {
  return calcularValorPresente(monthlyPayment || 0, (ratePerMonthPct || 0) / 100, numInstallments || 1);
}

export function calcularParcelaPrice(taxaAoMesPct: number, numParcelas: number, valorPresente: number): number {
  return calcularPricePMT(valorPresente || 0, (taxaAoMesPct || 0) / 100, numParcelas || 1);
}

export function calculatePricePMT(principal: number, ratePerMonthPct: number, numInstallments: number): number {
  return calcularPricePMT(principal || 0, (ratePerMonthPct || 0) / 100, numInstallments || 1);
}

/**
 * Garante que o produto possui a estrutura de condições comerciais necessárias
 */
export function ensureProductConditions(prod: Product): Product {
  if (!prod) return prod;
  if (!prod.conditions || prod.conditions.length === 0) {
    const opts = (prod.options && prod.options.length > 0) 
      ? prod.options 
      : ['Sinal c/ Banco Direto', 'Sinal c/ Morar'];
    
    prod.conditions = opts.map((optName, idx) => {
      const isMorar = optName.toLowerCase().includes('morar');
      return {
        id: `cond_${prod.id}_${idx + 1}`,
        name: optName,
        numParcelas: isMorar ? 60 : (prod.numParcelas || 60),
        sinalMinimo: prod.sinalMinimo || 'R$ 2.000,00',
        riscoRendaPct: prod.riscoRendaPct !== undefined ? prod.riscoRendaPct : 30,
        riscoImovelPct: prod.riscoImovelPct !== undefined ? prod.riscoImovelPct : 20,
        mesesTabela1: 36,
        taxaJuros1: 0.0,
        mesesTabela2: 72,
        taxaJuros2: 1.9,
        // Padrões específicos para Sinal c/ Morar
        mesesObra: isMorar ? 33 : 33,
        mesesPos: isMorar ? 27 : 27,
        percMaxProSolutoGlobal: isMorar ? 17.0 : (prod.riscoImovelPct || 20.0),
        percMaxPosObra: isMorar ? 8.0 : 8.0,
        riscoPosPct: isMorar ? 8.0 : 8.0,
        globalSerie1Pct: 30.0,
        globalSerie2Pct: 25.0,
        globalSerie3Pct: 20.0,
        globalSerie4Pct: 15.0,
        globalSerie5Pct: 10.0,
        globalSerie6Pct: 5.0,
        policy: prod.policy || `POLÍTICA COMERCIAL SINAL ${optName.toUpperCase()}:\n- Comissão padrão: 4% apartada na proposta.\n- Entrada mínima conforme negociação.\n- Sujeito à análise financeira.`
      };
    });
  }
  return prod;
}

/**
 * Regra Oficial de Desconto do Ato Premiado Morar:
 * - Ato >= 50.000: Desconto fixo de R$ 5.000,00
 * - Ato >= 5.000 e < 50.000: Desconto de 10% (Ex: R$ 20.000 -> R$ 2.000)
 * - Ato < 5.000: Desconto de R$ 0,00
 */
export function calcularDescontoAtoPremiado(valorAto: number): number {
  const ato = Math.max(0, valorAto || 0);
  if (ato >= 50000) {
    return 5000.00;
  }
  if (ato >= 5000) {
    return Math.round(ato * 0.10 * 100) / 100;
  }
  return 0;
}

export interface MorarMonthsDecomposition {
  obra: number[];
  pos: number[];
}

/**
 * Decompõe os meses de Obra e Pós-Obra em blocos de até 12 meses, com transbordo (spillover)
 */
export function decomposeMorarMonths(mesesObra: number, mesesPos: number): MorarMonthsDecomposition {
  const mObra = Math.max(0, mesesObra || 0);
  const mPos = Math.max(0, mesesPos || 0);

  const obra = [0, 0, 0, 0, 0, 0];
  const pos = [0, 0, 0, 0, 0, 0];

  let remainingObra = mObra;
  let currentBucket = 0;

  // Fill Obra buckets
  while (remainingObra > 0 && currentBucket < 6) {
    const toFill = Math.min(12, remainingObra);
    obra[currentBucket] = toFill;
    remainingObra -= toFill;
    if (obra[currentBucket] === 12) {
      currentBucket++;
    }
  }

  // Fill Pos buckets, starting at the current bucket (which might be partially filled by Obra)
  let remainingPos = mPos;
  while (remainingPos > 0 && currentBucket < 6) {
    const spaceInBucket = 12 - obra[currentBucket];
    const toFill = Math.min(spaceInBucket, remainingPos);
    pos[currentBucket] = toFill;
    remainingPos -= toFill;
    if (pos[currentBucket] + obra[currentBucket] === 12) {
      currentBucket++;
    }
  }

  return { obra, pos };
}

export interface MorarEngineParams {
  precoTabela: number;
  avaliacaoBanco?: number;
  itbiRegistro: number;
  renda: number;
  financiamento?: number;
  subsidio?: number;
  fgts?: number;
  percentualRiscoGeral?: number; // Ex: 17% da Base (Pró-Soluto Global / Max Fluxo)
  percentualRiscoPos?: number; // Ex: 8% da Base (Teto Pós-Obra Global)
  percentualRiscoObra?: number;
  mesesObra?: number; // Ex: 33
  mesesPos?: number; // Ex: 27
  globalSeriesPct?: [number, number, number, number, number, number];
  sinalLiquidoTotal?: number;
  sinalMinimo?: number;
  atoITBI?: number;
  isAtoPremiadoEnabled?: boolean;
  isAtoZerado?: boolean;
  atoManual?: number;
  atoPremiado?: number; // Compatibilidade retroativa
}

export interface MorarSerieResult {
  serieIndex: number;
  qtd: number;
  pctMae: number;
  capacidadeRenda: number;
  rateioFluxoGlobal: number;
  pesoProporcionalBalde?: number;
  travaTetoPos?: number;
  parcelaBrutaFinal: number;
  parcelaLiquida: number;
  subtotalLiquido: number;
}

export interface MorarEngineResult {
  baseCalculo: number;
  maxFluxoGeral: number;
  tetoPosGlobal: number;
  parcelaMensalITBI: number;
  mesesTotaisGeral: number;
  obraSeries: MorarSerieResult[];
  posSeries: MorarSerieResult[];
  subtotalObraLiquido: number;
  subtotalPosLiquido: number;
  atoResidual: number;
  atoPremiado: number;
  atoBruto: number;
  totalProSolutoGerado: number;
  sinalLiquidoTotal: number;
  distribuidoTotal: number;
  totalComITBI: number;
}

/**
 * Motor de cálculo completo da condição Sinal c/ Morar - Linha do Tempo Contínua e Loop do Ato Premiado (Referência Circular)
 */
export function calculateMorarFlowEngine(params: MorarEngineParams): MorarEngineResult {
  const precoTabela = params.precoTabela || 0;
  const itbiRegistro = params.itbiRegistro || 0;
  const renda = params.renda || 0;
  const financiamento = params.financiamento || 0;
  const subsidio = params.subsidio || 0;
  const fgts = params.fgts || 0;
  const mesesObra = params.mesesObra !== undefined ? params.mesesObra : 33;
  const mesesPos = params.mesesPos !== undefined ? params.mesesPos : 27;
  const pctProSolutoGlobal = params.percentualRiscoGeral !== undefined ? params.percentualRiscoGeral : 17.0;
  const pctTetoPosGlobal = params.percentualRiscoPos !== undefined ? params.percentualRiscoPos : 8.0;
  const globalSeriesPct = params.globalSeriesPct || [30.0, 25.0, 20.0, 15.0, 10.0, 5.0];
  const isAtoPremiadoEnabled = params.isAtoPremiadoEnabled !== undefined ? params.isAtoPremiadoEnabled : true;
  const isAtoZerado = params.isAtoZerado === true;
  const sinalMinimo = params.sinalMinimo || 2000;

  // 1. Fatiamento do Tempo (Cascata Contínua de 12 Meses):
  const { obra: mObra, pos: mPos } = decomposeMorarMonths(mesesObra, mesesPos);
  const mesesTotaisGeral = mObra.reduce((a, b) => a + b, 0) + mPos.reduce((a, b) => a + b, 0);

  // ITBI Mensal = ITBI Restante a parcelar / (meses Obra + meses Pós)
  const itbiRestante = Math.max(0, itbiRegistro - (params.atoITBI || 0));
  const parcelaMensalITBIExato = (mesesTotaisGeral > 0 && itbiRestante > 0)
    ? (itbiRestante / mesesTotaisGeral)
    : 0;
  const parcelaMensalITBI = Math.round(parcelaMensalITBIExato * 100) / 100;

  // Sinal Total c/ ITBI = (Preço Venda - Financiamento - Subsídio - FGTS) + ITBI Total
  const totalNegociado = financiamento + subsidio + fgts;
  const sinalSemITBI = Math.max(0, precoTabela - totalNegociado);
  const sinalComITBI = Math.max(0, sinalSemITBI + itbiRegistro);

  // Capacidade máxima total de fluxo suportada pela Renda do cliente em cada balde ativo:
  // Cada série ativa tem teto de parcela bruta (com ITBI) = Renda * (globalSeriesPct[idx] / 100)
  const activeObraCapacities = mObra.map((qtd, idx) => qtd * (renda > 0 ? (renda * ((globalSeriesPct[idx] || 0) / 100)) : 0));
  const activePosCapacities = mPos.map((qtd, idx) => qtd * (renda > 0 ? (renda * ((globalSeriesPct[idx] || 0) / 100)) : 0));
  const capacidadeTotalRenda = activeObraCapacities.reduce((a, b) => a + b, 0) + activePosCapacities.reduce((a, b) => a + b, 0);

  // RESOLUÇÃO ALGÉBRICA DO LOOP DO ATO PREMIADO
  // O Desconto abate a Base Líquida, e a Base Líquida define o limite do fluxo, o que define o Ato.
  const baseInicial = precoTabela + itbiRegistro;
  const limiteRisco = pctProSolutoGlobal / 100;
  
  let atoPremiado = 0;
  if (isAtoPremiadoEnabled && !isAtoZerado && sinalComITBI > 0) {
    if (params.atoManual !== undefined && params.atoManual > 0) {
      atoPremiado = calcularDescontoAtoPremiado(params.atoManual);
    } else if (params.atoPremiado !== undefined && params.atoPremiado > 0) {
      atoPremiado = params.atoPremiado;
    } else {
      // Fórmula O(1): D = (SinalBruto - (Limite * BaseInicial)) / (11 - Limite)
      const descontoCalculado = (sinalComITBI - (limiteRisco * baseInicial)) / (11 - limiteRisco);
      const atoBrutoTeorico = descontoCalculado * 11;
      
      if (atoBrutoTeorico >= 50000) {
        atoPremiado = 5000;
      } else if (atoBrutoTeorico >= 5000) {
        atoPremiado = Math.round(descontoCalculado * 100) / 100;
      } else {
        atoPremiado = 0;
      }
    }
  }

  // 2. Apuração da Base de Risco (Após dedução exata do desconto)
  const baseCalculo = Math.max(0, baseInicial - atoPremiado);
  const tetoPoliticaGeral = Math.round(baseCalculo * limiteRisco * 100) / 100;
  
  const maxFluxoGeral = (renda > 0 && capacidadeTotalRenda > 0)
    ? Math.min(tetoPoliticaGeral, Math.round(capacidadeTotalRenda * 100) / 100)
    : tetoPoliticaGeral;
  
  const tetoPosGlobal = Math.round(baseCalculo * (pctTetoPosGlobal / 100) * 100) / 100;

  // 3. Ato Bruto e Determinação do Fluxo a Distribuir
  // O fluxo Efetivo nunca pode ultrapassar o Saldo Devedor real
  const saldoMaximoDisponivelComITBI = Math.max(0, Math.round((sinalComITBI - atoPremiado - sinalMinimo - (params.atoITBI || 0)) * 100) / 100);
  
  let fluxoDistribuirComITBI = Math.min(maxFluxoGeral, saldoMaximoDisponivelComITBI);
  
  // Ato Bruto = Total Com ITBI - ITBI no Ato - Fluxo - DescontoAto
  let atoBruto = Math.max(0, Math.round((sinalComITBI - (params.atoITBI || 0) - fluxoDistribuirComITBI) * 100) / 100);
  
  // Ato Líquido Exibido (Residual Padrão)
  let atoResidualPadrao = Math.max(0, Math.round((atoBruto - atoPremiado) * 100) / 100);
  
  // Proteção para não gerar fluxo se o sinal líquido (sinal - desconto) for menor ou igual ao sinal mínimo
  if (sinalComITBI - atoPremiado <= sinalMinimo) {
    atoResidualPadrao = Math.max(0, sinalComITBI - atoPremiado);
    fluxoDistribuirComITBI = 0;
  }

  let atoResidual = atoResidualPadrao;

  if (params.atoManual !== undefined && params.atoManual > 0) {
    atoResidual = params.atoManual;
    // Quando o Ato é informado manualmente (ex: R$ 20.000,00):
    fluxoDistribuirComITBI = Math.max(0, Math.round((sinalComITBI - atoResidual - atoPremiado - (params.atoITBI || 0)) * 100) / 100);
  }


  // 4. Decomposição Contínua das Séries (Blocos de 12 Meses)
  // Soma dos pesos ponderados de todas as séries ativas (Obra e Pós-Obra)
  const activeObraWeights = mObra.map((qtd, idx) => (globalSeriesPct[idx] || 0) * (qtd / 12));
  const activePosWeights = mPos.map((qtd, idx) => (globalSeriesPct[idx] || 0) * (qtd / 12));
  const sumActiveWeights = activeObraWeights.reduce((a, b) => a + b, 0) + activePosWeights.reduce((a, b) => a + b, 0);

  // Obra:
  const obraSeries: MorarSerieResult[] = mObra.map((qtd, idx) => {
    const pctAno = globalSeriesPct[idx] || 0;
    const capRendaMes = renda > 0 ? Math.round((renda * (pctAno / 100)) * 100) / 100 : 0;
    if (qtd <= 0) {
      return {
        serieIndex: idx,
        qtd: 0,
        pctMae: pctAno,
        capacidadeRenda: capRendaMes,
        rateioFluxoGlobal: 0,
        parcelaBrutaFinal: 0,
        parcelaLiquida: 0,
        subtotalLiquido: 0
      };
    }
    // Rateio proporcional entre as séries ativas
    const pesoSerie = activeObraWeights[idx];
    const pctRateioSerie = sumActiveWeights > 0 ? (pesoSerie / sumActiveWeights) : 0;
    const volumeSerie = fluxoDistribuirComITBI * pctRateioSerie;
    const parcelaBrutaFinal = qtd > 0 ? (volumeSerie / qtd) : 0;
    const parcelaLiquida = Math.max(0, Math.round((parcelaBrutaFinal - parcelaMensalITBIExato) * 100) / 100);
    const subtotalLiquido = Math.round(parcelaLiquida * qtd * 100) / 100;

    return {
      serieIndex: idx,
      qtd,
      pctMae: pctAno,
      capacidadeRenda: capRendaMes,
      rateioFluxoGlobal: Math.round(parcelaBrutaFinal * 100) / 100,
      parcelaBrutaFinal: Math.round(parcelaBrutaFinal * 100) / 100,
      parcelaLiquida,
      subtotalLiquido
    };
  });

  // Pós-Obra:
  const posSeries: MorarSerieResult[] = mPos.map((qtd, idx) => {
    const pctAno = globalSeriesPct[idx] || 0;
    const capRendaMes = renda > 0 ? Math.round((renda * (pctAno / 100)) * 100) / 100 : 0;
    if (qtd <= 0) {
      return {
        serieIndex: idx,
        qtd: 0,
        pctMae: pctAno,
        capacidadeRenda: capRendaMes,
        rateioFluxoGlobal: 0,
        parcelaBrutaFinal: 0,
        parcelaLiquida: 0,
        subtotalLiquido: 0
      };
    }
    // Rateio proporcional entre as séries ativas
    const pesoSerie = activePosWeights[idx];
    const pctRateioSerie = sumActiveWeights > 0 ? (pesoSerie / sumActiveWeights) : 0;
    const volumeSerie = fluxoDistribuirComITBI * pctRateioSerie;
    const parcelaBrutaFinal = qtd > 0 ? (volumeSerie / qtd) : 0;
    const parcelaLiquida = Math.max(0, Math.round((parcelaBrutaFinal - parcelaMensalITBIExato) * 100) / 100);
    const subtotalLiquido = Math.round(parcelaLiquida * qtd * 100) / 100;

    return {
      serieIndex: idx,
      qtd,
      pctMae: pctAno,
      capacidadeRenda: capRendaMes,
      rateioFluxoGlobal: Math.round(parcelaBrutaFinal * 100) / 100,
      parcelaBrutaFinal: Math.round(parcelaBrutaFinal * 100) / 100,
      parcelaLiquida,
      subtotalLiquido
    };
  });

  const subtotalObraLiquido = obraSeries.reduce((acc, s) => acc + s.subtotalLiquido, 0);
  const subtotalPosLiquido = posSeries.reduce((acc, s) => acc + s.subtotalLiquido, 0);
  const somaSubtotaisLiquidos = Math.round((subtotalObraLiquido + subtotalPosLiquido) * 100) / 100;
  const totalProSolutoGerado = somaSubtotaisLiquidos;

  // Absorve o resíduo de arredondamento de centavos no Ato Residual padrão para fechar 100% exato
  const itbiParceladoTotal = mesesTotaisGeral * parcelaMensalITBI;
  if (params.atoManual === undefined) {
    atoResidual = atoResidualPadrao;
  }

  const distribuidoTotal = Math.round((atoResidual + (params.atoITBI || 0) + somaSubtotaisLiquidos + itbiParceladoTotal + atoPremiado) * 100) / 100;
  const totalComITBI = sinalComITBI;
  const sinalLiquidoTotal = Math.max(0, sinalSemITBI - atoPremiado);

  return {
    baseCalculo,
    maxFluxoGeral,
    tetoPosGlobal,
    parcelaMensalITBI,
    mesesTotaisGeral,
    obraSeries,
    posSeries,
    subtotalObraLiquido,
    subtotalPosLiquido,
    atoResidual,
    atoPremiado,
    atoBruto,
    totalProSolutoGerado,
    sinalLiquidoTotal,
    distribuidoTotal,
    totalComITBI
  };
}

/**
 * Função principal de cálculo e simulação de fluxo linear (Sem loop e sem Ato Premiado)
 */
export function calcularSimulacaoFluxo(params: FinancialParams): SimulationResult {
  const precoTabela = params.precoTabela || 0;
  const avaliacaoBanco = params.avaliacaoBanco || 0;
  const renda = params.renda || 0;
  const subsidio = params.subsidio || 0;
  const fgts = params.fgts || 0;
  const financiamentoAprovado = params.financiamentoAprovado !== undefined ? params.financiamentoAprovado : Infinity;
  const ltvMaximo = params.ltvMaximo !== undefined ? params.ltvMaximo : 0.80;
  const itbiRegistro = params.itbiRegistro || 0;
  const percentualRiscoImovel = params.percentualRiscoImovel !== undefined ? params.percentualRiscoImovel : 20;
  const percentualRiscoRenda = params.percentualRiscoRenda !== undefined ? params.percentualRiscoRenda : 35;
  const prazoMeses = params.prazoMeses || 60;
  const pisoSinal = params.sinalMinimo !== undefined && params.sinalMinimo > 0 ? params.sinalMinimo : 2000;

  // 1. Taxa de juros mensal
  const jurosMensal = params.taxaJurosMensal !== undefined
      ? (params.taxaJurosMensal || 0) / 100
      : prazoMeses <= 60 ? 0.019 : 0.022;

  // 2. Cascata de Financiamento Máximo e Total Negociado
  let baseFinanc = Math.min(financiamentoAprovado, ltvMaximo * avaliacaoBanco);
  if (baseFinanc + subsidio + fgts > avaliacaoBanco && avaliacaoBanco > 0) {
    baseFinanc = Math.max(0, avaliacaoBanco - subsidio - fgts);
  }
  const maxFinanciamento = Math.max(0, Math.min(baseFinanc, Math.max(0, precoTabela - pisoSinal)));

  const totalNegociado = Math.min(
    subsidio + fgts + maxFinanciamento,
    subsidio + fgts + Math.max(0, precoTabela - pisoSinal)
  );

  // 3. Teto de Renda (35% da renda como PMT máximo)
  const pmtMaxRenda = renda * (percentualRiscoRenda / 100);
  const tetoRenda = calcularValorPresente(pmtMaxRenda, jurosMensal, prazoMeses);

  // 4. Laço de Equalização Circular (Ato Premiado <-> Ato Efetivo)
  let desconto = 0;
  let erro = 1;
  let iteracoes = 0;

  const aportesExtras = params.aportesExtras || 0;
  const atoManual = params.atoManual || 0;

  let sinalTotal = 0;
  let totalComITBI = 0;
  const maiorBase = Math.max(precoTabela, avaliacaoBanco);
  let baseRiscoImovel = 0;
  let tetoImovel = 0;
  let proSolutoMaximo = 0;
  let atoSugerido = 0;
  let atoEfetivo = 0;

  while (erro > 0.005 && iteracoes < 100) {
    sinalTotal = Math.max(0, precoTabela - totalNegociado - desconto);
    totalComITBI = sinalTotal + itbiRegistro;
    
    baseRiscoImovel = Math.max(0, maiorBase + itbiRegistro - desconto);
    tetoImovel = baseRiscoImovel * (percentualRiscoImovel / 100);
    
    proSolutoMaximo = Math.min(tetoImovel, tetoRenda, totalComITBI);

    // O Ato é ESTRITAMENTE a diferença entre a dívida e o risco máximo suportado.
    // A Taxa Bancária NÃO ENTRA nesta conta.
    atoSugerido = Math.max(totalComITBI - proSolutoMaximo - aportesExtras, pisoSinal);
    atoEfetivo = atoManual > 0 ? Math.max(atoManual, atoSugerido) : atoSugerido;

    // Regra do Desconto (Ato Premiado)
    let novoDesconto = 0;
    if (atoEfetivo > 50000) {
      novoDesconto = 5000;
    } else if (atoEfetivo >= 5000 && atoEfetivo <= 50000) {
      novoDesconto = atoEfetivo * 0.10;
    } else {
      novoDesconto = 0;
    }

    erro = Math.abs(novoDesconto - desconto);
    desconto = novoDesconto;
    iteracoes++;
  }

  // 5. Pró-Soluto Efetivo e Cálculo da Parcela (Price)
  const proSolutoTotal = Math.max(0, totalComITBI - atoEfetivo - aportesExtras);
  const proSolutoRestante = Math.max(0, proSolutoTotal - itbiRegistro);

  // A dedução da taxa bancária (0,2003%) ocorre EXCLUSIVAMENTE na base de cálculo da Tabela Price (PMT)
  const taxaBancaria = proSolutoTotal * 0.002003;
  const baseLiquidaParcela = Math.max(0, proSolutoTotal - taxaBancaria);
  
  const valorParcela = calcularPricePMT(baseLiquidaParcela, jurosMensal, prazoMeses);

  const comprometimentoRenda = renda > 0 ? (valorParcela / renda) * 100 : 0;
  const riscoImovelEfetivo = baseRiscoImovel > 0 ? (proSolutoTotal / baseRiscoImovel) * 100 : 0;

  return {
    maxFinanciamento,
    totalNegociado,
    descontoAtoPremiado: desconto,
    sinalTotal,
    totalComITBI,
    tetoImovel,
    tetoRenda,
    proSolutoMaximo,
    atoSugerido,
    atoEfetivo,
    proSolutoRestante,
    proSolutoTotal,
    baseParcelar: proSolutoTotal,
    taxaBancaria,
    baseLiquida: baseLiquidaParcela,
    valorParcela,
    comprometimentoRenda,
    riscoImovelEfetivo,
    conferenciaValida: true,
  };
}

export function calculatePolicyRiskValues(
  prod: Product,
  cond: CommercialCondition,
  clientIncome: number,
  overrideNumParcelas?: number,
  overridePrice?: number,
  overrideITBI?: number,
  overrideEvaluation?: number,
  overrideAtoPremiado?: number, // Mantido na interface para compatibilidade, mas ignorado
  maxFinanciamentoBanco: number = Infinity,
  subsidy: number = 0,
  fgts: number = 0,
  ltvMaximo: number = 0.80
) {
  const numParcelas = overrideNumParcelas || cond.numParcelas || 60;
  
  const riscoRendaPct = cond.riscoRendaPct !== undefined ? cond.riscoRendaPct : 35;
  const percentualPolitica = cond.riscoImovelPct !== undefined ? cond.riscoImovelPct : 20;

  const meses1 = cond.mesesTabela1 || 36;
  const taxa1 = cond.taxaJuros1 !== undefined ? cond.taxaJuros1 : 0.0;
  const taxa2 = cond.taxaJuros2 !== undefined ? cond.taxaJuros2 : 1.9;
  const appliedRatePct = (numParcelas <= meses1) ? taxa1 : taxa2;

  let propertyPrice = overridePrice !== undefined ? overridePrice : 0;
  let propertyITBI = overrideITBI !== undefined ? overrideITBI : 0;
  let propertyEvaluation = overrideEvaluation !== undefined ? overrideEvaluation : 0;

  if (overridePrice === undefined && prod.tableInfo && prod.tableInfo.rows && prod.tableInfo.rows.length > 0) {
    const firstRow = prod.tableInfo.rows[0];
    if (firstRow[7] !== undefined) propertyPrice = parseCurrency(firstRow[7]);
    if (firstRow[8] !== undefined) propertyITBI = parseCurrency(firstRow[8]);
    if (firstRow[6] !== undefined) propertyEvaluation = parseCurrency(firstRow[6]);
  }

  const sinalMinimoNum = cond.sinalMinimo ? parseCurrency(cond.sinalMinimo) : 2000;

  const isMorar = cond.name ? cond.name.toLowerCase().includes('morar') : false;

  if (isMorar) {
    const mesesObraParam = cond.mesesObra ?? 33;
    const mesesPosParam = cond.mesesPos ?? 27;
    const proSolutoGlobalParam = cond.percMaxProSolutoGlobal ?? cond.riscoImovelPct ?? 17.0;
    const posObraGlobalParam = cond.percMaxPosObra ?? cond.riscoPosPct ?? 8.0;

    const globalPct: [number, number, number, number, number, number] = [
      cond.globalSerie1Pct ?? 30.0,
      cond.globalSerie2Pct ?? 25.0,
      cond.globalSerie3Pct ?? 20.0,
      cond.globalSerie4Pct ?? 15.0,
      cond.globalSerie5Pct ?? 10.0,
      cond.globalSerie6Pct ?? 5.0
    ];

    const morarEngine = calculateMorarFlowEngine({
      precoTabela: propertyPrice || 0,
      avaliacaoBanco: propertyEvaluation || 0,
      itbiRegistro: propertyITBI || 0,
      renda: clientIncome || 0,
      financiamento: maxFinanciamentoBanco > 0 && maxFinanciamentoBanco !== Infinity ? maxFinanciamentoBanco : 0,
      subsidio: subsidy || 0,
      fgts: fgts || 0,
      percentualRiscoGeral: proSolutoGlobalParam,
      percentualRiscoPos: posObraGlobalParam,
      mesesObra: mesesObraParam,
      mesesPos: mesesPosParam,
      globalSeriesPct: globalPct,
      sinalMinimo: sinalMinimoNum > 0 ? sinalMinimoNum : 2000,
      isAtoPremiadoEnabled: true
    });

    const simulacao: SimulationResult = {
      maxFinanciamento: maxFinanciamentoBanco > 0 && maxFinanciamentoBanco !== Infinity ? maxFinanciamentoBanco : 0,
      totalNegociado: (maxFinanciamentoBanco > 0 && maxFinanciamentoBanco !== Infinity ? maxFinanciamentoBanco : 0) + subsidy + fgts,
      descontoAtoPremiado: morarEngine.atoPremiado,
      sinalTotal: morarEngine.sinalLiquidoTotal,
      totalComITBI: morarEngine.totalComITBI,
      tetoImovel: morarEngine.maxFluxoGeral,
      tetoRenda: 0,
      proSolutoMaximo: morarEngine.maxFluxoGeral,
      atoSugerido: morarEngine.atoResidual,
      atoEfetivo: morarEngine.atoResidual,
      proSolutoRestante: morarEngine.totalProSolutoGerado,
      proSolutoTotal: morarEngine.totalProSolutoGerado,
      baseParcelar: morarEngine.totalProSolutoGerado,
      taxaBancaria: 0,
      baseLiquida: morarEngine.totalProSolutoGerado,
      valorParcela: morarEngine.obraSeries[0]?.parcelaLiquida || 0,
      comprometimentoRenda: 0,
      riscoImovelEfetivo: proSolutoGlobalParam,
      conferenciaValida: true
    };

    return {
      rendaVal: (clientIncome || 0) * (riscoRendaPct / 100),
      numParcelas: morarEngine.mesesTotaisGeral,
      appliedRatePct: 0,
      vpVal: morarEngine.maxFluxoGeral,
      propertyPrice: propertyPrice || 0,
      propertyEvaluation: propertyEvaluation || 0,
      propertyITBI: propertyITBI || 0,
      
      atoPremiado: morarEngine.atoPremiado,
      maiorBase: Math.max(propertyPrice || 0, propertyEvaluation || 0),
      baseAjustada: morarEngine.baseCalculo,
      baseComITBI: morarEngine.baseCalculo,
      baseBruta: morarEngine.baseCalculo,
      
      proSolutoTotalComITBI: morarEngine.distribuidoTotal,
      proSolutoTotal: morarEngine.totalProSolutoGerado,
      proSolutoRestante: morarEngine.totalProSolutoGerado,
      sinalSugerido: morarEngine.atoResidual,
      atoImovel: morarEngine.atoResidual,
      pagamentoAto: morarEngine.atoResidual,
      sinalTotal: morarEngine.totalComITBI - (propertyITBI || 0),
      totalComITBI: morarEngine.totalComITBI,
      taxaBancaria: 0,
      riscoUtilizadoTX: morarEngine.totalProSolutoGerado,
      baseCalculoParcela: morarEngine.totalProSolutoGerado,
      parcelaPrice: morarEngine.obraSeries[0]?.parcelaLiquida || 0,

      totalBaseImovel: morarEngine.baseCalculo,
      riscoImovelVal: morarEngine.maxFluxoGeral,
      minRiskVal: morarEngine.maxFluxoGeral,

      morarEngine,
      simulacao
    };
  }

  const simulacao = calcularSimulacaoFluxo({
    precoTabela: propertyPrice || 0,
    avaliacaoBanco: propertyEvaluation || 0,
    renda: clientIncome || 0,
    subsidio: subsidy || 0,
    fgts: fgts || 0,
    financiamentoAprovado: maxFinanciamentoBanco > 0 ? maxFinanciamentoBanco : Infinity,
    ltvMaximo: ltvMaximo || 0.80,
    itbiRegistro: propertyITBI || 0,
    percentualRiscoImovel: percentualPolitica,
    percentualRiscoRenda: riscoRendaPct,
    prazoMeses: numParcelas,
    taxaJurosMensal: appliedRatePct,
    sinalMinimo: sinalMinimoNum > 0 ? sinalMinimoNum : 2000,
  });

  return {
    rendaVal: (clientIncome || 0) * (riscoRendaPct / 100),
    numParcelas,
    appliedRatePct,
    vpVal: simulacao.tetoRenda || 0,
    propertyPrice: propertyPrice || 0,
    propertyEvaluation: propertyEvaluation || 0,
    propertyITBI: propertyITBI || 0,
    
    atoPremiado: simulacao.descontoAtoPremiado || 0,
    maiorBase: Math.max(propertyPrice || 0, propertyEvaluation || 0),
    baseAjustada: Math.max(propertyPrice || 0, propertyEvaluation || 0) + (propertyITBI || 0) - (simulacao.descontoAtoPremiado || 0),
    baseComITBI: Math.max(propertyPrice || 0, propertyEvaluation || 0) + (propertyITBI || 0) - (simulacao.descontoAtoPremiado || 0),
    baseBruta: Math.max(propertyPrice || 0, propertyEvaluation || 0) + (propertyITBI || 0) - (simulacao.descontoAtoPremiado || 0),
    
    proSolutoTotalComITBI: simulacao.proSolutoTotal || 0,
    proSolutoTotal: simulacao.proSolutoTotal || 0,
    proSolutoRestante: simulacao.proSolutoRestante || 0,
    sinalSugerido: simulacao.atoSugerido || 0,
    atoImovel: simulacao.atoEfetivo || 0,
    pagamentoAto: simulacao.atoEfetivo || 0,
    sinalTotal: simulacao.sinalTotal || 0,
    totalComITBI: simulacao.totalComITBI || 0,
    taxaBancaria: simulacao.taxaBancaria || 0,
    riscoUtilizadoTX: simulacao.baseLiquida || 0,
    baseCalculoParcela: simulacao.baseLiquida || 0,
    parcelaPrice: simulacao.valorParcela || 0,

    totalBaseImovel: Math.max(propertyPrice || 0, propertyEvaluation || 0) + (propertyITBI || 0) - (simulacao.descontoAtoPremiado || 0),
    riscoImovelVal: simulacao.tetoImovel || 0,
    minRiskVal: simulacao.proSolutoMaximo || 0,

    simulacao
  };
}
