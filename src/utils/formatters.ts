export function parseCurrency(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  
  let str = String(val).trim();
  str = str.replace(/^R\$\s*/i, '').trim();
  if (!str) return 0;

  // Se possui vírgula (ex: "5.000,00", "5000,00", "5000,5", "5,50")
  if (str.includes(',')) {
    const clean = str.replace(/\./g, '').replace(',', '.');
    const floatVal = parseFloat(clean);
    return isNaN(floatVal) ? 0 : floatVal;
  }

  // Se possui ponto
  if (str.includes('.')) {
    const parts = str.split('.');
    // Caso de múltiplos pontos ("1.500.000") ou ponto como milhar ("5.000" sem decimais):
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3)) {
      const clean = str.replace(/\./g, '');
      const floatVal = parseFloat(clean);
      return isNaN(floatVal) ? 0 : floatVal;
    }
    const floatVal = parseFloat(str);
    return isNaN(floatVal) ? 0 : floatVal;
  }

  // String apenas com inteiros (ex: "5000", "2000")
  const floatVal = parseFloat(str);
  return isNaN(floatVal) ? 0 : floatVal;
}

export function formatCurrency(val: number): string {
  if (typeof val !== 'number' || isNaN(val)) val = 0;
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatM2(val: any): string {
  if (!val && val !== 0) return '0,00 m²';
  const str = String(val).trim();
  if (!str) return '0,00 m²';
  if (str.toLowerCase().includes('m²') || str.toLowerCase().includes('m2')) return str;
  const num = parseFloat(str.replace(',', '.'));
  if (!isNaN(num)) {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m²';
  }
  return str + ' m²';
}

export function normalizeHeader(str: any): string {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/º|°|ª/g, '')
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ColumnDef {
  key: string;
  label: string;
  match: (norm: string) => boolean;
}

export const COLUMN_DEFINITIONS: ColumnDef[] = [
  { key: "Fase", label: "Fase", match: norm => norm.includes("FASE") },
  { key: "TORRE", label: "TORRE", match: norm => norm.includes("TORRE") || norm.includes("BLOCO") },
  { key: "UNIDADE", label: "UNIDADE", match: norm => norm.includes("UNIDADE") || norm.includes("APTO") || norm.includes("APT") },
  { key: "ÁREA PRIVATIVA M² - APTO", label: "ÁREA PRIVATIVA M² - APTO", match: norm => norm.includes("PRIVATIVA") || (norm.includes("AREA") && !norm.includes("QUINTAL") && !norm.includes("GARDEN")) },
  { key: "ÁREA QUINTAL M²", label: "ÁREA QUINTAL M²", match: norm => norm.includes("QUINTAL") || norm.includes("GARDEN") || norm.includes("TERRACO") },
  { key: "TIPOLOGIA", label: "TIPOLOGIA", match: norm => norm.includes("TIPOLOGIA") || norm.includes("TIPOLOG") || norm.includes("QUARTO") || norm.includes("DORM") },
  { key: "AVALIAÇÃO", label: "AVALIAÇÃO", match: norm => norm.includes("AVALIAC") || norm.includes("AVAL") },
  { key: "PREÇO", label: "PREÇO", match: norm => (norm.includes("PRECO") || norm.includes("VALOR") || norm.includes("TABELA")) && !norm.includes("AVALIAC") && !norm.includes("ITBI") && !norm.includes("REGISTRO") },
  { key: "ITBI + Registro 1º Imóvel", label: "ITBI + Registro 1º Imóvel", match: norm => (norm.includes("ITBI") || norm.includes("REGISTRO") || norm.includes("CARTOR")) && (norm.includes("1") || norm.includes("PRIMEIRO")) },
  { key: "ITBI + Registro 2º Imóvel", label: "ITBI + Registro 2º Imóvel", match: norm => (norm.includes("ITBI") || norm.includes("REGISTRO") || norm.includes("CARTOR")) && (norm.includes("2") || norm.includes("SEGUNDO")) }
];

export function formatDateMonthYear(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${months[monthIdx]}/${year}`;
    }
  }
  return dateStr;
}

export function formatDeliveryText(p1?: string, p2?: string, legacyDate?: string): string {
  const date1 = p1 || (!p2 ? legacyDate : '');
  const date2 = p2;

  const fmt1 = formatDateMonthYear(date1);
  const fmt2 = formatDateMonthYear(date2);

  if (fmt1 && fmt2) {
    return `1ª Etapa: ${fmt1} | 2ª Etapa: ${fmt2}`;
  } else if (fmt1) {
    return `1ª Etapa: ${fmt1}`;
  } else if (fmt2) {
    return `2ª Etapa: ${fmt2}`;
  }
  return '';
}

export function formatDateBr(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  }
  if (dateStr.includes('/')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }
  return dateStr;
}

