import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { LANDING_CTA, LANDING_HERO, LANDING_STATS_LABELS } from './content';
import PhoneFrame from './PhoneFrame';

export default function LandingHero({ venueCount }: { venueCount: number | null }) {
  const eyebrow = venueCount != null
    ? `${venueCount} ${LANDING_STATS_LABELS.venuesSuffix}`
    : LANDING_HERO.eyebrowFallback;

  return (
    <section className="hero-surface-deep relative overflow-hidden text-white">
      <div className="relative mx-auto max-w-6xl px-5 pt-8 pb-0 sm:pt-14 md:pt-20 md:pb-16">
        <div className="grid md:grid-cols-12 md:items-center md:gap-8">
          <div className="md:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium backdrop-blur-sm">
              {eyebrow}
            </span>

            <h1 className="mt-4 font-display text-[2rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-[3.5rem]">
              {LANDING_HERO.h1[0]}<br />{LANDING_HERO.h1[1]}
            </h1>

            <p className="mt-3.5 max-w-[36ch] text-[15px] leading-relaxed text-white/75 sm:text-lg">
              {LANDING_HERO.lead}
            </p>

            <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
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

            <ul className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/55">
              {LANDING_HERO.trust.map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 md:col-span-5 md:mt-0">
            <PhoneFrame
              src="/mockups/screen-1-mecze.png"
              alt="Lista otwartych meczów w aplikacji Bojo"
              priority
              className="mx-auto -mb-16 w-[248px] md:mb-[-4rem] md:w-full md:max-w-[280px] md:rotate-[3deg]"
            />
          </div>
        </div>
      </div>
      {/* Sentinel for StickyCta's IntersectionObserver — appears once this
          leaves the viewport. Plain element so it stays in the RSC tree. */}
      <div id="hero-cta-sentinel" aria-hidden="true" />
    </section>
  );
}
