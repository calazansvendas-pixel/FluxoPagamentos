export function parseCurrency(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  
  // Limpeza de caracteres não numéricos, NBSP (\u00A0), R$, espaços e quebras de linha
  let str = String(val)
    .replace(/\u00A0/g, ' ')
    .replace(/R\$\s*/gi, '')
    .trim();
  if (!str) return 0;

  // Se possui vírgula (formato brasileiro padrão, ex: "13.510,00", "19.230,50", "13510,00")
  if (str.includes(',')) {
    const clean = str.replace(/\./g, '').replace(',', '.').replace(/\s+/g, '');
    const floatVal = parseFloat(clean);
    return isNaN(floatVal) ? 0 : Math.round(floatVal * 100) / 100;
  }

  // Se possui ponto
  if (str.includes('.')) {
    const parts = str.split('.');
    // Caso de múltiplos pontos ("1.500.000") ou ponto como milhar ("19.000" sem decimais):
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3)) {
      const clean = str.replace(/\./g, '').replace(/\s+/g, '');
      const floatVal = parseFloat(clean);
      return isNaN(floatVal) ? 0 : Math.round(floatVal * 100) / 100;
    }
    const clean = str.replace(/\s+/g, '');
    const floatVal = parseFloat(clean);
    return isNaN(floatVal) ? 0 : Math.round(floatVal * 100) / 100;
  }

  // String apenas com inteiros (ex: "13510", "19230")
  const floatVal = parseFloat(str.replace(/\s+/g, ''));
  return isNaN(floatVal) ? 0 : Math.round(floatVal * 100) / 100;
}

export function formatCurrency(val: number): string {
  if (typeof val !== 'number' || isNaN(val)) val = 0;
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export const formatArea = (val: number | string | undefined | null): string => {
  if (val === null || val === undefined || val === '') return '0,00 m²';
  let num = typeof val === 'string' 
    ? parseFloat(val.toString().replace(/m²|m2/gi, '').trim().replace(',', '.')) 
    : Number(val);
  
  if (isNaN(num)) return '0,00 m²';
  
  // Tratamento preventivo para valores importados sem ponto decimal (ex: 435 -> 43.5, 4350 -> 43.5)
  if (num >= 250 && num < 1000) {
    num = num / 10;
  } else if (num >= 1000 && num <= 15000) {
    num = num / 100;
  }

  return `${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
};

export function formatM2(val: any): string {
  return formatArea(val);
}

export function parseM2Number(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  
  let num: number;
  if (typeof val === 'number') {
    num = isNaN(val) ? 0 : val;
  } else {
    const str = String(val).replace(/m²|m2/gi, '').trim();
    if (!str) return 0;
    // Substitui vírgula por ponto (ex: "43,50" -> "43.50")
    num = parseFloat(str.replace(',', '.'));
    if (isNaN(num)) return 0;
  }

  // Tratamento preventivo para valores importados sem ponto decimal (ex: 435 -> 43.5)
  if (num >= 250 && num < 1000) {
    num = num / 10;
  } else if (num >= 1000 && num <= 15000) {
    num = num / 100;
  }

  return Math.round(num * 100) / 100;
}

export function normalizeHeader(str: any): string {
  if (!str) return '';
  return String(str)
    .replace(/[\r\n\t]+/g, ' ')
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
  { key: "ÁREA PRIVATIVA M² - APTO", label: "ÁREA PRIVATIVA M² - APTO", match: norm => (norm.includes("PRIVATIVA") || norm.includes("METRAGEM") || (norm.includes("AREA") && !norm.includes("QUINTAL") && !norm.includes("GARDEN") && !norm.includes("TERRACO"))) },
  { key: "ÁREA QUINTAL M²", label: "ÁREA QUINTAL M²", match: norm => norm.includes("QUINTAL") || norm.includes("GARDEN") || norm.includes("TERRACO") },
  { key: "TIPOLOGIA", label: "TIPOLOGIA", match: norm => norm.includes("TIPOLOGIA") || norm.includes("TIPOLOG") || norm.includes("QUARTO") || norm.includes("DORM") },
  { key: "AVALIAÇÃO", label: "AVALIAÇÃO", match: norm => (norm.includes("AVALIAC") || norm.includes("AVAL")) && !norm.includes("ITBI") && !norm.includes("REGISTRO") },
  { key: "PREÇO", label: "PREÇO", match: norm => (norm.includes("PRECO") || norm.includes("VALOR") || norm.includes("TABELA") || norm.includes("VENDA")) && !norm.includes("AVALIAC") && !norm.includes("ITBI") && !norm.includes("REGISTRO") && !norm.includes("CARTOR") && !norm.includes("SINAL") && !norm.includes("FINANC") },
  { 
    key: "ITBI + Registro 1º Imóvel", 
    label: "ITBI + Registro 1º Imóvel", 
    match: norm => {
      // Exclui estritamente colunas compostas que embutem preço do imóvel ou parcelas
      if (norm.includes("PRECO") || norm.includes("VALOR TOTAL") || norm.includes("TOTAL C ITBI") || norm.includes("SOMA") || norm.includes("FINANC") || norm.includes("SINAL") || norm.includes("PARCELA") || norm.includes("ENTRADA") || norm.includes("FLUXO") || norm.includes("AVALIAC")) {
        return false;
      }
      const isTax = norm.includes("ITBI") || norm.includes("REGISTRO") || norm.includes("CARTOR") || norm.includes("DESP CARTORIAS") || norm.includes("DESPESAS CARTOR") || norm.includes("EMOLUMENT") || norm.includes("CUSTAS");
      const is1st = norm.includes("1") || norm.includes("PRIMEIRO") || norm.includes("1O") || norm.includes("1A") || norm.includes("PRIMEIRA");
      const is2nd = norm.includes("2") || norm.includes("SEGUNDO") || norm.includes("2O") || norm.includes("2A") || norm.includes("SEGUNDA");
      return (isTax && is1st && !is2nd) || (norm.startsWith("1") && norm.includes("IMOVEL") && isTax);
    } 
  },
  { 
    key: "ITBI + Registro 2º Imóvel", 
    label: "ITBI + Registro 2º Imóvel", 
    match: norm => {
      // Exclui estritamente colunas compostas que embutem preço do imóvel ou parcelas
      if (norm.includes("PRECO") || norm.includes("VALOR TOTAL") || norm.includes("TOTAL C ITBI") || norm.includes("SOMA") || norm.includes("FINANC") || norm.includes("SINAL") || norm.includes("PARCELA") || norm.includes("ENTRADA") || norm.includes("FLUXO") || norm.includes("AVALIAC")) {
        return false;
      }
      const isTax = norm.includes("ITBI") || norm.includes("REGISTRO") || norm.includes("CARTOR") || norm.includes("DESP CARTORIAS") || norm.includes("DESPESAS CARTOR") || norm.includes("EMOLUMENT") || norm.includes("CUSTAS");
      const is2nd = norm.includes("2") || norm.includes("SEGUNDO") || norm.includes("2O") || norm.includes("2A") || norm.includes("SEGUNDA");
      const is1st = norm.includes("1") || norm.includes("PRIMEIRO") || norm.includes("1O") || norm.includes("1A") || norm.includes("PRIMEIRA");
      return (isTax && is2nd) || (norm.startsWith("2") && norm.includes("IMOVEL") && isTax) || (isTax && !is1st);
    } 
  }
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

