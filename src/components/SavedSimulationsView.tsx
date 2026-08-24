import React, { useEffect, useState } from 'react';
import { Eye, Pencil, Trash2, X, RefreshCw, ClipboardList, AlertTriangle, Building2, User } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { imoveisService } from '../services/imoveisService';

export interface SavedSimulationRecord {
  id: string;
  cliente_nome?: string;
  renda?: number;
  empreendimento_id?: string;
  dados?: Record<string, any>;
}

interface SavedSimulationsViewProps {
  onEditSimulation: (sim: SavedSimulationRecord) => void;
  onShowToast: (message: string) => void;
}

// Campos conhecidos do snapshot salvo (dados), na ordem de exibição. Cada ficha
// (Sinal c/ Morar / Sinal c/ Banco Direto) salva um subconjunto diferente — só
// os campos presentes na simulação selecionada são exibidos.
const CAMPOS_DETALHE: { key: string; label: string; formato: 'moeda' | 'numero' | 'texto' }[] = [
  { key: 'preco_tabela', label: 'Preço de Tabela', formato: 'moeda' },
  { key: 'avaliacao_bancaria', label: 'Avaliação Bancária', formato: 'moeda' },
  { key: 'itbi_total', label: 'ITBI / Registro Total', formato: 'moeda' },
  { key: 'financiamento_maximo', label: 'Financiamento', formato: 'moeda' },
  { key: 'subsidio', label: 'Subsídio', formato: 'moeda' },
  { key: 'fgts', label: 'FGTS', formato: 'moeda' },
  { key: 'recurso_proprio', label: 'Recurso Próprio', formato: 'moeda' },
  { key: 'ato_bruto', label: 'Ato (Imóvel) Bruto', formato: 'moeda' },
  { key: 'desconto_ato_premiado', label: 'Desconto Ato Premiado', formato: 'moeda' },
  { key: 'ato_liquido', label: 'Ato (Imóvel) Líquido', formato: 'moeda' },
  { key: 'itbi_no_ato', label: 'ITBI no Ato', formato: 'moeda' },
  { key: 'total_obra', label: 'Total Fase Obra (c/ ITBI)', formato: 'moeda' },
  { key: 'total_pos_obra', label: 'Total Fase Pós-Obra (c/ ITBI)', formato: 'moeda' },
  { key: 'mensais_qtd', label: 'Qtd. Mensais', formato: 'numero' },
  { key: 'parcela_mensal', label: 'Parcela Mensal', formato: 'moeda' },
  { key: 'pro_soluto_total', label: 'Pró-Soluto Total', formato: 'moeda' }
];

const formatarValor = (valor: any, formato: 'moeda' | 'numero' | 'texto'): string => {
  if (valor === undefined || valor === null || valor === '') return '-';
  if (formato === 'moeda') return formatCurrency(Number(valor) || 0);
  if (formato === 'numero') return String(valor);
  return String(valor);
};

const formatarData = (isoString?: string): string => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
};

export const SavedSimulationsView: React.FC<SavedSimulationsViewProps> = ({ onEditSimulation, onShowToast }) => {
  const [simulations, setSimulations] = useState<SavedSimulationRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewingSim, setViewingSim] = useState<SavedSimulationRecord | null>(null);
  const [confirmDeleteSim, setConfirmDeleteSim] = useState<SavedSimulationRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSimulations = async () => {
    setIsLoading(true);
    const res = await imoveisService.listarSimulacoes();
    setSimulations(res.data || []);
    setIsLoading(false);
    if (!res.success) {
      onShowToast(`Não foi possível carregar as simulações salvas: ${res.error || 'erro desconhecido'}`);
    }
  };

  useEffect(() => {
    loadSimulations();
  }, []);

  const handleConfirmDelete = async () => {
    if (!confirmDeleteSim) return;
    setDeletingId(confirmDeleteSim.id);
    const res = await imoveisService.excluirSimulacao(confirmDeleteSim.id);
    setDeletingId(null);
    if (res.success) {
      setSimulations(prev => prev.filter(s => s.id !== confirmDeleteSim.id));
      onShowToast('Simulação excluída com sucesso.');
    } else {
      onShowToast(`Erro ao excluir simulação: ${res.error || 'erro desconhecido'}`);
    }
    setConfirmDeleteSim(null);
  };

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-sky-600 font-bold block">
            Propostas & Simulações
          </span>
          <h1 className="text-xl font-bold font-heading text-slate-900">
            Simulações Salvas
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Visualize, edite ou exclua as simulações salvas por você e pela sua equipe.
          </p>
        </div>
        <button
          onClick={loadSimulations}
          type="button"
          disabled={isLoading}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-400">Carregando simulações...</div>
        ) : simulations.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <ClipboardList className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-500">Nenhuma simulação salva ainda.</p>
            <p className="text-xs text-slate-400">Use o botão "Salvar Simulação" nas fichas de análise para guardar uma proposta aqui.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {simulations.map((sim) => {
              const d = sim.dados || {};
              return (
                <div key={sim.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-all">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-sky-50 text-sky-600 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {sim.cliente_nome || d.cliente_nome || 'Cliente Não Informado'}
                        </span>
                        {d.condicao_nome && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 shrink-0">
                            {d.condicao_nome}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {d.empreendimento_nome || 'Empreendimento não informado'}
                          {d.torre && d.torre !== 'Não Selecionada' ? ` — Torre ${d.torre}` : ''}
                          {d.unidade && d.unidade !== 'Não Selecionada' ? ` / Unid. ${d.unidade}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                        <span>Renda: <strong className="text-slate-600">{formatCurrency(Number(sim.renda ?? d.renda) || 0)}</strong></span>
                        <span>Salvo em: <strong className="text-slate-600">{formatarData(d.salvo_em)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setViewingSim(sim)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                      title="Visualizar detalhes"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Visualizar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditSimulation(sim)}
                      className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold rounded-lg text-[11px] transition-all flex items-center gap-1 cursor-pointer border border-sky-100"
                      title="Editar (abre a ficha com os dados desta simulação)"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteSim(sim)}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold rounded-lg text-[11px] transition-all flex items-center gap-1 cursor-pointer border border-rose-100"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: VISUALIZAR DETALHES */}
      {viewingSim && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setViewingSim(null); }}
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 relative">
            <button
              type="button"
              onClick={() => setViewingSim(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                {viewingSim.dados?.cliente_nome || viewingSim.cliente_nome || 'Cliente Não Informado'}
              </h3>
              <p className="text-xs text-slate-500">
                {viewingSim.dados?.empreendimento_nome} — {viewingSim.dados?.condicao_nome}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Torre {viewingSim.dados?.torre || '-'} / Unidade {viewingSim.dados?.unidade || '-'} • Salvo em {formatarData(viewingSim.dados?.salvo_em)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs pt-2 border-t border-slate-100">
              {CAMPOS_DETALHE.filter(c => viewingSim.dados?.[c.key] !== undefined).map(c => (
                <div key={c.key} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{c.label}</span>
                  <span className="font-bold text-slate-800">{formatarValor(viewingSim.dados?.[c.key], c.formato)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingSim(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => { onEditSimulation(viewingSim); setViewingSim(null); }}
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Editar esta Simulação</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR EXCLUSÃO */}
      {confirmDeleteSim && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteSim(null); }}
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Excluir simulação?</h3>
                <p className="text-xs text-slate-500">
                  {confirmDeleteSim.dados?.cliente_nome || confirmDeleteSim.cliente_nome || 'Esta simulação'} será removida permanentemente para todos os usuários. Essa ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteSim(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId === confirmDeleteSim.id}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingId === confirmDeleteSim.id ? 'Excluindo...' : 'Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
