import { Product } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'amoras',
    name: 'Colina das Amoras',
    isFeatured: true,
    deliveryDate: '2027-06-30',
    deliveryDatePhase1: '2027-06-30',
    deliveryDatePhase2: '2027-11-30',
    conditions: [
      {
        id: 'cond_amo_direto',
        name: 'Sinal c/ Banco Direto (60X)',
        numParcelas: 60,
        sinalMinimo: 'R$ 2.000,00',
        riscoRendaPct: 35,
        riscoImovelPct: 20,
        mesesTabela1: 60,
        taxaJuros1: 1.9,
        mesesTabela2: 60,
        taxaJuros2: 1.9,
        policy: 'POLÍTICA COLINA DAS AMORAS - SINAL C/ BANCO DIRETO:\n- Sinal parcelado em até 60x direto com a construtora.\n- Entrada mínima R$ 2.000,00.'
      },
      {
        id: 'cond_amo_morar',
        name: 'Sinal c/ Morar',
        numParcelas: 60,
        sinalMinimo: 'R$ 2.000,00',
        riscoRendaPct: 30,
        riscoImovelPct: 17,
        percMaxProSolutoGlobal: 17.0,
        percMaxPosObra: 8.0,
        riscoPosPct: 8.0,
        mesesObra: 33,
        mesesPos: 27,
        globalSerie1Pct: 30.0,
        globalSerie2Pct: 25.0,
        globalSerie3Pct: 20.0,
        globalSerie4Pct: 15.0,
        globalSerie5Pct: 10.0,
        globalSerie6Pct: 5.0,
        mesesTabela1: 36,
        taxaJuros1: 0.0,
        mesesTabela2: 72,
        taxaJuros2: 1.0,
        policy: 'POLÍTICA COLINA DAS AMORAS - SINAL C/ MORAR:\n- Fluxo com períodos de Obra (INCC) e Pós-Obra (IPCA+1%).\n- ITBI e Registro parcelados (IGPM+1%).'
      }
    ],
    tableInfo: {
      validFrom: '2026-07-15',
      validTo: '2026-10-31',
      fileName: 'tabela_amoras_vigente.xlsx',
      headers: ['Fase', 'TORRE', 'UNIDADE', 'ÁREA PRIVATIVA M² - APTO', 'ÁREA QUINTAL M²', 'TIPOLOGIA', 'AVALIAÇÃO', 'PREÇO', 'ITBI + Registro 1º Imóvel', 'ITBI + Registro 2º Imóvel'],
      rows: [
        ['1ª', 'Bloco 1', '201', '48,50 m²', '0,00 m²', '2 Quartos c/ Suíte', 325000.00, 310000.00, 13671.00, 17050.00],
        ['1ª', 'Bloco 1', '302', '48,50 m²', '0,00 m²', '2 Quartos c/ Suíte', 330000.00, 315000.00, 13891.50, 17325.00]
      ],
      active: true
    }
  }
];
