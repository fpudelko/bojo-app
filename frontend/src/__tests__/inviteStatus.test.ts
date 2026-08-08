import { describe, it, expect } from 'vitest';
import { inviteStatus, compareByInviteStatus } from '@/lib/inviteStatus';

describe('inviteStatus', () => {
  it('bez dismissedAt i bez uczestnictwa czeka', () => {
    expect(inviteStatus(undefined, 'u1', new Set())).toBe('waiting');
  });

  it('dismissedAt bez uczestnictwa to odmowa', () => {
    expect(inviteStatus('2026-08-01T00:00:00Z', 'u1', new Set())).toBe('declined');
  });

  it('uczestnictwo to dołączenie, nawet bez dismissedAt', () => {
    expect(inviteStatus(undefined, 'u1', new Set(['u1']))).toBe('joined');
  });

  it('uczestnictwo bije wcześniejszą odmowę — klucz tego modułu', () => {
    // Ktoś kliknął "Nie tym razem", a potem i tak dołączył innym kanałem
    // (link, zaproszenie z innej ekipy). Pierwsza wersja tej logiki sprawdzała
    // dismissedAt przed uczestnictwem i pokazywała tu "Nie tym razem" — mimo
    // że osoba faktycznie gra.
    expect(inviteStatus('2026-08-01T00:00:00Z', 'u1', new Set(['u1']))).toBe('joined');
  });

  it('nie myli zaproszonych o podobnych identyfikatorach', () => {
    expect(inviteStatus(undefined, 'u2', new Set(['u1']))).toBe('waiting');
  });
});

describe('compareByInviteStatus', () => {
  it('czekający przed dołączonymi, dołączeni przed odmówionymi', () => {
    expect(compareByInviteStatus('waiting', 'joined')).toBeLessThan(0);
    expect(compareByInviteStatus('joined', 'declined')).toBeLessThan(0);
    expect(compareByInviteStatus('waiting', 'declined')).toBeLessThan(0);
  });

  it('ten sam status daje zero', () => {
    expect(compareByInviteStatus('waiting', 'waiting')).toBe(0);
  });

  it('sortowanie w praktyce daje: czekający, dołączeni, odmówieni', () => {
    const statuses: Array<'waiting' | 'joined' | 'declined'> = ['declined', 'joined', 'waiting', 'joined', 'declined'];
    expect([...statuses].sort(compareByInviteStatus))
      .toEqual(['waiting', 'joined', 'joined', 'declined', 'declined']);
  });
});
