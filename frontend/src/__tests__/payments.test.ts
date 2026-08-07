import { describe, it, expect } from 'vitest';
import {
  priceForParticipant,
  formatBlikPhone,
  blikPhoneDigits,
  canSeeBlikPhone,
  BLIK_PHONE_REVEAL_MINUTES,
} from '@/lib/payments';

describe('priceForParticipant', () => {
  it('charges full price without a sports card', () => {
    const r = priceForParticipant(2000, null, false);
    expect(r).toEqual({ priceGrosze: 2000, discountApplied: false, discountUnspecified: false });
  });

  it('applies a specified discount', () => {
    const r = priceForParticipant(2000, 500, true);
    expect(r).toEqual({ priceGrosze: 1500, discountApplied: true, discountUnspecified: false });
  });

  it('flags an unspecified discount instead of guessing an amount', () => {
    const r = priceForParticipant(2000, null, true);
    expect(r).toEqual({ priceGrosze: 2000, discountApplied: false, discountUnspecified: true });
  });

  it('never goes below zero even if the discount exceeds the cost', () => {
    const r = priceForParticipant(1000, 5000, true);
    expect(r.priceGrosze).toBe(0);
    expect(r.discountApplied).toBe(true);
  });
});

describe('formatBlikPhone', () => {
  it('groups 9 digits as 3-3-3', () => {
    expect(formatBlikPhone('600123456')).toBe('600 123 456');
  });

  it('strips non-digit characters typed along the way', () => {
    expect(formatBlikPhone('600-123 456')).toBe('600 123 456');
  });

  it('strips a leading +48/48 prefix', () => {
    expect(formatBlikPhone('+48600123456')).toBe('600 123 456');
    expect(formatBlikPhone('48600123456')).toBe('600 123 456');
  });

  it('caps at 9 digits, dropping anything typed beyond that', () => {
    expect(formatBlikPhone('6001234567890')).toBe('600 123 456');
  });

  it('does not eat a number that genuinely starts with 48 and is only 9 digits', () => {
    expect(formatBlikPhone('486123456')).toBe('486 123 456');
  });
});

describe('blikPhoneDigits', () => {
  it('returns only the digits', () => {
    expect(blikPhoneDigits('600 123 456')).toBe('600123456');
  });
});

describe('canSeeBlikPhone', () => {
  it('the organizer always sees it', () => {
    expect(canSeeBlikPhone({ isOrganizer: true, isInSquad: false, minutesToStart: 10_000 })).toBe(true);
  });

  it('a stranger never sees it', () => {
    expect(canSeeBlikPhone({ isOrganizer: false, isInSquad: false, minutesToStart: 5 })).toBe(false);
  });

  it('a squad member does not see it long before kickoff', () => {
    expect(canSeeBlikPhone({ isOrganizer: false, isInSquad: true, minutesToStart: BLIK_PHONE_REVEAL_MINUTES + 1 })).toBe(false);
  });

  it('a squad member sees it exactly at the reveal window', () => {
    expect(canSeeBlikPhone({ isOrganizer: false, isInSquad: true, minutesToStart: BLIK_PHONE_REVEAL_MINUTES })).toBe(true);
  });

  it('a squad member sees it once the match has started (negative minutes)', () => {
    expect(canSeeBlikPhone({ isOrganizer: false, isInSquad: true, minutesToStart: -30 })).toBe(true);
  });

  it('returns false when minutesToStart is unparseable', () => {
    expect(canSeeBlikPhone({ isOrganizer: false, isInSquad: true, minutesToStart: null })).toBe(false);
  });
});
