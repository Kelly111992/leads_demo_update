import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rlgjxxjfxirbyhfsztzr.supabase.co';
const supabaseAnonKey = 'sb_publishable_e_Hu4ROvwlGJJs4EhTMYiQ_Vw8g5wAd';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
