import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { opisTurnieju } from '@/lib/turniejOpis';

/** Ten sam wzorzec co /grupy/[id]: klient serwerowy z kluczem anon — tabela
 *  `turnieje` jest publicznie czytelna przez RLS („Turniej czyta kazdy").
 *
 *  Sama treść opisu mieszka w `lib/turniejOpis.ts`: ten plik stawia klienta
 *  Supabase przy imporcie, więc importowanie go z testu wywracało się na
 *  braku zmiennych środowiskowych. Logika domenowa i tak należy do `lib/`
 *  (AGENTS.md), a tutaj zostaje wyłącznie zapytanie. */
const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function generateTurniejMetadata(id: string): Promise<Metadata> {
  try {
    const { data } = await supabasePublic
      .from('turnieje')
      .select('nazwa, opis, sport, miasto, miejsce_nazwa, max_druzyn, wpisowe_grosz, data_startu, godzina_startu')
      .eq('id', id)
      .maybeSingle();

    if (!data) return { title: 'Turniej: Bojo' };

    // Kropka rozdzielająca, nie dwukropek. Nazwy turniejów często SAME
    // zawierają dwukropek („TU6 Turniej Sobotni: mecz NA ŻYWO"), więc tytuł
    // wychodził z dwoma i czytał się jak sklejka.
    const title = `${data.nazwa} · turniej w Bojo`;
    const description = opisTurnieju(data);

    return {
      title,
      description,
      alternates: { canonical: `/turnieje/${id}` },
      openGraph: { title, description },
      // Znaczniki Twittera osobno, bo NIE dziedziczą się po openGraph.
      // Bez nich część komunikatorów pokazywała globalny opis marki
      // z `layout.tsx` („Bojo, zbierz ekipę, zagraj dziś") zamiast turnieju,
      // czyli reklamę w miejscu, w którym miało stać zaproszenie.
      twitter: { title, description },
    };
  } catch {
    return { title: 'Turniej: Bojo' };
  }
}
