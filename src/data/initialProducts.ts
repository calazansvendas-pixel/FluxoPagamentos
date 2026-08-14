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
        id: 'cond_amo_60x',
        name: 'Sinal em 60X c/ Direto',
        numParcelas: 60,
        sinalMinimo: 'R$ 2.000,00',
        riscoRendaPct: 35,
        riscoImovelPct: 20,
        mesesTabela1: 60,
        taxaJuros1: 1.9,
        mesesTabela2: 0,
        taxaJuros2: 1.9,
        policy: 'POLÍTICA COLINA DAS AMORAS (60X):\n- Sinal parcelado em até 60x direto com a construtora.\n- Entrada mínima R$ 2.000,00.'
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
  },
  {
    id: 'vista_passeio',
    name: 'Vista do Passeio',
    isFeatured: true,
    deliveryDate: '2027-12-31',
    deliveryDatePhase1: '2027-12-31',
    deliveryDatePhase2: '2028-06-30',
    conditions: [
      {
        id: 'cond_pas_60x',
        name: 'Sinal em 60X c/ Direto',
        numParcelas: 60,
        sinalMinimo: 'R$ 2.000,00',
        riscoRendaPct: 35,
        riscoImovelPct: 20,
        mesesTabela1: 60,
        taxaJuros1: 1.9,
        mesesTabela2: 72,
        taxaJuros2: 1.9,
        policy: 'POLÍTICA VISTA DO PASSEIO (72X):\n- Sinal parcelado em até 72x direto com a construtora.\n- Entrada mínima R$ 2.000,00.\n- Avaliação do Banco extraída da Coluna Q ("AVALIAÇÃO 05/08/2025").'
      }
    ],
    tableInfo: {
      validFrom: '2026-08-01',
      validTo: '2026-12-31',
      fileName: 'tabela_vista_do_passeio_vigente.xlsx',
      headers: ['Fase', 'TORRE', 'UNIDADE', 'ÁREA PRIVATIVA M² - APTO', 'ÁREA QUINTAL M²', 'TIPOLOGIA', 'AVALIAÇÃO', 'PREÇO', 'ITBI + Registro 1º Imóvel', 'ITBI + Registro 2º Imóvel'],
      rows: [
        ['1ª', 'Torre A', '101', '45,20 m²', '0,00 m²', '2 Quartos', 285000.00, 270000.00, 11880.00, 14850.00],
        ['1ª', 'Torre A', '102', '45,20 m²', '12,50 m²', '2 Quartos c/ Quintal', 298000.00, 282000.00, 12408.00, 15510.00],
        ['1ª', 'Torre B', '201', '45,20 m²', '0,00 m²', '2 Quartos', 288000.00, 272000.00, 11968.00, 14960.00],
        ['1ª', 'Torre B', '208B', '45,20 m²', '0,00 m²', '2 Quartos', 285000.00, 273298.64, 12079.87, 12079.87]
      ],
      active: true
    }
  },
  {
    id: 'vista_tropical',
    name: 'Vista Tropical',
    isFeatured: true,
    deliveryDate: '2028-06-30',
    deliveryDatePhase1: '2028-06-30',
    conditions: [
      {
        id: 'cond_trop_72x',
        name: 'Sinal em 72x c/ Banco Direto',
        numParcelas: 72,
        sinalMinimo: 'R$ 2.000,00',
        riscoRendaPct: 35,
        riscoImovelPct: 25,
        mesesTabela1: 36,
        taxaJuros1: 1.9,
        mesesTabela2: 72,
        taxaJuros2: 1.9,
        policy: 'POLÍTICA VISTA TROPICAL (72X):\n- Sinal parcelado em até 72x com Banco Direto.\n- Taxa de juros real da política: 1.90% a.m.\n- Entrada mínima R$ 2.000,00.'
      }
    ],
    tableInfo: {
      validFrom: '2026-08-01',
      validTo: '2026-12-31',
      fileName: 'tabela_vista_tropical_vigente.xlsx',
      headers: ['Fase', 'TORRE', 'UNIDADE', 'ÁREA PRIVATIVA M² - APTO', 'ÁREA QUINTAL M²', 'TIPOLOGIA', 'AVALIAÇÃO', 'PREÇO', 'ITBI + Registro 1º Imóvel', 'ITBI + Registro 2º Imóvel'],
      rows: [
        ['1ª', 'Torre 1', '101', '45,00 m²', '0,00 m²', '2 Quartos', 290000.00, 275000.00, 12100.00, 15125.00],
        ['1ª', 'Torre 1', '102', '45,00 m²', '0,00 m²', '2 Quartos', 290000.00, 275000.00, 12100.00, 15125.00]
      ],
      active: true
    }
  }
];

