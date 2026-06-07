import Link from 'next/link';
import {
  CalendarPlus, UserPlus, Compass, RefreshCw, Building2, ArrowRight,
  Link2, ListChecks, Bell, UserCheck, Zap, Users, MapPin,
  Navigation, Calendar, CalendarDays, Mail,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import MapView from '@/components/map/MapView';
import SportsSectionWithCounts from '@/components/SportsSectionWithCounts';
import HomeHero from '@/components/home/HomeHero';

type Chip = { icon: React.ElementType; label: string };

type UseCase = {
  icon: React.ElementType;
  tone: 'green' | 'amber';
  eyebrow: string;
  description: string;
  chips: Chip[];
  cta: string;
  href: string;
};

type UseCaseGroup = {
  heading: string;
  tone: 'green' | 'amber';
  cases: UseCase[];
};

const USE_CASE_GROUPS: UseCaseGroup[] = [
  {
    heading: 'Organizujesz?',
    tone: 'green',
    cases: [
      {
        icon: CalendarPlus,
        tone: 'green',
        eyebrow: 'Organizuję mecz',
        description: 'Stwórz mecz, rozdaj link i miej zapisy, potwierdzenia i przypomnienia pod ręką.',
        chips: [
          { icon: Link2, label: 'Zaproszenia linkiem' },
          { icon: ListChecks, label: 'Lista zapisów' },
          { icon: Bell, label: 'Przypomnienia' },
        ],
        cta: 'Stwórz mecz',
        href: '/wydarzenia/nowe',
      },
      {
        icon: RefreshCw,
        tone: 'green',
        eyebrow: 'Gramy co tydzień',
        description: 'Ustaw stały termin i otwieraj zapisy jednym kliknięciem — bez ganiania ludzi co tydzień.',
        chips: [
          { icon: CalendarDays, label: 'Stały termin' },
          { icon: Mail, label: 'Powiadomienia' },
          { icon: Zap, label: 'Jeden klik' },
        ],
        cta: 'Stałe gierki',
        href: '/cykliczne',
      },
    ],
  },
  {
    heading: 'Grasz?',
    tone: 'amber',
    cases: [
      {
        icon: Compass,
        tone: 'amber',
        eyebrow: 'Szukam gry dla siebie',
        description: 'Przeglądaj otwarte mecze blisko ciebie i dołącz do gry jednym kliknięciem.',
        chips: [
          { icon: Calendar, label: 'Otwarte mecze' },
          { icon: Navigation, label: 'Blisko ciebie' },
          { icon: UserCheck, label: 'Dołącz w 1 klik' },
        ],
        cta: 'Znajdź grę',
        href: '/wydarzenia',
      },
      {
        icon: UserPlus,
        tone: 'amber',
        eyebrow: 'Uzupełnij skład',
        description: 'Masz grę, ale brakuje kilku osób? Otwórz wolne miejsca — zapiszą się chętni z okolicy.',
        chips: [
          { icon: Zap, label: 'Szybkie ogłoszenie' },
          { icon: Users, label: 'Wolne miejsca' },
          { icon: MapPin, label: 'Chętni z okolicy' },
        ],
        cta: 'Ogłoś miejsca',
        href: '/wydarzenia/nowe',
      },
    ],
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[2000] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-700 focus:shadow-lg focus:ring-2 focus:ring-primary-600"
      >
        Przejdź do treści
      </a>
      <Header />

      <main id="main" className="flex-1">
      {/* Hero — personalized for logged-in users, marketing for visitors */}
      <HomeHero />

      {/* Jak to działa — editorial explainer, placed first so visitors grasp the product */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">Jak to działa</span>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Bez dzwonienia. Bez excela. Bez ganiania ludzi.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            Kiedyś zebranie składu to były trzy grupy na WhatsAppie, lista w notatniku
            i ciągłe „kto w końcu gra?”. U nas wygląda to inaczej — od pomysłu do
            pierwszego gwizdka w kilka minut.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-10 sm:grid-cols-3">
          {[
            {
              n: '01',
              title: 'Znajdź albo stwórz',
              body: 'Przeglądaj otwarte mecze na mapie i dołącz jednym kliknięciem — albo sam zakładasz grę i ustawiasz termin, boisko i liczbę miejsc.',
            },
            {
              n: '02',
              title: 'Rozdaj jeden link',
              body: 'Zamiast spamu po grupach wysyłasz jeden link. Znajomi zapisują się sami, a na wolne miejsca znajdą się chętni z okolicy.',
            },
            {
              n: '03',
              title: 'Po prostu zagraj',
              body: 'Lista składu, rezerwowi i przypomnienia działają w tle. Ty masz pewność, że skład dopięty i nikt nie zniknie w dniu meczu.',
            },
          ].map((step) => (
            <div key={step.n} className="text-center sm:text-left">
              <span className="font-display text-4xl font-extrabold text-primary-200">{step.n}</span>
              <h3 className="mt-3 font-display text-lg font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{step.body}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-12 max-w-xl text-center text-sm text-slate-500">
          Wszystko działa w przeglądarce na telefonie i komputerze — logujesz się przez
          Google i nic nie instalujesz.
        </p>
      </section>

      {/* Intent cards */}
      <section className="border-y border-slate-200/70 bg-white px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {USE_CASE_GROUPS.map((group) => {
              const groupTone = group.tone === 'green'
                ? { heading: 'text-primary-700', headingBg: 'bg-primary-50' }
                : { heading: 'text-amber-600',   headingBg: 'bg-amber-50' };

              return (
                <div key={group.heading} className="flex flex-col gap-3">
                  <div className={`inline-flex items-center self-start rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${groupTone.headingBg} ${groupTone.heading}`}>
                    {group.heading}
                  </div>
                  {group.cases.map((uc) => {
                    const tone = uc.tone === 'green'
                      ? { badge: 'bg-primary-50 text-primary-700', chipIcon: 'text-primary-700', eyebrow: 'text-primary-700', cta: 'text-primary-700', border: 'hover:border-primary-200' }
                      : { badge: 'bg-amber-50 text-amber-600',     chipIcon: 'text-amber-600',   eyebrow: 'text-amber-600',   cta: 'text-amber-700',   border: 'hover:border-amber-200' };

                    return (
                      <Link key={uc.eyebrow} href={uc.href} className="group">
                        <div className={`flex h-full flex-col rounded-2xl border border-slate-200 bg-canvas p-6 transition-all duration-200 hover:-translate-y-1 hover:bg-white hover:shadow-card-hover ${tone.border}`}>
                          <div className="mb-3 flex items-center gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.badge}`}>
                              <uc.icon className="h-5 w-5" />
                            </div>
                            <span className={`text-base font-bold leading-tight ${tone.eyebrow}`}>
                              {uc.eyebrow}
                            </span>
                          </div>

                          <p className="text-sm leading-relaxed text-slate-500">{uc.description}</p>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {uc.chips.map((chip) => (
                              <span
                                key={chip.label}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
                              >
                                <chip.icon className={`h-3.5 w-3.5 ${tone.chipIcon}`} />
                                {chip.label}
                              </span>
                            ))}
                          </div>

                          <span className={`mt-5 inline-flex items-center gap-1 text-sm font-semibold transition-all group-hover:gap-2 ${tone.cta}`}>
                            {uc.cta} <ArrowRight className="h-4 w-4" />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Rezerwacja boiska — wkrótce */}
          <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center sm:flex-row sm:text-left">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <h3 className="font-display text-base font-bold text-slate-600">Rezerwacja boiska</h3>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">
                  Wkrótce
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Sprawdź dostępność i zaklep termin online — bez dzwonienia do obiektu.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Map preview — moved below the fold; explore real venues before the closing CTA */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
              Setki boisk. Poznań i okolice.
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Kliknij boisko, żeby zobaczyć dostępność i aktywne gry.
            </p>
          </div>
          <Link
            href="/mapa"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800 transition-colors"
          >
            Pełna mapa <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-card-hover">
          <MapView className="h-72 overflow-hidden rounded-xl sm:h-80" />
        </div>
        <p className="mt-3 text-center text-sm sm:hidden">
          <Link href="/mapa" className="inline-flex items-center gap-1 font-medium text-primary-700 hover:text-primary-800">
            Otwórz pełną mapę <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </p>
      </section>

      {/* Sports with live counts */}
      <SportsSectionWithCounts />

      {/* Tournament acquisition banner */}
      <section className="px-4 pt-8">
        <div className="mx-auto max-w-5xl rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/60 p-6 sm:p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                Nowość · zapisy otwarte
              </div>
              <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
                Turniej startowy Bojo
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Zgłoś drużynę, rozdaj link — reszta ekipy dołącza w aplikacji. Poznań, najbliższe weekendy.
              </p>
            </div>
            <Link
              href="/turniej"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-[#1A1D21] shadow-sm transition-colors hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2"
            >
              Zapisz się <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="hero-surface relative overflow-hidden px-4 py-20 text-center text-white">
        <div className="hero-dots absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-xl">
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Następna gierka jest blisko.
          </h2>
          <div className="mt-8">
            <Link href="/wydarzenia">
              <Button
                size="lg"
                className="bg-[#F5A623] text-[#1A1D21] font-bold hover:bg-amber-400 border-transparent shadow-lg"
              >
                Znajdź mecz w okolicy <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      </main>

      {/* Footer */}
      <footer className="bg-slate-900 px-4 py-10 text-slate-400">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm font-semibold text-white">Bojo · Poznań i okolice</p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            <Link href="/wydarzenia" className="transition-colors hover:text-white">Znajdź grę</Link>
            <Link href="/wydarzenia/nowe" className="transition-colors hover:text-white">Zorganizuj grę</Link>
            <Link href="/mapa" className="transition-colors hover:text-white">Mapa boisk</Link>
            <Link href="/cykliczne" className="transition-colors hover:text-white">Stałe gierki</Link>
            <span className="hidden text-slate-600 md:inline">·</span>
            <Link href="/prywatnosc" className="text-slate-500 transition-colors hover:text-white">Prywatność</Link>
            <Link href="/regulamin" className="text-slate-500 transition-colors hover:text-white">Regulamin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
