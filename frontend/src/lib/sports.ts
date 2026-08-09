// Single source of truth for sport metadata.
// FOCUS_SPORTS are shown in UI filters and event creation.
// Legacy sports (piłka ręczna, gokarty) stay in DB and appear on the map
// but are hidden from filter dropdowns and event forms.

export const SPORT_CONFIG = {
  'piłka nożna':       { emoji: '⚽', color: '#15663E', label: 'Piłka nożna' },
  'futsal':            { emoji: '⚽', color: '#15663E', label: 'Futsal' },
  'siatkówka':         { emoji: '🏐', color: '#1d4ed8', label: 'Siatkówka' },
  'siatkówka plażowa': { emoji: '🏖️', color: '#d97706', label: 'Siatkówka plażowa' },
  'koszykówka':        { emoji: '🏀', color: '#c2410c', label: 'Koszykówka' },
  // Legacy — shown on map but hidden from filters / creation form
  'piłka ręczna':      { emoji: '🤾', color: '#6b7280', label: 'Piłka ręczna' },
  // Import z OSM (`sport=multi`) — twarde boisko w typie orlika, na którym gra
  // się w kilka dyscyplin. Na mapie tak, w filtrach nie: deklaracja „multi"
  // z OSM nie mówi, w co konkretnie da się zagrać.
  'wielofunkcyjne':    { emoji: '🏟️', color: '#6b7280', label: 'Wielofunkcyjne' },
  'gokarty':           { emoji: '🏎️', color: '#6b7280', label: 'Gokarty' },
  'inne':              { emoji: '🏟️', color: '#6b7280', label: 'Inne' },
} as const;

/** Sports shown in filters / event creation / homepage shortcuts.
 *  Futsal is intentionally excluded — it maps to "piłka nożna" in UI. */
export const FOCUS_SPORTS = [
  'piłka nożna',
  'siatkówka',
  'siatkówka plażowa',
  'koszykówka',
] as const satisfies ReadonlyArray<keyof typeof SPORT_CONFIG>;

/** Sporty jako filtr FACYLITÓW na mapie — szerszy niż FOCUS_SPORTS (ten dotyczy
 *  sportów, w które da się zorganizować mecz). `wielofunkcyjne` i `piłka ręczna`
 *  mają po kilkaset/kilka tysięcy pinezek na mapie (import OSM), a nie dało się
 *  ich dotąd wybrać w filtrze — miały kolorową pinezkę, ale żadnej nazwy do
 *  kliknięcia. */
export const MAP_FILTER_SPORTS = [
  'piłka nożna',
  'siatkówka',
  'siatkówka plażowa',
  'koszykówka',
  'wielofunkcyjne',
  'piłka ręczna',
] as const satisfies ReadonlyArray<keyof typeof SPORT_CONFIG>;

export type SportKey = keyof typeof SPORT_CONFIG;

/** Sports where a goalkeeper / field-player distinction makes sense. Used by
 *  both the event creation wizard and the event edit page — dawniej
 *  zdublowane, po jednej kopii w każdym pliku. Plain `string[]` (nie
 *  `as const`) — wywołania `.includes(sport)` porównują z dowolnym stringiem
 *  wybranego sportu, nie tylko literałami z tej listy. */
export const GK_SPORTS: string[] = ['piłka nożna', 'futsal'];

const _cfg = SPORT_CONFIG as Record<string, { emoji: string; color: string; label: string }>;

export function sportEmoji(sport: string): string {
  return _cfg[sport]?.emoji ?? '🏟️';
}

export function sportColor(sport: string): string {
  return _cfg[sport]?.color ?? '#6b7280';
}

export function sportLabel(sport: string): string {
  return _cfg[sport]?.label ?? sport;
}
