import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import KartaDruzyny from '@/components/turnieje/KartaDruzyny';
import type { TurniejDruzyna, TurniejZawodnik } from '@/types';

// Skład drużyny turniejowej — jedyne miejsce w module, z którego da się wyjść
// na profil konkretnego człowieka.
//
// SKĄD TEN PLIK. Skład stoi za ścianą logowania (RLS, migracja `145`), więc nie
// widzi go ŻADEN zrzut: `wizualne.spec.ts` chodzi bez bazy i bez konta, a na
// liście drużyn zobaczy wyłącznie zaproszenie do logowania. Reguła „zawodnik
// z kontem jest odnośnikiem, zawodnik dopisany z ręki nie jest" nie miała
// dotąd gdzie się zepsuć głośno.

afterEach(cleanup);

const zawodnik = (nadpisz: Partial<TurniejZawodnik> = {}): TurniejZawodnik => ({
  id: 'z1', druzynaId: 'd1', turniejId: 't1', imie: 'Jakub Kowalski',
  numer: 1, kapitan: false, createdAt: '2026-09-01T10:00:00Z', ...nadpisz,
});

const druzyna = (zawodnicy: TurniejZawodnik[]): TurniejDruzyna => ({
  id: 'd1', turniejId: 't1', nazwa: 'Dragon Team', status: 'przyjeta',
  kodDolaczenia: 'ABC123', dodanaRecznie: true, liczbaZawodnikow: zawodnicy.length,
  zawodnicy, createdAt: '2026-09-01T10:00:00Z',
});

function pokazSklad(d: TurniejDruzyna) {
  render(<KartaDruzyny d={d} zalogowany czyMoja={false} onZamienWEkipe={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /Pokaż skład/ }));
}

describe('KartaDruzyny — skład', () => {
  it('zawodnik z kontem prowadzi do swojego profilu', () => {
    pokazSklad(druzyna([zawodnik({ userId: 'u-1', imie: 'Jakub Kowalski' })]));
    expect(screen.getByRole('link', { name: /Jakub Kowalski/ }))
      .toHaveAttribute('href', '/gracz/u-1');
  });

  it('zawodnik BEZ konta nie jest odnośnikiem — nie ma dokąd prowadzić', () => {
    pokazSklad(druzyna([zawodnik({ userId: undefined, imie: 'Dopisany Ręcznie' })]));
    expect(screen.getByText('Dopisany Ręcznie')).toBeDefined();
    expect(screen.queryByRole('link', { name: /Dopisany Ręcznie/ })).toBeNull();
  });

  it('skład mieszany: odnośnik dostaje tylko ten z kontem', () => {
    pokazSklad(druzyna([
      zawodnik({ id: 'z1', userId: 'u-1', imie: 'Z Kontem', numer: 1 }),
      zawodnik({ id: 'z2', userId: undefined, imie: 'Bez Konta', numer: 2 }),
    ]));
    // Liczymy odnośniki W SAMYM SKŁADZIE, nie w całej karcie: poza listą stoi
    // jeszcze wejście na ekran drużyny (niżej), a asercja o „dokładnie jednym
    // odnośniku w karcie" psułaby się przy każdym nowym przycisku, zamiast
    // pilnować reguły, o którą naprawdę chodzi.
    const sklad = screen.getByRole('list');
    expect(sklad.querySelectorAll('a')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /Z Kontem/ })).toHaveAttribute('href', '/gracz/u-1');
  });

  it('karta prowadzi na ekran drużyny — tam mieszka link do wysłania kolegom', () => {
    pokazSklad(druzyna([zawodnik({ userId: 'u-1', imie: 'Jakub Kowalski' })]));
    expect(screen.getByRole('link', { name: /Otwórz drużynę/ }))
      .toHaveAttribute('href', '/turnieje/t1/druzyna/d1');
  });

  it('kapitan widzi to samo wejście pod nazwą „Zarządzaj drużyną"', () => {
    const d = druzyna([zawodnik({ userId: 'u-1', imie: 'Jakub Kowalski' })]);
    render(<KartaDruzyny d={d} zalogowany czyMoja onZamienWEkipe={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Pokaż skład/ }));
    expect(screen.getByRole('link', { name: /Zarządzaj drużyną/ }))
      .toHaveAttribute('href', '/turnieje/t1/druzyna/d1');
  });

  it('niezalogowany widzi ścianę logowania zamiast nazwisk', () => {
    const d = druzyna([zawodnik({ userId: 'u-1', imie: 'Jakub Kowalski' })]);
    render(<KartaDruzyny d={d} zalogowany={false} czyMoja={false} onZamienWEkipe={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Pokaż skład/ }));
    expect(screen.queryByText('Jakub Kowalski')).toBeNull();
    expect(screen.getByRole('link', { name: /Zaloguj się/ })).toBeDefined();
  });

  it('karta jest zwinięta, dopóki ktoś jej nie otworzy', () => {
    const d = druzyna([zawodnik({ userId: 'u-1' })]);
    render(<KartaDruzyny d={d} zalogowany czyMoja={false} onZamienWEkipe={() => {}} />);
    expect(screen.getByRole('button', { name: /Pokaż skład/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Jakub Kowalski')).toBeNull();
  });

  // Karta była JEDNYM przyciskiem rozwijającym, więc nazwa drużyny nie
  // prowadziła nigdzie: do ekranu drużyny trzeba było najpierw rozwinąć
  // kartę, a potem kliknąć odnośnik w środku. Kapitan nie miał drogi do
  // własnej drużyny inaczej niż przez zachowany link (audyt wiarygodności
  // 2026-09-23). Teraz nazwa jest odnośnikiem, a skład rozwija osobny cel.
  it('nazwa drużyny jest odnośnikiem, bez rozwijania karty', () => {
    const d = druzyna([zawodnik({ userId: 'u-1' })]);
    render(<KartaDruzyny d={d} zalogowany czyMoja={false} onZamienWEkipe={() => {}} />);
    expect(screen.getByRole('link', { name: /Dragon Team/ }))
      .toHaveAttribute('href', '/turnieje/t1/druzyna/d1');
  });

  it('rozwijanie składu to OSOBNY cel, więc kliknięcie nazwy nie rozwija', () => {
    const d = druzyna([zawodnik({ userId: 'u-1', imie: 'Jakub Kowalski' })]);
    render(<KartaDruzyny d={d} zalogowany czyMoja={false} onZamienWEkipe={() => {}} />);
    fireEvent.click(screen.getByRole('link', { name: /Dragon Team/ }));
    expect(screen.queryByText('Jakub Kowalski')).toBeNull();
  });
});
