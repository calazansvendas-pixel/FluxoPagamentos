import { supabase } from '../lib/supabaseClient';
import { INITIAL_PRODUCTS } from '../data/initialProducts';

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
 *   status TEXT
 * );
 * 
 * -- Carga Inicial de Teste (Mock Data - Vista dos Colibris)
 * INSERT INTO empreendimentos (id, nome, delivery_date_phase1, delivery_date_phase2) 
 * VALUES ('11111111-1111-1111-1111-111111111111', 'Vista dos Colibris', '2026-02-28', '2027-02-28');
 * 
 * INSERT INTO unidades (empreendimento_id, torre, unidade, tipologia, area_privativa, quintal, preco_tabela, avaliacao_bancaria, itbi_total, status) VALUES 
 * ('11111111-1111-1111-1111-111111111111', 'D', '303', '2Q', 44.02, 0.00, 241902.00, 218000.00, 4806.00, 'DISPONÍVEL'),
 * ('11111111-1111-1111-1111-111111111111', 'D', '801', '2Q', 42.14, 0.00, 246902.00, 218000.00, 4806.00, 'DISPONÍVEL'),
 * ('11111111-1111-1111-1111-111111111111', 'C', '304', '2Q', 44.02, 0.00, 239902.00, 218000.00, 4806.00, 'DISPONÍVEL');
 */

export const imoveisService = {
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
      return data;
    } catch (e) {
      // Tenta achar o empreendimento nos mocks
      const prod = INITIAL_PRODUCTS.find(p => p.id === empId) || INITIAL_PRODUCTS[0];
      if (prod && prod.tableInfo && prod.tableInfo.rows) {
        // Mapeia o array do CSV (rows) para o formato de objetos que a interface entende
        return prod.tableInfo.rows.map((row: string[]) => {
          // O formato padrão do CSV no Mock:
          // 0=Fase, 1=Torre, 2=Unidade, 3=Area Priv, 4=Area Quintal, 5=Tipologia, 6=Avaliacao, 7=PrecoTabela, 8=ITBI (1o), 9=ITBI (2o)
          return {
            id: `${row[1]}-${row[2]}`,
            empreendimento_id: empId,
            torre: row[1]?.trim() || '',
            unidade: row[2]?.trim() || '',
            tipologia: row[5] || '',
            area_privativa: parseFloat(String(row[3] || '0').replace(/\./g, '').replace(',', '.')),
            quintal: parseFloat(String(row[4] || '0').replace(/\./g, '').replace(',', '.')),
            preco_tabela: parseFloat(String(row[7] || '0').replace(/\./g, '').replace(',', '.')),
            avaliacao_bancaria: parseFloat(String(row[6] || '0').replace(/\./g, '').replace(',', '.')),
            itbi_total: parseFloat(String(row[9] || '0').replace(/\./g, '').replace(',', '.')), // ITBI para 2o Imóvel como base segura
            itbi_primeiro_imovel: parseFloat(String(row[8] || '0').replace(/\./g, '').replace(',', '.')),
            status: row[0] || '1ª Fase'
          };
        }).filter(u => u.torre !== '' && u.unidade !== ''); // Filtra linhas vazias
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
        
        const { error: insertEmpErr } = await supabase.from('empreendimentos').insert([{
          id: empId,
          nome: 'Vista dos Colibris',
          delivery_date_phase1: '2026-02-28',
          delivery_date_phase2: '2027-02-28'
        }]);

        if (insertEmpErr) {
          console.error('Erro ao inserir empreendimento de teste:', insertEmpErr);
          return;
        }

        const { error: insertUnitsErr } = await supabase.from('unidades').insert([
          { empreendimento_id: empId, torre: 'D', unidade: '303', tipologia: '2Q', area_privativa: 44.02, quintal: 0.00, preco_tabela: 241902.00, avaliacao_bancaria: 218000.00, itbi_total: 4806.00, itbi_primeiro_imovel: 4806.00, status: 'DISPONÍVEL' },
          { empreendimento_id: empId, torre: 'D', unidade: '801', tipologia: '2Q', area_privativa: 42.14, quintal: 0.00, preco_tabela: 246902.00, avaliacao_bancaria: 218000.00, itbi_total: 4806.00, itbi_primeiro_imovel: 4806.00, status: 'DISPONÍVEL' },
          { empreendimento_id: empId, torre: 'C', unidade: '304', tipologia: '2Q', area_privativa: 44.02, quintal: 0.00, preco_tabela: 239902.00, avaliacao_bancaria: 218000.00, itbi_total: 4806.00, itbi_primeiro_imovel: 4806.00, status: 'DISPONÍVEL' }
        ]);

        if (insertUnitsErr) {
          console.error('Erro ao inserir unidades de teste:', insertUnitsErr);
        } else {
          console.log('Carga inicial concluída com sucesso! (Vista dos Colibris)');
        }
      } else {
        console.log('Banco de dados já contém dados. Rotina de seed ignorada.');
      }

    } catch (err) {
      console.warn('Falha silenciosa na rotina de inicialização do banco.', err);
    }
  }
};

