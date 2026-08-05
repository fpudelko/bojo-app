import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LANDING_CTA, LANDING_HERO } from './content';
import RotatingBadge from './RotatingBadge';
import PhoneMock from './PhoneMock';

export default function LandingHero() {
  return (
    <section className="hero-surface-deep relative overflow-hidden pt-16 text-white">
      <div className="relative mx-auto w-full max-w-6xl px-5 pb-10 md:flex md:items-center md:gap-8 md:pb-16 md:pt-20">
        {/* .hero-first-screen (globals.css) makes this exactly one screen tall
            on mobile with the content pinned to its bottom — see the comment
            there. On md+ it collapses back to a plain block. */}
        <div className="hero-first-screen md:w-7/12">
          {/* Wrapper keeps the pill hugging its text: as a direct flex child
              of .hero-first-screen it would stretch to the full column width. */}
          <div>
            <RotatingBadge messages={LANDING_HERO.badges} />
          </div>

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

          <p className="mt-5 whitespace-nowrap text-[12.5px] text-white/70 sm:text-sm">
            {LANDING_HERO.trust.join(' · ')}
          </p>
        </div>

        {/* Phone in normal flow, right after the text block — only its top
            edge peeks onto the first screen (inviting a scroll); scrolling
            reveals the whole card naturally, instead of a hard-clipped sliver
            that never un-clips. */}
        <div className="mt-6 md:mt-0 md:w-5/12">
          <PhoneMock className="mx-auto w-[248px] md:w-full md:max-w-[280px] md:rotate-[3deg]" />
        </div>
      </div>
      {/* Sentinel for StickyCta's IntersectionObserver — appears once this
          leaves the viewport. Plain element so it stays in the RSC tree. */}
      <div id="hero-cta-sentinel" aria-hidden="true" />
    </section>
  );
}
