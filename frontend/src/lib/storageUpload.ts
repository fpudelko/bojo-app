// Wspólna walidacja i upload obrazków do Storage — wydzielone z
// `components/ui/CoverUpload.tsx`, żeby galeria i logotypy sponsorów
// turnieju nie kopiowały tej samej walidacji trzeci i czwarty raz.
// `CoverUpload.tsx` zostaje na swoim wzorcu (nadpisywanie w miejscu z
// cache-bustingiem) — nie jest tu refaktoryzowany, żeby nie poszerzać PR-a
// bez potrzeby.
import { supabase } from './supabase';

const MAKS_ROZMIAR = 5 * 1024 * 1024;

export interface WynikUploadu {
  url: string;
  sciezka: string;
}

/** Waliduje (≤5 MB, `image/*`) i wgrywa plik pod wskazaną ścieżkę w podanym
 *  buckecie. Rzuca z czytelnym komunikatem PL przy odrzuceniu, zanim
 *  cokolwiek poleci do sieci. */
export async function uploadObrazek(bucket: string, sciezka: string, plik: File): Promise<WynikUploadu> {
  if (plik.size > MAKS_ROZMIAR) throw new Error('Maksymalny rozmiar: 5 MB');
  if (!plik.type.startsWith('image/')) throw new Error('Tylko pliki graficzne');

  const { error } = await supabase.storage
    .from(bucket)
    .upload(sciezka, plik, { upsert: false, contentType: plik.type });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(sciezka);
  return { url: data.publicUrl, sciezka };
}

export async function usunObrazek(bucket: string, sciezka: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([sciezka]);
  if (error) throw new Error(error.message);
}
