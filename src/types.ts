export interface CommercialCondition {
  id: string;
  name: string;
  numParcelas: number;
  sinalMinimo: string;
  riscoRendaPct: number;
  riscoImovelPct: number;
  mesesTabela1: number;
  taxaJuros1: number;
  mesesTabela2: number;
  taxaJuros2: number;
  policy: string;

  // Campos específicos para a condição "Sinal c/ Morar"
  mesesObra?: number;
  mesesPos?: number;
  percMaxProSolutoGlobal?: number; // % Max Pró-Soluto Global (ex: 17.0%)
  percMaxPosObra?: number; // % Max Pós-Obra (ex: 8.0%)
  riscoPosPct?: number; // Compatibilidade retroativa
  // Séries Contínuas Globais (Blocos de meses). Cada balde tem seu próprio
  // percentual (globalSerieXPct) E sua própria quantidade de meses (serieXMeses,
  // padrão 12 cada). O balde é preenchido contínuo entre Obra e Pós-Obra: se um
  // balde é dividido pela fronteira Obra/Pós-Obra, as duas partes usam o MESMO
  // percentual (é o mesmo balde), só a quantidade de meses de cada parte muda.
  globalSerie1Pct?: number; // Ano 1
  globalSerie2Pct?: number; // Ano 2
  globalSerie3Pct?: number; // Ano 3
  globalSerie4Pct?: number; // Ano 4
  globalSerie5Pct?: number; // Ano 5
  globalSerie6Pct?: number; // Ano 6
  serie1Meses?: number; // Qtd de meses do balde 1 (padrão 12)
  serie2Meses?: number; // Qtd de meses do balde 2 (padrão 12)
  serie3Meses?: number; // Qtd de meses do balde 3 (padrão 12)
  serie4Meses?: number; // Qtd de meses do balde 4 (padrão 12)
  serie5Meses?: number; // Qtd de meses do balde 5 (padrão 12)
  serie6Meses?: number; // Qtd de meses do balde 6 (padrão 12)
  torresHabilitadas?: string[]; // Lista de torres liberadas para simulação nesta política

  // Política de crédito distinta por fase do empreendimento. Cada torre pode ser
  // marcada como pertencente à 2ª Fase (torresFase2); torres não listadas são
  // consideradas 1ª Fase. Quando a torre selecionada está em torresFase2, os
  // campos presentes em fase2Params sobrescrevem os campos correspondentes desta
  // condição (qualquer campo não definido em fase2Params mantém o valor da 1ª Fase).
  torresFase2?: string[]; // Lista de torres desta política que estão na 2ª Fase
  fase2Params?: Partial<CommercialCondition>; // Overrides de parâmetros para a 2ª Fase

  // Campos específicos para a condição "Parcelamento Morar" (riscoRendaPct já
  // existente é reaproveitado como o teto de renda de 40% desta condição). Esta
  // condição não usa financiamento bancário/subsídio/FGTS/ITBI — apenas Sinal +
  // Ato Premiado + mensais de obra + intermediárias semestrais + parcela final
  // (chaves) + parcelamento pós-obra.
  pmSinalMinimoPct?: number; // % mínimo do Sinal (Ato) sobre o valor do imóvel (padrão 10%)
  pmParcelaSemestralMaxPct?: number; // % máximo do valor do imóvel por parcela intermediária semestral (padrão 4%)
  pmParcelaChavesMaxPct?: number; // % máximo do valor do imóvel para a parcela intermediária final/chaves (padrão 15%)
  pmParcelaChavesMesesAntes?: number; // Quantidade de meses antes do habite-se em que a parcela de chaves vence (padrão 2)
  pmRiscoProSolutoPosObraPct?: number; // % máximo do valor do imóvel para o somatório das mensais pós-obra (padrão 5%)
  pmQtdParcelasPosObra?: number; // Quantidade de parcelas mensais pós-obra (padrão 12)
  // Parcela mínima (em R$) de cada campo recorrente: se o valor calculado ficar
  // abaixo do piso, aquele bloco é zerado e o saldo é redirecionado — sempre
  // priorizando manter o período de Obra financiado antes do Pós-Obra.
  pmParcelaMinimaMensalObra?: number; // padrão R$ 200,00
  pmParcelaMinimaSemestral?: number; // padrão R$ 200,00
  pmParcelaMinimaPosObra?: number; // padrão R$ 200,00
}

export interface TableRow {
  fase: string;
  torre: string;
  unidade: string;
  areaPrivativa: string | number;
  areaQuintal: string | number;
  tipologia: string;
  avaliacao: number;
  preco: number;
  itbi1: number;
  itbi2: number;
}

export interface TableInfo {
  validFrom: string;
  validTo: string;
  fileName: string;
  headers: string[];
  rows: (string | number)[][];
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  isFeatured: boolean;
  deliveryDate?: string;
  deliveryDatePhase1?: string;
  deliveryDatePhase2?: string;
  conditions: CommercialCondition[];
  tableInfo: TableInfo;
  options?: string[];
  numParcelas?: number;
  sinalMinimo?: string;
  riscoRendaPct?: number;
  riscoImovelPct?: number;
  policy?: string;
}

export interface SimulationData {
  agency: string;
  clientName: string;
  income?: number | null;
  subsidy?: number | null;
  fgts?: number | null;
  financing?: number | null;
  finPercent: number; // e.g., 0.9 or 0.8
  isFirstHome: boolean;
  ownResource?: number;
}

export interface SelectedUnit {
  torre: string;
  unidade: string;
}

export type ActiveTab = 'simulator' | 'details' | 'ficha-morar' | 'policies' | 'import-table' | 'saved-simulations';
