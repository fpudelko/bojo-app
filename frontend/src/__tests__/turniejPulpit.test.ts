import { describe, it, expect } from 'vitest';
import { pulpitPrzedTurniejem, opoznienieWMinutach, arenyTeraz } from '@/lib/turniejPulpit';
import type { TurniejArena, TurniejMecz } from '@/types';

// Pulpit organizatora liczy stan dnia turnieju — jedynego stanu w tym module,
// którego nie da się obejrzeć bez czekania na sobotę. Dlatego „teraz" jest
// argumentem, a nie `new Date()` w środku.

const druzyna = (status: string, oplacone = false) =>
  ({ status, wpisoweOplaconeAt: oplacone ? '2026-10-01T10:00:00Z' : undefined }) as never;

const mecz = (n: Partial<TurniejMecz> = {}): TurniejMecz => ({
  id: `m${n.numer ?? 1}`, turniejId: 't1', numer: n.numer ?? 1, faza: 'grupa',
  status: 'zaplanowany', wynikA: 0, wynikB: 0, wynikRecznie: false,
  createdAt: '2026-10-01T08:00:00Z', ...n,
} as TurniejMecz);

describe('pulpitPrzedTurniejem', () => {
  const turniej = { maxDruzyn: 8, wpisoweGrosze: 10000 };

  it('liczy drużyny ZAJMUJĄCE MIEJSCE: przyjęte i czekające, bez odrzuconych', () => {
    // Reguła jest wspólna z kafelkiem listy i ze stroną turnieju
    // (`liczDruzynyWTurnieju`). Drużyna czekająca na decyzję ma prawo do slotu,
    // dopóki organizator nie odpowie; odrzucona nie zajmuje nic.
    //
    // Wcześniej pulpit liczył wyłącznie przyjęte i pokazywał „0 z 8" w chwili,
    // gdy kafelek obok mówił „1/8" — zgłoszone z testu na żywo.
    const p = pulpitPrzedTurniejem(
      turniej,
      [druzyna('przyjeta'), druzyna('przyjeta'), druzyna('zgloszona'), druzyna('odrzucona')],
      [],
      false,
    );
    expect(p.find((x) => x.klucz === 'druzyny')?.tekst).toBe('3 z 8 drużyn');
  });

  it('wycofana i odrzucona zwalniają miejsce', () => {
    const p = pulpitPrzedTurniejem(
      turniej,
      [druzyna('przyjeta'), druzyna('odrzucona'), druzyna('wycofana')],
      [],
      false,
    );
    expect(p.find((x) => x.klucz === 'druzyny')?.tekst).toBe('1 z 8 drużyn');
  });

  it('czekające zgłoszenia pokazują się osobno — to decyzja do podjęcia', () => {
    const p = pulpitPrzedTurniejem(turniej, [druzyna('zgloszona'), druzyna('zgloszona')], [], false);
    const poz = p.find((x) => x.klucz === 'zgloszenia');
    expect(poz?.tekst).toBe('2 zgłoszeń czeka na decyzję');
    expect(poz?.stan).toBe('uwaga');
  });

  it('nie wymyśla pozycji o zgłoszeniach, gdy żadne nie czeka', () => {
    const p = pulpitPrzedTurniejem(turniej, [druzyna('przyjeta')], [], false);
    expect(p.find((x) => x.klucz === 'zgloszenia')).toBeUndefined();
  });

  it('brak terminarza to stan „brak", nie ostrzeżenie', () => {
    expect(pulpitPrzedTurniejem(turniej, [], [], false).find((x) => x.klucz === 'terminarz')?.stan).toBe('brak');
    expect(pulpitPrzedTurniejem(turniej, [], [mecz()], false).find((x) => x.klucz === 'terminarz')?.stan).toBe('gotowe');
  });

  it('wpisowe i BLIK pokazują się TYLKO przy płatnym turnieju', () => {
    const darmowy = pulpitPrzedTurniejem({ maxDruzyn: 8, wpisoweGrosze: 0 }, [druzyna('przyjeta')], [], false);
    expect(darmowy.find((x) => x.klucz === 'wpisowe')).toBeUndefined();
    expect(darmowy.find((x) => x.klucz === 'blik')).toBeUndefined();
  });

  it('wpisowe liczy się względem PRZYJĘTYCH drużyn', () => {
    const p = pulpitPrzedTurniejem(
      turniej,
      [druzyna('przyjeta', true), druzyna('przyjeta'), druzyna('zgloszona', true)],
      [],
      true,
    );
    expect(p.find((x) => x.klucz === 'wpisowe')?.tekst).toBe('1 z 2 opłaciło wpisowe');
    expect(p.find((x) => x.klucz === 'wpisowe')?.stan).toBe('uwaga');
  });

  it('brak numeru BLIK mówi, co z tego wynika dla kapitanów', () => {
    const p = pulpitPrzedTurniejem(turniej, [druzyna('przyjeta')], [], false);
    expect(p.find((x) => x.klucz === 'blik')?.stan).toBe('brak');
    expect(p.find((x) => x.klucz === 'blik')?.tekst).toContain('kapitanowie');
  });
});

describe('opoznienieWMinutach', () => {
  const teraz = new Date('2026-10-18T11:07:00Z');

  it('mierzy obsuwę najwcześniejszym CZEKAJĄCYM meczem', () => {
    const mecze = [
      mecz({ numer: 1, status: 'zakonczony', zaplanowanyAt: '2026-10-18T10:00:00Z' }),
      mecz({ numer: 2, status: 'zaplanowany', zaplanowanyAt: '2026-10-18T10:55:00Z' }),
      mecz({ numer: 3, status: 'zaplanowany', zaplanowanyAt: '2026-10-18T11:20:00Z' }),
    ];
    expect(opoznienieWMinutach(mecze, teraz)).toBe(12);
  });

  it('zgodnie z planem = null, nie zero', () => {
    const mecze = [mecz({ numer: 2, status: 'zaplanowany', zaplanowanyAt: '2026-10-18T11:20:00Z' })];
    expect(opoznienieWMinutach(mecze, teraz)).toBeNull();
  });

  it('mecze bez godziny nie liczą się do obsuwy', () => {
    const mecze = [mecz({ numer: 2, status: 'zaplanowany', zaplanowanyAt: undefined })];
    expect(opoznienieWMinutach(mecze, teraz)).toBeNull();
  });

  it('turniej rozegrany do końca nie jest spóźniony', () => {
    const mecze = [mecz({ numer: 1, status: 'zakonczony', zaplanowanyAt: '2026-10-18T10:00:00Z' })];
    expect(opoznienieWMinutach(mecze, teraz)).toBeNull();
  });
});

describe('arenyTeraz', () => {
  const areny: TurniejArena[] = [
    { id: 'a1', turniejId: 't1', nazwa: 'Boisko 1', kolejnosc: 1 },
    { id: 'a2', turniejId: 't1', nazwa: 'Boisko 2', kolejnosc: 2 },
    { id: 'a3', turniejId: 't1', nazwa: 'Boisko 3', kolejnosc: 3 },
  ];

  it('pokazuje mecz w toku i pierwszy czekający na każdej arenie', () => {
    const mecze = [
      mecz({ numer: 1, arenaId: 'a1', status: 'trwa' }),
      mecz({ numer: 2, arenaId: 'a1', status: 'zaplanowany', zaplanowanyAt: '2026-10-18T11:20:00Z' }),
      mecz({ numer: 3, arenaId: 'a1', status: 'zaplanowany', zaplanowanyAt: '2026-10-18T11:40:00Z' }),
    ];
    const wynik = arenyTeraz(areny, mecze);
    expect(wynik).toHaveLength(1);
    expect(wynik[0].trwa?.numer).toBe(1);
    expect(wynik[0].nastepny?.numer).toBe(2);
  });

  it('arena bez niczego wypada z listy — pusty wiersz zabiera miejsce na ekranie', () => {
    const mecze = [
      mecz({ numer: 1, arenaId: 'a1', status: 'trwa' }),
      mecz({ numer: 9, arenaId: 'a2', status: 'zakonczony' }),
    ];
    const wynik = arenyTeraz(areny, mecze);
    expect(wynik.map((w) => w.arena.nazwa)).toEqual(['Boisko 1']);
  });

  it('bez godzin porządkuje numerem meczu — drabinka bez przypisanych slotów', () => {
    const mecze = [
      mecz({ numer: 7, arenaId: 'a1', status: 'zaplanowany' }),
      mecz({ numer: 5, arenaId: 'a1', status: 'zaplanowany' }),
    ];
    expect(arenyTeraz(areny, mecze)[0].nastepny?.numer).toBe(5);
  });
});
