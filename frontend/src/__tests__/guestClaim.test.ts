import { describe, it, expect } from 'vitest';
import { tekstZaproszeniaGoscia } from '@/lib/guestClaim';
import type { DaneDoUdostepnienia } from '@/lib/eventShare';

const bazowy: DaneDoUdostepnienia = {
  sport: 'piłka nożna',
  title: undefined,
  maxPlayers: 14,
  date: '2026-08-20',
  time: '18:00:00',
  endTime: '19:30:00',
  costGrosze: 0,
};

describe('tekstZaproszeniaGoscia', () => {
  it('zawiera imię gościa', () => {
    expect(tekstZaproszeniaGoscia('Marek', bazowy)).toContain('Marek');
  });

  it('zawiera tytuł meczu (domyślny, gdy organizator nie podał własnego)', () => {
    expect(tekstZaproszeniaGoscia('Marek', bazowy)).toContain('Piłka nożna 7v7');
  });

  it('używa własnego tytułu, gdy organizator go podał', () => {
    const t = tekstZaproszeniaGoscia('Marek', { ...bazowy, title: 'Środowa gierka' });
    expect(t).toContain('Środowa gierka');
  });

  it('tłumaczy, po co kliknąć — nie jest gołym wezwaniem do akcji', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy);
    expect(t).toContain('Załóż konto');
    expect(t).toContain('statystyki');
  });

  it('nie zawiera samego linku — link dokłada się osobno, jak w eventShareText', () => {
    expect(tekstZaproszeniaGoscia('Marek', bazowy)).not.toContain('http');
  });

  it('nie wywraca się na niepoprawnej dacie', () => {
    const t = tekstZaproszeniaGoscia('Marek', { ...bazowy, date: 'bez-sensu' });
    expect(t).toContain('bez-sensu');
  });
});
