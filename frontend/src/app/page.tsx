import Link from 'next/link';
import {
  CalendarPlus, UserPlus, Compass, RefreshCw, Building2, ArrowRight,
  Link2, ListChecks, Bell, UserCheck, Zap, Users, MapPin,
  Navigation, Calendar, CalendarDays, Mail, Map as MapIcon, Share2, ShieldCheck,
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
          { icon: UserCheck, label: 'Bez rejestracji' },
        ],
        cta: 'Znajdź grę',
        href: '/wydarzenia',
      },
      {
        icon: UserPlus,
        tone: 'amber',
        eyebrow: 'Dograj skład',
        description: 'Otwórz wolne miejsca w swoim meczu, a gracze z okolicy dograją się sami.',
        chips: [
          { icon: Zap, label: 'Szybkie ogłoszenie' },
          { icon: Users, label: 'Wolne miejsca' },
          { icon: MapPin, label: 'Gracze z okolicy' },
        ],
        cta: 'Ogłoś wolne miejsca',
        href: '/wydarzenia/nowe',
      },
    ],
  },
];

type Feature = {
  icon: React.ElementType;
  title: string;
  description: string;
  cta: string;
  href: string;
};

const FEATURES: Feature[] = [
  {
    icon: MapIcon,
    title: 'Mapa boisk',
    description: 'Setki boisk w Poznaniu i okolicach na jednej mapie — z lokalizacją, sportami i nawierzchnią.',
    cta: 'Otwórz mapę',
    href: '/mapa',
  },
  {
    icon: Share2,
    title: 'Zapisy przez link',
    description: 'Tworzysz mecz, wysyłasz jeden link. Zapisy, lista rezerwowa i potwierdzenia w jednym miejscu.',
    cta: 'Zorganizuj mecz',
    href: '/wydarzenia/nowe',
  },
  {
    icon: Users,
    title: 'Dograj skład',
    description: 'Brakuje paru osób? Otwórz mecz publicznie, a gracze z okolicy dołączą jednym kliknięciem.',
    cta: 'Przeglądaj mecze',
    href: '/wydarzenia',
  },
  {
    icon: ShieldCheck,
    title: 'Bez instalacji',
    description: 'Działa w przeglądarce na telefonie i komputerze. Logujesz się przez Google — nic nie instalujesz.',
    cta: 'Zobacz, jak gra okolica',
    href: '/wydarzenia',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header />

      {/* Hero — personalized for logged-in users, marketing for visitors */}
      <HomeHero />

      {/* Map preview — after hero, degraded to helper section */}
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

      {/* Jak to działa — features with links */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">Jak to działa</span>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Wszystko, czego trzeba, żeby zagrać
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
              Od znalezienia boiska po zebranie składu — bez dzwonienia, bez excela, bez ganiania ludzi.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEATURES.map((feat) => (
              <Link key={feat.title} href={feat.href} className="group">
                <div className="flex h-full items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-card-hover sm:p-6">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                    <feat.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-bold text-ink">{feat.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{feat.description}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 transition-all group-hover:gap-2">
                      {feat.cta} <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Sports with live counts */}
      <SportsSectionWithCounts />

      {/* Closing CTA */}
      <section className="hero-surface relative overflow-hidden px-4 py-24 text-center text-white">
        <div className="hero-dots absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Zbierz skład. Zagraj dziś.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-white/75">
            Boiska, mecze i gracze w Poznaniu i okolicach.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/wydarzenia">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-[#F5A623] text-[#1A1D21] font-bold hover:bg-amber-400 border-transparent shadow-lg"
              >
                Dołącz do gry <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/wydarzenia/nowe">
              <Button
                variant="outline"
                size="lg"
                className="w-full border-white/30 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15 sm:w-auto"
              >
                Szukam ludzi do gry
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 px-4 py-10 text-slate-400">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm font-semibold text-white">Bojo · Poznań i okolice</p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            <Link href="/wydarzenia" className="transition-colors hover:text-white">Znajdź grę</Link>
            <Link href="/wydarzenie/nowe" className="transition-colors hover:text-white">Zorganizuj grę</Link>
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
