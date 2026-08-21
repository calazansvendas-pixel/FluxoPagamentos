import { createClient } from '@supabase/supabase-js';

// Credenciais padrão para deploy público (GitHub Pages, Vercel, Netlify, etc.)
const DEFAULT_SUPABASE_URL = 'https://grtagydqrdnlrnjvqrdc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_0bV4sTmpRTr5QGmc5w9C2w_swHebSk5';

// Leitura prioritária de variáveis de ambiente Vite (import.meta.env), com fallback seguro
const metaEnv = (import.meta as any).env || {};

const supabaseUrl: string = 
  metaEnv.VITE_SUPABASE_URL || 
  metaEnv.NEXT_PUBLIC_SUPABASE_URL || 
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey: string = 
  metaEnv.VITE_SUPABASE_ANON_KEY || 
  metaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

