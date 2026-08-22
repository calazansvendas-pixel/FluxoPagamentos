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
  // Séries Contínuas Globais (Blocos de 12 meses)
  globalSerie1Pct?: number; // Ano 1
  globalSerie2Pct?: number; // Ano 2
  globalSerie3Pct?: number; // Ano 3
  globalSerie4Pct?: number; // Ano 4
  globalSerie5Pct?: number; // Ano 5
  globalSerie6Pct?: number; // Ano 6
  torresHabilitadas?: string[]; // Lista de torres liberadas para simulação nesta política
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

export type ActiveTab = 'simulator' | 'details' | 'ficha-morar' | 'policies' | 'import-table';
