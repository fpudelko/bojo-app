import { describe, it, expect } from 'vitest';
import { tekstZaproszeniaGoscia, type KontekstZaproszenia } from '@/lib/guestClaim';
import { KORZYSCI_KONTA } from '@/content/kontoGoscia';
import type { DaneDoUdostepnienia } from '@/lib/eventShare';

// Z-4 (docs/faza1-runda10-plan.md): poprzednia wersja tego tekstu zawsze mówiła
// „Masz miejsce w składzie" (nieprawda dla rezerwy i po meczu) i obiecywała
// konto trzema rzeczami, z których dwie F-6 już raz uznało za nieprawdziwe na
// pozostałych ekranach tej samej ścieżki. Trzy warianty (skład / rezerwa / po
// meczu) mają teraz osobne, prawdziwe treści.

const bazowy: DaneDoUdostepnienia = {
  sport: 'piłka nożna',
  title: undefined,
  maxPlayers: 14,
  date: '2026-08-20',
  time: '18:00:00',
  endTime: '19:30:00',
  costGrosze: 0,
};

const SKLAD: KontekstZaproszenia = { naRezerwie: false, poMeczu: false, blik: false };
const SKLAD_BLIK: KontekstZaproszenia = { naRezerwie: false, poMeczu: false, blik: true };
const REZERWA: KontekstZaproszenia = { naRezerwie: true, poMeczu: false, blik: false };
const PO_MECZU: KontekstZaproszenia = { naRezerwie: false, poMeczu: true, blik: false };

describe('tekstZaproszeniaGoscia — przed meczem, w składzie', () => {
  it('zawiera imię gościa i tytuł meczu (domyślny, gdy organizator nie podał własnego)', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy, SKLAD);
    expect(t).toContain('Marek');
    expect(t).toContain('Piłka nożna 7v7');
  });

  it('używa własnego tytułu, gdy organizator go podał', () => {
    const t = tekstZaproszeniaGoscia('Marek', { ...bazowy, title: 'Środowa gierka' }, SKLAD);
    expect(t).toContain('Środowa gierka');
  });

  it('podpisuje się osobą, która zaprasza', () => {
    expect(tekstZaproszeniaGoscia('Marek', bazowy, SKLAD, 'Jan Brzos')).toContain('Jan Brzos');
  });

  it('bez podanego zapraszającego nie udaje, że go zna', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy, SKLAD);
    expect(t).toContain('Ktoś zapisał Cię');
    expect(t).not.toContain('undefined');
  });

  // Wpis gościa powstaje PRZED meczem — poprzednia wersja mówiła „Zagraliście
  // razem", czyli zapraszała na przyszłą grę w czasie przeszłym.
  it('mówi o meczu w czasie przyszłym', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy, SKLAD, 'Jan');
    expect(t).not.toMatch(/Zagrali|zagraliście/i);
    expect(t).toContain('zapisał(a) Cię na mecz');
  });

  it('mówi, co link daje BEZ KONTA — skład, miejsce, koszt, „Nie mogę grać”', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy, SKLAD);
    expect(t).toContain('bez zakładania konta');
    expect(t).toContain('skład, miejsce i koszt');
    expect(t).toContain('Nie mogę grać');
  });

  // Z-5 (docs/faza1-runda10-plan.md): trzeci punkt zapowiada, że e-mail można
  // zostawić pod tym samym linkiem (migracja 168) — bez tego zdania nikt by
  // się nie domyślił, że strona wpisu ma teraz taką możliwość.
  it('zapowiada przypomnienie mailowe, jeśli gość zostawi adres', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy, SKLAD);
    expect(t).toContain('przypomnienie dzień przed na e-mail, jeśli zostawisz adres');
  });

  it('nie stawia ściany konta — brak wezwania do zakładania konta', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy, SKLAD);
    expect(t).not.toContain('Załóż konto');
    expect(t).not.toContain('Google');
  });

  it('dokłada numer BLIK tylko, gdy mecz go przyjmuje', () => {
    expect(tekstZaproszeniaGoscia('Marek', bazowy, SKLAD)).not.toContain('BLIK');
    expect(tekstZaproszeniaGoscia('Marek', bazowy, SKLAD_BLIK)).toContain('BLIK');
  });

  it('nie zawiera samego linku — link dokłada się osobno, jak w eventShareText', () => {
    expect(tekstZaproszeniaGoscia('Marek', bazowy, SKLAD)).not.toContain('http');
  });

  it('nie wywraca się na niepoprawnej dacie', () => {
    const t = tekstZaproszeniaGoscia('Marek', { ...bazowy, date: 'bez-sensu' }, SKLAD);
    expect(t).toContain('bez-sensu');
  });

  it('nie obiecuje ekipy, otwartych gier w okolicy ani własnych gier', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy, SKLAD);
    expect(t).not.toContain('ekip');
    expect(t).not.toContain('otwart');
    expect(t).not.toContain('własnych gier');
  });
});

describe('tekstZaproszeniaGoscia — przed meczem, na rezerwie', () => {
  it('mówi o liście rezerwowej, nie o miejscu w składzie', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy, REZERWA);
    expect(t).toContain('listę rezerwową');
    expect(t).not.toContain('Masz miejsce w składzie');
  });

  it('mówi, co link daje bez konta — kolejka i „Nie mogę grać”', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy, REZERWA);
    expect(t).toContain('bez zakładania konta');
    expect(t).toContain('Twoje miejsce w kolejce');
    expect(t).toContain('Nie mogę grać');
    expect(t).toContain('przypomnienie dzień przed na e-mail, jeśli zostawisz adres');
  });

  it('nie zawiera samego linku', () => {
    expect(tekstZaproszeniaGoscia('Marek', bazowy, REZERWA)).not.toContain('http');
  });
});

describe('tekstZaproszeniaGoscia — po meczu', () => {
  it('mówi o meczu w czasie przeszłym i prosi o konto', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy, PO_MECZU);
    expect(t).toMatch(/Dzięki za mecz/);
    expect(t).toContain('załóż konto');
  });

  // Jedno źródło z oknem po zapisie na stronie meczu i stroną
  // `/gracz/przejmij/[token]` (content/kontoGoscia.ts, F-6) — trzy miejsca tej
  // samej ścieżki nie mogą obiecywać trzech różnych rzeczy.
  it('zawiera dosłownie każdą pozycję KORZYSCI_KONTA', () => {
    const t = tekstZaproszeniaGoscia('Marek', bazowy, PO_MECZU);
    for (const pozycja of KORZYSCI_KONTA) {
      expect(t).toContain(pozycja);
    }
  });

  it('nie zawiera samego linku', () => {
    expect(tekstZaproszeniaGoscia('Marek', bazowy, PO_MECZU)).not.toContain('http');
  });
});

describe('tekstZaproszeniaGoscia — bez długiego myślnika', () => {
  it('żaden wariant nie zawiera „—” (U+2014)', () => {
    for (const k of [SKLAD, SKLAD_BLIK, REZERWA, PO_MECZU]) {
      expect(tekstZaproszeniaGoscia('Marek', bazowy, k)).not.toContain('—');
    }
  });
});
