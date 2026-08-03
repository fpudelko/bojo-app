import Link from 'next/link';
import { CalendarPlus, Share2, Users, ArrowRight, type LucideIcon } from 'lucide-react';
import { LANDING_CTA, LANDING_STEPS } from './content';

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

        <ol className="flex flex-col gap-3">
          {LANDING_STEPS.map((step, i) => {
            const Icon = ICONS[step.icon];
            return (
              <li key={step.title} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-100 shadow-sm">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-[11px] font-bold text-primary-950 ring-2 ring-canvas">
                    {i + 1}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-ink">{step.title}</p>
                  <p className="text-sm leading-relaxed text-slate-500">{step.body}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <Link
          href={LANDING_CTA.primary.href}
          className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-5 py-3.5 text-base font-bold text-primary-950 shadow-sm transition-colors hover:bg-accent-400 sm:w-auto sm:mx-auto"
        >
          {LANDING_CTA.primary.label} <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
