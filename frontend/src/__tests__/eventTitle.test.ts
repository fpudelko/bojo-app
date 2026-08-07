import { describe, it, expect } from 'vitest';
import { squadSuffix, defaultEventTitle, eventDisplayTitle } from '@/lib/eventTitle';

describe('squadSuffix', () => {
  it('formats an even squad as NvN', () => {
    expect(squadSuffix(14)).toBe(' 7v7');
  });

  it('formats an odd squad as "· N os."', () => {
    expect(squadSuffix(9)).toBe(' · 9 os.');
  });

  it('returns empty for zero or missing', () => {
    expect(squadSuffix(0)).toBe('');
  });
});

describe('defaultEventTitle', () => {
  it('matches the promised placeholder for football 7v7', () => {
    expect(defaultEventTitle('piłka nożna', 14)).toBe('Piłka nożna 7v7');
  });

  it('falls back to the raw sport string for unknown sports', () => {
    expect(defaultEventTitle('curling', 9)).toBe('curling · 9 os.');
  });
});

describe('eventDisplayTitle', () => {
  it('uses the organizer-set title when present', () => {
    expect(eventDisplayTitle({ title: 'Czwartkowa ligówka', sport: 'piłka nożna', maxPlayers: 14 }))
      .toBe('Czwartkowa ligówka');
  });

  it('falls back to the default title for an empty string', () => {
    expect(eventDisplayTitle({ title: '', sport: 'piłka nożna', maxPlayers: 14 }))
      .toBe('Piłka nożna 7v7');
  });

  it('falls back to the default title for whitespace-only', () => {
    expect(eventDisplayTitle({ title: '   ', sport: 'koszykówka', maxPlayers: 10 }))
      .toBe('Koszykówka 5v5');
  });

  it('falls back to the default title when title is undefined', () => {
    expect(eventDisplayTitle({ sport: 'siatkówka', maxPlayers: 12 })).toBe('Siatkówka 6v6');
  });
});
