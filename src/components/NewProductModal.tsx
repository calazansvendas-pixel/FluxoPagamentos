import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Product } from '../types';

interface NewProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveNewProduct: (product: Product) => void;
}

export const NewProductModal: React.FC<NewProductModalProps> = ({
  isOpen,
  onClose,
  onSaveNewProduct
}) => {
  const [name, setName] = useState<string>('');
  const [deliveryDatePhase1, setDeliveryDatePhase1] = useState<string>('');
  const [deliveryDatePhase2, setDeliveryDatePhase2] = useState<string>('');
  const [numParcelas, setNumParcelas] = useState<number>(72);
  const [sinalMinimo, setSinalMinimo] = useState<string>('R$ 2.000,00');
  const [riscoRendaPct, setRiscoRendaPct] = useState<number>(30);
  const [riscoImovelPct, setRiscoImovelPct] = useState<number>(25);
  const [optionsText, setOptionsText] = useState<string>('');
  const [policyText, setPolicyText] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const id = 'prod_' + Date.now();
    const optionsList = optionsText.trim()
      ? optionsText.split(',').map(o => o.trim()).filter(o => o !== '')
      : ['Sinal em 48X c/ Morar', 'Sinal em 72X c/ Banco Direto'];

    const conditions = optionsList.map((optName, idx) => ({
      id: `cond_${id}_${idx + 1}`,
      name: optName,
      numParcelas,
      sinalMinimo,
      riscoRendaPct,
      riscoImovelPct,
      mesesTabela1: 36,
      taxaJuros1: 0.0,
      mesesTabela2: 72,
      taxaJuros2: 1.0,
      policy: policyText || `POLÍTICA COMERCIAL DA CONDIÇÃO ${optName.toUpperCase()}:\n- Regras gerais e diretrizes para aprovação.`
    }));

    const newProd: Product = {
      id,
      name: name.trim(),
      deliveryDate: deliveryDatePhase1 || deliveryDatePhase2 || '',
      deliveryDatePhase1,
      deliveryDatePhase2,
      isFeatured: false,
      conditions,
      tableInfo: { validFrom: '', validTo: '', fileName: '', headers: [], rows: [], active: false }
    };

    onSaveNewProduct(newProd);

    // Reset state
    setName('');
    setDeliveryDatePhase1('');
    setDeliveryDatePhase2('');
    setNumParcelas(72);
    setSinalMinimo('R$ 2.000,00');
    setRiscoRendaPct(30);
    setRiscoImovelPct(25);
    setOptionsText('');
    setPolicyText('');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 font-heading">
            Cadastrar Novo Empreendimento
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Nome do Empreendimento *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Vista do Horizonte"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Previsão de Entrega - 1ª Fase
              </label>
              <input
                type="date"
                value={deliveryDatePhase1}
                onChange={(e) => setDeliveryDatePhase1(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-600 cursor-pointer"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Previsão de Entrega - 2ª Fase <span className="font-normal text-slate-400">(Opcional)</span>
              </label>
              <input
                type="date"
                value={deliveryDatePhase2}
                onChange={(e) => setDeliveryDatePhase2(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nº Parcelas Inicial
              </label>
              <input
                type="number"
                min="1"
                max="180"
                value={numParcelas}
                onChange={(e) => setNumParcelas(parseInt(e.target.value, 10) || 1)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-sky-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Sinal Mínimo Inicial
              </label>
              <input
                type="text"
                value={sinalMinimo}
                onChange={(e) => setSinalMinimo(e.target.value)}
                placeholder="Ex: R$ 2.000,00"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-sky-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Risco Renda %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={riscoRendaPct}
                onChange={(e) => setRiscoRendaPct(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-sky-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Risco Imóvel %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={riscoImovelPct}
                onChange={(e) => setRiscoImovelPct(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-sky-600"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Condições Comerciais (separadas por vírgula)
            </label>
            <input
              type="text"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="Sinal em 48X c/ Morar, Sinal em 72X c/ Banco Direto"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Política de Vendas Inicial
            </label>
            <textarea
              rows={3}
              value={policyText}
              onChange={(e) => setPolicyText(e.target.value)}
              placeholder="Descreva aqui as regras de venda..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-xs cursor-pointer"
            >
              Criar Empreendimento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
