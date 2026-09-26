// URL → page type map for bojo.pl, with the code that renders each type and
// the indexing status it is SUPPOSED to have.
//
// This is the piece that turns a Search Console row ("/boisko/orlik-123abc…:
// Excluded by noindex") into a verdict ("intended: Tier 3 venue") instead of
// a generic SEO checklist. Two parts are read from the repo at runtime so the
// map cannot rot silently:
//   - robots.txt rules come from the DISALLOW array in frontend/src/app/robots.ts,
//   - static top-level routes come from the frontend/src/app directory listing
//     (anything else with two segments is the dynamic /[sport]/[miasto] route).
// Every `plik` below is checked for existence by test/mapa-bojo.test.mjs.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

const APP = 'frontend/src/app';
const SD = 'frontend/src/lib/structuredData.ts';

/** Ordered: the first matching pattern wins. */
export const TYPY_STRON = [
  {
    typ: 'strona-glowna',
    nazwa: 'Strona główna',
    wzorzec: /^\/$/,
    plik: `${APP}/page.tsx`,
    metadane: `${APP}/layout.tsx`,
    jsonld: [`siteJsonLd() w ${SD} (layout: Organization, WebSite, SoftwareApplication)`, 'faqJsonLd(LANDING_FAQ)'],
    indeksacja: 'indeksowana',
    sitemap: `${APP}/sitemap.ts`,
  },
  {
    typ: 'tresc',
    nazwa: 'Strona treści',
    wzorzec: /^\/(jak-dziala-bojo|dlaczego-bojo|o-bojo|faq|kalkulator-kosztow-boiska|regulamin|prywatnosc)\/?$/,
    plik: `${APP}/faq/page.tsx`,
    plikDla: (s) => `${APP}/${s.split('/')[1]}/page.tsx`,
    metadane: 'frontend/src/content/ (copy) + page.tsx danej trasy',
    jsonld: ['faqJsonLd()', 'howToJsonLd() na /jak-dziala-bojo', 'breadcrumbsJsonLd() w StronaTresci.tsx'],
    indeksacja: 'indeksowana',
    sitemap: `${APP}/sitemap.ts`,
  },
  {
    typ: 'obiekt',
    nazwa: 'Strona obiektu (boiska)',
    wzorzec: /^\/boisko\/[^/]+\/?$/,
    plik: `${APP}/boisko/[id]/page.tsx`,
    metadane: `generateMetadata() w ${APP}/boisko/[id]/page.tsx + metaOpisObiektu() w frontend/src/content/opisObiektu.ts`,
    jsonld: ['SportsActivityLocation (inline w page.tsx)', 'breadcrumbsJsonLd()'],
    indeksacja:
      'Tier 1/2: indeksowana; Tier 3: noindex,follow (migracja 112). Adres z samej nazwy: 307 na kanoniczny. Adres UUID: renderuje z canonical na slug.',
    sitemap: `${APP}/sitemap-boiska/[plik]/route.ts (Tier 1+2, po województwie)`,
  },
  {
    typ: 'hub-wojewodztwa',
    nazwa: 'Hub województwa',
    wzorzec: /^\/boiska\/woj\/[^/]+\/?$/,
    plik: `${APP}/boiska/woj/[wojewodztwo]/page.tsx`,
    metadane: `${APP}/boiska/woj/[wojewodztwo]/page.tsx`,
    jsonld: ['venueListJsonLd() (ItemList)'],
    indeksacja: 'indeksowana',
    sitemap: `${APP}/sitemap.ts`,
  },
  {
    typ: 'hub-miasta',
    nazwa: 'Hub miasta w katalogu',
    wzorzec: /^\/boiska\/[^/]+\/[^/]+\/?$/,
    plik: `${APP}/boiska/[sport]/[miasto]/page.tsx`,
    metadane: `${APP}/boiska/[sport]/[miasto]/page.tsx`,
    jsonld: ['venueListJsonLd() (ItemList)'],
    indeksacja: 'indeksowana powyżej progu jakości (frontend/src/lib/hubMiasta.ts), poniżej: 404',
    sitemap: `${APP}/sitemap.ts (paryHubowMiastSportu)`,
  },
  {
    typ: 'hub-sportu',
    nazwa: 'Hub sportu w katalogu',
    wzorzec: /^\/boiska\/[^/]+\/?$/,
    plik: `${APP}/boiska/[sport]/page.tsx`,
    metadane: `${APP}/boiska/[sport]/page.tsx`,
    jsonld: ['venueListJsonLd() (ItemList)'],
    indeksacja: 'indeksowana',
    sitemap: `${APP}/sitemap.ts (HUBY_KATALOGU_SPORTOWYCH)`,
  },
  {
    typ: 'kreator',
    nazwa: 'Kreator albo edycja',
    wzorzec: /^\/(wydarzenia\/nowe|grupy\/nowe|wydarzenia\/[^/]+\/edytuj|grupy\/[^/]+\/edytuj)\/?$/,
    plik: `${APP}/wydarzenia/nowe/page.tsx`,
    metadane: '-',
    jsonld: [],
    indeksacja: 'zablokowana w robots.txt (formularze za logowaniem)',
    sitemap: 'brak',
  },
  {
    typ: 'mecz',
    nazwa: 'Strona meczu',
    wzorzec: /^\/wydarzenia\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i,
    plik: `${APP}/wydarzenia/[id]/page.tsx`,
    metadane: `metadataDlaMeczu() w ${APP}/wydarzenia/[id]/eventMeta.ts`,
    jsonld: [`eventJsonLd() w ${SD} (SportsEvent)`],
    indeksacja:
      'publiczny i przyszły: indeksowana; publiczny miniony: noindex,follow; prywatny albo nieistniejący: noindex,nofollow i bez JSON-LD',
    sitemap: 'brak (Google znajduje mecze przez linki)',
  },
  {
    typ: 'lista',
    nazwa: 'Lista w aplikacji (mecze, ekipy, mapa)',
    wzorzec: /^\/(wydarzenia|grupy|mapa)\/?$/,
    plik: `${APP}/wydarzenia/page.tsx`,
    plikDla: (s) => `${APP}/${s.split('/')[1]}/page.tsx`,
    metadane: 'page.tsx danej trasy',
    jsonld: [],
    indeksacja: 'indeksowana, ale treść dociąga się po zamontowaniu (niski priorytet w sitemapie, dług D10)',
    sitemap: `${APP}/sitemap.ts`,
  },
  {
    typ: 'gracze',
    nazwa: 'Przekierowanie /gracze',
    wzorzec: /^\/gracze\/?$/,
    plik: `${APP}/gracze/page.tsx`,
    metadane: '-',
    jsonld: [],
    indeksacja: 'redirect na /wydarzenia (zamierzone, AGENTS.md)',
    sitemap: 'brak',
  },
  {
    typ: 'kod-dolaczenia',
    nazwa: 'Link z kodem dołączenia',
    wzorzec: /^\/(d|g|t)\//,
    plik: `${APP}/d`,
    plikDla: (s) => `${APP}/${s.split('/')[1]}`,
    metadane: '-',
    jsonld: [],
    indeksacja: 'zablokowana w robots.txt: kod dołączenia to jedyna kontrola dostępu do prywatnego meczu/ekipy',
    sitemap: 'brak',
  },
  {
    typ: 'plik-techniczny',
    nazwa: 'Plik techniczny (sitemapa, robots, llms, obrazek OG)',
    wzorzec: /^\/(sitemap[^/]*\.xml|sitemap-boiska\/[^/]+\.xml|robots\.txt|llms\.txt|llm-context\.md|manifest\.webmanifest)$|\/opengraph-image/,
    plik: `${APP}/sitemap-index.xml/route.ts`,
    metadane: '-',
    jsonld: [],
    indeksacja: 'nie dotyczy (plik, nie strona)',
    sitemap: '-',
  },
];

/** Robots.txt Disallow patterns, read from robots.ts (single source of truth). */
export function regulyRobots() {
  const zrodlo = readFileSync(join(ROOT, APP, 'robots.ts'), 'utf8');
  const blok = zrodlo.slice(zrodlo.indexOf('const DISALLOW'));
  const tablica = blok.slice(blok.indexOf('['), blok.indexOf('];'));
  return [...tablica.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Google-style robots matching: prefix match, `*` wildcard, `$` end anchor. */
export function pasujeDoRobots(sciezka, wzorzec) {
  const kotwica = wzorzec.endsWith('$');
  const cialo = (kotwica ? wzorzec.slice(0, -1) : wzorzec)
    .split('*')
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${cialo}${kotwica ? '$' : ''}`).test(sciezka);
}

let pamiecTras = null;
/** Static top-level route segments from the app directory. */
export function statyczneTrasy() {
  if (pamiecTras) return pamiecTras;
  const katalog = join(ROOT, APP);
  pamiecTras = new Set(
    existsSync(katalog)
      ? readdirSync(katalog, { withFileTypes: true })
          .filter((w) => w.isDirectory() && !w.name.startsWith('[') && !w.name.startsWith('('))
          .map((w) => w.name)
      : [],
  );
  return pamiecTras;
}

// Order matters: a UUID also ends with 12 hex digits after a hyphen.
const WARIANT_OBIEKTU = [
  { wariant: 'uuid', wzorzec: /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i, opis: 'surowy identyfikator: renderuje z canonical na slug' },
  // slugBoiska(): `${nazwa}-${12 hex}`, or the bare 12 hex when the name slugifies to ''.
  { wariant: 'kanoniczny', wzorzec: /[/-][0-9a-f]{12}\/?$/, opis: 'adres kanoniczny (nazwa + końcówka id)' },
];

/**
 * Classify one URL (absolute or path). Returns the page type entry plus:
 * host, sciezka, robotsZablokowany (matching rule or null), wariant (venues).
 */
export function klasyfikujAdres(adres, { robots = regulyRobots() } = {}) {
  let host = null;
  let sciezka = adres;
  try {
    const u = new URL(adres);
    host = u.host;
    sciezka = u.pathname;
  } catch {
    sciezka = adres.split('?')[0].split('#')[0];
  }
  try { sciezka = decodeURI(sciezka); } catch { /* keep as is */ }
  if (!sciezka.startsWith('/')) sciezka = `/${sciezka}`;

  const regula = robots.find((r) => pasujeDoRobots(sciezka, r)) ?? null;

  let typ = TYPY_STRON.find((t) => t.wzorzec.test(sciezka));
  if (!typ) {
    const segmenty = sciezka.split('/').filter(Boolean);
    if (segmenty.length === 2 && !statyczneTrasy().has(segmenty[0])) {
      typ = {
        typ: 'sport-miasto',
        nazwa: 'Strona sport + miasto',
        plik: `${APP}/[sport]/[miasto]/page.tsx`,
        metadane: `${APP}/[sport]/[miasto]/page.tsx`,
        jsonld: ['breadcrumbsJsonLd()', 'howToJsonLd()', 'faqJsonLd()'],
        indeksacja: 'indeksowana (iloczyn FOCUS_SPORTS × content/miasta.ts)',
        sitemap: `${APP}/sitemap.ts`,
      };
    } else if (regula) {
      typ = {
        typ: 'zablokowana-robots',
        nazwa: 'Trasa zablokowana w robots.txt',
        plik: `${APP}/robots.ts`,
        metadane: '-',
        jsonld: [],
        indeksacja: `zablokowana w robots.txt (${regula})`,
        sitemap: 'brak',
      };
    } else {
      typ = {
        typ: 'nieznany',
        nazwa: 'Nierozpoznany adres',
        plik: null,
        metadane: '-',
        jsonld: [],
        indeksacja: 'sprawdź ręcznie',
        sitemap: '?',
      };
    }
  }

  const wynik = { ...typ, host, sciezka, robotsZablokowany: regula };
  if (typ.plikDla) wynik.plik = typ.plikDla(sciezka);
  delete wynik.wzorzec;
  delete wynik.plikDla;
  if (typ.typ === 'obiekt') {
    const w = WARIANT_OBIEKTU.find((x) => x.wzorzec.test(sciezka));
    wynik.wariant = w ? w.wariant : 'historyczny';
    wynik.wariantOpis = w ? w.opis : 'klucz historyczny (sama nazwa): przekierowanie 307 na adres kanoniczny';
  }
  return wynik;
}

/** Group URL rows by page type: { typ: { nazwa, liczba, przyklady[] } }. */
export function grupujWedlugTypu(adresy) {
  const robots = regulyRobots();
  const grupy = {};
  for (const adres of adresy) {
    const k = klasyfikujAdres(adres, { robots });
    const g = (grupy[k.typ] ??= { nazwa: k.nazwa, liczba: 0, przyklady: [], plik: k.plik, indeksacja: k.indeksacja });
    g.liczba++;
    if (g.przyklady.length < 3) g.przyklady.push(adres);
  }
  return grupy;
}
