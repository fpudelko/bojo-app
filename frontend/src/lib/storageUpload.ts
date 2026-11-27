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
// serwerowej i nie liczy się do jej czasu wykonania). Gdy przeglądarka to
// zablokuje (brak CORS na buckecie), plik idzie zapasowo przez
// `/api/turniej-media/upload` (2026-11-27).
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

  // Najpierw wprost do R2. „Failed to fetch” (TypeError) to zablokowane przez
  // przeglądarkę żądanie, zwykle brak reguły CORS na buckecie: wtedy zapasowo
  // przez nasz serwer (`/api/turniej-media/upload`, 2026-11-27).
  try {
    const wgranie = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': plik.type },
      body: plik,
    });
    if (wgranie.ok) return { url: publicznyAdres(sciezka), sciezka };
  } catch {
    /* zablokowane przez przeglądarkę: droga zapasowa niżej */
  }

  const doWyslania = await zmniejszObrazek(plik);
  const przezSerwer = await fetch('/api/turniej-media/upload', {
    method: 'POST',
    headers: { 'Content-Type': doWyslania.type, 'x-sciezka': sciezka, Authorization: `Bearer ${session.access_token}` },
    body: doWyslania,
  });
  if (!przezSerwer.ok) {
    const blad = await przezSerwer.json().catch(() => null);
    throw new Error(blad?.error ?? 'Nie udało się wgrać pliku');
  }
  return { url: publicznyAdres(sciezka), sciezka };
}

/** Limit treści żądania funkcji Vercela to 4,5 MB: większe zdjęcie
 *  zmniejszamy w przeglądarce (dłuższy bok do 2000 px). PNG zostaje PNG
 *  (przezroczyste tło logotypów), reszta idzie jako JPEG. */
const PROG_ZMNIEJSZANIA = 3.5 * 1024 * 1024;
async function zmniejszObrazek(plik: File): Promise<Blob> {
  if (plik.size <= PROG_ZMNIEJSZANIA || typeof createImageBitmap === 'undefined') return plik;
  try {
    const bitmapa = await createImageBitmap(plik);
    const skala = Math.min(1, 2000 / Math.max(bitmapa.width, bitmapa.height));
    const plotno = document.createElement('canvas');
    plotno.width = Math.round(bitmapa.width * skala);
    plotno.height = Math.round(bitmapa.height * skala);
    plotno.getContext('2d')?.drawImage(bitmapa, 0, 0, plotno.width, plotno.height);
    const typ = plik.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((ok) => plotno.toBlob(ok, typ, 0.85));
    return blob ?? plik;
  } catch {
    return plik;
  }
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
