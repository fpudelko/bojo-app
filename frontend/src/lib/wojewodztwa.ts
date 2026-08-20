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
