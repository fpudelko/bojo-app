import Link from 'next/link';
import { MapPin, Users, Zap, RefreshCw } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import MapView from '@/components/map/MapView';
import SportsSectionWithCounts from '@/components/SportsSectionWithCounts';

const HOW_IT_WORKS = [
  {
    icon: MapPin,
    title: 'Wybierz boisko i termin.',
    description: 'Setki boisk w Poznaniu — filtruj po sporcie.',
    href: '/mapa',
  },
  {
    icon: Users,
    title: 'Udostępnij link. Gracze potwierdzają jednym kliknięciem.',
    description: 'Zero rejestracji dla zaproszonych. Widzisz kto idzie.',
    href: '/wydarzenia/nowe',
  },
  {
    icon: Zap,
    title: 'Ogłoś mecz publicznie — dograją się gracze z okolicy.',
    description: '',
    href: '/wydarzenia',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-5">
            Następny mecz zaczyna się tutaj.
          </h1>
          <p className="text-xl sm:text-2xl font-medium text-primary-100 mb-10">
            Boiska, mecze i gracze w Poznaniu i okolicach — w jednym miejscu.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/wydarzenia">
              <Button variant="secondary" size="lg">Znajdź grę</Button>
            </Link>
            <Link href="/mapa">
              <Button variant="outline" size="lg" className="border-white/60 text-white hover:bg-white/10">
                Pokaż boiska
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Map — right after hero */}
      <section className="max-w-5xl mx-auto w-full px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Setki boisk. Poznań i okolice.</h2>
        <p className="text-center text-sm text-gray-500 mb-6">
          Kliknij boisko, żeby zobaczyć dostępność i aktywne gry.
        </p>
        <div className="bg-white rounded-2xl shadow-xl p-4">
          <MapView className="h-80 rounded-xl overflow-hidden" />
        </div>
        <p className="text-center text-sm text-gray-400 mt-3">
          <Link href="/mapa" className="text-primary-600 hover:underline">Otwórz pełną mapę →</Link>
        </p>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">Jak to działa?</h2>
          <p className="text-center text-gray-500 text-sm mb-10">Mniej organizowania, więcej grania.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <Link key={i} href={step.href} className="group">
                <Card className="h-full p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer group-hover:border-primary-300">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 bg-primary-50 rounded-lg relative shrink-0 mt-0.5">
                      <step.icon className="w-5 h-5 text-primary-600" />
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 leading-snug">{step.title}</h3>
                  </div>
                  {step.description && (
                    <p className="text-gray-500 text-sm leading-relaxed pl-11">{step.description}</p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Recurring events promo */}
      <section className="bg-primary-50 border-y border-primary-100 py-16 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-primary-600 font-semibold text-sm mb-3">
              <RefreshCw className="w-4 h-4" />
              <span>Dla stałych ekip</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Gracie co tydzień? Ogarnijcie to raz.
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Stały termin, lista graczy, jeden SMS do wszystkich. Koniec z pisaniem do każdego osobno.
            </p>
            <Link href="/cykliczne/nowe">
              <Button>Stwórz stały termin</Button>
            </Link>
          </div>
          <div className="flex-shrink-0 grid grid-cols-2 gap-3 text-sm text-gray-700 w-full md:w-auto md:max-w-xs">
            {[
              ['📅', 'Stały termin co tydzień'],
              ['📧', 'Powiadomienia e-mail'],
              ['📱', 'Powiadomienia SMS'],
              ['⚡', 'Jeden klik — nowa edycja'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-2 bg-white rounded-xl border border-primary-100 px-3 py-2.5">
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
      <section className="bg-primary-600 py-20 px-4 text-white text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-6">
          Zbierz skład. Zagraj dziś.
        </h2>
        <Link href="/wydarzenia">
          <Button variant="secondary" size="lg">Znajdź grę</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-white font-medium">Bojo · Poznań i okolice</p>
          <div className="flex flex-wrap gap-4 text-sm justify-center">
            <Link href="/mapa" className="hover:text-white transition-colors">Mapa boisk</Link>
            <Link href="/wydarzenia" className="hover:text-white transition-colors">Znajdź grę</Link>
            <Link href="/cykliczne" className="hover:text-white transition-colors">Stałe ekipy</Link>
            <span className="text-gray-600 hidden md:inline">·</span>
            <Link href="/prywatnosc" className="hover:text-white transition-colors text-gray-500">Prywatność</Link>
            <Link href="/regulamin" className="hover:text-white transition-colors text-gray-500">Regulamin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
