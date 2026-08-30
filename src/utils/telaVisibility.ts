import { TelaVisibilitySettings, TelaVisibilitySettingsByKind } from '../types';

// Configuração do que cada cargo enxerga NA TELA (fora do PDF) enquanto usa o
// sistema, editável na página "Configurar Visibilidade dos Quadros" — uma por
// tipo de condição comercial. Os padrões abaixo (tudo visível) são o que vale
// enquanto o Administrador não restringir um cargo específico.
export const DEFAULT_TELA_VISIBILITY_SETTINGS: TelaVisibilitySettings = {
  mostrarBloco1: true,
  mostrarBloco2: true,
  mostrarBloco3: true,
  mostrarBloco4: true,
};

export const DEFAULT_TELA_VISIBILITY_SETTINGS_BY_KIND: TelaVisibilitySettingsByKind = {
  'banco-direto': { ...DEFAULT_TELA_VISIBILITY_SETTINGS },
  'sinal-morar': { ...DEFAULT_TELA_VISIBILITY_SETTINGS },
  'parcelamento-morar': { ...DEFAULT_TELA_VISIBILITY_SETTINGS },
};

// A configuração em si (quem pode editar o quê, por cargo) mora no banco —
// ver src/services/telaVisibilidadeService.ts.
