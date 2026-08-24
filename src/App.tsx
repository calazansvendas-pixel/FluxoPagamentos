import React, { useState, Suspense, lazy } from 'react';
import { ActiveTab, CommercialCondition, Product, SelectedUnit, SimulationData, TableInfo } from './types';
import type { SavedSimulationRecord } from './components/SavedSimulationsView';
import { INITIAL_PRODUCTS } from './data/initialProducts';
import { ensureProductConditions } from './utils/calculations';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { SimulatorView } from './components/SimulatorView';
import { imoveisService } from './services/imoveisService';

// Telas carregadas sob demanda: evitam colocar recharts, jsPDF, html2canvas-pro
// e xlsx no bundle inicial quando o usuário só precisa do Simulador.
const DetailsView = lazy(() => import('./components/DetailsView').then(m => ({ default: m.DetailsView })));
const FichaMorar = lazy(() => import('./components/FichaMorar').then(m => ({ default: m.FichaMorar })));
const PoliciesView = lazy(() => import('./components/PoliciesView').then(m => ({ default: m.PoliciesView })));
const ImportTableView = lazy(() => import('./components/ImportTableView').then(m => ({ default: m.ImportTableView })));
const NewProductModal = lazy(() => import('./components/NewProductModal').then(m => ({ default: m.NewProductModal })));
const SavedSimulationsView = lazy(() => import('./components/SavedSimulationsView').then(m => ({ default: m.SavedSimulationsView })));

const ViewLoadingFallback = () => (
  <div className="flex items-center justify-center py-24 text-sm text-slate-400">
    Carregando...
  </div>
);

// O "Colina das Amoras" foi cadastrado originalmente com o id 'amoras', que não é um
// UUID válido — a tabela `empreendimentos` do Supabase exige UUID como chave primária,
// então esse empreendimento nunca conseguiu sincronizar (nem a tabela de unidades, nem
// a política de crédito). AMORAS_ID é o novo id compatível; qualquer produto carregado
// com o id legado é migrado automaticamente para AMORAS_ID, preservando toda a política
// e a tabela já configuradas (ver migração logo abaixo, no useEffect de sincronização).
const AMORAS_LEGACY_ID = 'amoras';
const AMORAS_ID = '22222222-2222-2222-2222-222222222222';
const AMORAS_MIGRATION_FLAG = 'simulador_amoras_migrado_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('simulator');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [currentDate, setCurrentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Sinaliza se ESTE carregamento remapeou um produto do id legado 'amoras' para
  // AMORAS_ID — só nesse caso existe uma migração real a empurrar para o Supabase.
  // Um navegador novo (sem dado legado, já usando AMORAS_ID vindo de INITIAL_PRODUCTS)
  // não deve disparar esse push: a política dele ainda é só o padrão de fábrica, e
  // empurrá-la incondicionalmente correria o risco de sobrescrever no Supabase a
  // política real que outro navegador (o do admin) já tenha migrado.
  const migratedAmorasRef = React.useRef(false);

  // Products state with localStorage persistence
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('simulador_products_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: Product) => {
            if (p.id === AMORAS_LEGACY_ID) {
              migratedAmorasRef.current = true;
              return { ...p, id: AMORAS_ID };
            }
            return p;
          });
        }
      }
    } catch (e) {
      console.error("Erro ao carregar produtos do localStorage:", e);
    }
    return INITIAL_PRODUCTS;
  });

  // Referência sempre atualizada de products, para uso dentro do listener de sincronização
  // (que é registrado uma única vez e não pode depender de uma closure desatualizada de products).
  const productsRef = React.useRef(products);
  React.useEffect(() => {
    productsRef.current = products;
  }, [products]);

  React.useEffect(() => {
    // Inicialização do Banco de Dados (Seed Inicial) e Sincronização Completa
    const syncFromSupabase = async () => {
      try {
        await imoveisService.inicializarBancoSeNecessario();

        const dbEmps = await imoveisService.listarEmpreendimentos();
        if (dbEmps && Array.isArray(dbEmps) && dbEmps.length > 0 && 'nome' in dbEmps[0]) {
          // Para cada empreendimento, busca as unidades mais recentes no Supabase
          const updatedFromDb = await Promise.all(dbEmps.map(async (dbEmp: any) => {
            const existing = productsRef.current.find(p => p.id === dbEmp.id) || INITIAL_PRODUCTS.find(p => p.id === dbEmp.id) || INITIAL_PRODUCTS[0];

            let currentTableInfo = existing.tableInfo;
            try {
              const units = await imoveisService.listarUnidadesPorEmpreendimento(dbEmp.id);
              if (units && units.length > 0) {
                const rows = imoveisService.converterUnidadesParaLinhas(units);
                currentTableInfo = {
                  validFrom: existing.tableInfo?.validFrom || new Date().toISOString().split('T')[0],
                  validTo: existing.tableInfo?.validTo || new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0],
                  fileName: existing.tableInfo?.fileName || `tabela_${dbEmp.id}.xlsx`,
                  headers: existing.tableInfo?.headers || ['Fase', 'TORRE', 'UNIDADE', 'ÁREA PRIVATIVA M² - APTO', 'ÁREA QUINTAL M²', 'TIPOLOGIA', 'AVALIAÇÃO', 'PREÇO', 'ITBI + Registro 1º Imóvel', 'ITBI + Registro 2º Imóvel'],
                  rows: rows,
                  active: true
                };
              }
            } catch (e) {
              console.warn(`Aviso ao buscar unidades para ${dbEmp.nome}:`, e);
            }

            // A política de crédito (conditions) e o destaque (is_featured) vêm do
            // Supabase quando já foram sincronizados por algum usuário — assim todo
            // mundo que abre o link vê a mesma política, em vez de cada navegador
            // ficar com a sua própria cópia local desatualizada.
            const dbConditions = Array.isArray(dbEmp.conditions) && dbEmp.conditions.length > 0
              ? dbEmp.conditions
              : undefined;

            return {
              ...existing,
              id: dbEmp.id,
              name: dbEmp.nome,
              deliveryDatePhase1: dbEmp.delivery_date_phase1 || existing.deliveryDatePhase1,
              deliveryDatePhase2: dbEmp.delivery_date_phase2 || existing.deliveryDatePhase2,
              isFeatured: dbEmp.is_featured !== undefined && dbEmp.is_featured !== null ? dbEmp.is_featured : existing.isFeatured,
              conditions: dbConditions || existing.conditions,
              tableInfo: currentTableInfo
            };
          }));

          // Mescla com o estado atual em vez de substituir: preserva empreendimentos que
          // só existem localmente (ex.: recém-criados e ainda não sincronizados no Supabase).
          // Mas um id com formato UUID É rastreável no Supabase — se ele não aparece mais em
          // dbEmps, foi excluído por alguém (não apenas "ainda não sincronizado"), então não
          // deve ser preservado, senão um empreendimento apagado "voltaria" para sempre em
          // qualquer navegador que já tivesse essa cópia salva localmente.
          const dbIds = new Set(updatedFromDb.map(p => p.id));
          const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
          const localOnly = productsRef.current.filter(p => !dbIds.has(p.id) && !isUUID(p.id));
          setProducts([...updatedFromDb, ...localOnly]);
        }
      } catch (err) {
        console.warn('Sincronização com Supabase usando fallback local:', err);
      }
    };

    syncFromSupabase();

    window.addEventListener('tabela_atualizada', syncFromSupabase);
    return () => {
      window.removeEventListener('tabela_atualizada', syncFromSupabase);
    };
  }, []);

  // Migração única do "Colina das Amoras" (id legado 'amoras', incompatível com UUID) para
  // o novo AMORAS_ID: o id já foi trocado no estado local (ver useState de `products` acima);
  // aqui só falta empurrar a política de crédito e a tabela de unidades — que nunca tinham
  // chegado ao Supabase por causa do id antigo — para que o empreendimento fique visível
  // para todos os usuários, com tudo que já estava configurado preservado.
  React.useEffect(() => {
    if (!migratedAmorasRef.current) return;
    if (localStorage.getItem(AMORAS_MIGRATION_FLAG)) return;

    const amoras = productsRef.current.find(p => p.id === AMORAS_ID);
    if (!amoras) {
      localStorage.setItem(AMORAS_MIGRATION_FLAG, '1');
      return;
    }

    const migrarAmorasParaSupabase = async () => {
      try {
        const empResult = await imoveisService.sincronizarEmpreendimento({
          id: amoras.id,
          nome: amoras.name,
          delivery_date_phase1: amoras.deliveryDatePhase1 || amoras.deliveryDate,
          delivery_date_phase2: amoras.deliveryDatePhase2,
          conditions: amoras.conditions,
          is_featured: amoras.isFeatured || false
        });
        if (!empResult.success) {
          throw new Error(empResult.error || 'Falha ao sincronizar empreendimento');
        }

        const rows = amoras.tableInfo?.rows || [];
        if (rows.length > 0) {
          const unidades = imoveisService.converterLinhasParaUnidades(amoras.id, rows);
          if (unidades.length > 0) {
            const unitsResult = await imoveisService.salvarUnidadesLote(amoras.id, unidades);
            if (!unitsResult.success) {
              throw new Error(unitsResult.error || 'Falha ao sincronizar unidades');
            }
          }
        }

        // Só marca como concluída depois que ambos os envios foram confirmados — uma
        // falha real (rede indisponível etc.) deixa a flag em aberto para tentar de
        // novo no próximo carregamento, em vez de desistir silenciosamente.
        localStorage.setItem(AMORAS_MIGRATION_FLAG, '1');
        console.log('Migração do Colina das Amoras para o Supabase concluída com sucesso.');
      } catch (e) {
        console.warn('Aviso: falha ao migrar Colina das Amoras para o Supabase. Será tentado novamente no próximo carregamento do app.', e);
      }
    };

    migrarAmorasParaSupabase();
  }, []);

  // Persist products on change
  React.useEffect(() => {
    try {
      localStorage.setItem('simulador_products_data', JSON.stringify(products));
    } catch (e) {
      console.error("Erro ao salvar produtos no localStorage:", e);
    }
  }, [products]);

  // Keep activeAnalysisProduct and activeAnalysisCondition in sync with products state
  React.useEffect(() => {
    if (activeAnalysisProduct) {
      const updated = products.find(p => p.id === activeAnalysisProduct.id);
      if (updated) {
        setActiveAnalysisProduct(updated);
        if (activeAnalysisCondition) {
          const updatedCond = (updated.conditions || []).find(c => c.id === activeAnalysisCondition.id);
          if (updatedCond) {
            setActiveAnalysisCondition(updatedCond);
          }
        }
      }
    }
  }, [products]);

  // Simulation form data state
  const [simulationData, setSimulationData] = useState<SimulationData>({
    agency: '',
    clientName: '',
    income: null,
    subsidy: null,
    fgts: null,
    financing: null,
    finPercent: 0.8,
    isFirstHome: true
  });

  // Selected condition per product on Screen 1
  const [selectedConditions, setSelectedConditions] = useState<Record<string, string>>({});

  // Active product & condition selected for Screen 2 (Ficha de Análise)
  const [activeAnalysisProduct, setActiveAnalysisProduct] = useState<Product | null>(null);
  const [activeAnalysisCondition, setActiveAnalysisCondition] = useState<CommercialCondition | null>(null);

  // Selected Torre & Unidade stored per product ID
  const [selectedUnits, setSelectedUnits] = useState<Record<string, SelectedUnit>>({});

  // Active product ID for Screen 3 (Policies) and Screen 4 (Import Table)
  const [activePolicyProductId, setActivePolicyProductId] = useState<string>(AMORAS_ID);
  const [activeImportProductId, setActiveImportProductId] = useState<string>(AMORAS_ID);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleResetAll = () => {
    // Redefinição completa do Formulário de Simulação, condições e seletores de Torre e Unidade
    setSimulationData({
      agency: '',
      clientName: '',
      income: null,
      subsidy: null,
      fgts: null,
      financing: null,
      finPercent: 0.8,
      isFirstHome: true
    });
    setSelectedConditions({});
    setSelectedUnits({});
    showToast('Nova simulação iniciada. Todos os campos, cálculos e seleções foram redefinidos.');
  };

  // Helper function to check if condition is of "Morar" type or "Banco Direto" type
  const isMorarCondition = (condName: string): boolean => {
    const lower = condName.toLowerCase();
    return lower.includes('morar') || lower.includes('incc') || lower.includes('obra') || lower.includes('ipca');
  };

  const handleSelectCondition = (productId: string, conditionId: string) => {
    setSelectedConditions(prev => ({ ...prev, [productId]: conditionId }));
  };

  const handleAdvanceToDetails = (prod: Product, conditionId: string) => {
    const prodWithConds = ensureProductConditions({ ...prod });
    const cond = prodWithConds.conditions.find(c => c.id === conditionId) || prodWithConds.conditions[0];

    setActiveAnalysisProduct(prodWithConds);
    setActiveAnalysisCondition(cond);

    // Reseta a seleção ativa da unidade ao avançar da tela 1 para a ficha
    setSelectedUnits(prev => ({
      ...prev,
      [prodWithConds.id]: { torre: '', unidade: '' }
    }));

    // Roteamento inteligente baseado na condição selecionada
    if (cond && isMorarCondition(cond.name)) {
      setActiveTab('ficha-morar');
    } else {
      setActiveTab('details');
    }
    window.scrollTo(0, 0);
  };

  // Reabre uma simulação salva (tela "Simulações Salvas") na ficha correspondente,
  // pré-preenchendo os dados do cliente e a torre/unidade que estavam selecionadas.
  // Os valores manuais que o corretor tenha digitado na hora (Ato, ITBI no Ato, etc.)
  // não são restaurados — a ficha recalcula os valores sugeridos a partir dos dados
  // do cliente, prontos para ajuste.
  const handleEditSimulation = (sim: SavedSimulationRecord) => {
    const dados = sim.dados || {};
    const empId = dados.empreendimento_id || sim.empreendimento_id;
    const prod = products.find(p => p.id === empId);
    if (!prod) {
      showToast('O empreendimento desta simulação não foi encontrado (pode ter sido excluído ou renomeado).');
      return;
    }

    const prodWithConds = ensureProductConditions({ ...prod });
    const cond = prodWithConds.conditions.find(c => c.id === dados.condicao_id) || prodWithConds.conditions[0];

    setActiveAnalysisProduct(prodWithConds);
    setActiveAnalysisCondition(cond);

    setSelectedUnits(prev => ({
      ...prev,
      [prodWithConds.id]: {
        torre: dados.torre && dados.torre !== 'Não Selecionada' ? dados.torre : '',
        unidade: dados.unidade && dados.unidade !== 'Não Selecionada' ? dados.unidade : ''
      }
    }));
    setSelectedConditions(prev => ({ ...prev, [prodWithConds.id]: cond.id }));

    if (dados.simulation_data) {
      setSimulationData(dados.simulation_data);
    }

    if (cond && isMorarCondition(cond.name)) {
      setActiveTab('ficha-morar');
    } else {
      setActiveTab('details');
    }
    window.scrollTo(0, 0);
    showToast(`Simulação de ${dados.cliente_nome || sim.cliente_nome || 'cliente'} reaberta para edição.`);
  };

  // Handler para troca de condição comercial com redirecionamento/roteamento inteligente
  const handleSelectConditionWithRouting = (cond: CommercialCondition) => {
    setActiveAnalysisCondition(cond);
    // Reset da unidade ativa ao trocar política comercial
    if (activeAnalysisProduct) {
      setSelectedUnits(prev => ({
        ...prev,
        [activeAnalysisProduct.id]: { torre: '', unidade: '' }
      }));
    }
    if (isMorarCondition(cond.name)) {
      if (activeTab !== 'ficha-morar') {
        setActiveTab('ficha-morar');
        window.scrollTo(0, 0);
      }
    } else {
      if (activeTab !== 'details') {
        setActiveTab('details');
        window.scrollTo(0, 0);
      }
    }
  };

  // Ao alternar abas pelo menu lateral, sincroniza a condição ativa
  const handleSidebarTabSelect = (tab: ActiveTab) => {
    if (tab === 'details') {
      // Se não temos produto ativo, inicializa com o primeiro
      if (!activeAnalysisProduct && products.length > 0) {
        const prodWithConds = ensureProductConditions({ ...products[0] });
        setActiveAnalysisProduct(prodWithConds);
        const nonMorarCond = prodWithConds.conditions.find(c => !isMorarCondition(c.name)) || prodWithConds.conditions[0];
        setActiveAnalysisCondition(nonMorarCond);
      } else if (activeAnalysisProduct) {
        const prodWithConds = ensureProductConditions({ ...activeAnalysisProduct });
        // Se a condição atual for Morar, ajusta para uma condição Banco Direto se disponível
        if (activeAnalysisCondition && isMorarCondition(activeAnalysisCondition.name)) {
          const nonMorarCond = prodWithConds.conditions.find(c => !isMorarCondition(c.name));
          if (nonMorarCond) {
            setActiveAnalysisCondition(nonMorarCond);
          }
        }
      }
    } else if (tab === 'ficha-morar') {
      // Se não temos produto ativo, inicializa com o primeiro
      if (!activeAnalysisProduct && products.length > 0) {
        const prodWithConds = ensureProductConditions({ ...products[0] });
        setActiveAnalysisProduct(prodWithConds);
        const morarCond = prodWithConds.conditions.find(c => isMorarCondition(c.name)) || prodWithConds.conditions[0];
        setActiveAnalysisCondition(morarCond);
      } else if (activeAnalysisProduct) {
        const prodWithConds = ensureProductConditions({ ...activeAnalysisProduct });
        // Se a condição atual for Banco Direto, ajusta para uma condição Morar se disponível
        if (activeAnalysisCondition && !isMorarCondition(activeAnalysisCondition.name)) {
          const morarCond = prodWithConds.conditions.find(c => isMorarCondition(c.name));
          if (morarCond) {
            setActiveAnalysisCondition(morarCond);
          }
        }
      }
    }

    setActiveTab(tab);
    window.scrollTo(0, 0);
  };

  const handleUnitSelectChange = (productId: string, unit: SelectedUnit) => {
    setSelectedUnits(prev => ({
      ...prev,
      [productId]: unit
    }));
  };

  // POLICIES VIEW ACTIONS
  const handleSaveProductPolicy = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => {
      if (p.id === updatedProduct.id) {
        return updatedProduct;
      }
      if (updatedProduct.isFeatured) {
        return { ...p, isFeatured: false };
      }
      return p;
    }));

    if (activeAnalysisProduct?.id === updatedProduct.id) {
      setActiveAnalysisProduct(updatedProduct);
      if (activeAnalysisCondition) {
        const updatedCond = (updatedProduct.conditions || []).find(c => c.id === activeAnalysisCondition.id);
        if (updatedCond) {
          setActiveAnalysisCondition(updatedCond);
        }
      }
    }

    // Sincroniza a política de crédito com o Supabase, para que fique valendo para
    // todos os usuários que abrirem o app (e não só no navegador de quem editou).
    imoveisService.sincronizarEmpreendimento({
      id: updatedProduct.id,
      nome: updatedProduct.name,
      delivery_date_phase1: updatedProduct.deliveryDatePhase1 || updatedProduct.deliveryDate,
      delivery_date_phase2: updatedProduct.deliveryDatePhase2,
      conditions: updatedProduct.conditions,
      is_featured: updatedProduct.isFeatured || false
    }).catch(e => console.warn('Aviso ao sincronizar política de crédito no Supabase:', e));
  };

  const handleDeleteProduct = async (productId: string) => {
    if (products.length <= 1) {
      showToast("É necessário manter ao menos um empreendimento.");
      return;
    }

    // Exclui no Supabase primeiro — sem isso, o registro continuaria no banco e
    // poderia "voltar" na próxima sincronização de outro navegador/usuário.
    try {
      const result = await imoveisService.excluirEmpreendimento(productId);
      if (!result.success) {
        console.warn('Aviso ao excluir empreendimento no Supabase:', result.error);
      }
    } catch (e) {
      console.warn('Aviso ao excluir empreendimento no Supabase:', e);
    }

    const remaining = products.filter(p => p.id !== productId);
    setProducts(remaining);
    setActivePolicyProductId(remaining[0].id);
    setActiveImportProductId(remaining[0].id);
    showToast("Empreendimento removido com sucesso!");
  };

  // IMPORT TABLE ACTIONS
  const handleSaveTableInfo = (productId: string, tableInfo: TableInfo) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return { ...p, tableInfo };
      }
      return p;
    }));
  };

  const handleDeleteTable = async (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    if (!prod.tableInfo || !prod.tableInfo.active) {
      showToast("Este empreendimento não possui tabela ativa para excluir.");
      return;
    }

    // Exclui unidades no Supabase em segundo plano
    try {
      await imoveisService.limparUnidadesEmpreendimento(productId);
    } catch (e) {
      console.warn('Aviso ao excluir unidades no Supabase:', e);
    }

    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          tableInfo: { validFrom: '', validTo: '', fileName: '', headers: [], rows: [], active: false }
        };
      }
      return p;
    }));

    window.dispatchEvent(new CustomEvent('tabela_atualizada'));
    showToast(`Tabela e unidades de ${prod.name} foram excluídas com sucesso!`);
  };

  const handleSaveNewProduct = (newProd: Product) => {
    setProducts(prev => [...prev, newProd]);
    setActivePolicyProductId(newProd.id);
    setActiveImportProductId(newProd.id);
    setIsNewProductModalOpen(false);
    showToast(`Novo empreendimento "${newProd.name}" cadastrado com sucesso!`);

    // Sincroniza com o Supabase imediatamente, para que o empreendimento já exista no banco
    // antes de qualquer sincronização automática recarregar a lista (o que o apagaria, já
    // que ela hoje mescla com o que está no banco em vez de sobrescrever pelo local).
    imoveisService.sincronizarEmpreendimento({
      id: newProd.id,
      nome: newProd.name,
      delivery_date_phase1: newProd.deliveryDatePhase1 || newProd.deliveryDate,
      delivery_date_phase2: newProd.deliveryDatePhase2,
      conditions: newProd.conditions,
      is_featured: newProd.isFeatured || false
    }).catch(e => console.warn('Aviso ao sincronizar novo empreendimento no Supabase:', e));
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-900 bg-slate-50 font-sans">
      
      {/* HEADER */}
      <Header
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        onResetAll={handleResetAll}
        onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
        onNavigateHome={() => setActiveTab('simulator')}
      />

      <div className="flex flex-1 w-full max-w-7xl mx-auto">
        
        {/* SIDEBAR */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleSidebarTabSelect}
          isCollapsed={isSidebarCollapsed}
        />

        {/* MAIN VIEW AREA */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {activeTab === 'simulator' && (
            <SimulatorView
              simulationData={simulationData}
              onSimulationDataChange={setSimulationData}
              products={products}
              selectedConditions={selectedConditions}
              onSelectCondition={handleSelectCondition}
              onAdvanceToDetails={handleAdvanceToDetails}
              onNavigateToPolicies={() => setActiveTab('policies')}
              onResetAll={handleResetAll}
            />
          )}

          <Suspense fallback={<ViewLoadingFallback />}>
          {activeTab === 'details' && (
            <DetailsView
              product={activeAnalysisProduct}
              condition={activeAnalysisCondition}
              products={products}
              onSelectProduct={(prod, condId) => {
                const prodWithConds = ensureProductConditions({ ...prod });
                const cond = prodWithConds.conditions.find(c => c.id === condId) || prodWithConds.conditions[0];
                setActiveAnalysisProduct(prodWithConds);
                handleSelectConditionWithRouting(cond);
              }}
              onSelectCondition={handleSelectConditionWithRouting}
              simulationData={simulationData}
              selectedUnits={selectedUnits}
              onUnitSelectChange={handleUnitSelectChange}
              onBackToSimulator={() => setActiveTab('simulator')}
              onNavigateToImport={(prodId) => {
                setActiveImportProductId(prodId);
                setActiveTab('import-table');
                window.scrollTo(0, 0);
              }}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'ficha-morar' && (
            <FichaMorar
              product={activeAnalysisProduct}
              condition={activeAnalysisCondition}
              products={products}
              onSelectProduct={(prod, condId) => {
                const prodWithConds = ensureProductConditions({ ...prod });
                const cond = prodWithConds.conditions.find(c => c.id === condId) || prodWithConds.conditions[0];
                setActiveAnalysisProduct(prodWithConds);
                handleSelectConditionWithRouting(cond);
              }}
              onSelectCondition={handleSelectConditionWithRouting}
              simulationData={simulationData}
              selectedUnits={selectedUnits}
              onUnitSelectChange={handleUnitSelectChange}
              onBackToSimulator={() => setActiveTab('simulator')}
              onNavigateToImport={(prodId) => {
                setActiveImportProductId(prodId);
                setActiveTab('import-table');
                window.scrollTo(0, 0);
              }}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'policies' && (
            <PoliciesView
              products={products}
              activeProductId={activePolicyProductId}
              onSelectProduct={setActivePolicyProductId}
              onSaveProductPolicy={handleSaveProductPolicy}
              onDeleteProduct={handleDeleteProduct}
              onOpenNewProductModal={() => setIsNewProductModalOpen(true)}
              onShowToast={showToast}
              clientIncome={simulationData.income}
              isFirstHome={simulationData.isFirstHome}
              simulationData={simulationData}
              selectedUnits={selectedUnits}
            />
          )}

          {activeTab === 'import-table' && (
            <ImportTableView
              products={products}
              activeImportProductId={activeImportProductId}
              onSelectImportProduct={setActiveImportProductId}
              onSaveTableInfo={handleSaveTableInfo}
              onDeleteTable={handleDeleteTable}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'saved-simulations' && (
            <SavedSimulationsView
              onEditSimulation={handleEditSimulation}
              onShowToast={showToast}
            />
          )}
          </Suspense>
        </main>
      </div>

      {/* MODAL: NEW PRODUCT */}
      {isNewProductModalOpen && (
        <Suspense fallback={null}>
          <NewProductModal
            isOpen={isNewProductModalOpen}
            onClose={() => setIsNewProductModalOpen(false)}
            onSaveNewProduct={handleSaveNewProduct}
          />
        </Suspense>
      )}

      {/* TOAST NOTIFICATION */}
      <Toast message={toastMessage} />

    </div>
  );
}
