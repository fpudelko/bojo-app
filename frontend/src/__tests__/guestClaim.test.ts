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
    expect(t).toContain('Konto zakładasz');
    expect(t).toContain('powiadomienia o kolejnych meczach');
  });

  it('podpisuje się osobą, która zaprasza', () => {
    expect(tekstZaproszeniaGoscia('Marek', bazowy, 'Jan Brzos')).toContain('Jan Brzos');
  });

  it('bez podanego zapraszającego nie udaje, że go zna', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy);
    expect(t).toContain('Ktoś zapisał Cię');
    expect(t).not.toContain('undefined');
  });

  // Wpis gościa powstaje PRZED meczem — poprzednia wersja mówiła „Zagraliście
  // razem", czyli zapraszała na przyszłą grę w czasie przeszłym.
  it('mówi o meczu w czasie przyszłym', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy, 'Jan');
    expect(t).not.toMatch(/Zagrali|zagraliście/i);
    expect(t).toContain('zapisał(a) Cię na mecz');
  });

  // „Zobaczysz swój udział" nie jest zachętą: skład widać bez konta.
  it('nie obiecuje rzeczy dostępnych bez konta', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy, 'Jan');
    expect(t).not.toContain('swój udział');
  });

  it('nie zawiera samego linku — link dokłada się osobno, jak w eventShareText', () => {
    expect(tekstZaproszeniaGoscia('Marek', bazowy)).not.toContain('http');
  });

  it('nie wywraca się na niepoprawnej dacie', () => {
    const t = tekstZaproszeniaGoscia('Marek', { ...bazowy, date: 'bez-sensu' });
    expect(t).toContain('bez-sensu');
  });
});
