import { Check } from 'lucide-react';
import { LANDING_HERO } from './content';

/** "Za darmo · Google lub e-mail · Bez instalacji" — shared between the hero
 *  and the final CTA so the two can never drift in wording or style.
 *  gap-x-2 (not the final CTA's original gap-x-4) is what keeps this on one
 *  line down to 360px-wide phones; sm:gap-x-4 restores the roomier spacing
 *  once there's width to spare. */
export default function TrustRow({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-white/70 sm:gap-x-4 ${className}`}>
      {LANDING_HERO.trust.map((t) => (
        <li key={t} className="inline-flex items-center gap-1 whitespace-nowrap sm:gap-1.5">
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {t}
        </li>
      ))}
    </ul>
  );
}
