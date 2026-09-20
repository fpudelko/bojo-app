import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

/** Ten sam wzorzec co /grupy/[id]: klient serwerowy z kluczem anon — tabela
 *  `turnieje` jest publicznie czytelna przez RLS („Turniej czyta kazdy"). */
const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function generateTurniejMetadata(id: string): Promise<Metadata> {
  try {
    const { data } = await supabasePublic
      .from('turnieje')
      .select('nazwa, opis, sport, miasto')
      .eq('id', id)
      .maybeSingle();

    if (!data) return { title: 'Turniej: Bojo' };

    const detale = [data.sport, data.miasto].filter(Boolean).join(' · ');
    const description = data.opis?.trim()
      || (detale ? `Turniej w Bojo: ${detale}.` : 'Turniej amatorski w Bojo: zapisy drużyn, terminarz i wyniki na żywo.');

    return {
      title: `${data.nazwa}: turniej w Bojo`,
      description,
      alternates: { canonical: `/turnieje/${id}` },
      openGraph: { title: `${data.nazwa}: turniej w Bojo`, description },
    };
  } catch {
    return { title: 'Turniej: Bojo' };
  }
}
