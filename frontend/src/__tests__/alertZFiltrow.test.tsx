import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SportChip from '@/components/ui/SportChip';
import { domyslneZFiltrow, PROMIEN_DOMYSLNY } from '@/lib/alerts';
import { PROMIENIE_SUWAK_KM } from '@/lib/miejscowosci';

afterEach(cleanup);

// Wejście do alertu („Powiadom mnie, gdy się pojawi") siedzi w pustym stanie
// listy meczów, czyli dokładnie tam, gdzie filtry już opisują, czego ktoś
// szuka. Dwie rzeczy, które łatwo zgniją po cichu, bo widać je dopiero po
// przeklikaniu się do pustego wyniku.

describe('domyslneZFiltrow — okno alertu nie pyta o to, co już powiedziały filtry', () => {
  it('jeden wybrany sport przenosi się do alertu', () => {
    const d = domyslneZFiltrow({ sports: ['koszykówka'], radiusKm: null, pozycja: null });
    expect(d.sports).toEqual(['koszykówka']);
  });

  it('DWA sporty też się przenoszą — od migracji `152` alert łapie wiele naraz', () => {
    // Wcześniej alert trzymał dokładnie jeden sport, więc przy dwóch filtrach
    // okno startowało z „dowolnego" i człowiek dostawał także to, czego nie
    // szukał. To jest ta poprawka, nie kosmetyka.
    const d = domyslneZFiltrow({ sports: ['koszykówka', 'siatkówka'], radiusKm: null, pozycja: null });
    expect(d.sports).toEqual(['koszykówka', 'siatkówka']);
  });

  it('brak sportu w filtrach to „dowolny", czyli pusta lista', () => {
    expect(domyslneZFiltrow({ sports: [], radiusKm: null, pozycja: null }).sports).toEqual([]);
  });

  it('kopiuje listę, nie oddaje tej samej tablicy co filtry', () => {
    // Okno alertu odznacza sporty przez `setSporty`, a wspólna referencja
    // znaczyłaby, że dotknięcie ikony w oknie zmienia filtry listy pod spodem.
    const filtry = { sports: ['piłka nożna'], radiusKm: null, pozycja: null };
    expect(domyslneZFiltrow(filtry).sports).not.toBe(filtry.sports);
  });

  it('promień z filtrów trafia na najbliższy przystanek skali, nie między dwa', () => {
    // Od 2026-09-14 okno alertu używa TEJ SAMEJ skali co filtry
    // (`PROMIENIE_SUWAK_KM`), więc 8 km — które przystankiem nie jest —
    // siada na 7, a nie zostaje wartością, której suwak nie umie pokazać.
    expect(domyslneZFiltrow({ sports: [], radiusKm: 8, pozycja: null }).radiusKm).toBe(7);
    expect(domyslneZFiltrow({ sports: [], radiusKm: 10, pozycja: null }).radiusKm).toBe(10);
  });

  it('cały zakres filtrów mieści się w alercie — nic już nie jest przycinane', () => {
    // Dawniej alert miał własny, węższy zakres 3–30 km i wartości spoza niego
    // przycinał: kto szukał w promieniu 1 km, dostawał alert na 3 km, czyli
    // o czymś innym, niż prosił. Skala jest teraz wspólna, więc oba skraje
    // przechodzą bez zmiany.
    expect(domyslneZFiltrow({ sports: [], radiusKm: 1, pozycja: null }).radiusKm).toBe(1);
    expect(domyslneZFiltrow({ sports: [], radiusKm: 100, pozycja: null }).radiusKm).toBe(100);
  });

  it('promień alertu zawsze jest przystankiem skali suwaka', () => {
    for (const km of [1, 4, 8, 13, 33, 99, 500]) {
      const wynik = domyslneZFiltrow({ sports: [], radiusKm: km, pozycja: null }).radiusKm;
      expect(PROMIENIE_SUWAK_KM).toContain(wynik);
    }
  });

  it('bez promienia w filtrach — wartość domyślna, nie zero', () => {
    expect(domyslneZFiltrow({ sports: [], radiusKm: null, pozycja: null }).radiusKm).toBe(PROMIEN_DOMYSLNY);
  });

  it('pozycja gracza przenosi się, gdy lista ją zna', () => {
    const d = domyslneZFiltrow({ sports: [], radiusKm: null, pozycja: { lat: 52.4, lng: 16.9 } });
    expect(d.lat).toBe(52.4);
    expect(d.lng).toBe(16.9);
  });
});

describe('SportChip — sama ikona, nazwa tylko dla dostępności', () => {
  it('niewybrany sport to sama ikona, ale nazwa zostaje dla czytnika ekranu', () => {
    render(<SportChip emoji="🏐" label="Siatkówka" selected={false} onClick={() => {}} />);
    const chip = screen.getByRole('button', { name: 'Siatkówka' });
    expect(chip.textContent).toBe('🏐');
    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });

  it('WYBRANY sport też jest samą ikoną — podpis stoi pod rzędem, nie w pigułce', () => {
    // Sedno zmiany z 2026-09-14: gdyby nazwa wracała do środka, wybrana ikona
    // rosłaby w poziomie i przestawiała cały rząd pod palcem.
    render(<SportChip emoji="🏐" label="Siatkówka" selected onClick={() => {}} />);
    const chip = screen.getByRole('button', { name: 'Siatkówka' });
    expect(chip.textContent).toBe('🏐');
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });

  it('wybór zmienia tylko wygląd, a szerokość zostaje ta sama', () => {
    const { rerender } = render(<SportChip emoji="🏐" label="Siatkówka" selected={false} onClick={() => {}} />);
    const klasyNiewybranej = screen.getByRole('button', { name: 'Siatkówka' }).className;
    rerender(<SportChip emoji="🏐" label="Siatkówka" selected onClick={() => {}} />);
    const klasyWybranej = screen.getByRole('button', { name: 'Siatkówka' }).className;
    for (const rozmiar of ['h-11', 'w-11']) {
      expect(klasyNiewybranej).toContain(rozmiar);
      expect(klasyWybranej).toContain(rozmiar);
    }
  });
});

describe('okno alertu ma WŁASNE pole miejscowości', () => {
  // Zgłoszone wprost ze zrzutu: „nie da się lokalizacji wskazać".
  //
  // Przez pół dnia okno nie miało pola miejscowości — zakładaliśmy, że punkt
  // przyjdzie z filtrów (`domyslneZFiltrow`), a gdyby nie przyszedł, wystarczy
  // przycisk „Użyj mojej lokalizacji". Założenie pomijało przypadek, w którym
  // alert otwiera ktoś, kto filtrów jeszcze nie ruszył, W PRZEGLĄDARCE
  // WBUDOWANEJ W INNĄ APLIKACJĘ — tam geolokalizacja bywa zablokowana i okno
  // kończyło się ślepo: przycisk, który nic nie daje, i wyszarzony zapis.
  //
  // Test jest statyczny (czyta źródło), bo wyrenderowanie całego okna wymaga
  // atrapy sesji, pusha i Supabase — a pilnowana rzecz jest prostsza niż to:
  // czy w oknie w ogóle JEST kontrolka przyjmująca wpisaną miejscowość.
  // Ten sam wzorzec co `maskiZrzutow.test.ts` i `typyPowiadomien.test.ts`.
  const zrodlo = readFileSync(
    join(process.cwd(), 'src/components/home/AlertSetupDialog.tsx'), 'utf8');

  it('używa `WyborMiejscowosci`, czyli pola na nazwę albo kod pocztowy', () => {
    expect(zrodlo).toContain("from '@/components/map/WyborMiejscowosci'");
    expect(zrodlo).toContain('<WyborMiejscowosci');
  });

  it('nie opiera się WYŁĄCZNIE na przycisku lokalizacji', () => {
    // `PrzyciskMojaLokalizacja` siedzi w środku `WyborMiejscowosci` jako
    // skrót obok pola. Gdyby wrócił tu jako jedyna droga, wróciłby też błąd.
    const samPrzycisk = zrodlo.includes('PrzyciskMojaLokalizacja')
      && !zrodlo.includes('<WyborMiejscowosci');
    expect(samPrzycisk).toBe(false);
  });

  it('pyta też o sport — alert bez tego łapie wszystko, o co nikt nie prosił', () => {
    expect(zrodlo).toContain('<SportChip');
  });
});
