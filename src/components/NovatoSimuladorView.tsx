import React, { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, Download, Pencil, Plus, Minus } from 'lucide-react';
import logoMorar from '../assets/brand';
import { CommercialCondition, PdfExportSettings, Product, SimulationData } from '../types';
import { formatCurrency, parseCurrency } from '../utils/formatters';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Bar, LabelList } from 'recharts';
import { MorarBarDatum, MorarFaixa, MorarPieDatum } from './PdfExportModalMorar';

// Visão simplificada da Ficha Morar para o perfil "Corretor Novato": mesmo
// "papel" (visual de folha A4) e os mesmos dados já calculados pelo motor em
// FichaMorar.tsx — só uma apresentação mais guiada, com um subconjunto restrito
// de campos tornados interativos (Torre/Unidade, Ato Premiado, Ato e as
// parcelas de Obra/Pós-Obra). Nenhuma conta é refeita aqui: cada affordance
// chama de volta os mesmos handlers já usados pelo editor completo.
interface NovatoSimuladorViewProps {
  pdfSettings: PdfExportSettings;
  product: Product;
  condition: CommercialCondition;
  simulationData: SimulationData;

  selectedTorre: string;
  selectedUnidade: string;
  availableTorres: string[];
  filteredUnits: string[];
  onTorreChange: (torre: string) => void;
  onUnidadeChange: (unidade: string) => void;

  fase: string;
  tipologia: string;
  areaPriv: string;
  areaQuintal: string;
  price: number;
  precoTabelaOriginal: number;
  evaluation: number;
  deliveryText: string;

  income: number;
  subsidy: number;
  fgts: number;
  desconto: number;
  maxFinanc: number;
  totalNegoc: number;
  sinalTotal: number;
  comITBI: number;
  distribuido: number;

  isAtoPremiadoEnabled: boolean;
  onToggleAtoPremiado: (ativo: boolean) => void;

  dataAto: string;
  valorAto: number;
  valorAtoMinimo: number;
  valorAtoMaximo: number;
  onAtoChange: (novoValor: number | null) => void;
  comissaoApartadaValor?: number;
  comissaoApartadaParcelasQtd?: number;
  comissaoApartadaParcelaValor?: number;

  dataObra: string;
  totalParcObra: number;
  faixasObra: MorarFaixa[];
  onObraTotalChange: (newTotal: number) => void;

  dataPos: string;
  totalParcPos: number;
  faixasPos: MorarFaixa[];
  onPosTotalChange: (newTotal: number) => void;

  dataITBI: string;
  valorITBI: number;
  itbiObraQtd: number;
  itbiObraValor: number;
  itbiPosQtd: number;
  itbiPosValor: number;

  baseLiquidaComITBI: number;
  baseRendaInformada: number;
  limiteMaximoRiscoRenda: number;
  limiteMaximoProSoluto: number;
  pctRiscoParcelaRenda: number;
  valorRiscoParcela: number;
  pctRiscoProSoluto: number;
  valorRiscoProSoluto: number;
  pieDataPct: MorarPieDatum[];
  pieDataValor: MorarPieDatum[];
  barData: MorarBarDatum[];

  onShowToast: (msg: string) => void;
  onBackToSimulator: () => void;
  onOpenPdfExport: () => void;
}

export const NovatoSimuladorView: React.FC<NovatoSimuladorViewProps> = ({
  pdfSettings,
  product,
  condition,
  simulationData,
  selectedTorre,
  selectedUnidade,
  availableTorres,
  filteredUnits,
  onTorreChange,
  onUnidadeChange,
  fase,
  tipologia,
  areaPriv,
  areaQuintal,
  precoTabelaOriginal,
  evaluation,
  deliveryText,
  income,
  subsidy,
  fgts,
  desconto,
  maxFinanc,
  totalNegoc,
  sinalTotal,
  comITBI,
  distribuido,
  isAtoPremiadoEnabled,
  onToggleAtoPremiado,
  dataAto,
  valorAto,
  valorAtoMinimo,
  valorAtoMaximo,
  onAtoChange,
  comissaoApartadaValor = 0,
  comissaoApartadaParcelasQtd = 0,
  comissaoApartadaParcelaValor = 0,
  dataObra,
  totalParcObra,
  faixasObra,
  onObraTotalChange,
  dataPos,
  totalParcPos,
  faixasPos,
  onPosTotalChange,
  dataITBI,
  valorITBI,
  itbiObraQtd,
  itbiObraValor,
  itbiPosQtd,
  itbiPosValor,
  baseLiquidaComITBI,
  baseRendaInformada,
  limiteMaximoRiscoRenda,
  limiteMaximoProSoluto,
  pctRiscoParcelaRenda,
  valorRiscoParcela,
  pctRiscoProSoluto,
  valorRiscoProSoluto,
  pieDataPct,
  pieDataValor,
  barData,
  onShowToast,
  onBackToSimulator,
  onOpenPdfExport
}) => {
  const fmt = (val: number) => (pdfSettings.mostrarValores ? formatCurrency(val) : '—');

  // Edição do Ato (Imóvel): mesma trava de piso/teto do editor completo
  // (ver FluxoEntradaConstrutora.handleFinishAtoEdit), só que replicada aqui
  // em cima do valor JÁ CONVERTIDO (bruto/líquido de comissão apartada) que a
  // FichaMorar passa via `valorAto`/`onAtoChange`.
  const [isEditingAto, setIsEditingAto] = useState<boolean>(false);
  const [atoInputText, setAtoInputText] = useState<string>('');

  useEffect(() => {
    if (!isEditingAto) {
      setAtoInputText(valorAto > 0 ? formatCurrency(valorAto) : '');
    }
  }, [valorAto, isEditingAto]);

  const parseFlexible = (raw: string): number => {
    if (!raw || raw.trim() === '') return 0;
    const parsed = parseCurrency(raw);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleFinishAtoEdit = (rawText: string) => {
    setIsEditingAto(false);
    const parsed = parseFlexible(rawText);

    if (rawText.trim() === '' || parsed === 0) {
      if (valorAtoMinimo > 0) {
        onAtoChange(null);
        setAtoInputText(formatCurrency(valorAtoMinimo));
        onShowToast(`Ato (Imóvel) ajustado para o Sinal Mínimo Sugerido de ${formatCurrency(valorAtoMinimo)}.`);
      } else {
        onAtoChange(null);
        setAtoInputText('');
      }
      return;
    }

    if (valorAtoMinimo > 0 && parsed < valorAtoMinimo - 0.01) {
      onAtoChange(valorAtoMinimo);
      setAtoInputText(formatCurrency(valorAtoMinimo));
      onShowToast(`O valor informado (${formatCurrency(parsed)}) é inferior ao Sinal Mínimo Sugerido (${formatCurrency(valorAtoMinimo)}). Valor ajustado.`);
      return;
    }

    if (valorAtoMaximo > 0 && parsed > valorAtoMaximo + 0.01) {
      onAtoChange(valorAtoMaximo);
      setAtoInputText(formatCurrency(valorAtoMaximo));
      onShowToast(`O valor informado excede o saldo total. O Ato foi ajustado para ${formatCurrency(valorAtoMaximo)}.`);
      return;
    }

    onAtoChange(parsed);
    setAtoInputText(formatCurrency(parsed));
  };

  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, payload }: any) => {
    if (payload.value <= 0) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="normal">
        {payload.label}
      </text>
    );
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">

      {/* BARRA SUPERIOR — modo simplificado */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onBackToSimulator}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-bold uppercase tracking-wide">
            Modo Simplificado — Corretor Novato
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenPdfExport}
          className="px-3.5 py-1.5 bg-morar-600 hover:bg-morar-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar Ficha PDF
        </button>
      </div>

      {/* "FOLHA" — mesmo visual da Ficha de Exportação, com affordances de edição */}
      <div className="bg-white p-6 sm:p-7 rounded-xl shadow-md border border-slate-200 w-full text-slate-900 space-y-3.5">

        {/* 1. TOPO */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-morar-50 border border-morar-200 flex items-center justify-center shrink-0">
              <img src={logoMorar} alt="Morar" className="w-5 h-5 object-contain" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">
                Simulação Comercial
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-medium">
                <span>Empreendimento: <strong className="text-slate-900 font-bold">{product.name}</strong></span>
                <span>•</span>
                <span>Condição: <strong className="text-slate-900 font-bold">{condition.name}</strong></span>
                {deliveryText && (
                  <>
                    <span>•</span>
                    <span className="text-amber-700 font-bold">Chaves: {deliveryText}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {pdfSettings.mostrarDataSimulacao && (
            <div className="bg-morar-50 text-morar-700 border border-morar-200 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shadow-2xs shrink-0 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-morar-600 shrink-0" />
              <span>Data da Simulação: {new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          )}
        </div>

        {/* BARRA DE CLIENTE E IMOBILIÁRIA */}
        {(pdfSettings.mostrarCliente || pdfSettings.mostrarImobiliaria) && (
          <div className="bg-[rgba(248,250,252,0.9)] px-3.5 py-2 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between text-xs gap-2">
            <div className="flex items-center justify-between w-full flex-wrap gap-2">
              {pdfSettings.mostrarCliente && (
                <span className="text-slate-600 font-medium">
                  Cliente: <strong className="text-slate-900 font-bold">{simulationData.clientName || 'Cliente Não Informado'}</strong>
                </span>
              )}
              {pdfSettings.mostrarImobiliaria && (
                <span className="text-slate-600 font-medium">
                  Imobiliária: <strong className="text-slate-900 font-bold">{simulationData.agency?.trim() || 'Imobiliária Não Informada'}</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* 2. RESUMO DA UNIDADE — Torre/Unidade viram seletores */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 overflow-hidden w-full">
          <div className="grid grid-cols-12 gap-2 text-xs w-full">
            <div className="col-span-3 bg-[rgba(240,249,255,0.6)] p-2 rounded-lg border border-morar-200 min-w-0 relative">
              <span className="flex items-center gap-1 text-[9px] text-morar-700 font-bold uppercase mb-0.5 whitespace-nowrap">
                Torre <Pencil className="w-2.5 h-2.5" />
              </span>
              <select
                value={selectedTorre}
                onChange={(e) => onTorreChange(e.target.value)}
                className="w-full bg-white text-slate-900 font-bold text-xs rounded-md border border-morar-200 px-1.5 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-morar-300"
              >
                <option value="">Selecione</option>
                {availableTorres.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="col-span-3 bg-[rgba(240,249,255,0.6)] p-2 rounded-lg border border-morar-200 min-w-0 relative">
              <span className="flex items-center gap-1 text-[9px] text-morar-700 font-bold uppercase mb-0.5 whitespace-nowrap">
                Unidade <Pencil className="w-2.5 h-2.5" />
              </span>
              <select
                value={selectedUnidade}
                onChange={(e) => onUnidadeChange(e.target.value)}
                disabled={!selectedTorre}
                className="w-full bg-white text-slate-900 font-bold text-xs rounded-md border border-morar-200 px-1.5 py-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-morar-300"
              >
                <option value="">Selecione</option>
                {filteredUnits.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="col-span-2 bg-slate-50 p-2 rounded-lg border border-[rgba(226,232,240,0.6)] flex flex-col items-center justify-center text-center min-w-0">
              <span className="block text-[9px] text-slate-400 font-medium mb-0.5 whitespace-nowrap">Fase</span>
              <strong className="text-slate-700 font-bold text-xs whitespace-nowrap truncate w-full">{fase || '-'}</strong>
            </div>

            <div className="col-span-4 bg-slate-50 p-2 rounded-lg border border-[rgba(226,232,240,0.6)] flex flex-col items-center justify-center text-center min-w-0">
              <span className="block text-[9px] text-slate-400 font-medium mb-0.5 whitespace-nowrap">Tipologia</span>
              <strong className="text-slate-700 font-bold text-xs whitespace-nowrap truncate w-full" title={tipologia}>{tipologia || '-'}</strong>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2 text-xs w-full">
            <div className="col-span-2 bg-slate-50 p-2 rounded-lg border border-[rgba(226,232,240,0.6)] flex flex-col items-center justify-center text-center min-w-0">
              <span className="block text-[9px] text-slate-400 font-medium mb-0.5 whitespace-nowrap">Área Privativa</span>
              <strong className="text-slate-700 font-bold text-xs whitespace-nowrap truncate w-full">{areaPriv}</strong>
            </div>
            <div className="col-span-2 bg-slate-50 p-2 rounded-lg border border-[rgba(226,232,240,0.6)] flex flex-col items-center justify-center text-center min-w-0">
              <span className="block text-[9px] text-slate-400 font-medium mb-0.5 whitespace-nowrap">Quintal</span>
              <strong className="text-slate-700 font-bold text-xs whitespace-nowrap truncate w-full">{areaQuintal}</strong>
            </div>
            <div className="col-span-4 bg-slate-50 p-2 rounded-lg border border-[rgba(226,232,240,0.6)] flex flex-col items-center justify-center text-center min-w-0">
              <span className="block text-[9px] text-slate-400 font-medium mb-0.5 whitespace-nowrap">Preço de Tabela</span>
              <strong className="text-slate-900 font-bold text-xs whitespace-nowrap truncate w-full">{fmt(precoTabelaOriginal)}</strong>
            </div>
            <div className="col-span-4 bg-slate-50 p-2 rounded-lg border border-[rgba(226,232,240,0.6)] flex flex-col items-center justify-center text-center min-w-0">
              <span className="block text-[9px] text-slate-400 font-medium mb-0.5 whitespace-nowrap">Avaliação Bancária</span>
              <strong className="text-emerald-600 font-bold text-xs whitespace-nowrap truncate w-full">{fmt(evaluation)}</strong>
            </div>
          </div>
        </div>

        {/* GRID PRINCIPAL: 2 COLUNAS */}
        <div className="grid grid-cols-2 gap-3.5 items-start">

          {/* ================= COLUNA DA ESQUERDA ================= */}
          <div className="space-y-3">
            {pdfSettings.mostrarBloco1 && (
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-morar-600" />
                  Dados da Aprovação de Crédito
                </h3>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 px-1">
                    <span className="text-slate-600 font-medium">Renda:</span>
                    <strong className="text-slate-900 font-semibold">{fmt(income)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 px-1">
                    <span className="text-slate-600 font-medium">Subsídio:</span>
                    <strong className="text-emerald-600 font-semibold">{fmt(subsidy)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 px-1">
                    <span className="text-slate-600 font-medium">FGTS:</span>
                    <strong className="text-morar-600 font-semibold">{fmt(fgts)}</strong>
                  </div>

                  {/* ATO PREMIADO — toggle clicável */}
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 px-1">
                    <span className="text-slate-600 font-medium flex items-center gap-1.5">
                      Ato Premiado:
                      <button
                        type="button"
                        onClick={() => onToggleAtoPremiado(!isAtoPremiadoEnabled)}
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                          isAtoPremiadoEnabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        }`}
                        title="Clique para ativar ou desativar o Ato Premiado"
                      >
                        {isAtoPremiadoEnabled ? 'Ativo' : 'Inativo'}
                      </button>
                    </span>
                    <strong className="text-emerald-600 font-semibold">{fmt(desconto)}</strong>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-slate-100 px-1">
                    <span className="text-slate-600 font-medium">Max Financ:</span>
                    <strong className="text-morar-700 font-bold">{fmt(maxFinanc)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 px-1">
                    <span className="text-slate-600 font-medium">Total Negoc:</span>
                    <strong className="text-slate-900 font-bold">{fmt(totalNegoc)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 px-1">
                    <span className="text-slate-600 font-medium">Sinal Total (s/ ITBI):</span>
                    <strong className="text-amber-700 font-bold">{fmt(sinalTotal)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 px-1">
                    <span className="text-slate-600 font-medium">Com ITBI:</span>
                    <strong className="text-emerald-700 font-bold">{fmt(comITBI)}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 bg-morar-50 px-2.5 rounded-lg border border-morar-100 mt-2">
                    <span className="text-xs font-bold text-slate-800">Distribuído:</span>
                    <strong className="text-xs sm:text-sm font-black text-morar-700">{fmt(distribuido)}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* CORREÇÃO IGPM+1% (TAXAS E REGISTRO / ITBI) */}
            {pdfSettings.mostrarBloco3 && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Correção IGPM+1% (Taxas e Registro)
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500">
                    A partir de: <strong className="text-slate-800">{dataITBI}</strong>
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center bg-[rgba(236,253,245,0.5)] px-2.5 py-1 rounded-lg border border-emerald-100">
                    <span className="text-emerald-900 font-semibold text-[11px]">ITBI / Registro Total:</span>
                    <strong className="text-emerald-800 font-bold">{fmt(valorITBI)}</strong>
                  </div>
                  <div className={`grid ${itbiPosQtd > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 text-[11px]`}>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                      <span className="text-slate-500 font-medium block text-[10px]">Obra ({itbiObraQtd}X)</span>
                      <strong className="text-slate-900 font-bold block">{fmt(itbiObraValor)}</strong>
                    </div>
                    {itbiPosQtd > 0 && (
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                        <span className="text-slate-500 font-medium block text-[10px]">Pós Obra ({itbiPosQtd}X)</span>
                        <strong className="text-slate-900 font-bold block">{fmt(itbiPosValor)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ================= COLUNA DA DIREITA ================= */}
          <div className="space-y-3">
            {pdfSettings.mostrarBloco3 && (<>
              {/* CARD: PERÍODO DE PAGAMENTOS (ATO) — valor editável */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-morar-600" />
                    Período de Pagamentos
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500">
                    A partir de: <strong className="text-slate-800">{dataAto}</strong>
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-morar-200 text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    Ato: <Pencil className="w-2.5 h-2.5 text-morar-600" />
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={atoInputText}
                    onFocus={() => setIsEditingAto(true)}
                    onChange={(e) => setAtoInputText(e.target.value)}
                    onBlur={(e) => handleFinishAtoEdit(e.target.value)}
                    placeholder={formatCurrency(valorAtoMinimo)}
                    className="text-right bg-white text-slate-900 font-black text-xs sm:text-sm rounded-md border border-morar-200 px-2 py-1 w-32 focus:outline-none focus:ring-2 focus:ring-morar-300"
                  />
                </div>
                <p className="text-[10px] text-slate-400 px-1">
                  Sinal Mínimo Sugerido: <strong className="text-slate-500">{formatCurrency(valorAtoMinimo)}</strong>
                </p>

                {comissaoApartadaValor > 0 && (
                  <div className="flex items-center justify-between bg-fuchsia-50 px-3 py-2 rounded-lg border border-fuchsia-100 text-xs">
                    <span className="font-bold text-fuchsia-700">Comissão Apartada ({comissaoApartadaParcelasQtd}x):</span>
                    <strong className="text-fuchsia-800 font-black text-xs sm:text-sm">
                      {fmt(comissaoApartadaValor)} <span className="font-semibold">({fmt(comissaoApartadaParcelaValor)}/mês)</span>
                    </strong>
                  </div>
                )}
              </div>

              {/* CARD: CORREÇÃO INCC - OBRA — stepper de parcelas */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Correção INCC - Obra
                    </h3>
                    <div className="flex items-center gap-1 bg-morar-50 border border-morar-200 rounded-lg px-1 py-0.5">
                      <button
                        type="button"
                        onClick={() => onObraTotalChange(totalParcObra - 1)}
                        disabled={totalParcObra <= 0}
                        className="w-4 h-4 flex items-center justify-center rounded bg-white text-morar-700 border border-morar-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-morar-100 cursor-pointer"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <span className="text-[10px] font-extrabold text-morar-700 w-8 text-center">{totalParcObra}X</span>
                      <button
                        type="button"
                        onClick={() => onObraTotalChange(totalParcObra + 1)}
                        className="w-4 h-4 flex items-center justify-center rounded bg-white text-morar-700 border border-morar-200 hover:bg-morar-100 cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">
                    A partir de: <strong className="text-slate-800">{dataObra}</strong>
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {faixasObra.filter(f => (f.qtd > 0 && ((f.valor || 0) > 0 || (itbiObraValor || 0) > 0))).map((f, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-[rgba(248,250,252,0.8)] px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-600 font-semibold text-[11px]">{f.qtd}X de:</span>
                      <strong className="text-slate-900 font-bold text-xs">{fmt(f.valor)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* CARD: CORREÇÃO IPCA+1% - PÓS — stepper de parcelas */}
              {totalParcPos > 0 && (
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Correção IPCA+1% - Pós
                      </h3>
                      <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded-lg px-1 py-0.5">
                        <button
                          type="button"
                          onClick={() => onPosTotalChange(totalParcPos - 1)}
                          disabled={totalParcPos <= 0}
                          className="w-4 h-4 flex items-center justify-center rounded bg-white text-indigo-700 border border-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-100 cursor-pointer"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-[10px] font-extrabold text-indigo-700 w-8 text-center">{totalParcPos}X</span>
                        <button
                          type="button"
                          onClick={() => onPosTotalChange(totalParcPos + 1)}
                          className="w-4 h-4 flex items-center justify-center rounded bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500">
                      A partir de: <strong className="text-slate-800">{dataPos}</strong>
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {faixasPos.filter(f => (f.qtd > 0 && ((f.valor || 0) > 0 || (itbiPosValor || 0) > 0))).map((f, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-[rgba(248,250,252,0.8)] px-2.5 py-1.5 rounded-lg border border-slate-100">
                        <span className="text-slate-600 font-semibold text-[11px]">{f.qtd}X de:</span>
                        <strong className="text-slate-900 font-bold text-xs">{fmt(f.valor)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>)}
          </div>
        </div>

        {/* 3. INDICADORES DE RISCO / COMPROMETIMENTO (GRÁFICOS NO RODAPÉ) */}
        {pdfSettings.mostrarBloco4 && (
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-1.5 gap-1">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-morar-600" />
                Indicadores de Risco / Comprometimento
              </h3>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                <span>Base Líq. c/ ITBI: <strong className="text-slate-800">{fmt(baseLiquidaComITBI)}</strong></span>
                <span>•</span>
                <span>Base Renda: <strong className="text-slate-800">{fmt(baseRendaInformada)}</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-600 uppercase mb-1">Percentual de Risco por Fase</span>
                <div className="w-28 h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie data={pieDataPct} dataKey="value" cx="50%" cy="50%" innerRadius={0} outerRadius={52} stroke="#ffffff" strokeWidth={2} startAngle={270} endAngle={-90} labelLine={false} label={renderPieLabel} isAnimationActive={false}>
                        {pieDataPct.map((entry, idx) => <Cell key={`pct-${idx}`} fill={entry.fill} />)}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-600 uppercase mb-1">Volume Financeiro por Fase (R$)</span>
                <div className="w-28 h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie data={pieDataValor} dataKey="value" cx="50%" cy="50%" innerRadius={0} outerRadius={52} stroke="#ffffff" strokeWidth={2} startAngle={270} endAngle={-90} labelLine={false} label={renderPieLabel} isAnimationActive={false}>
                        {pieDataValor.map((entry, idx) => <Cell key={`valor-${idx}`} fill={entry.fill} />)}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 text-[10px] font-medium text-slate-500 flex-wrap pt-1 border-t border-[rgba(226,232,240,0.6)]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0284C7]" />Total Obra</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#7C3AED]" />Total Pós-Obra</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#059669]" />Total Pró-Soluto</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">1ª Parcela:</span>
                  <strong className="text-slate-900 font-bold">{fmt(valorRiscoParcela)}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Comprometimento da Renda:</span>
                  <strong className={`font-bold ${pctRiscoParcelaRenda > limiteMaximoRiscoRenda ? 'text-red-600' : 'text-morar-700'}`}>
                    {pctRiscoParcelaRenda < 10 && pctRiscoParcelaRenda > 0 ? pctRiscoParcelaRenda.toFixed(2) : pctRiscoParcelaRenda.toFixed(1)}%
                  </strong>
                </div>
              </div>
              <div className="bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Pró-Soluto Total (R$):</span>
                  <strong className="text-slate-900 font-bold">{fmt(valorRiscoProSoluto)}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Pró-Soluto Total (%):</span>
                  <strong className={`font-bold ${pctRiscoProSoluto > limiteMaximoProSoluto ? 'text-red-600' : 'text-emerald-700'}`}>
                    {pctRiscoProSoluto < 10 && pctRiscoProSoluto > 0 ? pctRiscoProSoluto.toFixed(2) : pctRiscoProSoluto.toFixed(2)}%
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RODAPÉ OFICIAL MORAR / CAIXA */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10.5px] text-slate-600 leading-relaxed text-justify mt-3 shadow-2xs">
          <strong>Informações importantes:</strong> Os resultados obtidos representam apenas uma simulação e não valem como proposta, pois estão sujeitos a alterações de acordo com a apuração da capacidade de pagamento e a aprovação de crédito a ser efetuada pela CAIXA e MORAR. Poderão haver alterações das taxas e das demais condições, sem aviso prévio. A contratação está condicionada à disponibilidade de recursos para sua região e ao atendimento das exigências do PMCMV.
        </div>
      </div>
    </div>
  );
};
