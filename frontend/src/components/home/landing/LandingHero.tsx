import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { LANDING_CTA, LANDING_HERO } from './content';
import RotatingBadge from './RotatingBadge';
import PhoneMock from './PhoneMock';

export default function LandingHero() {
  return (
    <section className="hero-surface-deep relative flex min-h-screen min-h-[100svh] flex-col overflow-hidden pt-16 text-white">
      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-0 pt-8 sm:pt-14 md:flex-row md:items-center md:gap-8 md:pb-16 md:pt-20">
        <div className="md:w-7/12">
          <RotatingBadge messages={LANDING_HERO.badges} />

          <h1 className="mt-4 font-display text-[2rem] font-extrabold leading-[1.08] tracking-[-0.01em] sm:text-5xl sm:tracking-tight md:text-[3.5rem]">
            {LANDING_HERO.h1[0]}<br />{LANDING_HERO.h1[1]}
          </h1>

          <p className="mt-3.5 max-w-[36ch] text-base leading-relaxed text-white/75 sm:text-lg">
            {LANDING_HERO.lead}
          </p>

          <div className="mt-6 flex flex-col items-end gap-3 sm:flex-row sm:items-center">
            <Link
              href={LANDING_CTA.primary.href}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent-500 px-6 text-base font-bold text-[#0A2B1A] shadow-lg shadow-black/20 transition-colors hover:bg-accent-400 active:scale-[0.98] motion-reduce:active:scale-100 sm:w-auto"
            >
              {LANDING_CTA.primary.label} <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href={LANDING_CTA.secondary.href}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 underline underline-offset-4 hover:text-white"
            >
              {LANDING_CTA.secondary.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <ul className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-white/70">
            {LANDING_HERO.trust.map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Phone pinned to the bottom edge, only the top ~130px peeking above
            the fold — an invitation to scroll, not a competing focal point. */}
        <div className="relative mt-8 flex flex-1 items-end justify-center overflow-hidden md:mt-0 md:w-5/12 md:items-center md:overflow-visible">
          <PhoneMock className="w-[248px] translate-y-[calc(100%-130px)] md:w-full md:max-w-[280px] md:translate-y-0 md:rotate-[3deg]" />
        </div>
      </div>
      {/* Sentinel for StickyCta's IntersectionObserver — appears once this
          leaves the viewport. Plain element so it stays in the RSC tree. */}
      <div id="hero-cta-sentinel" aria-hidden="true" />
    </section>
  );
}
