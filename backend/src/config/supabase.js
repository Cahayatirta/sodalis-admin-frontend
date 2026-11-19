import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

if (!env.supabase.url || !env.supabase.serviceRoleKey) {
  console.warn(
    '[Supabase Config Warning] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined. Please configure them in your .env file.'
  );
}

// Service Role Key bypasses Row Level Security (RLS) for underwriting admin functions
export const supabase = createClient(
  env.supabase.url || 'https://placeholder.supabase.co',
  env.supabase.serviceRoleKey || 'placeholder-service-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

