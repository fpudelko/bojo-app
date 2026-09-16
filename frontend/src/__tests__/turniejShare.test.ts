import { describe, it, expect } from 'vitest';
import { linkDoTurnieju, tekstUdostepnieniaTurnieju } from '@/lib/turniejShare';

describe('linkDoTurnieju', () => {
  it('strips www. from the origin (kanonicznyOrigin)', () => {
    const link = linkDoTurnieju('abc-123', 'https://www.bojo.pl');
    expect(link).toBe('https://bojo.pl/turnieje/abc-123');
  });
});

describe('tekstUdostepnieniaTurnieju', () => {
  const t = {
    nazwa: 'Turniej Osiedlowy',
    dataStartu: '2026-10-04',
    godzinaStartu: '10:00',
    miejsceNazwa: 'Orlik Winogrady',
    wpisoweGrosze: 0,
  };
  const link = 'https://bojo.pl/turnieje/abc-123';

  it('mentions the tournament name, date, place and link', () => {
    const tekst = tekstUdostepnieniaTurnieju(t, link);
    expect(tekst).toContain('Turniej Osiedlowy');
    expect(tekst).toContain('10:00');
    expect(tekst).toContain('Orlik Winogrady');
    expect(tekst).toContain(link);
  });

  it('says nothing about wpisowe when it is free', () => {
    const tekst = tekstUdostepnieniaTurnieju(t, link);
    expect(tekst).not.toMatch(/wpisowe/i);
  });

  it('shows the entry fee in złoty when set', () => {
    const tekst = tekstUdostepnieniaTurnieju({ ...t, wpisoweGrosze: 5000 }, link);
    expect(tekst).toContain('50 zł/drużyna');
  });

  it('falls back to the raw date if parsing fails', () => {
    const tekst = tekstUdostepnieniaTurnieju({ ...t, dataStartu: 'nieprawidlowa-data' }, link);
    expect(tekst).toContain('nieprawidlowa-data');
  });
});
