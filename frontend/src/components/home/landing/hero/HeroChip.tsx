'use client';

import { LANDING_ANIMACJA, LANDING_HERO } from '../content';
import { useStanHero } from './heroStan';

const ROZDZIALY = LANDING_ANIMACJA.rozdzialy;

/**
 * Plakietka nad nagłówkiem na pierwszym ekranie.
 *
 * Na telefonie ZAWSZE stały napis („Mecz gdziekolwiek w Polsce”): telefon
 * animacji leży pod pierwszym ekranem, więc plakietka zmieniająca się razem
 * z nim nigdy nie byłaby widoczna obok tego, co opisuje. Na komputerze
 * pokazuje nazwę rozdziału, który właśnie gra; przy `prefers-reduced-motion`
 * (nic nie zmienia się samo) wraca stały napis.
 *
 * Wszystkie nazwy leżą w jednej komórce siatki i przełącza się ich
 * przezroczystość: szerokość plakietki wyznacza najdłuższa, więc nic nie
 * skacze przy zmianie rozdziału, a przejście jest płynne bez pomiarów w JS
 * (poprzednio `RotatingBadge` liczył `min-width` po zamontowaniu).
 */
export default function HeroChip() {
  const { rozdzial, staly } = useStanHero();
  return (
    <span
      className="inline-flex min-h-[2.25rem] items-center rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium backdrop-blur-sm"
      aria-live="off"
    >
      <span className={staly ? 'block' : 'block md:hidden'}>{LANDING_HERO.badge}</span>
      <span className={staly ? 'hidden' : 'hidden md:inline-grid'}>
        {ROZDZIALY.map((r, i) => (
          <span
            key={r.nazwa}
            aria-hidden={i !== rozdzial}
            className={[
              'col-start-1 row-start-1 transition-opacity duration-200 motion-reduce:transition-none',
              i === rozdzial ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          >
            {r.nazwa}
          </span>
        ))}
      </span>
    </span>
  );
}
