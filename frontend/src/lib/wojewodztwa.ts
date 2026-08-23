// Slugi województw — MUSZĄ zgadzać się dokładnie ze `scraper/import_osm_pbf.py`
// (stała `WOJEWODZTWA`, nazwy wycinków Geofabrik). `fields.voivodeship`
// (migracja 112) jest zapisywane przez `scraper/backfill_lokalizacja.py` jako
// dokładnie taki slug — to jedyne źródło prawdy, nie duplikować gdzie indziej.
export const WOJEWODZTWA = [
  'dolnoslaskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie',
  'lodzkie', 'malopolskie', 'mazowieckie', 'opolskie',
  'podkarpackie', 'podlaskie', 'pomorskie', 'slaskie',
  'swietokrzyskie', 'warminsko-mazurskie', 'wielkopolskie',
  'zachodniopomorskie',
] as const;

export type Wojewodztwo = (typeof WOJEWODZTWA)[number];

// Nazwa do wyświetlenia, mianownik z wielkiej litery. Celowo BEZ odmiany przez
// przypadki (np. "w województwie wielkopolskim" wymagałoby fleksji przymiotnika,
// nie tylko rzeczownika) — nagłówek huba wojewódzkiego składa się jako
// "Województwo {Nazwa} — …", gdzie nazwa zawsze stoi w mianowniku, więc błędna
// odmiana nie ma jak się wkraść (patrz app/boiska/woj/[wojewodztwo]/page.tsx).
export const WOJEWODZTWO_LABEL: Record<Wojewodztwo, string> = {
  'dolnoslaskie': 'Dolnośląskie',
  'kujawsko-pomorskie': 'Kujawsko-Pomorskie',
  'lubelskie': 'Lubelskie',
  'lubuskie': 'Lubuskie',
  'lodzkie': 'Łódzkie',
  'malopolskie': 'Małopolskie',
  'mazowieckie': 'Mazowieckie',
  'opolskie': 'Opolskie',
  'podkarpackie': 'Podkarpackie',
  'podlaskie': 'Podlaskie',
  'pomorskie': 'Pomorskie',
  'slaskie': 'Śląskie',
  'swietokrzyskie': 'Świętokrzyskie',
  'warminsko-mazurskie': 'Warmińsko-Mazurskie',
  'wielkopolskie': 'Wielkopolskie',
  'zachodniopomorskie': 'Zachodniopomorskie',
};
