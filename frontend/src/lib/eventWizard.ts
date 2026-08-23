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

/**
 * Rozróżnianie bramkarzy to wybór, nie ustawienie domyślne.
 *
 * Domyślnie było WŁĄCZONE. Organizator, który tego nie zauważył, dostawał mecz
 * z pulą miejsc rozbitą na role — a przy grze bez stałego bramkarza to znaczy,
 * że po zapełnieniu pola kolejni zawodnicy lądują na rezerwie, mimo wolnych
 * miejsc „dla bramkarzy". Wychodziło to dopiero przy zapisach, na graczach.
 *
 * `null` = jeszcze nie zdecydowano. Dotyczy wyłącznie sportów z bramkarzem;
 * dla pozostałych pytanie nie ma sensu i nie jest zadawane.
 */
export function validateGoalkeepers(v: {
  sportMaBramkarza: boolean;
  goalkeepersEnabled: boolean | null;
}): FieldErrors {
  if (!v.sportMaBramkarza) return {};
  if (v.goalkeepersEnabled === null) {
    return { goalkeepers: 'Zdecyduj, czy mecz rozróżnia bramkarzy.' };
  }
  return {};
}

// UWAGA NA PRZYSZŁOŚĆ: od czasu, gdy kreator ma widoczny przełącznik
// „Bramkarze osobno” (domyślnie WYŁĄCZONY), stan `null` w kreatorze nie
// występuje — wyłączenie jest decyzją, nie brakiem decyzji. Reguła zostaje,
// bo strona edycji nadal potrafi mieć `null` przy meczach sprzed migracji
// `077`, a usunięcie jej odblokowałoby zapis meczu bez rozstrzygniętej roli.

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
}): FieldErrors {
  const errs: FieldErrors = {};
  const cost = parseFloat(v.costPln || '0');
  if (cost <= 0) return errs;

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
    sportMaBramkarza?: boolean;
    goalkeepersEnabled?: boolean | null;
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
      }),
      ...validateGoalkeepers({
        sportMaBramkarza: v.sportMaBramkarza ?? false,
        goalkeepersEnabled: v.goalkeepersEnabled ?? null,
      }),
    };
  }
  if (n === 2) return validateStep1(v.location);
  return validateStep3();
}
