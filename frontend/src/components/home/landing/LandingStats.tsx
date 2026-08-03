import { LANDING_STATS_LABELS } from './content';

export default function LandingStats({ venueCount }: { venueCount: number | null }) {
  const venuesValue = venueCount != null ? String(venueCount) : LANDING_STATS_LABELS.venuesFallback;

  const stats = [
    { value: venuesValue, label: LANDING_STATS_LABELS.venuesSuffix },
    { value: LANDING_STATS_LABELS.sportsValue, label: LANDING_STATS_LABELS.sportsLabel },
    { value: LANDING_STATS_LABELS.priceValue, label: LANDING_STATS_LABELS.priceLabel },
  ];

  return (
    <section className="border-b border-slate-200/70 bg-white">
      <div className="mx-auto grid max-w-5xl grid-cols-3 divide-x divide-slate-200 px-4 py-6 sm:py-8">
        {stats.map((s) => (
          <div key={s.label} className="text-center px-2">
            <p className="font-display text-2xl font-bold text-ink sm:text-3xl">{s.value}</p>
            <p className="mt-1 text-[11px] leading-tight text-slate-500 sm:text-xs">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
