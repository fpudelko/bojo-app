import { describe, it, expect } from 'vitest';
import { isPast, validateStep1, validateStep2, validateStep } from '@/lib/eventWizard';

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
});
