// Validation for the match-creation wizard (app/wydarzenia/nowe/page.tsx).
// Pulled out of the page so the step-gating logic is testable and shared
// between the "Dalej" buttons and clicking a step number directly.

export type FieldErrors = Record<string, string>;

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

/** Step 3 (Opcje) has no required fields. */
export function validateStep3(): FieldErrors {
  return {};
}

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
