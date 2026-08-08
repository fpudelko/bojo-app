import Link from 'next/link';
import { clsx } from 'clsx';
import { CalendarPlus, Share2, Users, ArrowRight, type LucideIcon } from 'lucide-react';
import { LANDING_STEPS } from './content';
import WczesnyEtapBadge from './WczesnyEtapBadge';

const ICONS: Record<string, LucideIcon> = { CalendarPlus, Share2, Users };

export default function LandingHowItWorks() {
  return (
    <section className="bg-canvas px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-10">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">
            Jak to działa
          </span>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Trzy kroki do składu
          </h2>
        </div>

        {/* Krok z `href` (dziś tylko pierwszy) staje się odnośnikiem — sekcja
            prowadzi do akcji własnym pierwszym punktem, zamiast powtarzać pod
            listą ten sam przycisk, który stoi już w hero. */}
        <ol className="flex flex-col gap-3">
          {LANDING_STEPS.map((step, i) => {
            const Icon = ICONS[step.icon];
            const href = 'href' in step ? step.href : undefined;
            // Karta wczesnego etapu jest wyciszona, ale nadal czytelna i klikalna
            // — chodzi o zdjęcie obietnicy, nie o wyłączenie funkcji.
            const wczesny = 'wczesnyEtap' in step && step.wczesnyEtap;
            const base = clsx(
              'flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-100 shadow-sm',
              wczesny && 'opacity-80',
            );

            const inner = (
              <>
                <div className={clsx(
                  'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                  wczesny ? 'bg-slate-100 text-slate-400' : 'bg-primary-50 text-primary-700',
                )}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-[11px] font-bold text-primary-950 ring-2 ring-canvas">
                    {i + 1}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-bold text-ink">
                    {step.title}
                    {href && <ArrowRight className="h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />}
                  </p>
                  {wczesny && <WczesnyEtapBadge />}
                  <p className="text-sm leading-relaxed text-slate-500">{step.body}</p>
                </div>
              </>
            );

            return (
              <li key={step.title}>
                {href ? (
                  <Link
                    href={href}
                    className={`${base} transition-all hover:ring-primary-200 hover:shadow-md active:scale-[0.99]`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className={base}>{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
