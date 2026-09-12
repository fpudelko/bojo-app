import { describe, it, expect } from 'vitest';
import {
  plakietkaStanuZapisow,
  pasekStanuZapisow,
  kolorPaskaStanuZapisow,
  PLAKIETKA_ZAPISY_ZAMKNIETE,
  PASEK_ZAPISY_ZAMKNIETE,
  KOLOR_PASKA_ZAPISY_ZAMKNIETE,
} from '@/lib/stanZapisow';
import { PLAKIETKA_KOMPLET, PASEK_KOMPLET, KOLOR_PASKA_KOMPLET } from '@/lib/komplet';

// Reguła pierwszeństwa dla piątego stanu karty (migracja `141`).
//
// PO CO TO PILNOWAĆ. Ten sam stan malowały kiedyś cztery karty i każda inaczej —
// dwa odcienie czerwieni, szarość, pasek raz zielony, raz bursztynowy; po to
// powstało `lib/komplet.ts`. „Zapisy zamknięte" to piąty stan wchodzący na te
// same cztery karty PLUS pinezkę mapy, więc reguła musi mieć jedno miejsce
// i jeden test — inaczej za pół roku będą cztery różne szarości i dwa różne
// zdania o tym, co wygrywa z czym.

describe('plakietkaStanuZapisow — co wygrywa z czym', () => {
  it('zamknięte zapisy wygrywają z kompletem', () => {
    // Przy zamkniętych zapisach czytający kartę ma odpowiedź „nie wejdziesz"
    // niezależnie od tego, ile miejsc zostało — komplet nie wnosi już nic,
    // a dwie plakietki mówiłyby to samo dwa razy, w dwóch kolorach.
    expect(plakietkaStanuZapisow(true, true)).toEqual({
      napis: 'Zapisy zamknięte', klasy: PLAKIETKA_ZAPISY_ZAMKNIETE,
    });
  });

  it('zamknięcie działa TAKŻE przy wolnych miejscach — o to chodzi w R-10', () => {
    // Organizator z 8 na 14 mówi „gramy w tym składzie". Gdyby plakietka
    // zależała od kompletu, ten mecz wyglądałby na otwarty.
    expect(plakietkaStanuZapisow(true, false)?.napis).toBe('Zapisy zamknięte');
  });

  it('sam komplet zostaje kompletem — niebieski, jak dotąd', () => {
    expect(plakietkaStanuZapisow(false, true)).toEqual({
      napis: 'Komplet', klasy: PLAKIETKA_KOMPLET,
    });
  });

  it('otwarty mecz z wolnymi miejscami nie ma plakietki — karta rysuje licznik', () => {
    expect(plakietkaStanuZapisow(false, false)).toBeNull();
  });

  it('szarość nie jest przypadkiem czerwienią ani błękitem', () => {
    // Czerwień znaczy w Bojo „coś poszło źle", błękit — „wymaga akceptacji"
    // albo komplet (AGENTS.md). Zamknięte zapisy nie są żadną z tych rzeczy,
    // a podmiana koloru na któryś z nich jest zmianą znaczenia, nie stylu.
    expect(PLAKIETKA_ZAPISY_ZAMKNIETE).toContain('slate');
    expect(PLAKIETKA_ZAPISY_ZAMKNIETE).not.toContain('red');
    expect(PLAKIETKA_ZAPISY_ZAMKNIETE).not.toContain('blue');
    expect(PLAKIETKA_ZAPISY_ZAMKNIETE).not.toBe(PLAKIETKA_KOMPLET);
  });
});

describe('pasek zapełnienia — ta sama reguła, dwie postaci', () => {
  // Dwie karty malują pasek KLASĄ, dwie STYLEM (i pinezka mapy też stylem).
  // Obie drogi muszą dawać ten sam odcień, inaczej wracamy do stanu sprzed
  // `komplet.ts` — ta sama rzecz w dwóch kolorach zależnie od ekranu.
  it('klasa: zamknięcie wygrywa z kompletem i z domyślnym', () => {
    expect(pasekStanuZapisow(true, true, 'bg-primary-600')).toBe(PASEK_ZAPISY_ZAMKNIETE);
    expect(pasekStanuZapisow(false, true, 'bg-primary-600')).toBe(PASEK_KOMPLET);
    expect(pasekStanuZapisow(false, false, 'bg-primary-600')).toBe('bg-primary-600');
  });

  it('styl: ta sama kolejność', () => {
    expect(kolorPaskaStanuZapisow(true, true, '#16a34a')).toBe(KOLOR_PASKA_ZAPISY_ZAMKNIETE);
    expect(kolorPaskaStanuZapisow(false, true, '#16a34a')).toBe(KOLOR_PASKA_KOMPLET);
    expect(kolorPaskaStanuZapisow(false, false, '#16a34a')).toBe('#16a34a');
  });

  it('klasa i styl opisują TEN SAM odcień', () => {
    // `bg-slate-400` w Tailwindzie to `#94a3b8`. Gdyby ktoś zmienił jedno
    // i zapomniał o drugim, karty rozjechałyby się o pół tonu — dokładnie
    // ten rodzaj rozjazdu, którego nikt nie zgłasza, bo każdy ekran z osobna
    // wygląda dobrze.
    expect(PASEK_ZAPISY_ZAMKNIETE).toBe('bg-slate-400');
    expect(KOLOR_PASKA_ZAPISY_ZAMKNIETE).toBe('#94a3b8');
  });
});
