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

import { surfaceLabel } from '@/lib/labels';
import { plural, withCount } from '@/lib/plural';
import type { Field } from '@/types';

export type ObiektDoOpisu = Pick<Field, 'name' | 'sport' | 'city' | 'surface' | 'isIndoor' | 'lit'>;

export function opisObiektu(field: ObiektDoOpisu): string {
  const sporty = field.sport.join(', ');
  const gdzie = field.city ? ` w miejscowości ${field.city}` : '';

  const cechy: string[] = [field.isIndoor ? 'obiekt kryty' : 'obiekt na wolnym powietrzu'];
  const nawierzchnia = surfaceLabel(field.surface);
  if (nawierzchnia) cechy.push(`nawierzchnia: ${nawierzchnia.toLowerCase()}`);
  if (field.lit) cechy.push('oświetlenie');

  return (
    `${field.name} to obiekt sportowy${gdzie} do gry w: ${sporty}. ${cechy.join(', ')}. ` +
    'Szukasz graczy na ten obiekt? Stwórz otwarty mecz na Bojo i zbierz skład przez jeden link, bez zakładania konta dla dołączających.'
  );
}

/**
 * Faza SEO/GEO — F3 (roadmapa poz. 21): ślad rozegranych meczów na obiekcie.
 * Fakt, którego nie ma żaden katalog importujący dane z OpenStreetMap — wymaga
 * zdarzeń, nie tylko punktu na mapie. `null` przy zerze, bo „rozegrano 0
 * meczów" nie jest faktem wartym pokazania — to brak danych, nie dowód.
 */
export function zdanieORozegranychMeczach(liczba: number): string | null {
  if (liczba < 1) return null;
  const czasownik = plural(liczba, 'odbył się', 'odbyły się', 'odbyło się');
  const przymiotnik = plural(liczba, 'zorganizowany', 'zorganizowane', 'zorganizowanych');
  return `Na tym obiekcie ${czasownik} już ${withCount(liczba, 'mecz', 'mecze', 'meczów')} ${przymiotnik} przez Bojo.`;
}
