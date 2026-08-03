import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { LANDING_CTA, LANDING_FINAL_CTA, LANDING_HERO } from './content';

export default function LandingFinalCta() {
  return (
    <section className="hero-surface-deep px-4 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">{LANDING_FINAL_CTA.h2}</h2>
        <p className="mt-3 text-white/75">{LANDING_FINAL_CTA.lead}</p>

        <Link
          href={LANDING_CTA.primary.href}
          className="mt-6 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent-500 px-6 text-base font-bold text-[#0A2B1A] shadow-lg shadow-black/20 transition-colors hover:bg-accent-400 active:scale-[0.98] motion-reduce:active:scale-100"
        >
          {LANDING_CTA.primary.label} <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>

        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-white/55">
          {LANDING_HERO.trust.map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
