import Link from 'next/link';
import { MapPin, Users, Zap, RefreshCw, Search } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import MapView from '@/components/map/MapView';

const HOW_IT_WORKS = [
  {
    icon: MapPin,
    title: 'Wybierz boisko',
    description: 'Setki boisk w Poznaniu na interaktywnej mapie. Filtruj po sporcie, szukaj po nazwie.',
    href: '/mapa',
  },
  {
    icon: Users,
    title: 'Zbierz skład',
    description: 'Stwórz wydarzenie, zaproś znajomych jednym linkiem. Śledź kto zapłacił, losuj składy.',
    href: '/wydarzenia/nowe',
  },
  {
    icon: Zap,
    title: 'Dograj brakujących',
    description: 'Brakuje ludzi? Upublicznij grę — dołączą inni gracze z Poznania.',
    href: '/wydarzenia',
  },
];

const SPORTS = [
  ['⚽', 'Piłka nożna'],
  ['🏀', 'Koszykówka'],
  ['🏐', 'Siatkówka'],
  ['🏖️', 'Siatkówka plażowa'],
  ['⚡', 'Futsal'],
  ['🤾', 'Piłka ręczna'],
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-xs sm:text-sm font-semibold uppercase tracking-wider text-primary-100 bg-white/10 rounded-full px-4 py-1.5 mb-6">
            Sport amatorski w Poznaniu
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
            Zbierz ekipę na mecz
          </h1>
          <p className="text-xl sm:text-2xl font-medium text-primary-100 mb-8">
            albo znajdź grę i dołącz do składu
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center text-sm text-primary-100 mb-10 max-w-2xl mx-auto">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 shrink-0" />
              Wybierz boisko, zaproś linkiem, dograj skład
            </span>
            <span className="hidden sm:block text-primary-300">·</span>
            <span className="flex items-center gap-2">
              <Search className="w-4 h-4 shrink-0" />
              Przeglądaj otwarte mecze i uratuj rozgrywkę
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/wydarzenia/nowe">
              <Button variant="secondary" size="lg">Stwórz wydarzenie</Button>
            </Link>
            <Link href="/wydarzenia">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10">
                Znajdź grę do dołączenia
              </Button>
            </Link>
          </div>
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

      {/* Map preview */}
      <section className="max-w-5xl mx-auto w-full px-4 pb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Boiska w Poznaniu</h2>
        <div className="bg-white rounded-2xl shadow-xl p-4">
          <MapView className="h-72 rounded-xl overflow-hidden" />
        </div>
        <p className="text-center text-sm text-gray-400 mt-3">
          Kliknij w boisko, żeby zobaczyć szczegóły i stworzyć wydarzenie.{' '}
          <Link href="/mapa" className="text-primary-600 hover:underline">Otwórz pełną mapę →</Link>
        </p>
      </section>

      {/* Recurring events promo */}
      <section className="bg-primary-50 border-y border-primary-100 py-16 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-primary-600 font-semibold text-sm mb-3">
              <RefreshCw className="w-4 h-4" /> Nowe
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Regularnie gracie?<br />Stwórz cykliczne wydarzenie.
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Ustal stały termin i dodaj listę zawodników z ich e-mailem lub numerem telefonu.
              Kiedy otworzysz zapisy na nową edycję, każdy dostanie powiadomienie SMS lub e-mail
              z linkiem — bez szukania ludzi na Facebooku.
            </p>
            <Link href="/cykliczne/nowe">
              <Button>Stwórz cykliczne wydarzenie</Button>
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

      {/* Sports */}
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Dostępne sporty</h2>
          <p className="text-sm text-gray-500 mb-8">Organizuj i dołączaj do gier w swoim sporcie</p>
          <div className="flex flex-wrap justify-center gap-3 text-sm font-medium text-gray-700">
            {SPORTS.map(([emoji, name]) => (
              <Link
                key={name}
                href={`/wydarzenia?sport=${encodeURIComponent(name.toLowerCase())}`}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 hover:border-primary-300 hover:text-primary-700 transition-colors"
              >
                <span>{emoji}</span> {name}
              </Link>
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
            <Link href="/cykliczne" className="hover:text-white transition-colors">Cykliczne</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
