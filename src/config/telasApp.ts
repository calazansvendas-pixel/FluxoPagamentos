import { Calculator, FileCheck2, Building2, FileSpreadsheet, ClipboardList, Coins, FileOutput, ShieldCheck } from 'lucide-react';
import { ActiveTab, Cargo } from '../types';
import { ConditionKind } from '../utils/calculations';

export interface TelaApp {
  // Chave estável gravada em PerfilUsuario.telasLiberadas — nunca renomear uma
  // chave existente (perfis já aprovados referenciam essas chaves no banco).
  key: string;
  label: string;
  icon: typeof Calculator;
  tab: ActiveTab;
  variant?: ConditionKind;
}

// Fonte única das telas do sistema. O menu de Navegação (Sidebar) e o painel
// "Editar cargo e permissões" (AdminPanelView) leem esta mesma lista — uma aba
// nova só precisa ser adicionada aqui para aparecer automaticamente nos dois
// lugares, liberável para qualquer cargo pelo Administrador.
export const TELAS_APP: TelaApp[] = [
  { key: 'simulator', label: 'Simulador de Crédito', icon: Calculator, tab: 'simulator' },
  { key: 'banco-direto', label: 'Sinal c/ Banco Direto', icon: FileCheck2, tab: 'details', variant: 'banco-direto' },
  { key: 'sinal-morar', label: 'Sinal c/ Morar', icon: FileCheck2, tab: 'ficha-morar' },
  { key: 'parcelamento-morar', label: 'Parcelamento Morar', icon: Coins, tab: 'details', variant: 'parcelamento-morar' },
  { key: 'policies', label: 'Políticas & Empreendimentos', icon: Building2, tab: 'policies' },
  { key: 'pdf-settings', label: 'Configurar Exportação PDF', icon: FileOutput, tab: 'pdf-settings' },
  { key: 'import-table', label: 'Importar Tabela (Excel)', icon: FileSpreadsheet, tab: 'import-table' },
  { key: 'saved-simulations', label: 'Simulações Salvas', icon: ClipboardList, tab: 'saved-simulations' },
  { key: 'admin-panel', label: 'Painel do Administrador', icon: ShieldCheck, tab: 'admin-panel' }
];

export const CARGOS: Cargo[] = [
  'Administrador',
  'Diretor',
  'Gerente',
  'Analista de Vendas',
  'Analista de Crédito',
  'Assistente de Vendas',
  'Assistente de Crédito',
  'Corretor'
];

// Sugestão inicial de telas liberadas por cargo, usada só para pré-preencher a
// tela de aprovação de cadastros pendentes — o Administrador sempre pode
// ajustar livremente antes (ou depois) de aprovar.
export const TELAS_PADRAO_POR_CARGO: Record<Cargo, string[]> = {
  'Administrador': TELAS_APP.map(t => t.key),
  'Diretor': ['simulator', 'banco-direto', 'sinal-morar', 'parcelamento-morar', 'policies', 'saved-simulations'],
  'Gerente': ['simulator', 'banco-direto', 'sinal-morar', 'parcelamento-morar', 'saved-simulations'],
  'Analista de Vendas': ['simulator', 'banco-direto', 'sinal-morar', 'parcelamento-morar', 'saved-simulations'],
  'Analista de Crédito': ['simulator', 'policies', 'saved-simulations'],
  'Assistente de Vendas': ['simulator', 'saved-simulations'],
  'Assistente de Crédito': ['simulator'],
  'Corretor': ['simulator', 'saved-simulations']
};
