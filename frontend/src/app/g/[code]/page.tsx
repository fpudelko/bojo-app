import { redirect, notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/** Short invite link for a group, e.g. /g/7JGUF8 → the group page with a
 *  prominent "join" action. Mirrors /d/[code] for events. */
export default async function GroupJoinCodePage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase().trim();

  const { data } = await supabaseAdmin
    .from('groups')
    .select('id')
    .eq('join_code', code)
    .maybeSingle();

  if (!data) notFound();

  redirect(`/grupy/${data.id}?join=1`);
}
