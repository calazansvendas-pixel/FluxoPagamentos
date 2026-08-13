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
  income: number;
  subsidy: number;
  fgts: number;
  financing: number;
  finPercent: number; // e.g., 0.9 or 0.8
  isFirstHome: boolean;
}

export interface SelectedUnit {
  torre: string;
  unidade: string;
}

export type ActiveTab = 'simulator' | 'details' | 'policies' | 'import-table';
