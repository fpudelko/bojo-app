'use client';

import { useEffect, useState } from 'react';
import { LANDING_ANIMACJA, LANDING_HERO } from '../content';
import { useStanHero } from './heroStan';

const ROZDZIALY = LANDING_ANIMACJA.rozdzialy;
const OBRÓT_MS = 2200;

function klasyKomorki(aktywna: boolean): string {
  return [
    'col-start-1 row-start-1 transition-opacity duration-200 motion-reduce:transition-none',
    aktywna ? 'opacity-100' : 'opacity-0',
  ].join(' ');
}

/**
 * Plakietka nad nagłówkiem na pierwszym ekranie.
 *
 * Na komputerze telefon i plakietka są widoczne razem, więc plakietka
 * śledzi silnik animacji telefonu (`heroStan`): pokazuje nazwę rozdziału,
 * który właśnie gra. Na telefonie animacja telefonu leży pod pierwszym
 * ekranem i rusza dopiero, gdy jest w połowie widoczna (`heroSilnik`) —
 * plakietka ma zmieniać treść od razu po wejściu na stronę, więc dostaje
 * WŁASNY, niezależny zegar (`OBRÓT_MS`), tak jak działał poprzedni
 * `RotatingBadge`.
 *
 * Przy `prefers-reduced-motion` (nic nie zmienia się samo) obie animacje
 * stoją i wraca stały napis sprzed rozdziałów.
 *
 * Wszystkie nazwy leżą w jednej komórce siatki i przełącza się ich
 * przezroczystość: szerokość plakietki wyznacza najdłuższa, więc nic nie
 * skacze przy zmianie treści, a przejście jest płynne bez pomiarów w JS
 * (poprzednio `RotatingBadge` liczył `min-width` po zamontowaniu).
 */
export default function HeroChip() {
  const { rozdzial } = useStanHero();
  const [reduce, setReduce] = useState(false);
  const [rozdzialTelefon, setRozdzialTelefon] = useState(0);

  useEffect(() => {
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => {
      setRozdzialTelefon((i) => (i + 1) % ROZDZIALY.length);
    }, OBRÓT_MS);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <span
      className="inline-flex min-h-[2.25rem] items-center rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium backdrop-blur-sm"
      aria-live="off"
    >
      <span className={reduce ? 'block' : 'hidden'}>{LANDING_HERO.badge}</span>
      <span className={reduce ? 'hidden' : 'inline-grid md:hidden'}>
        {ROZDZIALY.map((r, i) => (
          <span key={r.nazwa} aria-hidden={i !== rozdzialTelefon} className={klasyKomorki(i === rozdzialTelefon)}>
            {r.nazwa}
          </span>
        ))}
      </span>
      <span className={reduce ? 'hidden' : 'hidden md:inline-grid'}>
        {ROZDZIALY.map((r, i) => (
          <span key={r.nazwa} aria-hidden={i !== rozdzial} className={klasyKomorki(i === rozdzial)}>
            {r.nazwa}
          </span>
        ))}
      </span>
    </span>
  );
}
