import React, { useState, useEffect } from 'react';
import { formatCurrency, parseCurrency } from '../utils/formatters';

interface PmCampoEditavelProps {
  label: string;
  value: number; // valor efetivo atual (override manual, ou sugestão automática)
  onCommit: (novoValor: number | null) => void; // null = limpa o override e volta pra sugestão
  tipo?: 'moeda' | 'inteiro';
  minimo?: number; // piso — só se aplica a campos do tipo "moeda"
  maximo?: number; // teto — só se aplica a campos do tipo "inteiro"
  suffix?: string; // ex: "meses", "x" — só para o tipo "inteiro"
  disabled?: boolean;
  onShowToast?: (msg: string) => void;
  colorClass?: string;
}

/**
 * Campo numérico controlado, reutilizado nos 4 grupos editáveis da condição
 * "Parcelamento Morar" (mensal de obra, semestral, chaves e pós-obra): tanto
 * para quantidade (inteiro) quanto para valor (moeda, respeitando um piso —
 * abaixo dele o app restaura o valor sugerido, mesmo padrão já usado no Ato).
 */
export const PmCampoEditavel: React.FC<PmCampoEditavelProps> = ({
  label,
  value,
  onCommit,
  tipo = 'moeda',
  minimo = 0,
  maximo,
  suffix,
  disabled = false,
  onShowToast,
  colorClass = 'text-slate-900'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    if (!isEditing) {
      setInputText(tipo === 'moeda' ? (value > 0 ? formatCurrency(value) : '') : (value > 0 ? String(value) : ''));
    }
  }, [value, isEditing, tipo]);

  const handleFinish = (raw: string) => {
    setIsEditing(false);
    if (raw.trim() === '') {
      onCommit(null);
      return;
    }
    if (tipo === 'moeda') {
      const parsed = parseCurrency(raw);
      if (isNaN(parsed) || parsed <= 0) {
        onCommit(null);
        return;
      }
      if (parsed < minimo - 0.005) {
        onCommit(minimo);
        setInputText(formatCurrency(minimo));
        onShowToast?.(`O valor informado é inferior à parcela mínima configurada (${formatCurrency(minimo)}). Valor ajustado.`);
        return;
      }
      onCommit(Math.round(parsed * 100) / 100);
    } else {
      const parsed = parseInt(raw.replace(/[^\d-]/g, ''), 10);
      if (isNaN(parsed) || parsed < 0) {
        onCommit(null);
        return;
      }
      if (maximo !== undefined && parsed > maximo) {
        onCommit(maximo);
        setInputText(String(maximo));
        onShowToast?.(`Não é possível ultrapassar a quantidade sugerida de ${maximo}. Valor ajustado.`);
        return;
      }
      onCommit(parsed);
    }
  };

  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 whitespace-nowrap">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          type="text"
          inputMode={tipo === 'moeda' ? 'decimal' : 'numeric'}
          disabled={disabled}
          value={isEditing ? inputText : (tipo === 'moeda' ? (value > 0 ? formatCurrency(value) : '') : (value > 0 ? String(value) : '0'))}
          onFocus={(e) => {
            setIsEditing(true);
            setInputText(value > 0 ? String(value) : '');
            e.target.select();
          }}
          onChange={(e) => setInputText(e.target.value)}
          onBlur={(e) => handleFinish(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleFinish(inputText);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder={tipo === 'moeda' ? 'R$ 0,00' : '0'}
          className={`w-full bg-white px-2 py-1.5 rounded-md border border-slate-200 font-bold ${colorClass} text-center focus:outline-none focus:border-sky-600 text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed ${suffix ? 'pr-8' : ''}`}
        />
        {suffix && (
          <span className="absolute right-2 text-[10px] font-extrabold text-slate-400 pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  );
};
