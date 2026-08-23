/**
 * Rozmowy prywatne 1-na-1 między graczami (migracja `125`).
 *
 * PO CO. Jedynym pisemnym kanałem były dotąd rozmowy pod meczem
 * (`lib/comments.ts`) i tablica ekipy (`lib/groupPosts.ts`) — obie grupowe.
 * Prywatne „grasz w czwartek?" szło na Messengera, do ludzi znanych często
 * TYLKO z boiska. Wejście: przycisk na profilu gracza, rozmowa pod
 * `/rozmowy/[id]`, lista — `/rozmowy`.
 *
 * BLOKOWANIE JEST CZĘŚCIĄ TEJ FUNKCJI, nie dodatkiem: patrz `zablokuj()`
 * i `czy_zablokowani()` w migracji. Kanał do dowolnej osoby bez wyjścia
 * awaryjnego nie jest wersją „pierwszą, uproszczoną".
 */
import { supabase } from './supabase';
import { zaktualizujJedenWiersz, zPonowieniemPoOdswiezeniu } from './zapytania';
import { kluczRozmowyWidziano, nieprzeczytaneKomentarze, type RozmowaNaLiscie } from './comments';

export interface DmWiadomosc {
  id: string;
  nadawcaId: string;
  nadawcaNazwa: string;
  tresc: string;
  createdAt: string;
}

/** Kanoniczny porządek pary: `low < high`. CHECK w migracji pilnuje tego także
 *  w bazie, więc rozmowa A↔B to zawsze jeden wiersz — bez względu na to, kto
 *  pisze pierwszy. */
export function paraRozmowy(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

/** Klucz znacznika przeczytania dla pary — ten sam schemat co rozmowy meczowe,
 *  z przedrostkiem `dm:`, żeby nie zderzyć się z kluczem meczu. */
export function kluczDmWidziano(a: string, b: string): string {
  const { low, high } = paraRozmowy(a, b);
  return kluczRozmowyWidziano(`dm:${low}:${high}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toWiadomosc(r: any): DmWiadomosc {
  return {
    id: r.id,
    nadawcaId: r.sender_id,
    nadawcaNazwa: r.sender_name,
    tresc: r.content,
    createdAt: r.created_at,
  };
}

export async function pobierzDm(mojId: string, drugiId: string): Promise<DmWiadomosc[]> {
  const { low, high } = paraRozmowy(mojId, drugiId);
  const { data, error } = await supabase
    .from('dm_messages')
    .select('id, sender_id, sender_name, content, created_at')
    .eq('low_user_id', low)
    .eq('high_user_id', high)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toWiadomosc);
}

export async function wyslijDm(
  mojId: string,
  mojaNazwa: string,
  drugiId: string,
  tresc: string,
): Promise<DmWiadomosc> {
  const safe = tresc.trim().slice(0, 1000);
  if (!safe) throw new Error('Wiadomość nie może być pusta.');
  const { low, high } = paraRozmowy(mojId, drugiId);

  // Przez `zPonowieniemPoOdswiezeniu`, jak `addComment`: ekran rozmowy bywa
  // otwarty godzinami, a wygasły token zamieniłby wysyłkę w komunikat
  // o polityce RLS, z którym piszący nie ma nic wspólnego.
  return zPonowieniemPoOdswiezeniu(async () => {
    // Rozmowa powstaje przy pierwszej wiadomości. `ignoreDuplicates`, bo obie
    // strony mogą napisać niemal równocześnie — bez tego przegrany wyścig
    // dostaje błąd unikalności zamiast wysłać tekst.
    const { error: e1 } = await supabase
      .from('dm_conversations')
      .upsert({ low_user_id: low, high_user_id: high },
        { onConflict: 'low_user_id,high_user_id', ignoreDuplicates: true });
    if (e1) throw new Error(bladPoLudzku(e1.message));

    const { data, error } = await supabase
      .from('dm_messages')
      .insert({ low_user_id: low, high_user_id: high, sender_id: mojId, sender_name: mojaNazwa, content: safe })
      .select('id, sender_id, sender_name, content, created_at')
      .single();
    if (error) throw new Error(bladPoLudzku(error.message));
    return toWiadomosc(data);
  });
}

/** Odbicie przez politykę blokady wraca jako surowy komunikat o RLS — a to
 *  jedyny przypadek, w którym użytkownik MUSI zrozumieć, dlaczego wiadomość nie
 *  poszła. Reszta błędów zostaje bez tłumaczenia, żeby nie zgadywać przyczyny. */
function bladPoLudzku(komunikat: string): string {
  return /row-level security|violates row-level/i.test(komunikat)
    ? 'Nie można wysłać wiadomości do tej osoby.'
    : komunikat;
}

/** Miękkie kasowanie własnej wiadomości — jak `deleteComment`: przez
 *  `zaktualizujJedenWiersz`, bo niepasująca polityka RLS dałaby zero zmienionych
 *  wierszy i „sukces". */
export async function usunDm(wiadomoscId: string): Promise<void> {
  await zPonowieniemPoOdswiezeniu(() => zaktualizujJedenWiersz(
    'dm_messages',
    wiadomoscId,
    { deleted_at: new Date().toISOString() },
    'Nie udało się usunąć wiadomości',
  ));
}

/** Blokada jest kierunkowa w zapisie, ale obowiązuje w OBIE strony przy
 *  pisaniu (`czy_zablokowani()` w migracji `125`). */
export async function zablokuj(mojId: string, drugiId: string): Promise<void> {
  const { error } = await supabase
    .from('user_blocks')
    .upsert({ blocker_id: mojId, blocked_id: drugiId },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function odblokuj(mojId: string, drugiId: string): Promise<void> {
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', mojId)
    .eq('blocked_id', drugiId);
  if (error) throw new Error(error.message);
}

/** Czy JA zablokowałem tę osobę. Odwrotnego kierunku nie da się sprawdzić
 *  i to jest celowe — polityka `user_blocks_select` pokazuje wyłącznie własne
 *  blokady, żeby nie dało się wykryć, że ktoś nas zablokował. */
export async function czyZablokowalem(mojId: string, drugiId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', mojId)
    .eq('blocked_id', drugiId)
    .maybeSingle();
  return !!data;
}

export async function zglos(mojId: string, drugiId: string, powod: string): Promise<void> {
  const safe = powod.trim().slice(0, 500);
  if (!safe) throw new Error('Napisz, co jest nie tak.');
  const { error } = await supabase
    .from('user_reports')
    .insert({ reporter_id: mojId, reported_id: drugiId, powod: safe });
  if (error) throw new Error(error.message);
}

/**
 * Lista rozmów prywatnych zalogowanego, w kształcie `RozmowaNaLiscie` —
 * `/rozmowy` łączy ją z rozmowami meczów i ekip.
 *
 * BEZ FILTRU PO PARACH. Kuszące jest zbudowanie `.or(...)` z listy własnych
 * rozmów, ale taki filtr rośnie liniowo z ich liczbą i ląduje w URL-u zapytania
 * — przy kilkudziesięciu rozmowach uderza w limit długości adresu i zapytanie
 * po prostu przestaje działać. RLS na `dm_messages` i tak przepuszcza wyłącznie
 * moje rozmowy, więc filtr po stronie klienta niczego nie zawęża, a psuje.
 */
export async function wszystkieRozmowyDm(userId: string): Promise<RozmowaNaLiscie[]> {
  const { data: wiersze, error } = await supabase
    .from('dm_messages')
    .select('low_user_id, high_user_id, sender_id, sender_name, content, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wiadomosci = (wiersze ?? []) as any[];
  if (wiadomosci.length === 0) return [];

  // Zapytanie jest posortowane malejąco, więc PIERWSZA napotkana wiadomość
  // pary jest jej ostatnią (ten sam chwyt co w `wszystkieRozmowyMeczow`).
  const poParze = new Map<string, { ostatnia: (typeof wiadomosci)[number]; wszystkie: (typeof wiadomosci)[number][] }>();
  for (const w of wiadomosci) {
    const klucz = `${w.low_user_id}:${w.high_user_id}`;
    const wpis = poParze.get(klucz) ?? { ostatnia: w, wszystkie: [] };
    wpis.wszystkie.push(w);
    poParze.set(klucz, wpis);
  }

  const drugieIds = Array.from(poParze.keys())
    .map((k) => { const [low, high] = k.split(':'); return low === userId ? high : low; });

  // Nazwa drugiej strony z profilu, nie z `sender_name` przy wiadomości —
  // tamta jest zapisana na sztywno w chwili wysyłki i po zmianie imienia
  // pokazywałaby nieaktualne.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', drugieIds);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nazwy = new Map(((profile ?? []) as any[])
    .map((p) => [p.id as string, (p.display_name as string | null) ?? 'Gracz']));

  return Array.from(poParze.entries())
    .map(([klucz, { ostatnia, wszystkie }]) => {
      const [low, high] = klucz.split(':');
      const drugiId = low === userId ? high : low;
      const widziano = typeof window !== 'undefined'
        ? window.localStorage.getItem(kluczDmWidziano(userId, drugiId))
        : null;
      return {
        id: drugiId,
        tytul: nazwy.get(drugiId) ?? (ostatnia.sender_name as string) ?? 'Gracz',
        ile: nieprzeczytaneKomentarze(
          wszystkie.map((w) => ({ userId: w.sender_id as string, createdAt: w.created_at as string })),
          widziano,
          userId,
        ),
        najnowsza: ostatnia.created_at as string,
        ostatnia: (ostatnia.content as string | null)?.replace(/\s+/g, ' ').trim() ?? '',
        autor: (ostatnia.sender_name as string | null) ?? 'Ktoś',
        moja: ostatnia.sender_id === userId,
      };
    })
    .sort((a, b) => b.najnowsza.localeCompare(a.najnowsza));
}
