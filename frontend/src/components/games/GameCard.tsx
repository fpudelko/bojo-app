'use client';

import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, Clock, Users, MapPin, User } from 'lucide-react';
import { clsx } from 'clsx';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import type { Game } from '@/types';

interface GameCardProps {
  game: Game;
  onJoin?: (gameId: string) => void;
}

const SPORT_EMOJI: Record<string, string> = {
  'piłka nożna': '⚽',
  koszykówka: '🏀',
  siatkówka: '🏐',
  tenis: '🎾',
  futsal: '⚽',
  inne: '🏅',
};

export default function GameCard({ game, onJoin }: GameCardProps) {
  const spotsLeft = game.playersNeeded - game.playersJoined;
  const isFull = spotsLeft <= 0;
  const fillPercent = Math.min(100, Math.round((game.playersJoined / game.playersNeeded) * 100));

  let formattedDate = game.date;
  try {
    formattedDate = format(parseISO(game.date), 'd MMMM yyyy', { locale: pl });
  } catch {
    // keep raw string if parsing fails
  }

  return (
    <Card
      className="hover:shadow-md transition-shadow"
      header={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl" role="img" aria-label={game.sport}>
              {SPORT_EMOJI[game.sport] ?? '🏅'}
            </span>
            <div>
              <span className="font-semibold text-gray-900 capitalize">{game.sport}</span>
              <span
                className={clsx(
                  'ml-2 text-xs px-2 py-0.5 rounded-full font-medium',
                  isFull
                    ? 'bg-red-50 text-red-600'
                    : spotsLeft <= 2
                      ? 'bg-yellow-50 text-yellow-700'
                      : 'bg-green-50 text-green-700',
                )}
              >
                {isFull ? 'Komplet' : `Wolne: ${spotsLeft} miejsc`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <User className="w-3 h-3" />
            {game.author}
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Field name */}
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
          <span>{game.fieldName}</span>
        </div>

        {/* Date & time */}
        <div className="flex gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>{game.time}</span>
          </div>
        </div>

        {/* Players progress */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              Gracze
            </span>
            <span>
              {game.playersJoined} / {game.playersNeeded}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                isFull ? 'bg-red-400' : fillPercent >= 75 ? 'bg-yellow-400' : 'bg-primary-500',
              )}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>

        {/* Description */}
        {game.description && (
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">
            {game.description}
          </p>
        )}

        {/* Action */}
        <div className="pt-1">
          <Button
            variant={isFull ? 'outline' : 'primary'}
            size="sm"
            disabled={isFull}
            onClick={() => onJoin?.(game.id)}
            className="w-full"
          >
            {isFull ? 'Brak miejsc' : 'Dołącz do gry'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
