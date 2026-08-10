import { describe, it, expect } from 'vitest';
import { isPast, validateStep1, validateStep2, validateStep, validatePayments, validateGoalkeepers
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
});

describe('validateStep (dispatcher used by attemptGoToStep)', () => {
  const base = { location: { venue: null, lat: null }, date: '2099-01-01', time: '18:00' };

  it('step 1 checks location only', () => {
    expect(validateStep(1, base).location).toBeDefined();
  });

  it('step 2 checks date only', () => {
    expect(validateStep(2, { ...base, date: '' }).date).toBeDefined();
  });

  it('step 3 has no required fields', () => {
    expect(validateStep(3, base)).toEqual({});
  });

  it('step 2 also surfaces payment errors when payment fields are given', () => {
    const errs = validateStep(2, { ...base, costPln: '20', acceptedPaymentMethods: ['blik'], blikPhone: '' });
    expect(errs.blikPhone).toBeDefined();
  });

  it('step 2 treats missing payment fields as a free match (no payment errors)', () => {
    expect(validateStep(2, base)).toEqual({});
  });
});

describe('validateGoalkeepers', () => {
  it('sport bez bramkarza nie pyta o nic', () => {
    expect(validateGoalkeepers({ sportMaBramkarza: false, goalkeepersEnabled: null })).toEqual({});
  });

  // Ustawienie było domyślnie włączone, więc organizator, który go nie
  // zauważył, tworzył mecz z pulą rozbitą na role — i przy grze bez stałego
  // bramkarza kolejni zawodnicy z pola lądowali na rezerwie mimo wolnych
  // miejsc „dla bramkarzy". Wychodziło to dopiero na graczach.
  it('sport z bramkarzem wymaga decyzji', () => {
    expect(validateGoalkeepers({ sportMaBramkarza: true, goalkeepersEnabled: null }))
      .toHaveProperty('goalkeepers');
  });

  it('każda świadoma odpowiedź przechodzi', () => {
    expect(validateGoalkeepers({ sportMaBramkarza: true, goalkeepersEnabled: true })).toEqual({});
    expect(validateGoalkeepers({ sportMaBramkarza: true, goalkeepersEnabled: false })).toEqual({});
  });

  it('krok 2 blokuje przejście dalej bez decyzji', () => {
    const errs = validateStep(2, {
      location: { venue: {}, lat: 52, lng: 17 } as never,
      date: '2099-01-01', time: '18:00',
      sportMaBramkarza: true, goalkeepersEnabled: null,
    });
    expect(errs).toHaveProperty('goalkeepers');
  });
});
