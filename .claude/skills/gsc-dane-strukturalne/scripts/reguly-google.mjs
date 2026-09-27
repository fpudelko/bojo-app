// Google Search structured-data requirements, as data.
//
// Source: Google Search Central structured-data docs, state as researched on
// 2026-09-25 (see ../references/wymagania-google.md for dates, deprecations and
// links). Keep this file and that reference in step: the reference explains,
// this file enforces. `wymagane` = missing → Search Console "critical issue",
// the item is not eligible. `zalecane` = missing → "non-critical issue"
// (the e-mail that started all this on 2026-09-23 listed exactly these).

export const DOSTEPNOSC = [
  'InStock', 'SoldOut', 'PreOrder', 'PreSale', 'LimitedAvailability', 'OnlineOnly', 'InStoreOnly',
  'OutOfStock', 'Discontinued', 'BackOrder', 'MadeToOrder', 'Reserved',
].map((v) => `https://schema.org/${v}`);

export const STATUS_WYDARZENIA = [
  'EventScheduled', 'EventCancelled', 'EventMovedOnline', 'EventPostponed', 'EventRescheduled',
].map((v) => `https://schema.org/${v}`);

export const TRYB_UCZESTNICTWA = [
  'OfflineEventAttendanceMode', 'OnlineEventAttendanceMode', 'MixedEventAttendanceMode',
].map((v) => `https://schema.org/${v}`);

// Format checkers: return null when fine, a Polish message otherwise.
const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATACZAS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const STREFA = /(Z|[+-]\d{2}:?\d{2})$/;

export const FORMATY = {
  dataczas(v) {
    if (typeof v !== 'string') return 'ma być tekstem w formacie ISO 8601';
    if (ISO_DATA.test(v)) return null;
    if (!ISO_DATACZAS.test(v)) return `„${v}” nie jest datą ISO 8601 (np. 2026-10-07T18:00:00+02:00)`;
    return null;
  },
  url(v) {
    const lista = Array.isArray(v) ? v : [v];
    for (const x of lista) {
      const s = typeof x === 'string' ? x : x?.url ?? x?.['@id'];
      if (typeof s !== 'string' || !/^https?:\/\//.test(s)) return `„${JSON.stringify(x)}” nie jest pełnym adresem URL`;
    }
    return null;
  },
  cena(v) {
    if (typeof v === 'number') return v >= 0 ? null : 'cena ujemna';
    if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) return null;
    return `„${v}” nie jest liczbą (kropka dziesiętna, bez waluty i spacji)`;
  },
  waluta(v) {
    return typeof v === 'string' && /^[A-Z]{3}$/.test(v) ? null : `„${v}” nie jest kodem ISO 4217 (np. PLN)`;
  },
  wyliczenie(dozwolone) {
    // Google accepts the full URL, the http variant and the bare name.
    const krotkie = dozwolone.map((d) => d.replace('https://schema.org/', ''));
    return (v) => {
      const k = typeof v === 'string' ? v.replace(/^https?:\/\/schema\.org\//, '') : v;
      return krotkie.includes(k) ? null : `„${v}” spoza dozwolonych wartości (${krotkie.join(', ')})`;
    };
  },
};

/** Info-level hints that are not errors but change what to expect in GSC. */
export const UWAGI = {
  strefaCzasu(v) {
    return typeof v === 'string' && v.includes('T') && !STREFA.test(v)
      ? `„${v}” bez strefy czasowej: Google przyjmie strefę miejsca wydarzenia. Jawne przesunięcie (+01:00 zimą, +02:00 latem w Polsce) usuwa zgadywanie.`
      : null;
  },
};

/**
 * Rules per schema.org type. Paths use dots for nesting; for arrays every
 * element is checked. `wynikRozszerzony` says whether Google currently shows
 * a rich result for the type at all, which decides whether a GSC report can
 * exist for it.
 */
export const REGULY = {
  Event: {
    podtypy: ['SportsEvent', 'MusicEvent', 'SocialEvent', 'Festival', 'TheaterEvent', 'ChildrensEvent', 'EducationEvent', 'ExhibitionEvent', 'ComedyEvent', 'DanceEvent', 'FoodEvent', 'LiteraryEvent', 'SaleEvent', 'ScreeningEvent', 'BusinessEvent'],
    raportGsc: 'Ulepszenia → Wydarzenia (Events)',
    wynikRozszerzony: 'tak: wyniki wydarzeń w Google (lista, karta wydarzenia)',
    kwalifikacja:
      'Wydarzenie w fizycznym miejscu, na które może przyjść publiczność. Nie kwalifikują się: wydarzenia wyłącznie online (Google usunął je z dokumentacji w 2025), promocje/kupony udające wydarzenia, „wydarzenia” wielodniowe typu wyprzedaż.',
    wymagane: ['name', 'startDate', 'location', 'location.address'],
    zalecane: [
      'description', 'endDate', 'eventStatus', 'image', 'offers', 'organizer', 'performer',
      'location.name', 'offers.availability', 'offers.price', 'offers.priceCurrency', 'offers.url', 'offers.validFrom',
      'organizer.name', 'performer.name',
    ],
    formaty: {
      startDate: FORMATY.dataczas, endDate: FORMATY.dataczas, previousStartDate: FORMATY.dataczas,
      'offers.validFrom': FORMATY.dataczas,
      'offers.availability': FORMATY.wyliczenie(DOSTEPNOSC),
      'offers.price': FORMATY.cena,
      'offers.priceCurrency': FORMATY.waluta,
      'offers.url': FORMATY.url,
      eventStatus: FORMATY.wyliczenie(STATUS_WYDARZENIA),
      eventAttendanceMode: FORMATY.wyliczenie(TRYB_UCZESTNICTWA),
      image: FORMATY.url,
      url: FORMATY.url,
    },
    uwagi: { startDate: UWAGI.strefaCzasu, endDate: UWAGI.strefaCzasu },
  },

  BreadcrumbList: {
    raportGsc: 'Ulepszenia → Menu nawigacyjne (Breadcrumbs)',
    wynikRozszerzony: 'tak, ale od stycznia 2025 tylko na komputerze: na telefonie Google pokazuje w wyniku samą domenę (raport w GSC działa dalej)',
    wymagane: ['itemListElement'],
    zalecane: [],
    wlasne: 'okruszki',
  },

  Organization: {
    raportGsc: 'brak osobnego raportu (logo trafia do raportu „Logo”, jeśli Google go wyświetla)',
    wynikRozszerzony: 'nie jako wynik rozszerzony; zasila logo w wynikach i panel wiedzy',
    wymagane: [],
    zalecane: ['name', 'url', 'logo', 'description'],
    formaty: { url: FORMATY.url, logo: FORMATY.url },
  },

  WebSite: {
    raportGsc: 'brak',
    wynikRozszerzony:
      'nie; na stronie głównej zasila NAZWĘ WITRYNY w wynikach (name, alternateName, url). Pole wyszukiwania w linkach witryny Google wycofał w listopadzie 2024.',
    wymagane: [],
    zalecane: ['name', 'url', 'alternateName'],
    formaty: { url: FORMATY.url },
  },

  LocalBusiness: {
    podtypy: ['SportsActivityLocation', 'SportsClub', 'StadiumOrArena', 'ExerciseGym', 'PublicSwimmingPool', 'SportsActivityLocation'],
    raportGsc: 'brak raportu w Search Console',
    wynikRozszerzony:
      'wyniki lokalne Google zasila głównie profil firmy (Google Business Profile), nie znacznik na stronie; schemat pomaga zrozumieć stronę i modelom (GEO)',
    wymagane: ['name', 'address'],
    zalecane: ['geo', 'url', 'address.addressLocality', 'address.addressCountry', 'image', 'telephone', 'openingHoursSpecification'],
    formaty: { url: FORMATY.url, image: FORMATY.url },
  },

  ItemList: {
    raportGsc: 'brak',
    wynikRozszerzony: 'karuzela tylko dla list kursów, filmów, przepisów i restauracji; lista obiektów sportowych jej nie dostanie',
    wymagane: ['itemListElement'],
    zalecane: [],
  },

  FAQPage: {
    raportGsc: 'wycofany (2026)',
    wynikRozszerzony:
      'NIE: od sierpnia 2023 tylko witryny rządowe i medyczne, w 2026 Google wycofał wynik FAQ całkowicie (raport i test wyników rozszerzonych, potem API). Schemat może zostać: nie szkodzi, bywa czytany przez modele.',
    wymagane: ['mainEntity'],
    zalecane: [],
    wycofany: true,
  },

  HowTo: {
    raportGsc: 'wycofany (2023)',
    wynikRozszerzony: 'NIE: Google wycofał wynik HowTo we wrześniu 2023. Schemat nie szkodzi.',
    wymagane: [],
    zalecane: [],
    wycofany: true,
  },

  SoftwareApplication: {
    raportGsc: 'Ulepszenia → Aplikacje (tylko gdy Google uzna znacznik za kwalifikujący się)',
    wynikRozszerzony: 'tak, ale wymaga oceny (aggregateRating albo review); bez oceny wynik się nie pojawi',
    wymagane: ['name', 'offers.price'],
    zalecane: ['applicationCategory', 'operatingSystem', 'aggregateRating'],
    formaty: { 'offers.price': FORMATY.cena, 'offers.priceCurrency': FORMATY.waluta },
  },
};

/** Rule set for a type name (subtypes resolve to their parent). */
export function regulyDla(typ) {
  if (REGULY[typ]) return { nazwa: typ, ...REGULY[typ] };
  for (const [nazwa, r] of Object.entries(REGULY)) {
    if (r.podtypy?.includes(typ)) return { nazwa, ...r };
  }
  return null;
}

/** Is a property path required or recommended for a type? (for GSC issue rows) */
export function wagaPola(typ, sciezka) {
  const r = regulyDla(typ);
  if (!r || !sciezka) return null;
  if (r.wymagane.includes(sciezka)) return 'wymagane';
  if (r.zalecane.includes(sciezka)) return 'zalecane';
  return 'poza listą Google';
}
