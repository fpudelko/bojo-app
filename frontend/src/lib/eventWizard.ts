// Validation for the match-creation wizard (app/wydarzenia/nowe/page.tsx).
// Pulled out of the page so the step-gating logic is testable and shared
// between the "Dalej" buttons and clicking a step number directly.

export type FieldErrors = Record<string, string>;

/** Który krok kreatora odpowiada za którą grupę pól — JEDNO źródło prawdy.
 *
 *  Układ: 1 = „Kiedy" (termin, skład, koszt, bramkarze), 2 = „Gdzie"
 *  (lokalizacja), 3 = „Dla kogo" (widoczność, tytuł, opis, grupa). Nazwy kroków
 *  stoją w `STEP_TITLES` w `app/wydarzenia/nowe/page.tsx`, bo pilnuje ich
 *  `bramaKreatora.test.ts` czytający źródło tamtej strony.
 *
 *  DLACZEGO STAŁA, A NIE TRZY LITERAŁY. Ten sam układ był dotąd zapisany
 *  niezależnie w trzech miejscach: `validateStep()` niżej, `STEP_OF_FIELD`
 *  w kreatorze i pola `krok` w `lib/eventSummary.ts`. Zamiana kroków
 *  (2026-08-22: „najpierw KIEDY, potem GDZIE") i przeniesienie kosztu na krok 1
 *  (2026-08-23) zaktualizowały dwa pierwsze i przeoczyły trzecie — przez co
 *  „Zmień" przy dacie w oknie podsumowania przenosiło na mapę, a „Zmień" przy
 *  miejscu na wybór terminu. Rozjazd był niewidoczny, bo każde miejsce z osobna
 *  wyglądało poprawnie. Teraz zmiana układu to zmiana TEJ stałej. */
export const KROK_KREATORA = {
  termin: 1,
  sklad: 1,
  koszt: 1,
  bramkarze: 1,
  lokalizacja: 2,
  tytul: 3,
  widocznosc: 3,
} as const;

/** True when the given date (YYYY-MM-DD) + time (HH:MM) is at or before now. */
export function isPast(date: string, time: string): boolean {
  try {
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = (time || '00:00').split(':').map(Number);
    return new Date(y, m - 1, d, h, min).getTime() <= Date.now();
  } catch { return false; }
}

export function validateStep1(location: { venue?: unknown; lat: number | null }): FieldErrors {
  return (!location.venue && location.lat === null)
    ? { location: 'Wskaż lokalizację na mapie lub wpisz adres.' }
    : {};
}

export function validateStep2(date: string, time: string): FieldErrors {
  if (!date) return { date: 'Podaj datę meczu.' };
  if (isPast(date, time)) return { date: 'Mecz nie może zaczynać się w przeszłości.' };
  return {};
}

/* USUNIĘTE: `validateGoalkeepers()`.
 *
 * Wymuszała decyzję „czy mecz rozróżnia bramkarzy", gdy `goalkeepersEnabled`
 * był `null`. Miało to sens, dopóki rozróżnianie było domyślnie WŁĄCZONE po
 * cichu: organizator, który tego nie zauważył, dostawał pulę miejsc rozbitą na
 * role i dowiadywał się o tym dopiero na graczach.
 *
 * Dziś to widoczny przełącznik „Bramkarze osobno", domyślnie wyłączony —
 * a wyłączony przełącznik JEST decyzją. Reguła zaczęła więc żądać decyzji,
 * która stoi na ekranie: „Dalej" odmawiało, a obok świeciło „Zdecyduj, czy mecz
 * rozróżnia bramkarzy" przy przełączniku ustawionym na NIE. Zgłoszone wprost:
 * „to też bez sensu błąd".
 *
 * Nic tej decyzji nie potrzebuje: publikacja i tak zapisuje
 * `goalkeepersEnabled ?? false`, a strona edycji trzyma zwykły `boolean`
 * i normalizuje przy wczytaniu. Walidator był jedynym miejscem, dla którego
 * stan „jeszcze nie zdecydowano" musiał w ogóle istnieć.
 */

/** Czy publikowany mecz jest PŁATNY.
 *
 *  Reguła siedzi w `lib/`, a nie inline w kreatorze, bo rozstrzyga o czterech
 *  polach naraz (`costGrosze`, `acceptedPaymentMethods`, `trackPayments`,
 *  `showPaymentStatus`) i raz już się rozjechała.
 *
 *  DLACZEGO `platny` JEST WARUNKIEM KONIECZNYM. Kreator liczył to jako samo
 *  `costPln > 0`, a cena od osoby jest POCHODNĄ kosztu obiektu: wyłączenie
 *  przełącznika czyściło cenę, ale nie koszt obiektu, więc najbliższa zmiana
 *  liczby miejsc — kontrolki stojącej tuż obok — odtwarzała kwotę. Mecz
 *  publikował się wtedy jako płatny, z PUSTĄ listą metod płatności, przy
 *  przełączniku pokazującym WYŁĄCZONY: gracz widział cenę i nie miał jak jej
 *  uregulować. To ten sam objaw, który audyt zamknął jako `O-12`.
 *
 *  Przełącznik jest deklaracją intencji — cena bez niej jest resztką stanu. */
export function czyMeczPlatny(platny: boolean, costPln: string): boolean {
  return platny && parseFloat(costPln || '0') > 0;
}

/** Step 3 (Opcje) has no required fields. */
export function validateStep3(): FieldErrors {
  return {};
}

/** Górna granica kosztu OD OSOBY — łapacz literówek, nie reguła biznesowa.
 *
 *  Pole ceny miało dotąd wyłącznie `min={0}`, więc „99999999" jechało prosto do
 *  bazy: `cost_grosz` jest `integer`, a 9 999 999 900 groszy przekracza jego
 *  zakres, przez co organizator dostawał surowy błąd Postgresa zamiast zdania
 *  po polsku. Amatorska gierka kosztuje od osoby kilkanaście–kilkadziesiąt
 *  złotych (wynajem 200–400 zł dzielony na 10–20 osób), więc 500 zł od osoby
 *  jest o rząd wielkości powyżej wszystkiego realnego i nadal daleko od
 *  przepełnienia kolumny. Gdyby kiedyś było za mało — to jedna stała. */
const MAX_KOSZT_OD_OSOBY_PLN = 500;

/** Payment rules for step 2 (Kiedy i ile) — separate from validateStep2 (date/time)
 *  so the existing tests for that function stay untouched. A free match has no
 *  rules to check. */
export function validatePayments(v: {
  costPln: string;
  acceptedPaymentMethods: string[];
  blikPhone: string;
  cardDiscountEnabled: boolean;
  cardDiscountPln: string;
  /** Przełącznik „Mecz płatny" — niezależny `useState`, NIE pochodna
   *  `costPln > 0`. Bez tego parametru wiadomo tylko „czy koszt jest
   *  dodatni", a nie „czy organizator w ogóle chce, żeby mecz był płatny" —
   *  dwa DUŻE OSOBNE pytania, jeśli ktoś włączy przełącznik i nie wpisze
   *  jeszcze kwoty. Wtedy `cost <= 0` i stara wersja tej funkcji uznawała
   *  mecz za darmowy, mimo że organizator wyraźnie powiedział inaczej —
   *  „Dalej" przechodziło bez ostrzeżenia. Zgłoszone wprost z sesji QA. */
  platny?: boolean;
}): FieldErrors {
  const errs: FieldErrors = {};
  const cost = parseFloat(v.costPln || '0');
  if (cost <= 0) {
    if (v.platny) errs.costPln = 'Podaj koszt od osoby (albo wyłącz „Mecz płatny").';
    return errs;
  }
  if (cost > MAX_KOSZT_OD_OSOBY_PLN) {
    // Komunikat mówi WYLICZONĄ kwotę od osoby, nie to, co stoi w polu — przy
    // trybie „za cały obiekt" w polu jest koszt wynajmu, a `costPln` to już
    // wynik dzielenia. „Wpisałeś za dużo" wskazywałoby wtedy liczbę, której
    // organizator nie wpisał.
    errs.costPln = `Koszt od osoby wychodzi ${cost.toFixed(2)} zł — to wygląda na pomyłkę. `
      + `Maksimum to ${MAX_KOSZT_OD_OSOBY_PLN} zł od osoby.`;
    // Bez `return` doszłaby jeszcze uwaga o zniżce liczonej od tej samej,
    // absurdalnej kwoty — dwa błędy o jednej pomyłce.
    return errs;
  }

  if (v.acceptedPaymentMethods.includes('blik')) {
    const digits = v.blikPhone.replace(/\D/g, '');
    if (digits.length !== 9) errs.blikPhone = 'Numer do BLIKA to 9 cyfr.';
  }
  if (v.cardDiscountEnabled && v.cardDiscountPln) {
    const disc = parseFloat(v.cardDiscountPln);
    if (disc > cost) {
      errs.cardDiscount = `Zniżka nie może być wyższa niż koszt od osoby (${cost.toFixed(2)} zł).`;
    }
  }
  return errs;
}

/** Validator for step `n` (1-indexed), given the wizard's current form values.
 *  Payment fields are optional — omitting them (as the dispatcher tests do)
 *  behaves like a free match, i.e. no payment rules apply. */
export function validateStep(
  n: number,
  v: {
    location: { venue?: unknown; lat: number | null };
    date: string;
    time: string;
    costPln?: string;
    acceptedPaymentMethods?: string[];
    blikPhone?: string;
    cardDiscountEnabled?: boolean;
    cardDiscountPln?: string;
    platny?: boolean;
  },
): FieldErrors {
  // KOLEJNOŚĆ KROKÓW ZMIENIŁA SIĘ (2026-08-22): najpierw KIEDY, potem GDZIE.
  //
  // Dotąd pierwszy krok pytał o lokalizację, czyli zaczynał od NAJDROŻSZEJ
  // interakcji w całym kreatorze — mapa, szukanie, katalog — zanim powstał
  // jakikolwiek rozpęd. Data i godzina to dwa dotknięcia i jedyne rzeczy,
  // które organizator ma w głowie, otwierając kreator. Numery kroków zostają
  // te same, zmienia się to, o co pytają.
  //
  // `validateStep1`/`validateStep2` NIE zamieniają się nazwami: mówią, co
  // sprawdzają (lokalizacja / termin), a nie na którym ekranie stoją. Nazwa
  // wiążąca funkcję z numerem ekranu psuje się przy każdej zmianie układu.
  if (n === 1) {
    // KOSZT I BRAMKARZE PRZENIOSŁY SIĘ NA KROK 1 (2026-08-23) — razem z liczbą
    // miejsc, pod przełączniki „Mecz płatny" i „Bramkarze osobno". Walidacja
    // idzie za polem, nie za numerem ekranu: błąd numeru BLIKA zgłoszony przy
    // wyjściu z kroku 2 wskazywałby pole, którego nie ma już na ekranie.
    return {
      ...validateStep2(v.date, v.time),
      ...validatePayments({
        costPln: v.costPln ?? '',
        acceptedPaymentMethods: v.acceptedPaymentMethods ?? [],
        blikPhone: v.blikPhone ?? '',
        cardDiscountEnabled: v.cardDiscountEnabled ?? false,
        cardDiscountPln: v.cardDiscountPln ?? '',
        platny: v.platny ?? false,
      }),
    };
  }
  if (n === 2) return validateStep1(v.location);
  return validateStep3();
}
