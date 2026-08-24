import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { getFields } from '@/lib/api';
import { slugBoiska } from '@/lib/utils';
import { sportEmoji } from '@/lib/sports';

/**
 * "Boiska w okolicy" proof section. Wired to real fields from DB
 * (public map_visibility only), links to the real venue detail route
 * /boisko/[slug].
 *
 * Server component od 2026-08-24, nie kliencki ze `useEffect` — ta sekcja
 * była do tej pory jedynym miejscem w serwisie, gdzie strona główna
 * linkowała do stron obiektów, ale link istniał wyłącznie po hydratacji.
 * Robot bez JS dostawał zero linków w głąb katalogu z landingu
 * (docs/seo-geo-strategia.md, D18). Renderuje `null`, gdy zapytanie wraca
 * puste — ta sama zasada co w LandingOpenGames: żadnej pustej/szkieletowej
 * sekcji na zimnej bazie.
 */
export default async function LandingVenues() {
  const fields = await getFields({ mapVisibility: 'public', limit: 8 })
    .then(({ fields }) => {
      const picked = fields.filter((f) => f.district && f.sport.length > 0).slice(0, 4);
      return picked.length >= 4 ? picked : fields.slice(0, 4);
    })
    .catch(() => []);

  if (fields.length === 0) return null;

  return (
    <section className="bg-canvas px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">
              Boiska w okolicy
            </span>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Boiska, na których się gra
            </h2>
          </div>
          <Link
            href="/mapa"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800"
          >
            Cała mapa boisk <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <li key={f.id}>
              <Link
                href={`/boisko/${slugBoiska(f.name, f.id)}`}
                className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-card transition-colors duration-200 hover:border-primary-200 hover:shadow-card-hover"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-xl">
                  {sportEmoji(f.sport[0] ?? 'inne')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink" title={f.name}>{f.name}</span>
                  {f.district && (
                    <span className="block truncate text-xs text-slate-600">{f.district}</span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
