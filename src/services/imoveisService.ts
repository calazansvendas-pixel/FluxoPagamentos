import { supabase } from '../lib/supabaseClient';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { parseM2Number, parseCurrency, formatArea } from '../utils/formatters';

/*
 * SQL DE CRIAÇÃO DO BANCO DE DADOS SUPABASE
 * =========================================
 * Execute este script no SQL Editor do seu projeto Supabase para criar as tabelas
 *
 * -- Tabela de Empreendimentos
 * CREATE TABLE empreendimentos (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   nome TEXT NOT NULL,
 *   delivery_date_phase1 TEXT,
 *   delivery_date_phase2 TEXT
 * );
 *
 * -- Tabela de Unidades
 * CREATE TABLE unidades (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   empreendimento_id UUID REFERENCES empreendimentos(id) ON DELETE CASCADE,
 *   torre TEXT NOT NULL,
 *   unidade TEXT NOT NULL,
 *   tipologia TEXT,
 *   area_privativa NUMERIC,
 *   quintal NUMERIC,
 *   preco_tabela NUMERIC,
 *   avaliacao_bancaria NUMERIC,
 *   itbi_total NUMERIC,
 *   itbi_primeiro_imovel NUMERIC,
 *   itbi_segundo_imovel NUMERIC,
 *   status TEXT
 * );
 *
 * -- Se sua tabela unidades já existir, execute para adicionar as colunas opcionais:
 * -- ALTER TABLE unidades ADD COLUMN IF NOT EXISTS itbi_primeiro_imovel NUMERIC;
 * -- ALTER TABLE unidades ADD COLUMN IF NOT EXISTS itbi_segundo_imovel NUMERIC;
 *
 * -- Se sua tabela empreendimentos já existir, execute para adicionar as colunas de
 * -- política de crédito (necessário para que a política configurada em "Políticas &
 * -- Empreendimentos" fique compartilhada entre todos os usuários, em vez de ficar
 * -- salva apenas no navegador de quem editou):
 * -- ALTER TABLE empreendimentos ADD COLUMN IF NOT EXISTS conditions JSONB;
 * -- ALTER TABLE empreendimentos ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
 */

export const imoveisService = {
  // Converte unidades do formato Supabase para linhas de tabela (tableInfo.rows)
  converterUnidadesParaLinhas(unidades: any[]): (string | number)[][] {
    if (!unidades || unidades.length === 0) return [];
    return unidades.map(u => [
      u.status || '1ª Fase',
      String(u.torre || '').trim(),
      String(u.unidade || '').trim(),
      formatArea(u.area_privativa),
      formatArea(u.quintal),
      u.tipologia || '2 Quartos',
      Number(u.avaliacao_bancaria || 0),
      Number(u.preco_tabela || 0),
      Number(u.itbi_primeiro_imovel !== undefined && u.itbi_primeiro_imovel !== null ? u.itbi_primeiro_imovel : (u.itbi_total || 0)),
      Number(u.itbi_segundo_imovel !== undefined && u.itbi_segundo_imovel !== null ? u.itbi_segundo_imovel : (u.itbi_total || u.itbi_primeiro_imovel || 0))
    ]);
  },

  // Lista todos os empreendimentos (Tenta Supabase, cai para Mock Local)
  async listarEmpreendimentos() {
    try {
      const { data, error } = await supabase.from('empreendimentos').select('*');
      
      if (error || !data || data.length === 0) {
        console.warn('Supabase não configurado ou sem dados. Usando Mock (INITIAL_PRODUCTS).');
        return INITIAL_PRODUCTS; // Fallback
      }
      return data;
    } catch (e) {
      console.warn('Erro ao conectar com Supabase. Usando Mock (INITIAL_PRODUCTS).');
      return INITIAL_PRODUCTS; // Fallback
    }
  },

  // Garante que o empreendimento exista no Supabase (nome, datas de entrega) e, quando
  // fornecida, grava também a política de crédito (conditions) e o destaque (is_featured) —
  // para que a política configurada por um usuário fique visível para todos os demais.
  async sincronizarEmpreendimento(emp: {
    id: string;
    nome: string;
    delivery_date_phase1?: string;
    delivery_date_phase2?: string;
    conditions?: unknown;
    is_featured?: boolean;
  }) {
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(emp.id);
      if (!isUUID) return;

      const basePayload: Record<string, unknown> = {
        id: emp.id,
        nome: emp.nome,
        delivery_date_phase1: emp.delivery_date_phase1 || null,
        delivery_date_phase2: emp.delivery_date_phase2 || null
      };
      const fullPayload = { ...basePayload };
      if (emp.conditions !== undefined) fullPayload.conditions = emp.conditions;
      if (emp.is_featured !== undefined) fullPayload.is_featured = emp.is_featured;

      const { error } = await supabase.from('empreendimentos').upsert([fullPayload], { onConflict: 'id' });

      // Se as colunas conditions/is_featured ainda não existirem no schema do Supabase
      // (usuário ainda não rodou o ALTER TABLE), grava ao menos os campos básicos, para
      // não perder a sincronização de nome/datas de entrega enquanto isso.
      if (error && (error.code === 'PGRST204' || /conditions|is_featured/i.test(String(error.message || '')))) {
        console.warn('Aviso: colunas conditions/is_featured não encontradas no Supabase. Rode o ALTER TABLE indicado em imoveisService.ts para sincronizar a política de crédito entre usuários. Gravando apenas nome/datas por enquanto.');
        await supabase.from('empreendimentos').upsert([basePayload], { onConflict: 'id' });
      }
    } catch (e) {
      console.warn('Aviso ao sincronizar empreendimento no Supabase:', e);
    }
  },

  // Salva lote de unidades no Supabase e recarrega a lista atualizada com suporte resiliente a esquemas legados
  async salvarUnidadesLote(empId: string, unidades: any[]) {
    if (!unidades || unidades.length === 0) {
      return { success: true, data: [] };
    }

    // Helper para tentar upsert
    const tryUpsert = async (payload: any[]) => {
      return await supabase
        .from('unidades')
        .upsert(payload, {
          onConflict: 'empreendimento_id, torre, unidade'
        });
    };

    try {
      // 1. Tenta salvar com todas as colunas
      let { error } = await tryUpsert(unidades);

      // 2. Se a coluna 'itbi_segundo_imovel' ou 'itbi_primeiro_imovel' não existir no schema cache do Supabase
      if (error && (error.code === 'PGRST204' || String(error.message || '').includes('itbi_segundo_imovel'))) {
        console.warn('Aviso: Coluna itbi_segundo_imovel não encontrada no Supabase. Removendo do payload e tentando novamente...');
        const payloadSemItbi2 = unidades.map(u => {
          const { itbi_segundo_imovel, ...rest } = u;
          return {
            ...rest,
            itbi_total: u.itbi_segundo_imovel || u.itbi_total || u.itbi_primeiro_imovel
          };
        });
        const res2 = await tryUpsert(payloadSemItbi2);
        error = res2.error;

        // Se ainda falhar por falta de itbi_primeiro_imovel
        if (error && (error.code === 'PGRST204' || String(error.message || '').includes('itbi_primeiro_imovel'))) {
          console.warn('Aviso: Coluna itbi_primeiro_imovel não encontrada no Supabase. Removendo do payload...');
          const payloadBase = payloadSemItbi2.map(u => {
            const { itbi_primeiro_imovel, ...rest } = u;
            return rest;
          });
          const res3 = await tryUpsert(payloadBase);
          error = res3.error;
        }
      } else if (error && (error.code === 'PGRST204' || String(error.message || '').includes('itbi_primeiro_imovel'))) {
        console.warn('Aviso: Coluna itbi_primeiro_imovel não encontrada no Supabase. Removendo do payload...');
        const payloadSemItbi1 = unidades.map(u => {
          const { itbi_primeiro_imovel, ...rest } = u;
          return rest;
        });
        const res3 = await tryUpsert(payloadSemItbi1);
        error = res3.error;
      }

      if (error) {
        throw error;
      }

      // Recarrega unidades diretamente do banco para garantir consistência
      const { data: freshUnits, error: fetchErr } = await supabase
        .from('unidades')
        .select('*')
        .eq('empreendimento_id', empId);

      if (fetchErr) {
        console.warn('Aviso ao recarregar unidades após upsert:', fetchErr);
        return { success: true, data: unidades };
      }

      return { success: true, data: freshUnits || unidades };
    } catch (e: any) {
      console.error('Erro no salvamento em lote de unidades no Supabase:', e);
      return { success: false, error: e?.message || 'Erro ao sincronizar com o banco' };
    }
  },

  // Limpa/Exclui todas as unidades vinculadas a um empreendimento específico no Supabase
  async limparUnidadesEmpreendimento(empId: string) {
    try {
      const { error } = await supabase
        .from('unidades')
        .delete()
        .eq('empreendimento_id', empId);

      if (error) {
        console.error('Erro ao excluir unidades do empreendimento no Supabase:', error);
        throw error;
      }

      return { success: true };
    } catch (e: any) {
      console.error('Exceção ao excluir unidades:', e);
      return { success: false, error: e?.message || 'Falha ao limpar unidades no banco' };
    }
  },

  // Lista unidades por empreendimento (Tenta Supabase, se falhar tenta Mock)
  async listarUnidadesPorEmpreendimento(empId: string) {
    try {
      const { data, error } = await supabase
        .from('unidades')
        .select('*')
        .eq('empreendimento_id', empId);
      
      if (error || !data || data.length === 0) {
        throw new Error('Fallback para Mock local');
      }
      return data.map(u => ({
        ...u,
        area_privativa: parseM2Number(u.area_privativa),
        quintal: parseM2Number(u.quintal),
        preco_tabela: parseCurrency(u.preco_tabela),
        avaliacao_bancaria: parseCurrency(u.avaliacao_bancaria),
        itbi_primeiro_imovel: parseCurrency(u.itbi_primeiro_imovel !== undefined && u.itbi_primeiro_imovel !== null ? u.itbi_primeiro_imovel : u.itbi_total),
        itbi_segundo_imovel: parseCurrency(u.itbi_segundo_imovel !== undefined && u.itbi_segundo_imovel !== null ? u.itbi_segundo_imovel : u.itbi_total),
        itbi_total: parseCurrency(u.itbi_segundo_imovel !== undefined && u.itbi_segundo_imovel !== null ? u.itbi_segundo_imovel : u.itbi_total)
      }));
    } catch (e) {
      // Tenta achar o empreendimento nos mocks
      const prod = INITIAL_PRODUCTS.find(p => p.id === empId) || INITIAL_PRODUCTS[0];
      if (prod && prod.tableInfo && prod.tableInfo.rows) {
        // Mapeia o array do CSV (rows) para o formato de objetos que a interface entende
        return prod.tableInfo.rows.map((row: any[]) => {
          // O formato padrão do CSV no Mock:
          // 0=Fase, 1=Torre, 2=Unidade, 3=Area Priv, 4=Area Quintal, 5=Tipologia, 6=Avaliacao, 7=PrecoTabela, 8=ITBI (1o), 9=ITBI (2o)
          const itbi1 = parseCurrency(row[8]);
          const itbi2 = parseCurrency(row[9]) || itbi1;
          return {
            id: `${row[1]}-${row[2]}`,
            empreendimento_id: empId,
            torre: row[1]?.trim() || '',
            unidade: row[2]?.trim() || '',
            tipologia: row[5] || '2 Quartos',
            area_privativa: parseM2Number(row[3]),
            quintal: parseM2Number(row[4]),
            preco_tabela: parseCurrency(row[7]),
            avaliacao_bancaria: parseCurrency(row[6]),
            itbi_primeiro_imovel: itbi1,
            itbi_segundo_imovel: itbi2,
            itbi_total: itbi2,
            status: row[0] || '1ª Fase'
          };
        }).filter(u => u.torre !== '' && u.unidade !== '');
      }
      return [];
    }
  },

  // Salvar Simulação
  async salvarSimulacao(dadosProposta: {
    cliente_nome?: string;
    renda?: number;
    empreendimento_id?: string;
    dados: any;
  }) {
    try {
      const payload: any = {
        cliente_nome: dadosProposta.cliente_nome || 'Cliente Não Informado',
        renda: Number(dadosProposta.renda || 0),
        dados: dadosProposta.dados
      };

      // Validar se o empreendimento_id é um UUID válido para o Supabase
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dadosProposta.empreendimento_id || '');
      if (isUUID) {
        payload.empreendimento_id = dadosProposta.empreendimento_id;
      }

      const { data, error } = await supabase
        .from('simulacoes')
        .insert([payload])
        .select();
      
      if (error) {
        console.error('Erro ao salvar no Supabase, salvando apenas no console/storage:', error);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (e: any) {
      console.warn('Simulação salva em modo offline (Mock):', dadosProposta);
      return { success: false, error: e?.message || 'Erro de conexão' };
    }
  },

  // Rotina de Inicialização Automática (Verifica e insere dados iniciais se vazio)
  async inicializarBancoSeNecessario() {
    try {
      // 1. Verifica se a tabela 'empreendimentos' existe e se tem dados
      const { data: emps, error: errEmp } = await supabase.from('empreendimentos').select('id').limit(1);
      
      if (errEmp) {
        console.warn('As tabelas do Supabase ainda não existem. Por favor, execute o script SQL de criação no Supabase Editor.', errEmp.message);
        return;
      }

      // Se a tabela estiver vazia, faz o Seed inicial
      if (!emps || emps.length === 0) {
        console.log('Tabela de empreendimentos vazia. Iniciando carga automática dos dados iniciais...');
        
        const empId = '11111111-1111-1111-1111-111111111111';
        
        const { error: insertEmpErr } = await supabase.from('empreendimentos').upsert([{
          id: empId,
          nome: 'Vista dos Colibris',
          delivery_date_phase1: '2026-02-28',
          delivery_date_phase2: '2027-02-28'
        }], { onConflict: 'id' });

        if (insertEmpErr && insertEmpErr.code !== '23505') {
          console.error('Erro ao inserir empreendimento de teste:', insertEmpErr);
          return;
        }

        const { success: insertSuccess, error: insertUnitsErr } = await this.salvarUnidadesLote(empId, [
          { empreendimento_id: empId, torre: 'D', unidade: '303', tipologia: '2Q', area_privativa: 44.02, quintal: 0.00, preco_tabela: 241902.00, avaliacao_bancaria: 218000.00, itbi_total: 19230.00, itbi_primeiro_imovel: 4806.00, itbi_segundo_imovel: 19230.00, status: 'DISPONÍVEL' },
          { empreendimento_id: empId, torre: 'D', unidade: '801', tipologia: '2Q', area_privativa: 42.14, quintal: 0.00, preco_tabela: 246902.00, avaliacao_bancaria: 218000.00, itbi_total: 19230.00, itbi_primeiro_imovel: 4806.00, itbi_segundo_imovel: 19230.00, status: 'DISPONÍVEL' },
          { empreendimento_id: empId, torre: 'C', unidade: '304', tipologia: '2Q', area_privativa: 44.02, quintal: 0.00, preco_tabela: 239902.00, avaliacao_bancaria: 218000.00, itbi_total: 19230.00, itbi_primeiro_imovel: 4806.00, itbi_segundo_imovel: 19230.00, status: 'DISPONÍVEL' },
          { empreendimento_id: empId, torre: 'C', unidade: '308', tipologia: '2Q', area_privativa: 43.50, quintal: 0.00, preco_tabela: 241902.00, avaliacao_bancaria: 218000.00, itbi_total: 19230.00, itbi_primeiro_imovel: 4806.00, itbi_segundo_imovel: 19230.00, status: 'DISPONÍVEL' }
        ]);

        if (!insertSuccess) {
          console.error('Erro ao inserir unidades de teste:', insertUnitsErr);
        } else {
          console.log('Carga inicial concluída com sucesso! (Vista dos Colibris)');
        }
      } else {
        console.log('Banco de dados já contém dados. Verificando integridade das áreas...');
        try {
          const { data: unitsToFix } = await supabase.from('unidades').select('*');
          if (unitsToFix && unitsToFix.length > 0) {
            const corruptedUnits = unitsToFix.filter(u => Number(u.area_privativa) >= 200 || Number(u.quintal) >= 200);
            if (corruptedUnits.length > 0) {
              const fixedUnits = corruptedUnits.map(u => ({
                ...u,
                area_privativa: parseM2Number(u.area_privativa),
                quintal: parseM2Number(u.quintal)
              }));
              await supabase.from('unidades').upsert(fixedUnits, { onConflict: 'empreendimento_id, torre, unidade' });
              console.log(`Corrigidas ${fixedUnits.length} unidades com área sem ponto decimal no Supabase.`);
            }
          }
        } catch (cleanErr) {
          console.warn('Aviso ao verificar integridade das unidades:', cleanErr);
        }
      }

    } catch (err) {
      console.warn('Falha silenciosa na rotina de inicialização do banco.', err);
    }
  }
};

