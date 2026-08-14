import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LANDING_CTA, LANDING_HERO } from './content';
import RotatingBadge from './RotatingBadge';
import WczesnyEtapBadge from './WczesnyEtapBadge';
import PhoneCarousel from './PhoneCarousel';
import TrustRow from './TrustRow';

export default function LandingHero() {
  return (
    <section className="hero-surface-deep relative overflow-hidden pt-16 text-white">
      <div className="relative mx-auto w-full max-w-6xl px-5 pb-10 md:flex md:items-start md:gap-8 md:pb-16 md:pt-20">
        {/* .hero-first-screen (globals.css) makes this exactly one screen tall
            — na telefonie z treścią dosuniętą do dołu, na komputerze z górnym
            odstępem odtwarzającym dawne wyśrodkowanie i `justify-content:
            space-between`, które rozdziela resztę wysokości na cztery odstępy
            między dziećmi (plakietka/h1/lead/CTA/TrustRow). Istniejące `mt-*`
            przy tych elementach zostają jako podłoga — na niskim oknie
            `space-between` po prostu nie ma czego dokładać. Szczegóły w
            komentarzu przy klasie. */}
        <div className="hero-first-screen md:w-7/12">
          {/* Wrapper keeps the pill hugging its text: as a direct flex child
              of .hero-first-screen it would stretch to the full column width. */}
          <div>
            <RotatingBadge messages={LANDING_HERO.badges} />
          </div>

          {/* 2.5rem is the largest size that keeps this at 2 lines (not 3)
              down to a 360px-wide phone — found empirically, the threshold
              sits at 2.52rem. Growing this only eats into the free space
              above (.hero-first-screen bottom-aligns the whole column as one
              group) — everything from the lead paragraph down stays at the
              exact same pixel position, verified against a pre-change
              baseline.

              min-[1152px]:text-[4.75rem] dopiero od szerokości, przy której
              kolumna faktycznie osiąga swoją docelową szerokość: rząd-rodzic
              ma `max-w-6xl` (1152px), więc kolumna (7/12 tej szerokości)
              rośnie wraz z oknem AŻ DO 1152px, a od tego progu jej szerokość
              jest już stała (~630px). Tailwindowe `lg:` (1024px) odpaliłoby
              większą czcionkę zbyt wcześnie — przy 1024px kolumna jest jeszcze
              węższa niż docelowa i tekst łamałby się do 3 linii. Przy 630px
              4.75rem to zmierzona górna granica 2 linii z zapasem. */}
          <h1 className="mt-4 font-display text-[2.5rem] font-extrabold leading-[1.05] tracking-[-0.01em] sm:text-5xl sm:tracking-tight md:text-[3.5rem] min-[1152px]:text-[4.75rem]">
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
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={LANDING_CTA.secondary.href}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 underline underline-offset-4 hover:text-white"
              >
                {LANDING_CTA.secondary.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <WczesnyEtapBadge />
            </div>
          </div>

          <TrustRow className="mt-5" />
        </div>

        {/* Telefon w normalnym przepływie, zaraz za blokiem tekstu — na pierwszy
            ekran wystaje tylko jego górna krawędź (zachęta do przewinięcia),
            a przewinięcie odsłania całość.

            Bez `rotate`: makieta jest teraz karuzelą przewijaną w poziomie,
            a obrócony kontener przewijany w bok to mylące trafienia palcem
            i przekrzywione kropki nawigacji. */}
        <div className="mt-6 md:mt-0 md:w-5/12">
          <PhoneCarousel className="mx-auto w-[248px] md:w-full md:max-w-[280px]" />
        </div>
      </div>
      {/* Sentinel for StickyCta's IntersectionObserver — appears once this
          leaves the viewport. Plain element so it stays in the RSC tree. */}
      <div id="hero-cta-sentinel" aria-hidden="true" />
    </section>
  );
}
