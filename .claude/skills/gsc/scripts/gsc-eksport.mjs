#!/usr/bin/env node
// gsc-eksport: read ANY Search Console export (ZIP, CSV files or a directory),
// recognise the report and print a summary with bojo.pl verdicts.
//
// Usage:
//   node .claude/skills/gsc/scripts/gsc-eksport.mjs <eksport.zip> [kolejne pliki…]
//   node … <eksport.zip> --json wynik.json    # also write the normalized report
//   node … <adresy.csv|.txt> --adresy         # classify a list of URLs by page type
//
// Recognised: Performance (Skuteczność), generative-AI performance, Page
// indexing (Strony), rich-result reports (Ulepszenia: Wydarzenia, Menu
// nawigacyjne…), Core Web Vitals, Sitemaps, and drill-down example lists.
// Column names are matched in Polish and English; numbers in any locale.

import { readFileSync, writeFileSync } from 'node:fs';
import { wczytajEksport, analizaSzeregu } from './lib/raporty.mjs';
import { klasyfikujAdres, grupujWedlugTypu, regulyRobots } from './lib/mapa-bojo.mjs';
import { dopasujPrzyczyne, udzialR1, OPISY_WERDYKTOW } from './lib/przyczyny.mjs';
import { formatLiczby, formatProcent, formatPozycji } from './lib/liczby.mjs';
import { wagaPola } from '../../gsc-dane-strukturalne/scripts/reguly-google.mjs';

const args = process.argv.slice(2);
const flagi = new Set(args.filter((a) => a.startsWith('--')));
const wartoscFlagi = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const pliki = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--json');

const out = [];
const p = (...l) => out.push(...l);

function tabelaMd(naglowki, wiersze) {
  p(`| ${naglowki.join(' | ')} |`, `|${naglowki.map(() => '---').join('|')}|`);
  for (const w of wiersze) p(`| ${w.map((x) => String(x ?? '–').replace(/\|/g, '\\|')).join(' | ')} |`);
  p('');
}

function opiszSzereg(nazwa, a) {
  if (!a) return;
  const skoki = a.skoki.slice(-5).map((s) => `${s.data}: ${formatLiczby(s.z)} → ${formatLiczby(s.na)}`).join('; ');
  p(`- **${nazwa}**: ${a.od} → ${a.do} (${a.dni} dni). Ostatnio **${formatLiczby(a.ostatnia)}**, max ${formatLiczby(a.max.v)} (${a.max.data}).` +
    (a.pierwszyNiezerowy && a.pierwszyNiezerowy.data !== a.od ? ` Pierwsza niezerowa wartość: ${a.pierwszyNiezerowy.data}.` : '') +
    (skoki ? ` Skoki: ${skoki}.` : ''));
}

// --- per report type ---------------------------------------------------------

function ulepszenia(r) {
  const { raport, tabele } = r;
  p(`Raport: **${raport.raportPl ?? raport.nazwa ?? 'wyniki rozszerzone'}**${raport.schemat ? ` (typ ${raport.schemat})` : ''}.`);
  if (raport.budowniczy) p(`Kod, który go zasila: \`${raport.budowniczy}\`.`);
  if (raport.uwaga) p(`> ${raport.uwaga}`);
  p('');
  const wyk = tabele['wykres-ulepszen'];
  if (wyk) {
    p('### Wykres');
    opiszSzereg('Prawidłowe', analizaSzeregu(wyk.wiersze, 'valid', { prog: 1 }));
    opiszSzereg('Nieprawidłowe', analizaSzeregu(wyk.wiersze, 'invalid', { prog: 1 }));
    p('');
  }
  const prob = tabele.problemy?.wiersze ?? [];
  p('### Problemy');
  if (prob.length === 0) { p('Brak problemów w eksporcie.', ''); return; }
  const posort = [...prob].sort((a, b) => (a.waga === 'krytyczny' ? -1 : 1) - (b.waga === 'krytyczny' ? -1 : 1) || (b.items ?? 0) - (a.items ?? 0));
  tabelaMd(['Waga', 'Problem', 'Pole', 'Wg Google', 'Elementy', 'Weryfikacja'], posort.map((w) => [
    w.waga ?? '?', w.issue, w.problem?.sciezka ? `\`${w.problem.sciezka}\`` : '–',
    raport.schemat ? wagaPola(raport.schemat, w.problem?.sciezka) ?? '–' : '–', w.items, w.validation,
  ]));
  p('Następny krok: skill `gsc-dane-strukturalne` (odtwórz JSON-LD z buildera na danych przykładowych adresów, popraw, sprawdź `sprawdz-jsonld.mjs`, dopiero po deployu „Sprawdź poprawkę”).', '');
}

function indeksowanie(r) {
  const { tabele } = r;
  const wyk = tabele['wykres-indeksowania'];
  let zind = null;
  if (wyk) {
    p('### Wykres');
    const a = analizaSzeregu(wyk.wiersze, 'indexed');
    zind = a?.ostatnia ?? null;
    opiszSzereg('Zindeksowane', a);
    opiszSzereg('Niezindeksowane', analizaSzeregu(wyk.wiersze, 'notIndexed'));
    if (wyk.wiersze.some((w) => w.impressions != null)) opiszSzereg('Wyświetlenia', analizaSzeregu(wyk.wiersze, 'impressions'));
    p('');
  }
  const prz = tabele.przyczyny?.wiersze ?? [];
  if (prz.length) {
    p('### Dlaczego strony nie są zindeksowane');
    tabelaMd(['Przyczyna', 'Źródło', 'Strony', 'Werdykt dla Bojo', 'Weryfikacja'],
      [...prz].sort((a, b) => (b.pages ?? 0) - (a.pages ?? 0)).map((w) => {
        const d = dopasujPrzyczyne(w.reason);
        return [w.reason, w.source ?? '–', formatLiczby(w.pages), OPISY_WERDYKTOW[d?.werdykt ?? 'nieznany'], w.validation ?? '–'];
      }));
    p('#### Co to znaczy w Bojo');
    for (const w of prz) {
      const d = dopasujPrzyczyne(w.reason);
      if (!d) { p(`- **${w.reason}**: nierozpoznana przyczyna, sprawdź ręcznie (skill gsc-indeksowanie).`); continue; }
      p(`- **${w.reason}** (${formatLiczby(w.pages)}): ${d.bojo} *Sprawdź:* ${d.sprawdz}`);
    }
    p('');
    const r1 = udzialR1(prz, zind);
    p('### Sygnał R1 (katalog oceniony jako treść masowa)');
    p(`Zeskanowane/wykryte bez indeksu: **${formatLiczby(r1.r1)}** z ${formatLiczby(r1.znane)} znanych adresów` +
      ` (${formatProcent(r1.udzial)}) → **${r1.ocena}**. Liczy się TREND między odczytami (docs/gsc-dziennik.md), nie jedna liczba.`, '');
  }
  p('Następny krok: przykładowe adresy każdej przyczyny (w GSC: kliknij przyczynę → Eksportuj) przepuść przez `gsc-eksport.mjs --adresy`, szczegóły w skillu `gsc-indeksowanie`.', '');
}

function skutecznosc(r) {
  const { tabele } = r;
  const daty = tabele.daty?.wiersze ?? [];
  if (daty.length) {
    const kl = daty.reduce((s, w) => s + (w.clicks ?? 0), 0);
    const wy = daty.reduce((s, w) => s + (w.impressions ?? 0), 0);
    const poz = daty.reduce((s, w) => s + (w.position ?? 0) * (w.impressions ?? 0), 0) / (wy || 1);
    const zakres = [...daty].map((w) => w.date).sort();
    p(`Okres ${zakres[0]} → ${zakres[zakres.length - 1]} (${daty.length} dni): **${formatLiczby(kl)}** kliknięć, **${formatLiczby(wy)}** wyświetleń, CTR ${formatProcent(kl / (wy || 1), 2)}, średnia pozycja ${formatPozycji(poz)}.`);
    const zq = (tabele.zapytania?.wiersze ?? []).reduce((s, w) => s + (w.clicks ?? 0), 0);
    if (tabele.zapytania && kl) p(`Nazwane zapytania niosą ${formatLiczby(zq)} z ${formatLiczby(kl)} kliknięć (${formatProcent(zq / kl)}); reszta to zapytania anonimizowane przez Google albo ucięte limitem 1000 wierszy.`);
    p('');
  }
  const strony = tabele.strony?.wiersze ?? [];
  if (strony.length) {
    p('### Typy stron (z tabeli Strony, max 1000 wierszy w eksporcie z interfejsu)');
    const grupy = {};
    const robots = regulyRobots();
    for (const w of strony) {
      const k = klasyfikujAdres(w.page, { robots });
      const g = (grupy[k.nazwa] ??= { strony: 0, kl: 0, wy: 0, pw: 0 });
      g.strony++; g.kl += w.clicks ?? 0; g.wy += w.impressions ?? 0; g.pw += (w.position ?? 0) * (w.impressions ?? 0);
    }
    tabelaMd(['Typ strony', 'Strony', 'Kliknięcia', 'Wyświetlenia', 'CTR', 'Pozycja'],
      Object.entries(grupy).sort((a, b) => b[1].wy - a[1].wy).map(([n, g]) => [n, g.strony, formatLiczby(g.kl), formatLiczby(g.wy), formatProcent(g.kl / (g.wy || 1), 2), formatPozycji(g.pw / (g.wy || 1))]));
  }
  p('Pełna analiza okazji (luka CTR, blisko TOP, zero kliknięć, marka, urządzenia, trend): `node .claude/skills/gsc-skutecznosc/scripts/gsc-okazje.mjs <ten sam eksport>` (skill `gsc-skutecznosc`).', '');
}

function ai(r) {
  const { tabele } = r;
  p('Raport **widoczności w funkcjach AI** (AI Overviews, AI Mode). Google podaje tu wyłącznie wyświetlenia: bez kliknięć, bez zapytań, bez API (stan 2026).', '');
  const daty = tabele.daty?.wiersze ?? [];
  if (daty.length) opiszSzereg('Wyświetlenia w AI', analizaSzeregu(daty, 'impressions'));
  const strony = tabele.strony?.wiersze ?? [];
  if (strony.length) {
    p('', '### Strony cytowane przez AI');
    const robots = regulyRobots();
    tabelaMd(['Strona', 'Typ', 'Wyświetlenia'], [...strony].sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0)).slice(0, 15)
      .map((w) => [w.page, klasyfikujAdres(w.page, { robots }).nazwa, formatLiczby(w.impressions)]));
  }
  p('Porównaj z koszykami promptów z Załącznika A w docs/seo-geo-strategia.md: które typy stron modele realnie pokazują.', '');
}

function cwv(r) {
  const wyk = r.tabele['wykres-cwv'];
  if (wyk) {
    opiszSzereg('Dobre', analizaSzeregu(wyk.wiersze, 'good', { prog: 5 }));
    opiszSzereg('Wymagające poprawy', analizaSzeregu(wyk.wiersze, 'needsImprovement', { prog: 5 }));
    opiszSzereg('Słabe', analizaSzeregu(wyk.wiersze, 'poor', { prog: 5 }));
  }
  p('', 'Progi (75. percentyl realnych użytkowników): LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. Znane decyzje i pułapki (polyfille, czcionki): docs/seo-geo-strategia.md, 7a.1.', '');
}

function mapyWitryn(r) {
  const w = r.tabele['mapy-witryn']?.wiersze ?? [];
  tabelaMd(['Mapa', 'Typ', 'Przesłano', 'Ostatni odczyt', 'Stan', 'Wykryte strony'],
    w.map((x) => [x.sitemap, x.type, x.submitted, x.lastRead, x.status, formatLiczby(x.discoveredPages)]));
  p('Uwaga: „Wykryte strony” liczy WPISY w mapie, nie różne obiekty. Do 2026-09-26 32 tys. wpisów sitemap boisk dawało ~10,6 tys. różnych adresów (PR #435).', '');
}

function adresy(lista) {
  const grupy = grupujWedlugTypu(lista);
  p(`Adresów: ${lista.length}.`, '');
  tabelaMd(['Typ strony', 'Liczba', 'Plik', 'Oczekiwana indeksacja', 'Przykłady'],
    Object.values(grupy).sort((a, b) => b.liczba - a.liczba).map((g) => [g.nazwa, g.liczba, g.plik ? `\`${g.plik}\`` : '–', g.indeksacja, g.przyklady.join('<br>')]));
  const robots = regulyRobots();
  const obiekty = lista.map((a) => klasyfikujAdres(a, { robots })).filter((k) => k.typ === 'obiekt');
  if (obiekty.length) {
    const w = {};
    for (const o of obiekty) w[o.wariantOpis] = (w[o.wariantOpis] ?? 0) + 1;
    p('Warianty adresów obiektów:');
    for (const [opis, n] of Object.entries(w)) p(`- ${opis}: ${n}`);
    p('');
  }
  const hosty = new Set(lista.map((a) => { try { return new URL(a).host; } catch { return null; } }).filter(Boolean));
  if (hosty.size > 1) p(`⚠️ Adresy z ${hosty.size} hostów (${[...hosty].join(', ')}): sprawdź, czy canonical i sitemapa używają jednego (NEXT_PUBLIC_SITE_URL).`, '');
}

// --- main --------------------------------------------------------------------

function main() {
  if (pliki.length === 0) {
    console.error('Użycie: node gsc-eksport.mjs <eksport.zip | plik.csv | katalog> [--json wynik.json] [--adresy]');
    process.exit(2);
  }

  if (flagi.has('--adresy')) {
    const lista = pliki.flatMap((f) => readFileSync(f, 'utf8').split(/\r?\n/))
      .map((l) => (l.match(/https?:\/\/[^\s,;"]+|^\/[^\s,;"]*/) ?? [])[0]).filter(Boolean);
    p('# Klasyfikacja adresów wg typów stron Bojo', '');
    adresy(lista);
    console.log(out.join('\n'));
    return;
  }

  const r = wczytajEksport(pliki);
  const { raport, tabele } = r;
  const NAZWY = {
    ulepszenia: 'Ulepszenia (wyniki rozszerzone)', indeksowanie: 'Indeksowanie → Strony', skutecznosc: 'Skuteczność',
    ai: 'Skuteczność w funkcjach AI', cwv: 'Podstawowe wskaźniki internetowe', 'mapy-witryn': 'Mapy witryn',
    przyklady: 'Lista przykładowych adresów', nieznany: 'nierozpoznany',
  };
  p(`# Eksport GSC: ${NAZWY[raport.typ] ?? raport.typ}`, '');
  p(`Źródło: ${r.zrodlo.join(', ')}` + (raport.wlasciwosc ? ` · usługa ${raport.wlasciwosc}` : '') + (raport.data ? ` · eksport z ${raport.data}` : ''));
  p(`Tabele: ${Object.values(tabele).map((t) => `${t.rola} (${t.wiersze.length} wierszy${t.pliki?.length > 1 ? `, ${t.pliki.length} pliki` : ''})`).join(', ')}`);
  if (raport.filtry) p(`Filtry: ${Object.entries(raport.filtry).map(([k, v]) => `${k} = ${v}`).join('; ')}`);
  const niezm = Object.values(tabele).flatMap((t) => t.niezmapowane.map((n) => `${t.plik}: „${n}”`));
  if (niezm.length) p(`Kolumny nierozpoznane (pominięte): ${niezm.join(', ')}`);
  p('');

  if (raport.typ === 'ulepszenia') ulepszenia(r);
  else if (raport.typ === 'indeksowanie') indeksowanie(r);
  else if (raport.typ === 'skutecznosc') skutecznosc(r);
  else if (raport.typ === 'ai') ai(r);
  else if (raport.typ === 'cwv') cwv(r);
  else if (raport.typ === 'mapy-witryn') mapyWitryn(r);
  else if (raport.typ === 'przyklady') adresy(tabele.przyklady.wiersze.map((w) => w.page));
  else p('Nie rozpoznano raportu. Nagłówki tabel:', ...Object.values(tabele).map((t) => `- ${t.plik}: ${t.naglowki.join(', ')}`));

  if (tabele.przyklady && raport.typ !== 'przyklady') {
    p('### Przykładowe adresy z eksportu');
    adresy(tabele.przyklady.wiersze.map((w) => w.page));
  }

  const json = wartoscFlagi('--json');
  if (json) {
    writeFileSync(json, JSON.stringify(r, null, 2));
    p(`Znormalizowany raport zapisany: ${json}`);
  }
  console.log(out.join('\n'));
}

main();
