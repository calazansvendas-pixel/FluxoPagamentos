import { CommercialCondition, Product, SimulationData } from '../types';
import { parseCurrency } from './formatters';

/**
 * Calculates Present Value (VP) formula equivalent to Excel: =VP(taxa; nper; -pmt)
 */
export function calculatePresentValue(ratePerMonthPct: number, numInstallments: number, monthlyPayment: number): number {
  if (numInstallments <= 0 || monthlyPayment <= 0) return 0;
  const rateDec = ratePerMonthPct / 100;
  if (rateDec === 0) {
    return monthlyPayment * numInstallments;
  }
  return monthlyPayment * (1 - Math.pow(1 + rateDec, -numInstallments)) / rateDec;
}

export function ensureProductConditions(prod: Product): Product {
  if (!prod.conditions || prod.conditions.length === 0) {
    const opts = (prod.options && prod.options.length > 0) 
      ? prod.options 
      : ['Sinal em 48X c/ Morar', 'Sinal em 72X c/ Banco Direto'];
    
    prod.conditions = opts.map((optName, idx) => ({
      id: `cond_${prod.id}_${idx + 1}`,
      name: optName,
      numParcelas: prod.numParcelas || 72,
      sinalMinimo: prod.sinalMinimo || 'R$ 2.000,00',
      riscoRendaPct: prod.riscoRendaPct !== undefined ? prod.riscoRendaPct : 30,
      riscoImovelPct: prod.riscoImovelPct !== undefined ? prod.riscoImovelPct : 25,
      mesesTabela1: 36,
      taxaJuros1: 0.0,
      mesesTabela2: 72,
      taxaJuros2: 1.0,
      policy: prod.policy || `POLÍTICA COMERCIAL SINAL ${optName.toUpperCase()}:\n- Comissão padrão: 4% apartada na proposta.\n- Entrada mínima conforme negociação.\n- Sujeito à análise financeira.`
    }));
  }
  return prod;
}

export function calcularParcelaPrice(taxaAoMes: number, numParcelas: number, valorPresente: number): number {
  if (numParcelas <= 0 || valorPresente <= 0) return 0;
  // Converte a taxa informada (ex: 1.9) para decimal (0.019)
  let i = taxaAoMes / 100;
  if (i === 0) return valorPresente / numParcelas;

  let fator = Math.pow(1 + i, numParcelas);
  let parcela = valorPresente * ((i * fator) / (fator - 1));
  return parcela;
}

export function calculatePricePMT(principal: number, ratePerMonthPct: number, numInstallments: number): number {
  return calcularParcelaPrice(ratePerMonthPct, numInstallments, principal);
}

export function calculatePolicyRiskValues(
  prod: Product,
  cond: CommercialCondition,
  clientIncome: number,
  overrideNumParcelas?: number,
  overridePrice?: number,
  overrideITBI?: number,
  overrideEvaluation?: number,
  overrideAtoPremiado?: number
) {
  const numParcelas = overrideNumParcelas || cond.numParcelas || 72;
  const riscoRendaPct = cond.riscoRendaPct;
  const rendaVal = clientIncome * (riscoRendaPct / 100);

  const meses1 = cond.mesesTabela1 || 36;
  const taxa1 = cond.taxaJuros1 || 0;
  const taxa2 = cond.taxaJuros2 || 1.0;
  const appliedRatePct = (numParcelas <= meses1) ? taxa1 : taxa2;

  const vpVal = calculatePresentValue(appliedRatePct, numParcelas, rendaVal);

  let propertyPrice = overridePrice !== undefined ? overridePrice : 0;
  let propertyITBI = overrideITBI !== undefined ? overrideITBI : 0;
  let propertyEvaluation = overrideEvaluation !== undefined ? overrideEvaluation : 0;
  let atoPremiado = overrideAtoPremiado !== undefined ? overrideAtoPremiado : 0;

  if (overridePrice === undefined && prod.tableInfo && prod.tableInfo.rows && prod.tableInfo.rows.length > 0) {
    const firstRow = prod.tableInfo.rows[0];
    if (firstRow[7] !== undefined) propertyPrice = parseCurrency(firstRow[7]);
    if (firstRow[8] !== undefined) propertyITBI = parseCurrency(firstRow[8]);
    if (firstRow[6] !== undefined) propertyEvaluation = parseCurrency(firstRow[6]);
  }

  // Base de Cálculo = MAX(Preço Tabela, Avaliação Banco) + ITBI/Despesas
  const maxPriceEval = Math.max(propertyPrice, propertyEvaluation);
  const totalBaseImovel = Math.max(0, maxPriceEval + propertyITBI);
  const riscoImovelVal = totalBaseImovel * (cond.riscoImovelPct / 100);

  const minRiskVal = (maxPriceEval > 0 || totalBaseImovel > 0) ? Math.min(vpVal, riscoImovelVal) : 0;

  return {
    rendaVal,
    numParcelas,
    appliedRatePct,
    vpVal,
    propertyPrice,
    propertyEvaluation,
    propertyITBI,
    atoPremiado,
    totalBaseImovel,
    riscoImovelVal,
    minRiskVal
  };
}
