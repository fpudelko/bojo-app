import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { FAQ, FAQ_LANDING, KATEGORIE_FAQ } from '@/content/faq';
import { JAK_DZIALA, JAK_DZIALA_ODPOWIEDZ } from '@/content/jakDziala';
import { DLACZEGO_ODPOWIEDZ, CO_UWIERA, TABELA_POROWNAWCZA, DLACZEGO_PROZA } from '@/content/dlaczego';
import { GRAJ_LEAD, GRAJ_BRAK_MECZY, SPORT_ODMIANA } from '@/content/graj';
import { MIASTA, CZYM_BOJO_NIE_JEST, odpowiedzMiasta, zdanieOKatalogu } from '@/content/miasta';
import { opisObiektu, zdanieORozegranychMeczach, type ObiektDoOpisu } from '@/content/opisObiektu';
import {
  KALKULATOR_ODPOWIEDZ, KALKULATOR_HINT_KARTA, KALKULATOR_HINT_BEZ_ZNIZKI,
} from '@/content/kalkulator';
import { WIDGET_BRAK_MECZOW, WIDGET_STOPKA, WIDGET_NIEZNANY_OBIEKT } from '@/content/widget';
import { wstepHubuSportu, wstepHubuWojewodztwa, wstepHubuSportuMiasta } from '@/content/boiska';
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
  jednostki.push({ etykieta: 'kalkulator#odpowiedz', tekst: KALKULATOR_ODPOWIEDZ });
  jednostki.push({ etykieta: 'kalkulator#hint-karta', tekst: KALKULATOR_HINT_KARTA });
  jednostki.push({ etykieta: 'kalkulator#hint-bez-znizki', tekst: KALKULATOR_HINT_BEZ_ZNIZKI });
  jednostki.push({ etykieta: 'widget#brak-meczow', tekst: WIDGET_BRAK_MECZOW });
  jednostki.push({ etykieta: 'widget#stopka', tekst: WIDGET_STOPKA });
  jednostki.push({ etykieta: 'widget#nieznany-obiekt', tekst: WIDGET_NIEZNANY_OBIEKT });
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
  // Czysty szablon jak opisObiektu() wyżej — próbka liczb wystarczy.
  jednostki.push({ etykieta: 'boisko#zdanieORozegranychMeczach', tekst: zdanieORozegranychMeczach(7) ?? '' });
  jednostki.push({
    etykieta: 'boisko#zdanieORozegranychMeczach-z-data',
    tekst: zdanieORozegranychMeczach(7, '2026-08-12') ?? '',
  });

  // Wstępy hubów: te same generatory co na /boiska/[sport] i /boiska/woj/[x],
  // sprawdzone dla reprezentatywnych wartości — czysty szablon, jak wyżej.
  jednostki.push({
    etykieta: 'boiska#wstep-sportu',
    tekst: wstepHubuSportu(1234, 'piłki nożnej'),
  });
  jednostki.push({
    etykieta: 'boiska#wstep-wojewodztwa',
    tekst: wstepHubuWojewodztwa(1234, 'wielkopolskie'),
  });
  jednostki.push({
    etykieta: 'boiska#wstep-sportu-miasta',
    tekst: wstepHubuSportuMiasta(12, 'piłki nożnej', 'Poznań'),
  });

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

  it('każda jednostka wspominająca powiadomienia nazywa KANAŁ', () => {
    // Reguła brzmiała „w aplikacji albo pod dzwonkiem" i wynikała ze stanu,
    // w którym innych kanałów nie było. Dziś są trzy i wszystkie działają:
    // dzwonek (`025` i dalsze), push na telefon (`102`) oraz poczta do osoby
    // bez konta (`133`). Zdanie nadal MUSI nazwać kanał — zakazem pozostaje
    // mówienie o powiadomieniach bez powiedzenia, gdzie przyjdą.
    for (const { etykieta, tekst } of jednostki) {
      if (/powiadom/i.test(tekst)) {
        expect(tekst, `${etykieta}: powiadomienia bez kanału — "${tekst}"`)
          .toMatch(/w aplikacji|pod dzwonkiem|na telefon|mailem/i);
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

  // ODWROTNOŚĆ dwóch testów wyżej. Tamte pilnują, żeby strony nie OBIECAŁY
  // funkcji, której nie ma. Ten pilnuje, żeby nie ZAPRZECZYŁY funkcji, która
  // jest — a to jest błąd tej samej klasy, tylko trudniejszy do zauważenia,
  // bo zdanie „Bojo tego nie robi" nikomu nie wygląda na obietnicę bez pokrycia.
  //
  // Realny przypadek, DWA RAZY: runda `P-8` (2026-09-08) poprawiła `/faq`,
  // `/dlaczego-bojo` i `llms.txt`, a `/jak-dziala-bojo` — jedyną stronę, której
  // cała sekcja nazywa się „Co Bojo powiadamia i gdzie" — przeoczyła; zdanie
  // przeżyło do piątej rundy (2026-09-09). Bo przechodziło WSZYSTKIE istniejące
  // testy: fraza `push` nie jest już zakazana, a wymagany kanał („w aplikacji")
  // był nazwany, więc test wyżej też świecił na zielono.
  //
  // Lista trzyma się kanałów, nie pojedynczych zdań: dopisując kanał, dopisz
  // wzorzec jego zaprzeczenia. SMS-a tu NIE MA i mieć nie powinno — jego Bojo
  // faktycznie nie wysyła, a `SHOW_SMS_FEATURES` jest wyłączone.
  const NIEPRAWDZIWE_ZAPRZECZENIA: { kanal: string; odkad: string; re: RegExp }[] = [
    // `\S+` zamiast `\w+` NIE jest kosmetyką: w JS `\w` to ASCII, więc wzorzec
    // z `\w` przepuszczał dokładnie to zdanie, które ten test ma łapać —
    // „nie wysyła SMS-ów ani maili" (`SMS-ów` ma i myślnik, i `ó`).
    { kanal: 'push na telefon', odkad: 'migracja 102', re: /nie ma powiadomień push|bez powiadomień push|nie wysyła (?:\S+ ){0,3}powiadomień push/i },
    { kanal: 'poczta', odkad: 'migracje 133, 137 i 140', re: /nie wysyła (?:\S+ ){0,3}maili|nie wyśle (?:\S+ ){0,3}maila/i },
    { kanal: 'przypomnienie dzień przed', odkad: 'migracja 129', re: /nie przypomina|bez przypomnień|nie wysyła (?:\S+ ){0,3}przypomnie/i },
  ];

  for (const { kanal, odkad, re } of NIEPRAWDZIWE_ZAPRZECZENIA) {
    it(`żadna jednostka nie zaprzecza kanałowi „${kanal}" (działa od: ${odkad})`, () => {
      for (const { etykieta, tekst } of jednostki) {
        expect(re.test(tekst), `${etykieta}: zaprzecza działającemu kanałowi „${kanal}" — "${tekst}"`)
          .toBe(false);
      }
    });
  }
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
