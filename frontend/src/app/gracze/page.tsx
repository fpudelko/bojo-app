import type { Metadata } from 'next';
import { Plus, Users } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import GameCard from '@/components/games/GameCard';
import type { Game } from '@/types';

export const metadata: Metadata = {
  title: 'Szukam graczy',
  description: 'Ogłoszenia graczy szukających partnerów do wspólnej gry w Poznaniu.',
};

// TODO: replace with server-side fetch from FastAPI /games endpoint
// e.g.: const { games } = await getGames();
const SKELETON_GAMES: Game[] = [
  {
    id: 'mock-1',
    fieldId: 'field-1',
    fieldName: 'Boisko przy ul. Dąbrowskiego',
    sport: 'piłka nożna',
    date: '2024-06-15',
    time: '18:00',
    playersNeeded: 10,
    playersJoined: 7,
    author: 'Marek K.',
    description: 'Gramy 5v5 na małym boisku. Poziom amatorski, dobra zabawa!',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mock-2',
    fieldId: 'field-2',
    fieldName: 'Hala Arena — sala boczna',
    sport: 'koszykówka',
    date: '2024-06-16',
    time: '19:30',
    playersNeeded: 8,
    playersJoined: 5,
    author: 'Anna W.',
    description: 'Cotygodniowa gra 4v4. Mile widziani gracze każdego poziomu.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mock-3',
    fieldId: 'field-3',
    fieldName: 'Korty Olimpia',
    sport: 'tenis',
    date: '2024-06-17',
    time: '10:00',
    playersNeeded: 2,
    playersJoined: 1,
    author: 'Piotr S.',
    description: 'Szukam partnera do singla. Poziom średniozaawansowany.',
    createdAt: new Date().toISOString(),
  },
];

export default function GraczerPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ogłoszenia graczy</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Dołącz do meczu lub stwórz własne ogłoszenie
            </p>
          </div>
          <Button variant="primary" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Dodaj ogłoszenie
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['Wszystkie', 'Piłka nożna', 'Koszykówka', 'Tenis', 'Siatkówka', 'Futsal'].map(
            (sport, idx) => (
              <button
                key={sport}
                className={[
                  'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                  idx === 0
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400 hover:text-primary-700',
                ].join(' ')}
              >
                {sport}
              </button>
            ),
          )}
        </div>

        {/* TODO: fetch games from API — currently showing mock data */}
        <div className="space-y-4">
          {SKELETON_GAMES.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>

        {/* Empty state (shown when no games) */}
        {SKELETON_GAMES.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Brak ogłoszeń</p>
            <p className="text-sm mt-1">Bądź pierwszy — dodaj ogłoszenie!</p>
          </div>
        )}
      </main>
    </div>
  );
}
