import React, { useEffect, useState } from 'react';
import { FileOutput, FileCheck2, Coins, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { Cargo, PdfConditionKind, PdfExportSettings, PdfExportSettingsByKind } from '../types';
import { DEFAULT_PDF_EXPORT_SETTINGS } from '../utils/pdfExport';
import { pdfPermissoesService } from '../services/pdfPermissoesService';
import { CARGOS } from '../config/telasApp';

interface PdfExportSettingsViewProps {
  onShowToast: (message: string) => void;
  // Só o Administrador consegue de fato gravar (o banco também barra — ver
  // RLS em pdfPermissoesService.ts); aqui é só pra já mostrar a tela como
  // somente-leitura pra quem não pode editar, sem precisar tentar salvar.
  podeEditar: boolean;
}

interface BlocoMeta {
  title: string;
  description: string;
}

interface KindMeta {
  kind: PdfConditionKind;
  label: string;
  icon: typeof FileCheck2;
  bloco1: BlocoMeta;
  bloco2: BlocoMeta;
  bloco3: BlocoMeta;
  bloco4: BlocoMeta;
}

const KIND_META: KindMeta[] = [
  {
    kind: 'banco-direto',
    label: 'Sinal c/ Banco Direto',
    icon: FileCheck2,
    bloco1: { title: 'Bloco 1 — Dados da Aprovação de Crédito', description: 'Renda, subsídio, FGTS, financiamento e sinal.' },
    bloco2: { title: 'Bloco 2 — Fluxo de Entrada c/ Construtora', description: 'Ato do imóvel, ITBI no ato, ato premiado e mensais.' },
    bloco3: { title: 'Bloco 3 — Parcelamento Pró-Soluto / Banco Direto', description: 'Quantidade e valor das parcelas, taxa e despesas cartorárias.' },
    bloco4: { title: 'Bloco 4 — Indicadores de Risco / Comprometimento', description: 'Gráficos de risco parcela/renda e risco pró-soluto total.' },
  },
  {
    kind: 'sinal-morar',
    label: 'Sinal c/ Morar',
    icon: FileCheck2,
    bloco1: { title: 'Bloco 1 — Dados da Aprovação de Crédito', description: 'Renda, subsídio, FGTS, ato premiado, financiamento e sinal distribuído.' },
    bloco2: { title: 'Bloco 2 — Comprometimento por Série', description: 'Gráfico de barras do comprometimento (parcela/renda) por série.' },
    bloco3: { title: 'Bloco 3 — Período de Pagamentos', description: 'Ato, correção INCC (obra), correção IPCA (pós) e ITBI/registro.' },
    bloco4: { title: 'Bloco 4 — Indicadores de Risco / Comprometimento', description: 'Gráficos de risco por fase e volume financeiro por fase.' },
  },
  {
    kind: 'parcelamento-morar',
    label: 'Parcelamento Morar',
    icon: Coins,
    bloco1: { title: 'Bloco 1 — Dados da Aprovação de Crédito', description: 'Renda, subsídio, FGTS, desconto do ato, financiamento e sinal.' },
    bloco2: { title: 'Bloco 2 — Fluxo de Entrada c/ Construtora', description: 'Ato do imóvel, ITBI no ato, ato premiado e mensais.' },
    bloco3: { title: 'Bloco 3 — Parcelamento Morar', description: 'Mensal de obra, intermediárias semestrais, parcela chaves e pós-obra.' },
    bloco4: { title: 'Bloco 4 — Percentuais de Comprometimento', description: 'Gráfico com o percentual de cada componente sobre o imóvel/renda.' },
  },
];

const Toggle: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={onChange}
    className={`relative w-[38px] h-[22px] rounded-full transition-colors shrink-0 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${
      checked ? 'bg-sky-600' : 'bg-slate-300'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform ${
        checked ? 'translate-x-[16px]' : 'translate-x-0'
      }`}
    />
  </button>
);

const SettingRow: React.FC<{
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}> = ({ title, description, checked, onChange, disabled }) => (
  <div className="flex items-center justify-between gap-4 py-3 px-3.5 border-b border-slate-100 last:border-b-0">
    <div className="min-w-0">
      <p className="text-xs font-bold text-slate-800">{title}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
    </div>
    <Toggle checked={checked} onChange={onChange} disabled={disabled} />
  </div>
);

export const PdfExportSettingsView: React.FC<PdfExportSettingsViewProps> = ({ onShowToast, podeEditar }) => {
  const [carregando, setCarregando] = useState(true);
  const [todasConfiguracoes, setTodasConfiguracoes] = useState<Partial<Record<Cargo, PdfExportSettingsByKind>>>({});
  const [activeCargo, setActiveCargo] = useState<Cargo>('Corretor');
  const [activeKind, setActiveKind] = useState<PdfConditionKind>('banco-direto');

  useEffect(() => {
    (async () => {
      setCarregando(true);
      const dados = await pdfPermissoesService.carregarTodasAsConfiguracoes();
      setTodasConfiguracoes(dados);
      setCarregando(false);
    })();
  }, []);

  const activeMeta = KIND_META.find(m => m.kind === activeKind)!;
  const activeSettings: PdfExportSettings = todasConfiguracoes[activeCargo]?.[activeKind] ?? DEFAULT_PDF_EXPORT_SETTINGS;

  const updateSetting = async (field: keyof PdfExportSettings, value: boolean) => {
    if (!podeEditar) return;
    const anterior = todasConfiguracoes;
    const novoSettings: PdfExportSettings = { ...activeSettings, [field]: value };
    setTodasConfiguracoes(prev => ({
      ...prev,
      [activeCargo]: { ...(prev[activeCargo] || {}), [activeKind]: novoSettings } as PdfExportSettingsByKind
    }));
    const res = await pdfPermissoesService.salvarConfiguracaoDoCargo(activeCargo, activeKind, novoSettings);
    if (!res.success) {
      setTodasConfiguracoes(anterior);
      onShowToast(`Erro ao salvar: ${res.error || 'erro desconhecido'}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">
      {/* CABEÇALHO */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-sky-100 text-sky-700">
          <FileOutput className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Configurar Exportação de PDF</h1>
          <p className="text-xs text-slate-500 font-medium">
            Escolha, por cargo e por condição comercial, o que a ficha exportada em PDF deve conter e apresentar.
          </p>
        </div>
      </div>

      {!podeEditar && (
        <div className="p-3.5 rounded-xl border bg-amber-50 border-amber-200 text-amber-800 flex items-start gap-2.5 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Só Administradores podem alterar essa configuração. Você pode visualizar o que está definido para cada cargo.</span>
        </div>
      )}

      {/* SELETOR DE CARGO */}
      <div>
        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 px-1">Cargo</label>
        <select
          value={activeCargo}
          onChange={e => setActiveCargo(e.target.value as Cargo)}
          className="w-full sm:w-64 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white shadow-xs"
        >
          {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* SELETOR DE CONDIÇÃO COMERCIAL */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex gap-2">
        {KIND_META.map(meta => {
          const Icon = meta.icon;
          const isActive = meta.kind === activeKind;
          return (
            <button
              key={meta.kind}
              type="button"
              onClick={() => setActiveKind(meta.kind)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs'
                  : 'text-slate-500 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      {carregando ? (
        <div className="p-10 text-center text-sm text-slate-400">Carregando configurações...</div>
      ) : (
        <>
          {/* AVISO: VALORES OCULTOS */}
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
              activeSettings.mostrarValores
                ? 'bg-slate-50 border-slate-200 text-slate-600'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {activeSettings.mostrarValores ? (
              <Eye className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <EyeOff className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>
              {activeSettings.mostrarValores
                ? `Todos os valores em R$ aparecem normalmente na ficha exportada por ${activeCargo} nesta condição.`
                : `Os valores em R$ ficam ocultos (substituídos por "—") na ficha exportada por ${activeCargo} nesta condição.`}
            </span>
          </div>

          {/* BLOCO: VALORES */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-3.5 pt-3 pb-1">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Valores</h2>
            </div>
            <SettingRow
              title="Mostrar valores em R$"
              description='Quando desligado, gera a ficha "sem valores" — todos os campos de moeda aparecem como "—".'
              checked={activeSettings.mostrarValores}
              onChange={() => updateSetting('mostrarValores', !activeSettings.mostrarValores)}
              disabled={!podeEditar}
            />
          </div>

          {/* BLOCO: CABEÇALHO */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-3.5 pt-3 pb-1">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cabeçalho</h2>
            </div>
            <SettingRow
              title="Nome do cliente"
              description='Exibe a linha "Cliente: ..." no topo da ficha.'
              checked={activeSettings.mostrarCliente}
              onChange={() => updateSetting('mostrarCliente', !activeSettings.mostrarCliente)}
              disabled={!podeEditar}
            />
            <SettingRow
              title="Nome da imobiliária"
              description='Exibe a linha "Imobiliária: ..." no topo da ficha.'
              checked={activeSettings.mostrarImobiliaria}
              onChange={() => updateSetting('mostrarImobiliaria', !activeSettings.mostrarImobiliaria)}
              disabled={!podeEditar}
            />
            <SettingRow
              title="Data da simulação"
              description="Exibe o selo com a data em que a simulação foi gerada."
              checked={activeSettings.mostrarDataSimulacao}
              onChange={() => updateSetting('mostrarDataSimulacao', !activeSettings.mostrarDataSimulacao)}
              disabled={!podeEditar}
            />
          </div>

          {/* BLOCO: SEÇÕES DA FICHA */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-3.5 pt-3 pb-1">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Seções da Ficha</h2>
            </div>
            <SettingRow
              title={activeMeta.bloco1.title}
              description={activeMeta.bloco1.description}
              checked={activeSettings.mostrarBloco1}
              onChange={() => updateSetting('mostrarBloco1', !activeSettings.mostrarBloco1)}
              disabled={!podeEditar}
            />
            <SettingRow
              title={activeMeta.bloco2.title}
              description={activeMeta.bloco2.description}
              checked={activeSettings.mostrarBloco2}
              onChange={() => updateSetting('mostrarBloco2', !activeSettings.mostrarBloco2)}
              disabled={!podeEditar}
            />
            <SettingRow
              title={activeMeta.bloco3.title}
              description={activeMeta.bloco3.description}
              checked={activeSettings.mostrarBloco3}
              onChange={() => updateSetting('mostrarBloco3', !activeSettings.mostrarBloco3)}
              disabled={!podeEditar}
            />
            <SettingRow
              title={activeMeta.bloco4.title}
              description={activeMeta.bloco4.description}
              checked={activeSettings.mostrarBloco4}
              onChange={() => updateSetting('mostrarBloco4', !activeSettings.mostrarBloco4)}
              disabled={!podeEditar}
            />
          </div>

          <p className="text-[11px] text-slate-400 px-1">
            As alterações são salvas para todo mundo com o cargo {activeCargo} e passam a valer na próxima ficha exportada por eles para esta condição comercial.
          </p>
        </>
      )}
    </div>
  );
};
