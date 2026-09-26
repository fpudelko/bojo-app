#!/usr/bin/env node
// gsc-okazje: where bojo.pl loses clicks it could have, from a Search Console
// Performance export (or the normalized JSON from gsc-api.mjs / gsc-eksport.mjs).
//
// Method (details: ../references/metodyka.md):
//   - The expected CTR for a position comes from bojo.pl's OWN data (impression-
//     weighted, leave-one-out), not from an industry curve: generic curves are
//     from other markets and pre-date AI Overviews.
//   - A page/query is flagged only when the Wilson upper bound of its CTR is
//     still below that expectation, so 3 impressions and 0 clicks never
//     produce a "finding".
//   - Every finding names the code that writes the snippet, via the page-type
//     map (../../gsc/scripts/lib/mapa-bojo.mjs).
//
// Usage:
//   node gsc-okazje.mjs <eksport-skutecznosci.zip> [--min-wyswietlen 50] [--marka 'bojo']
//   node gsc-okazje.mjs --dane dane.json              # from gsc-api.mjs skutecznosc
//   node gsc-okazje.mjs <zip> --eksperyment parzystosc # A/B split on venue pages
//   add --json out.json to save the findings

import { readFileSync, writeFileSync } from 'node:fs';
import { wczytajEksport, analizaSzeregu } from '../../gsc/scripts/lib/raporty.mjs';
import { klasyfikujAdres, regulyRobots } from '../../gsc/scripts/lib/mapa-bojo.mjs';
import {
  przedzialWilsona, testDwochProporcji, wymaganaProba,
  formatLiczby, formatProcent, formatPozycji,
} from '../../gsc/scripts/lib/liczby.mjs';

const args = process.argv.slice(2);
const wart = (n, d = null) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const OPCJE_Z_WARTOSCIA = new Set(['--dane', '--min-wyswietlen', '--marka', '--json', '--eksperyment', '--od-pozycji', '--do-pozycji']);
const pliki = args.filter((a, i) => !a.startsWith('--') && !OPCJE_Z_WARTOSCIA.has(args[i - 1]));
const MIN_W = Number(wart('--min-wyswietlen', 50));
const MARKA = new RegExp(wart('--marka', '\\bbojo\\b|bojo\\.pl'), 'i');
const OD_POZ = Number(wart('--od-pozycji', 4));
const DO_POZ = Number(wart('--do-pozycji', 15));
const MIN_W_KOSZYKA = 300; // impressions a position bucket needs before its CTR is trusted

const out = [];
const p = (...l) => out.push(...l);
function tabelaMd(naglowki, wiersze) {
  if (!wiersze.length) { p('_(brak)_', ''); return; }
  p(`| ${naglowki.join(' | ')} |`, `|${naglowki.map(() => '---').join('|')}|`);
  for (const w of wiersze) p(`| ${w.map((x) => String(x ?? '–').replace(/\|/g, '\\|')).join(' | ')} |`);
  p('');
}

export const KOSZYKI = [
  ['1', 0, 1.5], ['2', 1.5, 2.5], ['3', 2.5, 3.5], ['4–5', 3.5, 5.5],
  ['6–10', 5.5, 10.5], ['11–20', 10.5, 20.5], ['21+', 20.5, Infinity],
];
export const koszyk = (poz) => (KOSZYKI.find(([, od, dop]) => poz >= od && poz < dop) ?? KOSZYKI[KOSZYKI.length - 1])[0];

/** Site CTR curve: { koszyk: { kl, wy } } from rows with clicks/impressions/position. */
export function krzywaCtr(wiersze) {
  const k = {};
  for (const w of wiersze) {
    if (w.position == null || !w.impressions) continue;
    const b = (k[koszyk(w.position)] ??= { kl: 0, wy: 0 });
    b.kl += w.clicks ?? 0;
    b.wy += w.impressions;
  }
  return k;
}

/** Expected CTR for a row, leaving the row itself out of its bucket. */
export function oczekiwanyCtr(krzywa, w) {
  const b = krzywa[koszyk(w.position)];
  if (!b) return null;
  const wy = b.wy - w.impressions;
  if (wy < MIN_W_KOSZYKA) return null;
  return (b.kl - (w.clicks ?? 0)) / wy;
}

/** Rows whose CTR is significantly below the site's own curve. */
export function lukiCtr(wiersze, krzywa, klucz, minW = MIN_W) {
  const wynik = [];
  for (const w of wiersze) {
    if ((w.impressions ?? 0) < minW || w.position == null) continue;
    const ocz = oczekiwanyCtr(krzywa, w);
    if (ocz == null) continue;
    const { gora } = przedzialWilsona(w.clicks ?? 0, w.impressions);
    if (gora >= ocz) continue;
    const ctr = (w.clicks ?? 0) / w.impressions;
    wynik.push({ ...w, klucz: w[klucz], ctr, oczekiwany: ocz, utracone: w.impressions * (ocz - ctr) });
  }
  return wynik.sort((a, b) => b.utracone - a.utracone);
}

function sumy(wiersze) {
  const kl = wiersze.reduce((s, w) => s + (w.clicks ?? 0), 0);
  const wy = wiersze.reduce((s, w) => s + (w.impressions ?? 0), 0);
  const pw = wiersze.reduce((s, w) => s + (w.position ?? 0) * (w.impressions ?? 0), 0);
  return { kl, wy, ctr: wy ? kl / wy : null, poz: wy ? pw / wy : null };
}

function main() {
  const r = wart('--dane') ? JSON.parse(readFileSync(wart('--dane'), 'utf8')) : pliki.length ? wczytajEksport(pliki) : null;
  if (!r) {
    console.error('Użycie: node gsc-okazje.mjs <eksport-skutecznosci.zip> | --dane dane.json [--min-wyswietlen 50]');
    process.exit(2);
  }
  const T = r.tabele;
  const strony = T.strony?.wiersze ?? [];
  const zapytania = T.zapytania?.wiersze ?? [];
  const daty = T.daty?.wiersze ?? [];
  const urz = T.urzadzenia?.wiersze ?? [];
  const sz = T['strona-zapytanie']?.wiersze ?? [];
  const robots = regulyRobots();
  const typ = (url) => klasyfikujAdres(url, { robots });
  const wyniki = {};

  p('# Okazje w wynikach wyszukiwania (Search Console → Skuteczność)', '');
  const okres = daty.map((w) => w.date).sort();
  if (okres.length) p(`Dane: ${okres[0]} → ${okres[okres.length - 1]}. Próg istotności: ≥ ${MIN_W} wyświetleń na wiersz.`);
  if (r.raport?.filtry) p(`Filtry eksportu: ${Object.entries(r.raport.filtry).map(([k, v]) => `${k} = ${v}`).join('; ')}`);
  p('');

  // 1. Totals and coverage
  const cal = daty.length ? sumy(daty) : sumy(strony);
  wyniki.sumy = cal;
  p('## 1. Stan', '');
  p(`**${formatLiczby(cal.kl)}** kliknięć · **${formatLiczby(cal.wy)}** wyświetleń · CTR **${formatProcent(cal.ctr, 2)}** · pozycja **${formatPozycji(cal.poz)}**` + (daty.length ? ' (z tabeli Daty: pełne sumy, bez ucinania).' : ' (z tabeli Strony: ucięte do 1000 wierszy).'));
  if (zapytania.length && cal.kl) {
    const zq = sumy(zapytania);
    p(`Nazwane zapytania: ${formatLiczby(zq.kl)} kliknięć (${formatProcent(zq.kl / cal.kl)} całości). Reszta to zapytania anonimizowane (za rzadkie, by Google je pokazał) albo ucięte limitem wierszy: długi ogon nazw obiektów.`);
  }
  if (strony.length >= 1000 || zapytania.length >= 1000) p('⚠️ Tabela ma 1000 wierszy, czyli limit eksportu z interfejsu: ogon jest ucięty. Pełne dane: `gsc-api.mjs skutecznosc` (do 50 tys. wierszy dziennie).');
  p('');

  // 2. Page types
  if (strony.length) {
    p('## 2. Typy stron', '');
    const g = {};
    for (const w of strony) {
      const k = typ(w.page);
      (g[k.nazwa] ??= { wiersze: [], plik: k.metadane }).wiersze.push(w);
    }
    const lista = Object.entries(g).map(([n, x]) => ({ n, ...sumy(x.wiersze), strony: x.wiersze.length, plik: x.plik })).sort((a, b) => b.wy - a.wy);
    wyniki.typyStron = lista;
    tabelaMd(['Typ', 'Strony', 'Kliknięcia', 'Wyświetlenia', 'CTR', 'Pozycja', 'Snippet pisze'],
      lista.map((x) => [x.n, x.strony, formatLiczby(x.kl), formatLiczby(x.wy), formatProcent(x.ctr, 2), formatPozycji(x.poz), `\`${x.plik}\``]));
  }

  // 3. CTR curve
  const krzywaS = krzywaCtr(strony.length ? strony : zapytania);
  p('## 3. Krzywa CTR witryny (wg pozycji)', '');
  tabelaMd(['Pozycja', 'Wyświetlenia', 'Kliknięcia', 'CTR', 'Wiarygodne?'],
    KOSZYKI.filter(([k]) => krzywaS[k]).map(([k]) => [k, formatLiczby(krzywaS[k].wy), formatLiczby(krzywaS[k].kl), formatProcent(krzywaS[k].kl / krzywaS[k].wy, 2), krzywaS[k].wy >= MIN_W_KOSZYKA ? 'tak' : `nie (< ${MIN_W_KOSZYKA} wyśw.)`]));
  wyniki.krzywa = krzywaS;

  // 4. CTR gaps
  p('## 4. Luka CTR: dobra pozycja, słaby snippet', '');
  p('Strony klikane wyraźnie rzadziej niż inne strony Bojo na tej samej pozycji (górna granica przedziału Wilsona poniżej oczekiwania). „Utracone” = wyświetlenia × (oczekiwany CTR − faktyczny).', '');
  const lukiS = lukiCtr(strony, krzywaS, 'page');
  wyniki.lukiStron = lukiS;
  tabelaMd(['Strona', 'Typ', 'Wyśw.', 'Pozycja', 'CTR', 'Oczekiwany', 'Utracone kl.'],
    lukiS.slice(0, 15).map((w) => [w.page, typ(w.page).nazwa, formatLiczby(w.impressions), formatPozycji(w.position), formatProcent(w.ctr, 2), formatProcent(w.oczekiwany, 2), formatLiczby(w.utracone)]));
  if (zapytania.length) {
    const krzywaZ = krzywaCtr(zapytania);
    const lukiZ = lukiCtr(zapytania, krzywaZ, 'query');
    wyniki.lukiZapytan = lukiZ;
    p('Zapytania z luką CTR:', '');
    tabelaMd(['Zapytanie', 'Wyśw.', 'Pozycja', 'CTR', 'Oczekiwany', 'Utracone kl.'],
      lukiZ.slice(0, 15).map((w) => [w.query, formatLiczby(w.impressions), formatPozycji(w.position), formatProcent(w.ctr, 2), formatProcent(w.oczekiwany, 2), formatLiczby(w.utracone)]));
  }

  // 5. Striking distance
  const top3 = ['1', '2', '3'].map((k) => krzywaS[k]).filter(Boolean).reduce((a, b) => ({ kl: a.kl + b.kl, wy: a.wy + b.wy }), { kl: 0, wy: 0 });
  const ctrTop3 = top3.wy >= MIN_W_KOSZYKA ? top3.kl / top3.wy : null;
  const zalozenie = ctrTop3 == null;
  const ctrCel = ctrTop3 ?? 0.1;
  p(`## 5. Blisko TOP 3 (pozycje ${OD_POZ}–${DO_POZ})`, '');
  p(`Potencjał = wyświetlenia × CTR pozycji 1–3 (${formatProcent(ctrCel, 1)}${zalozenie ? ', ZAŁOŻENIE: własnych danych dla TOP 3 za mało' : ', z danych Bojo'}) − obecne kliknięcia. To kandydaci do treści i linkowania wewnętrznego, nie do zmiany snippetu.`, '');
  const blisko = (lista, klucz) => lista
    .filter((w) => w.position >= OD_POZ && w.position <= DO_POZ && (w.impressions ?? 0) >= MIN_W)
    .map((w) => ({ ...w, klucz: w[klucz], potencjal: Math.max(0, w.impressions * ctrCel - (w.clicks ?? 0)) }))
    .sort((a, b) => b.potencjal - a.potencjal);
  const bliskoZ = blisko(zapytania, 'query');
  const bliskoS = blisko(strony, 'page');
  wyniki.bliskoTop = { zapytania: bliskoZ, strony: bliskoS, ctrCel, zalozenie };
  if (zapytania.length) tabelaMd(['Zapytanie', 'Wyśw.', 'Pozycja', 'Kliknięcia', 'Potencjał kl.'], bliskoZ.slice(0, 15).map((w) => [MARKA.test(w.query) ? `${w.query} (marka: patrz sekcja 7)` : w.query, formatLiczby(w.impressions), formatPozycji(w.position), formatLiczby(w.clicks), formatLiczby(w.potencjal)]));
  if (strony.length) tabelaMd(['Strona', 'Typ', 'Wyśw.', 'Pozycja', 'Potencjał kl.'], bliskoS.slice(0, 10).map((w) => [w.page, typ(w.page).nazwa, formatLiczby(w.impressions), formatPozycji(w.position), formatLiczby(w.potencjal)]));

  // 6. Zero clicks at a good position
  p('## 6. Zero kliknięć w pierwszej dziesiątce', '');
  const zero = (lista, klucz) => lista.filter((w) => (w.clicks ?? 0) === 0 && w.position <= 10 && (w.impressions ?? 0) >= MIN_W).sort((a, b) => b.impressions - a.impressions);
  const zeroZ = zero(zapytania, 'query');
  const zeroS = zero(strony, 'page');
  wyniki.zeroKlikniec = { zapytania: zeroZ, strony: zeroS };
  p(`Zapytania: ${zeroZ.length}, strony: ${zeroS.length}. Przy dobrej pozycji problemem nie jest ranking, tylko to, co widać w wyniku (tytuł, opis) albo intencja (ktoś szuka czegoś innego, np. słownikowego „bojo”).`, '');
  tabelaMd(['Zapytanie / strona', 'Wyśw.', 'Pozycja'], [...zeroZ.slice(0, 10).map((w) => [w.query, formatLiczby(w.impressions), formatPozycji(w.position)]), ...zeroS.slice(0, 5).map((w) => [w.page, formatLiczby(w.impressions), formatPozycji(w.position)])]);

  // 7. Brand
  if (zapytania.length) {
    p('## 7. Marka a reszta', '');
    const marka = zapytania.filter((w) => MARKA.test(w.query));
    const reszta = zapytania.filter((w) => !MARKA.test(w.query));
    const [m, rr] = [sumy(marka), sumy(reszta)];
    wyniki.marka = { marka: m, reszta: rr, zapytania: marka };
    tabelaMd(['Grupa', 'Zapytania', 'Kliknięcia', 'Wyświetlenia', 'CTR', 'Pozycja'], [
      ['z „bojo”', marka.length, formatLiczby(m.kl), formatLiczby(m.wy), formatProcent(m.ctr, 2), formatPozycji(m.poz)],
      ['bez marki', reszta.length, formatLiczby(rr.kl), formatLiczby(rr.wy), formatProcent(rr.ctr, 2), formatPozycji(rr.poz)],
    ]);
    p('„bojo” to też potoczne słowo „boisko” (docs/seo-geo-strategia.md, 2c): zapytania „co to bojo” często nie szukają aplikacji. Od marca 2026 GSC ma natywny filtr zapytań markowych (Skuteczność → filtr „Zapytania markowe”); porównaj z tym podziałem.', '');
  }

  // 8. Devices
  if (urz.length) {
    p('## 8. Urządzenia', '');
    tabelaMd(['Urządzenie', 'Kliknięcia', 'Wyświetlenia', 'CTR', 'Pozycja'], urz.map((w) => [w.device, formatLiczby(w.clicks), formatLiczby(w.impressions), formatProcent((w.clicks ?? 0) / (w.impressions || 1), 2), formatPozycji(w.position)]));
    const [mob, desk] = ['mobile|telefon|komórk', 'desktop|komputer'].map((re) => urz.find((w) => new RegExp(re, 'i').test(w.device ?? '')));
    if (mob && desk && mob.position && desk.position && Math.abs(mob.position - desk.position) >= 2) {
      p(`⚠️ Pozycja na komputerze ${formatPozycji(desk.position)} vs telefon ${formatPozycji(mob.position)}: różnica ≥ 2 miejsc. Sprawdź, czy dotyczy jednego typu stron (filtr urządzenia + tabela Strony).`, '');
    }
  }

  // 9. Trend
  if (daty.length >= 14) {
    p('## 9. Trend', '');
    const d = [...daty].sort((a, b) => a.date.localeCompare(b.date));
    const ost = sumy(d.slice(-7));
    const pop = sumy(d.slice(-14, -7));
    const zm = (a, b) => (b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%` : '–');
    p(`Ostatnie 7 dni vs poprzednie 7: kliknięcia ${formatLiczby(ost.kl)} (${zm(ost.kl, pop.kl)}), wyświetlenia ${formatLiczby(ost.wy)} (${zm(ost.wy, pop.wy)}), CTR ${formatProcent(ost.ctr, 2)} (było ${formatProcent(pop.ctr, 2)}), pozycja ${formatPozycji(ost.poz)} (było ${formatPozycji(pop.poz)}).`);
    const sk = analizaSzeregu(d, 'impressions', { prog: 100 });
    if (sk?.skoki.length) p(`Skoki wyświetleń: ${sk.skoki.slice(-5).map((s) => `${s.data} ${formatLiczby(s.z)}→${formatLiczby(s.na)}`).join('; ')}. Zestaw z datami deployów i adnotacjami w GSC (docs/gsc-dziennik.md).`);
    p('Ostatnie 2–3 dni w GSC są niepełne (dane dochodzą z opóźnieniem): nie wyciągaj z nich wniosków.', '');
  }

  // 10. Period comparison (compare-mode exports)
  const zPorownaniem = (lista, klucz) => lista.filter((w) => w.clicks_prev != null)
    .map((w) => ({ klucz: w[klucz], teraz: w.clicks ?? 0, wczesniej: w.clicks_prev ?? 0, delta: (w.clicks ?? 0) - (w.clicks_prev ?? 0) }));
  const porS = zPorownaniem(strony, 'page');
  const porZ = zPorownaniem(zapytania, 'query');
  if (porS.length || porZ.length) {
    p('## 10. Porównanie okresów', '');
    const oba = [...porS, ...porZ];
    tabelaMd(['Najwięcej zyskały', 'Teraz', 'Wcześniej', 'Δ'], [...oba].sort((a, b) => b.delta - a.delta).slice(0, 8).map((w) => [w.klucz, w.teraz, w.wczesniej, `+${w.delta}`]));
    tabelaMd(['Najwięcej straciły', 'Teraz', 'Wcześniej', 'Δ'], [...oba].sort((a, b) => a.delta - b.delta).slice(0, 8).map((w) => [w.klucz, w.teraz, w.wczesniej, w.delta]));
  }

  // 11. Cannibalisation (needs page×query rows: API only)
  if (sz.length) {
    p('## 11. Kanibalizacja (jedno zapytanie, kilka stron Bojo)', '');
    const wgZ = {};
    for (const w of sz) (wgZ[w.query] ??= []).push(w);
    const kan = Object.entries(wgZ).map(([q, l]) => {
      const wy = l.reduce((s, w) => s + (w.impressions ?? 0), 0);
      const liczace = l.filter((w) => (w.impressions ?? 0) >= 0.1 * wy);
      return { q, wy, strony: liczace };
    }).filter((k) => k.strony.length >= 2 && k.wy >= MIN_W).sort((a, b) => b.wy - a.wy);
    wyniki.kanibalizacja = kan;
    tabelaMd(['Zapytanie', 'Wyśw.', 'Strony (wyśw., pozycja)'], kan.slice(0, 10).map((k) => [k.q, formatLiczby(k.wy), k.strony.map((w) => `${w.page} (${formatLiczby(w.impressions)}, ${formatPozycji(w.position)})`).join('<br>')]));
  }

  // 12. Venue A/B split (parity of the last hex digit of the id suffix)
  if (wart('--eksperyment') === 'parzystosc' && strony.length) {
    p('## 12. Eksperyment na stronach obiektów (A = parzysta ostatnia cyfra id, B = nieparzysta)', '');
    const grupy = { A: [], B: [] };
    for (const w of strony) {
      const k = typ(w.page);
      if (k.typ !== 'obiekt' || k.wariant !== 'kanoniczny') continue;
      const cyfra = parseInt(k.sciezka.replace(/\/$/, '').slice(-1), 16);
      grupy[cyfra % 2 === 0 ? 'A' : 'B'].push(w);
    }
    const [a, b] = [sumy(grupy.A), sumy(grupy.B)];
    const t = testDwochProporcji(a.kl, a.wy, b.kl, b.wy);
    wyniki.eksperyment = { A: a, B: b, test: t };
    tabelaMd(['Grupa', 'Strony', 'Kliknięcia', 'Wyświetlenia', 'CTR', 'Pozycja'], [
      ['A (parzyste)', grupy.A.length, formatLiczby(a.kl), formatLiczby(a.wy), formatProcent(a.ctr, 2), formatPozycji(a.poz)],
      ['B (nieparzyste)', grupy.B.length, formatLiczby(b.kl), formatLiczby(b.wy), formatProcent(b.ctr, 2), formatPozycji(b.poz)],
    ]);
    p(`Test dwóch proporcji: z = ${t.z.toFixed(2)}, p = ${t.p.toFixed(3)} (${t.p < 0.05 ? 'różnica istotna' : 'różnica nieistotna'}). Pozycje obu grup muszą być podobne, inaczej porównanie CTR nic nie znaczy. Przy CTR ${formatProcent(cal.ctr, 2)} wykrycie zmiany o 20% wymaga ~${formatLiczby(wymaganaProba(cal.ctr ?? 0.01, (cal.ctr ?? 0.01) * 1.2))} wyświetleń na grupę. Uwaga: eksport z interfejsu ucina ogon (1000 stron); do eksperymentu użyj danych z API.`, '');
  }

  // 13. Baseline for the log
  p('## Linia bazowa do dziennika', '');
  const koniec = okres.length ? okres[okres.length - 1] : new Date().toISOString().slice(0, 10);
  const powtorka = new Date(Date.parse(koniec) + 28 * 864e5).toISOString().slice(0, 10);
  p('Wklej do `docs/gsc-dziennik.md` (sekcja pomiarów) PRZED zmianą snippetów, żeby za 4 tygodnie było z czym porównać:', '');
  p('```', `${koniec} · Skuteczność ${okres[0] ?? '?'}→${koniec} · kl ${cal.kl} · wyśw ${cal.wy} · CTR ${formatProcent(cal.ctr, 2)} · poz ${formatPozycji(cal.poz)} · luka CTR: ${lukiS.length} stron (${formatLiczby(lukiS.reduce((s, w) => s + w.utracone, 0))} kl. utraconych) · ponowny odczyt: ${powtorka}`, '```');

  if (wart('--json')) writeFileSync(wart('--json'), JSON.stringify(wyniki, null, 2));
  console.log(out.join('\n'));
}

if (process.argv[1]?.endsWith('gsc-okazje.mjs')) main();
