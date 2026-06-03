import Link from 'next/link';
import { MapPin, Users, Zap, RefreshCw, ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import MapView from '@/components/map/MapView';
import SportsSectionWithCounts from '@/components/SportsSectionWithCounts';

const HOW_IT_WORKS = [
  {
    icon: MapPin,
    title: 'Wybierz boisko i termin.',
    description: 'Setki boisk w Poznaniu i okolicach — filtruj po sporcie i lokalizacji.',
    href: '/mapa',
  },
  {
    icon: Users,
    title: 'Zaproś ekipę jednym linkiem.',
    description: 'Gracze potwierdzają bez rejestracji. Widzisz kto idzie.',
    href: '/wydarzenia/nowe',
  },
  {
    icon: Zap,
    title: 'Brakuje ludzi? Ogłoś mecz publicznie.',
    description: 'Otwórz zapisy — dołączy ktoś szukający gry.',
    href: '/wydarzenia',
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
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-accent-200 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-400" />
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
            className="mx-auto mt-6 max-w-xl animate-fade-up text-lg font-medium text-primary-50/90 sm:text-xl"
            style={{ animationDelay: '160ms' }}
          >
            Boiska, mecze i gracze w Poznaniu i okolicach.
          </p>

          <div
            className="mt-10 flex animate-fade-up flex-col justify-center gap-3 sm:flex-row"
            style={{ animationDelay: '240ms' }}
          >
            <Link href="/wydarzenia">
              <Button variant="accent" size="lg" className="w-full sm:w-auto">
                Znajdź grę <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/mapa">
              <Button
                variant="outline"
                size="lg"
                className="w-full border-white/30 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15 sm:w-auto"
              >
                Pokaż boiska
              </Button>
            </Link>
          </div>
        </div>

        {/* Soft transition into the canvas below */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-canvas" aria-hidden="true" />
      </section>

      {/* Map — right after hero */}
      <section className="mx-auto w-full max-w-5xl px-4 py-14">
        <div className="mb-6 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Setki boisk. Poznań i okolice.
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Kliknij boisko, żeby zobaczyć dostępność i aktywne gry.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-card-hover">
          <MapView className="h-80 overflow-hidden rounded-xl sm:h-96" />
        </div>
        <p className="mt-4 text-center text-sm">
          <Link
            href="/mapa"
            className="inline-flex items-center gap-1 font-medium text-primary-700 transition-colors hover:text-primary-800"
          >
            Otwórz pełną mapę
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </p>
      </section>

      {/* How it works */}
      <section className="border-y border-slate-200/70 bg-white px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Jak to działa?
            </h2>
            <p className="mt-2 text-sm text-slate-500">Trzy kroki do meczu.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <Link key={i} href={step.href} className="group">
                <div className="relative h-full overflow-hidden rounded-2xl border border-slate-200 bg-canvas p-6 transition-all duration-200 hover:-translate-y-1 hover:border-primary-200 hover:bg-white hover:shadow-card-hover">
                  {/* accent top edge on hover */}
                  <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-primary-600 to-accent-500 transition-transform duration-300 group-hover:scale-x-100" />
                  <div className="mb-4 flex items-center gap-3">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 transition-colors group-hover:bg-primary-100">
                      <step.icon className="h-5 w-5" />
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-700 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-base font-semibold leading-snug text-ink">{step.title}</h3>
                  {step.description && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{step.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Recurring events promo */}
      <section className="px-4 py-20">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 rounded-3xl border border-primary-100 bg-primary-50/60 p-8 md:flex-row md:p-12">
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
              <Button>Stwórz stały termin</Button>
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
          <p className="mx-auto mt-4 max-w-md text-primary-50/85">
            Boiska, mecze i gracze w Poznaniu i okolicach.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/wydarzenia">
              <Button variant="accent" size="lg" className="w-full sm:w-auto">
                Znajdź grę <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/wydarzenia/nowe">
              <Button
                variant="outline"
                size="lg"
                className="w-full border-white/30 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15 sm:w-auto"
              >
                Stwórz wydarzenie
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
            <Link href="/mapa" className="transition-colors hover:text-white">Mapa boisk</Link>
            <Link href="/wydarzenia" className="transition-colors hover:text-white">Znajdź grę</Link>
            <Link href="/cykliczne" className="transition-colors hover:text-white">Stałe ekipy</Link>
            <span className="hidden text-slate-600 md:inline">·</span>
            <Link href="/prywatnosc" className="text-slate-500 transition-colors hover:text-white">Prywatność</Link>
            <Link href="/regulamin" className="text-slate-500 transition-colors hover:text-white">Regulamin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
