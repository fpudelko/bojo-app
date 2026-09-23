// Galeria zdjęć i sponsorzy turnieju (migracja `159`, storage: Cloudflare R2
// od 2026-09-23 — patrz docs/domena.md#turniej-media-cloudflare-r2).
// Publiczne — czyta każdy, dokłada wyłącznie zarządzający turniejem (jak
// `turniejMecze.ts` i ogłoszenia w `turnieje.ts`). Baza trzyma ścieżkę,
// `url` liczy się tu przy odczycie.
import { supabase } from './supabase';
import { zaktualizujJedenWiersz } from './zapytania';
import { uploadObrazek, usunObrazek } from './storageUpload';
import type { TurniejZdjecie, TurniejSponsor } from '@/types';

function publicUrl(sciezka: string): string {
  const baza = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!baza) {
    console.warn('[turniejGaleria] NEXT_PUBLIC_R2_PUBLIC_URL nie jest ustawione.');
    return sciezka;
  }
  return `${baza.replace(/\/$/, '')}/${sciezka}`;
}

function rozszerzenie(plik: File): string {
  const dopasowanie = /\.([a-zA-Z0-9]+)$/.exec(plik.name);
  return dopasowanie ? dopasowanie[1].toLowerCase() : 'jpg';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toZdjecie(row: any): TurniejZdjecie {
  return {
    id: row.id,
    turniejId: row.turniej_id,
    url: publicUrl(row.sciezka),
    kolejnosc: row.kolejnosc,
    dodanePrzez: row.dodane_przez ?? undefined,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSponsor(row: any): TurniejSponsor {
  return {
    id: row.id,
    turniejId: row.turniej_id,
    nazwa: row.nazwa,
    logoUrl: row.sciezka_logo ? publicUrl(row.sciezka_logo) : undefined,
    link: row.link ?? undefined,
    kolejnosc: row.kolejnosc,
    createdAt: row.created_at,
  };
}

/** CZYSTA. Normalizuje link sponsora: puste → `null`, brak schematu →
 *  dopisuje `https://`. Rzuca, gdy schemat nie jest http/https — link wpisuje
 *  organizator, a wyświetla się KAŻDEMU, więc `javascript:` byłby wstrzyknięciem
 *  skryptu na publicznej stronie turnieju. */
export function normalizujLinkSponsora(link: string): string | null {
  const surowy = link.trim();
  if (!surowy) return null;
  const zeSchematem = /^[a-z][a-z0-9+.-]*:/i.test(surowy) ? surowy : `https://${surowy}`;
  let url: URL;
  try {
    url = new URL(zeSchematem);
  } catch {
    throw new Error('To nie wygląda na adres strony.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Link musi prowadzić do strony (http:// albo https://).');
  }
  return url.toString();
}

/** CZYSTA. To samo co wyżej, ale na wyświetlanie: zły link znika zamiast
 *  wywracać stronę. Druga linia obrony — wiersz mógł trafić do bazy z
 *  pominięciem aplikacji (RLS wpuszcza organizatora, nie sprawdza treści). */
export function bezpiecznyLinkSponsora(link?: string): string | undefined {
  if (!link) return undefined;
  try {
    return normalizujLinkSponsora(link) ?? undefined;
  } catch {
    return undefined;
  }
}

/** CZYSTA. Kolejność do wyświetlenia — po `kolejnosc`, potem po `createdAt`
 *  jako tie-break (nowo dodane bez ustawionej kolejności trafiają na koniec
 *  w kolejności dodania, nie losowo). */
export function posortujPoKolejnosci<T extends { kolejnosc: number; createdAt: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => a.kolejnosc - b.kolejnosc || a.createdAt.localeCompare(b.createdAt));
}

// ---------------------------------------------------------------------------
// Zdjęcia
// ---------------------------------------------------------------------------

export async function getZdjecia(turniejId: string): Promise<TurniejZdjecie[]> {
  const { data, error } = await supabase.from('turniej_zdjecia').select('*').eq('turniej_id', turniejId);
  if (error) throw new Error(error.message);
  return posortujPoKolejnosci((data ?? []).map(toZdjecie));
}

export async function dodajZdjecie(turniejId: string, plik: File, userId: string): Promise<TurniejZdjecie> {
  const { data: ostatnie, error: eOstatnie } = await supabase
    .from('turniej_zdjecia')
    .select('kolejnosc')
    .eq('turniej_id', turniejId)
    .order('kolejnosc', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eOstatnie) throw new Error(eOstatnie.message);
  const kolejnosc = (ostatnie?.kolejnosc ?? -1) + 1;

  const sciezka = `turnieje/${turniejId}/galeria/${crypto.randomUUID()}.${rozszerzenie(plik)}`;
  await uploadObrazek(sciezka, plik);

  const { data, error } = await supabase
    .from('turniej_zdjecia')
    .insert({ turniej_id: turniejId, sciezka, kolejnosc, dodane_przez: userId })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return toZdjecie(data);
}

/** Kasuje wiersz ORAZ obiekt w Storage — w tej kolejności: najpierw Storage,
 *  potem wiersz. Odwrotna kolejność zostawiałaby osierocony plik w buckecie,
 *  gdyby DELETE wiersza się nie udał — plik bez wiersza jest tylko martwym
 *  bajtem, wiersz bez pliku jest zepsutym `<img>`. */
export async function usunZdjecie(zdjecie: Pick<TurniejZdjecie, 'id'>): Promise<void> {
  const { data, error: eSciezka } = await supabase
    .from('turniej_zdjecia')
    .select('sciezka')
    .eq('id', zdjecie.id)
    .single();
  if (eSciezka) throw new Error(eSciezka.message);

  await usunObrazek(data.sciezka);

  const { error } = await supabase.from('turniej_zdjecia').delete().eq('id', zdjecie.id);
  if (error) throw new Error(error.message);
}

/** Zamienia `kolejnosc` z sąsiadem — dwa UPDATE-y, nie przeliczanie całej
 *  listy. Cisza (sąsiad nie istnieje, bo zdjęcie jest już na krawędzi listy)
 *  jest tu wynikiem poprawnym, nie błędem. */
export async function przesunZdjecie(id: string, kierunek: 'gora' | 'dol'): Promise<void> {
  const { data: biezace, error: eBiezace } = await supabase
    .from('turniej_zdjecia')
    .select('turniej_id, kolejnosc')
    .eq('id', id)
    .single();
  if (eBiezace) throw new Error(eBiezace.message);

  const zapytanie = supabase
    .from('turniej_zdjecia')
    .select('id, kolejnosc')
    .eq('turniej_id', biezace.turniej_id);

  const { data: sasiad, error: eSasiad } = kierunek === 'gora'
    ? await zapytanie.lt('kolejnosc', biezace.kolejnosc).order('kolejnosc', { ascending: false }).limit(1).maybeSingle()
    : await zapytanie.gt('kolejnosc', biezace.kolejnosc).order('kolejnosc', { ascending: true }).limit(1).maybeSingle();
  if (eSasiad) throw new Error(eSasiad.message);
  if (!sasiad) return;

  await Promise.all([
    zaktualizujJedenWiersz('turniej_zdjecia', id, { kolejnosc: sasiad.kolejnosc }, 'Nie udało się zmienić kolejności'),
    zaktualizujJedenWiersz('turniej_zdjecia', sasiad.id, { kolejnosc: biezace.kolejnosc }, 'Nie udało się zmienić kolejności'),
  ]);
}

// ---------------------------------------------------------------------------
// Sponsorzy
// ---------------------------------------------------------------------------

export async function getSponsorzy(turniejId: string): Promise<TurniejSponsor[]> {
  const { data, error } = await supabase.from('turniej_sponsorzy').select('*').eq('turniej_id', turniejId);
  if (error) throw new Error(error.message);
  return posortujPoKolejnosci((data ?? []).map(toSponsor));
}

export async function dodajSponsora(turniejId: string, dane: { nazwa: string; link?: string }): Promise<string> {
  const nazwa = dane.nazwa.trim();
  if (!nazwa) throw new Error('Nazwa sponsora nie może być pusta.');
  const { data, error } = await supabase
    .from('turniej_sponsorzy')
    .insert({ turniej_id: turniejId, nazwa, link: normalizujLinkSponsora(dane.link ?? '') })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** `null` = usuń logo, zostaw sponsora jako sam tekst. Nowe logo wgrywa się
 *  PRZED skasowaniem starego — sponsor nie zostaje bez logo w oknie między
 *  dwoma operacjami, gdyby coś poszło nie tak w połowie. */
export async function ustawLogoSponsora(sponsorId: string, plik: File | null): Promise<void> {
  const { data, error: eObecny } = await supabase
    .from('turniej_sponsorzy')
    .select('turniej_id, sciezka_logo')
    .eq('id', sponsorId)
    .single();
  if (eObecny) throw new Error(eObecny.message);
  const staraSciezka = data.sciezka_logo as string | null;

  if (!plik) {
    await zaktualizujJedenWiersz('turniej_sponsorzy', sponsorId, { sciezka_logo: null }, 'Nie udało się usunąć logo sponsora');
    if (staraSciezka) await usunObrazek(staraSciezka).catch(() => {});
    return;
  }

  const nowaSciezka = `turnieje/${data.turniej_id}/sponsorzy/${crypto.randomUUID()}.${rozszerzenie(plik)}`;
  await uploadObrazek(nowaSciezka, plik);
  await zaktualizujJedenWiersz('turniej_sponsorzy', sponsorId, { sciezka_logo: nowaSciezka }, 'Nie udało się zapisać logo sponsora');
  if (staraSciezka) await usunObrazek(staraSciezka).catch(() => {});
}

export async function aktualizujSponsora(id: string, dane: { nazwa?: string; link?: string }): Promise<void> {
  const zmiany: Record<string, unknown> = {};
  if (dane.nazwa !== undefined) {
    const nazwa = dane.nazwa.trim();
    if (!nazwa) throw new Error('Nazwa sponsora nie może być pusta.');
    zmiany.nazwa = nazwa;
  }
  if (dane.link !== undefined) zmiany.link = normalizujLinkSponsora(dane.link);
  if (Object.keys(zmiany).length === 0) return;
  await zaktualizujJedenWiersz('turniej_sponsorzy', id, zmiany, 'Nie udało się zapisać zmian sponsora');
}

export async function usunSponsora(sponsor: Pick<TurniejSponsor, 'id' | 'logoUrl'>): Promise<void> {
  if (sponsor.logoUrl) {
    const { data, error: eSciezka } = await supabase
      .from('turniej_sponsorzy')
      .select('sciezka_logo')
      .eq('id', sponsor.id)
      .single();
    if (eSciezka) throw new Error(eSciezka.message);
    if (data.sciezka_logo) await usunObrazek(data.sciezka_logo);
  }

  const { error } = await supabase.from('turniej_sponsorzy').delete().eq('id', sponsor.id);
  if (error) throw new Error(error.message);
}
