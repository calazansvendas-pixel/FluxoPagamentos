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
        serie1Meses: 12,
        serie2Meses: 12,
        serie3Meses: 12,
        serie4Meses: 12,
        serie5Meses: 12,
        serie6Meses: 12,
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

/**
 * Resolve o ponto fixo ato* = base - calcularDescontoAtoPremiado(ato*), onde
 * "base" é o valor disponível para o Ato antes do desconto (ex: preço - subsídio).
 * Necessário porque o desconto do Ato Premiado é escalonado pelo próprio valor do
 * Ato, então não dá para simplesmente subtrair um desconto fixo de "base".
 */
export function resolverTetoAtoComDesconto(base: number, isAtoPremiadoEnabled: boolean): number {
  const baseValida = Math.max(0, base || 0);
  if (!isAtoPremiadoEnabled) {
    return Math.round(baseValida * 100) / 100;
  }
  // Hipótese: ato* >= 50.000 (desconto fixo de R$ 5.000,00)
  const tentativaFlat = baseValida - 5000;
  if (tentativaFlat >= 50000) {
    return Math.round(tentativaFlat * 100) / 100;
  }
  // Hipótese: 5.000 <= ato* < 50.000 (desconto de 10% sobre o próprio Ato)
  const tentativaPct = baseValida / 1.10;
  if (tentativaPct >= 5000 && tentativaPct < 50000) {
    return Math.round(tentativaPct * 100) / 100;
  }
  // Hipótese: ato* < 5.000 (sem desconto)
  return Math.max(0, Math.round(baseValida * 100) / 100);
}

export interface MorarMonthsDecomposition {
  obra: number[];
  pos: number[];
}

/**
 * Decompõe os meses de Obra e Pós-Obra em baldes contínuos, com transbordo
 * (spillover) de um balde para o próximo. Cada balde tem sua PRÓPRIA capacidade
 * de meses (baldeCapacidades, padrão 12 cada, configurável por balde na política
 * de crédito) — não é um tamanho fixo de 12 para todos. Um balde dividido pela
 * fronteira Obra/Pós-Obra continua sendo o MESMO balde (mesmo percentual) nas
 * duas fases; só muda quantos desses meses caem em cada fase.
 */
export function decomposeMorarMonths(
  mesesObra: number,
  mesesPos: number,
  baldeCapacidades?: number[]
): MorarMonthsDecomposition {
  const mObra = Math.max(0, mesesObra || 0);
  const mPos = Math.max(0, mesesPos || 0);
  const capacidades = [0, 1, 2, 3, 4, 5].map(idx => {
    const cap = baldeCapacidades?.[idx];
    return cap && cap > 0 ? cap : 12;
  });

  const obra = [0, 0, 0, 0, 0, 0];
  const pos = [0, 0, 0, 0, 0, 0];

  let remainingObra = mObra;
  let currentBucket = 0;

  // Fill Obra buckets
  while (remainingObra > 0 && currentBucket < 6) {
    const toFill = Math.min(capacidades[currentBucket], remainingObra);
    obra[currentBucket] = toFill;
    remainingObra -= toFill;
    if (obra[currentBucket] === capacidades[currentBucket]) {
      currentBucket++;
    }
  }

  // Fill Pos buckets, starting at the current bucket (which might be partially filled by Obra)
  let remainingPos = mPos;
  while (remainingPos > 0 && currentBucket < 6) {
    const spaceInBucket = capacidades[currentBucket] - obra[currentBucket];
    const toFill = Math.min(spaceInBucket, remainingPos);
    pos[currentBucket] = toFill;
    remainingPos -= toFill;
    if (pos[currentBucket] + obra[currentBucket] === capacidades[currentBucket]) {
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
  serieMesesCapacidades?: [number, number, number, number, number, number]; // Meses de cada balde (padrão 12 cada)
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
  baseCalculoComITBI: number;
  maxRiscoObra: number;
  maxRiscoPos: number;
  totalProSolutoMaximo: number;
  maxFluxoGeral: number;
  tetoPosGlobal: number;
  parcelaMensalITBI: number;
  mesesTotaisGeral: number;
  obraSeries: MorarSerieResult[];
  posSeries: MorarSerieResult[];
  subtotalObraLiquido: number;
  subtotalPosLiquido: number;
  totalObraComITBI: number;
  totalPosComITBI: number;
  atoResidual: number;
  atoPremiado: number;
  atoBruto: number;
  totalProSolutoGerado: number;
  sinalLiquidoTotal: number;
  distribuidoTotal: number;
  totalComITBI: number;
}

/**
 * Motor de cálculo completo da condição Sinal c/ Morar - Linha do Tempo Contínua e Distribuição Oficial das Séries (Fórmula Exata do Excel)
 */
export function calculateMorarFlowEngine(params: MorarEngineParams): MorarEngineResult {
  const precoTabela = params.precoTabela || 0;
  const avaliacaoBanco = params.avaliacaoBanco && params.avaliacaoBanco > 0 ? params.avaliacaoBanco : precoTabela;
  const precoBase = Math.max(precoTabela, avaliacaoBanco);
  const itbiRegistro = params.itbiRegistro || 0;
  const renda = params.renda || 0;
  const financiamento = params.financiamento || 0;
  const subsidio = params.subsidio || 0;
  const fgts = params.fgts || 0;
  const mesesObra = params.mesesObra !== undefined ? params.mesesObra : 33;
  const mesesPos = params.mesesPos !== undefined ? params.mesesPos : 27;
  const isAtoPremiadoEnabled = params.isAtoPremiadoEnabled !== undefined ? params.isAtoPremiadoEnabled : true;
  const isAtoZerado = params.isAtoZerado === true;

  // 1. Fatiamento do Tempo (Cascata Contínua de Baldes, cada um com sua própria capacidade de meses):
  const { obra: mObra, pos: mPos } = decomposeMorarMonths(mesesObra, mesesPos, params.serieMesesCapacidades);
  const mesesTotaisGeral = mObra.reduce((a, b) => a + b, 0) + mPos.reduce((a, b) => a + b, 0);

  // ITBI Mensal = ITBI Restante a parcelar / (meses Obra + meses Pós)
  const itbiRestante = Math.max(0, itbiRegistro - (params.atoITBI || 0));
  const parcelaMensalITBIExato = (mesesTotaisGeral > 0 && itbiRestante > 0)
    ? (itbiRestante / mesesTotaisGeral)
    : 0;
  const parcelaMensalITBI = Math.round(parcelaMensalITBIExato * 100) / 100;

  // Sinal Total s/ ITBI = Preço Tabela - (Financiamento + Subsídio + FGTS)
  const totalNegociado = financiamento + subsidio + fgts;
  const sinalSemITBI = Math.max(0, precoTabela - totalNegociado);
  const sinalComITBI = Math.max(0, sinalSemITBI + itbiRegistro);

  const pctMaxProSoluto = (params.percentualRiscoGeral !== undefined ? params.percentualRiscoGeral : 17.0) / 100;
  // Risco Max Obra não é mais um percentual independente: é o resíduo de
  // (Total Pró-Soluto - Risco Max Pós), calculado mais abaixo.
  const pctMaxPos = (params.percentualRiscoPos !== undefined ? params.percentualRiscoPos : 5.1) / 100;

  // 2. Determinação exata de Desconto Comercial / Desconto Ato, Base Líquida com ITBI e Ato Residual
  let descontoAto = 0;
  let atoResidual = 0;
  let baseCalculoComITBI = 0;
  let totalProSolutoMaximo = 0;

  if (params.atoManual !== undefined && params.atoManual > 0) {
    atoResidual = params.atoManual;
    descontoAto = (!isAtoZerado && isAtoPremiadoEnabled) ? calcularDescontoAtoPremiado(atoResidual) : 0;
    baseCalculoComITBI = Math.max(0, Math.round(((precoTabela - descontoAto) + itbiRegistro) * 100) / 100);
    totalProSolutoMaximo = Math.round(baseCalculoComITBI * pctMaxProSoluto * 100) / 100;
  } else if (params.atoManual === 0 || isAtoZerado) {
    atoResidual = 0;
    descontoAto = 0;
    baseCalculoComITBI = Math.max(0, Math.round((precoTabela + itbiRegistro) * 100) / 100);
    totalProSolutoMaximo = sinalComITBI;
  } else if (!isAtoPremiadoEnabled) {
    descontoAto = 0;
    baseCalculoComITBI = Math.max(0, Math.round((precoTabela + itbiRegistro) * 100) / 100);
    totalProSolutoMaximo = Math.round(baseCalculoComITBI * pctMaxProSoluto * 100) / 100;
    const atoCalc = (sinalSemITBI + itbiRegistro) - totalProSolutoMaximo;
    const sinalMinimoFloorSemPremio = params.sinalMinimo && params.sinalMinimo > 0 ? params.sinalMinimo : 0;
    atoResidual = Math.max(sinalMinimoFloorSemPremio, Math.round(atoCalc * 100) / 100);
  } else {
    // Resolução Circular / Iterativa Exata do Excel da Morar:
    // Base Líquida com ITBI = (Preço Tabela - Desconto Ato) + ITBI Total
    // Total Pró-Soluto = Base Líquida * 17%
    // Ato Imóvel = (Sinal Total + ITBI Total) - Total Pró-Soluto - Desconto Ato
    //
    // Hipótese 1: Ato >= 50.000 -> Desconto Fixo de R$ 5.000,00
    const baseCom5k = (precoTabela - 5000) + itbiRegistro;
    const proSoluto5k = Math.round(baseCom5k * pctMaxProSoluto * 100) / 100;
    const atoCom5k = (sinalSemITBI + itbiRegistro) - proSoluto5k - 5000;
    const sinalMinimoFloor = params.sinalMinimo && params.sinalMinimo > 0 ? params.sinalMinimo : 0;

    if (atoCom5k >= 50000) {
      descontoAto = 5000;
      atoResidual = Math.max(sinalMinimoFloor, Math.round(atoCom5k * 100) / 100);
      baseCalculoComITBI = Math.round(baseCom5k * 100) / 100;
      totalProSolutoMaximo = proSoluto5k;
    } else {
      // Hipótese 2: Ato >= 5.000 e < 50.000 -> Desconto de 10% sobre o Ato
      // Fórmula analítica: ato = [(Sinal + ITBI) - (Preço Tabela + ITBI) * pctMaxProSoluto] / (1 + 0.10 - (0.10 * pctMaxProSoluto))
      const denom = 1 + 0.10 - (0.10 * pctMaxProSoluto);
      const num = (sinalSemITBI + itbiRegistro) - ((precoTabela + itbiRegistro) * pctMaxProSoluto);
      const atoAnalitico = denom > 0 ? num / denom : 0;

      if (atoAnalitico >= 5000 && atoAnalitico < 50000) {
        atoResidual = Math.round(atoAnalitico * 100) / 100;
        descontoAto = Math.round(atoResidual * 0.10 * 100) / 100;
        baseCalculoComITBI = Math.round(((precoTabela - descontoAto) + itbiRegistro) * 100) / 100;
        totalProSolutoMaximo = Math.round(baseCalculoComITBI * pctMaxProSoluto * 100) / 100;

        // Ajuste de centavos fino para convergência perfeita
        atoResidual = Math.max(0, Math.round(((sinalSemITBI + itbiRegistro) - totalProSolutoMaximo - descontoAto) * 100) / 100);
        descontoAto = Math.round(atoResidual * 0.10 * 100) / 100;
        baseCalculoComITBI = Math.round(((precoTabela - descontoAto) + itbiRegistro) * 100) / 100;
        totalProSolutoMaximo = Math.round(baseCalculoComITBI * pctMaxProSoluto * 100) / 100;
        atoResidual = Math.max(sinalMinimoFloor, Math.round(((sinalSemITBI + itbiRegistro) - totalProSolutoMaximo - descontoAto) * 100) / 100);
      } else {
        // Hipótese 3: Ato < 5.000 -> Desconto de R$ 0,00 (Ex: Unidade B-603)
        // Base Líquida com ITBI = (Preço Tabela - 0) + ITBI Total
        // Total Pró-Soluto (17,00%) = Base Líquida * 0.17
        // Ato Imóvel = (Sinal Total + ITBI Total) - Total Pró-Soluto - Desconto Ato
        descontoAto = 0;
        baseCalculoComITBI = Math.round((precoTabela + itbiRegistro) * 100) / 100;
        totalProSolutoMaximo = Math.round(baseCalculoComITBI * pctMaxProSoluto * 100) / 100;
        const atoCalc = (sinalSemITBI + itbiRegistro) - totalProSolutoMaximo;
        atoResidual = Math.max(sinalMinimoFloor, Math.round(atoCalc * 100) / 100);
      }
    }
  }

  // Fluxo Pró-Soluto Efetivo com ITBI:
  // O Ato (Imóvel), o Ato Premiado (desconto comercial) e o ITBI no Ato são rigorosamente descontados do Pró-Soluto
  const saldoAtoEfetivo = isAtoZerado ? 0 : atoResidual;
  const saldoDescontoAto = isAtoZerado ? 0 : descontoAto;
  const saldoAtoITBI = params.atoITBI || 0;

  // 3. Tetos e Travas de Pró-Soluto (fórmula exata da planilha de referência):
  // Total Pró-Soluto (17,00% c/ ITBI) = Base c/ ITBI * 0.17
  // Risco Max Pós = (Base c/ ITBI - Desconto Ato) * pctMaxPos
  // Risco Max Obra = Total Pró-Soluto - Risco Max Pós (resíduo, não é um percentual independente)
  const maxRiscoPos = Math.round((baseCalculoComITBI - saldoDescontoAto) * pctMaxPos * 100) / 100;
  const maxRiscoObra = Math.round((totalProSolutoMaximo - maxRiscoPos) * 100) / 100;

  const fluxoProSolutoComITBI = Math.max(
    0,
    Math.round((sinalComITBI - saldoAtoEfetivo - saldoDescontoAto - saldoAtoITBI) * 100) / 100
  );

  const sinalLiquidoTotal = Math.max(0, Math.round((sinalSemITBI - saldoDescontoAto) * 100) / 100);
  const baseCalculo = precoBase;
  const maxFluxoGeral = fluxoProSolutoComITBI;
  const tetoPosGlobal = maxRiscoPos;

  // 4. Distribuição das Séries Morar em cascata (fórmula exata da planilha de referência):
  // Cada balde de 12 meses tem um peso (30%/25%/20%/15%/10%/5%). A série que atravessa a
  // fronteira Obra/Pós-Obra (ex: balde 3 com 9 meses em Obra + 3 meses em Pós) mantém o MESMO
  // peso — não reinicia a numeração.
  //
  // Isso acontece em duas etapas (cascata): primeiro cada balde vira uma participação
  // percentual DENTRO DA SUA FASE (peso×meses do balde ÷ peso×meses de todos os baldes
  // daquela fase); essa participação é então aplicada sobre a base financeira daquela
  // fase — e a fase Pós-Obra tem uma base própria, travada em `% Max Pós-Obra` da
  // política (maxRiscoPos), nunca podendo ultrapassá-la. Se a divisão "natural" (pelo
  // peso combinado das duas fases) daria à Pós-Obra mais do que esse teto, o excedente
  // fica com a Obra — mantendo a proporção original entre os baldes de cada fase.
  const seriesWeights = (params.globalSeriesPct && params.globalSeriesPct.length === 6)
    ? params.globalSeriesPct.map(p => (p || 0) / 100)
    : [0.30, 0.25, 0.20, 0.15, 0.10, 0.05];

  const obraWeightedTotal = seriesWeights.reduce((sum, w, idx) => sum + w * (mObra[idx] || 0), 0);
  const posWeightedTotal = seriesWeights.reduce((sum, w, idx) => sum + w * (mPos[idx] || 0), 0);
  const combinedWeightedTotal = obraWeightedTotal + posWeightedTotal;

  const naturalPosMoney = combinedWeightedTotal > 0
    ? (posWeightedTotal / combinedWeightedTotal) * fluxoProSolutoComITBI
    : 0;
  const totalPosMoney = Math.max(0, Math.min(naturalPosMoney, maxRiscoPos));
  const totalObraMoney = Math.max(0, fluxoProSolutoComITBI - totalPosMoney);

  const obraRatesBrutas = seriesWeights.map(w => obraWeightedTotal > 0 ? (w / obraWeightedTotal) * totalObraMoney : 0);
  const posRatesBrutas = seriesWeights.map(w => posWeightedTotal > 0 ? (w / posWeightedTotal) * totalPosMoney : 0);

  const toLiquida = (brutaExata: number) => {
    if (brutaExata <= 0) return 0;
    const liquidaExata = brutaExata - parcelaMensalITBIExato;
    return Math.max(0, Math.round(liquidaExata * 100) / 100);
  };
  const obraRatesLiquidas = obraRatesBrutas.map(toLiquida);
  const posRatesLiquidas = posRatesBrutas.map(toLiquida);

  // Obra:
  const obraSeries: MorarSerieResult[] = mObra.map((qtd, idx) => {
    const pctAno = (params.globalSeriesPct && params.globalSeriesPct[idx]) || [30, 25, 20, 15, 10, 5][idx] || 0;
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
    const parcelaLiquida = obraRatesLiquidas[idx] || 0;
    const parcelaBrutaFinal = Math.round(obraRatesBrutas[idx] * 100) / 100;
    const subtotalLiquido = Math.round(parcelaLiquida * qtd * 100) / 100;

    return {
      serieIndex: idx,
      qtd,
      pctMae: pctAno,
      capacidadeRenda: capRendaMes,
      rateioFluxoGlobal: parcelaBrutaFinal,
      parcelaBrutaFinal,
      parcelaLiquida,
      subtotalLiquido
    };
  });

  // Pós-Obra:
  const posSeries: MorarSerieResult[] = mPos.map((qtd, idx) => {
    const pctAno = (params.globalSeriesPct && params.globalSeriesPct[idx]) || [30, 25, 20, 15, 10, 5][idx] || 0;
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
    const parcelaLiquida = posRatesLiquidas[idx] || 0;
    const parcelaBrutaFinal = Math.round(posRatesBrutas[idx] * 100) / 100;
    const subtotalLiquido = Math.round(parcelaLiquida * qtd * 100) / 100;

    return {
      serieIndex: idx,
      qtd,
      pctMae: pctAno,
      capacidadeRenda: capRendaMes,
      rateioFluxoGlobal: parcelaBrutaFinal,
      parcelaBrutaFinal,
      parcelaLiquida,
      subtotalLiquido
    };
  });

  const subtotalObraLiquido = Math.round(obraSeries.reduce((acc, s) => acc + s.subtotalLiquido, 0) * 100) / 100;
  const subtotalPosLiquido = Math.round(posSeries.reduce((acc, s) => acc + s.subtotalLiquido, 0) * 100) / 100;
  const totalProSolutoGerado = Math.round((subtotalObraLiquido + subtotalPosLiquido) * 100) / 100;

  const itbiObraTotal = Math.round(obraSeries.reduce((acc, s) => acc + s.qtd, 0) * parcelaMensalITBI * 100) / 100;
  const itbiPosTotal = Math.round(posSeries.reduce((acc, s) => acc + s.qtd, 0) * parcelaMensalITBI * 100) / 100;

  // totalObraMoney/totalPosMoney (seção 4) já respeitam o teto de % Max Pós-Obra em
  // qualquer cenário — não é mais preciso um atalho separado para o caso "fluxo no máximo".
  const totalObraComITBI = Math.round((subtotalObraLiquido + itbiObraTotal) * 100) / 100;
  const totalPosComITBI = Math.round((subtotalPosLiquido + itbiPosTotal) * 100) / 100;

  const itbiParceladoTotal = Math.round(mesesTotaisGeral * parcelaMensalITBI * 100) / 100;
  const atoPremiado = descontoAto;
  const atoBruto = Math.round((atoResidual + atoPremiado) * 100) / 100;

  const distribuidoTotal = Math.round(
    (atoResidual + (params.atoITBI || 0) + totalProSolutoGerado + itbiParceladoTotal + atoPremiado) * 100
  ) / 100;
  const totalComITBI = sinalComITBI;

  return {
    baseCalculo,
    baseCalculoComITBI,
    maxRiscoObra,
    maxRiscoPos,
    totalProSolutoMaximo,
    maxFluxoGeral,
    tetoPosGlobal,
    parcelaMensalITBI,
    mesesTotaisGeral,
    obraSeries,
    posSeries,
    subtotalObraLiquido,
    subtotalPosLiquido,
    totalObraComITBI,
    totalPosComITBI,
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
      baseAjustada: morarEngine.baseCalculoComITBI,
      baseComITBI: morarEngine.baseCalculoComITBI,
      baseBruta: morarEngine.baseCalculoComITBI,
      
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

      totalBaseImovel: morarEngine.baseCalculoComITBI,
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
