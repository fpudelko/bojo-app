import { supabase } from './supabase';

/**
 * Zgłaszanie błędów — od użytkownika i automatyczne z awarii.
 *
 * DLACZEGO W OGÓLE: do tej pory awaria u użytkownika nie zostawiała żadnego
 * śladu. `app/error.tsx` wypisywał błąd do konsoli przeglądarki, której nikt
 * nie ogląda, a zgłoszenie „coś mi wywaliło" przychodziło zrzutem ekranu bez
 * adresu strony, wersji i treści błędu — czyli w formie droższej do
 * odtworzenia niż sama naprawa.
 *
 * ZASADY, które sprawiają, że to nie zamieni się w śmietnik:
 *
 *  1. GRUPOWANIE po odcisku (komunikat + pierwsza ramka stosu). Jeden zepsuty
 *     widok potrafi wygenerować setki błędów w minutę; baza dokłada je do
 *     jednego wiersza z licznikiem, zamiast tworzyć setki kopii.
 *  2. RAZ NA SESJĘ na odcisk. Pętla renderowania w Reakcie potrafi rzucić ten
 *     sam błąd kilkadziesiąt razy na sekundę — bez tej blokady wysyłalibyśmy
 *     kilkadziesiąt żądań sieciowych z tego samego miejsca.
 *  3. TWARDY LIMIT na sesję. Zabezpieczenie przed przypadkiem, w którym każdy
 *     błąd ma inny odcisk (np. komunikat z licznikiem albo losowym id).
 *  4. ZGŁOSZENIE NIGDY NIE WYWRACA APLIKACJI. Cały zapis siedzi w `try/catch`
 *     kończącym się ciszą: awaria mechanizmu raportowania awarii nie może być
 *     kolejną awarią widoczną dla użytkownika.
 */

/** Ile różnych błędów wysyłamy z jednej sesji, zanim przestaniemy. */
const LIMIT_NA_SESJE = 10;

const wyslane = new Set<string>();
let ileWyslano = 0;

/**
 * Skrót „to jest ten sam błąd".
 *
 * Komunikat plus PIERWSZA ramka stosu. Sam komunikat grupuje za mocno
 * („Failed to fetch" z pięciu różnych miejsc to pięć różnych problemów),
 * a cały stos za słabo — różni się między przeglądarkami i wersjami paczek,
 * więc ten sam błąd rozjeżdżałby się na kilka wierszy.
 */
export function odcisk(komunikat: string, stos?: string): string {
  const pierwszaRamka = (stos ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('at ') || l.includes('@')) ?? '';
  // Adresy z hashem builda (`/_next/static/chunks/abc123.js`) zmieniają się
  // przy każdym wdrożeniu — bez ich zdjęcia ten sam błąd zakładałby nowy
  // wiersz po każdym deployu.
  const bezHashy = pierwszaRamka.replace(/[0-9a-f]{8,}/gi, '*').replace(/:\d+:\d+/g, '');
  return `${komunikat.slice(0, 200)}|${bezHashy.slice(0, 200)}`;
}

function kontekst() {
  if (typeof window === 'undefined') return { adres: null, przegladarka: null };
  return {
    adres: window.location.href.slice(0, 500),
    przegladarka: navigator.userAgent.slice(0, 300),
  };
}

/** Wersja aplikacji — Vercel wystawia skrót commita jako zmienną build-time. */
const WERSJA = process.env.NEXT_PUBLIC_WERSJA
  ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
  ?? 'dev';

/**
 * Zgłasza awarię. Wołane z globalnych pułapek i z ekranów błędu —
 * NIE z normalnej obsługi błędów (od tego są chmurki z komunikatem).
 */
export async function zglosAwarie(blad: unknown, dodatkowy?: string): Promise<void> {
  try {
    const komunikat = blad instanceof Error
      ? blad.message
      : typeof blad === 'string' ? blad : JSON.stringify(blad);
    const stos = blad instanceof Error ? blad.stack : undefined;
    const klucz = odcisk(komunikat, stos);

    if (wyslane.has(klucz)) return;
    if (ileWyslano >= LIMIT_NA_SESJE) return;
    wyslane.add(klucz);
    ileWyslano += 1;

    await supabase.rpc('zapisz_zgloszenie_bledu', {
      p_rodzaj: 'awaria',
      p_opis: dodatkowy ? `${komunikat} — ${dodatkowy}` : komunikat,
      p_odcisk: klucz,
      p_slad: stos ?? null,
      p_adres: kontekst().adres,
      p_przegladarka: kontekst().przegladarka,
      p_wersja: WERSJA,
      p_field_id: null,
    });
  } catch {
    // Cisza świadomie — patrz zasada 4 w nagłówku pliku.
  }
}

/**
 * Zgłoszenie napisane przez człowieka. W przeciwieństwie do awarii NIE jest
 * grupowane i nie podlega limitowi: jeśli ktoś zadał sobie trud napisania
 * czegoś, to chcemy to dostać.
 */
export async function zglosUwage(opis: string): Promise<void> {
  const tresc = opis.trim();
  if (!tresc) throw new Error('Napisz, co się stało');

  const { error } = await supabase.rpc('zapisz_zgloszenie_bledu', {
    p_rodzaj: 'uzytkownik',
    p_opis: tresc,
    p_odcisk: null,
    p_slad: null,
    p_adres: kontekst().adres,
    p_przegladarka: kontekst().przegladarka,
    p_wersja: WERSJA,
    p_field_id: null,
  });
  if (error) throw new Error(error.message);
}

/** Powody błędu w danych obiektu — lista zamknięta, bo pole tekstowe daje
 *  „nie wiem", a te pięć pozycji pokrywa wszystko, co realnie zgłaszają ludzie.
 *  Kolejność od najczęstszego do najcięższego. */
export const POWODY_OBIEKTU = [
  'Zła nazwa lub adres',
  'Zły sport albo nawierzchnia',
  'Nie ma bramek / koszy / siatki',
  'Obiekt jest zamknięty lub niedostępny',
  'Tego obiektu tu nie ma',
] as const;

export type PowodObiektu = typeof POWODY_OBIEKTU[number];

/**
 * Zgłoszenie błędu w danych boiska.
 *
 * ŚWIADOMIE NIE ZMIENIA DANYCH. Katalog pochodzi z OpenStreetMap (licencja
 * ODbL) i nie jesteśmy jego właścicielem — automatyczna poprawka po jednym
 * zgłoszeniu to zaproszenie do psucia mapy. Zgłoszenie trafia do panelu
 * administratora, a naprawa u ŹRÓDŁA idzie osobnym przyciskiem („Zgłoś
 * poprawkę" → notatka w OSM), który na stronie obiektu już jest.
 */
export async function zglosBladObiektu(
  fieldId: string,
  powod: PowodObiektu,
  komentarz?: string,
): Promise<void> {
  const opis = komentarz?.trim() ? `${powod} — ${komentarz.trim()}` : powod;

  const { error } = await supabase.rpc('zapisz_zgloszenie_bledu', {
    p_rodzaj: 'obiekt',
    p_opis: opis,
    p_odcisk: null,
    p_slad: null,
    p_adres: kontekst().adres,
    p_przegladarka: kontekst().przegladarka,
    p_wersja: WERSJA,
    p_field_id: fieldId,
  });
  if (error) throw new Error(error.message);
}

/** Tylko do testów — sesja żyje tak długo jak karta przeglądarki. */
export function wyczyscPamiecSesji(): void {
  wyslane.clear();
  ileWyslano = 0;
}
