import { supabase } from './supabase';

/**
 * Przejęcie wpisu gościa (migracja `066`).
 *
 * Organizator dopisuje kogoś ręcznie — wpis nie ma właściciela. Ta ścieżka
 * pozwala tej osobie związać wpis ze swoim kontem zamiast zapisywać się drugi
 * raz i zostawiać w składzie dwie pozycje o tym samym imieniu.
 *
 * Cała logika siedzi w funkcjach bazodanowych z `SECURITY DEFINER`, bo wpis
 * gościa z definicji nie należy jeszcze do nikogo — żadna polityka RLS oparta
 * na `auth.uid()` nie mogłaby go przepuścić.
 */

export interface PodgladWpisuGoscia {
  imie: string;
  eventId: string;
  tytul: string;
  data: string;
  godzina: string;
  miejsce: string;
  juzPrzejety: boolean;
}

/** Co pokazać klikającemu, zanim się zaloguje. Zwraca null dla nieznanego tokenu. */
export async function podejrzyjWpisGoscia(token: string): Promise<PodgladWpisuGoscia | null> {
  const { data, error } = await supabase.rpc('podejrzyj_wpis_goscia', { p_token: token });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    imie: row.imie,
    eventId: row.event_id,
    tytul: row.tytul,
    data: row.data_meczu,
    godzina: row.godzina,
    miejsce: row.miejsce,
    juzPrzejety: row.juz_przejety,
  };
}

/** Wiąże wpis z zalogowanym kontem. Zwraca id meczu, żeby było dokąd wrócić. */
export async function przejmijWpisGoscia(token: string, nazwa: string): Promise<string> {
  const { data, error } = await supabase.rpc('przejmij_wpis_goscia', {
    p_token: token,
    p_nazwa: nazwa,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Link do wysłania gościowi. Domena z `NEXT_PUBLIC_SITE_URL`, tak jak reszta
 *  linków w aplikacji — `bojo.pl` jako wartość zapasowa. */
export function linkPrzejeciaWpisu(token: string): string {
  const baza =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || 'https://bojo.pl';
  return `${baza}/gracz/przejmij/${token}`;
}
