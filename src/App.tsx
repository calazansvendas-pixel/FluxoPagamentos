import React, { useState } from 'react';
import { ActiveTab, CommercialCondition, Product, SelectedUnit, SimulationData, TableInfo } from './types';
import { INITIAL_PRODUCTS } from './data/initialProducts';
import { ensureProductConditions } from './utils/calculations';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { SimulatorView } from './components/SimulatorView';
import { DetailsView } from './components/DetailsView';
import { PoliciesView } from './components/PoliciesView';
import { ImportTableView } from './components/ImportTableView';
import { NewProductModal } from './components/NewProductModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('simulator');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [currentDate, setCurrentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Products state with localStorage persistence
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('simulador_products_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Erro ao carregar produtos do localStorage:", e);
    }
    return INITIAL_PRODUCTS;
  });

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
    income: 0,
    subsidy: 0,
    fgts: 0,
    financing: 0,
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
  const [activePolicyProductId, setActivePolicyProductId] = useState<string>('amoras');
  const [activeImportProductId, setActiveImportProductId] = useState<string>('amoras');

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
    if (activeTab === 'details') {
      // Limpeza exclusiva da Ficha de Análise: reseta seleções de unidade mantendo o Simulador intacto
      setSelectedUnits(prev => {
        if (activeAnalysisProduct) {
          const updated = { ...prev };
          delete updated[activeAnalysisProduct.id];
          return updated;
        }
        return {};
      });
      showToast('Ficha de Análise limpa com sucesso. Os dados da simulação foram mantidos.');
    } else {
      // Limpeza do Simulador de Crédito
      setSimulationData({
        agency: '',
        clientName: '',
        income: 0,
        subsidy: 0,
        fgts: 0,
        financing: 0,
        finPercent: 0.8,
        isFirstHome: true
      });
      setSelectedConditions({});
      setSelectedUnits({});
      showToast('Formulário e simulações redefinidos com sucesso.');
    }
  };

  const handleSelectCondition = (productId: string, conditionId: string) => {
    setSelectedConditions(prev => ({ ...prev, [productId]: conditionId }));
  };

  const handleAdvanceToDetails = (prod: Product, conditionId: string) => {
    const prodWithConds = ensureProductConditions({ ...prod });
    const cond = prodWithConds.conditions.find(c => c.id === conditionId) || prodWithConds.conditions[0];

    setActiveAnalysisProduct(prodWithConds);
    setActiveAnalysisCondition(cond);
    setActiveTab('details');
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
  };

  const handleDeleteProduct = (productId: string) => {
    if (products.length <= 1) {
      showToast("É necessário manter ao menos um empreendimento.");
      return;
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

  const handleDeleteTable = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    if (!prod.tableInfo || !prod.tableInfo.active) {
      showToast("Este empreendimento não possui tabela ativa para excluir.");
      return;
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

    showToast(`Tabela vigente do ${prod.name} foi excluída com sucesso!`);
  };

  const handleSaveNewProduct = (newProd: Product) => {
    setProducts(prev => [...prev, newProd]);
    setActivePolicyProductId(newProd.id);
    setActiveImportProductId(newProd.id);
    setIsNewProductModalOpen(false);
    showToast(`Novo empreendimento "${newProd.name}" cadastrado com sucesso!`);
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
          onSelectTab={(tab) => {
            setActiveTab(tab);
            window.scrollTo(0, 0);
          }}
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
            />
          )}

          {activeTab === 'details' && (
            <DetailsView
              product={activeAnalysisProduct}
              condition={activeAnalysisCondition}
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
        </main>
      </div>

      {/* MODAL: NEW PRODUCT */}
      <NewProductModal
        isOpen={isNewProductModalOpen}
        onClose={() => setIsNewProductModalOpen(false)}
        onSaveNewProduct={handleSaveNewProduct}
      />

      {/* TOAST NOTIFICATION */}
      <Toast message={toastMessage} />

    </div>
  );
}
