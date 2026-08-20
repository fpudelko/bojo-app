import { describe, it, expect } from 'vitest';
import { FAQ, FAQ_LANDING, KATEGORIE_FAQ } from '@/content/faq';
import { JAK_DZIALA } from '@/content/jakDziala';
import { CO_UWIERA, TABELA_POROWNAWCZA, DLACZEGO_PROZA } from '@/content/dlaczego';
import { GRAJ_LEAD, GRAJ_BRAK_MECZY } from '@/content/graj';
import { ZAKAZANE_WSZEDZIE } from '@/content/zakazaneFrazy';
import { faqJsonLd } from '@/lib/structuredData';

/**
 * Każda widoczna jednostka treści na `/faq`, `/jak-dziala-bojo`,
 * `/dlaczego-bojo` — jedna FAQ odpowiedź, jeden akapit, jeden
 * wiersz tabeli porównawczej. Per-jednostka, nie jeden wielki zlepiony
 * string: to zgodne z zasadą "każda sekcja broni się sama"
 * (AGENTS.md, "RAG INJECTION") i unika kruchego dzielenia zdań w tekście
 * posklejanym z wielu niepowiązanych fragmentów.
 */
function jednostkiTresci(): { etykieta: string; tekst: string }[] {
  const jednostki: { etykieta: string; tekst: string }[] = [];

  for (const f of FAQ) {
    jednostki.push({ etykieta: `FAQ: ${f.q}`, tekst: `${f.q} ${f.a}` });
  }
  for (const s of JAK_DZIALA) {
    for (const a of s.akapity) jednostki.push({ etykieta: `jak-dziala-bojo#${s.id}`, tekst: a });
  }
  for (const s of DLACZEGO_PROZA) {
    for (const a of s.akapity) jednostki.push({ etykieta: `dlaczego-bojo#${s.id}`, tekst: a });
  }
  for (const p of CO_UWIERA) {
    jednostki.push({ etykieta: 'dlaczego-bojo#co-uwiera', tekst: p });
  }
  for (const w of TABELA_POROWNAWCZA) {
    jednostki.push({ etykieta: `dlaczego-bojo#roznice (${w.co})`, tekst: `${w.fb} ${w.bojo}` });
  }
  jednostki.push({ etykieta: 'graj#lead', tekst: GRAJ_LEAD });
  jednostki.push({ etykieta: 'graj#brak-meczy', tekst: GRAJ_BRAK_MECZY });

  return jednostki;
}

describe('strony treści — brak obietnic bez pokrycia w kodzie', () => {
  const jednostki = jednostkiTresci();

  for (const fraza of ZAKAZANE_WSZEDZIE) {
    it(`"/${fraza}/" pojawia się co najwyżej w zdaniu, które ją jawnie zaprzecza`, () => {
      const re = new RegExp(fraza, 'i');
      for (const { etykieta, tekst } of jednostki) {
        const dopasowanie = re.exec(tekst.toLowerCase());
        if (!dopasowanie) continue;
        const kontekst = tekst.toLowerCase().slice(Math.max(0, dopasowanie.index - 20), dopasowanie.index);
        expect(kontekst, `${etykieta}: "${fraza}" bez przeczenia w "${tekst}"`).toMatch(/nie /);
      }
    });
  }

  it('każda jednostka wspominająca powiadomienia mówi wprost "w aplikacji" albo "pod dzwonkiem"', () => {
    for (const { etykieta, tekst } of jednostki) {
      if (/powiadom/i.test(tekst)) {
        expect(tekst, `${etykieta}: powiadomienia bez kanału — "${tekst}"`)
          .toMatch(/w aplikacji|pod dzwonkiem/i);
      }
    }
  });

  it('każda jednostka wspominająca SMS mówi, że Bojo go nie wysyła', () => {
    for (const { etykieta, tekst } of jednostki) {
      if (/\bsms\b/i.test(tekst)) {
        expect(tekst, `${etykieta}: SMS bez zaprzeczenia — "${tekst}"`)
          .toMatch(/nie wysyła|nie wyśle|nie ma|bez /i);
      }
    }
  });
});

describe('FAQ — spójność danych', () => {
  it('każda odpowiedź ma co najmniej 40 znaków (wymóg FAQPage schema)', () => {
    for (const { q, a } of FAQ) {
      expect(a.length, `"${q}" ma odpowiedź krótszą niż 40 znaków`).toBeGreaterThanOrEqual(40);
    }
  });

  it('FAQ_LANDING ma dokładnie 8 pozycji, wszystkie z FAQ', () => {
    expect(FAQ_LANDING).toHaveLength(8);
    for (const item of FAQ_LANDING) {
      expect(FAQ).toContain(item);
    }
  });

  it('każda kategoria z FAQ istnieje w KATEGORIE_FAQ', () => {
    const znane = new Set(KATEGORIE_FAQ.map((k) => k.klucz));
    for (const { kategoria, q } of FAQ) {
      expect(znane.has(kategoria), `"${q}" ma nieznaną kategorię "${kategoria}"`).toBe(true);
    }
  });

  it('faqJsonLd(FAQ) ma tyle samo pozycji i identyczną treść co źródło', () => {
    const jsonLd = faqJsonLd(FAQ);
    expect(jsonLd.mainEntity).toHaveLength(FAQ.length);
    jsonLd.mainEntity.forEach((entry, i) => {
      expect(entry.name).toBe(FAQ[i].q);
      expect(entry.acceptedAnswer.text).toBe(FAQ[i].a);
    });
  });
});
