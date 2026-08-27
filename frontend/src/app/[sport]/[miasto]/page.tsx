import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { MapPin } from 'lucide-react';
import Header from '@/components/layout/Header';
import SiteFooter from '@/components/layout/SiteFooter';
import MiniFaq from '@/components/tresc/MiniFaq';
import { getNearbyEvents } from '@/lib/events';
import { policzBoiskaWOkolicy } from '@/lib/api';
import { FOCUS_SPORT_BY_SLUG } from '@/lib/sports';
import { eventDisplayTitle } from '@/lib/eventTitle';
import { withCount } from '@/lib/plural';
import { breadcrumbsJsonLd, howToJsonLd, faqJsonLd } from '@/lib/structuredData';
import { JAK_DZIALA } from '@/content/jakDziala';
import { FAQ } from '@/content/faq';
import { SPORT_ODMIANA, GRAJ_LEAD, GRAJ_BRAK_MECZY } from '@/content/graj';
import {
  MIASTA,
  PROMIEN_KM,
  znajdzMiasto,
  odpowiedzMiasta,
  CZYM_BOJO_NIE_JEST,
  zdanieOKatalogu,
} from '@/content/miasta';

const KROKI_ZAKLADANIA = JAK_DZIALA.find((s) => s.id === 'zakladasz-mecz')!.akapity;

// Pytania, na które ta strona realnie odpowiada — te same, które trafiają do
// FAQPage. Renderowane widocznie, bo schema bez pokrycia w tekście to sygnał
// spamu, nie boost (patrz lib/structuredData.ts#faqJsonLd).
const PYTANIA_TUTAJ = [
  'Co zrobić, gdy brakuje osoby na mecz?',
  'Czy gracze muszą zakładać konto, żeby dołączyć do mojego meczu?',
  'Jak sprawiedliwie rozliczyć koszty wynajmu boiska?',
  'Czym różni się mecz publiczny od prywatnego?',
];
const FAQ_TUTAJ = FAQ.filter((p) => PYTANIA_TUTAJ.includes(p.q));

function znajdzSport(slug: string) {
  const db = FOCUS_SPORT_BY_SLUG[slug];
  const odmiana = SPORT_ODMIANA.find((s) => s.slug === slug);
  if (!db || !odmiana) return null;
  return { slug, db, biernik: odmiana.biernik, dopelniacz: odmiana.dopelniacz };
}

export function generateStaticParams() {
  return Object.keys(FOCUS_SPORT_BY_SLUG).flatMap((sport) =>
    MIASTA.map((m) => ({ sport, miasto: m.slug })),
  );
}

// Trasa siedzi na pierwszym segmencie ścieżki, więc bez tego łapałaby KAŻDY
// nieznany adres dwuczłonowy i renderowała go na żądanie. Z dynamicParams=false
// istnieją wyłącznie kombinacje z generateStaticParams, a reszta dostaje 404.
export const dynamicParams = false;

// Lista otwartych meczów zmienia się z dnia na dzień — godzinny TTL zamiast
// budowania na nowo przy każdym żądaniu, ale bez ryzyka pokazywania
// tygodniowej nieaktualności.
export const revalidate = 3600;

export async function generateMetadata(
  { params }: { params: { sport: string; miasto: string } },
): Promise<Metadata> {
  const sport = znajdzSport(params.sport);
  const miasto = znajdzMiasto(params.miasto);
  if (!sport || !miasto) return { title: 'Nie znaleziono' };
  return {
    title: `Graj w ${sport.biernik} ${miasto.miejscownik}`,
    description:
      `Dołącz do otwartego meczu ${sport.dopelniacz} ${miasto.miejscownik} albo ` +
      `stwórz własny i zbierz skład przez Bojo — bez zakładania konta dla graczy.`,
    alternates: { canonical: `/${params.sport}/${params.miasto}` },
  };
}

export default async function GrajPage(
  { params }: { params: { sport: string; miasto: string } },
) {
  const sport = znajdzSport(params.sport);
  const miasto = znajdzMiasto(params.miasto);
  if (!sport || !miasto) notFound();

  const [nearby, liczbaBoisk] = await Promise.all([
    getNearbyEvents(miasto.lat, miasto.lng, PROMIEN_KM, 30),
    policzBoiskaWOkolicy(miasto.lat, miasto.lng, PROMIEN_KM),
  ]);
  const meczeWszystkie = nearby.filter((e) => e.sport === sport.db);
  const mecze = meczeWszystkie.slice(0, 5);

  const jsonLd = [
    breadcrumbsJsonLd([
      { name: 'Bojo', path: '/' },
      { name: `Graj w ${sport.biernik} ${miasto.miejscownik}` },
    ]),
    howToJsonLd('Jak zorganizować mecz w Bojo', [
      { name: 'Sport i miejsce', text: KROKI_ZAKLADANIA[0] },
      { name: 'Termin i liczba miejsc', text: KROKI_ZAKLADANIA[1] },
      { name: 'Opcje i publikacja', text: KROKI_ZAKLADANIA[2] },
    ]),
    faqJsonLd(FAQ_TUTAJ),
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
          Graj w {sport.biernik} {miasto.miejscownik}
        </h1>

        {/* Direct Answer — odpowiedź wprost, przed jakąkolwiek nawigacją po
            stronie. Czytelnik, który przyszedł z wyszukiwarki z konkretnym
            pytaniem, dostaje odpowiedź w pierwszym akapicie. */}
        <p className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">
          {odpowiedzMiasta(sport.dopelniacz, miasto.miejscownik)}
        </p>

        <p className="mt-3 text-slate-600 text-sm">{GRAJ_LEAD}</p>

        <section className="mt-8">
          {meczeWszystkie.length > 0 ? (
            <>
              <p className="font-semibold text-ink">
                {withCount(
                  meczeWszystkie.length,
                  `otwarty mecz publiczny ${miasto.miejscownik}`,
                  `otwarte mecze publiczne ${miasto.miejscownik}`,
                  `otwartych meczów publicznych ${miasto.miejscownik}`,
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

        {/* Odróżnienie od systemów rezerwacji — bez tego bloku modele mieszają
            Bojo z platformami wynajmu obiektów. */}
        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-display text-lg font-bold text-ink">
            Czym Bojo nie jest
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{CZYM_BOJO_NIE_JEST}</p>
        </section>

        {liczbaBoisk > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl font-bold tracking-tight text-ink">
              Gdzie zagrać {miasto.miejscownik}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {zdanieOKatalogu(liczbaBoisk, miasto.miejscownik)}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link href="/mapa?gry=0" className="text-primary-600 hover:underline">
                Mapa boisk
              </Link>
              <Link href={`/boiska/${sport.slug}`} className="text-primary-600 hover:underline">
                Boiska do {sport.dopelniacz}
              </Link>
            </div>
          </section>
        )}

        <section id="pytania" className="mt-10 scroll-mt-20">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink">
            Częste pytania
          </h2>
          <div className="mt-3">
            <MiniFaq pytania={FAQ_TUTAJ} />
          </div>
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
              href="/mapa?gry=0"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Mapa boisk
            </Link>
            <Link
              href="/jak-dziala-bojo"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Jak działa Bojo — krok po kroku
            </Link>
          </div>
        </section>

        <nav
          className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
          aria-label={`Inne sporty ${miasto.miejscownik}`}
        >
          <span className="text-slate-500">Inne sporty {miasto.miejscownik}:</span>
          {SPORT_ODMIANA.filter((s) => s.slug !== sport.slug).map((s) => (
            <Link key={s.slug} href={`/${s.slug}/${miasto.slug}`} className="text-primary-600 hover:underline">
              {s.biernik}
            </Link>
          ))}
        </nav>

        <nav
          className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
          aria-label="Ten sam sport w innych miastach"
        >
          <span className="text-slate-500">Ten sam sport gdzie indziej:</span>
          {MIASTA.filter((m) => m.slug !== miasto.slug).map((m) => (
            <Link key={m.slug} href={`/${sport.slug}/${m.slug}`} className="text-primary-600 hover:underline">
              {m.mianownik}
            </Link>
          ))}
        </nav>
      </main>
      <SiteFooter />
    </div>
  );
}
