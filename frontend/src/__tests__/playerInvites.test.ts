import { describe, it, expect } from 'vitest';
import { odbiorcyPowtorki } from '@/lib/playerInvites';

const ORGANIZER = 'org-1';

function wpis(overrides: Partial<Parameters<typeof odbiorcyPowtorki>[0][number]> = {}) {
  return {
    userId: 'gracz-1',
    isGuest: false,
    isReserve: false,
    pendingApproval: false,
    rsvp: 'yes' as const,
    ...overrides,
  };
}

describe('odbiorcyPowtorki (F-5)', () => {
  it('zaprasza gracza z kontem, który grał w składzie', () => {
    expect(odbiorcyPowtorki([wpis({ userId: 'g1' })], ORGANIZER)).toEqual(['g1']);
  });

  it('pomija organizatora — mecz i tak dostaje automatycznie', () => {
    expect(odbiorcyPowtorki([wpis({ userId: ORGANIZER })], ORGANIZER)).toEqual([]);
  });

  it('pomija gościa bez konta', () => {
    expect(odbiorcyPowtorki([wpis({ userId: undefined, isGuest: true })], ORGANIZER)).toEqual([]);
  });

  it('pomija rezerwowych', () => {
    expect(odbiorcyPowtorki([wpis({ userId: 'g1', isReserve: true })], ORGANIZER)).toEqual([]);
  });

  it('pomija oczekujących na akceptację', () => {
    expect(odbiorcyPowtorki([wpis({ userId: 'g1', pendingApproval: true })], ORGANIZER)).toEqual([]);
  });

  it('pomija obserwujących (rsvp maybe)', () => {
    expect(odbiorcyPowtorki([wpis({ userId: 'g1', rsvp: 'maybe' })], ORGANIZER)).toEqual([]);
  });

  it('zwraca kilku odbiorców naraz, w kolejności wejścia', () => {
    const sklad = [wpis({ userId: 'g1' }), wpis({ userId: ORGANIZER }), wpis({ userId: 'g2' })];
    expect(odbiorcyPowtorki(sklad, ORGANIZER)).toEqual(['g1', 'g2']);
  });

  it('pusty skład daje pustą listę', () => {
    expect(odbiorcyPowtorki([], ORGANIZER)).toEqual([]);
  });
});
