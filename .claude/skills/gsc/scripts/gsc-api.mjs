#!/usr/bin/env node
// gsc-api: pull Search Console data directly, instead of waiting for someone to
// click "Export" (UI exports stop at 1000 rows; the API gives up to 25 000 per
// request and 50 000 per day per search type, and URL Inspection for single
// pages). Output is the same normalized JSON as gsc-eksport.mjs --json, so
// every analyser works on both.
//
// Setup (once): .claude/skills/gsc/references/dane-i-dostep.md, „Dostęp przez API”.
//   env GSC_KLUCZ_JSON | GSC_KLUCZ_PLIK   service-account key (read-only scope)
//   env GSC_WITRYNA                       property, default https://www.bojo.pl/
//   env PAGESPEED_KLUCZ                   API key for the `psi` command (optional)
//
// Commands:
//   witryny                                   properties this key can read
//   skutecznosc [--od RRRR-MM-DD] [--do …] [--typ web|discover|news|image|video]
//               [--swieze] [--limit 25000] --wyjscie dane.json
//   inspekcja <url…> | --z-pliku adresy.txt [--wyjscie wynik.json]
//   mapy                                      submitted sitemaps and their counts
//   psi <url> [--strategia mobile|desktop]    Core Web Vitals (CrUX field + Lighthouse)
//
// Quotas: Search Analytics 50k rows/day/type; URL Inspection 2000/day and
// 600/min per property (this script waits 110 ms between calls).

import { readFileSync, writeFileSync } from 'node:fs';
import { wczytajKlucz, tokenDostepu } from './lib/google-auth.mjs';

const args = process.argv.slice(2);
const komenda = args[0];
const wart = (n, d = null) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const WITRYNA = process.env.GSC_WITRYNA || 'https://www.bojo.pl/';
const API = 'https://www.googleapis.com/webmasters/v3';
const INSPEKCJA = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

const dzien = (d) => d.toISOString().slice(0, 10);
const czekaj = (ms) => new Promise((r) => setTimeout(r, ms));

async function zapytanie(token, url, body) {
  const odp = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const dane = await odp.json().catch(() => ({}));
  if (!odp.ok) {
    const msg = dane.error?.message ?? JSON.stringify(dane).slice(0, 300);
    const podpowiedz = odp.status === 403
      ? ` Konto serwisowe nie ma dostępu do ${WITRYNA}: dodaj jego adres e-mail w GSC → Ustawienia → Użytkownicy i uprawnienia (uprawnienie „Ograniczone” wystarczy).`
      : '';
    throw new Error(`HTTP ${odp.status}: ${msg}.${podpowiedz}`);
  }
  return dane;
}

const enc = (s) => encodeURIComponent(s);

/** Paginate one searchAnalytics query up to `limit` rows. */
async function analityka(token, cialo, limit) {
  const wiersze = [];
  for (let start = 0; start < limit; start += 25000) {
    const d = await zapytanie(token, `${API}/sites/${enc(WITRYNA)}/searchAnalytics/query`, {
      ...cialo, rowLimit: Math.min(25000, limit - start), startRow: start,
    });
    const nowe = d.rows ?? [];
    wiersze.push(...nowe);
    if (nowe.length < 25000) break;
  }
  return wiersze;
}

function naWiersze(surowe, wymiary) {
  return surowe.map((r) => {
    const o = {};
    wymiary.forEach((w, i) => { o[w] = r.keys[i]; });
    return { ...o, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position };
  });
}

async function skutecznosc(token) {
  // GSC data lags ~2 days; default window: 28 full days ending 3 days ago.
  const doD = wart('--do') ?? dzien(new Date(Date.now() - 3 * 864e5));
  const odD = wart('--od') ?? dzien(new Date(Date.parse(doD) - 27 * 864e5));
  const typ = wart('--typ', 'web');
  const limit = Number(wart('--limit', 25000));
  const baza = { startDate: odD, endDate: doD, type: typ, ...(args.includes('--swieze') ? { dataState: 'all' } : {}) };
  const zestawy = {
    daty: ['date'], zapytania: ['query'], strony: ['page'], urzadzenia: ['device'], kraje: ['country'],
    'strona-zapytanie': ['page', 'query'],
  };
  const tabele = {};
  for (const [rola, wymiary] of Object.entries(zestawy)) {
    const surowe = await analityka(token, { ...baza, dimensions: wymiary }, rola === 'daty' ? 1000 : limit);
    tabele[rola] = { rola, plik: `api:${wymiary.join('+')}`, mapa: {}, niezmapowane: [], wiersze: naWiersze(surowe, wymiary) };
    console.error(`  ${rola}: ${surowe.length} wierszy`);
  }
  return {
    zrodlo: [`API ${WITRYNA}`],
    raport: { typ: 'skutecznosc', wlasciwosc: WITRYNA, data: dzien(new Date()), filtry: { 'Typ wyszukiwania': typ, Data: `${odD} → ${doD}` } },
    tabele,
  };
}

async function inspekcja(token) {
  const lista = args.includes('--z-pliku')
    ? readFileSync(wart('--z-pliku'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => /^https?:\/\//.test(l))
    : args.slice(1).filter((a) => /^https?:\/\//.test(a));
  if (!lista.length) throw new Error('Podaj adresy URL (pełne, z https://) albo --z-pliku.');
  const wyniki = [];
  for (const url of lista) {
    const d = await zapytanie(token, INSPEKCJA, { inspectionUrl: url, siteUrl: WITRYNA, languageCode: 'pl' });
    const r = d.inspectionResult ?? {};
    const i = r.indexStatusResult ?? {};
    const rr = r.richResultsResult;
    wyniki.push({
      url,
      werdykt: i.verdict, stan: i.coverageState, indeksowanie: i.indexingState, robots: i.robotsTxtState,
      pobranie: i.pageFetchState, ostatnieSkanowanie: i.lastCrawlTime, jako: i.crawledAs,
      canonicalGoogle: i.googleCanonical, canonicalNasz: i.userCanonical, sitemapy: i.sitemap, odsylacze: i.referringUrls,
      wynikiRozszerzone: rr ? rr.detectedItems?.map((x) => ({ typ: x.richResultType, elementy: x.items?.map((it) => ({ nazwa: it.name, problemy: it.issues?.map((s) => `${s.severity}: ${s.issueMessage}`) })) })) : null,
      link: r.inspectionResultLink,
    });
    console.error(`  ${url}: ${i.coverageState ?? '?'}`);
    await czekaj(110);
  }
  return wyniki;
}

async function psi() {
  const url = args[1];
  if (!url) throw new Error('Podaj adres: gsc-api.mjs psi https://www.bojo.pl/');
  const klucz = process.env.PAGESPEED_KLUCZ;
  const strategia = wart('--strategia', 'mobile');
  const q = new URLSearchParams({ url, strategy: strategia, category: 'performance', ...(klucz ? { key: klucz } : {}) });
  const odp = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`);
  if (odp.status === 429) throw new Error('PageSpeed bez klucza ma wspólny, wyczerpany limit: ustaw PAGESPEED_KLUCZ (klucz API z Google Cloud, darmowy).');
  const d = await odp.json();
  if (!odp.ok) throw new Error(`PSI HTTP ${odp.status}: ${d.error?.message ?? ''}`);
  const pole = (le) => le?.metrics ? Object.fromEntries(Object.entries(le.metrics).map(([k, v]) => [k, { p75: v.percentile, ocena: v.category }])) : null;
  const a = d.lighthouseResult?.audits ?? {};
  return {
    url, strategia,
    uzytkownicyStrona: pole(d.loadingExperience), uzytkownicyWitryna: pole(d.originLoadingExperience),
    laboratorium: {
      wynik: d.lighthouseResult?.categories?.performance?.score,
      LCP: a['largest-contentful-paint']?.displayValue, CLS: a['cumulative-layout-shift']?.displayValue,
      TBT: a['total-blocking-time']?.displayValue, FCP: a['first-contentful-paint']?.displayValue,
    },
    elementLcp: a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet ?? null,
    okazje: Object.values(a).filter((x) => x.details?.type === 'opportunity' && x.numericValue > 100)
      .sort((x, y) => y.numericValue - x.numericValue).slice(0, 5).map((x) => `${x.title}: ${x.displayValue ?? ''}`),
  };
}

async function main() {
  if (!komenda || komenda === '--help') {
    console.error(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
    process.exit(2);
  }
  if (komenda === 'psi') { console.log(JSON.stringify(await psi(), null, 2)); return; }

  const token = await tokenDostepu(wczytajKlucz());
  let wynik;
  if (komenda === 'witryny') wynik = await zapytanie(token, `${API}/sites`);
  else if (komenda === 'mapy') wynik = await zapytanie(token, `${API}/sites/${enc(WITRYNA)}/sitemaps`);
  else if (komenda === 'skutecznosc') wynik = await skutecznosc(token);
  else if (komenda === 'inspekcja') wynik = await inspekcja(token);
  else throw new Error(`Nieznana komenda „${komenda}”.`);

  const plik = wart('--wyjscie');
  if (plik) { writeFileSync(plik, JSON.stringify(wynik, null, 2)); console.error(`Zapisano ${plik}`); }
  else console.log(JSON.stringify(wynik, null, 2));
}

main().catch((e) => {
  console.error(`gsc-api: ${e.message}`);
  process.exit(1);
});
