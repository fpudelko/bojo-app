import { describe, it, expect } from 'vitest';
import { metadataDlaMeczu, type EventMeta } from '@/app/wydarzenia/[id]/eventMeta';

// Bliźniak structuredData.test.ts, tylko dla metadanych. Powód osobnego pliku:
// JSON-LD był chroniony progiem widoczności od początku, a <title>, description
// i og: NIE — i to przeszło niezauważone, bo nic tego nie sprawdzało.

// Data liczona od DZIŚ, nie wpisana na sztywno. Poprzednio stało tu
// `2026-09-12` — w dniu pisania testu data przyszła, nazajutrz miniona. Dwa
// testy progu indeksowania (`robots` nieustawione dla NADCHODZĄCEGO meczu)
// zaczęły więc padać same z siebie, bez żadnej zmiany w kodzie, i wywracały
// CI na masterze. Ten sam mechanizm co w seedach wizualnych, gdzie daty liczą
// się jako stałe ODSTĘPY od dnia uruchomienia (patrz AGENTS.md).
const ZA_TRZY_DNI = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);

function mecz(overrides: Partial<EventMeta> = {}): EventMeta {
  return {
    title: 'Gierka na Ratajach',
    sport: 'piłka nożna',
    date: ZA_TRZY_DNI,
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
      expect(tekst).not.toContain(ZA_TRZY_DNI);
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
    const meta = metadataDlaMeczu('abc', mecz({ date: ZA_TRZY_DNI, time: '18:00' }));
    expect(meta.robots).toBeUndefined();
  });

  it('brak godziny traktuje dzień miniony jako miniony (domyślnie 00:00)', () => {
    const meta = metadataDlaMeczu('abc', mecz({ date: '2020-01-01', time: undefined }));
    expect(meta.robots).toEqual({ index: false, follow: true });
  });
});
