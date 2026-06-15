import { redirect, notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default async function JoinCodePage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase().trim();

  const { data } = await supabaseAdmin
    .from('events')
    .select('id')
    .eq('join_code', code)
    .maybeSingle();

  if (!data) notFound();

  redirect(`/wydarzenia/${data.id}`);
}
