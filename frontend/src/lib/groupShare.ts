// Zaproszenie do grupy — jeden link i jeden tekst dla całej aplikacji,
// wzorem `lib/eventShare.ts` i `lib/guestClaim.ts`. Cały tekst jako czysta
// funkcja, żeby dało się go przypiąć testem bez renderowania.
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { kanonicznyOrigin } from './powrotPoLogowaniu';
import type { Group, EventItem } from '@/types';

/** Link zaproszenia. `od` (kto zaprasza) dokładany jako `?od=<uuid>` — baza
 *  go zweryfikuje przy dołączeniu (migracja `094`), a lądowanie `/g/[kod]`
 *  użyje go do „X zaprasza Cię do ekipy". Origin przez `kanonicznyOrigin()`:
 *  bez tego link wysłany z `www.bojo.pl` wywraca logowanie po drugiej
 *  stronie (ten sam problem, co `linkPrzejeciaWpisu()`). */
export function linkDoGrupy(joinCode: string, odUserId?: string, origin?: string): string {
  const baza = origin
    ? kanonicznyOrigin(origin)
    : (typeof window !== 'undefined' ? kanonicznyOrigin(window.location.origin) : (process.env.NEXT_PUBLIC_SITE_URL || 'https://bojo.pl'));
  const url = `${baza}/g/${joinCode}`;
  return odUserId ? `${url}?od=${odUserId}` : url;
}

/**
 * Tekst zaproszenia do ekipy — trzy rzeczy, które musi robić dobrze:
 *
 * 1. MÓWI WPROST, ŻE TRZEBA ZAŁOŻYĆ KONTO. Kłamstwo w tym miejscu kosztuje
 *    organizatora wiarygodność u jego własnej ekipy — jedyną walutę, jaką ma.
 * 2. POKAZUJE NAJBLIŻSZY TERMIN, jeśli jest — konkret przekonuje bardziej niż
 *    ogólnik "dołącz do naszej grupy".
 * 3. ZERO SŁOWA o SMS-ach, powiadomieniach poza aplikacją i rankingach —
 *    dokładnie ta sama zasada co `content/zakazaneFrazy.ts` dla stron treści.
 */
export function tekstZaproszeniaDoGrupy(
  g: Pick<Group, 'name'>,
  link: string,
  ktoZaprasza?: string,
  najblizszy?: Pick<EventItem, 'date' | 'time' | 'fieldName'>,
): string {
  const naglowek = `⚽ ${g.name} — nasza ekipa w Bojo`;
  const wstep = ktoZaprasza?.trim()
    ? `${ktoZaprasza.trim()} zaprasza Cię do ekipy.`
    : 'Zapraszamy Cię do ekipy.';

  let terminLinia = '';
  if (najblizszy) {
    let kiedy: string;
    try {
      kiedy = format(parseISO(najblizszy.date), 'EEEE, d MMMM', { locale: pl });
    } catch {
      kiedy = najblizszy.date;
    }
    const godzina = (najblizszy.time ?? '').slice(0, 5);
    const miejsce = najblizszy.fieldName ? `, ${najblizszy.fieldName}` : '';
    terminLinia = `\nNajbliższy mecz: ${kiedy}, ${godzina}${miejsce}.\n`;
  }

  return `${naglowek}\n\n${wstep}${terminLinia}\n`
    + `Wchodzisz w link, zakładasz konto (można przez Google) i masz w jednym `
    + `miejscu wszystkie nasze terminy, skład na żywo i kto ile ma dorzucić.\n\n`
    + `${link}`;
}

export type WynikUdostepnieniaGrupy = 'shared' | 'copied' | 'failed';

/** Web Share API z fallbackiem do schowka — ten sam wzorzec co
 *  `shareEvent()`/`udostepnijZaproszenieGoscia()`. Anulowanie arkusza też
 *  zwraca `'failed'`, bo to nie jest błąd — wywołujący nic wtedy nie pokazuje. */
export async function udostepnijGrupe(
  g: Pick<Group, 'name'>,
  link: string,
  ktoZaprasza?: string,
  najblizszy?: Pick<EventItem, 'date' | 'time' | 'fieldName'>,
): Promise<WynikUdostepnieniaGrupy> {
  const text = tekstZaproszeniaDoGrupy(g, link, ktoZaprasza, najblizszy);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `Zaproszenie do ekipy ${g.name}`, text });
      return 'shared';
    } catch {
      return 'failed';
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
