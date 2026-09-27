import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LANDING_ZAPROSZENIE } from './content';

/**
 * Zamknięcie landingu, tuż nad stopką. Powtarza MAŁĄ prośbę z rozmowy
 * z organizatorem („weź jedną gierkę na próbę"), nie dużą („przenieś ekipę") —
 * patrz komentarz przy `LANDING_ZAPROSZENIE` w `content.ts`.
 *
 * Tło `primary-700` (nie `white`/`canvas` jak sąsiednie sekcje) — to ostatnie
 * słowo strony przed stopką i ma się wizualnie wyróżnić jako zamknięcie,
 * nie kolejna karta w ciągu.
 *
 * `pb-24 md:pb-14` (zamiast samego `py-14 sm:py-20`) — ta sekcja jest dziś
 * ostatnia przed stopką, więc niesie bufor pod pływający `StickyCta`
 * (widoczny wyłącznie na mobile, chowa się dopiero, gdy stopka wjedzie na
 * ekran). Bufor musi być WEWNĄTRZ tej sekcji, nie w przezroczystym marginesie
 * po niej — inaczej zielone tło urywa się, zanim `StickyCta` przestanie
 * pływać, i między sekcją a stopką pojawia się jasny pasek.
 */
export default function LandingZaproszenie() {
  return (
    <section className="bg-primary-700 px-4 pb-24 pt-14 text-white sm:py-20 md:pb-14">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {LANDING_ZAPROSZENIE.tytul}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">
          {LANDING_ZAPROSZENIE.body}
        </p>

        <Link
          href={LANDING_ZAPROSZENIE.cta.href}
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 text-base font-semibold text-primary-800 transition-colors hover:bg-primary-50 active:scale-[0.98] motion-reduce:active:scale-100 sm:mx-auto sm:w-auto"
        >
          {LANDING_ZAPROSZENIE.cta.label} <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          {LANDING_ZAPROSZENIE.poboczne.map((p) => (
            p.href.startsWith('mailto:') ? (
              <a
                key={p.label}
                href={p.href}
                className="font-medium text-white/70 underline underline-offset-4 hover:text-white"
              >
                {p.label}
              </a>
            ) : (
              <Link
                key={p.label}
                href={p.href}
                className="font-medium text-white/70 underline underline-offset-4 hover:text-white"
              >
                {p.label}
              </Link>
            )
          ))}
        </div>
      </div>
    </section>
  );
}
