import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set. ' +
      'Supabase client will not work correctly.',
  );
}

/**
 * Client-side Supabase client (uses anon key, subject to RLS).
 * Import this in Client Components (`'use client'`) only.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
