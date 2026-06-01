'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Users } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import GameCard from '@/components/games/GameCard';
import { getGames, joinGame } from '@/lib/api';
import type { Game } from '@/types';

const SPORTS = ['Wszystkie', 'Piłka nożna', 'Koszykówka', 'Tenis', 'Siatkówka', 'Futsal'];

const SPORT_FILTER: Record<string, string> = {
  'Piłka nożna': 'piłka nożna',
  'Koszykówka': 'koszykówka',
  'Tenis': 'tenis',
  'Siatkówka': 'siatkówka',
  'Futsal': 'futsal',
};

export default function GraczeePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedSport, setSelectedSport] = useState('Wszystkie');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sport = SPORT_FILTER[selectedSport];
      const res = await getGames({ sport });
      setGames(res.games);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd pobierania ogłoszeń');
    } finally {
      setLoading(false);
    }
  }, [selectedSport]);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  const handleJoin = async (gameId: string) => {
    try {
      await joinGame(gameId);
      await fetchGames();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Nie udało się dołączyć');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
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

        <div className="flex flex-wrap gap-2 mb-6">
          {SPORTS.map((sport) => (
            <button
              key={sport}
              onClick={() => setSelectedSport(sport)}
              className={[
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                selectedSport === sport
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400 hover:text-primary-700',
              ].join(' ')}
            >
              {sport}
            </button>
          ))}
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-4">
            {games.map((game) => (
              <GameCard key={game.id} game={game} onJoin={handleJoin} />
            ))}
          </div>
        )}

        {!loading && !error && games.length === 0 && (
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
