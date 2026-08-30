import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Trash2, X, RefreshCw, ClipboardList, AlertTriangle, Building2, User, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { imoveisService } from '../services/imoveisService';

export interface SavedSimulationRecord {
  id: string;
  cliente_nome?: string;
  renda?: number;
  empreendimento_id?: string;
  dados?: Record<string, any>;
  criado_por?: string | null;
  criado_por_nome?: string | null;
  criado_por_cargo?: string | null;
  criado_por_imobiliaria?: string | null;
  criado_por_gerente_nome?: string | null;
}

interface SavedSimulationsViewProps {
  onEditSimulation: (sim: SavedSimulationRecord) => void;
  onShowToast: (message: string) => void;
  // Só quem enxerga mais de uma equipe (Administrador, Diretor) vê o filtro
  // "Gerente responsável" — pra um Gerente comum, que já só vê a própria
  // equipe, esse filtro seria redundante.
  podeFiltrarPorGerente?: boolean;
}

interface FiltrosSimulacoes {
  corretorId: string;
  gerenteNome: string;
  empreendimento: string;
  condicao: string;
  torre: string;
  unidade: string;
  tipologia: string;
  cargo: string;
  imobiliaria: string;
  clienteNome: string;
  percFinanciamento: string;
  primeiroImovel: '' | 'sim' | 'nao';
  rendaMin: string; rendaMax: string;
  precoMin: string; precoMax: string;
  avaliacaoMin: string; avaliacaoMax: string;
  financiamentoMin: string; financiamentoMax: string;
  subsidioMin: string; subsidioMax: string;
  fgtsMin: string; fgtsMax: string;
  atoMin: string; atoMax: string;
  dataDe: string; dataAte: string;
}

const FILTROS_VAZIOS: FiltrosSimulacoes = {
  corretorId: '', gerenteNome: '', empreendimento: '', condicao: '', torre: '', unidade: '',
  tipologia: '', cargo: '', imobiliaria: '', clienteNome: '', percFinanciamento: '', primeiroImovel: '',
  rendaMin: '', rendaMax: '', precoMin: '', precoMax: '', avaliacaoMin: '', avaliacaoMax: '',
  financiamentoMin: '', financiamentoMax: '', subsidioMin: '', subsidioMax: '', fgtsMin: '', fgtsMax: '',
  atoMin: '', atoMax: '', dataDe: '', dataAte: ''
};

const dentroDaFaixa = (valor: number, min: string, max: string): boolean => {
  if (min !== '' && valor < Number(min)) return false;
  if (max !== '' && valor > Number(max)) return false;
  return true;
};

const contemTexto = (valor: string | undefined | null, busca: string): boolean =>
  !busca || String(valor || '').toLowerCase().includes(busca.toLowerCase());

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

export const SavedSimulationsView: React.FC<SavedSimulationsViewProps> = ({ onEditSimulation, onShowToast, podeFiltrarPorGerente }) => {
  const [simulations, setSimulations] = useState<SavedSimulationRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewingSim, setViewingSim] = useState<SavedSimulationRecord | null>(null);
  const [confirmDeleteSim, setConfirmDeleteSim] = useState<SavedSimulationRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState<boolean>(false);
  const [filtros, setFiltros] = useState<FiltrosSimulacoes>(FILTROS_VAZIOS);

  const setFiltro = <K extends keyof FiltrosSimulacoes>(campo: K, valor: FiltrosSimulacoes[K]) =>
    setFiltros(prev => ({ ...prev, [campo]: valor }));

  // Listas de opções pros seletores, derivadas do que já foi carregado — só
  // aparecem opções que realmente existem entre as simulações visíveis.
  const opcoes = useMemo(() => {
    const unico = (valores: (string | undefined | null)[]) =>
      Array.from(new Set(valores.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const corretores = Array.from(
      new Map<string, string>(
        simulations
          .filter(s => s.criado_por && s.criado_por_nome)
          .map(s => [s.criado_por as string, s.criado_por_nome as string])
      ).entries()
    ).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));

    return {
      corretores,
      gerentes: unico(simulations.map(s => s.criado_por_gerente_nome)),
      empreendimentos: unico(simulations.map(s => s.dados?.empreendimento_nome)),
      condicoes: unico(simulations.map(s => s.dados?.condicao_nome)),
      torres: unico(simulations.map(s => s.dados?.torre)).filter(t => t !== 'Não Selecionada'),
      tipologias: unico(simulations.map(s => s.dados?.tipologia)),
      cargos: unico(simulations.map(s => s.criado_por_cargo)),
      imobiliarias: unico(simulations.map(s => s.criado_por_imobiliaria))
    };
  }, [simulations]);

  const filtradas = useMemo(() => simulations.filter(sim => {
    const d = sim.dados || {};
    if (filtros.corretorId && sim.criado_por !== filtros.corretorId) return false;
    if (filtros.gerenteNome && sim.criado_por_gerente_nome !== filtros.gerenteNome) return false;
    if (filtros.empreendimento && d.empreendimento_nome !== filtros.empreendimento) return false;
    if (filtros.condicao && d.condicao_nome !== filtros.condicao) return false;
    if (filtros.torre && d.torre !== filtros.torre) return false;
    if (!contemTexto(d.unidade, filtros.unidade)) return false;
    if (filtros.tipologia && d.tipologia !== filtros.tipologia) return false;
    if (filtros.cargo && sim.criado_por_cargo !== filtros.cargo) return false;
    if (filtros.imobiliaria && sim.criado_por_imobiliaria !== filtros.imobiliaria) return false;
    if (!contemTexto(sim.cliente_nome || d.cliente_nome, filtros.clienteNome)) return false;
    if (filtros.percFinanciamento) {
      const perc = d.simulation_data?.finPercent;
      if (perc === undefined || perc === null || Math.round(Number(perc) * 100) !== Number(filtros.percFinanciamento)) return false;
    }
    if (filtros.primeiroImovel) {
      const ehPrimeiro = !!d.simulation_data?.isFirstHome;
      if (filtros.primeiroImovel === 'sim' && !ehPrimeiro) return false;
      if (filtros.primeiroImovel === 'nao' && ehPrimeiro) return false;
    }
    if (!dentroDaFaixa(Number(sim.renda ?? d.renda) || 0, filtros.rendaMin, filtros.rendaMax)) return false;
    if (!dentroDaFaixa(Number(d.preco_tabela) || 0, filtros.precoMin, filtros.precoMax)) return false;
    if (!dentroDaFaixa(Number(d.avaliacao_bancaria) || 0, filtros.avaliacaoMin, filtros.avaliacaoMax)) return false;
    if (!dentroDaFaixa(Number(d.financiamento_maximo) || 0, filtros.financiamentoMin, filtros.financiamentoMax)) return false;
    if (!dentroDaFaixa(Number(d.subsidio) || 0, filtros.subsidioMin, filtros.subsidioMax)) return false;
    if (!dentroDaFaixa(Number(d.fgts) || 0, filtros.fgtsMin, filtros.fgtsMax)) return false;
    if (!dentroDaFaixa(Number(d.ato_liquido ?? d.ato_bruto) || 0, filtros.atoMin, filtros.atoMax)) return false;
    if (filtros.dataDe && (!d.salvo_em || d.salvo_em.slice(0, 10) < filtros.dataDe)) return false;
    if (filtros.dataAte && (!d.salvo_em || d.salvo_em.slice(0, 10) > filtros.dataAte)) return false;
    return true;
  }), [simulations, filtros]);

  const filtrosAtivos = Object.values(filtros).filter(v => v !== '').length;

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
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setFiltrosAbertos(v => !v)}
            type="button"
            className={`px-4 py-2.5 font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border ${filtrosAbertos || filtrosAtivos > 0 ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-slate-100 border-transparent text-slate-700 hover:bg-slate-200'}`}
          >
            <Filter className="w-4 h-4" />
            <span>Filtros{filtrosAtivos > 0 ? ` (${filtrosAtivos})` : ''}</span>
            {filtrosAbertos ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={loadSimulations}
            type="button"
            disabled={isLoading}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {filtrosAbertos && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <CampoSelect label="Corretor / quem fez" value={filtros.corretorId} onChange={v => setFiltro('corretorId', v)}>
              {opcoes.corretores.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </CampoSelect>
            {podeFiltrarPorGerente && (
              <CampoSelect label="Gerente responsável" value={filtros.gerenteNome} onChange={v => setFiltro('gerenteNome', v)}>
                {opcoes.gerentes.map(g => <option key={g} value={g}>{g}</option>)}
              </CampoSelect>
            )}
            <CampoSelect label="Cargo" value={filtros.cargo} onChange={v => setFiltro('cargo', v)}>
              {opcoes.cargos.map(c => <option key={c} value={c}>{c}</option>)}
            </CampoSelect>
            <CampoSelect label="Imobiliária" value={filtros.imobiliaria} onChange={v => setFiltro('imobiliaria', v)}>
              {opcoes.imobiliarias.map(i => <option key={i} value={i}>{i}</option>)}
            </CampoSelect>

            <CampoSelect label="Empreendimento" value={filtros.empreendimento} onChange={v => setFiltro('empreendimento', v)}>
              {opcoes.empreendimentos.map(e => <option key={e} value={e}>{e}</option>)}
            </CampoSelect>
            <CampoSelect label="Tipo de condição" value={filtros.condicao} onChange={v => setFiltro('condicao', v)}>
              {opcoes.condicoes.map(c => <option key={c} value={c}>{c}</option>)}
            </CampoSelect>
            <CampoSelect label="Torre" value={filtros.torre} onChange={v => setFiltro('torre', v)}>
              {opcoes.torres.map(t => <option key={t} value={t}>{t}</option>)}
            </CampoSelect>
            <CampoTexto label="Unidade" value={filtros.unidade} onChange={v => setFiltro('unidade', v)} placeholder="Ex.: 404" />

            <CampoSelect label="Tipologia" value={filtros.tipologia} onChange={v => setFiltro('tipologia', v)}>
              {opcoes.tipologias.map(t => <option key={t} value={t}>{t}</option>)}
            </CampoSelect>
            <CampoTexto label="Nome do cliente" value={filtros.clienteNome} onChange={v => setFiltro('clienteNome', v)} placeholder="Buscar por nome" />
            <CampoSelect label="% de Financiamento" value={filtros.percFinanciamento} onChange={v => setFiltro('percFinanciamento', v)}>
              <option value="80">80% (Padrão)</option>
              <option value="90">90% (Máximo)</option>
            </CampoSelect>
            <CampoSelect label="Primeiro imóvel do cliente?" value={filtros.primeiroImovel} onChange={v => setFiltro('primeiroImovel', v as '' | 'sim' | 'nao')}>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </CampoSelect>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
            <CampoFaixa label="Renda" min={filtros.rendaMin} max={filtros.rendaMax} onChangeMin={v => setFiltro('rendaMin', v)} onChangeMax={v => setFiltro('rendaMax', v)} />
            <CampoFaixa label="Preço do Imóvel (Tabela)" min={filtros.precoMin} max={filtros.precoMax} onChangeMin={v => setFiltro('precoMin', v)} onChangeMax={v => setFiltro('precoMax', v)} />
            <CampoFaixa label="Avaliação Bancária" min={filtros.avaliacaoMin} max={filtros.avaliacaoMax} onChangeMin={v => setFiltro('avaliacaoMin', v)} onChangeMax={v => setFiltro('avaliacaoMax', v)} />
            <CampoFaixa label="Financiamento" min={filtros.financiamentoMin} max={filtros.financiamentoMax} onChangeMin={v => setFiltro('financiamentoMin', v)} onChangeMax={v => setFiltro('financiamentoMax', v)} />
            <CampoFaixa label="Subsídio" min={filtros.subsidioMin} max={filtros.subsidioMax} onChangeMin={v => setFiltro('subsidioMin', v)} onChangeMax={v => setFiltro('subsidioMax', v)} />
            <CampoFaixa label="FGTS" min={filtros.fgtsMin} max={filtros.fgtsMax} onChangeMin={v => setFiltro('fgtsMin', v)} onChangeMax={v => setFiltro('fgtsMax', v)} />
            <CampoFaixa label="Ato (Imóvel)" min={filtros.atoMin} max={filtros.atoMax} onChangeMin={v => setFiltro('atoMin', v)} onChangeMax={v => setFiltro('atoMax', v)} />
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Salvo em</label>
              <div className="flex items-center gap-1.5">
                <input type="date" value={filtros.dataDe} onChange={e => setFiltro('dataDe', e.target.value)} className="w-full px-2 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400" />
                <span className="text-slate-400 text-xs">até</span>
                <input type="date" value={filtros.dataAte} onChange={e => setFiltro('dataAte', e.target.value)} className="w-full px-2 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              <strong className="text-slate-700">{filtradas.length}</strong> de {simulations.length} simulaç{simulations.length === 1 ? 'ão' : 'ões'}
            </p>
            <button
              type="button"
              onClick={() => setFiltros(FILTROS_VAZIOS)}
              disabled={filtrosAtivos === 0}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-400">Carregando simulações...</div>
        ) : simulations.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <ClipboardList className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-500">Nenhuma simulação salva ainda.</p>
            <p className="text-xs text-slate-400">Use o botão "Salvar Simulação" nas fichas de análise para guardar uma proposta aqui.</p>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Filter className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-500">Nenhuma simulação bate com os filtros escolhidos.</p>
            <button type="button" onClick={() => setFiltros(FILTROS_VAZIOS)} className="text-xs font-semibold text-sky-600 hover:underline cursor-pointer">
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtradas.map((sim) => {
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
                        {sim.criado_por_nome && (
                          <span>
                            Feito por: <strong className="text-slate-600">{sim.criado_por_nome}</strong>
                            {sim.criado_por_cargo && <> — {sim.criado_por_cargo}</>}
                            {sim.criado_por_imobiliaria && <> — {sim.criado_por_imobiliaria}</>}
                          </span>
                        )}
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
                {viewingSim.criado_por_nome && (
                  <>
                    {' '}• Feito por {viewingSim.criado_por_nome}
                    {viewingSim.criado_por_cargo && <> ({viewingSim.criado_por_cargo}{viewingSim.criado_por_imobiliaria ? ` — ${viewingSim.criado_por_imobiliaria}` : ''})</>}
                  </>
                )}
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

const rotuloCampo = 'block text-[11px] font-bold text-slate-500 uppercase mb-1.5';
const estiloInput = 'w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400';

const CampoSelect: React.FC<{ label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }> = ({ label, value, onChange, children }) => (
  <div>
    <label className={rotuloCampo}>{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className={`${estiloInput} bg-white`}>
      <option value="">Todos</option>
      {children}
    </select>
  </div>
);

const CampoTexto: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className={rotuloCampo}>{label}</label>
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={estiloInput} />
  </div>
);

const CampoFaixa: React.FC<{ label: string; min: string; max: string; onChangeMin: (v: string) => void; onChangeMax: (v: string) => void }> = ({ label, min, max, onChangeMin, onChangeMax }) => (
  <div>
    <label className={rotuloCampo}>{label}</label>
    <div className="flex items-center gap-1.5">
      <input type="number" value={min} onChange={e => onChangeMin(e.target.value)} placeholder="De" className={estiloInput} />
      <span className="text-slate-400 text-xs shrink-0">até</span>
      <input type="number" value={max} onChange={e => onChangeMax(e.target.value)} placeholder="Até" className={estiloInput} />
    </div>
  </div>
);
