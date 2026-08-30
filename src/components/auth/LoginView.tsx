import React, { useState } from 'react';
import { Building2, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { AuthLayout } from './AuthLayout';

interface LoginViewProps {
  onSwitchToCadastro: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSwitchToCadastro }) => {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoRecuperacao, setAvisoRecuperacao] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAvisoRecuperacao(null);
    if (!email || !senha) {
      setErro('Preencha e-mail e senha.');
      return;
    }
    setEnviando(true);
    const res = await entrar(email.trim(), senha);
    setEnviando(false);
    if (!res.success) {
      if (/email not confirmed/i.test(res.error || '')) {
        setErro('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada (e o spam).');
      } else {
        setErro('E-mail ou senha inválidos. Confira os dados e tente novamente.');
      }
    }
  };

  const handleEsqueciSenha = async () => {
    setErro(null);
    setAvisoRecuperacao(null);
    if (!email) {
      setErro('Digite seu e-mail no campo acima e clique em "Esqueci minha senha" novamente.');
      return;
    }
    const res = await authService.recuperarSenha(email.trim());
    if (res.success) {
      setAvisoRecuperacao(`Enviamos um link de redefinição de senha para ${email.trim()}.`);
    } else {
      setErro('Não foi possível enviar o e-mail de recuperação agora. Tente novamente em instantes.');
    }
  };

  return (
    <AuthLayout>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-8">
        <div className="text-center mb-6">
          <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-3.5">
            <Building2 className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Bem-vindo(a) de volta</h1>
          <p className="text-xs text-slate-500 mt-1">Entre com seu e-mail e senha para acessar o Calazans Imob.</p>
        </div>

        {erro && (
          <div className="flex items-start gap-2 bg-rose-50 text-rose-700 text-xs rounded-lg px-3 py-2.5 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}
        {avisoRecuperacao && (
          <div className="flex items-start gap-2 bg-sky-50 text-sky-700 text-xs rounded-lg px-3 py-2.5 mb-4">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{avisoRecuperacao}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@imobiliaria.com.br"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Senha</label>
            <div className="relative">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex justify-end mt-1.5">
              <button type="button" onClick={handleEsqueciSenha} className="text-xs font-semibold text-sky-600 hover:underline cursor-pointer">
                Esqueci minha senha
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition-all cursor-pointer disabled:opacity-60"
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-5">
          Ainda não tem conta?{' '}
          <button type="button" onClick={onSwitchToCadastro} className="font-semibold text-sky-600 hover:underline cursor-pointer">
            Criar conta
          </button>
        </p>
      </div>
    </AuthLayout>
  );
};
