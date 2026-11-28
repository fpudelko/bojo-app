// Zapasowa ścieżka powrotu po zalogowaniu.
//
// Normalnie cel podróży jedzie w `?next=` aż do `/auth/callback`, który po
// zalogowaniu robi `router.replace(next)`. Ta droga bywa jednak przerwana poza
// naszym kodem: gdy adres przekierowania nie jest na liście dozwolonych w
// Supabase (Authentication → URL Configuration), Supabase **po cichu** odrzuca
// `redirectTo` i odsyła na Site URL — czyli na stronę główną, bez ścieżki
// i bez parametru. Dokładnie to zgłosił użytkownik przejmujący wpis gościa:
// „obiecuje, że po zalogowaniu tu wrócę, a przenosi na bojo.pl/#".
//
// Ten sam mechanizm jest już w repo opisany przy PASSWORD_RECOVERY w
// `lib/auth.tsx` („handles cases where Supabase ignores our redirectTo").
//
// Trzymamy więc cel także po naszej stronie i odtwarzamy go, gdy użytkownik
// wyląduje na stronie głównej zalogowany. To nie zastępuje poprawnej listy
// adresów w Supabase — to siatka pod nią.
//
// `localStorage`, NIE `sessionStorage` (2026-11-25, zgłoszenie właściciela:
// „po zalogowaniu z linku drużyny przeszło na Mecze zamiast do dołączenia”).
// Link potwierdzający z maila i logowanie przez Google z przeglądarki
// wbudowanej w WhatsAppa otwierają się w NOWEJ karcie, a `sessionStorage` jest
// osobny dla każdej karty — cel ginął dokładnie wtedy, gdy był potrzebny.
// Ważność 15 minut i kasowanie przy odbiorze zostają.

const KLUCZ = 'bojo:powrot-po-logowaniu';

/** Po tym czasie zapamiętany cel jest bezużyteczny — ktoś zaczął logowanie
 *  i porzucił je dawno temu, a niespodziewany skok byłby dziwniejszy niż jego
 *  brak. */
const WAZNOSC_MS = 15 * 60 * 1000;

/**
 * Czy to bezpieczny cel skoku.
 *
 * Wyłącznie ścieżki względne w obrębie tej samej witryny. `//zlo.example`
 * przeglądarka potraktowałaby jako adres z innym hostem — stąd osobny warunek
 * na drugi ukośnik. Bez tego zapamiętany cel byłby otwartym przekierowaniem.
 */
export function bezpiecznyCel(cel: string | null | undefined): cel is string {
  return !!cel && cel.startsWith('/') && !cel.startsWith('//');
}

/** Zapamiętuje, dokąd wrócić. Wywoływane tuż przed startem logowania. */
export function zapamietajPowrot(cel?: string): void {
  if (typeof localStorage === 'undefined') return;
  if (!bezpiecznyCel(cel)) return;
  try {
    localStorage.setItem(KLUCZ, JSON.stringify({ cel, o: Date.now() }));
  } catch { /* prywatny tryb przeglądarki — trudno, zostaje `?next=` */ }
}

/**
 * Oddaje zapamiętany cel i od razu go kasuje.
 *
 * Kasujemy PRZED skokiem, nie po: gdyby skok się nie powiódł, wpis zostałby
 * w pamięci i przy kolejnym odświeżeniu strony głównej rzucałby użytkownikiem
 * w bok bez powodu.
 */
export function odbierzPowrot(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const surowe = localStorage.getItem(KLUCZ);
    if (!surowe) return null;
    localStorage.removeItem(KLUCZ);
    const { cel, o } = JSON.parse(surowe) as { cel?: string; o?: number };
    if (typeof o !== 'number' || Date.now() - o > WAZNOSC_MS) return null;
    return bezpiecznyCel(cel) ? cel : null;
  } catch {
    return null;
  }
}

/** Jak `odbierzPowrot`, ale nie kasuje wpisu — do samego PODEJRZENIA celu,
 *  bez konsumowania go (np. żeby zdecydować, czy pokazać modal onboardingowy,
 *  nie zakłócając jednocześnie mechanizmu awaryjnego powrotu). */
export function ostatniZamierzonyCel(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const surowe = localStorage.getItem(KLUCZ);
    if (!surowe) {
      return null;
    }
    const { cel, o } = JSON.parse(surowe) as { cel?: string; o?: number };
    if (typeof o !== 'number' || Date.now() - o > WAZNOSC_MS) {
      return null;
    }
    const wynik = bezpiecznyCel(cel) ? cel : null;
    return wynik;
  } catch (err) {
    return null;
  }
}

/**
 * Adres witryny bez `www.`.
 *
 * Domeną kanoniczną jest `bojo.pl` (patrz `layout.tsx`, `robots.ts`,
 * `sitemap.ts`). Linki budowane z `window.location.origin` dziedziczyły jednak
 * host, na którym akurat był organizator — a link wysłany z `www.bojo.pl`
 * uruchamia logowanie z innego origin niż ten wpisany na listę dozwolonych
 * w Supabase. Jeden znormalizowany host to o jeden powód mniej, żeby
 * przekierowanie po zalogowaniu wylądowało w próżni.
 */
export function kanonicznyOrigin(origin: string): string {
  return origin.replace(/^(https?:\/\/)www\./i, '$1');
}

/**
 * Link z zaproszeniem (kapitana `/k/…`, drużyny `/t/…`) pamiętany od WEJŚCIA,
 * nie od kliknięcia „Zaloguj się” (2026-11-28, zgłoszenie właściciela:
 * „kapitan z kodu QR zalogował się Googlem i zamiast przejęcia drużyny
 * zobaczył Moje mecze”). Ktoś, kto otworzy link, a zaloguje się inną drogą
 * (przycisk w nagłówku, Google bez `?next=`, nowa karta), dalej wraca do
 * linku. Zalogowany, który do niego doszedł, zdejmuje wpis, żeby nie
 * przerzucił go drugi raz przy wejściu na stronę główną.
 */
export function pilnujPowrotu(cel: string, zalogowany: boolean): void {
  if (!zalogowany) { zapamietajPowrot(cel); return; }
  if (ostatniZamierzonyCel() === cel) odbierzPowrot();
}

/** Adres logowania dla linku z zaproszeniem: od razu zakładanie konta, bo
 *  zaproszony zwykle konta jeszcze nie ma, a pod formularzem jest „Zaloguj się”. */
export function adresRejestracjiZLinku(cel: string, powod: 'kapitan' | 'druzyna'): string {
  return `/logowanie?next=${encodeURIComponent(cel)}&mode=rejestracja&powod=${powod}`;
}
