import { describe, it, expect } from 'vitest';
import { zrodloWejscia } from '@/lib/analytics';

// Rozdzielenie ruchu na wejściu do strony obiektu — jedyna rzecz, która zamienia
// „116 kliknięć w Search Console" w odpowiedź na pytanie, co ci ludzie robią dalej.
//
// Osobna kategoria dla silników generatywnych jest tu celem, nie ozdobą: warstwa GEO
// strategii (Załącznik A) mierzy dziś ręcznie, czterdziestoma promptami raz na sześć
// tygodni, czy modele w ogóle wspominają o Bojo. Ta funkcja mierzy SKUTEK — czy
// ktokolwiek stamtąd przyszedł.

const DOMENA = 'www.bojo.pl';

describe('zrodloWejscia', () => {
  it('pusty referrer to wejście bezpośrednie, nie zewnętrzne', () => {
    // Realny przypadek: wpisany adres, zakładka, link z aplikacji mobilnej.
    expect(zrodloWejscia('', DOMENA)).toBe('bezposrednie');
    expect(zrodloWejscia(null, DOMENA)).toBe('bezposrednie');
    expect(zrodloWejscia(undefined, DOMENA)).toBe('bezposrednie');
  });

  it('rozpoznaje wyszukiwarki, w tym krajowe warianty Google', () => {
    for (const r of ['https://www.google.com/', 'https://www.google.pl/search?q=boisko', 'https://bing.com/', 'https://duckduckgo.com/']) {
      expect(zrodloWejscia(r, DOMENA)).toBe('wyszukiwarka');
    }
  });

  it('silniki generatywne dostają WŁASNĄ kategorię, nie wpadają do wyszukiwarek', () => {
    for (const r of ['https://chatgpt.com/', 'https://www.perplexity.ai/', 'https://claude.ai/chat/abc', 'https://gemini.google.com/app']) {
      expect(zrodloWejscia(r, DOMENA)).toBe('model');
    }
  });

  it('gemini.google.com to model, mimo że domena kończy się na google', () => {
    // Kolejność sprawdzania ma znaczenie: lista wyszukiwarek zawiera „google.",
    // więc bez sprawdzenia modeli NAJPIERW ten adres zostałby wyszukiwarką.
    expect(zrodloWejscia('https://gemini.google.com/app', DOMENA)).toBe('model');
  });

  it('własna domena to ruch wewnętrzny — nie liczy się jako pozyskanie', () => {
    expect(zrodloWejscia('https://www.bojo.pl/mapa', DOMENA)).toBe('wewnetrzne');
  });

  it('subdomena własnej domeny też jest wewnętrzna', () => {
    expect(zrodloWejscia('https://podglad.bojo.pl/mapa', 'bojo.pl')).toBe('wewnetrzne');
  });

  it('domena tylko PODOBNA do własnej nie jest wewnętrzna', () => {
    // „niebojo.pl" kończy się na „bojo.pl" jako tekst, ale nie jest naszą subdomeną.
    expect(zrodloWejscia('https://niebojo.pl/x', 'bojo.pl')).toBe('zewnetrzne');
  });

  it('reszta internetu to ruch zewnętrzny', () => {
    expect(zrodloWejscia('https://www.facebook.com/', DOMENA)).toBe('zewnetrzne');
  });

  it('referrer nie do sparsowania nie wywraca pomiaru', () => {
    // Zdarza się realnie (rozszerzenia przeglądarki, klienty pocztowe).
    expect(zrodloWejscia('to-nie-jest-adres', DOMENA)).toBe('zewnetrzne');
  });

  it('wielkość liter w referrerze i w domenie nie ma znaczenia', () => {
    expect(zrodloWejscia('https://WWW.Google.PL/search', DOMENA)).toBe('wyszukiwarka');
    expect(zrodloWejscia('https://www.bojo.pl/x', 'WWW.BOJO.PL')).toBe('wewnetrzne');
  });
});
