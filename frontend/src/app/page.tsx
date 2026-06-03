import Link from 'next/link';
import { CalendarPlus, UserPlus, Compass, RefreshCw, Building2, ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import MapView from '@/components/map/MapView';
import SportsSectionWithCounts from '@/components/SportsSectionWithCounts';

type UseCase = {
  icon: React.ElementType;
  iconColor: 'green' | 'amber';
  title: string;
  description: string;
  cta: string;
  href: string;
  soon?: boolean;
};

const USE_CASES: UseCase[] = [
  {
    icon: CalendarPlus,
    iconColor: 'green',
    title: 'Organizuję mecz',
    description: 'Stwórz wydarzenie i zaproś ekipę. Śledź zapisy, potwierdzenia, ustaw przypomnienia — wszystko w jednym miejscu.',
    cta: 'Stwórz wydarzenie',
    href: '/wydarzenia/nowe',
  },
  {
    icon: UserPlus,
    iconColor: 'amber',
    title: 'Szukam ludzi do gry',
    description: 'Brakuje 2 do składu? Wrzuć szybkie ogłoszenie albo udostępnij mecz — dograją się gracze z okolicy.',
    cta: 'Szukam brakujących',
    href: '/wydarzenia/nowe',
  },
  {
    icon: Compass,
    iconColor: 'amber',
    title: 'Szukam gry dla siebie',
    description: 'Dołącz do otwartego meczu. Uratuj komuś gierkę, zagraj, poznaj ludzi — może zaproszą cię na stałe?',
    cta: 'Znajdź grę',
    href: '/wydarzenia',
  },
  {
    icon: RefreshCw,
    iconColor: 'green',
    title: 'Gramy cyklicznie',
    description: 'Stały termin, ta sama ekipa, zero ogarniania co tydzień. Otwierasz zapisy jednym kliknięciem.',
    cta: 'Moje stałe gierki',
    href: '/cykliczne',
  },
  {
    icon: Building2,
    iconColor: 'green',
    title: 'Rezerwacja boiska',
    description: 'Znajdź wolny termin, zarezerwuj online — bez telefonowania. Właściciel potwierdza od ręki.',
    cta: 'Wkrótce',
    href: '#',
    soon: true,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header />

      {/* Hero */}
      <section className="hero-surface relative overflow-hidden text-white">
        <div className="hero-dots absolute inset-0" aria-hidden="true" />
        <div className="relative max-w-3xl mx-auto text-center px-4 py-24 sm:py-28">
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-amber-200 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            Poznań i okolice
          </span>

          <h1
            className="mt-6 animate-fade-up font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl"
            style={{ animationDelay: '80ms' }}
          >
            Następny mecz
            <br />
            zaczyna się tutaj.
          </h1>

          <p
            className="mx-auto mt-6 max-w-xl animate-fade-up text-lg font-medium text-white/80 sm:text-xl"
            style={{ animationDelay: '160ms' }}
          >
            Boiska, mecze i gracze w Poznaniu i okolicach.
          </p>

          <div
            className="mt-10 flex animate-fade-up flex-col justify-center gap-3 sm:flex-row"
            style={{ animationDelay: '240ms' }}
          >
            {/* Primary CTA — amber, high contrast, main action */}
            <Link href="/wydarzenia">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-[#F5A623] text-[#1A1D21] font-bold hover:bg-amber-400 border-transparent shadow-lg active:scale-[0.97]"
              >
                Dołącz do gry <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {/* Secondary CTA — outline white */}
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

          {/* Tertiary — quiet link to map */}
          <p className="mt-6 animate-fade-up text-sm text-white/50" style={{ animationDelay: '320ms' }}>
            <Link href="/mapa" className="hover:text-white/80 transition-colors underline underline-offset-2">
              Przeglądaj boiska →
            </Link>
          </p>
        </div>

        {/* Soft transition into the canvas below */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-canvas" aria-hidden="true" />
      </section>

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

      {/* Use cases */}
      <section className="border-y border-slate-200/70 bg-white px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Po co tu jesteś?
            </h2>
            <p className="mt-2 text-sm text-slate-500">Wejdź z dowolnego powodu — resztę ogarniemy.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((uc) => {
              const iconBg  = uc.iconColor === 'green' ? 'bg-primary-50 text-primary-700' : 'bg-amber-50 text-amber-600';
              const iconHover = uc.iconColor === 'green' ? 'group-hover:bg-primary-100' : 'group-hover:bg-amber-100';
              const accentBar = uc.iconColor === 'green'
                ? 'bg-gradient-to-r from-primary-700 to-primary-500'
                : 'bg-gradient-to-r from-accent-500 to-amber-400';

              if (uc.soon) {
                return (
                  <div
                    key={uc.title}
                    className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-6 opacity-60"
                  >
                    <span className="absolute right-4 top-4 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                      Wkrótce
                    </span>
                    <div className={`mb-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                      <uc.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold leading-snug text-ink">{uc.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{uc.description}</p>
                    <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                      {uc.cta}
                    </span>
                  </div>
                );
              }

              return (
                <Link key={uc.title} href={uc.href} className="group">
                  <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-canvas p-6 transition-all duration-200 hover:-translate-y-1 hover:border-primary-200 hover:bg-white hover:shadow-card-hover">
                    <span className={`absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100 ${accentBar}`} />
                    <div className={`mb-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${iconBg} ${iconHover}`}>
                      <uc.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold leading-snug text-ink">{uc.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{uc.description}</p>
                    <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 group-hover:gap-2 transition-all">
                      {uc.cta} <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Recurring events promo */}
      <section className="px-4 py-20">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 rounded-3xl border border-primary-100 bg-primary-50/40 p-8 md:flex-row md:p-12">
          <div className="flex-1">
            <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
              <RefreshCw className="h-4 w-4" />
              <span>Dla stałych ekip</span>
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Gracie co tydzień? Ogarnijcie to raz.
            </h2>
            <p className="mb-6 mt-3 text-sm leading-relaxed text-slate-600">
              Stały termin, lista graczy, jeden SMS do wszystkich. Koniec z pisaniem do każdego osobno.
            </p>
            <Link href="/cykliczne/nowe">
              <Button>Stwórz stałe gierki</Button>
            </Link>
          </div>
          <div className="grid w-full flex-shrink-0 grid-cols-2 gap-3 text-sm text-slate-700 md:w-auto md:max-w-xs">
            {[
              ['📅', 'Stały termin co tydzień'],
              ['📧', 'Powiadomienia e-mail'],
              ['📱', 'Powiadomienia SMS'],
              ['⚡', 'Jeden klik — nowa edycja'],
            ].map(([icon, text]) => (
              <div
                key={text}
                className="flex items-center gap-2 rounded-xl border border-primary-100 bg-white px-3 py-2.5 transition-shadow hover:shadow-card"
              >
                <span>{icon}</span>
                <span className="text-xs font-medium">{text}</span>
              </div>
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
