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

/**
 * Skala suwaka odległości — NARASTAJĄCA, nie liniowa (2026-09-14, zgłoszone
 * wprost: „zakres 1-100 km, ale z narastającą podziałką, żeby nie było, że
 * w połowie 50, tylko 50 blisko prawej").
 *
 * Powód jest taki, że kilometry nie są równo ważne. Różnica między 2 a 3 km
 * decyduje, czy idzie się pieszo; między 80 a 90 km nie znaczy nic, bo nikt
 * nie jedzie na orlik dwie godziny. Liniowy suwak 1–100 oddawał pierwszej
 * dziesiątce — czyli całemu realnemu zakresowi decyzji — jedną dziesiątą
 * długości, a resztę na wartości, których nikt nie wybiera.
 *
 * Suwak chodzi więc po INDEKSIE tej tablicy, nie po kilometrach: gęsto na
 * dole, rzadko na górze. 50 km wypada na jedenastej z piętnastu pozycji,
 * czyli wyraźnie po prawej.
 *
 * Poprzednie wartości (5/10/25/50 jako cztery pigułki) mieszczą się w tej
 * skali co do jednej, więc zapisany filtr sprzed zmiany trafia w istniejący
 * przystanek, a nie między dwa.
 */
export const PROMIENIE_SUWAK_KM = [
  1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50, 65, 80, 100,
] as const;

export const PROMIEN_DOMYSLNY_KM = 10;

/**
 * Kilometry → pozycja na suwaku. Wartość spoza skali (z adresu URL albo
 * ze starego zapisanego filtra) ląduje na NAJBLIŻSZYM przystanku zamiast
 * przewracać suwak na `-1`, czyli na sam lewy skraj.
 *
 * REMIS IDZIE W DÓŁ: 6 km leży dokładnie między 5 a 7, a wtedy wybieramy 5.
 * Filtr ma nie poszerzać się sam — ktoś, kto miał w linku 6 km, dostanie
 * węższy wynik, a nie mecze, o które nie prosił.
 */
export function indeksPromienia(km: number): number {
  let najlepszy = 0;
  let najmniejszaRoznica = Infinity;
  PROMIENIE_SUWAK_KM.forEach((wartosc, i) => {
    const roznica = Math.abs(wartosc - km);
    if (roznica < najmniejszaRoznica) {
      najmniejszaRoznica = roznica;
      najlepszy = i;
    }
  });
  return najlepszy;
}

/** Pozycja na suwaku → kilometry. Poza zakresem przycina do skrajów. */
export function promienZIndeksu(i: number): number {
  const bezpieczny = Math.min(Math.max(i, 0), PROMIENIE_SUWAK_KM.length - 1);
  return PROMIENIE_SUWAK_KM[bezpieczny];
}

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

/**
 * Nominatim potrafi zwrócić tę samą miejscowość dwa razy — różne obiekty OSM
 * (węzeł administracyjny i punkt osady) trafiające na tę samą nazwę i okolicę
 * stają się nierozróżnialne po odrzuceniu adresu. Podpowiedzi pokazywały
 * wtedy dwa identyczne wiersze pod sobą. Zgłoszone wprost z sesji QA.
 * Używane w serwerowym proxy (`/api/geocode`), nie tutaj — `route.ts` nie
 * może eksportować nic poza uznanymi nazwami handlerów HTTP.
 *
 * Klucz to nazwa+kontekst (nie współrzędne — to samo miejsce z dwóch węzłów
 * OSM bywa przesunięte o kilkadziesiąt metrów), pierwsze trafienie wygrywa —
 * Nominatim sortuje wyniki wg trafności.
 */
export function odsiejDuplikatyMiejscowosci<T extends { nazwa: string; kontekst: string }>(wpisy: T[]): T[] {
  const widziane = new Set<string>();
  return wpisy.filter((w) => {
    const klucz = `${w.nazwa.toLowerCase()}|${w.kontekst.toLowerCase()}`;
    if (widziane.has(klucz)) return false;
    widziane.add(klucz);
    return true;
  });
}
