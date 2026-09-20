'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Plus, CalendarDays, MapPin } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { getTurniejePubliczne, getMojeTurnieje } from '@/lib/turnieje';
import { stanTurnieju, etykietaTerminu } from '@/lib/turniejEtykiety';
import { sportEmoji } from '@/lib/sports';
import type { Turniej } from '@/types';

function KartaTurnieju({ t }: { t: Turniej }) {
  // Stan liczony z terminarza. Lista pokazywała CZTERY turnieje z identyczną
  // plakietką „Trwa" — w tym jeden sprzed tygodnia i jeden, w którym został
  // sam finał. Karta bez meczów (lista ich nie pobiera) dostaje to, co da się
  // powiedzieć z samej kolumny; szczegół dokłada strona turnieju.
  const stan = stanTurnieju(t, []);

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
          <div className="flex items-start gap-2">
            {/* Dwie linijki, nie `truncate`: nazwy turniejów bywają długie
                („Liga Koszykarska — 3 z 5 kolejek") i ucięte w połowie nie
                mówią, o który turniej chodzi. */}
            <h3 className="min-w-0 flex-1 font-display font-semibold text-ink line-clamp-2">{t.nazwa}</h3>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${stan.ton}`}>{stan.label}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />{etykietaTerminu(t.dataStartu, t.godzinaStartu)}
            </span>
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

type Karta = 'moje' | 'zapisy' | 'trwaja' | 'zakonczone';

const ETYKIETY: Record<Karta, string> = {
  moje: 'Biorę udział',
  zapisy: 'Zapisy',
  // Nie czasownik, tylko przymiotnik: obok stoi plakietka o trwających
  // zapisach i dwa czasowniki obok siebie czytały się jak jedno zdanie.
  trwaja: 'Trwające',
  zakonczone: 'Zakończone',
};

const PUSTE: Record<Karta, string> = {
  moje: 'Nie grasz jeszcze w żadnym turnieju, kapitan Twojej drużyny wyśle Ci link, gdy się zgłosicie.',
  zapisy: 'Żaden turniej nie przyjmuje teraz zgłoszeń.',
  trwaja: 'Nic się teraz nie rozgrywa.',
  zakonczone: 'Żaden turniej jeszcze się nie zakończył.',
};

export default function TurniejeClient() {
  const { user } = useAuth();
  const [publiczne, setPubliczne] = useState<Turniej[]>([]);
  const [moje, setMoje] = useState<Turniej[]>([]);
  const [ladowanie, setLadowanie] = useState(true);
  // `null` = użytkownik jeszcze nie wybrał, więc obowiązuje karta domyślna
  // liczona z danych. Zwykły `useState('moje')` pokazałby pustą kartę każdemu,
  // kto w niczym nie gra — czyli większości wchodzących.
  const [wybrana, setWybrana] = useState<Karta | null>(null);

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

  // „Zamknięte zapisy" idą do TRWAJĄCYCH, nie do zapisów: wejść się już nie da,
  // a turniej dzieje się lada chwila. Karta „Zapisy" ma zawierać wyłącznie to,
  // do czego da się dopisać drużynę — inaczej kliknięcie kończy się ślepą uliczką.
  const zawartosc: Record<Karta, Turniej[]> = {
    moje,
    zapisy: publiczne.filter((t) => t.status === 'zapisy'),
    trwaja: publiczne.filter((t) => t.status === 'trwa' || t.status === 'zamkniete_zapisy'),
    zakonczone: publiczne.filter((t) => t.status === 'zakonczony'),
  };

  // Kolejność kart jest kolejnością pytań, z którymi się tu wchodzi: najpierw
  // „co z moimi", potem „gdzie mogę wejść", potem „co się dzieje".
  const karty: Karta[] = user ? ['moje', 'zapisy', 'trwaja', 'zakonczone'] : ['zapisy', 'trwaja', 'zakonczone'];
  const domyslna: Karta = karty.find((k) => zawartosc[k].length > 0) ?? (user ? 'moje' : 'zapisy');
  const aktywna: Karta = wybrana && karty.includes(wybrana) ? wybrana : domyslna;
  const widoczne = zawartosc[aktywna];
  const pustoWszedzie = karty.every((k) => zawartosc[k].length === 0);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-ink">Turnieje</h1>
          {/* Widoczny TAKŻE bez konta — kliknięcie prowadzi przez logowanie.
              Przegląd złapał listę bez ani jednego przycisku, bo cały kreator
              wisiał za `user`: funkcja nie miała wejścia dla nikogo z ulicy. */}
          <Link href={user ? '/turnieje/nowe' : '/logowanie?next=%2Fturnieje%2Fnowe'}>
            <Button size="sm" className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Utwórz turniej</Button>
          </Link>
        </div>

        {ladowanie ? (
          <div className="py-16 text-center text-sm text-slate-400">Ładuję…</div>
        ) : pustoWszedzie ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-16 text-center">
            <Trophy className="h-8 w-8 text-slate-300" />
            <p className="font-medium text-ink">Nie ma jeszcze żadnego turnieju</p>
            {user ? (
              <>
                <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
                  Organizujesz turniej? Bojo poprowadzi zapisy drużyn, terminarz i wyniki na żywo.
                </p>
                <Link href="/turnieje/nowe" className="mt-1"><Button size="sm">Utwórz turniej</Button></Link>
              </>
            ) : (
              <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
                Zaloguj się, żeby założyć własny turniej.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
              {karty.map((k) => (
                <button
                  key={k}
                  onClick={() => setWybrana(k)}
                  className={[
                    'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    aktywna === k ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  {ETYKIETY[k]}
                  {zawartosc[k].length > 0 && (
                    <span className={aktywna === k ? 'ml-1.5 text-primary-600' : 'ml-1.5 text-slate-400'}>
                      {zawartosc[k].length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {widoczne.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">{PUSTE[aktywna]}</p>
            ) : (
              <div className="space-y-3">
                {widoczne.map((t) => <KartaTurnieju key={t.id} t={t} />)}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
