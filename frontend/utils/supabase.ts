import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxx.supabase.co'; // Fallback for dev if env missing
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
