import Link from 'next/link';
import { MapPin, Users, SlidersHorizontal } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

// TODO: Replace with real <MapView /> component once Mapbox token is configured
function MapPlaceholder() {
  return (
    <div className="w-full h-64 bg-gray-200 rounded-xl flex items-center justify-center text-gray-500 text-sm border-2 border-dashed border-gray-300">
      <div className="text-center">
        <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="font-medium">Podgląd mapy</p>
        <p className="text-xs mt-1">Skonfiguruj NEXT_PUBLIC_MAPBOX_TOKEN</p>
      </div>
    </div>
  );
}

const features = [
  {
    icon: MapPin,
    title: 'Mapa boisk',
    description:
      'Interaktywna mapa wszystkich boisk w Poznaniu — piłkarskich, tenisowych, koszykarskich i innych.',
    href: '/mapa',
  },
  {
    icon: Users,
    title: 'Szukam graczy',
    description:
      'Tablica ogłoszeń: dołącz do meczu lub stwórz własne ogłoszenie i znajdź brakujących graczy.',
    href: '/gracze',
  },
  {
    icon: SlidersHorizontal,
    title: 'Filtry',
    description:
      'Filtruj boiska po rodzaju sportu, nawierzchni, dostępności i odległości od Twojej lokalizacji.',
    href: '/mapa',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
            Znajdź boisko w Poznaniu
          </h1>
          <p className="text-lg sm:text-xl text-primary-100 mb-10 max-w-2xl mx-auto">
            Ponad 200 boisk sportowych na mapie — piłka nożna, koszykówka, tenis, siatkówka i
            futsal. Szukaj graczy i umawiaj mecze jednym kliknięciem.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/mapa">
              <Button variant="secondary" size="lg">
                Przeglądaj mapę
              </Button>
            </Link>
            <Link href="/gracze">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10">
                Szukam graczy
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Map preview */}
      <section className="max-w-5xl mx-auto w-full px-4 -mt-8">
        <div className="bg-white rounded-2xl shadow-xl p-4">
          <MapPlaceholder />
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Co oferuje Boiska Poznań?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Link key={feature.title} href={feature.href} className="group">
                <Card className="h-full p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer group-hover:border-primary-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary-50 rounded-lg">
                      <feature.icon className="w-6 h-6 text-primary-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '200+', label: 'Boisk w Poznaniu' },
            { value: '5', label: 'Dyscyplin sportowych' },
            { value: '18', label: 'Dzielnic Poznania' },
            { value: '24/7', label: 'Dostęp do mapy' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-extrabold text-primary-600 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-gray-900 text-gray-400 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm">© 2024 Boiska Poznań. Licencja MIT.</p>
          <div className="flex gap-6 text-sm">
            <Link href="/mapa" className="hover:text-white transition-colors">
              Mapa
            </Link>
            <Link href="/gracze" className="hover:text-white transition-colors">
              Gracze
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
