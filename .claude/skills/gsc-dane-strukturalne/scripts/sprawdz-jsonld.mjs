#!/usr/bin/env node
// sprawdz-jsonld: check the JSON-LD a page really serves against Google's
// structured-data rules (reguly-google.mjs), BEFORE Search Console does.
//
// Why a local checker when Google has the Rich Results Test: that tool is a
// browser page (blocked in the agent container, manual everywhere else) and
// it only answers after a deploy. This one runs on a saved page, a local build
// or builder output (jsonld-z-buildera.mjs), so a missing field is caught in
// the PR that removes it, not in an e-mail two weeks later.
//
// Usage:
//   node sprawdz-jsonld.mjs --url https://www.bojo.pl/wydarzenia/<id>   # live page (own machine)
//   node sprawdz-jsonld.mjs --url http://localhost:3000/faq             # local build
//   node sprawdz-jsonld.mjs --plik strona.html                          # saved HTML or JSON
//   node jsonld-z-buildera.mjs … | node sprawdz-jsonld.mjs              # JSON on stdin
//   add --json for machine-readable output
// Exit code: 1 when any REQUIRED field is missing or malformed, else 0.

import { readFileSync } from 'node:fs';
import { regulyDla, FORMATY } from './reguly-google.mjs';

const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);

/** All JSON-LD blocks from HTML (or the whole input if it already is JSON). */
export function wyciagnijBloki(tekst) {
  const t = tekst.trim();
  if (t.startsWith('{') || t.startsWith('[')) return [{ zrodlo: 'json', dane: JSON.parse(t) }];
  const bloki = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  let i = 0;
  while ((m = re.exec(tekst))) {
    i++;
    try {
      bloki.push({ zrodlo: `blok ${i}`, dane: JSON.parse(m[1]) });
    } catch (e) {
      bloki.push({ zrodlo: `blok ${i}`, blad: `nieprawidłowy JSON: ${e.message}` });
    }
  }
  return bloki;
}

/** Flatten @graph and top-level arrays into a list of typed nodes. */
function wezly(dane) {
  const lista = Array.isArray(dane) ? dane : [dane];
  return lista.flatMap((d) => (d && d['@graph'] ? d['@graph'] : [d])).filter(Boolean);
}

const tylkoOdwolanie = (v) => v && typeof v === 'object' && v['@id'] && Object.keys(v).length === 1;

const typy = (w) => (Array.isArray(w?.['@type']) ? w['@type'] : w?.['@type'] ? [w['@type']] : []);

/** Values at a dotted path; arrays fan out. Resolves {"@id"} references. */
function wartosci(wezel, sciezka, indeks) {
  let biezace = [wezel];
  for (const klucz of sciezka.split('.')) {
    const nast = [];
    for (const b of biezace) {
      const r = rozwiaz(b, indeks);
      if (r == null || typeof r !== 'object') continue;
      const v = r[klucz];
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v)) nast.push(...v); else nast.push(v);
    }
    biezace = nast;
  }
  return biezace.map((v) => rozwiaz(v, indeks));
}

function rozwiaz(v, indeks) {
  if (v && typeof v === 'object' && v['@id'] && Object.keys(v).length === 1 && indeks.has(v['@id'])) {
    return indeks.get(v['@id']);
  }
  return v;
}

/** Google's own breadcrumb checks. */
function sprawdzOkruszki(wezel, wynik) {
  const el = wezel.itemListElement;
  if (!Array.isArray(el) || el.length === 0) {
    wynik.krytyczne.push('itemListElement: pusta albo nie jest listą');
    return;
  }
  if (el.length < 2) wynik.uwagi.push('tylko jeden okruszek: Google zaleca co najmniej dwa');
  el.forEach((li, i) => {
    const nr = `itemListElement[${i}]`;
    if (li.position !== i + 1) wynik.krytyczne.push(`${nr}.position = ${li.position}, oczekiwano ${i + 1}`);
    const nazwa = li.name ?? li.item?.name;
    if (!nazwa) wynik.krytyczne.push(`${nr}: brak name (ani item.name)`);
    const ostatni = i === el.length - 1;
    const item = typeof li.item === 'string' ? li.item : li.item?.['@id'] ?? li.item?.url;
    if (!item && !ostatni) wynik.krytyczne.push(`${nr}: brak item (URL); pominąć wolno tylko w ostatnim okruszku`);
    if (item && !/^https?:\/\//.test(item)) wynik.krytyczne.push(`${nr}.item „${item}” nie jest pełnym adresem`);
  });
}

/** Validate one node. Returns { typ, reguly, krytyczne[], ostrzezenia[], uwagi[] }. */
export function sprawdzWezel(wezel, indeks = new Map()) {
  const t = typy(wezel);
  const wynik = { typ: t.join(', ') || '(brak @type)', krytyczne: [], ostrzezenia: [], uwagi: [] };
  const r = t.map(regulyDla).find(Boolean);
  if (!r) {
    wynik.uwagi.push('typ bez reguł Google w tym narzędziu (nie oznacza błędu)');
    return wynik;
  }
  wynik.reguly = r.nazwa;
  wynik.wynikRozszerzony = r.wynikRozszerzony;

  for (const p of r.wymagane) {
    if (wartosci(wezel, p, indeks).length === 0) {
      // A nested requirement only applies when its parent exists at all.
      const rodzic = p.includes('.') ? p.slice(0, p.lastIndexOf('.')) : null;
      if (rodzic && wartosci(wezel, rodzic, indeks).length === 0) continue;
      wynik.krytyczne.push(`brak wymaganego pola „${p}”`);
    }
  }
  for (const p of r.zalecane) {
    if (wartosci(wezel, p, indeks).length === 0) {
      const rodzic = p.includes('.') ? p.slice(0, p.lastIndexOf('.')) : null;
      if (rodzic && wartosci(wezel, rodzic, indeks).length === 0) continue;
      // Parent is only a reference to a node outside this document (e.g. the
      // Organization emitted by the root layout): not checkable from here.
      const odwolania = rodzic ? wartosci(wezel, rodzic, indeks).filter(tylkoOdwolanie) : [];
      if (odwolania.length) {
        wynik.uwagi.push(`„${p}”: ${rodzic} to odwołanie @id ${odwolania[0]['@id']} do węzła spoza tego dokumentu; sprawdź na całej stronie (--url/--plik)`);
        continue;
      }
      wynik.ostrzezenia.push(`brak zalecanego pola „${p}”`);
    }
  }
  for (const [p, sprawdz] of Object.entries(r.formaty ?? {})) {
    for (const v of wartosci(wezel, p, indeks)) {
      const blad = sprawdz(v);
      if (!blad) continue;
      const cel = r.wymagane.includes(p) ? wynik.krytyczne : wynik.ostrzezenia;
      cel.push(`${p}: ${blad}`);
    }
  }
  for (const [p, uwaga] of Object.entries(r.uwagi ?? {})) {
    for (const v of wartosci(wezel, p, indeks)) {
      const u = uwaga(v);
      if (u) wynik.uwagi.push(`${p}: ${u}`);
    }
  }
  if (r.wlasne === 'okruszki') sprawdzOkruszki(wezel, wynik);

  // Google no longer evaluates deprecated types: nothing here can turn red in
  // Search Console, so findings are information, not errors.
  if (r.wycofany) {
    wynik.uwagi.push(...[...wynik.krytyczne, ...wynik.ostrzezenia].map((x) => `(Google tego nie ocenia) ${x}`));
    wynik.krytyczne = [];
    wynik.ostrzezenia = [];
  }

  // Cross-field sanity that Google enforces in the Events report.
  if (r.nazwa === 'Event') {
    const [start] = wartosci(wezel, 'startDate', indeks);
    const [koniec] = wartosci(wezel, 'endDate', indeks);
    if (start && koniec && !FORMATY.dataczas(start) && !FORMATY.dataczas(koniec) && koniec < start) {
      wynik.krytyczne.push(`endDate (${koniec}) przed startDate (${start})`);
    }
  }
  return wynik;
}

/** Check every block of a page. */
export function sprawdzStrone(tekst) {
  const bloki = wyciagnijBloki(tekst);
  const indeks = new Map();
  for (const b of bloki) for (const w of b.dane ? wezly(b.dane) : []) if (w['@id']) indeks.set(w['@id'], w);
  const wyniki = [];
  for (const b of bloki) {
    if (b.blad) { wyniki.push({ zrodlo: b.zrodlo, typ: '?', krytyczne: [b.blad], ostrzezenia: [], uwagi: [] }); continue; }
    for (const w of wezly(b.dane)) wyniki.push({ zrodlo: b.zrodlo, ...sprawdzWezel(w, indeks) });
  }
  return wyniki;
}

function wypisz(wyniki, skad) {
  console.log(`# JSON-LD: ${skad}\n`);
  if (wyniki.length === 0) {
    console.log('Brak bloków application/ld+json. Strona prywatna, 404 albo JSON-LD nie doszedł w HTML (render po stronie klienta?).');
    return;
  }
  for (const w of wyniki) {
    const stan = w.krytyczne.length ? '❌' : w.ostrzezenia.length ? '⚠️' : '✅';
    console.log(`## ${stan} ${w.typ} (${w.zrodlo})${w.reguly && w.reguly !== w.typ ? ` → reguły ${w.reguly}` : ''}`);
    if (w.wynikRozszerzony) console.log(`Wynik rozszerzony: ${w.wynikRozszerzony}`);
    for (const k of w.krytyczne) console.log(`- ❌ KRYTYCZNE: ${k}`);
    for (const o of w.ostrzezenia) console.log(`- ⚠️ niekrytyczne: ${o}`);
    for (const u of w.uwagi) console.log(`- ℹ️ ${u}`);
    console.log('');
  }
}

async function main() {
  let tekst;
  let skad;
  if (arg('--url')) {
    skad = arg('--url');
    const odp = await fetch(skad, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bojo-sprawdz-jsonld)' }, redirect: 'follow' });
    tekst = await odp.text();
    skad += ` (HTTP ${odp.status}${odp.redirected ? `, po przekierowaniu na ${odp.url}` : ''})`;
  } else if (arg('--plik')) {
    skad = arg('--plik');
    tekst = readFileSync(skad, 'utf8');
  } else {
    skad = 'stdin';
    tekst = readFileSync(0, 'utf8');
  }
  const wyniki = sprawdzStrone(tekst);
  if (args.includes('--json')) console.log(JSON.stringify(wyniki, null, 2));
  else wypisz(wyniki, skad);
  process.exitCode = wyniki.some((w) => w.krytyczne.length) ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('sprawdz-jsonld.mjs')) {
  main().catch((e) => {
    console.error(`sprawdz-jsonld: ${e.message}`);
    if (/fetch failed|ENOTFOUND|403|EAI_AGAIN/.test(String(e.cause ?? e.message))) {
      console.error('Brak dostępu sieciowego do strony. W kontenerze agenta bojo.pl jest zablokowane: zapisz HTML z przeglądarki (Ctrl+S) i użyj --plik, albo sprawdź lokalny build.');
    }
    process.exit(2);
  });
}
