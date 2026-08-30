import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, RefreshCw, Check, X, Pencil, Ban, PlayCircle, Trash2, Crown, ArrowLeftRight, Filter, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { PerfilUsuario, Cargo, StatusConta } from '../types';
import { authService } from '../services/authService';
import { TELAS_APP, CARGOS, TELAS_PADRAO_POR_CARGO, CAMPOS_EDITAVEIS_EQUIPE } from '../config/telasApp';

interface AdminPanelViewProps {
  onShowToast: (message: string) => void;
  // Id de quem está logado agora — usado só para saber se a pessoa vendo a
  // tela é o próprio proprietário do aplicativo (ver PerfilUsuario.proprietario):
  // só ele pode editar, pausar, excluir ou transferir o próprio cadastro.
  usuarioAtualId: string;
}

// Cargos que, por padrão, enxergam a proposta da equipe abaixo deles quando
// aprovados — o Administrador pode ligar/desligar isso livremente depois.
const CARGOS_COM_EQUIPE: Cargo[] = ['Administrador', 'Diretor', 'Gerente', 'Coordenador de Vendas'];

// Calcula, a partir da lista já carregada em memória, todos os descendentes
// (diretos e indiretos) de um usuário — usado só para não deixar o próprio
// Administrador escolher, sem querer, um superior que criaria um ciclo na
// hierarquia (ex.: colocar o subordinado de alguém como superior dele mesmo).
function descendentesDe(id: string, todos: PerfilUsuario[]): Set<string> {
  const resultado = new Set<string>();
  const fila = [id];
  while (fila.length > 0) {
    const atual = fila.shift()!;
    for (const p of todos) {
      if (p.superiorId === atual && !resultado.has(p.id)) {
        resultado.add(p.id);
        fila.push(p.id);
      }
    }
  }
  return resultado;
}

// Filtro do cadastro de usuários, usado tanto em "Cadastros pendentes" quanto
// em "Usuários ativos" — mesmos campos, um estado (rascunho/aplicado) por
// tabela, exatamente como o filtro de "Simulações Salvas".
interface FiltrosUsuarios {
  busca: string;
  cargo: string;
  imobiliaria: string;
  equipeDeId: string;
  dataDe: string;
  dataAte: string;
}

const FILTROS_USUARIOS_VAZIOS: FiltrosUsuarios = {
  busca: '', cargo: '', imobiliaria: '', equipeDeId: '', dataDe: '', dataAte: ''
};

const contarFiltrosAtivos = (f: FiltrosUsuarios): number => Object.values(f).filter(v => v !== '').length;

// "Equipe de": pertence quem É a raiz, quem responde direto a ela, ou quem
// responde a alguém que já é descendente dela — funciona tanto pra quem já
// está em `ativos` (a árvore de hierarquia em si) quanto pra um cadastro
// ainda "pendente" (que só tem um superior indicado, não faz parte da árvore
// ainda).
function passaFiltroUsuario(u: PerfilUsuario, f: FiltrosUsuarios, equipeDescendentes: Set<string> | null): boolean {
  if (f.busca && !`${u.nomeCompleto} ${u.email}`.toLowerCase().includes(f.busca.toLowerCase())) return false;
  if (f.cargo && u.cargo !== f.cargo) return false;
  if (f.imobiliaria && u.imobiliaria !== f.imobiliaria) return false;
  if (f.equipeDeId) {
    const pertence = u.id === f.equipeDeId
      || u.superiorId === f.equipeDeId
      || (u.superiorId != null && (equipeDescendentes?.has(u.superiorId) ?? false));
    if (!pertence) return false;
  }
  if (f.dataDe && (!u.createdAt || u.createdAt.slice(0, 10) < f.dataDe)) return false;
  if (f.dataAte && (!u.createdAt || u.createdAt.slice(0, 10) > f.dataAte)) return false;
  return true;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({ onShowToast, usuarioAtualId }) => {
  const [pendentes, setPendentes] = useState<PerfilUsuario[]>([]);
  const [ativos, setAtivos] = useState<PerfilUsuario[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Ajustes locais nas linhas de "cadastros pendentes" (cargo/superior podem
  // ser corrigidos pelo Administrador antes de aprovar).
  const [ajustePendente, setAjustePendente] = useState<Record<string, { cargo: Cargo; superiorId: string | null }>>({});
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);

  // Filtro de "Cadastros pendentes" e de "Usuários ativos" — independentes um
  // do outro, mesmo padrão rascunho/aplicado (só filtra de fato ao clicar em
  // "Filtrar") do filtro de Simulações Salvas.
  const [filtrosPendAbertos, setFiltrosPendAbertos] = useState(false);
  const [filtrosPendRascunho, setFiltrosPendRascunho] = useState<FiltrosUsuarios>(FILTROS_USUARIOS_VAZIOS);
  const [filtrosPendAplicados, setFiltrosPendAplicados] = useState<FiltrosUsuarios>(FILTROS_USUARIOS_VAZIOS);
  const [filtrosAtivAbertos, setFiltrosAtivAbertos] = useState(false);
  const [filtrosAtivRascunho, setFiltrosAtivRascunho] = useState<FiltrosUsuarios>(FILTROS_USUARIOS_VAZIOS);
  const [filtrosAtivAplicados, setFiltrosAtivAplicados] = useState<FiltrosUsuarios>(FILTROS_USUARIOS_VAZIOS);

  // Transferência de propriedade: só o próprio proprietário vê o botão, na
  // própria linha (ver seção "USUÁRIOS ATIVOS" abaixo).
  const [transferindo, setTransferindo] = useState(false);
  const [novoProprietarioId, setNovoProprietarioId] = useState('');
  const [confirmacaoTransferencia, setConfirmacaoTransferencia] = useState('');
  const [processandoTransferencia, setProcessandoTransferencia] = useState(false);

  // Painel de edição de cargo/hierarquia/permissões/dados cadastrais de um
  // usuário ativo. E-mail não entra aqui — é o login de verdade (Supabase
  // Auth), separado do cadastro, e não dá pra trocar com segurança sem uma
  // peça extra de servidor que ainda não existe no projeto.
  const [editando, setEditando] = useState<PerfilUsuario | null>(null);
  const [edCargo, setEdCargo] = useState<Cargo>('Corretor');
  const [edSuperiorId, setEdSuperiorId] = useState<string | null>(null);
  const [edTelas, setEdTelas] = useState<Set<string>>(new Set());
  const [edVerEquipe, setEdVerEquipe] = useState(false);
  const [edCamposEditaveis, setEdCamposEditaveis] = useState<Set<string>>(new Set());
  const [edNomeCompleto, setEdNomeCompleto] = useState('');
  const [edTelefone, setEdTelefone] = useState('');
  const [edCpf, setEdCpf] = useState('');
  const [edImobiliaria, setEdImobiliaria] = useState('');
  const [edCreci, setEdCreci] = useState('');

  // Edição de permissões por cargo — aplica de uma vez só (telas liberadas,
  // ver propostas da equipe, campos editáveis da equipe) para todo mundo que
  // tem aquele cargo hoje, sobrescrevendo qualquer ajuste individual que já
  // tivessem. Dados pessoais (nome, CPF, superior...) ficam de fora — isso só
  // se edita pessoa por pessoa, no "Editar" de cada linha.
  const [permCargoAberto, setPermCargoAberto] = useState(false);
  const [pmCargo, setPmCargo] = useState<Cargo>('Corretor');
  const [pmTelas, setPmTelas] = useState<Set<string>>(new Set());
  const [pmVerEquipe, setPmVerEquipe] = useState(false);
  const [pmCamposEditaveis, setPmCamposEditaveis] = useState<Set<string>>(new Set());
  const [confirmandoAplicacaoMassa, setConfirmandoAplicacaoMassa] = useState(false);
  const [aplicandoMassa, setAplicandoMassa] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    const [p, a] = await Promise.all([authService.listarPendentes(), authService.listarAtivosEPausados()]);
    setPendentes(p);
    setAtivos(a);
    setAjustePendente(prev => {
      const novo = { ...prev };
      p.forEach(u => {
        if (!novo[u.id]) novo[u.id] = { cargo: u.cargo, superiorId: null };
      });
      return novo;
    });
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, []);

  const totalAtivos = ativos.filter(u => u.status === 'ativo').length;
  const totalPausados = ativos.filter(u => u.status === 'pausado').length;

  const superioresDisponiveis = useMemo(
    () => ativos.filter(u => u.status === 'ativo'),
    [ativos]
  );

  const opcoesImobiliariaPend = useMemo(
    () => Array.from(new Set<string>(pendentes.map(u => u.imobiliaria).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [pendentes]
  );
  const opcoesImobiliariaAtiv = useMemo(
    () => Array.from(new Set<string>(ativos.map(u => u.imobiliaria).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [ativos]
  );

  const setCampoFiltroPend = <K extends keyof FiltrosUsuarios>(campo: K, valor: FiltrosUsuarios[K]) =>
    setFiltrosPendRascunho(prev => ({ ...prev, [campo]: valor }));
  const aplicarFiltrosPend = () => { setFiltrosPendAplicados(filtrosPendRascunho); setFiltrosPendAbertos(false); };
  const limparFiltrosPend = () => { setFiltrosPendRascunho(FILTROS_USUARIOS_VAZIOS); setFiltrosPendAplicados(FILTROS_USUARIOS_VAZIOS); };

  const setCampoFiltroAtiv = <K extends keyof FiltrosUsuarios>(campo: K, valor: FiltrosUsuarios[K]) =>
    setFiltrosAtivRascunho(prev => ({ ...prev, [campo]: valor }));
  const aplicarFiltrosAtiv = () => { setFiltrosAtivAplicados(filtrosAtivRascunho); setFiltrosAtivAbertos(false); };
  const limparFiltrosAtiv = () => { setFiltrosAtivRascunho(FILTROS_USUARIOS_VAZIOS); setFiltrosAtivAplicados(FILTROS_USUARIOS_VAZIOS); };

  const pendentesFiltrados = useMemo(() => {
    const desc = filtrosPendAplicados.equipeDeId ? descendentesDe(filtrosPendAplicados.equipeDeId, ativos) : null;
    return pendentes.filter(u => passaFiltroUsuario(u, filtrosPendAplicados, desc));
  }, [pendentes, filtrosPendAplicados, ativos]);

  const ativosFiltrados = useMemo(() => {
    const desc = filtrosAtivAplicados.equipeDeId ? descendentesDe(filtrosAtivAplicados.equipeDeId, ativos) : null;
    return ativos.filter(u => passaFiltroUsuario(u, filtrosAtivAplicados, desc));
  }, [ativos, filtrosAtivAplicados]);

  const handleAprovar = async (u: PerfilUsuario) => {
    const ajuste = ajustePendente[u.id] || { cargo: u.cargo, superiorId: null };
    setProcessandoId(u.id);
    const res = await authService.aprovarUsuario(u.id, {
      cargo: ajuste.cargo,
      superiorId: ajuste.superiorId,
      telasLiberadas: TELAS_PADRAO_POR_CARGO[ajuste.cargo] || ['simulator'],
      verPropostasEquipe: CARGOS_COM_EQUIPE.includes(ajuste.cargo)
    });
    setProcessandoId(null);
    if (res.success) {
      onShowToast(`${u.nomeCompleto} aprovado(a) como ${ajuste.cargo}.`);
      carregar();
    } else {
      onShowToast(`Erro ao aprovar: ${res.error || 'erro desconhecido'}`);
    }
  };

  const handleRecusar = async (u: PerfilUsuario) => {
    setProcessandoId(u.id);
    const res = await authService.recusarUsuario(u.id);
    setProcessandoId(null);
    if (res.success) {
      onShowToast(`Cadastro de ${u.nomeCompleto} recusado.`);
      carregar();
    } else {
      onShowToast(`Erro ao recusar: ${res.error || 'erro desconhecido'}`);
    }
  };

  const abrirEdicao = (u: PerfilUsuario) => {
    if (u.proprietario && u.id !== usuarioAtualId) {
      onShowToast('Só o próprio proprietário pode editar este cadastro.');
      return;
    }
    setEditando(u);
    setEdCargo(u.cargo);
    setEdSuperiorId(u.superiorId);
    setEdTelas(new Set(u.telasLiberadas));
    setEdVerEquipe(u.verPropostasEquipe);
    setEdCamposEditaveis(new Set(u.camposEditaveisEquipe));
    setEdNomeCompleto(u.nomeCompleto);
    setEdTelefone(u.telefone);
    setEdCpf(u.cpf);
    setEdImobiliaria(u.imobiliaria);
    setEdCreci(u.creci || '');
  };

  const salvarEdicao = async () => {
    if (!editando) return;
    if (!edNomeCompleto.trim() || !edTelefone.trim() || !edCpf.trim() || !edImobiliaria.trim()) {
      onShowToast('Nome completo, telefone, CPF e imobiliária são obrigatórios.');
      return;
    }
    setProcessandoId(editando.id);
    const res = await authService.editarCargoEPermissoes(editando.id, {
      cargo: edCargo,
      superiorId: edSuperiorId,
      telasLiberadas: Array.from(edTelas),
      verPropostasEquipe: edVerEquipe,
      nomeCompleto: edNomeCompleto.trim(),
      telefone: edTelefone.trim(),
      cpf: edCpf.trim(),
      imobiliaria: edImobiliaria.trim(),
      creci: edCreci.trim() || undefined,
      camposEditaveisEquipe: Array.from(edCamposEditaveis)
    });
    setProcessandoId(null);
    if (res.success) {
      onShowToast(`Permissões de ${editando.nomeCompleto} atualizadas.`);
      setEditando(null);
      carregar();
    } else {
      onShowToast(`Erro ao salvar: ${res.error || 'erro desconhecido'}`);
    }
  };

  const alternarPausa = async (u: PerfilUsuario) => {
    if (u.cargo === 'Administrador' && u.status === 'ativo') {
      onShowToast('Administradores não podem ser pausados por aqui. Mude o cargo da pessoa antes, se for o caso.');
      return;
    }
    const novoStatus: StatusConta = u.status === 'ativo' ? 'pausado' : 'ativo';
    setProcessandoId(u.id);
    const res = await authService.definirStatus(u.id, novoStatus);
    setProcessandoId(null);
    if (res.success) {
      onShowToast(novoStatus === 'pausado' ? `${u.nomeCompleto} foi pausado(a).` : `${u.nomeCompleto} foi reativado(a).`);
      carregar();
    } else {
      onShowToast(`Erro: ${res.error || 'erro desconhecido'}`);
    }
  };

  const confirmarExcluir = async (u: PerfilUsuario) => {
    if (u.cargo === 'Administrador') {
      onShowToast('Administradores não podem ser excluídos por aqui. Mude o cargo da pessoa antes, se for o caso.');
      setConfirmandoExclusao(null);
      return;
    }
    setProcessandoId(u.id);
    const res = await authService.excluirUsuario(u.id);
    setProcessandoId(null);
    setConfirmandoExclusao(null);
    if (res.success) {
      onShowToast(`Conta de ${u.nomeCompleto} excluída.`);
      carregar();
    } else {
      onShowToast(`Erro ao excluir: ${res.error || 'erro desconhecido'}`);
    }
  };

  const descendentesDoEditando = editando ? descendentesDe(editando.id, ativos) : new Set<string>();

  // Só Administradores ativos, diferentes de quem já é o dono, podem receber
  // a propriedade.
  const candidatosATransferencia = ativos.filter(u => u.cargo === 'Administrador' && u.status === 'ativo' && u.id !== usuarioAtualId);

  const abrirTransferencia = () => {
    setNovoProprietarioId(candidatosATransferencia[0]?.id || '');
    setConfirmacaoTransferencia('');
    setTransferindo(true);
  };

  const confirmarTransferencia = async () => {
    if (!novoProprietarioId) return;
    setProcessandoTransferencia(true);
    const res = await authService.transferirPropriedade(novoProprietarioId);
    setProcessandoTransferencia(false);
    if (res.success) {
      const novoDono = ativos.find(u => u.id === novoProprietarioId);
      onShowToast(`Propriedade transferida para ${novoDono?.nomeCompleto || 'o novo dono'}.`);
      setTransferindo(false);
      carregar();
    } else {
      onShowToast(`Erro ao transferir: ${res.error || 'erro desconhecido'}`);
    }
  };

  // Quantas contas (ativas ou pausadas) têm hoje o cargo selecionado — é o
  // que a aplicação em massa vai afetar.
  const usuariosDoCargoEmMassa = ativos.filter(u => u.cargo === pmCargo);

  const abrirPermissoesPorCargo = (cargo: Cargo) => {
    setPmCargo(cargo);
    setPmTelas(new Set(TELAS_PADRAO_POR_CARGO[cargo] || []));
    setPmVerEquipe(CARGOS_COM_EQUIPE.includes(cargo));
    setPmCamposEditaveis(new Set());
    setPermCargoAberto(true);
  };

  const confirmarAplicacaoMassa = async () => {
    setAplicandoMassa(true);
    const res = await authService.aplicarPermissoesPorCargo(pmCargo, {
      telasLiberadas: Array.from(pmTelas),
      verPropostasEquipe: pmVerEquipe,
      camposEditaveisEquipe: Array.from(pmCamposEditaveis)
    });
    setAplicandoMassa(false);
    setConfirmandoAplicacaoMassa(false);
    if (res.success) {
      onShowToast(`Permissões aplicadas para ${res.afetados ?? 0} conta${res.afetados === 1 ? '' : 's'} com o cargo ${pmCargo}.`);
      carregar();
    } else {
      onShowToast(`Erro ao aplicar em massa: ${res.error || 'erro desconhecido'}`);
    }
  };

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-sky-600 font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Acesso &amp; Permissões
          </span>
          <h1 className="text-xl font-bold font-heading text-slate-900">Painel do Administrador</h1>
          <p className="text-xs text-slate-500 mt-0.5">Aprovações, cargos, hierarquia e telas liberadas por usuário.</p>
        </div>
        <button
          onClick={carregar}
          type="button"
          disabled={carregando}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile n={pendentes.length} label="Pendentes de aprovação" tone="amber" />
        <StatTile n={totalAtivos} label="Usuários ativos" tone="sky" />
        <StatTile n={totalPausados} label="Contas pausadas" tone="slate" />
      </div>

      {/* EDITAR PERMISSÕES POR CARGO (EM MASSA) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => {
            if (!permCargoAberto) abrirPermissoesPorCargo(pmCargo);
            else setPermCargoAberto(false);
          }}
          className="w-full px-5 py-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
        >
          <div className="text-left">
            <div className="text-sm font-bold text-slate-800">Editar permissões por cargo</div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Define telas liberadas, ver equipe e edição de cadastro da equipe para todo mundo de um cargo de uma vez — dados pessoais continuam só na edição individual.
            </p>
          </div>
          {permCargoAberto ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
        </button>

        {permCargoAberto && (
          <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Cargo</label>
              <select
                value={pmCargo}
                onChange={e => abrirPermissoesPorCargo(e.target.value as Cargo)}
                className="w-full sm:w-64 px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              >
                {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {usuariosDoCargoEmMassa.length} conta{usuariosDoCargoEmMassa.length === 1 ? '' : 's'} com o cargo {pmCargo} hoje (ativas ou pausadas).
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={pmVerEquipe} onChange={e => setPmVerEquipe(e.target.checked)} className="w-4 h-4 accent-sky-600" />
              Também pode ver as propostas de quem está abaixo dele na hierarquia
            </label>

            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-2">Telas liberadas</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TELAS_APP.map(t => (
                  <label key={t.key} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={pmTelas.has(t.key)}
                      onChange={e => {
                        setPmTelas(prev => {
                          const novo = new Set(prev);
                          if (e.target.checked) novo.add(t.key); else novo.delete(t.key);
                          return novo;
                        });
                      }}
                      className="w-4 h-4 accent-sky-600"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 mb-1">Pode editar o cadastro da equipe</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CAMPOS_EDITAVEIS_EQUIPE.map(c => (
                  <label key={c.key} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={pmCamposEditaveis.has(c.key)}
                      onChange={e => {
                        setPmCamposEditaveis(prev => {
                          const novo = new Set(prev);
                          if (e.target.checked) novo.add(c.key); else novo.delete(c.key);
                          return novo;
                        });
                      }}
                      className="w-4 h-4 accent-sky-600"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={usuariosDoCargoEmMassa.length === 0}
                onClick={() => setConfirmandoAplicacaoMassa(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aplicar a todos os {pmCargo} ({usuariosDoCargoEmMassa.length})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CADASTROS PENDENTES */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-bold text-slate-800">
            Cadastros pendentes{' '}
            <span className="text-xs font-semibold text-slate-400">
              ({pendentesFiltrados.length}{pendentesFiltrados.length !== pendentes.length ? ` de ${pendentes.length}` : ''})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFiltrosPendAbertos(v => !v)}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1.5 cursor-pointer border ${filtrosPendAbertos || contarFiltrosAtivos(filtrosPendAplicados) > 0 ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200'}`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros{contarFiltrosAtivos(filtrosPendAplicados) > 0 ? ` (${contarFiltrosAtivos(filtrosPendAplicados)})` : ''}</span>
            {filtrosPendAbertos ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        <PainelFiltroUsuarios
          aberto={filtrosPendAbertos}
          rascunho={filtrosPendRascunho}
          setCampo={setCampoFiltroPend}
          opcoesCargo={CARGOS}
          opcoesImobiliaria={opcoesImobiliariaPend}
          opcoesEquipeDe={superioresDisponiveis}
          onFiltrar={aplicarFiltrosPend}
          onLimpar={limparFiltrosPend}
        />

        {carregando ? (
          <div className="p-8 text-center text-sm text-slate-400">Carregando...</div>
        ) : pendentes.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Nenhum cadastro esperando aprovação.</div>
        ) : pendentesFiltrados.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm text-slate-500">Nenhum cadastro pendente bate com os filtros escolhidos.</p>
            <button type="button" onClick={limparFiltrosPend} className="text-xs font-semibold text-sky-600 hover:underline cursor-pointer">
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-2.5 font-bold">Quem se cadastrou</th>
                  <th className="px-3 py-2.5 font-bold">Imobiliária</th>
                  <th className="px-3 py-2.5 font-bold">Cargo indicado</th>
                  <th className="px-3 py-2.5 font-bold">Superior hierárquico</th>
                  <th className="px-5 py-2.5 font-bold">Ação</th>
                </tr>
              </thead>
              <tbody>
                {pendentesFiltrados.map(u => {
                  const ajuste = ajustePendente[u.id] || { cargo: u.cargo, superiorId: null };
                  return (
                    <tr key={u.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3">
                        <div className="font-bold text-slate-800">{u.nomeCompleto}</div>
                        <div className="text-slate-400">{u.email}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{u.imobiliaria}</td>
                      <td className="px-3 py-3">
                        <select
                          value={ajuste.cargo}
                          onChange={e => setAjustePendente(prev => ({ ...prev, [u.id]: { ...ajuste, cargo: e.target.value as Cargo } }))}
                          className="px-2 py-1.5 rounded-md border border-slate-300 text-xs bg-white"
                        >
                          {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={ajuste.superiorId || ''}
                          onChange={e => setAjustePendente(prev => ({ ...prev, [u.id]: { ...ajuste, superiorId: e.target.value || null } }))}
                          className="px-2 py-1.5 rounded-md border border-slate-300 text-xs bg-white min-w-[160px]"
                        >
                          <option value="">(nenhum)</option>
                          {superioresDisponiveis.map(s => <option key={s.id} value={s.id}>{s.nomeCompleto} — {s.cargo}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={processandoId === u.id}
                            onClick={() => handleAprovar(u)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-60"
                          >
                            <Check className="w-3.5 h-3.5" /> Aprovar
                          </button>
                          <button
                            type="button"
                            disabled={processandoId === u.id}
                            onClick={() => handleRecusar(u)}
                            className="px-2.5 py-1.5 border border-slate-300 text-slate-500 hover:border-rose-300 hover:text-rose-600 font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-60"
                          >
                            <X className="w-3.5 h-3.5" /> Recusar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* USUÁRIOS ATIVOS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-bold text-slate-800">
            Usuários ativos{' '}
            <span className="text-xs font-semibold text-slate-400">
              ({ativosFiltrados.length}{ativosFiltrados.length !== ativos.length ? ` de ${ativos.length}` : ''})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFiltrosAtivAbertos(v => !v)}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1.5 cursor-pointer border ${filtrosAtivAbertos || contarFiltrosAtivos(filtrosAtivAplicados) > 0 ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200'}`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros{contarFiltrosAtivos(filtrosAtivAplicados) > 0 ? ` (${contarFiltrosAtivos(filtrosAtivAplicados)})` : ''}</span>
            {filtrosAtivAbertos ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        <PainelFiltroUsuarios
          aberto={filtrosAtivAbertos}
          rascunho={filtrosAtivRascunho}
          setCampo={setCampoFiltroAtiv}
          opcoesCargo={CARGOS}
          opcoesImobiliaria={opcoesImobiliariaAtiv}
          opcoesEquipeDe={superioresDisponiveis}
          onFiltrar={aplicarFiltrosAtiv}
          onLimpar={limparFiltrosAtiv}
        />

        {carregando ? (
          <div className="p-8 text-center text-sm text-slate-400">Carregando...</div>
        ) : ativos.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Nenhum usuário ativo ainda.</div>
        ) : ativosFiltrados.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm text-slate-500">Nenhum usuário bate com os filtros escolhidos.</p>
            <button type="button" onClick={limparFiltrosAtiv} className="text-xs font-semibold text-sky-600 hover:underline cursor-pointer">
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[760px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-2.5 font-bold">Nome</th>
                  <th className="px-3 py-2.5 font-bold">Cargo</th>
                  <th className="px-3 py-2.5 font-bold">Superior</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                  <th className="px-5 py-2.5 font-bold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ativosFiltrados.map(u => {
                  const superior = ativos.find(s => s.id === u.superiorId);
                  return (
                    <tr key={u.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3">
                        <div className="font-bold text-slate-800">{u.nomeCompleto}</div>
                        <div className="text-slate-400">{u.email}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <span>{u.cargo}</span>
                          {u.proprietario && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" title="Proprietário do aplicativo">
                              <Crown className="w-3 h-3" /> Proprietário
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{superior ? `${superior.nomeCompleto} — ${superior.cargo}` : '—'}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${u.status === 'ativo' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {u.status === 'ativo' ? 'Ativo' : 'Pausado'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {confirmandoExclusao === u.id ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-rose-600 font-semibold">Excluir esta conta?</span>
                            <button
                              type="button"
                              disabled={processandoId === u.id}
                              onClick={() => confirmarExcluir(u)}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md cursor-pointer disabled:opacity-60"
                            >
                              Sim, excluir
                            </button>
                            <button type="button" onClick={() => setConfirmandoExclusao(null)} className="px-2 py-1 border border-slate-300 text-slate-500 font-bold rounded-md cursor-pointer">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5 flex-wrap">
                            {(() => {
                              const donoAlheio = u.proprietario && u.id !== usuarioAtualId;
                              const bloqueado = u.cargo === 'Administrador';
                              return (
                                <>
                                  <button
                                    type="button"
                                    disabled={donoAlheio}
                                    onClick={() => abrirEdicao(u)}
                                    title={donoAlheio ? 'Só o próprio proprietário pode editar este cadastro' : undefined}
                                    className="px-2.5 py-1.5 border border-sky-200 text-sky-700 hover:bg-sky-50 font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                  >
                                    <Pencil className="w-3.5 h-3.5" /> Editar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={processandoId === u.id || (bloqueado && u.status === 'ativo')}
                                    onClick={() => alternarPausa(u)}
                                    title={bloqueado && u.status === 'ativo' ? 'Administradores não podem ser pausados por aqui' : undefined}
                                    className={`px-2.5 py-1.5 font-bold rounded-lg flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed ${bloqueado && u.status === 'ativo' ? '' : 'cursor-pointer'} ${u.status === 'ativo' ? 'border border-slate-300 text-slate-500 hover:border-rose-300 hover:text-rose-600' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                                  >
                                    {u.status === 'ativo' ? <><Ban className="w-3.5 h-3.5" /> Pausar</> : <><PlayCircle className="w-3.5 h-3.5" /> Reativar</>}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={bloqueado}
                                    onClick={() => setConfirmandoExclusao(u.id)}
                                    className="px-2.5 py-1.5 border border-slate-300 text-slate-500 hover:border-rose-300 hover:text-rose-600 font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:text-slate-500"
                                    title={bloqueado ? 'Administradores não podem ser excluídos por aqui' : 'Excluir conta'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                                  </button>
                                  {u.proprietario && u.id === usuarioAtualId && (
                                    <button
                                      type="button"
                                      onClick={abrirTransferencia}
                                      className="px-2.5 py-1.5 border border-amber-200 text-amber-700 hover:bg-amber-50 font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                                      title="Passar a propriedade do aplicativo para outro Administrador"
                                    >
                                      <ArrowLeftRight className="w-3.5 h-3.5" /> Transferir propriedade
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-5 py-3 text-[11px] text-slate-400 border-t border-slate-100">
          "Editar" muda o cadastro completo (nome, telefone, CPF, imobiliária, CRECI), o cargo, o superior hierárquico e as telas liberadas de qualquer pessoa — Administrador, Diretor, Gerente, Analista, Assistente ou Corretor — a qualquer momento. O e-mail de login não é editável por aqui. "Pausar" bloqueia o acesso sem apagar os dados; "Excluir" remove a conta em definitivo. Por segurança, quem tem cargo Administrador não pode ser pausado nem excluído por aqui — mude o cargo primeiro em "Editar", se for realmente necessário. O <Crown className="w-3 h-3 inline align-text-top text-amber-600" /> <strong>Proprietário</strong> é uma trava à parte: nenhum outro Administrador consegue editar, pausar ou excluir esse cadastro — só ele mesmo, e a única forma de passar o selo adiante é o botão "Transferir propriedade" na própria linha dele.
        </p>
      </div>

      {/* DRAWER DE EDIÇÃO */}
      {editando && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setEditando(null); }}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Editar cadastro de {editando.nomeCompleto}</h3>
            <p className="text-[11px] text-slate-400 -mt-3">
              E-mail: <span className="text-slate-600">{editando.email}</span> (login não editável por aqui)
            </p>

            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Dados cadastrais</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Nome completo</label>
                  <input type="text" value={edNomeCompleto} onChange={e => setEdNomeCompleto(e.target.value)} className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Telefone</label>
                  <input type="text" value={edTelefone} onChange={e => setEdTelefone(e.target.value)} className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">CPF</label>
                  <input type="text" value={edCpf} onChange={e => setEdCpf(e.target.value)} className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Imobiliária</label>
                  <input type="text" value={edImobiliaria} onChange={e => setEdImobiliaria(e.target.value)} className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">CRECI <span className="font-normal text-slate-400">(opcional)</span></label>
                  <input type="text" value={edCreci} onChange={e => setEdCreci(e.target.value)} className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Cargo</label>
                <select value={edCargo} onChange={e => setEdCargo(e.target.value as Cargo)} className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white">
                  {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Superior hierárquico</label>
                <select value={edSuperiorId || ''} onChange={e => setEdSuperiorId(e.target.value || null)} className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white">
                  <option value="">(nenhum — responde direto ao Administrador)</option>
                  {superioresDisponiveis.filter(s => s.id !== editando.id && !descendentesDoEditando.has(s.id)).map(s => (
                    <option key={s.id} value={s.id}>{s.nomeCompleto} — {s.cargo}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={edVerEquipe} onChange={e => setEdVerEquipe(e.target.checked)} className="w-4 h-4 accent-sky-600" />
              Também pode ver as propostas de quem está abaixo dele na hierarquia
            </label>

            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-2">Telas liberadas</p>
              <div className="grid grid-cols-2 gap-2">
                {TELAS_APP.map(t => (
                  <label key={t.key} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={edTelas.has(t.key)}
                      onChange={e => {
                        setEdTelas(prev => {
                          const novo = new Set(prev);
                          if (e.target.checked) novo.add(t.key); else novo.delete(t.key);
                          return novo;
                        });
                      }}
                      className="w-4 h-4 accent-sky-600"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 mb-1">Pode editar o cadastro da equipe</p>
              <p className="text-[11px] text-slate-400 mb-2">
                Se esta pessoa for Diretor(a) ou Gerente, marque aqui os campos que ela mesma pode corrigir no cadastro
                de quem está abaixo dela na hierarquia — direto pela tela de Simulações Salvas, sem precisar do
                Administrador. Deixe tudo desmarcado para não conceder nenhuma edição.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CAMPOS_EDITAVEIS_EQUIPE.map(c => (
                  <label key={c.key} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={edCamposEditaveis.has(c.key)}
                      onChange={e => {
                        setEdCamposEditaveis(prev => {
                          const novo = new Set(prev);
                          if (e.target.checked) novo.add(c.key); else novo.delete(c.key);
                          return novo;
                        });
                      }}
                      className="w-4 h-4 accent-sky-600"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setEditando(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">
                Cancelar
              </button>
              <button
                type="button"
                disabled={processandoId === editando.id}
                onClick={salvarEdicao}
                className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl cursor-pointer disabled:opacity-60"
              >
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR APLICAÇÃO DE PERMISSÕES EM MASSA */}
      {confirmandoAplicacaoMassa && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setConfirmandoAplicacaoMassa(false); }}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Aplicar permissões para todo o cargo {pmCargo}?</h3>
                <p className="text-xs text-slate-500">
                  Isso vai sobrescrever as telas liberadas, "ver equipe" e "editar cadastro da equipe" de{' '}
                  <strong>{usuariosDoCargoEmMassa.length} conta{usuariosDoCargoEmMassa.length === 1 ? '' : 's'}</strong> com o cargo {pmCargo} — inclusive quem já tiver algum ajuste individual diferente. Dados pessoais e o cargo de cada um não mudam.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setConfirmandoAplicacaoMassa(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer">
                Cancelar
              </button>
              <button
                type="button"
                disabled={aplicandoMassa}
                onClick={confirmarAplicacaoMassa}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aplicandoMassa ? 'Aplicando...' : 'Sim, aplicar a todos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TRANSFERIR PROPRIEDADE */}
      {transferindo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setTransferindo(false); }}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Transferir propriedade</h3>
                <p className="text-xs text-slate-500">
                  Você deixa de ser o proprietário do aplicativo e essa pessoa passa a ser — inclusive podendo, depois, editar, pausar ou excluir o seu próprio cadastro. Essa ação não tem volta por aqui: só a pessoa que virar a nova proprietária poderá transferir de volta.
                </p>
              </div>
            </div>

            {candidatosATransferencia.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                Não há outro Administrador ativo para receber a propriedade. Aprove ou promova alguém a Administrador primeiro.
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Novo proprietário</label>
                  <select value={novoProprietarioId} onChange={e => setNovoProprietarioId(e.target.value)} className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white">
                    {candidatosATransferencia.map(u => (
                      <option key={u.id} value={u.id}>{u.nomeCompleto} — {u.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Digite <span className="font-mono text-rose-600">TRANSFERIR</span> para confirmar
                  </label>
                  <input
                    type="text"
                    value={confirmacaoTransferencia}
                    onChange={e => setConfirmacaoTransferencia(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setTransferindo(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer">
                Cancelar
              </button>
              {candidatosATransferencia.length > 0 && (
                <button
                  type="button"
                  disabled={processandoTransferencia || confirmacaoTransferencia !== 'TRANSFERIR' || !novoProprietarioId}
                  onClick={confirmarTransferencia}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>{processandoTransferencia ? 'Transferindo...' : 'Transferir'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface PainelFiltroUsuariosProps {
  aberto: boolean;
  rascunho: FiltrosUsuarios;
  setCampo: <K extends keyof FiltrosUsuarios>(campo: K, valor: FiltrosUsuarios[K]) => void;
  opcoesCargo: string[];
  opcoesImobiliaria: string[];
  opcoesEquipeDe: PerfilUsuario[];
  onFiltrar: () => void;
  onLimpar: () => void;
}

const PainelFiltroUsuarios: React.FC<PainelFiltroUsuariosProps> = ({ aberto, rascunho, setCampo, opcoesCargo, opcoesImobiliaria, opcoesEquipeDe, onFiltrar, onLimpar }) => {
  if (!aberto) return null;
  const estiloInput = 'w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400';
  const rotulo = 'block text-[11px] font-bold text-slate-500 mb-1';
  return (
    <div className="px-5 py-4 bg-slate-50/60 border-b border-slate-100 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className={rotulo}>Nome ou e-mail</label>
          <input type="text" value={rascunho.busca} onChange={e => setCampo('busca', e.target.value)} placeholder="Buscar" className={estiloInput} />
        </div>
        <div>
          <label className={rotulo}>Cargo</label>
          <select value={rascunho.cargo} onChange={e => setCampo('cargo', e.target.value)} className={estiloInput}>
            <option value="">Todos</option>
            {opcoesCargo.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={rotulo}>Imobiliária</label>
          <select value={rascunho.imobiliaria} onChange={e => setCampo('imobiliaria', e.target.value)} className={estiloInput}>
            <option value="">Todas</option>
            {opcoesImobiliaria.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label className={rotulo}>Equipe de</label>
          <select value={rascunho.equipeDeId} onChange={e => setCampo('equipeDeId', e.target.value)} className={estiloInput}>
            <option value="">Todos</option>
            {opcoesEquipeDe.map(u => <option key={u.id} value={u.id}>{u.nomeCompleto} — {u.cargo}</option>)}
          </select>
        </div>
        <div>
          <label className={rotulo}>Cadastrado de</label>
          <input type="date" value={rascunho.dataDe} onChange={e => setCampo('dataDe', e.target.value)} className={estiloInput} />
        </div>
        <div>
          <label className={rotulo}>Cadastrado até</label>
          <input type="date" value={rascunho.dataAte} onChange={e => setCampo('dataAte', e.target.value)} className={estiloInput} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onLimpar} className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:text-rose-600 rounded-lg transition-all cursor-pointer">
          Limpar filtros
        </button>
        <button type="button" onClick={onFiltrar} className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer">
          <Search className="w-3.5 h-3.5" />
          <span>Filtrar</span>
        </button>
      </div>
    </div>
  );
};

const StatTile: React.FC<{ n: number; label: string; tone: 'amber' | 'sky' | 'slate' }> = ({ n, label, tone }) => {
  const cores = { amber: 'text-amber-600', sky: 'text-sky-600', slate: 'text-slate-700' }[tone];
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className={`text-2xl font-extrabold tabular-nums ${cores}`}>{n}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
};
