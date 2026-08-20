import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { MapPin } from 'lucide-react';
import Header from '@/components/layout/Header';
import SiteFooter from '@/components/layout/SiteFooter';
import { getNearbyEvents } from '@/lib/events';
import { FOCUS_SPORT_BY_SLUG } from '@/lib/sports';
import { eventDisplayTitle } from '@/lib/eventTitle';
import { withCount } from '@/lib/plural';
import { breadcrumbsJsonLd, howToJsonLd } from '@/lib/structuredData';
import { JAK_DZIALA } from '@/content/jakDziala';
import { SPORT_ODMIANA, GRAJ_LEAD, GRAJ_BRAK_MECZY } from '@/content/graj';

// Tożsame ze components/map/mapIcons.ts#POZNAN, ale zdefiniowane lokalnie —
// mapIcons.ts importuje Leaflet, którego nie chcemy ciągnąć do komponentu
// serwerowego bez żadnej potrzeby renderowania mapy.
const POZNAN: [number, number] = [52.37, 16.97];

// Promień przybliżający obszar zabudowany Poznania — na tyle szeroki, żeby
// nie gubić meczów na obrzeżach, na tyle wąski, żeby "w Poznaniu" zostało
// prawdą, nie marketingowym naciąganiem.
const PROMIEN_KM = 15;

// Tylko Poznań — jedyne miasto z realnym pokryciem katalogu i ruchem
// (patrz docs/wizja.md, content/dlaczego.ts#wczesny-etap). Rozszerzenie na
// kolejne miasta jest decyzją produktową, nie dopiskiem tutaj — patrz
// docs/funkcje.md.
const MIASTA = ['poznan'] as const;

const KROKI_ZAKLADANIA = JAK_DZIALA.find((s) => s.id === 'zakladasz-mecz')!.akapity;
const CZEGO_NIE_ROBI = JAK_DZIALA.find((s) => s.id === 'czego-bojo-nie-robi')!.akapity[0];

function znajdzSport(slug: string) {
  const db = FOCUS_SPORT_BY_SLUG[slug];
  const odmiana = SPORT_ODMIANA.find((s) => s.slug === slug);
  if (!db || !odmiana) return null;
  return { slug, db, biernik: odmiana.biernik, dopelniacz: odmiana.dopelniacz };
}

export function generateStaticParams() {
  return Object.keys(FOCUS_SPORT_BY_SLUG).flatMap((sport) =>
    MIASTA.map((miasto) => ({ sport, miasto })),
  );
}

// Lista otwartych meczów zmienia się z dnia na dzień — godzinny TTL zamiast
// budowania na nowo przy każdym żądaniu, ale bez ryzyka pokazywania
// tygodniowej nieaktualności.
export const revalidate = 3600;

export async function generateMetadata(
  { params }: { params: { sport: string; miasto: string } },
): Promise<Metadata> {
  const sport = znajdzSport(params.sport);
  if (!sport || params.miasto !== 'poznan') return { title: 'Nie znaleziono' };
  return {
    title: `Graj w ${sport.biernik} w Poznaniu`,
    description:
      `Dołącz do otwartego meczu ${sport.dopelniacz} w Poznaniu albo ` +
      `stwórz własny i zbierz skład przez Bojo — bez zakładania konta dla graczy.`,
    alternates: { canonical: `/graj/${params.sport}/poznan` },
  };
}

export default async function GrajPage(
  { params }: { params: { sport: string; miasto: string } },
) {
  const sport = znajdzSport(params.sport);
  if (!sport || params.miasto !== 'poznan') notFound();

  const nearby = await getNearbyEvents(POZNAN[0], POZNAN[1], PROMIEN_KM, 30);
  const meczeWszystkie = nearby.filter((e) => e.sport === sport.db);
  const mecze = meczeWszystkie.slice(0, 5);

  const jsonLd = [
    breadcrumbsJsonLd([
      { name: 'Bojo', path: '/' },
      { name: `Graj w ${sport.biernik} w Poznaniu` },
    ]),
    howToJsonLd('Jak zorganizować mecz w Bojo', [
      { name: 'Sport i miejsce', text: KROKI_ZAKLADANIA[0] },
      { name: 'Termin i liczba miejsc', text: KROKI_ZAKLADANIA[1] },
      { name: 'Opcje i publikacja', text: KROKI_ZAKLADANIA[2] },
    ]),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {jsonLd.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">
          Graj w {sport.biernik} w Poznaniu
        </h1>
        <p className="mt-2 text-slate-600 text-sm">{GRAJ_LEAD}</p>

        <section className="mt-8">
          {meczeWszystkie.length > 0 ? (
            <>
              <p className="font-semibold text-ink">
                {withCount(
                  meczeWszystkie.length,
                  'otwarty mecz publiczny w Poznaniu',
                  'otwarte mecze publiczne w Poznaniu',
                  'otwartych meczów publicznych w Poznaniu',
                )}
              </p>
              <ul className="mt-3 space-y-3">
                {mecze.map((ev) => {
                  let kiedy = ev.date;
                  try {
                    kiedy = format(parseISO(ev.date), 'EEEE d MMMM', { locale: pl });
                  } catch { /* zostaje surowa data */ }
                  return (
                    <li key={ev.id}>
                      <Link
                        href={`/wydarzenia/${ev.id}`}
                        className="flex items-start gap-4 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-primary-200 transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {eventDisplayTitle({ title: ev.title, sport: ev.sport, maxPlayers: ev.maxPlayers })}
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            {kiedy}{ev.time ? `, ${ev.time.slice(0, 5)}` : ''}
                          </p>
                          <p className="text-sm text-slate-500 flex items-center gap-1 mt-1 truncate">
                            <MapPin className="w-3.5 h-3.5 shrink-0" /> {ev.fieldName}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-slate-600 text-sm">{GRAJ_BRAK_MECZY}</p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink">
            Jak zbierzesz skład
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
            {KROKI_ZAKLADANIA.map((a, i) => <p key={i}>{a}</p>)}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">{CZEGO_NIE_ROBI}</p>
        </section>

        <section className="mt-10 rounded-2xl border border-primary-200 bg-primary-50 p-5">
          <p className="font-display text-lg font-bold text-ink">Gotowy spróbować?</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/wydarzenia/nowe?sport=${sport.slug}`}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-700 px-5 text-sm font-bold text-white transition hover:bg-primary-800 active:scale-95"
            >
              Stwórz mecz publiczny
            </Link>
            <Link
              href={`/boiska/${sport.slug}`}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Zobacz boiska
            </Link>
            <Link
              href="/jak-dziala-bojo"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Jak działa Bojo — krok po kroku
            </Link>
          </div>
        </section>

        <nav className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm" aria-label="Inne sporty w Poznaniu">
          <span className="text-slate-500">Inne sporty w Poznaniu:</span>
          {SPORT_ODMIANA.filter((s) => s.slug !== sport.slug).map((s) => (
            <Link key={s.slug} href={`/graj/${s.slug}/poznan`} className="text-primary-600 hover:underline">
              {s.biernik}
            </Link>
          ))}
        </nav>
      </main>
      <SiteFooter />
    </div>
  );
}
