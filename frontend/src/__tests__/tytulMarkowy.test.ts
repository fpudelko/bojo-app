import { describe, it, expect } from 'vitest';
import {
  TYTUL_DOMYSLNY, OPIS_DOMYSLNY, TYTUL_DLACZEGO, HASLO_PODGLADU,
} from '@/content/metaWyszukiwarki';
import { ZAKAZANE_WSZEDZIE } from '@/content/zakazaneFrazy';

// Kontrakt na wynik wyszukiwania dla zapytania MARKOWEGO — jedynego klastra,
// na którym Bojo dziś realnie się wyświetla.
//
// Pomiar bazowy w Search Console (docs/seo-geo-strategia.md 7a.2, 2026-08-29):
// 56 wyświetleń, 0 kliknięć, średnia pozycja 9,4, wszystkie zapytania markowe
// („co to bojo", „bojo", „bojo co to"). Przyczyna zera kliknięć jest nazwana
// w rozdz. 2c: „bojo" to w polszczyźnie potocznej „boisko", więc wynik stoi obok
// definicji słownikowej i musi się od niej odróżnić w samym tytule. Robi to
// wyłącznie RZECZOWNIK KATEGORII — dopóki go tam nie było, każde słowo tytułu
// („boiska", „zagraj", „zbierz ekipę") potwierdzało odczytanie słownikowe.
//
// Ten plik istnieje, bo do 2026-09-01 ŻADEN test nie pilnował tych ciągów.
// Metadane nie mają odpowiednika w interfejsie, więc ich utrata nie zapala się
// ani w zrzutach ekranu, ani w Playwrighcie — dokładnie ta cisza sprawiła, że
// Fazy 1 i 2b stały odhaczone jako zrobione i niedziałające dla robota.

/** Rzeczownik kategorii — jedyne słowo odróżniające encję od słowa pospolitego. */
const KATEGORIA = /aplikacja/i;

describe('tytuł i opis dla zapytania markowego', () => {
  it('tytuł domyślny nazywa kategorię produktu, nie tylko markę', () => {
    expect(TYTUL_DOMYSLNY).toMatch(KATEGORIA);
  });

  it('tytuł domyślny niesie domenę, bo sama nazwa jest słowem ze słownika', () => {
    expect(TYTUL_DOMYSLNY).toContain('bojo.pl');
  });

  it('tytuł domyślny mieści się w szerokości wyniku wyszukiwania', () => {
    // ~60–65 znaków to granica, za którą Google ucina tytuł wielokropkiem.
    // Rzeczownik kategorii ma zostać PO tej stronie ucięcia.
    expect(TYTUL_DOMYSLNY.length).toBeLessThanOrEqual(65);
    expect(TYTUL_DOMYSLNY.search(KATEGORIA)).toBeLessThan(60);
  });

  it('tytuł domyślny nie dokłada ręcznego sufiksu „| Bojo”', () => {
    // `title.template` z layoutu dokłada go stronom podrzędnym; na tytule
    // domyślnym ręczny sufiks dałby „| Bojo | Bojo" (dług P3, pilnuje tego
    // też scripts/audyt-robota.mjs).
    expect(TYTUL_DOMYSLNY).not.toContain('| Bojo');
  });

  it('opis odpowiada na pytanie „co to jest”, nazywając Bojo po imieniu', () => {
    // Sekcja wyrwana z kontekstu musi nazywać encję wprost — ta sama zasada
    // co w llm-context.md i w disambiguatingDescription (rozdz. 5a).
    expect(OPIS_DOMYSLNY.startsWith('Bojo')).toBe(true);
    expect(OPIS_DOMYSLNY).toMatch(KATEGORIA);
  });

  it('opis mieści się w długości, którą wyszukiwarka pokazuje bez ucięcia', () => {
    expect(OPIS_DOMYSLNY.length).toBeLessThanOrEqual(160);
  });

  it('opis nie obiecuje funkcji, których Bojo nie ma', () => {
    for (const wzorzec of ZAKAZANE_WSZEDZIE) {
      expect(OPIS_DOMYSLNY).not.toMatch(new RegExp(wzorzec, 'i'));
    }
  });

  it('/dlaczego-bojo — druga zaindeksowana strona — też nazywa kategorię', () => {
    // Wyświetla się na te same zapytania markowe co landing, więc trafia do
    // kogoś, kto jeszcze nie wie, czym Bojo jest.
    expect(TYTUL_DLACZEGO).toMatch(KATEGORIA);
  });

  it('hasło podglądu zostaje osobnym ciągiem, nie zlewa się z tytułem w SERP-ie', () => {
    // Regresja w drugą stronę: gdyby ktoś „ujednolicił" wszystkie powierzchnie,
    // wynik wyszukiwania wróciłby do stanu, który dał zero kliknięć.
    expect(HASLO_PODGLADU).not.toBe(TYTUL_DOMYSLNY);
    expect(HASLO_PODGLADU).not.toMatch(KATEGORIA);
  });
});
