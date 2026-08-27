/**
 * Miejscowość jako punkt odniesienia filtra „miejscowość + ile km".
 *
 * DLACZEGO NIE `fields.city`. Filtr po nazwie miasta w bazie już raz
 * odpadł: zrzut z produkcji pokazał, że kolumna jest wypełniona w jakichś
 * dwóch procentach (38 314 obiektów w katalogu, wszystkie największe miasta
 * razem ~900). Filtr stojący na tej kolumnie nie tyle „pokazuje mniej", co
 * KŁAMIE — mówi „w Poznaniu jest 54 boiska", gdy jest ich kilkaset.
 *
 * Ten filtr działa inaczej i dlatego działa: miejscowość służy wyłącznie do
 * wyznaczenia PUNKTU (lat/lng), a dobór idzie po odległości. `lat`/`lng` ma
 * każdy obiekt w katalogu i każdy mecz, więc wynik nie zależy od backfillu
 * lokalizacji.
 *
 * Punkt bierzemy z Nominatima przez własne proxy (`/api/geocode`) — to samo,
 * którego używają pickery lokalizacji. Nic nowego do utrzymania.
 */

export type Miejscowosc = {
  nazwa: string;
  /** Jedna linijka kontekstu — powiat i województwo. Samych „Nowa Wieś" jest
   *  w Polsce kilkadziesiąt i bez tego nie da się wybrać właściwej. */
  kontekst: string;
  lat: number;
  lng: number;
};

/** Promienie do wyboru, w kilometrach. */
export const PROMIENIE_KM = [5, 10, 25, 50] as const;
export const PROMIEN_DOMYSLNY_KM = 10;

/** Czy fraza wygląda na polski kod pocztowy (`61-001`, też bez myślnika). */
export function toKodPocztowy(fraza: string): boolean {
  return /^\d{2}-?\d{3}$/.test(fraza.trim());
}

/**
 * Podpowiedzi miejscowości. Zwraca pustą listę zamiast rzucać — pole
 * podpowiedzi, które wywala ekran błędem, jest gorsze niż pole bez podpowiedzi.
 */
export async function szukajMiejscowosci(fraza: string, sygnal?: AbortSignal): Promise<Miejscowosc[]> {
  const q = fraza.trim();
  // Dwa znaki dla nazw, ale kod pocztowy ma sens dopiero w całości — przy
  // trzech cyfrach Nominatim odpowiada losowym miejscem w Polsce.
  if (q.length < 2) return [];
  if (/^\d/.test(q) && !toKodPocztowy(q)) return [];
  try {
    const res = await fetch(`/api/geocode?miejscowosc=${encodeURIComponent(q)}`, { signal: sygnal });
    if (!res.ok) return [];
    const dane = await res.json();
    if (!Array.isArray(dane)) return [];
    return dane.filter(
      (m): m is Miejscowosc =>
        typeof m?.nazwa === 'string' && Number.isFinite(m?.lat) && Number.isFinite(m?.lng),
    );
  } catch {
    return [];
  }
}
