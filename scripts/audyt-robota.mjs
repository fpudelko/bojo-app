#!/usr/bin/env node
// audyt-robota — sprawdza, co widzi CRAWLER: pobiera strony zwykłym `fetch`,
// bez wykonywania JavaScriptu, i stawia im wymagania, których nie sprawdza
// żadne inne narzędzie w repo.
//
// Po co, skoro jest tsc, Vitest, ESLint i Playwright: bo wszystkie cztery
// patrzą na aplikację z tej strony, z której problemu nie widać. Playwright
// URUCHAMIA JavaScript, więc dla niego strona dociągająca dane w `useEffect`
// wygląda kompletnie. Dla GPTBota, ClaudeBota i PerplexityBota — nie.
// Tą szczeliną przeszły Fazy 1 i 2b SEO/GEO: odhaczone jako zrobione, a strona
// obiektu oddawała robotowi pusty szkielet bez <h1>, bez opisu i bez jednego
// linku wychodzącego (BACKLOG.md §7a, docs/seo-geo-strategia.md rozdz. 0).
//
// Użycie:
//   node scripts/audyt-robota.mjs                      # http://localhost:3000
//   node scripts/audyt-robota.mjs --baza https://bojo.pl
//   node scripts/audyt-robota.mjs --bez-bazy           # trasy z danych sprawdzane miękko
//   node scripts/audyt-robota.mjs --baza https://bojo.pl --boisko orlik-rataje
//
// OGRANICZENIE, które trzeba znać: `--bez-bazy` (tryb CI, atrapy kluczy
// Supabase) NIE sprawdzi stron obiektu ani hubów wypełnionych danymi — bez bazy
// nie mają czego wyrenderować. Pełne pokrycie daje dopiero przebieg przeciwko
// produkcji (Załącznik B w docs/seo-geo-strategia.md).

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const BAZA = (args.includes('--baza') ? args[args.indexOf('--baza') + 1] : 'http://localhost:3000').replace(/\/$/, '');
const BEZ_BAZY = args.includes('--bez-bazy');
// Slug istniejącego obiektu. Bez niego strony obiektu nie da się sprawdzić —
// a to ONA jest powodem, dla którego ten skrypt powstał (30 tys. stron, które
// oddawały robotowi pusty szkielet). Przy przebiegu na produkcji podaj dowolny
// realny slug z katalogu.
const BOISKO = args.includes('--boisko') ? args[args.indexOf('--boisko') + 1] : null;

// ---------------------------------------------------------------------------
// Frazy zakazane — JEDNO źródło z treścią stron. Parsowane z pliku TS zamiast
// przepisywane, bo dwie kopie tej listy rozjadą się przy pierwszej zmianie.
// ---------------------------------------------------------------------------
function frazyZakazane() {
  const ts = readFileSync(join(ROOT, 'frontend/src/content/zakazaneFrazy.ts'), 'utf8');
  const blok = ts.slice(ts.indexOf('ZAKAZANE_WSZEDZIE'));
  const lista = blok.slice(blok.indexOf('['), blok.indexOf(']'));
  return [...lista.matchAll(/'([^']+)'/g)].map((m) => new RegExp(m[1], 'i'));
}
const ZAKAZANE = frazyZakazane();

// ---------------------------------------------------------------------------
// Trasy. `h1` — czy strona ma mieć nagłówek pierwszego poziomu w HTML.
// `linki` — czy ma prowadzić dalej w głąb serwisu. `noindex` — czy ma być poza
// indeksem. `wymagaBazy` — czy bez danych nie ma czego pokazać.
// ---------------------------------------------------------------------------
const TRASY = [
  { adres: '/',                     h1: true,  linki: true },
  { adres: '/jak-dziala-bojo',      h1: true,  linki: true },
  { adres: '/dlaczego-bojo',        h1: true,  linki: true },
  { adres: '/faq',                  h1: true,  linki: true },
  { adres: '/regulamin',            h1: true,  linki: true },
  { adres: '/kalkulator-kosztow-boiska', h1: true, linki: true },
  { adres: '/prywatnosc',           h1: true,  linki: true },
  { adres: '/wydarzenia',           h1: false, linki: true },
  { adres: '/grupy',                h1: false, linki: true },
  { adres: '/boiska/pilka-nozna',   h1: true,  linki: true, wymagaBazy: true },
  { adres: '/boiska/pilka-nozna/poznan', h1: true, linki: true, wymagaBazy: true },
  { adres: '/boiska/woj/wielkopolskie', h1: true, linki: true, wymagaBazy: true },
  { adres: '/pilka-nozna/poznan',   h1: true,  linki: true, wymagaBazy: true },
  // Mecz, którego nie ma, wygląda tak samo jak prywatny — i jeden, i drugi ma
  // zostać poza indeksem (docs/seo-geo-strategia.md, P1).
  { adres: '/wydarzenia/00000000-0000-4000-8000-000000000000', h1: false, linki: false, noindex: true },
  // Strona obiektu: sedno sprawy, ale bez danych nie ma czego wyrenderować.
  ...(BOISKO ? [{ adres: `/boisko/${BOISKO}`, h1: true, linki: true, wymagaBazy: true }] : []),
];

// ---------------------------------------------------------------------------
const bledy = [];
const zgloś = (adres, tresc) => bledy.push(`${adres}: ${tresc}`);

const policz = (html, re) => (html.match(re) ?? []).length;

async function sprawdz(trasa) {
  // Tryb miękki: trasa żyjąca z danych, uruchomiona bez bazy. Jeśli mimo to
  // się wyrenderowała — sprawdzamy ją normalnie. Jeśli nie — notatka zamiast
  // czerwieni, bo to brak danych, nie regresja. Twardo sprawdza ją dopiero
  // przebieg przeciwko produkcji (bez `--bez-bazy`).
  const miekko = trasa.wymagaBazy && BEZ_BAZY;

  let html;
  try {
    const odp = await fetch(`${BAZA}${trasa.adres}`, { redirect: 'follow' });
    if (!odp.ok) {
      if (miekko) { console.log(`  – ${trasa.adres} (HTTP ${odp.status} bez bazy — pominięte)`); return; }
      return zgloś(trasa.adres, `HTTP ${odp.status}`);
    }
    html = await odp.text();
  } catch (e) {
    if (miekko) { console.log(`  – ${trasa.adres} (nieosiągalne bez bazy — pominięte)`); return; }
    return zgloś(trasa.adres, `nieosiągalne (${e.message})`);
  }

  // 1. Tytuł: jest i nie ma podwojonego sufiksu (title.template z layout.tsx
  //    dokłada „| Bojo" — ręczny sufiks w page.tsx dawał „| Bojo | Bojo").
  const tytul = html.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!tytul) zgloś(trasa.adres, 'brak <title>');
  else if ((tytul.match(/\| Bojo/g) ?? []).length > 1) zgloś(trasa.adres, `podwojony sufiks w tytule: „${tytul}"`);

  // 2. Nagłówek H1 — dokładnie jeden, niepusty.
  if (trasa.h1) {
    const ile = policz(html, /<h1[\s>]/g);
    if (ile === 0) zgloś(trasa.adres, 'brak <h1> w HTML (treść dorysowuje się dopiero w przeglądarce?)');
    else if (ile > 1) zgloś(trasa.adres, `${ile} elementów <h1> — ma być jeden`);
  }

  // 3. Linki w głąb serwisu. Strona bez nich jest ślepym zaułkiem: robot nie ma
  //    po czym pójść dalej, choćby metadane deklarowały `follow`.
  if (trasa.linki) {
    const wewnetrzne = new Set([...html.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]));
    if (wewnetrzne.size === 0) zgloś(trasa.adres, 'zero linków wewnętrznych w HTML');
  }

  // 4. Opis i frazy zakazane — to samo, czego pilnuje tresciStron.test.ts
  //    w treści stron, tyle że w metadanych, gdzie tamten test nie sięga.
  const opis = html.match(/name="description" content="([^"]*)"/)?.[1];
  if (!trasa.noindex && !opis) zgloś(trasa.adres, 'brak <meta name="description">');
  if (opis) {
    for (const re of ZAKAZANE) {
      if (re.test(opis)) zgloś(trasa.adres, `fraza zakazana w description (${re.source}): „${opis}"`);
    }
  }

  // 5. Indeksowalność zgodna z zamiarem.
  const robots = html.match(/name="robots" content="([^"]*)"/)?.[1] ?? '';
  if (trasa.noindex && !robots.includes('noindex')) zgloś(trasa.adres, 'miało być noindex, a nie jest');
  if (!trasa.noindex && robots.includes('noindex')) zgloś(trasa.adres, `nieoczekiwany noindex (${robots})`);

  console.log(`  ✓ ${trasa.adres}`);
}

console.log(`audyt-robota — ${BAZA}${BEZ_BAZY ? ' (bez bazy)' : ''}\n`);
if (!BOISKO) console.log('  – strona obiektu pominięta (podaj --boisko <slug>, żeby ją sprawdzić)');
for (const trasa of TRASY) await sprawdz(trasa);

console.log('');
if (bledy.length) {
  for (const b of bledy) console.error(`  ✗ ${b}`);
  console.error(`\naudyt-robota: ${bledy.length} problem(ów). Tak wygląda serwis dla crawlera.`);
  process.exit(1);
}
console.log('audyt-robota: OK — każda sprawdzana trasa oddaje robotowi treść i linki.');
