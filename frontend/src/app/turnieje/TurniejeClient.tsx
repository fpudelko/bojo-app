'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Trophy, Plus, CalendarDays, MapPin } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { getTurniejePubliczne, getMojeTurnieje } from '@/lib/turnieje';
import { STATUS_TURNIEJU } from '@/lib/turniejEtykiety';
import { sportEmoji } from '@/lib/sports';
import type { Turniej } from '@/types';

function KartaTurnieju({ t }: { t: Turniej }) {
  const status = STATUS_TURNIEJU[t.status];
  let data = t.dataStartu;
  try { data = format(parseISO(t.dataStartu), 'EEEE, d MMMM', { locale: pl }); } catch { /* zostaw surową datę */ }

  return (
    <Link
      href={`/turnieje/${t.id}`}
      className="block rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-950 text-xl">
          {t.okladkaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.okladkaUrl} alt="" className="h-11 w-11 rounded-xl object-cover" />
          ) : sportEmoji(t.sport)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate font-display font-semibold text-ink">{t.nazwa}</h3>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.ton}`}>{status.label}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{data}</span>
            {t.miejsceNazwa && (
              <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{t.miejsceNazwa}</span></span>
            )}
            <span>{t.liczbaDruzyn ?? 0}/{t.maxDruzyn} drużyn</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function Sekcja({ tytul, turnieje }: { tytul: string; turnieje: Turniej[] }) {
  if (turnieje.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{tytul}</h2>
      <div className="space-y-3">
        {turnieje.map((t) => <KartaTurnieju key={t.id} t={t} />)}
      </div>
    </div>
  );
}

export default function TurniejeClient() {
  const { user, loading: authLoading } = useAuth();
  const [publiczne, setPubliczne] = useState<Turniej[]>([]);
  const [moje, setMoje] = useState<Turniej[]>([]);
  const [ladowanie, setLadowanie] = useState(true);

  useEffect(() => {
    let aktualne = true;
    Promise.all([
      getTurniejePubliczne(),
      user ? getMojeTurnieje(user.id) : Promise.resolve([]),
    ])
      .then(([pub, mine]) => { if (aktualne) { setPubliczne(pub); setMoje(mine); } })
      .catch(() => { if (aktualne) { setPubliczne([]); setMoje([]); } })
      .finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
  }, [user]);

  const idMoich = new Set(moje.map((t) => t.id));
  const trwajace = publiczne.filter((t) => t.status === 'trwa');
  const nadchodzace = publiczne.filter((t) => t.status !== 'trwa' && !idMoich.has(t.id));

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-ink">Turnieje</h1>
          {user && (
            <Link href="/turnieje/nowe">
              <Button size="sm" className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Utwórz turniej</Button>
            </Link>
          )}
        </div>

        {ladowanie ? (
          <div className="py-16 text-center text-sm text-slate-400">Ładuję…</div>
        ) : (
          <>
            <Sekcja tytul="Trwają teraz" turnieje={trwajace} />
            <Sekcja tytul="Moje turnieje" turnieje={moje} />
            <Sekcja tytul="Nadchodzące" turnieje={nadchodzace} />

            {trwajace.length === 0 && moje.length === 0 && nadchodzace.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-16 text-center">
                <Trophy className="h-8 w-8 text-slate-300" />
                {user ? (
                  <>
                    <p className="font-medium text-ink">Nie ma jeszcze żadnego turnieju</p>
                    <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
                      Organizujesz turniej? Bojo poprowadzi zapisy drużyn, terminarz i wyniki na żywo.
                    </p>
                    <Link href="/turnieje/nowe" className="mt-1"><Button size="sm">Utwórz turniej</Button></Link>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-ink">Nie ma jeszcze żadnego turnieju</p>
                    <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
                      Zaloguj się, żeby założyć własny turniej.
                    </p>
                  </>
                )}
              </div>
            )}

            {!authLoading && user && moje.length === 0 && (trwajace.length > 0 || nadchodzace.length > 0) && (
              <p className="text-center text-xs text-slate-400">
                Nie grasz jeszcze w żadnym turnieju — kapitan Twojej drużyny wyśle Ci link, gdy się zgłosicie.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
