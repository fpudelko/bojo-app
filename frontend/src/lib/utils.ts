export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Adres strony obiektu: czytelna nazwa + KOŃCÓWKA IDENTYFIKATORA.
 *
 * PO CO KOŃCÓWKA. Katalog boisk pochodzi z OpenStreetMap, a boisko bez nazwy
 * własnej dostaje przy imporcie nazwę rodzajową („Boisko piłkarskie",
 * `SPORT_NOUN` w `scraper/import_osm_pbf.py`). Takich obiektów są tysiące
 * i wszystkie dawały ten sam slug `boisko-pilkarskie`, więc `/boisko/<slug>`
 * otwierało ZAWSZE TO SAMO boisko — pierwsze z brzegu, zwykle w innym mieście.
 * Zgłoszone wprost: kafelek na mapie pokazywał obiekt na Piotrowie w Poznaniu,
 * a „Zobacz boisko" prowadziło na Mokotów w Warszawie.
 *
 * Indeks slug→id znał ten problem od początku („Pierwszy wygrywa"), ale przy
 * katalogu poznańskim dotyczył 169 duplikatów nazw własnych. Po imporcie z OSM
 * przestał być drobiazgiem: to już nie kolizja, tylko reguła.
 *
 * DWANAŚCIE ZNAKÓW, nie osiem. Przy docelowych dziesiątkach tysięcy obiektów
 * ośmioznakowa końcówka (32 bity) daje ok. 25% szans, że gdzieś w katalogu
 * trafią się dwa te same skróty — czyli „prawie na pewno jedno boisko będzie
 * złe". Dwanaście znaków (48 bitów) sprowadza to do jednej szansy na ćwierć
 * miliona przebiegów. Adres jest o cztery znaki dłuższy i o to całe ryzyko
 * krótszy.
 */
export function slugBoiska(name: string, id: string): string {
  const nazwa = slugify(name);
  const koncowka = id.replace(/-/g, '').slice(0, 12);
  return nazwa ? `${nazwa}-${koncowka}` : koncowka;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/**
 * Ensures an external URL has a protocol so it opens as an absolute link.
 * Scraped values (e.g. "www.example.com") would otherwise be treated as a
 * relative path and navigate inside the app instead of opening externally.
 */
export function externalUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

/** A value like "7" or "12a" — a bare house number, useless as a place label. */
function isBareNumber(s?: string | null): boolean {
  return !s || /^\d+[a-z]?$/i.test(s.trim());
}

interface LocationFields {
  fieldName?: string | null;
  fieldAddress?: string | null;
  customLocationName?: string | null;
  customAddress?: string | null;
  district?: string | null;
}

/**
 * Builds a readable two-line location from an event's mixed location fields.
 * Avoids showing a bare street number as the place name — falls back to the
 * address, district, or a generic Poznań label instead.
 */
export function eventLocation(e: LocationFields): { primary: string; secondary: string | null } {
  const name    = !isBareNumber(e.fieldName) ? e.fieldName?.trim() : null;
  const custom  = e.customLocationName?.trim() || null;
  const addr    = e.fieldAddress?.trim() || e.customAddress?.trim() || null;
  const cleanAddr = addr && !isBareNumber(addr) ? addr : null;
  // `district` bywa wypełniona tylko dla starszych, poznańskich wpisów —
  // doklejanie miasta zaszytego w kodzie dawało „Grunwald, Poznań" przy
  // obiekcie spod Lublina. Sama dzielnica jest prawdziwa zawsze.
  const district = e.district || null;

  const primary = name || custom || cleanAddr || district || 'Lokalizacja na mapie';

  let secondary: string | null = null;
  if (cleanAddr && cleanAddr !== primary) secondary = cleanAddr;
  else if (district && district !== primary) secondary = district;

  return { primary, secondary };
}
