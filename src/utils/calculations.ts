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
  taxaJurosMensal?: number; // Opcional: se não passar, usa 1.9% (<=60) ou 2.2% (>60)
  atoManual?: number;
  aportesExtras?: number;
  sinalMinimo?: number; // Padrão 2000
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
 * Calcula o Valor Presente (PV) dado PMT, taxa de juros e prazo
 */
export function calcularValorPresente(pmt: number, taxa: number, n: number): number {
  if (taxa <= 0) return pmt * n;
  return pmt * ((1 - Math.pow(1 + taxa, -n)) / taxa);
}

/**
 * Calcula a Parcela Mensal (PMT) pela Tabela Price
 */
export function calcularPricePMT(pv: number, taxa: number, n: number): number {
  if (taxa <= 0) return pv / n;
  return (pv * taxa) / (1 - Math.pow(1 + taxa, -n));
}

export function calculatePresentValue(ratePerMonthPct: number, numInstallments: number, monthlyPayment: number): number {
  return calcularValorPresente(monthlyPayment, ratePerMonthPct / 100, numInstallments);
}

export function calcularParcelaPrice(taxaAoMesPct: number, numParcelas: number, valorPresente: number): number {
  return calcularPricePMT(valorPresente, taxaAoMesPct / 100, numParcelas);
}

export function calculatePricePMT(principal: number, ratePerMonthPct: number, numInstallments: number): number {
  return calcularPricePMT(principal, ratePerMonthPct / 100, numInstallments);
}

export function ensureProductConditions(prod: Product): Product {
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
 * Função principal de simulação seguindo a especificação
 */
export function calcularSimulacaoFluxo(params: FinancialParams): SimulationResult {
  const {
    precoTabela,
    avaliacaoBanco,
    renda,
    subsidio = 0,
    fgts = 0,
    financiamentoAprovado = Infinity,
    ltvMaximo = 0.80,
    itbiRegistro,
    percentualRiscoImovel,
    percentualRiscoRenda = 35,
    prazoMeses,
    atoManual = 0,
    aportesExtras = 0,
    sinalMinimo = 2000,
  } = params;

  // 1. Definição da Taxa de Juros
  const jurosMensal = params.taxaJurosMensal !== undefined
      ? params.taxaJurosMensal / 100
      : prazoMeses <= 60 ? 0.019 : 0.022;

  // 2. Máximo Financiamento em Cascata
  let baseFinanc = Math.min(financiamentoAprovado, ltvMaximo * avaliacaoBanco);
  if (baseFinanc + subsidio + fgts > avaliacaoBanco) {
    baseFinanc = avaliacaoBanco - subsidio - fgts;
  }
  const maxFinanciamento = Math.max(0, Math.min(baseFinanc, precoTabela - sinalMinimo));

  // 3. Total Negociado
  const totalNegociado = Math.min(
    subsidio + fgts + maxFinanciamento,
    subsidio + fgts + precoTabela - sinalMinimo
  );

  // 4. Teto da Renda (35% da renda como PMT máximo)
  const pmtMaxRenda = renda * (percentualRiscoRenda / 100);
  const tetoRenda = calcularValorPresente(pmtMaxRenda, jurosMensal, prazoMeses);

  // 5. Laço de Equalização Circular (Desconto <-> Ato)
  let desconto = 0;
  let erro = 1;
  let iteracoes = 0;
  const maxIteracoes = 100;

  let sinalTotal = 0;
  let totalComITBI = 0;
  let tetoImovel = 0;
  let proSolutoTotalLoop = 0;
  let atoSugerido = 0;
  let atoEfetivo = 0;

  const maiorBase = Math.max(precoTabela, avaliacaoBanco);

  while (erro > 0.005 && iteracoes < maxIteracoes) {
    // a) Sinal Total
    sinalTotal = Math.max(0, precoTabela - totalNegociado - desconto);
    
    // b) Total com ITBI
    totalComITBI = sinalTotal + itbiRegistro;
    
    // c) Maior Base -> const maiorBase (já calculada)
    // d) Base Risco Imóvel
    const baseRiscoImovel = maiorBase + itbiRegistro - desconto;
    
    // e) Teto Imovel
    tetoImovel = baseRiscoImovel * (percentualRiscoImovel / 100);

    // f) Pro Soluto Total Apurado no loop
    proSolutoTotalLoop = Math.min(tetoImovel, tetoRenda, totalComITBI);

    // g) REGRA CRÍTICA DO ATO: O Ato Sugerido DEVE ser calculado subtraindo o ProSolutoTotal CHEIO do TotalComITBI.
    // A taxa do Banco Direto NUNCA deve ser somada ou embutida no pagamento do ato.
    atoSugerido = Math.max(totalComITBI - proSolutoTotalLoop - aportesExtras, sinalMinimo);
    atoEfetivo = atoManual > 0 ? Math.max(atoManual, atoSugerido) : atoSugerido;

    // h) Regra do Desconto (Ato Premiado)
    let novoDesconto = 0;
    if (atoEfetivo > 50000) {
      novoDesconto = 5000;
    } else if (atoEfetivo >= 5000 && atoEfetivo <= 50000) {
      novoDesconto = atoEfetivo * 0.10;
    } else {
      novoDesconto = 0;
    }

    // i) Erro e Convergência
    erro = Math.abs(novoDesconto - desconto);
    desconto = novoDesconto;
    iteracoes++;
  }

  // 6. Pró-Soluto Final e Parcelamento (PRICE)
  // Pró-Soluto Total = TotalComITBI - AtoEfetivo
  const proSolutoTotal = totalComITBI - atoEfetivo - aportesExtras;
  
  // Pró-Soluto Restante
  const proSolutoRestante = Math.max(0, proSolutoTotal - itbiRegistro);

  // A dedução da Taxa Bancária (0,2003%) ocorre EXCLUSIVAMENTE na base de cálculo da Tabela Price
  const taxaBancaria = proSolutoTotal * 0.002003;
  const baseLiquidaParcela = proSolutoTotal - taxaBancaria;
  
  // Parcela Mensal
  const valorParcela = calcularPricePMT(baseLiquidaParcela, jurosMensal, prazoMeses);

  // 7. Indicadores de Validação
  const comprometimentoRenda = renda > 0 ? (valorParcela / renda) * 100 : 0;
  const baseRiscoFinal = maiorBase + itbiRegistro - desconto;
  const riscoImovelEfetivo = baseRiscoFinal > 0 ? (proSolutoTotal / baseRiscoFinal) * 100 : 0;
  const conferenciaValida = Math.abs(totalComITBI - (proSolutoTotal + atoEfetivo + aportesExtras)) < 0.05;

  return {
    maxFinanciamento,
    totalNegociado,
    descontoAtoPremiado: desconto,
    sinalTotal,
    totalComITBI,
    tetoImovel,
    tetoRenda,
    proSolutoMaximo: proSolutoTotalLoop,
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
    conferenciaValida,
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
  overrideAtoPremiado?: number,
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
    precoTabela: propertyPrice,
    avaliacaoBanco: propertyEvaluation,
    renda: clientIncome,
    subsidio: subsidy,
    fgts: fgts,
    financiamentoAprovado: maxFinanciamentoBanco > 0 ? maxFinanciamentoBanco : Infinity,
    ltvMaximo: ltvMaximo,
    itbiRegistro: propertyITBI,
    percentualRiscoImovel: percentualPolitica,
    percentualRiscoRenda: riscoRendaPct,
    prazoMeses: numParcelas,
    taxaJurosMensal: appliedRatePct,
    atoManual: overrideAtoPremiado,
  });

  return {
    rendaVal: clientIncome * (riscoRendaPct / 100),
    numParcelas,
    appliedRatePct,
    vpVal: simulacao.tetoRenda,
    propertyPrice,
    propertyEvaluation,
    propertyITBI,
    
    atoPremiado: simulacao.descontoAtoPremiado,
    maiorBase: Math.max(propertyPrice, propertyEvaluation),
    baseAjustada: Math.max(propertyPrice, propertyEvaluation) + propertyITBI - simulacao.descontoAtoPremiado,
    baseComITBI: Math.max(propertyPrice, propertyEvaluation) + propertyITBI - simulacao.descontoAtoPremiado,
    baseBruta: Math.max(propertyPrice, propertyEvaluation) + propertyITBI - simulacao.descontoAtoPremiado,
    
    proSolutoTotalComITBI: simulacao.proSolutoTotal,
    proSolutoTotal: simulacao.proSolutoTotal,
    proSolutoRestante: simulacao.proSolutoRestante,
    sinalSugerido: simulacao.atoSugerido,
    atoImovel: simulacao.atoEfetivo,
    pagamentoAto: simulacao.atoEfetivo,
    sinalTotal: simulacao.sinalTotal,
    totalComITBI: simulacao.totalComITBI,
    taxaBancaria: simulacao.taxaBancaria,
    riscoUtilizadoTX: simulacao.baseLiquida,
    baseCalculoParcela: simulacao.baseLiquida,
    parcelaPrice: simulacao.valorParcela,

    totalBaseImovel: Math.max(propertyPrice, propertyEvaluation) + propertyITBI - simulacao.descontoAtoPremiado,
    riscoImovelVal: simulacao.tetoImovel,
    minRiskVal: simulacao.proSolutoMaximo,

    simulacao
  };
}
