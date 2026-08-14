import React, { useState, useRef } from 'react';
import { FileCheck, CheckCircle, AlertCircle, Trash2, CalendarClock, UploadCloud, Search, XCircle, Table as TableIcon, CheckCircle2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Product, TableInfo } from '../types';
import { COLUMN_DEFINITIONS, formatCurrency, parseCurrency, normalizeHeader } from '../utils/formatters';

interface ImportTableViewProps {
  products: Product[];
  activeImportProductId: string;
  onSelectImportProduct: (productId: string) => void;
  onSaveTableInfo: (productId: string, tableInfo: TableInfo) => void;
  onDeleteTable: (productId: string) => void;
  onShowToast: (message: string) => void;
}

// Helper to get first and last day of current month in YYYY-MM-DD format
const getCurrentMonthDates = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const validFrom = `${year}-${month}-01`;

  const lastDayObj = new Date(year, now.getMonth() + 1, 0);
  const lastDayStr = String(lastDayObj.getDate()).padStart(2, '0');
  const validTo = `${year}-${month}-${lastDayStr}`;

  return { validFrom, validTo };
};

export const ImportTableView: React.FC<ImportTableViewProps> = ({
  products,
  activeImportProductId,
  onSelectImportProduct,
  onSaveTableInfo,
  onDeleteTable,
  onShowToast
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeProd = products.find(p => p.id === activeImportProductId) || products[0];

  const currentMonthDefaults = getCurrentMonthDates();

  const [validFrom, setValidFrom] = useState<string>(
    activeProd?.tableInfo?.validFrom || currentMonthDefaults.validFrom
  );
  const [validTo, setValidTo] = useState<string>(
    activeProd?.tableInfo?.validTo || currentMonthDefaults.validTo
  );
  
  const [lookupTorre, setLookupTorre] = useState<string>('');
  const [lookupUnidade, setLookupUnidade] = useState<string>('');

  const [tempParsedData, setTempParsedData] = useState<{
    headers: string[];
    rows: (string | number)[][];
    fileName: string;
  } | null>(null);

  // When active import product changes, update local fields
  React.useEffect(() => {
    if (activeProd) {
      const monthDefaults = getCurrentMonthDates();
      setValidFrom(activeProd.tableInfo?.validFrom || monthDefaults.validFrom);
      setValidTo(activeProd.tableInfo?.validTo || monthDefaults.validTo);
      setTempParsedData(null);
      setLookupTorre('');
      setLookupUnidade('');
    }
  }, [activeImportProductId, products]);

  const hasTable = activeProd?.tableInfo && activeProd.tableInfo.active;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) return;

        const workbook = XLSX.read(data, { type: 'binary' });

        // Target sheet "Estudo (Status)" or fallback
        let targetSheetName = workbook.SheetNames.find(
          name => name.trim().toLowerCase() === 'estudo (status)'
        );

        if (!targetSheetName) {
          targetSheetName = workbook.SheetNames.find(
            name => name.toLowerCase().includes('estudo')
          ) || workbook.SheetNames[0];
          onShowToast(`Aba "Estudo (Status)" não localizada exatamente. Lendo aba "${targetSheetName}".`);
        } else {
          onShowToast(`Aba "Estudo (Status)" encontrada! Mapeando colunas...`);
        }

        const worksheet = workbook.Sheets[targetSheetName];
        const jsonData = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, { header: 1, defval: '' });

        if (!jsonData || jsonData.length === 0) {
          onShowToast("A aba da planilha está vazia.");
          return;
        }

        let bestHeaderRowIndex = -1;
        let maxScore = -1;
        let bestColMap: Record<string, number> = {};

        // 1. AVALIAÇÃO DINÂMICA DE LINHAS DE CABEÇALHO PARA EVITAR BANNER/TÍTULO MESCLADO
        for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
          const row = jsonData[i];
          if (!row || !Array.isArray(row) || row.length < 2) continue;

          const normalizedCells = Array.from(row, cell => normalizeHeader(cell));

          // Descarta linhas vazias ou com apenas 1 célula longa (banners/títulos)
          const filledCells = normalizedCells.filter(c => c.length > 0);
          if (filledCells.length < 2) continue;

          let colMap: Record<string, number> = {};
          let score = 0;

          normalizedCells.forEach((normText, excelColIdx) => {
            if (!normText) return;
            // Se o texto for excessivamente longo, é um título de banner ou observação
            if (normText.length > 35 || normText.includes("TABELA DE VENDAS") || normText.includes("ESTUDO DE STATUS")) return;

            // Busca correspondência com cada definição de coluna
            COLUMN_DEFINITIONS.forEach(def => {
              if (def.key === "AVALIAÇÃO") return; // Tratado separadamente abaixo
              if (colMap[def.key] === undefined && def.match(normText)) {
                colMap[def.key] = excelColIdx;
                score++;
              }
            });

            // Mapeamento especial de AVALIAÇÃO
            if (colMap["AVALIAÇÃO"] === undefined) {
              if (
                (normText.includes("05") && normText.includes("08") && normText.includes("2025")) ||
                normText.includes("05082025") ||
                normText.includes("AVALIAC") ||
                normText.includes("AVAL")
              ) {
                colMap["AVALIAÇÃO"] = excelColIdx;
                score++;
              }
            }

            // Mapeamento especial de ITBI (Com trava ESTRITA e sanitização de 1º/2º Imóvel)
            const superCleanText = normText.replace(/\s+/g, '').toUpperCase();
            const isPrecioHeader = normText.includes("PRECO") || normText.includes("PREÇO") || normText.includes("VALOR");
            if (
              !isPrecioHeader &&
              !normText.includes("AVALIAC")
            ) {
              if (superCleanText.includes("2ºIMÓVEL") || superCleanText.includes("2ºIMOVEL") || superCleanText.includes("2IMOVEL")) {
                if (colMap["ITBI + Registro 2º Imóvel"] === undefined) {
                  colMap["ITBI + Registro 2º Imóvel"] = excelColIdx;
                  score++;
                }
              } else if (superCleanText.includes("1ºIMÓVEL") || superCleanText.includes("1ºIMOVEL") || superCleanText.includes("1IMOVEL")) {
                if (colMap["ITBI + Registro 1º Imóvel"] === undefined) {
                  colMap["ITBI + Registro 1º Imóvel"] = excelColIdx;
                  score++;
                }
              } else if (normText.includes("ITBI") || normText.includes("REGISTRO") || normText.includes("CARTOR")) {
                if (normText.includes("2") || normText.includes("SEGUNDO")) {
                  if (colMap["ITBI + Registro 2º Imóvel"] === undefined) {
                    colMap["ITBI + Registro 2º Imóvel"] = excelColIdx;
                    score++;
                  }
                } else {
                  if (colMap["ITBI + Registro 1º Imóvel"] === undefined) {
                    colMap["ITBI + Registro 1º Imóvel"] = excelColIdx;
                    score++;
                  }
                }
              }
            }
          });

          // Bônus decisivo para cabeçalho real ter TORRE e UNIDADE em colunas distintas
          if (colMap["TORRE"] !== undefined && colMap["UNIDADE"] !== undefined && colMap["TORRE"] !== colMap["UNIDADE"]) {
            score += 5;
          }

          if (score > maxScore && score >= 2) {
            maxScore = score;
            bestHeaderRowIndex = i;
            bestColMap = colMap;
          }
        }

        let headerRowIndex = bestHeaderRowIndex;
        let colMap = bestColMap;

        // Se não identificou cabeçalho dinâmico por pontuação, assume a primeira linha válida
        if (headerRowIndex === -1) {
          headerRowIndex = 0;
          colMap = {
            "Fase": 0,
            "TORRE": 1,
            "UNIDADE": 2,
            "ÁREA PRIVATIVA M² - APTO": 3,
            "ÁREA QUINTAL M²": 4,
            "TIPOLOGIA": 5,
            "AVALIAÇÃO": 6,
            "PREÇO": 7,
            "ITBI + Registro 1º Imóvel": 8,
            "ITBI + Registro 2º Imóvel": 9
          };
        }

        // Garante fallbacks para colunas essenciais caso alguma não tenha sido mapeada pelo cabeçalho
        if (colMap["Fase"] === undefined) colMap["Fase"] = 0;
        if (colMap["TORRE"] === undefined) colMap["TORRE"] = 1;
        if (colMap["UNIDADE"] === undefined) colMap["UNIDADE"] = 2;
        if (colMap["ÁREA PRIVATIVA M² - APTO"] === undefined) colMap["ÁREA PRIVATIVA M² - APTO"] = 3;
        if (colMap["ÁREA QUINTAL M²"] === undefined) colMap["ÁREA QUINTAL M²"] = 4;
        if (colMap["TIPOLOGIA"] === undefined) colMap["TIPOLOGIA"] = 5;
        if (colMap["AVALIAÇÃO"] === undefined) colMap["AVALIAÇÃO"] = 6;
        if (colMap["PREÇO"] === undefined) colMap["PREÇO"] = 7;

        // Fallbacks de ITBI com trava de segurança se não mapeado na busca inicial (Coluna Y = 24, Coluna AC = 28)
        const headerLine = jsonData[headerRowIndex] || [];
        if (colMap["ITBI + Registro 1º Imóvel"] === undefined) {
          let foundIdx = -1;
          if (Array.isArray(headerLine)) {
            headerLine.forEach((cell: any, idx: number) => {
              const normCell = normalizeHeader(cell);
              const cleanCell = normCell.replace(/\s+/g, '').toUpperCase();
              if (
                (cleanCell.includes("1ºIMÓVEL") || cleanCell.includes("1ºIMOVEL") || cleanCell.includes("1IMOVEL") || normCell.includes("ITBI") || normCell.includes("REGISTRO")) &&
                !normCell.includes("PRECO") &&
                !normCell.includes("PREÇO") &&
                !normCell.includes("VALOR")
              ) {
                if (foundIdx === -1) foundIdx = idx;
              }
            });
          }
          // Coluna Y (índice 24 em base 0)
          colMap["ITBI + Registro 1º Imóvel"] = foundIdx !== -1 ? foundIdx : (headerLine.length > 24 ? 24 : 8);
        }
        if (colMap["ITBI + Registro 2º Imóvel"] === undefined) {
          let foundIdx2 = -1;
          if (Array.isArray(headerLine)) {
            headerLine.forEach((cell: any, idx: number) => {
              const normCell = normalizeHeader(cell);
              const cleanCell = normCell.replace(/\s+/g, '').toUpperCase();
              if (
                (cleanCell.includes("2ºIMÓVEL") || cleanCell.includes("2ºIMOVEL") || cleanCell.includes("2IMOVEL")) &&
                !normCell.includes("PRECO") &&
                !normCell.includes("PREÇO") &&
                !normCell.includes("VALOR")
              ) {
                if (foundIdx2 === -1) foundIdx2 = idx;
              }
            });
          }
          // Coluna AC (índice 28 em base 0, depois AA 26)
          colMap["ITBI + Registro 2º Imóvel"] = foundIdx2 !== -1 ? foundIdx2 : (headerLine.length > 28 ? 28 : (headerLine.length > 26 ? 26 : (colMap["ITBI + Registro 1º Imóvel"] !== undefined ? colMap["ITBI + Registro 1º Imóvel"] : 9)));
        }

        const mappedHeaders = COLUMN_DEFINITIONS.map(d => d.label);

        // 2. EXTRAÇÃO DAS LINHAS E NORMALIZAÇÃO FLEXÍVEL COM ALIASES
        const filteredRows: (string | number)[][] = [];

        for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
          const rawRow = jsonData[r];
          if (!rawRow || !Array.isArray(rawRow)) continue;

          // Se a linha for totalmente vazia, ignora
          const hasContent = rawRow.some(val => val !== '' && val !== null && val !== undefined);
          if (!hasContent) continue;

          // Extrai células com base nos índices mapeados
          const getCell = (idx: number) => {
            if (idx === -1) return '';
            let val = rawRow[idx] !== undefined && rawRow[idx] !== null ? rawRow[idx] : '';
            if (typeof val === 'string') val = val.trim();
            return val;
          };

          const faseStr = String(getCell(colMap["Fase"]) || '1ª');
          const torreStr = String(getCell(colMap["TORRE"]));
          const unidadeStr = String(getCell(colMap["UNIDADE"]));
          const areaPrivStr = String(getCell(colMap["ÁREA PRIVATIVA M² - APTO"]) || '0,00');
          const areaQuiStr = String(getCell(colMap["ÁREA QUINTAL M²"]) || '0,00');
          const tipoStr = String(getCell(colMap["TIPOLOGIA"]));
          const avalNum = parseCurrency(getCell(colMap["AVALIAÇÃO"]));
          const precoNum = parseCurrency(getCell(colMap["PREÇO"]));

          // Converte a linha bruta em dicionário de chaves do Excel para busca dinâmica
          const rowObj: Record<string, any> = {};
          if (Array.isArray(headerLine) && Array.isArray(rawRow)) {
            headerLine.forEach((hName: any, hIdx: number) => {
              if (hName !== undefined && hName !== null) {
                rowObj[String(hName)] = rawRow[hIdx];
              }
            });
          } else if (rawRow && typeof rawRow === 'object') {
            Object.assign(rowObj, rawRow);
          }

          const chaves = Object.keys(rowObj);

          // Pega a chave exata do ITBI 1 ignorando espaços e quebras
          const chaveItbi1 = chaves.find(k => k.toUpperCase().replace(/\s/g, '').includes('1ºIMOVEL') || k.toUpperCase().replace(/\s/g, '').includes('1ºIMÓVEL'));

          // Pega a chave exata do ITBI 2
          const chaveItbi2 = chaves.find(k => k.toUpperCase().replace(/\s/g, '').includes('2ºIMOVEL') || k.toUpperCase().replace(/\s/g, '').includes('2ºIMÓVEL'));

          let rawItbi1 = chaveItbi1 ? rowObj[chaveItbi1] : getCell(colMap["ITBI + Registro 1º Imóvel"]);
          let rawItbi2 = chaveItbi2 ? rowObj[chaveItbi2] : getCell(colMap["ITBI + Registro 2º Imóvel"]);

          // Trava de segurança: se o valor for igual ao Preço, zera para evitar espelhamento
          if (rawItbi1 === rowObj['PREÇO'] || rawItbi1 === rowObj['Preço'] || (precoNum > 0 && parseCurrency(rawItbi1) === precoNum)) rawItbi1 = 0;
          if (rawItbi2 === rowObj['PREÇO'] || rawItbi2 === rowObj['Preço'] || (precoNum > 0 && parseCurrency(rawItbi2) === precoNum)) rawItbi2 = 0;

          // Sanitização final para float (limpando a moeda R$)
          let itbi1Num = typeof rawItbi1 === 'string' ? parseFloat(rawItbi1.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0 : parseCurrency(rawItbi1);
          let itbi2Num = typeof rawItbi2 === 'string' ? parseFloat(rawItbi2.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0 : parseCurrency(rawItbi2);

          // Filtra linhas inválidas (ex: sem torre/unidade ou linhas de legenda/rodapé)
          if (!torreStr && !unidadeStr) continue;
          if (torreStr.toLowerCase().includes('legenda') || torreStr.toLowerCase().includes('observaç')) continue;

          // Monta o array da linha com os índices padronizados
          const rowData: any = [
            faseStr,
            torreStr,
            unidadeStr,
            areaPrivStr,
            areaQuiStr,
            tipoStr,
            avalNum,
            precoNum,
            itbi1Num,
            itbi2Num > 0 ? itbi2Num : itbi1Num
          ];

          // Sanitização e Aliases de acesso flexível
          const unidadeLida = {
            fase: faseStr,
            torre: torreStr,
            unidade: unidadeStr,
            areaPrivativa: areaPrivStr,
            areaQuintal: areaQuiStr,
            tipologia: tipoStr,
            avaliacao: avalNum,
            preco: precoNum,
            itbi1: itbi1Num,
            itbi2: itbi2Num > 0 ? itbi2Num : itbi1Num,
            itbiPrimeiroImovel: itbi1Num,
            itbiSegundoImovel: itbi2Num > 0 ? itbi2Num : itbi1Num,
            itbiRegistro: itbi1Num,

            // Chaves amigáveis e exatamente como aparecem nas planilhas do Excel:
            'FASE': faseStr,
            'TORRE': torreStr,
            'Torre': torreStr,
            'Bloco': torreStr,
            'BLOCO': torreStr,
            'UNID.': unidadeStr,
            'UNID': unidadeStr,
            'UNIDADE': unidadeStr,
            'Unidade': unidadeStr,
            'APTO': unidadeStr,
            'APT': unidadeStr,
            'ÁREA PRIVATIVA M² - APTO': areaPrivStr,
            'ÁREA PRIVATIVA M²': areaPrivStr,
            'ÁREA PRIVATIVA': areaPrivStr,
            'Area Privativa': areaPrivStr,
            'ÁREA QUINTAL M²': areaQuiStr,
            'ÁREA QUINTAL': areaQuiStr,
            'Quintal': areaQuiStr,
            'TIPOLOGIA': tipoStr,
            'Tipologia': tipoStr,
            'AVALIAÇÃO': avalNum,
            'Avaliação': avalNum,
            'AVALIAÇÃO 05/08/2025': avalNum,
            'PREÇO': precoNum,
            'Preço': precoNum,
            'PREÇO TABELA': precoNum,
            'ITBI + REG. 1º IMÓVEL': itbi1Num,
            'ITBI + REGISTRO 1º IMÓVEL': itbi1Num,
            'ITBI + Registro 1º Imóvel': itbi1Num,
            'ITBI + Registro\n1º Imóvel': itbi1Num,
            'ITBI + Registro\r\n1º Imóvel': itbi1Num,
            'ITBI + Registro  1º Imóvel': itbi1Num,
            'ITBI + REGISTRO': itbi1Num,
            'ITBI': itbi1Num,
            'ITBI + REG. 2º IMÓVEL': itbi2Num > 0 ? itbi2Num : itbi1Num,
            'ITBI + REGISTRO 2º IMÓVEL': itbi2Num > 0 ? itbi2Num : itbi1Num,
            'ITBI + Registro 2º Imóvel': itbi2Num > 0 ? itbi2Num : itbi1Num,
            'ITBI + Registro\n2º Imóvel': itbi2Num > 0 ? itbi2Num : itbi1Num,
            'ITBI + Registro\r\n2º Imóvel': itbi2Num > 0 ? itbi2Num : itbi1Num
          };

          Object.assign(rowData, unidadeLida);
          filteredRows.push(rowData);
        }

        setTempParsedData({
          headers: mappedHeaders,
          rows: filteredRows,
          fileName: file.name
        });

        onShowToast(`Sucesso! ${filteredRows.length} unidades importadas da aba "Estudo (Status)".`);

      } catch (err) {
        console.error(err);
        onShowToast("Erro ao processar a planilha Excel.");
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleClear = () => {
    const monthDefaults = getCurrentMonthDates();
    setTempParsedData(null);
    setValidFrom(monthDefaults.validFrom);
    setValidTo(monthDefaults.validTo);
    setLookupTorre('');
    setLookupUnidade('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProd) return;

    if (!validFrom || !validTo) {
      onShowToast("Preencha as datas de vigência inicial e final.");
      return;
    }

    if (validFrom > validTo) {
      onShowToast("A data inicial não pode ser maior que a data final.");
      return;
    }

    const currentFileName = tempParsedData?.fileName || activeProd.tableInfo?.fileName || `tabela_${activeProd.id}.xlsx`;
    const currentHeaders = tempParsedData?.headers || activeProd.tableInfo?.headers || COLUMN_DEFINITIONS.map(d => d.label);
    const currentRows = tempParsedData?.rows || activeProd.tableInfo?.rows || [];

    const newTableInfo: TableInfo = {
      validFrom,
      validTo,
      fileName: currentFileName,
      headers: currentHeaders,
      rows: currentRows,
      active: true
    };

    onSaveTableInfo(activeProd.id, newTableInfo);
    setTempParsedData(null);
    onShowToast(`Tabela do ${activeProd.name} salva e ativada até ${new Date(validTo + 'T00:00:00').toLocaleDateString('pt-BR')}!`);
  };

  const currentHeaders = tempParsedData?.headers || activeProd?.tableInfo?.headers || [];
  const currentRows = tempParsedData?.rows || activeProd?.tableInfo?.rows || [];
  const currentFileName = tempParsedData?.fileName || activeProd?.tableInfo?.fileName || '';

  // Filter preview table rows by lookup fields
  const displayRows = currentRows.filter(row => {
    const torreCell = String(row[1] || '').toLowerCase();
    const unidadeCell = String(row[2] || '').toLowerCase();

    const matchesTorre = !lookupTorre || torreCell.includes(lookupTorre.toLowerCase().trim());
    const matchesUnidade = !lookupUnidade || unidadeCell.includes(lookupUnidade.toLowerCase().trim());

    return matchesTorre && matchesUnidade;
  });

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-sky-600 font-bold block">
            Gestão de Tabelas de Venda
          </span>
          <h1 className="text-xl font-bold font-heading text-slate-900">
            Importação e Consulta de Tabelas (Excel)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Selecione o empreendimento na lista suspensa, importe a planilha oficial e consulte dados de unidades.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <span>Formatos: .XLSX, .XLS, .CSV</span>
          </span>
        </div>
      </div>

      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        
        {/* SELETOR DE EMPREENDIMENTO */}
        <div className="bg-sky-50/60 p-4 rounded-xl border border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-sky-600 uppercase tracking-wider mb-1.5">
              Selecione o Empreendimento para Importar / Consultar Tabela
            </label>
            <select
              value={activeImportProductId}
              onChange={(e) => onSelectImportProduct(e.target.value)}
              className="w-full bg-white font-bold text-slate-900 border border-slate-300 rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-sky-600 text-xs shadow-xs cursor-pointer"
            >
              {products.map(p => {
                const isActive = p.tableInfo && p.tableInfo.active;
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} {isActive ? ' — ✓ Tabela Vigente' : ' — ⚠️ Sem Tabela Ativa'}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="self-end sm:self-center shrink-0">
            {hasTable ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                  <CheckCircle className="w-3.5 h-3.5" /> Tabela Vigente
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteTable(activeImportProductId)}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-100 transition-all shadow-2xs shrink-0 cursor-pointer"
                  title="Excluir Tabela Vigente"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Tabela</span>
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                <AlertCircle className="w-3.5 h-3.5" /> Sem Tabela Ativa
              </span>
            )}
          </div>
        </div>

        {/* FORMULÁRIO DE IMPORTAÇÃO DA TABELA */}
        <form onSubmit={handleSaveTable} className="space-y-5 text-xs">
          
          {/* PERÍODO DE VALIDADE DA TABELA */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-sky-600" />
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Vigência e Validade da Tabela
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Data Inicial (Início da Validade) *
                </label>
                <input
                  type="date"
                  required
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-sky-600 cursor-pointer"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Data Final (Término da Validade) *
                </label>
                <input
                  type="date"
                  required
                  value={validTo}
                  onChange={(e) => setValidTo(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-sky-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* ARQUIVO DO EXCEL (DROPZONE) */}
          <div className="space-y-2">
            <label className="block font-semibold text-slate-700">
              Arquivo da Tabela de Vendas (Excel / CSV) *
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-sky-200 bg-sky-50/20 hover:bg-sky-50/50 rounded-2xl p-6 text-center transition-all cursor-pointer relative"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 mx-auto rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-900">
                {currentFileName ? currentFileName : "Clique para selecionar ou arraste a planilha aqui"}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Formatos aceitos: Microsoft Excel (.xlsx, .xls) ou CSV — Leitura da aba Estudo (Status)
              </p>
            </div>
          </div>

          {/* CAMPO DE CONSULTA POR TORRE E UNIDADE */}
          <div className="bg-gradient-to-r from-sky-50/80 via-slate-50 to-white p-4 rounded-2xl border border-sky-100 space-y-3">
            <div className="flex items-center justify-between border-b border-sky-100/80 pb-2">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-sky-600" />
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Consultar Unidade na Tabela
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setLookupTorre(''); setLookupUnidade(''); }}
                className="text-[10px] font-semibold text-slate-500 hover:text-sky-600 flex items-center gap-1 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" /> Limpar Filtros
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Torre / Bloco
                </label>
                <input
                  type="text"
                  value={lookupTorre}
                  onChange={(e) => setLookupTorre(e.target.value)}
                  placeholder="Ex: Torre A, Bloco 1..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-sky-600 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Unidade
                </label>
                <input
                  type="text"
                  value={lookupUnidade}
                  onChange={(e) => setLookupUnidade(e.target.value)}
                  placeholder="Ex: 101, 202, 304..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sky-600 focus:outline-none focus:border-sky-600 text-xs"
                />
              </div>
            </div>

            {/* PAINEL RESULTADO DA CONSULTA DE UNIDADE */}
            {(lookupTorre || lookupUnidade) && (
              <div className="bg-white p-3.5 rounded-xl border border-sky-200 space-y-2 mt-2 shadow-2xs">
                {displayRows.length === 1 ? (
                  <div>
                    <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-sky-600 bg-sky-100 px-2.5 py-0.5 rounded-md uppercase">
                          {displayRows[0][1] || 'Torre'}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          Unidade {displayRows[0][2] || '-'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          ({displayRows[0][0] || '1ª Fase'})
                        </span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Localizada na Tabela
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
                      <div>
                        <span className="block text-[10px] text-slate-400 font-medium">Preço Tabela:</span>
                        <strong className="text-slate-900 font-bold">{formatCurrency(typeof displayRows[0][7] === 'number' ? displayRows[0][7] : 0)}</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 font-medium">Avaliação Banco:</span>
                        <strong className="text-emerald-600 font-bold">{formatCurrency(typeof displayRows[0][6] === 'number' ? displayRows[0][6] : 0)}</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 font-medium">ITBI + Reg. 1º Imóvel:</span>
                        <strong className="text-sky-600 font-bold">{formatCurrency(typeof displayRows[0][8] === 'number' ? displayRows[0][8] : 0)}</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 font-medium">ITBI + Reg. 2º Imóvel:</span>
                        <strong className="text-amber-700 font-bold">{formatCurrency(typeof displayRows[0][9] === 'number' ? displayRows[0][9] : 0)}</strong>
                      </div>
                    </div>
                  </div>
                ) : displayRows.length > 1 ? (
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Busca encontrou <strong className="text-sky-600 font-bold">{displayRows.length} unidades</strong> correspondentes.</span>
                    <span className="text-[10px] text-slate-400">Refine a Unidade para ver a ficha detalhada</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-rose-600 font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Nenhuma unidade encontrada para os filtros especificadas.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PRÉ-VISUALIZAÇÃO DA TABELA IMPORTADA & BOTÕES DE AÇÃO NO TOPO */}
          {currentHeaders.length > 0 && currentRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <TableIcon className="w-4 h-4 text-emerald-600" />
                    Pré-visualização do Conteúdo Importado ({displayRows.length} de {currentRows.length} unidades)
                  </span>
                  {currentFileName && (
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                      Arquivo: {currentFileName}
                    </span>
                  )}
                </div>

                {/* BOTÕES DE AÇÃO NO TOPO DA PRÉ-VISUALIZAÇÃO */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold text-xs transition-all cursor-pointer"
                  >
                    Limpar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Salvar e Ativar Tabela</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white max-h-[480px]">
                <table className="w-full text-left text-[11px] text-slate-700">
                  <thead className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase sticky top-0 shadow-2xs z-10">
                    <tr>
                      {currentHeaders.map((h, i) => (
                        <th key={i} className="p-2.5 font-bold border-b border-slate-200 whitespace-nowrap bg-slate-100 text-slate-700">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-sky-50/50 transition-colors">
                        {currentHeaders.map((headerName, cIdx) => {
                          let val = row[cIdx] !== undefined && row[cIdx] !== null ? row[cIdx] : '';
                          const hUpper = headerName.toUpperCase();
                          const isCurrencyCol = hUpper.includes('PREÇO') || hUpper.includes('PRECO') || hUpper.includes('AVALIAÇÃO') || hUpper.includes('AVALIACAO') || hUpper.includes('ITBI');

                          if (isCurrencyCol) {
                            if (typeof val === 'number') {
                              val = formatCurrency(val);
                            } else if (typeof val === 'string' && val && !val.includes('R$')) {
                              const num = parseFloat(val.replace(/[^\d.,]/g, '').replace(',', '.'));
                              if (!isNaN(num) && num > 0) {
                                val = formatCurrency(num);
                              }
                            }
                          }

                          let cellClass = "p-2.5 font-medium border-b border-slate-100 whitespace-nowrap";
                          if (hUpper.includes('UNIDADE')) cellClass += " font-bold text-sky-600";
                          if (hUpper.includes('TORRE')) cellClass += " font-semibold text-slate-800";
                          if (isCurrencyCol) cellClass += " font-semibold text-slate-900";

                          return (
                            <td key={cIdx} className={cellClass}>
                              {String(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CASO NÃO HAJA CONTEÚDO DE PRÉ-VISUALIZAÇÃO, MOSTRAR OS BOTÕES ABAIXO TAMBÉM */}
          {(!currentHeaders.length || !currentRows.length) && (
            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-all cursor-pointer"
              >
                Limpar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Salvar e Ativar Tabela</span>
              </button>
            </div>
          )}

        </form>
      </div>
    </div>
  );
};
