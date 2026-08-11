import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { supabase } from './supabase';
import { eventDisplayTitle } from './eventTitle';
import { kanonicznyOrigin } from './powrotPoLogowaniu';
import type { DaneDoUdostepnienia } from './eventShare';

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
 *  linków w aplikacji — `bojo.pl` jako wartość zapasowa.
 *
 *  Origin przepuszczamy przez `kanonicznyOrigin()`: organizator na
 *  `www.bojo.pl` wysyłał dotąd link z `www.`, a logowanie z takiego adresu
 *  startuje z innego origin niż ten wpisany na listę dozwolonych w Supabase —
 *  i przekierowanie po zalogowaniu lądowało na stronie głównej zamiast na
 *  stronie przejęcia wpisu. */
export function linkPrzejeciaWpisu(token: string): string {
  const baza =
    typeof window !== 'undefined'
      ? kanonicznyOrigin(window.location.origin)
      : process.env.NEXT_PUBLIC_SITE_URL || 'https://bojo.pl';
  return `${baza}/gracz/przejmij/${token}`;
}

/**
 * Tekst do wysłania RAZEM z linkiem przejęcia wpisu.
 *
 * Bez tego link trafiał na czat jako goły adres — dokładnie ten sam błąd, który
 * już raz naprawiono w głównym udostępnianiu meczu (patrz `eventShareText` w
 * `lib/eventShare.ts`). Tu ta naprawa po prostu nie dotarła.
 *
 * Trzy rzeczy, które ta treść musi robić dobrze — każda była zgłoszona jako
 * błąd poprzedniej wersji:
 *
 * 1. MÓWI, KTO ZAPRASZA. „Organizator dopisał Cię" to nikt konkretny; wiadomość
 *    od nieznajomego z linkiem wygląda jak spam. Dopisujący nie zawsze jest
 *    organizatorem — gdy mecz pozwala uczestnikom dopisywać znajomych, robi to
 *    kolega z drużyny.
 * 2. JEST W CZASIE PRZYSZŁYM. Poprzednia wersja mówiła „Zagraliście razem",
 *    a wpis gościa powstaje przed meczem, nie po nim — zaproszenie na przyszłą
 *    grę brzmiało jak podsumowanie rozegranej.
 * 3. OBIECUJE TO, CO MA WARTOŚĆ. „Zobaczysz swój udział" nie jest zachętą:
 *    skład widać bez konta, wystarczy otworzyć link do meczu. Konto daje
 *    grupę, powiadomienia o kolejnych meczach i własne gry.
 */
export function tekstZaproszeniaGoscia(
  imieGoscia: string,
  e: DaneDoUdostepnienia,
  ktoZaprasza?: string,
): string {
  const tytul = eventDisplayTitle({ title: e.title, sport: e.sport, maxPlayers: e.maxPlayers });
  let kiedy: string;
  try {
    kiedy = format(parseISO(e.date), 'EEEE, d MMMM', { locale: pl });
  } catch {
    kiedy = e.date;
  }

  const zapraszajacy = ktoZaprasza?.trim();
  const wstep = zapraszajacy
    ? `Cześć ${imieGoscia}! ${zapraszajacy} zapisał(a) Cię na mecz`
    : `Cześć ${imieGoscia}! Ktoś zapisał Cię na mecz`;

  return `${wstep} „${tytul}" (${kiedy}) w Bojo.\n`
    + `Masz miejsce w składzie — potwierdź, że to Ty, żeby mecz trafił na Twoją listę gier.\n`
    + `Przy okazji odblokujesz:\n`
    + `• dołączanie do ekipy i powiadomienia o kolejnych meczach,\n`
    + `• zakładanie własnych gier,\n`
    + `• przeglądanie otwartych gier w okolicy (tych wciąż przybywa).\n`
    + `Konto zakładasz Google'em albo e-mailem, zajmuje 30 sekund:`;
}
