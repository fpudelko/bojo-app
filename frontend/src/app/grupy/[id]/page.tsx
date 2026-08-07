import { Suspense } from 'react';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import GroupDetailClient from './GroupDetailClient';

/** Ten sam wzorzec co /g/[code]: klient serwerowy z kluczem anon. Tabela
 *  `groups` jest publicznie czytelna przez RLS („Groups are readable"), więc
 *  do tytułu strony nie potrzeba uprawnień. */
const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/** Strona grupy jest celem linku zaproszenia — bez metadanych każde
 *  udostępnienie na Messengerze pokazywało generyczny tytuł całej aplikacji. */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const { data } = await supabasePublic
      .from('groups')
      .select('name, description, sport, city')
      .eq('id', params.id)
      .maybeSingle();

    if (!data) return { title: 'Grupa — Bojo' };

    const detale = [data.sport, data.city].filter(Boolean).join(' · ');
    const description = data.description?.trim()
      || (detale ? `Stała ekipa w Bojo — ${detale}.` : 'Stała ekipa w Bojo: mecze, skład i historia w jednym miejscu.');

    return {
      title: `${data.name} — grupa w Bojo`,
      description,
      alternates: { canonical: `/grupy/${params.id}` },
      openGraph: { title: `${data.name} — grupa w Bojo`, description },
    };
  } catch {
    // Brak sieci przy budowaniu metadanych nie może wywrócić całej strony.
    return { title: 'Grupa — Bojo' };
  }
}

export default function GroupDetailPage() {
  // GroupDetailClient czyta ?join=1 przez useSearchParams, a to na trasie
  // prerenderowanej wymaga granicy <Suspense> — patrz pułapka
  // „missing-suspense-with-csr-bailout" w AGENTS.md.
  return (
    <Suspense>
      <GroupDetailClient />
    </Suspense>
  );
}
