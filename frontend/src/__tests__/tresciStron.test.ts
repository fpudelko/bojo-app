import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { FAQ, FAQ_LANDING, KATEGORIE_FAQ } from '@/content/faq';
import { JAK_DZIALA, JAK_DZIALA_ODPOWIEDZ } from '@/content/jakDziala';
import { DLACZEGO_ODPOWIEDZ, CO_UWIERA, TABELA_POROWNAWCZA, DLACZEGO_PROZA } from '@/content/dlaczego';
import { GRAJ_LEAD, GRAJ_BRAK_MECZY, SPORT_ODMIANA } from '@/content/graj';
import { MIASTA, CZYM_BOJO_NIE_JEST, odpowiedzMiasta, zdanieOKatalogu } from '@/content/miasta';
import { opisObiektu, type ObiektDoOpisu } from '@/content/opisObiektu';
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
  jednostki.push({ etykieta: 'dlaczego#odpowiedz', tekst: DLACZEGO_ODPOWIEDZ });
  jednostki.push({ etykieta: 'jakDziala#odpowiedz', tekst: JAK_DZIALA_ODPOWIEDZ });
  jednostki.push({ etykieta: 'miasta#czym-nie-jest', tekst: CZYM_BOJO_NIE_JEST });
  // Direct Answer i zdanie o katalogu są szablonami — sprawdzamy je w każdej
  // realnej kombinacji sportu i miasta, bo to ten tekst trafia na stronę.
  for (const miasto of MIASTA) {
    for (const sport of SPORT_ODMIANA) {
      jednostki.push({
        etykieta: `miasta#odpowiedz/${sport.slug}/${miasto.slug}`,
        tekst: odpowiedzMiasta(sport.dopelniacz, miasto.miejscownik),
      });
    }
    jednostki.push({
      etykieta: `miasta#katalog/${miasto.slug}`,
      tekst: zdanieOKatalogu(824, miasto.miejscownik),
    });
  }

  // opisObiektu() jest szablonem złożonym z danych katalogu (nazwa, miejscowość,
  // sport, nawierzchnia) — próbka kombinacji, nie każdy z 36k+ wierszy, bo to
  // czysty szablon: jeśli ZAKAZANE_WSZEDZIE nie wchodzi w te kilka kombinacji,
  // nie wejdzie w żadną inną (dane katalogu, nie nasza proza, są tu wyłącznie
  // interpolowane — same nigdy nie dodają zakazanych fraz).
  const PROBKA_OBIEKTOW: ObiektDoOpisu[] = [
    { name: 'Orlik przy SP nr 3', sport: ['piłka nożna'], city: 'Poznań', surface: 'artificial', isIndoor: false, lit: true },
    { name: 'Hala sportowa MOSiR', sport: ['koszykówka', 'siatkówka'], city: undefined, surface: '', isIndoor: true, lit: undefined },
    { name: 'Boisko wielofunkcyjne', sport: ['piłka ręczna'], city: 'Tuchorza', surface: 'concrete', isIndoor: false, lit: false },
  ];
  for (const obiekt of PROBKA_OBIEKTOW) {
    jednostki.push({ etykieta: `opisObiektu#${obiekt.name}`, tekst: opisObiektu(obiekt) });
  }

  return jednostki;
}

/** `llms.txt` (indeks dla zewnętrznych asystentów, `frontend/public/llms.txt`) — jedna
 *  jednostka na wypunktowanie/akapit, zgodnie z "każda sekcja broni się sama". Plik jest
 *  twardo zawinięty na ~80 znakach (kontynuacja wypunktowania to linia z wcięciem), więc
 *  dzielenie po samym `\n` rozrywałoby zdania w środku — linie łączymy spacją, aż do
 *  pustej linii albo kolejnego `- `/nagłówka `#`. */
function jednostkiLlmsTxt(): { etykieta: string; tekst: string }[] {
  const raw = readFileSync(join(__dirname, '../../public/llms.txt'), 'utf-8');
  const linie = raw.split('\n');
  const jednostki: { etykieta: string; tekst: string }[] = [];
  let biezacyStart = -1;
  let biezacyTekst = '';

  const zamknij = () => {
    if (biezacyTekst.trim()) jednostki.push({ etykieta: `llms.txt:${biezacyStart}`, tekst: biezacyTekst.trim() });
    biezacyTekst = '';
  };

  linie.forEach((linia, i) => {
    const nowaJednostka = /^(- |#)/.test(linia) || linia.trim() === '';
    if (nowaJednostka) { zamknij(); biezacyStart = i + 1; }
    if (linia.trim() !== '') biezacyTekst += `${biezacyTekst ? ' ' : ''}${linia.trim()}`;
  });
  zamknij();

  return jednostki;
}

describe('strony treści — brak obietnic bez pokrycia w kodzie', () => {
  const jednostki = [...jednostkiTresci(), ...jednostkiLlmsTxt()];

  for (const fraza of ZAKAZANE_WSZEDZIE) {
    it(`"/${fraza}/" pojawia się co najwyżej w zdaniu, które ją jawnie zaprzecza`, () => {
      const re = new RegExp(fraza, 'i');
      for (const { etykieta, tekst } of jednostki) {
        const dopasowanie = re.exec(tekst.toLowerCase());
        if (!dopasowanie) continue;
        // llms.txt: zdania są dłuższe niż w plikach treści (`- Bojo nie wysyła SMS-ów,
        // maili o meczu ani powiadomień push.` — jedno "nie" na starcie przeczy trzem
        // rzeczownikom naraz, po polsku poprawnie, ale poza sztywnym oknem 20 znaków).
        // Cała jednostka to i tak jeden ograniczony wypunktowanie/akapit
        // (`jednostkiLlmsTxt()`), więc pełny prefiks zamiast okna nie rozmywa testu.
        const kontekst = etykieta.startsWith('llms.txt')
          ? tekst.toLowerCase().slice(0, dopasowanie.index)
          : tekst.toLowerCase().slice(Math.max(0, dopasowanie.index - 20), dopasowanie.index);
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
