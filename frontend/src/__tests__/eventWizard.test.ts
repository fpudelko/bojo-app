import { describe, it, expect } from 'vitest';
import { isPast, validateStep1, validateStep2, validateStep, validatePayments
} from '@/lib/eventWizard';

describe('isPast', () => {
  it('treats a far-future date/time as not past', () => {
    expect(isPast('2099-01-01', '18:00')).toBe(false);
  });

  it('treats a far-past date/time as past', () => {
    expect(isPast('2000-01-01', '18:00')).toBe(true);
  });

  it('returns false on malformed input instead of throwing', () => {
    expect(isPast('', '')).toBe(false);
  });
});

describe('validateStep1 (Co i gdzie)', () => {
  it('errors when neither a venue nor coordinates are set', () => {
    const errs = validateStep1({ venue: null, lat: null });
    expect(errs.location).toBeDefined();
  });

  it('passes with a venue selected', () => {
    const errs = validateStep1({ venue: { id: '1', name: 'Orlik' }, lat: null });
    expect(errs.location).toBeUndefined();
  });

  it('passes with a raw map pin (lat/lng, no venue)', () => {
    const errs = validateStep1({ venue: null, lat: 52.4 });
    expect(errs.location).toBeUndefined();
  });
});

describe('validateStep2 (Kiedy i ile)', () => {
  it('errors when date is empty', () => {
    const errs = validateStep2('', '18:00');
    expect(errs.date).toBe('Podaj datę meczu.');
  });

  it('errors when date+time is in the past', () => {
    const errs = validateStep2('2000-01-01', '18:00');
    expect(errs.date).toBe('Mecz nie może zaczynać się w przeszłości.');
  });

  it('passes for a future date', () => {
    const errs = validateStep2('2099-01-01', '18:00');
    expect(errs).toEqual({});
  });
});

describe('validatePayments', () => {
  const base = { costPln: '', acceptedPaymentMethods: [] as string[], blikPhone: '', cardDiscountEnabled: false, cardDiscountPln: '' };

  it('has no rules for a free match', () => {
    expect(validatePayments(base)).toEqual({});
    expect(validatePayments({ ...base, blikPhone: '' , acceptedPaymentMethods: ['blik']})).toEqual({});
  });

  it('errors when BLIK is accepted but the phone has no digits', () => {
    const errs = validatePayments({ ...base, costPln: '20', acceptedPaymentMethods: ['blik'], blikPhone: '' });
    expect(errs.blikPhone).toBeDefined();
  });

  it('errors when the BLIK phone has fewer than 9 digits', () => {
    const errs = validatePayments({ ...base, costPln: '20', acceptedPaymentMethods: ['blik'], blikPhone: '600 123 45' });
    expect(errs.blikPhone).toBeDefined();
  });

  it('passes with exactly 9 digits', () => {
    const errs = validatePayments({ ...base, costPln: '20', acceptedPaymentMethods: ['blik'], blikPhone: '600 123 456' });
    expect(errs.blikPhone).toBeUndefined();
  });

  it('errors when the card discount exceeds the cost', () => {
    const errs = validatePayments({ ...base, costPln: '20', cardDiscountEnabled: true, cardDiscountPln: '25' });
    expect(errs.cardDiscount).toBeDefined();
  });

  it('allows a discount exactly equal to the cost', () => {
    const errs = validatePayments({ ...base, costPln: '20', cardDiscountEnabled: true, cardDiscountPln: '20' });
    expect(errs.cardDiscount).toBeUndefined();
  });

  it('allows an empty discount amount — "ask the organizer" is valid', () => {
    const errs = validatePayments({ ...base, costPln: '20', cardDiscountEnabled: true, cardDiscountPln: '' });
    expect(errs.cardDiscount).toBeUndefined();
  });

  // `platny` to niezależny `useState` w kreatorze, nie pochodna `costPln > 0`
  // — da się go włączyć i zostawić cenę pustą. Zgłoszone wprost z sesji QA:
  // „Mecz płatny" bez ceny przechodziło „Dalej" bez ostrzeżenia, bo ta
  // funkcja sprawdzała wyłącznie `cost > 0` i traktowała to jak darmowy mecz.
  it('errors when „Mecz płatny" jest włączony, a cena pusta', () => {
    const errs = validatePayments({ ...base, platny: true });
    expect(errs.costPln).toBeDefined();
  });

  it('bez włączonego przełącznika pusta cena dalej znaczy darmowy mecz', () => {
    expect(validatePayments({ ...base, platny: false })).toEqual({});
    expect(validatePayments(base)).toEqual({});
  });

  it('włączony przełącznik z podaną ceną nie zgłasza błędu costPln', () => {
    const errs = validatePayments({ ...base, costPln: '20', platny: true });
    expect(errs.costPln).toBeUndefined();
  });
});

describe('validateStep (dispatcher used by attemptGoToStep)', () => {
  // Od 2026-08-22 krok 1 pyta o TERMIN, a krok 2 o MIEJSCE — odwrotnie niż
  // wcześniej. Powód w komentarzu przy `validateStep`: lokalizacja to najdroższa
  // interakcja w całym kreatorze i stała na samym wejściu, przed jakimkolwiek
  // rozpędem. `base` ma więc miejsce PUSTE i termin poprawny, żeby każdy
  // przypadek mówił wprost, którego kroku dotyczy.
  const base = { location: { venue: null, lat: null }, date: '2099-01-01', time: '18:00' };

  it('krok 1 sprawdza TERMIN, nie miejsce', () => {
    expect(validateStep(1, { ...base, date: '' }).date).toBeDefined();
    // Puste miejsce nie może blokować pierwszego kroku — o nie pytamy dopiero
    // w drugim.
    expect(validateStep(1, base)).toEqual({});
  });

  it('krok 2 sprawdza MIEJSCE', () => {
    expect(validateStep(2, base).location).toBeDefined();
  });

  it('step 3 has no required fields', () => {
    expect(validateStep(3, base)).toEqual({});
  });

  // Koszt przeniósł się na krok 1 (pod przełącznik „Mecz płatny"), więc jego
  // walidacja musiała pójść za polem. Zgłoszona krok później wskazywałaby pole,
  // którego na ekranie już nie ma.
  it('krok 1 pokazuje błędy płatności, gdy podano pola płatności', () => {
    const errs = validateStep(1, {
      ...base, costPln: '20', acceptedPaymentMethods: ['blik'], blikPhone: '',
    });
    expect(errs.blikPhone).toBeDefined();
  });

  it('krok 1 bez pól płatności traktuje mecz jak darmowy', () => {
    expect(validateStep(1, base)).toEqual({});
  });

  it('krok 1 blokuje „Dalej", gdy „Mecz płatny" jest włączony bez ceny', () => {
    const errs = validateStep(1, { ...base, platny: true });
    expect(errs.costPln).toBeDefined();
  });
});

describe('bramkarze NIE blokują kroku 1', () => {
  // Reguła „zdecyduj, czy mecz rozróżnia bramkarzy" została usunięta razem
  // z `validateGoalkeepers()`. Miała sens, dopóki rozróżnianie było domyślnie
  // WŁĄCZONE po cichu; dziś to widoczny przełącznik, domyślnie wyłączony,
  // a wyłączony przełącznik JEST decyzją. Reguła zaczęła żądać decyzji, która
  // stoi na ekranie — zgłoszone wprost: „to też bez sensu błąd".
  it('krok 1 przechodzi niezależnie od stanu bramkarzy', () => {
    const base = {
      location: { venue: {}, lat: 52, lng: 17 } as never,
      date: '2099-01-01', time: '18:00',
    };
    expect(validateStep(1, base)).toEqual({});
  });
});
