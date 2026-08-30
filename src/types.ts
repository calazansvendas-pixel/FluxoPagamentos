export interface CommercialCondition {
  id: string;
  name: string;
  numParcelas: number;
  sinalMinimo: string;
  riscoRendaPct: number;
  riscoImovelPct: number;
  mesesTabela1: number;
  taxaJuros1: number;
  mesesTabela2: number;
  taxaJuros2: number;
  policy: string;
  // % de Desconto à Vista: ainda não é aplicado em nenhum cálculo do simulador,
  // é apenas cadastrado aqui como base para uma futura regra de desconto por
  // pagamento à vista (padrão 0%, ou seja, sem desconto).
  descontoAVistaPct?: number;

  // Campos específicos para a condição "Sinal c/ Morar"
  mesesObra?: number;
  mesesPos?: number;
  percMaxProSolutoGlobal?: number; // % Max Pró-Soluto Global (ex: 17.0%)
  percMaxPosObra?: number; // % Max Pós-Obra (ex: 8.0%)
  riscoPosPct?: number; // Compatibilidade retroativa
  // Séries Contínuas Globais (Blocos de meses). Cada balde tem seu próprio
  // percentual (globalSerieXPct) E sua própria quantidade de meses (serieXMeses,
  // padrão 12 cada). O balde é preenchido contínuo entre Obra e Pós-Obra: se um
  // balde é dividido pela fronteira Obra/Pós-Obra, as duas partes usam o MESMO
  // percentual (é o mesmo balde), só a quantidade de meses de cada parte muda.
  globalSerie1Pct?: number; // Ano 1
  globalSerie2Pct?: number; // Ano 2
  globalSerie3Pct?: number; // Ano 3
  globalSerie4Pct?: number; // Ano 4
  globalSerie5Pct?: number; // Ano 5
  globalSerie6Pct?: number; // Ano 6
  serie1Meses?: number; // Qtd de meses do balde 1 (padrão 12)
  serie2Meses?: number; // Qtd de meses do balde 2 (padrão 12)
  serie3Meses?: number; // Qtd de meses do balde 3 (padrão 12)
  serie4Meses?: number; // Qtd de meses do balde 4 (padrão 12)
  serie5Meses?: number; // Qtd de meses do balde 5 (padrão 12)
  serie6Meses?: number; // Qtd de meses do balde 6 (padrão 12)
  torresHabilitadas?: string[]; // Lista de torres liberadas para simulação nesta política

  // Política de crédito distinta por fase do empreendimento. Cada torre pode ser
  // marcada como pertencente à 2ª Fase (torresFase2); torres não listadas são
  // consideradas 1ª Fase. Quando a torre selecionada está em torresFase2, os
  // campos presentes em fase2Params sobrescrevem os campos correspondentes desta
  // condição (qualquer campo não definido em fase2Params mantém o valor da 1ª Fase).
  torresFase2?: string[]; // Lista de torres desta política que estão na 2ª Fase
  fase2Params?: Partial<CommercialCondition>; // Overrides de parâmetros para a 2ª Fase

  // Campos específicos para a condição "Parcelamento Morar" (riscoRendaPct já
  // existente é reaproveitado como o teto de renda de 40% desta condição). Esta
  // condição não usa financiamento bancário/subsídio/FGTS/ITBI — apenas Sinal +
  // Ato Premiado + mensais de obra + intermediárias semestrais + parcela final
  // (chaves) + parcelamento pós-obra.
  pmSinalMinimoPct?: number; // % mínimo do Sinal (Ato) sobre o valor do imóvel (padrão 10%)
  pmParcelaSemestralMaxPct?: number; // % máximo do valor do imóvel por parcela intermediária semestral (padrão 4%)
  pmParcelaChavesMaxPct?: number; // % máximo do valor do imóvel para a parcela intermediária final/chaves (padrão 15%)
  pmParcelaChavesMesesAntes?: number; // Quantidade de meses antes do habite-se em que a parcela de chaves vence (padrão 2)
  pmRiscoProSolutoPosObraPct?: number; // % máximo do valor do imóvel para o somatório das mensais pós-obra (padrão 5%)
  pmQtdParcelasPosObra?: number; // Quantidade de parcelas mensais pós-obra (padrão 12)
  // Parcela mínima (em R$) de cada campo recorrente: se o valor calculado ficar
  // abaixo do piso, aquele bloco é zerado e o saldo é redirecionado — sempre
  // priorizando manter o período de Obra financiado antes do Pós-Obra.
  pmParcelaMinimaMensalObra?: number; // padrão R$ 200,00
  pmParcelaMinimaSemestral?: number; // padrão R$ 200,00
  pmParcelaMinimaPosObra?: number; // padrão R$ 200,00
}

export interface TableRow {
  fase: string;
  torre: string;
  unidade: string;
  areaPrivativa: string | number;
  areaQuintal: string | number;
  tipologia: string;
  avaliacao: number;
  preco: number;
  itbi1: number;
  itbi2: number;
}

export interface TableInfo {
  validFrom: string;
  validTo: string;
  fileName: string;
  headers: string[];
  rows: (string | number)[][];
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  isFeatured: boolean;
  deliveryDate?: string;
  deliveryDatePhase1?: string;
  deliveryDatePhase2?: string;
  conditions: CommercialCondition[];
  tableInfo: TableInfo;
  options?: string[];
  numParcelas?: number;
  sinalMinimo?: string;
  riscoRendaPct?: number;
  riscoImovelPct?: number;
  policy?: string;
}

export interface SimulationData {
  agency: string;
  clientName: string;
  income?: number | null;
  subsidy?: number | null;
  fgts?: number | null;
  financing?: number | null;
  finPercent: number; // e.g., 0.9 or 0.8
  isFirstHome: boolean;
  ownResource?: number;
}

export interface SelectedUnit {
  torre: string;
  unidade: string;
}

export type ActiveTab = 'simulator' | 'details' | 'ficha-morar' | 'policies' | 'import-table' | 'saved-simulations' | 'pdf-settings' | 'admin-panel';

// ---------------------------------------------------------------------------
// Acesso & Permissões (login, cadastro, hierarquia e Painel do Administrador)
// ---------------------------------------------------------------------------

export type Cargo =
  | 'Administrador'
  | 'Diretor'
  | 'Gerente'
  | 'Analista de Vendas'
  | 'Analista de Crédito'
  | 'Assistente de Vendas'
  | 'Assistente de Crédito'
  | 'Corretor';

export type StatusConta = 'pendente' | 'ativo' | 'pausado';

// Espelha a tabela `perfis` no Supabase (ver SQL de criação em authService.ts).
// `id` é sempre o mesmo id do usuário em auth.users (Supabase Auth cuida da
// senha; esta tabela guarda só os dados de negócio: cargo, hierarquia, telas
// liberadas e status de aprovação).
export interface PerfilUsuario {
  id: string;
  email: string;
  nomeCompleto: string;
  telefone: string;
  cpf: string;
  imobiliaria: string;
  creci?: string;
  cargo: Cargo;
  superiorId: string | null;
  status: StatusConta;
  // Chaves de TELAS_APP (src/config/telasApp.ts) liberadas para este usuário.
  telasLiberadas: string[];
  // Permissão à parte (não é uma tela): enxergar, além das próprias, as
  // propostas/simulações salvas de quem está abaixo dele na hierarquia.
  verPropostasEquipe: boolean;
  // Chaves de CAMPOS_EDITAVEIS_EQUIPE (src/config/telasApp.ts) que este
  // usuário está autorizado a editar no cadastro de quem está abaixo dele na
  // hierarquia (ex.: um Gerente autorizado a corrigir telefone/imobiliária
  // dos próprios corretores, sem precisar do Administrador pra isso).
  camposEditaveisEquipe: string[];
  // Existe no máximo UM usuário com proprietario=true no sistema inteiro (trava
  // por índice único no banco). É quem "é dono" do aplicativo — mesmo sendo
  // Administrador como qualquer outro, só ele mesmo pode se rebaixar de cargo,
  // se pausar ou se excluir; nenhum outro Administrador consegue tocar nesse
  // cadastro. Passa adiante só via "Transferir propriedade" (ver AdminPanelView).
  proprietario: boolean;
  createdAt?: string;
}

// Configuração do que cada ficha em PDF exportada deve conter e apresentar,
// uma por tipo de condição comercial (Sinal c/ Banco Direto, Sinal c/ Morar,
// Parcelamento Morar — cada uma guarda suas próprias opções).
export type PdfConditionKind = 'banco-direto' | 'sinal-morar' | 'parcelamento-morar';

export interface PdfExportSettings {
  mostrarValores: boolean; // Mostra os valores em R$, ou os oculta (ficha "sem valores")
  mostrarCliente: boolean;
  mostrarImobiliaria: boolean;
  mostrarDataSimulacao: boolean;
  mostrarBloco1: boolean; // Dados da Aprovação de Crédito
  mostrarBloco2: boolean; // Fluxo de Entrada c/ Construtora
  mostrarBloco3: boolean; // Parcelamento (nome varia por condição)
  mostrarBloco4: boolean; // Gráfico / Indicadores de Risco (nome varia por condição)
}

export type PdfExportSettingsByKind = Record<PdfConditionKind, PdfExportSettings>;
