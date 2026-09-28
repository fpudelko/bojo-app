import { describe, it, expect } from 'vitest';
import { metadataDlaMeczu, stanPodgladu, type EventMeta } from '@/app/wydarzenia/[id]/eventMeta';

// Bliźniak structuredData.test.ts, tylko dla metadanych. Powód osobnego pliku:
// JSON-LD był chroniony progiem widoczności od początku, a <title>, description
// i og: NIE — i to przeszło niezauważone, bo nic tego nie sprawdzało.

// Data „jutro", nie data na sztywno — sztywna data w przyszłości przestaje nią
// być z upływem czasu i test zaczyna padać sam z siebie, niezależnie od zmian
// w kodzie (zdarzyło się: `2026-09-12` jako „nadchodzący mecz" pod datą
// `2026-09-13`). Ten sam wzorzec co `addDays`/`ymd` w `eventDates.test.ts`.
function jutro(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mecz(overrides: Partial<EventMeta> = {}): EventMeta {
  return {
    title: 'Gierka na Ratajach',
    sport: 'piłka nożna',
    date: jutro(),
    time: '18:00',
    field_name: 'Orlik Rataje',
    custom_address: 'ul. Kwiatowa 3, Poznań',
    visibility: 'public',
    max_players: 12,
    cost_grosz: 2000,
    lat: null,
    lng: null,
    ...overrides,
  };
}

/** Wszystko, co w metadanych mogłoby zdradzić prywatny mecz. */
function ujawnia(meta: unknown): string {
  return JSON.stringify(meta);
}

describe('metadataDlaMeczu — próg widoczności', () => {
  for (const visibility of ['private', 'group', 'nieznana-wartosc']) {
    it(`nie ujawnia nazwy, terminu ani miejsca dla visibility="${visibility}"`, () => {
      const meta = metadataDlaMeczu('abc', mecz({ visibility }));
      const tekst = ujawnia(meta);

      expect(tekst).not.toContain('Gierka na Ratajach');
      expect(tekst).not.toContain('Orlik Rataje');
      expect(tekst).not.toContain(jutro());
      expect(tekst).not.toContain('18:00');
      expect(tekst).not.toContain('Kwiatowa');
    });

    it(`trzyma visibility="${visibility}" poza indeksem`, () => {
      const meta = metadataDlaMeczu('abc', mecz({ visibility }));
      expect(meta.robots).toEqual({ index: false, follow: false });
      expect(meta.alternates?.canonical).toBeUndefined();
    });
  }

  it('mecz, którego nie ma, wygląda tak samo jak prywatny', () => {
    expect(metadataDlaMeczu('abc', null)).toEqual(metadataDlaMeczu('abc', mecz({ visibility: 'private' })));
  });
});

describe('metadataDlaMeczu — mecz publiczny', () => {
  it('opisuje mecz i wskazuje canonical', () => {
    const meta = metadataDlaMeczu('abc', mecz());

    expect(meta.title).toContain('Gierka na Ratajach');
    expect(meta.description).toContain('Orlik Rataje');
    expect(meta.alternates?.canonical).toBe('/wydarzenia/abc');
    expect(meta.robots).toBeUndefined();
  });

  it('nie dokłada ręcznego sufiksu „| Bojo” — robi to title.template z layoutu', () => {
    const meta = metadataDlaMeczu('abc', mecz());
    expect(String(meta.title)).not.toContain('| Bojo');
  });

  it('bez własnego tytułu bierze nazwę domyślną z lib/eventTitle', () => {
    const meta = metadataDlaMeczu('abc', mecz({ title: undefined }));
    expect(String(meta.title).length).toBeGreaterThan(0);
    expect(String(meta.title)).not.toContain('undefined');
  });
});

describe('metadataDlaMeczu — polityka cyklu życia strony meczu (roadmapa poz. 21)', () => {
  it('miniony publiczny mecz wypada z indeksu, ale zostaje widoczny dla ludzi i robota', () => {
    const meta = metadataDlaMeczu('abc', mecz({ date: '2020-01-01', time: '18:00' }));

    expect(meta.robots).toEqual({ index: false, follow: true });
    // Treść zostaje — to nie ten sam próg co dla meczu prywatnego (P1): podgląd
    // linku do minionego meczu ma dalej pokazywać, co to był za mecz.
    expect(meta.title).toContain('Gierka na Ratajach');
    expect(meta.description).toContain('Orlik Rataje');
    expect(meta.alternates?.canonical).toBe('/wydarzenia/abc');
  });

  it('nadchodzący publiczny mecz zostaje indeksowalny (robots nieustawione)', () => {
    const meta = metadataDlaMeczu('abc', mecz({ date: jutro(), time: '18:00' }));
    expect(meta.robots).toBeUndefined();
  });

  it('brak godziny traktuje dzień miniony jako miniony (domyślnie 00:00)', () => {
    const meta = metadataDlaMeczu('abc', mecz({ date: '2020-01-01', time: undefined }));
    expect(meta.robots).toEqual({ index: false, follow: true });
  });
});

// Z-3 (docs/faza1-runda10-plan.md): podgląd linku na WhatsAppie/Messengerze
// (opengraph-image.tsx) i metadane strony meczu czytają ten sam stan.
describe('stanPodgladu — Z-3', () => {
  it('odmienia liczbę wolnych miejsc (1 / 2-4 / 5+)', () => {
    expect(stanPodgladu(mecz({ max_players: 14 }), 13).pigulka).toBe('1 wolne miejsce');
    expect(stanPodgladu(mecz({ max_players: 14 }), 12).pigulka).toBe('2 wolne miejsca');
    expect(stanPodgladu(mecz({ max_players: 14 }), 9).pigulka).toBe('5 wolnych miejsc');
    expect(stanPodgladu(mecz({ max_players: 14 }), 2).pigulka).toBe('12 wolnych miejsc');
  });

  it('wolne miejsca: wyróżnia pigułkę i pozwala na argument bez konta', () => {
    const stan = stanPodgladu(mecz({ max_players: 14 }), 12);
    expect(stan.wyroznij).toBe(true);
    expect(stan.bezKonta).toBe(true);
  });

  it('odwołany mecz — bez wolnych miejsc i bez argumentu bez konta, mimo wolnych miejsc', () => {
    const stan = stanPodgladu(mecz({ max_players: 14, status: 'cancelled' }), 2);
    expect(stan.pigulka).toBe('Mecz odwołany');
    expect(stan.wyroznij).toBe(false);
    expect(stan.bezKonta).toBe(false);
  });

  it('mecz rozegrany (data i godzina w przeszłości, liczone w czasie polskim)', () => {
    const stan = stanPodgladu(mecz({ date: '2020-01-01', time: '18:00' }), 0);
    expect(stan.pigulka).toBe('Mecz rozegrany');
    expect(stan.bezKonta).toBe(false);
  });

  it('zapisy zamknięte wygrywają nad wolnymi miejscami', () => {
    const stan = stanPodgladu(mecz({ max_players: 14, zapisy_zamkniete: true }), 2);
    expect(stan.pigulka).toBe('Zapisy zamknięte');
    expect(stan.bezKonta).toBe(false);
  });

  it('komplet z rezerwą pozwala na argument bez konta, komplet bez rezerwy — nie', () => {
    const zRezerwa = stanPodgladu(mecz({ max_players: 14, reserve_enabled: true }), 14);
    expect(zRezerwa.pigulka).toBe('Komplet, jest rezerwa');
    expect(zRezerwa.bezKonta).toBe(true);

    const bezRezerwy = stanPodgladu(mecz({ max_players: 14, reserve_enabled: false }), 14);
    expect(bezRezerwy.pigulka).toBe('Komplet');
    expect(bezRezerwy.bezKonta).toBe(false);
  });

  it('mecz bez limitu miejsc — bez pigułki, ale z argumentem bez konta', () => {
    const stan = stanPodgladu(mecz({ max_players: undefined }), 0);
    expect(stan.pigulka).toBe('');
    expect(stan.bezKonta).toBe(true);
  });
});

describe('metadataDlaMeczu — argument „bez konta” (Z-3)', () => {
  it('mecz z wolnymi miejscami dopisuje zdanie o zapisie bez konta', () => {
    const meta = metadataDlaMeczu('abc', mecz({ max_players: 14 }), 12);
    expect(meta.description).toContain('Zapisujesz się bez zakładania konta.');
    expect(meta.openGraph?.description).toContain('zapis bez konta');
  });

  it('odwołany mecz nie obiecuje zapisu bez konta', () => {
    const meta = metadataDlaMeczu('abc', mecz({ max_players: 14, status: 'cancelled' }), 2);
    expect(meta.description).not.toContain('bez zakładania konta');
    expect(meta.openGraph?.description).not.toContain('zapis bez konta');
  });

  it('prywatny mecz nie zdradza tytułu, miejsca ani daty', () => {
    const meta = metadataDlaMeczu('abc', mecz({ visibility: 'private' }));
    const tekst = ujawnia(meta);
    expect(tekst).not.toContain('Gierka na Ratajach');
    expect(tekst).not.toContain('Orlik Rataje');
    expect(tekst).not.toContain(jutro());
  });
});
