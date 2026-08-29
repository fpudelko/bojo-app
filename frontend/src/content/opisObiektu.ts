// Faza 1 SEO/GEO (BACKLOG.md §7a) — "direct answer" pod stroną obiektu:
// gęsty, faktograficzny akapit z danych KATALOGU (nie marketingowa proza),
// wyświetlany na górze `/boisko/[id]` i powielony jako `description` w
// JSON-LD `SportsActivityLocation` — jedno źródło, żeby tekst widoczny
// na stronie i to, co czyta robot, nigdy się nie rozjechały.
//
// Ta sama zasada zakazanych fraz co reszta treści (`content/zakazaneFrazy.ts`,
// patrz test w `tresciStron.test.ts`) — mimo że wejściem są dane katalogu
// (nazwa, miejscowość), nie tylko nasza proza, bo szablon jest jeden i musi
// zostać bezpieczny niezależnie od tego, co akurat wpadnie z importu OSM.

import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { surfaceLabel, SURFACE_LABELS } from '@/lib/labels';
import { plural, withCount } from '@/lib/plural';
import {
  najlepszePotwierdzenie, QUORUM_POTWIERDZEN, type PotwierdzeniaZliczone,
} from '@/lib/potwierdzeniaObiektu';
import type { Field } from '@/types';

export type ObiektDoOpisu = Pick<Field, 'name' | 'sport' | 'city' | 'surface' | 'isIndoor' | 'lit'>;

// „Grać w X" wymaga biernika, a `field.sport` niesie mianownik prosto z importu
// OSM (`scraper/import_osm_pbf.py#OSM_SPORT_MAP`, plus fallback „inne"). Zbiór
// wartości jest tam zamknięty, więc mapa poniżej pokrywa go w całości — nie
// zgaduje odmiany dla dowolnego tekstu. „wielofunkcyjne"/„inne" nie są nazwami
// konkretnej gry (tag `sport=multi` albo dyscyplina nierozpoznana przez import),
// więc nie mają biernika — dostają opisowe zastępstwo zamiast fałszywej odmiany.
const SPORT_BIERNIK: Record<string, string> = {
  'piłka nożna': 'piłkę nożną',
  koszykówka: 'koszykówkę',
  siatkówka: 'siatkówkę',
  'siatkówka plażowa': 'siatkówkę plażową',
  'piłka ręczna': 'piłkę ręczną',
  futsal: 'futsal',
  hokej: 'hokeja',
  'hokej na trawie': 'hokeja na trawie',
  rugby: 'rugby',
  baseball: 'baseball',
  krykiet: 'krykiet',
  'futbol amerykański': 'futbol amerykański',
  wielofunkcyjne: 'różne sporty',
  inne: 'różne sporty',
};

function sportyWBierniku(sporty: readonly string[]): string {
  return sporty.map((s) => SPORT_BIERNIK[s] ?? s).join(', ');
}

export function opisObiektu(field: ObiektDoOpisu): string {
  const sporty = sportyWBierniku(field.sport);
  const gdzie = field.city ? ` w miejscowości ${field.city}` : '';

  const cechy: string[] = [field.isIndoor ? 'kryty' : 'na wolnym powietrzu'];
  const nawierzchnia = surfaceLabel(field.surface);
  if (nawierzchnia) cechy.push(`nawierzchnia: ${nawierzchnia.toLowerCase()}`);
  if (field.lit) cechy.push('oświetlenie');

  return (
    `${field.name} to obiekt sportowy${gdzie}, przeznaczony do gry w ${sporty} — ${cechy.join(', ')}. ` +
    'Szukasz graczy? Stwórz otwarty mecz na Bojo i zbierz skład przez jeden link, bez zakładania konta dla dołączających.'
  );
}

/**
 * Faza SEO/GEO — F3 (roadmapa poz. 21): ślad rozegranych meczów na obiekcie.
 * Fakt, którego nie ma żaden katalog importujący dane z OpenStreetMap — wymaga
 * zdarzeń, nie tylko punktu na mapie. `null` przy zerze, bo „rozegrano 0
 * meczów" nie jest faktem wartym pokazania — to brak danych, nie dowód.
 *
 * `ostatniaData` (roadmapa runda 2, fosa F4 — „czy tu się w ogóle gra, i kiedy")
 * dokłada świeżość do samego faktu istnienia meczów: katalog importowany z OSM
 * nie potrafi odróżnić obiektu, na którym grano wczoraj, od takiego, na którym
 * grano rok temu i już nie gra się wcale. Opcjonalna i domyślnie pominięta —
 * wywołania bez tego argumentu (istniejące testy, historia wywołań) dają
 * dokładnie to samo zdanie co dotąd.
 */
export function zdanieORozegranychMeczach(liczba: number, ostatniaData?: string | null): string | null {
  if (liczba < 1) return null;
  const czasownik = plural(liczba, 'odbył się', 'odbyły się', 'odbyło się');
  const przymiotnik = plural(liczba, 'zorganizowany', 'zorganizowane', 'zorganizowanych');
  const zdanie = `Na tym obiekcie ${czasownik} już ${withCount(liczba, 'mecz', 'mecze', 'meczów')} ${przymiotnik} przez Bojo`;
  if (!ostatniaData) return `${zdanie}.`;
  const data = format(parseISO(ostatniaData), 'd MMMM yyyy', { locale: pl });
  return `${zdanie}, ostatni ${data}.`;
}

/**
 * Faza 3 SEO/GEO (mikro-ankiety, `potwierdzenia_obiektu` migracja 123) jako ZDANIE,
 * nie tylko jako `amenityFeature` w JSON-LD. `lib/structuredData.ts#venueAmenityFeatures`
 * już wystawia te same fakty maszynom — ale wyłącznie w danych strukturalnych, których
 * część narzędzi GEO nie czyta, tylko widoczny tekst. Bez tego zdania fakt, którego nie
 * ma żaden katalog importujący z OpenStreetMap (bo nie ma ludzi, którzy tam grają),
 * istniał tylko w `<script type="application/ld+json">`, niewidoczny w treści strony.
 *
 * Ten sam próg kworum co `AnkietyObiektu.tsx` i `venueAmenityFeatures()` — fakt
 * pokazany robotowi nigdy nie wyprzedza tego, co widzi człowiek. `null`, gdy nic nie
 * osiągnęło kworum, z tego samego powodu co `zdanieORozegranychMeczach(0)`.
 */
export function zdaniePotwierdzen(zliczone: readonly PotwierdzeniaZliczone[]): string | null {
  const fakty: string[] = [];

  const oswietlenie = najlepszePotwierdzenie(zliczone, 'oswietlenie');
  if (oswietlenie && oswietlenie.liczba >= QUORUM_POTWIERDZEN) {
    fakty.push(oswietlenie.wartosc === 'tak' ? 'jest oświetlenie' : 'nie ma oświetlenia');
  }

  const nawierzchnia = najlepszePotwierdzenie(zliczone, 'nawierzchnia');
  if (nawierzchnia && nawierzchnia.liczba >= QUORUM_POTWIERDZEN) {
    const etykieta = SURFACE_LABELS[nawierzchnia.wartosc] ?? nawierzchnia.wartosc;
    fakty.push(`nawierzchnia to ${etykieta.toLowerCase()}`);
  }

  if (fakty.length === 0) return null;
  return `Gracze potwierdzili na Bojo: ${fakty.join(', ')}.`;
}
