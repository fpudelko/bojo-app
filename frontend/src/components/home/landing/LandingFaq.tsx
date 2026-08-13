import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { LANDING_FAQ } from './content';

/** Native <details> — zero JS, and the same array that feeds faqJsonLd, so
 *  the visible text and the schema can never drift apart. */
export default function LandingFaq() {
  return (
    <section className="bg-canvas px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-8 sm:mb-10">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">
            Pytania
          </span>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Zanim zaczniesz
          </h2>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white px-5 sm:px-6">
          {LANDING_FAQ.map((item) => (
            <details key={item.q} className="group border-b border-slate-200 py-4 last:border-b-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>

        <p className="mt-6 text-center text-sm">
          <Link href="/faq" className="font-semibold text-primary-700 hover:text-primary-800">
            Wszystkie pytania i odpowiedzi →
          </Link>
        </p>
      </div>
    </section>
  );
}
