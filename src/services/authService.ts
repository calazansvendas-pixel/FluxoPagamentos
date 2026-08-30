import { supabase } from '../lib/supabaseClient';
import { Cargo, PerfilUsuario, StatusConta } from '../types';

/*
 * SQL DE CRIAÇÃO DO BANCO DE DADOS — ACESSO & PERMISSÕES
 * =======================================================
 * Execute no SQL Editor do seu projeto Supabase, em DUAS ETAPAS SEPARADAS —
 * elas têm janelas de risco diferentes para quem já usa o app hoje, sem login.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ PARTE 1 — pode rodar A QUALQUER MOMENTO, inclusive antes do merge.     │
 * │ Só cria coisas novas (tabela, coluna, funções) que o app de hoje nem   │
 * │ sabe que existem — não muda nada do que já está no ar.                │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * -- 1) Tabela de perfis (dados de negócio de cada usuário; a senha em si fica
 * --    guardada, criptografada, pelo próprio Supabase Auth — nunca aqui).
 * CREATE TABLE perfis (
 *   id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 *   email TEXT NOT NULL,
 *   nome_completo TEXT NOT NULL,
 *   telefone TEXT NOT NULL,
 *   cpf TEXT NOT NULL,
 *   imobiliaria TEXT NOT NULL,
 *   creci TEXT,
 *   cargo TEXT NOT NULL,
 *   superior_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
 *   status TEXT NOT NULL DEFAULT 'pendente',
 *   telas_liberadas TEXT[] NOT NULL DEFAULT '{}',
 *   ver_propostas_equipe BOOLEAN NOT NULL DEFAULT false,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 *
 * -- 2) Coluna de "dono" em cada simulação salva, para saber quem criou e
 * --    permitir a visão por hierarquia (Gerente/Diretor vendo a equipe).
 * ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;
 *
 * -- 3) Função auxiliar: este usuário é um Administrador ativo? Precisa ser
 * --    SECURITY DEFINER para não cair em recursão infinita quando usada
 * --    dentro de uma policy da própria tabela `perfis`.
 * CREATE OR REPLACE FUNCTION public.is_admin(usuario_id UUID)
 * RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
 *   SELECT EXISTS (
 *     SELECT 1 FROM perfis WHERE id = usuario_id AND cargo = 'Administrador' AND status = 'ativo'
 *   );
 * $$;
 *
 * -- 4) Função auxiliar: lista os ids de todos os subordinados (diretos e
 * --    indiretos) de um usuário, sem expor nome/CPF/telefone de ninguém —
 * --    é o que permite Gerente/Diretor verem as propostas da equipe. O limite
 * --    de profundidade (20 níveis) é só uma proteção contra um ciclo acidental
 * --    de "superior hierárquico" travar a consulta; a tela de Administrador já
 * --    evita criar ciclos ao escolher o superior de alguém.
 * CREATE OR REPLACE FUNCTION public.subordinados_de(usuario_id UUID)
 * RETURNS TABLE(id UUID) LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
 *   WITH RECURSIVE arvore AS (
 *     SELECT p.id, 1 AS profundidade FROM perfis p WHERE p.superior_id = usuario_id
 *     UNION ALL
 *     SELECT p.id, a.profundidade + 1 FROM perfis p INNER JOIN arvore a ON p.superior_id = a.id
 *     WHERE a.profundidade < 20
 *   )
 *   SELECT id FROM arvore;
 * $$;
 * GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
 * GRANT EXECUTE ON FUNCTION public.subordinados_de(UUID) TO authenticated;
 *
 * -- 5) Segurança por linha (RLS) da tabela de perfis.
 * ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "ver_proprio_perfil_ou_admin_ve_todos" ON perfis
 *   FOR SELECT USING (auth.uid() = id OR public.is_admin(auth.uid()));
 * -- Cadastro público só pode criar o PRÓPRIO perfil, e sempre como pendente
 * -- (impede alguém de se autoaprovar mandando status=ativo pela requisição).
 * CREATE POLICY "cadastro_cria_proprio_perfil_pendente" ON perfis
 *   FOR INSERT WITH CHECK (auth.uid() = id AND status = 'pendente');
 * -- Só o Administrador aprova, muda cargo/hierarquia/permissões, pausa ou exclui.
 * CREATE POLICY "admin_atualiza_qualquer_perfil" ON perfis
 *   FOR UPDATE USING (public.is_admin(auth.uid()));
 * CREATE POLICY "admin_exclui_qualquer_perfil" ON perfis
 *   FOR DELETE USING (public.is_admin(auth.uid()));
 * -- (RLS na tabela `perfis` é segura de ligar já: o app de hoje, no ar, nunca
 * -- lê nem grava nessa tabela — só o código deste PR usa ela.)
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ PARTE 2 — NÃO RODAR AINDA. Só execute isto no exato momento em que o  │
 * │ merge deste PR for para produção (ou logo em seguida). `empreendimen- │
 * │ tos`, `unidades` e `simulacoes` são usadas pelo app QUE JÁ ESTÁ NO AR, │
 * │ sem login — os usuários de hoje acessam essas tabelas sem autenticar. │
 * │ Ligar aqui "exige estar logado" antes do código novo estar publicado  │
 * │ derruba, na hora, o Simulador e as Políticas & Empreendimentos para   │
 * │ todo mundo que usa o app agora.                                       │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * -- 6) Segurança por linha da tabela de simulações: cada um vê as próprias;
 * --    Administrador vê todas; quem tem "ver_propostas_equipe" ligado também
 * --    vê as de toda a equipe abaixo dele na hierarquia.
 * ALTER TABLE simulacoes ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "ve_proprias_ou_equipe_ou_admin" ON simulacoes
 *   FOR SELECT USING (
 *     criado_por = auth.uid()
 *     OR public.is_admin(auth.uid())
 *     OR (
 *       COALESCE((SELECT ver_propostas_equipe FROM perfis WHERE id = auth.uid()), false)
 *       AND criado_por IN (SELECT id FROM public.subordinados_de(auth.uid()))
 *     )
 *   );
 * CREATE POLICY "cria_propria_simulacao" ON simulacoes
 *   FOR INSERT WITH CHECK (criado_por = auth.uid());
 * CREATE POLICY "exclui_propria_ou_admin" ON simulacoes
 *   FOR DELETE USING (criado_por = auth.uid() OR public.is_admin(auth.uid()));
 * -- Atenção: simulações salvas ANTES desta migração não têm criado_por (ficam
 * -- NULL) — elas continuam visíveis só para o Administrador até lá.
 *
 * -- 7) Trava as tabelas de empreendimentos/unidades para exigir login (hoje
 * --    qualquer pessoa com a chave pública do projeto conseguia ler/gravar
 * --    direto, sem passar pelo app). Deixamos a checagem fina de "quem edita
 * --    Políticas" a cargo do app (aba só aparece pra quem tem a tela liberada);
 * --    aqui só fechamos a porta para quem nem logado está.
 * ALTER TABLE empreendimentos ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "logados_leem_empreendimentos" ON empreendimentos FOR SELECT USING (auth.role() = 'authenticated');
 * CREATE POLICY "logados_gravam_empreendimentos" ON empreendimentos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
 * CREATE POLICY "logados_leem_unidades" ON unidades FOR SELECT USING (auth.role() = 'authenticated');
 * CREATE POLICY "logados_gravam_unidades" ON unidades FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
 */

interface PerfilRow {
  id: string;
  email: string;
  nome_completo: string;
  telefone: string;
  cpf: string;
  imobiliaria: string;
  creci: string | null;
  cargo: Cargo;
  superior_id: string | null;
  status: StatusConta;
  telas_liberadas: string[] | null;
  ver_propostas_equipe: boolean | null;
  created_at?: string;
}

function rowParaPerfil(row: PerfilRow): PerfilUsuario {
  return {
    id: row.id,
    email: row.email,
    nomeCompleto: row.nome_completo,
    telefone: row.telefone,
    cpf: row.cpf,
    imobiliaria: row.imobiliaria,
    creci: row.creci || undefined,
    cargo: row.cargo,
    superiorId: row.superior_id,
    status: row.status,
    telasLiberadas: row.telas_liberadas || [],
    verPropostasEquipe: !!row.ver_propostas_equipe,
    createdAt: row.created_at
  };
}

export interface DadosCadastro {
  nomeCompleto: string;
  telefone: string;
  email: string;
  cpf: string;
  imobiliaria: string;
  creci?: string;
  cargo: Cargo;
  senha: string;
}

export const authService = {
  // Cria o usuário no Supabase Auth (dispara o e-mail de confirmação) e, na
  // sequência, cria a linha correspondente em `perfis` já como pendente.
  async cadastrar(dados: DadosCadastro): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: dados.email,
        password: dados.senha
      });
      if (error) return { success: false, error: error.message };
      const userId = data.user?.id;
      if (!userId) {
        return { success: false, error: 'Não foi possível criar o usuário. Tente novamente.' };
      }

      const { error: perfilError } = await supabase.from('perfis').insert([{
        id: userId,
        email: dados.email,
        nome_completo: dados.nomeCompleto,
        telefone: dados.telefone,
        cpf: dados.cpf,
        imobiliaria: dados.imobiliaria,
        creci: dados.creci || null,
        cargo: dados.cargo,
        status: 'pendente',
        telas_liberadas: [],
        ver_propostas_equipe: false
      }]);
      if (perfilError) return { success: false, error: perfilError.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Erro ao criar o cadastro.' };
    }
  },

  async entrar(email: string, senha: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  async sair(): Promise<void> {
    await supabase.auth.signOut();
  },

  async recuperarSenha(email: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  async meuPerfil(userId: string): Promise<PerfilUsuario | null> {
    const { data, error } = await supabase.from('perfis').select('*').eq('id', userId).maybeSingle();
    if (error || !data) return null;
    return rowParaPerfil(data as PerfilRow);
  },

  // --- Painel do Administrador ---------------------------------------------

  async listarPendentes(): Promise<PerfilUsuario[]> {
    const { data, error } = await supabase.from('perfis').select('*').eq('status', 'pendente').order('created_at', { ascending: true });
    if (error || !data) return [];
    return data.map(rowParaPerfil);
  },

  async listarAtivosEPausados(): Promise<PerfilUsuario[]> {
    const { data, error } = await supabase.from('perfis').select('*').in('status', ['ativo', 'pausado']).order('nome_completo', { ascending: true });
    if (error || !data) return [];
    return data.map(rowParaPerfil);
  },

  // Aprova um cadastro pendente, já definindo cargo/superior/telas confirmados
  // pelo Administrador (que pode corrigir o que a pessoa indicou no cadastro).
  async aprovarUsuario(id: string, ajustes: { cargo: Cargo; superiorId: string | null; telasLiberadas: string[]; verPropostasEquipe: boolean }) {
    const { error } = await supabase.from('perfis').update({
      status: 'ativo',
      cargo: ajustes.cargo,
      superior_id: ajustes.superiorId,
      telas_liberadas: ajustes.telasLiberadas,
      ver_propostas_equipe: ajustes.verPropostasEquipe
    }).eq('id', id);
    return { success: !error, error: error?.message };
  },

  async recusarUsuario(id: string) {
    const { error } = await supabase.from('perfis').delete().eq('id', id);
    return { success: !error, error: error?.message };
  },

  async editarCargoEPermissoes(id: string, ajustes: { cargo: Cargo; superiorId: string | null; telasLiberadas: string[]; verPropostasEquipe: boolean }) {
    const { error } = await supabase.from('perfis').update({
      cargo: ajustes.cargo,
      superior_id: ajustes.superiorId,
      telas_liberadas: ajustes.telasLiberadas,
      ver_propostas_equipe: ajustes.verPropostasEquipe
    }).eq('id', id);
    return { success: !error, error: error?.message };
  },

  async definirStatus(id: string, status: StatusConta) {
    const { error } = await supabase.from('perfis').update({ status }).eq('id', id);
    return { success: !error, error: error?.message };
  },

  // Remove o acesso da pessoa em definitivo (apaga o perfil, então ela some do
  // app e de qualquer hierarquia). O login dela em si (Supabase Auth) só é
  // apagado de fato com uma função de servidor à parte — não é algo seguro de
  // fazer com a chave pública usada aqui; se um dia for necessário liberar o
  // mesmo e-mail para um cadastro novo do zero, isso pede esse passo extra.
  async excluirUsuario(id: string) {
    const { error } = await supabase.from('perfis').delete().eq('id', id);
    return { success: !error, error: error?.message };
  }
};
