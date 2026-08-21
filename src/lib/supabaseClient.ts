import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || 'https://grtagydqrdnlrnjvqrdc.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_0bV4sTmpRTr5QGmc5w9C2w_swHebSk5';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

