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
