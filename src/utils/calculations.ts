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
      : ['Sinal em 48X c/ Morar', 'Sinal em 72X c/ Banco Direto'];
    
    prod.conditions = opts.map((optName, idx) => ({
      id: `cond_${prod.id}_${idx + 1}`,
      name: optName,
      numParcelas: prod.numParcelas || 60,
      sinalMinimo: prod.sinalMinimo || 'R$ 2.000,00',
      riscoRendaPct: prod.riscoRendaPct !== undefined ? prod.riscoRendaPct : 30,
      riscoImovelPct: prod.riscoImovelPct !== undefined ? prod.riscoImovelPct : 20,
      mesesTabela1: 36,
      taxaJuros1: 0.0,
      mesesTabela2: 72,
      taxaJuros2: 1.9,
      policy: prod.policy || `POLÍTICA COMERCIAL SINAL ${optName.toUpperCase()}:\n- Comissão padrão: 4% apartada na proposta.\n- Entrada mínima conforme negociação.\n- Sujeito à análise financeira.`
    }));
  }
  return prod;
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

  // 1. Taxa de juros mensal
  const jurosMensal = params.taxaJurosMensal !== undefined
      ? (params.taxaJurosMensal || 0) / 100
      : prazoMeses <= 60 ? 0.019 : 0.022;

  // 2. Cascata de Financiamento Máximo e Total Negociado
  let baseFinanc = Math.min(financiamentoAprovado, ltvMaximo * avaliacaoBanco);
  if (baseFinanc + subsidio + fgts > avaliacaoBanco && avaliacaoBanco > 0) {
    baseFinanc = Math.max(0, avaliacaoBanco - subsidio - fgts);
  }
  const maxFinanciamento = Math.max(0, Math.min(baseFinanc, Math.max(0, precoTabela - 2000)));

  const totalNegociado = Math.min(
    subsidio + fgts + maxFinanciamento,
    subsidio + fgts + Math.max(0, precoTabela - 2000)
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
    atoSugerido = Math.max(totalComITBI - proSolutoMaximo - aportesExtras, 2000);
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
