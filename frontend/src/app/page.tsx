import Link from 'next/link';
import { MapPin, Users, Zap } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import MapView from '@/components/map/MapView';

const HOW_IT_WORKS = [
  {
    icon: MapPin,
    title: 'Wybierz boisko',
    description: 'Setki boisk w Poznaniu na interaktywnej mapie. Filtruj po sporcie i szukaj po nazwie.',
    href: '/mapa',
  },
  {
    icon: Users,
    title: 'Zbierz skład',
    description: 'Stwórz wydarzenie, zaproś znajomych linkiem. Dodawaj gości bez konta, śledź kto zapłacił.',
    href: '/wydarzenia/nowe',
  },
  {
    icon: Zap,
    title: 'Dograj brakujących',
    description: 'Brakuje ludzi? Upublicznij wydarzenie i pozwól dołączyć innym graczom z Poznania.',
    href: '/wydarzenia',
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
            Znajdź grę.<br />Zbierz skład.
          </h1>
          <p className="text-lg sm:text-xl text-primary-100 mb-10 max-w-2xl mx-auto">
            Stwórz mecz, wybierz boisko na mapie i zaproś znajomych linkiem.
            Brakuje ludzi? Upublicznij i dograj skład.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/wydarzenia/nowe">
              <Button variant="secondary" size="lg">Stwórz wydarzenie</Button>
            </Link>
            <Link href="/wydarzenia">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10">
                Przeglądaj wydarzenia
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Map preview */}
      <section className="max-w-5xl mx-auto w-full px-4 -mt-8">
        <div className="bg-white rounded-2xl shadow-xl p-4">
          <MapView className="h-64 rounded-xl overflow-hidden" />
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Jak to działa?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <Link key={step.title} href={step.href} className="group">
                <Card className="h-full p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer group-hover:border-primary-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary-50 rounded-lg relative">
                      <step.icon className="w-6 h-6 text-primary-600" />
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Sports */}
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Dla każdej drużyny</h2>
          <div className="flex flex-wrap justify-center gap-3 text-sm font-medium text-gray-700">
            {[
              ['⚽', 'Piłka nożna'],
              ['🏀', 'Koszykówka'],
              ['🏐', 'Siatkówka'],
              ['🏖️', 'Siatkówka plażowa'],
              ['⚡', 'Futsal'],
              ['🤾', 'Piłka ręczna'],
            ].map(([emoji, name]) => (
              <span key={name} className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2">
                <span>{emoji}</span> {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-gray-900 text-gray-400 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm">© 2025 Zagrajmy. Poznań.</p>
          <div className="flex gap-6 text-sm">
            <Link href="/mapa" className="hover:text-white transition-colors">Mapa boisk</Link>
            <Link href="/wydarzenia" className="hover:text-white transition-colors">Znajdź grę</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
