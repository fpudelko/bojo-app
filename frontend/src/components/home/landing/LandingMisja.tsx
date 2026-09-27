import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LANDING_MISJA } from './content';

/**
 * Misja Bojo na landingu — po „Jak to działa", przed dowodem (otwarte gry).
 * Kolejność jest celowa: człowiek najpierw rozumie CO to robi (trzy kroki),
 * potem pyta KTO i PO CO, a dopiero potem chce zobaczyć DOWÓD.
 *
 * Serwerowa, zero JS — jak reszta sekcji landingu. Blok „Gdzie jesteśmy
 * dziś" ma świadomie inny wygląd (karta na tle `canvas`, nie biała sekcja)
 * — to jest zastrzeżenie, nie kolejna zaleta, i ma się różnić wizualnie.
 */
export default function LandingMisja() {
  return (
    <section className="bg-white px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 sm:mb-8">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {LANDING_MISJA.tytul}
          </h2>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-slate-600 sm:text-base">
          {LANDING_MISJA.akapity.map((a, i) => <p key={i}>{a}</p>)}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-canvas p-5">
          <p className="font-display text-sm font-bold text-ink">
            {LANDING_MISJA.uczciwie.tytul}
          </p>
          <ul className="mt-3 space-y-2">
            {LANDING_MISJA.uczciwie.punkty.map((p) => (
              <li key={p} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                <span className="mt-1 text-slate-400" aria-hidden="true">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-center text-sm">
          <Link
            href={LANDING_MISJA.cta.href}
            className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:text-primary-800"
          >
            {LANDING_MISJA.cta.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </section>
  );
}
