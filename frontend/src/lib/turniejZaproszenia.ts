/**
 * Imienne zaproszenia kapitana do drużyny turniejowej (`turniej_zaproszenia`,
 * migracja `154`).
 *
 * Bliźniak `lib/playerInvites.ts` (mecz, migracja `060`) i powtarza jego trzy
 * zasady: zaproszenie nie zajmuje miejsca w składzie, duplikaty pomija baza,
 * a odrzucone zostaje w tabeli, żeby nie wróciło.
 *
 * Dwie różnice wobec meczu, obie świadome:
 *  - zaprasza WYŁĄCZNIE kapitan drużyny (nie organizator turnieju) — RLS
 *    pilnuje tego funkcją `czy_sam_kapitan_druzyny()`, celowo węższą niż
 *    `czy_kapitan_druzyny()` z migracji `145`,
 *  - kandydatów bierze się z EKIP kapitana i tylko stamtąd. Wyszukiwarka po
 *    całym Bojo wymagałaby udostępnienia listy wszystkich kont.
 */

import { supabase } from './supabase';
import { toTurniej } from './turnieje';
import { track } from './analytics';
import type { TurniejZaproszenie, ZaproszenieZKontekstem } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toZaproszenie(row: any): TurniejZaproszenie {
  return {
    id: row.id,
    turniejId: row.turniej_id,
    druzynaId: row.druzyna_id,
    userId: row.user_id,
    zaprosilId: row.zaprosil_id ?? undefined,
    groupId: row.group_id ?? undefined,
    createdAt: row.created_at,
    dismissedAt: row.dismissed_at ?? undefined,
  };
}

/**
 * Moje aktywne zaproszenia — do karty na stronie głównej, obok zaproszeń
 * na mecz.
 *
 * Odsiewamy turnieje, w których nie ma już czego robić (zakończone, odwołane,
 * po dacie startu): karta „dołącz do składu" na turniej sprzed tygodnia jest
 * gorsza niż jej brak. Wyzwalacz z migracji `154` gasi zaproszenie w chwili
 * wejścia do drużyny, więc tutaj nie trzeba tego sprawdzać drugi raz.
 */
export async function getMojeZaproszenia(userId: string): Promise<ZaproszenieZKontekstem[]> {
  const { data, error } = await supabase
    .from('turniej_zaproszenia')
    .select('*, turnieje(*), turniej_druzyny(nazwa,kod_dolaczenia)')
    .eq('user_id', userId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const dzis = new Date().toISOString().slice(0, 10);
  const wiersze = (data ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => r.turnieje
      && !['zakonczony', 'odwolany'].includes(r.turnieje.status)
      && (r.turnieje.data_konca ?? r.turnieje.data_startu) >= dzis,
  );
  if (wiersze.length === 0) return [];

  // Nazwa zapraszającego osobnym zapytaniem — `zaprosil_id` wskazuje na
  // `auth.users`, nie na `profiles`, więc PostgREST nie zbuduje joinu.
  const zapraszajacy = Array.from(new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wiersze.map((r: any) => r.zaprosil_id).filter(Boolean),
  )) as string[];
  const nazwy = new Map<string, string>();
  if (zapraszajacy.length > 0) {
    const { data: profile } = await supabase
      .from('profiles').select('id, display_name').in('id', zapraszajacy);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (profile ?? []) as any[]) {
      if (p.display_name) nazwy.set(p.id as string, p.display_name as string);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return wiersze.map((r: any) => ({
    zaproszenie: toZaproszenie(r),
    turniej: toTurniej(r.turnieje),
    druzynaNazwa: r.turniej_druzyny?.nazwa ?? 'drużyna',
    kodDolaczenia: r.turniej_druzyny?.kod_dolaczenia ?? '',
    zaprosilNazwa: r.zaprosil_id ? nazwy.get(r.zaprosil_id) : undefined,
  }));
}

/** Kogo kapitan już zaprosił do TEJ drużyny — żeby nie proponować drugi raz.
 *  RLS pokazuje te wiersze wyłącznie zaproszonemu i kapitanowi, więc dla
 *  organizatora i dla kogoś z ulicy lista wróci pusta i tak ma być. */
export async function getZaproszeniaDruzyny(druzynaId: string): Promise<TurniejZaproszenie[]> {
  const { data, error } = await supabase
    .from('turniej_zaproszenia')
    .select('*')
    .eq('druzyna_id', druzynaId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toZaproszenie);
}

/**
 * Zaprasza wskazane osoby i zwraca liczbę faktycznie dodanych zaproszeń.
 *
 * `ignoreDuplicates` na `UNIQUE (druzyna_id, user_id)`: powtórne „zaproś
 * ekipę" po dojściu nowego członka nie wskrzesza zaproszenia, które ktoś
 * wcześniej świadomie odrzucił — dokładnie jak `invitePlayers()` przy meczu.
 *
 * `turniej_id` uzupełnia wyzwalacz w bazie, więc nie wysyłamy go stąd: dwie
 * strony ustawiające tę samą kolumnę to dwie prawdy o tym, do którego turnieju
 * należy drużyna.
 */
export async function zaprosDoDruzyny(
  druzynaId: string,
  userIds: string[],
  opcje: { zaprosilId: string; groupId?: string },
): Promise<number> {
  if (userIds.length === 0) return 0;
  const { data, error } = await supabase
    .from('turniej_zaproszenia')
    .upsert(
      userIds.map((userId) => ({
        druzyna_id: druzynaId,
        user_id: userId,
        zaprosil_id: opcje.zaprosilId,
        group_id: opcje.groupId ?? null,
      })),
      { onConflict: 'druzyna_id,user_id', ignoreDuplicates: true },
    )
    .select('id');
  if (error) throw new Error(error.message);
  const ile = data?.length ?? 0;
  if (ile > 0) track('turniej_zaproszenia_wyslane', { druzynaId, ile });
  return ile;
}

/** Zaproszony chowa zaproszenie. Wiersz zostaje, żeby nie wróciło. */
export async function odrzucZaproszenie(id: string): Promise<void> {
  const { error } = await supabase
    .from('turniej_zaproszenia')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
