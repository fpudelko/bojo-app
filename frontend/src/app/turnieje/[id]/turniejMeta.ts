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

/**
 * Podgląd linków prowadzących DO turnieju: `/t/<kod>` (dołączenie do
 * drużyny), `/k/<kod>` (link kapitana), `/o/<kod>` (zaproszenie do
 * prowadzenia). Do 2026-11-27 te trasy nie miały własnych metadanych, więc
 * WhatsApp i poczta pokazywały ogólną kartę „Bojo, zbierz ekipę, zagraj
 * dziś” (zgłoszenie właściciela). Teraz: tytuł mówi, do czego zaprasza link,
 * opis i obrazek są turnieju. Link z kodem nie trafia do wyszukiwarki.
 */
export async function metadataLinkuTurnieju(
  turniejId: string | null | undefined,
  tytul: (nazwaTurnieju: string) => string,
  adres: string,
): Promise<Metadata> {
  const ogolne: Metadata = { title: 'Zaproszenie do turnieju · Bojo', robots: { index: false, follow: false } };
  if (!turniejId) return ogolne;
  try {
    const { data } = await supabasePublic
      .from('turnieje')
      .select('nazwa, opis, sport, miasto, miejsce_nazwa, max_druzyn, wpisowe_grosz, data_startu, godzina_startu')
      .eq('id', turniejId)
      .maybeSingle();
    if (!data) return ogolne;
    const title = tytul(data.nazwa);
    const description = opisTurnieju(data);
    const obrazek = `/turnieje/${turniejId}/opengraph-image`;
    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: {
        title, description, url: adres, type: 'website', locale: 'pl_PL', siteName: 'Bojo',
        images: [{ url: obrazek, width: 1200, height: 630, alt: data.nazwa }],
      },
      twitter: { card: 'summary_large_image', title, description, images: [obrazek] },
    };
  } catch {
    return ogolne;
  }
}

/** Turniej i drużyna po kodzie dołączenia (`/t/<kod>`), do podglądu linku. */
export async function druzynaPoKodzieDoPodgladu(kod: string): Promise<{ turniejId: string; nazwa: string } | null> {
  const { data } = await supabasePublic
    .from('turniej_druzyny')
    .select('turniej_id, nazwa')
    .ilike('kod_dolaczenia', kod.trim())
    .maybeSingle();
  return data ? { turniejId: data.turniej_id, nazwa: data.nazwa } : null;
}

/** Turniej i drużyna po kodzie kapitana (`/k/<kod>`), do podglądu linku. */
export async function druzynaPoKodzieKapitanaDoPodgladu(kod: string): Promise<{ turniejId: string; nazwa: string } | null> {
  const { data } = await supabasePublic.rpc('druzyna_po_kodzie_kapitana', { p_kod: kod });
  const r = Array.isArray(data) ? data[0] : data;
  return r ? { turniejId: r.turniej_id, nazwa: r.nazwa } : null;
}

/** Turniej po kodzie zaproszenia osoby (`/o/<kod>`, 189), do podglądu linku. */
export async function zaproszenieOsobyDoPodgladu(kod: string): Promise<{ turniejId: string; rola: string } | null> {
  const { data } = await supabasePublic.rpc('zaproszenie_osoby_info', { p_kod: kod });
  const r = Array.isArray(data) ? data[0] : data;
  return r ? { turniejId: r.turniej_id, rola: r.rola } : null;
}
