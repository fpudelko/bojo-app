// Wspólna walidacja i upload obrazków do Cloudflare R2 — wydzielone z
// `components/ui/CoverUpload.tsx`, żeby galeria i logotypy sponsorów
// turnieju nie kopiowały tej samej walidacji trzeci i czwarty raz.
// `CoverUpload.tsx` zostaje na swoim wzorcu (Supabase Storage, bucket
// `covers`) — nie jest tu refaktoryzowany, żeby nie poszerzać PR-a bez
// potrzeby. Decyzja właściciela 2026-09-23: galeria/sponsorzy turnieju idą
// na R2, nie na Supabase Storage — patrz docs/domena.md#turniej-media-cloudflare-r2.
//
// Serwer (`/api/turniej-media/*`) tylko WYSTAWIA podpisany URL po
// sprawdzeniu `czy_zarzadza_turniejem()` — sam plik leci z przeglądarki
// PROSTO do R2, nie przez Vercel (unika limitu rozmiaru requestu funkcji
// serwerowej i nie liczy się do jej czasu wykonania).
import { supabase } from './supabase';

const MAKS_ROZMIAR = 5 * 1024 * 1024;

export interface WynikUploadu {
  url: string;
  sciezka: string;
}

function publicznyAdres(sciezka: string): string {
  const baza = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!baza) {
    console.warn('[storageUpload] NEXT_PUBLIC_R2_PUBLIC_URL nie jest ustawione.');
    return sciezka;
  }
  return `${baza.replace(/\/$/, '')}/${sciezka}`;
}

/** Waliduje (≤5 MB, `image/*`) i wgrywa plik pod wskazaną ścieżkę. Rzuca
 *  z czytelnym komunikatem PL przy odrzuceniu, zanim cokolwiek poleci do
 *  sieci. Ścieżka musi mieć kształt `turnieje/<turniej_id>/...` — tyle
 *  wystarczy serwerowi do sprawdzenia uprawnień, patrz `_wspolne.ts`. */
export async function uploadObrazek(sciezka: string, plik: File): Promise<WynikUploadu> {
  if (plik.size > MAKS_ROZMIAR) throw new Error('Maksymalny rozmiar: 5 MB');
  if (!plik.type.startsWith('image/')) throw new Error('Tylko pliki graficzne');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Zaloguj się ponownie, sesja wygasła.');

  const wynik = await fetch('/api/turniej-media/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ sciezka, typ: plik.type }),
  });
  if (!wynik.ok) {
    const blad = await wynik.json().catch(() => null);
    throw new Error(blad?.error ?? 'Nie udało się przygotować uploadu');
  }
  const { uploadUrl } = await wynik.json() as { uploadUrl: string };

  const wgranie = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': plik.type },
    body: plik,
  });
  if (!wgranie.ok) throw new Error('Nie udało się wgrać pliku');

  return { url: publicznyAdres(sciezka), sciezka };
}

export async function usunObrazek(sciezka: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Zaloguj się ponownie, sesja wygasła.');

  const wynik = await fetch('/api/turniej-media/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ sciezka }),
  });
  if (!wynik.ok) {
    const blad = await wynik.json().catch(() => null);
    throw new Error(blad?.error ?? 'Nie udało się usunąć pliku');
  }
}
