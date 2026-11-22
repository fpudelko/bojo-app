import type { Metadata } from 'next';
import { pobierzAdres } from '@/lib/adresy';
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

    const adres = `/turnieje/${(await pobierzAdres('turniej', id)) ?? id}`;
    return {
      title,
      description,
      alternates: { canonical: adres },
      // PEŁNY blok openGraph (2026-11-22). Obiekt `openGraph` tutaj ZASTĘPUJE
      // ten z layout.tsx w całości, więc strona turnieju traciła `og:type`
      // i `og:locale`, a `og:url` i `og:site_name` nie miała nigdy. WhatsApp
      // to wybacza, Messenger pokazywał sam „bojo.pl” bez tytułu (zgłoszenie
      // właściciela). `og:url` z adresem z nazwą, ten sam co canonical.
      openGraph: { title, description, url: adres, type: 'website', locale: 'pl_PL', siteName: 'Bojo' },
      // Znaczniki Twittera osobno, bo NIE dziedziczą się po openGraph.
      // Bez nich część komunikatorów pokazywała globalny opis marki
      // z `layout.tsx` („Bojo, zbierz ekipę, zagraj dziś") zamiast turnieju,
      // czyli reklamę w miejscu, w którym miało stać zaproszenie.
      twitter: { card: 'summary_large_image', title, description },
    };
  } catch {
    return { title: 'Turniej: Bojo' };
  }
}
