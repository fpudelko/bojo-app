import { Suspense } from 'react';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import GroupDetailClient from './GroupDetailClient';

/** Ten sam wzorzec co /g/[code]: klient serwerowy z kluczem anon. Wiersza
 *  `groups` ten klucz od migracji `150` NIE przeczyta (ekipa jest prywatna) —
 *  nazwę wydaje funkcja `grupa_publicznie()`, i tylko nazwę. */
const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/** Strona grupy jest celem linku zaproszenia — bez metadanych każde
 *  udostępnienie na Messengerze pokazywało generyczny tytuł całej aplikacji. */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const { data } = await supabasePublic.rpc('grupa_publicznie', { p_group_id: params.id });
    const grupa = Array.isArray(data) ? data[0] : data;
    if (!grupa) return { title: 'Grupa — Bojo' };

    // Opis jest GENERYCZNY, nie własny opis ekipy: podgląd linku na
    // Messengerze trafia do ludzi spoza ekipy, a ci mają zobaczyć dokładnie
    // to samo, co na stronie — nazwę i nic więcej (migracja `150`).
    const description = 'Prywatna ekipa w Bojo. Skład i mecze widzą jej członkowie.';

    return {
      title: `${grupa.name} — grupa w Bojo`,
      description,
      alternates: { canonical: `/grupy/${params.id}` },
      openGraph: { title: `${grupa.name} — grupa w Bojo`, description },
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
