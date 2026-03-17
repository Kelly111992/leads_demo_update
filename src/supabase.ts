import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rlgjxxjfxirbyhfsztzr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZ2p4eGpmeGlyYnloZnN6dHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTU4NzksImV4cCI6MjA4OTI5MTg3OX0.no_iOOjBpdf7jgsjhi2SBBRBbtNrTN09b81MaWDSMTs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
