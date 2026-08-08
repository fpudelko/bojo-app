import Link from 'next/link';
import { clsx } from 'clsx';
import { Zap, ListChecks, UsersRound, Wallet, MapPin, ArrowRight, type LucideIcon } from 'lucide-react';
import { LANDING_CTA, LANDING_VALUES } from './content';
import WczesnyEtapBadge from './WczesnyEtapBadge';

const ICONS: Record<string, LucideIcon> = { Zap, ListChecks, UsersRound, Wallet, MapPin };

export default function LandingValues() {
  return (
    <section className="bg-white px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-10 sm:mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">
            Co dostajesz
          </span>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Wszystko, czego trzeba do zorganizowania meczu
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_VALUES.map((v) => {
            const Icon = ICONS[v.icon];
            // Wyciszenie zamiast wyszarzenia do nieczytelności: kafelek ma dalej
            // sprzedawać funkcję, tylko bez obietnicy pełnej gotowości.
            const wczesny = 'wczesnyEtap' in v && v.wczesnyEtap;
            return (
              <div
                key={v.title}
                className={clsx(
                  'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card',
                  wczesny && 'opacity-80',
                )}
              >
                <div className={clsx(
                  'flex h-11 w-11 items-center justify-center rounded-xl',
                  wczesny ? 'bg-slate-100 text-slate-400' : 'bg-primary-50 text-primary-700',
                )}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-ink">{v.title}</h3>
                {wczesny && <WczesnyEtapBadge />}
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{v.body}</p>
              </div>
            );
          })}

          <div className="flex flex-col justify-between rounded-2xl bg-primary-700 p-5 text-white">
            <p className="font-display text-lg font-bold tracking-tight">
              Wrzuć swój pierwszy mecz
            </p>
            <Link
              href={LANDING_CTA.primary.href}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-bold text-primary-950 transition-colors hover:bg-accent-400"
            >
              {LANDING_CTA.primary.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
