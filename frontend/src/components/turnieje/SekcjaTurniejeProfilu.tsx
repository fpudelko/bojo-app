'use client';

/**
 * Sekcja „Turnieje" na publicznym profilu gracza (`/gracz/[id]`).
 *
 * DLACZEGO ISTNIEJE. To jedyny powód, dla którego zawodnik wraca do Bojo
 * w tygodniu po turnieju. Konto założone po to, żeby zobaczyć nazwisko przy
 * golu, bez tej sekcji jest kontem założonym na jeden dzień: turniej się
 * kończy, statystyki zostają w module turniejowym, a profil gracza wygląda
 * tak, jakby ten człowiek nigdy nigdzie nie zagrał.
 *
 * OSOBNO OD „Statystyki". Liczby wyżej (`get_player_stats`) pochodzą z MECZÓW
 * i sterują odznaką rzetelnego gracza oraz paskiem frekwencji — wmieszanie
 * w nie turniejów zmieniłoby po cichu znaczenie czegoś, co ludzie już
 * widzieli.
 *
 * ZERO SEKCJI PRZY ZERO TURNIEJACH. Pusty kafelek „Turnieje: 0" na profilu
 * dziewięćdziesięciu procent graczy to szum, nie informacja.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, ChevronRight } from 'lucide-react';
import {
  getStatystykiTurniejoweGracza, getTurniejeGracza,
  type StatystykiTurniejoweGracza, type TurniejGracza,
} from '@/lib/turnieje';
import { useAuth } from '@/lib/auth';
import { sportEmoji } from '@/lib/sports';

function Kafelek({ wartosc, podpis }: { wartosc: number; podpis: string }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-700/40 px-2 py-2.5 text-center">
      <div className="font-display text-lg font-bold text-ink">{wartosc}</div>
      <div className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">{podpis}</div>
    </div>
  );
}

export default function SekcjaTurniejeProfilu({ userId }: { userId: string }) {
  const { user } = useAuth();
  const [staty, setStaty] = useState<StatystykiTurniejoweGracza | null>(null);
  const [turnieje, setTurnieje] = useState<TurniejGracza[]>([]);

  useEffect(() => {
    // Bez konta i tak wrócą zera (funkcje są `SECURITY INVOKER`, a skład stoi
    // za ścianą logowania) — nie ma po co pytać bazy.
    if (!user) { setStaty(null); setTurnieje([]); return; }
    let aktualne = true;
    Promise.allSettled([getStatystykiTurniejoweGracza(userId), getTurniejeGracza(userId, 3)])
      .then(([s, t]) => {
        if (!aktualne) return;
        setStaty(s.status === 'fulfilled' ? s.value : null);
        setTurnieje(t.status === 'fulfilled' ? t.value : []);
      });
    return () => { aktualne = false; };
  }, [userId, user]);

  if (!staty || staty.turniejow === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
        <Trophy className="h-4 w-4" /> Turnieje
      </h2>

      <div className="grid grid-cols-4 gap-2">
        <Kafelek wartosc={staty.turniejow} podpis="turnieje" />
        <Kafelek wartosc={staty.meczow} podpis="mecze" />
        <Kafelek wartosc={staty.goli} podpis="gole" />
        <Kafelek wartosc={staty.mvp} podpis="MVP" />
      </div>

      {turnieje.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
          {turnieje.map((t) => (
            <li key={t.turniejId}>
              <Link
                href={`/turnieje/${t.turniejId}`}
                className="flex items-center gap-2 rounded-xl px-1 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/40"
              >
                <span className="shrink-0 text-base">{t.wygrany ? '🥇' : sportEmoji(t.sport)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{t.nazwa}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {t.druzyna}
                    {t.meczow > 0 && ` · ${t.meczow} ${t.meczow === 1 ? 'mecz' : t.meczow < 5 ? 'mecze' : 'meczów'}`}
                    {t.goli > 0 && ` · ${t.goli} ${t.goli === 1 ? 'gol' : t.goli < 5 ? 'gole' : 'goli'}`}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
