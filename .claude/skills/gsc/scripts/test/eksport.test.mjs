// Tests for the Search Console export reader. Run all skill tests with:
//   node --test $(find .claude/skills -name '*.test.mjs')
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsujCsv, wykryjSeparator } from '../lib/csv.mjs';
import { czytajZip, zbudujZip } from '../lib/zip.mjs';
import { liczbaCalkowita, liczbaDziesietna, ctrJakoUlamek, przedzialWilsona, testDwochProporcji } from '../lib/liczby.mjs';
import { wczytajEksport, parsujProblem, mapujKolumny, analizaSzeregu, metadaneZNazwyPliku } from '../lib/raporty.mjs';
import { dopasujPrzyczyne, udzialR1 } from '../lib/przyczyny.mjs';
import { eksportSkutecznosci, eksportIndeksowania, eksportCwv } from './pomocnicze.mjs';

const TU = dirname(fileURLToPath(import.meta.url));
const PRAWDZIWY_EVENTS = join(TU, 'dane', 'https___www.bojo.pl_-Events-2026-09-24.zip');
const tmp = () => mkdtempSync(join(tmpdir(), 'gsc-test-'));

test('CSV: BOM, CRLF, cudzysłowy, średniki z Excela', () => {
  assert.deepEqual(parsujCsv('﻿a,b\r\n1,"x, y"\r\n'), [['a', 'b'], ['1', 'x, y']]);
  assert.deepEqual(parsujCsv('a;b\n"1,5";"say ""hi"""'), [['a', 'b'], ['1,5', 'say "hi"']]);
  assert.equal(wykryjSeparator('Data;Kliknięcia;CTR'), ';');
  assert.deepEqual(parsujCsv('Problem,Weryfikacja,Elementy'), [['Problem', 'Weryfikacja', 'Elementy']]);
});

test('liczby w każdym formacie', () => {
  assert.equal(liczbaCalkowita('8 733'), 8733);
  assert.equal(liczbaCalkowita('8 733'), 8733);
  assert.equal(liczbaCalkowita('8,733'), 8733);
  assert.equal(liczbaDziesietna('7,5'), 7.5);
  assert.equal(liczbaDziesietna('1.234,5'), 1234.5);
  assert.equal(ctrJakoUlamek('1,34%'), 0.0134);
  assert.equal(ctrJakoUlamek('1.34%'), 0.0134);
  assert.equal(ctrJakoUlamek('0.0134'), 0.0134);
  const w = przedzialWilsona(0, 10);
  assert.ok(w.dol === 0 && w.gora > 0.25, '0/10 nie znaczy „CTR na pewno 0”');
  assert.ok(testDwochProporcji(50, 1000, 20, 1000).p < 0.01);
});

test('ZIP: zapis i odczyt, polskie nazwy plików', () => {
  const zip = zbudujZip({ 'Urządzenia.csv': 'Urządzenie,Kliknięcia\nKomórka,1' });
  const [plik] = czytajZip(zip);
  assert.equal(plik.nazwa, 'Urządzenia.csv');
  assert.match(plik.dane.toString('utf8'), /Komórka/);
});

test('prawdziwy eksport GSC „Wydarzenia” z 2026-09-24 (deflate, bez końca linii)', () => {
  const r = wczytajEksport(PRAWDZIWY_EVENTS);
  assert.equal(r.raport.typ, 'ulepszenia');
  assert.equal(r.raport.schemat, 'Event');
  assert.equal(r.raport.wlasciwosc, 'https://www.bojo.pl/');
  assert.equal(r.raport.data, '2026-09-24');
  const problemy = r.tabele.problemy.wiersze;
  assert.equal(problemy.length, 5);
  assert.ok(problemy.every((p) => p.waga === 'niekrytyczny' && p.items === 2));
  assert.deepEqual(problemy.map((p) => p.problem.sciezka).sort(),
    ['description', 'image', 'offers.availability', 'offers.validFrom', 'performer']);
  const s = analizaSzeregu(r.tabele['wykres-ulepszen'].wiersze, 'valid', { prog: 1 });
  assert.equal(s.ostatnia, 2);
  assert.equal(s.pierwszyNiezerowy.data, '2026-09-22');
});

test('nagłówki problemów rich results → ścieżka pola (PL i EN)', () => {
  assert.equal(parsujProblem('Brakujące pole „availability” (w „offers”)').sciezka, 'offers.availability');
  assert.equal(parsujProblem('Missing field "item" (in "itemListElement")').sciezka, 'itemListElement.item');
  assert.equal(parsujProblem('Nieprawidłowy typ obiektu w polu „location”').rodzaj, 'nieprawidlowy-typ');
  assert.equal(parsujProblem('Invalid value in field "startDate"').rodzaj, 'nieprawidlowa-wartosc');
});

test('kolumny okresu porównawczego → _prev', () => {
  const { mapa } = mapujKolumny(['Najczęstsze zapytania', 'Kliknięcia (ostatnie 28 dni)', 'Kliknięcia (poprzednie 28 dni)']);
  assert.deepEqual(Object.values(mapa), ['query', 'clicks', 'clicks_prev']);
  const en = mapujKolumny(['Top queries', 'Last 28 days Clicks', 'Previous 28 days Clicks']).mapa;
  assert.deepEqual(Object.values(en), ['query', 'clicks', 'clicks_prev']);
});

test('eksport skuteczności: polskie liczby i wszystkie tabele', () => {
  const k = tmp();
  const plik = join(k, 'https___www.bojo.pl_-Performance-on-Search-2026-09-14.zip');
  writeFileSync(plik, eksportSkutecznosci({ przecinek: true }));
  const r = wczytajEksport(plik);
  assert.equal(r.raport.typ, 'skutecznosc');
  for (const t of ['zapytania', 'strony', 'daty', 'kraje', 'urzadzenia', 'filtry']) assert.ok(r.tabele[t], `brak tabeli ${t}`);
  const bojo = r.tabele.zapytania.wiersze.find((w) => w.query === 'bojo');
  assert.equal(bojo.impressions, 30);
  assert.equal(bojo.position, 6.97);
  assert.equal(r.raport.filtry['Typ wyszukiwania'], 'Internet');
});

test('raport AI (same wyświetlenia) rozpoznany osobno', () => {
  const k = tmp();
  const plik = join(k, 'ai.zip');
  writeFileSync(plik, zbudujZip({ 'Strony.csv': 'Najpopularniejsze strony,Wyświetlenia\nhttps://www.bojo.pl/faq,12', 'Daty.csv': 'Data,Wyświetlenia\n2026-09-01,3' }));
  assert.equal(wczytajEksport(plik).raport.typ, 'ai');
});

test('eksport indeksowania: przyczyny, werdykty, R1 jak w odczycie z 2026-09-14', () => {
  const k = tmp();
  const plik = join(k, 'https___www.bojo.pl_-Coverage-2026-09-15.zip');
  writeFileSync(plik, eksportIndeksowania());
  const r = wczytajEksport(plik);
  assert.equal(r.raport.typ, 'indeksowanie');
  const prz = r.tabele.przyczyny.wiersze;
  assert.equal(prz.length, 6);
  assert.equal(dopasujPrzyczyne(prz[1].reason).werdykt, 'zamierzone'); // noindex
  const zind = analizaSzeregu(r.tabele['wykres-indeksowania'].wiersze, 'indexed');
  assert.equal(zind.skoki[0].na, 17473);
  const r1 = udzialR1(prz, zind.ostatnia);
  assert.equal(r1.r1, 85);
  assert.equal(r1.ocena, 'spokój');
});

test('eksport CWV rozpoznany', () => {
  const k = tmp();
  const plik = join(k, 'cwv.zip');
  writeFileSync(plik, eksportCwv());
  assert.equal(wczytajEksport(plik).raport.typ, 'cwv');
});

test('nazwa pliku z prefiksem uploadu nadal daje usługę', () => {
  assert.equal(metadaneZNazwyPliku('24540718-https___www.bojo.pl_-Events-2026-09-24.zip').wlasciwosc, 'https://www.bojo.pl/');
  assert.equal(metadaneZNazwyPliku('sc-domain_bojo.pl_-Page-indexing-2026-09-30.zip').wlasciwosc, 'sc-domain:bojo.pl');
});

test('każda przyczyna z polskiego i angielskiego interfejsu ma werdykt', () => {
  const nazwy = [
    'Strona wykluczona za pomocą tagu „noindex”', 'Excluded by ‘noindex’ tag',
    'Alternatywna strona zawierająca prawidłowy tag strony kanonicznej', 'Alternate page with proper canonical tag',
    'Duplikat, użytkownik nie oznaczył strony kanonicznej', 'Duplicate without user-selected canonical',
    'Duplikat, wybrana przez Google strona kanoniczna jest inna niż wybrana przez użytkownika', 'Duplicate, Google chose different canonical than user',
    'Strona zawiera przekierowanie', 'Page with redirect',
    'Strona zablokowana przez plik robots.txt', 'Blocked by robots.txt',
    'Zindeksowana, chociaż zablokowana przez plik robots.txt', 'Indexed, though blocked by robots.txt',
    'Strona zeskanowana, ale jeszcze nie zindeksowana', 'Crawled - currently not indexed',
    'Strona wykryta – obecnie niezindeksowana', 'Discovered - currently not indexed',
    'Nie znaleziono (404)', 'Not found (404)', 'Soft 404', 'Błąd serwera (5xx)', 'Server error (5xx)',
    'Błąd przekierowania', 'Redirect error', 'Blocked due to access forbidden (403)',
  ];
  for (const n of nazwy) assert.ok(dopasujPrzyczyne(n), `brak werdyktu dla „${n}”`);
  assert.equal(dopasujPrzyczyne('Indexed, though blocked by robots.txt').id, 'robots-zindeksowana');
  assert.equal(dopasujPrzyczyne('Soft 404').id, 'soft-404');
  assert.equal(dopasujPrzyczyne('Błąd przekierowania').id, 'blad-przekierowania');
});
