import { supabase } from './supabase';
import { chwilaWPolsce, terazWPolsce } from './czasPolski';

/**
 * Pasek „trwa turniej” na stronie głównej i na `/moje-gry` (migracja `198`).
 *
 * Decyzje właściciela (2026-11-28): pokazywany WSZYSTKIM, także niezalogowanym
 * i mimo wyłączonej flagi `SHOW_TURNIEJE`; wszystkie publiczne trwające
 * turnieje (jest ich mało, filtr po okolicy przyjdzie później); przy kilku
 * naraz jeden na pasku i dopisek „+N inne”.
 *
 * Które turnieje i w jakiej kolejności, liczy baza (`pasek_turniejow()`):
 * mój pierwszy, potem trwające, potem te, które startują dziś.
 */

export interface TurniejNaPasku {
  id: string;
  nazwa: string;
  miasto: string | null;
  status: string;
  dataStartu: string;
  godzinaStartu: string | null;
  mojaDruzynaId: string | null;
  mojaDruzynaNazwa: string | null;
  /** „Orły 2:1 Sokoły” — mecz w toku, jeśli jest. */
  naZywo: string | null;
  /** Najbliższy mecz MOJEJ drużyny (ISO). */
  nastepnyAt: string | null;
  nastepnyBoisko: string | null;
  nastepnyRywal: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function zWiersza(r: any): TurniejNaPasku {
  return {
    id: r.turniej_id,
    nazwa: r.nazwa,
    miasto: r.miasto ?? null,
    status: r.status,
    dataStartu: r.data_startu,
    godzinaStartu: r.godzina_startu ? String(r.godzina_startu).slice(0, 5) : null,
    mojaDruzynaId: r.moja_druzyna_id ?? null,
    mojaDruzynaNazwa: r.moja_druzyna_nazwa ?? null,
    naZywo: r.na_zywo ?? null,
    nastepnyAt: r.nastepny_at ?? null,
    nastepnyBoisko: r.nastepny_boisko ?? null,
    nastepnyRywal: r.nastepny_rywal ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Cicha porażka: pasek jest dodatkiem, brak migracji albo sieci nie może
 *  wywrócić strony głównej. */
export async function pobierzTurniejeNaPasek(): Promise<TurniejNaPasku[]> {
  const { data, error } = await supabase.rpc('pasek_turniejow');
  if (error) return [];
  return ((data ?? []) as unknown[]).map(zWiersza);
}

export interface TrescPaska {
  /** Pierwsza linia: „Trwa turniej Gramy dla Marysi · Luboń”. */
  naglowek: string;
  /** Druga linia: wynik na żywo albo najbliższy mecz mojej drużyny. */
  szczegol: string | null;
  /** Dokąd prowadzi dotknięcie paska. */
  link: string;
  /** Drugi przycisk „Grasz? Znajdź swoją drużynę” — tylko dla kogoś, kto
   *  w tym turnieju jeszcze nie ma drużyny. */
  linkZnajdz: string | null;
  /** „+2 inne” */
  ileInnych: number;
}

function godzinaMeczu(iso: string): string {
  return chwilaWPolsce(iso).godzina;
}

/** Treść paska z listy z bazy. `null` = nie ma czego pokazać. */
export function trescPaska(lista: readonly TurniejNaPasku[], ukryte: ReadonlySet<string> = new Set()): TrescPaska | null {
  const widoczne = lista.filter((t) => !ukryte.has(t.id));
  const t = widoczne[0];
  if (!t) return null;

  const gdzie = t.miasto ? ` · ${t.miasto}` : '';
  const trwa = t.status === 'trwa';
  const naglowek = t.mojaDruzynaId
    ? `Twoja drużyna: ${t.mojaDruzynaNazwa ?? ''} · ${t.nazwa}`
    : trwa
      ? `Trwa turniej ${t.nazwa}${gdzie}`
      : `Dziś turniej ${t.nazwa}${gdzie}${t.godzinaStartu ? `, start ${t.godzinaStartu}` : ''}`;

  let szczegol: string | null = null;
  if (t.mojaDruzynaId && t.nastepnyAt) {
    const rywal = t.nastepnyRywal ? ` z ${t.nastepnyRywal}` : '';
    const boisko = t.nastepnyBoisko ? `, ${t.nastepnyBoisko}` : '';
    szczegol = `Następny mecz${rywal}: ${godzinaMeczu(t.nastepnyAt)}${boisko}`;
  } else if (t.naZywo) {
    szczegol = `Na żywo: ${t.naZywo}`;
  }

  return {
    naglowek,
    szczegol,
    link: t.mojaDruzynaId ? `/turnieje/${t.id}/druzyna/${t.mojaDruzynaId}` : `/turnieje/${t.id}`,
    linkZnajdz: t.mojaDruzynaId ? null : `/turnieje/${t.id}/jestem`,
    ileInnych: widoczne.length - 1,
  };
}

// Zamknięcie krzyżykiem — na ten dzień, per turniej. Wygoda jednego widza,
// więc `localStorage` (każdy dostęp w try/catch: tryb prywatny, zablokowane dane).
const PREFIKS = 'bojo:pasek-turnieju-ukryty:';

export function kluczUkrycia(turniejId: string, dzien: string = terazWPolsce().data): string {
  return `${PREFIKS}${dzien}:${turniejId}`;
}

export function ukryteDzis(lista: readonly TurniejNaPasku[]): Set<string> {
  const wynik = new Set<string>();
  try {
    for (const t of lista) if (localStorage.getItem(kluczUkrycia(t.id))) wynik.add(t.id);
  } catch { /* brak dostępu do pamięci — pasek po prostu się pokaże */ }
  return wynik;
}

export function ukryjDzis(turniejId: string): void {
  try { localStorage.setItem(kluczUkrycia(turniejId), '1'); } catch { /* jak wyżej */ }
}
