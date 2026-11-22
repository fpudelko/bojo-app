'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Plus } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { getTurniejePubliczne, getMojeTurniejeZRola, getWszystkieTurnieje, type RolaWTurnieju } from '@/lib/turnieje';
import KartaTurnieju from '@/components/turnieje/KartaTurnieju';
import { useAdmin } from '@/lib/admin';
import type { Turniej } from '@/types';

// „Wszystkie” tylko dla admina (2026-11-22, prośba właściciela): także
// szkice, prywatne, odwołane i próby, czyli turnieje, których nie ma na
// żadnej publicznej liście, a admin prowadzi je za organizatorów.
type Karta = 'wszystkie' | 'moje' | 'zapisy' | 'trwaja' | 'zakonczone';

const ETYKIETY: Record<Karta, string> = {
  wszystkie: 'Wszystkie',
  // „Moje”, nie „Biorę udział”: od 184 są tu też obserwowane (2026-11-22).
  moje: 'Moje',
  zapisy: 'Zapisy',
  // Nie czasownik, tylko przymiotnik: obok stoi plakietka o trwających
  // zapisach i dwa czasowniki obok siebie czytały się jak jedno zdanie.
  trwaja: 'Trwające',
  zakonczone: 'Zakończone',
};

const PUSTE: Record<Karta, string> = {
  wszystkie: 'W bazie nie ma jeszcze żadnego turnieju.',
  moje: 'Nie masz jeszcze turniejów. Dołącz do drużyny z linku od kapitana albo kliknij „Obserwuj turniej” na stronie turnieju.',
  zapisy: 'Żaden turniej nie przyjmuje teraz zgłoszeń.',
  trwaja: 'Nic się teraz nie rozgrywa.',
  zakonczone: 'Żaden turniej jeszcze się nie zakończył.',
};

// Pusty stan jest ekranem, nie awarią: ma mówić, co zrobić dalej. Kapitan
// przychodzi tu raz, z pytaniem „gdzie mogę zgłosić ósemkę", i do tej pory
// wychodził bez odpowiedzi i bez śladu po sobie. Zgłoszone z audytu UX.
const AKCJA_PUSTEGO: Partial<Record<Karta, { tekst: string; href: string }>> = {
  zapisy: { tekst: 'Utwórz własny turniej', href: '/turnieje/nowe' },
  trwaja: { tekst: 'Utwórz własny turniej', href: '/turnieje/nowe' },
};

export default function TurniejeClient() {
  const { user } = useAuth();
  const jestAdmin = useAdmin();
  const [publiczne, setPubliczne] = useState<Turniej[]>([]);
  const [wszystkie, setWszystkie] = useState<Turniej[]>([]);
  const [moje, setMoje] = useState<Turniej[]>([]);
  const [role, setRole] = useState<Map<string, RolaWTurnieju>>(new Map());
  const [ladowanie, setLadowanie] = useState(true);
  // `null` = użytkownik jeszcze nie wybrał, więc obowiązuje karta domyślna
  // liczona z danych. Zwykły `useState('moje')` pokazałby pustą kartę każdemu,
  // kto w niczym nie gra — czyli większości wchodzących.
  const [wybrana, setWybrana] = useState<Karta | null>(null);

  useEffect(() => {
    let aktualne = true;
    Promise.all([
      getTurniejePubliczne(),
      user ? getMojeTurniejeZRola(user.id) : Promise.resolve([]),
    ])
      .then(([pub, mine]) => {
        if (!aktualne) return;
        setPubliczne(pub);
        setMoje(mine.map((m) => m.turniej));
        setRole(new Map(mine.map((m) => [m.turniej.id, m.rola])));
      })
      .catch(() => { if (aktualne) { setPubliczne([]); setMoje([]); } })
      .finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
  }, [user]);

  useEffect(() => {
    if (!jestAdmin) { setWszystkie([]); return; }
    let aktualne = true;
    getWszystkieTurnieje()
      .then((lista) => { if (aktualne) setWszystkie(lista); })
      .catch(() => { if (aktualne) setWszystkie([]); });
    return () => { aktualne = false; };
  }, [jestAdmin]);

  // „Zamknięte zapisy" idą do TRWAJĄCYCH, nie do zapisów: wejść się już nie da,
  // a turniej dzieje się lada chwila. Karta „Zapisy" ma zawierać wyłącznie to,
  // do czego da się dopisać drużynę — inaczej kliknięcie kończy się ślepą uliczką.
  const zawartosc: Record<Karta, Turniej[]> = {
    wszystkie,
    moje,
    zapisy: publiczne.filter((t) => t.status === 'zapisy'),
    trwaja: publiczne.filter((t) => t.status === 'trwa' || t.status === 'zamkniete_zapisy'),
    zakonczone: publiczne.filter((t) => t.status === 'zakonczony'),
  };

  // Kolejność kart jest kolejnością pytań, z którymi się tu wchodzi: najpierw
  // „co z moimi", potem „gdzie mogę wejść", potem „co się dzieje".
  const karty: Karta[] = jestAdmin
    ? ['wszystkie', 'moje', 'zapisy', 'trwaja', 'zakonczone']
    : user ? ['moje', 'zapisy', 'trwaja', 'zakonczone'] : ['zapisy', 'trwaja', 'zakonczone'];
  const domyslna: Karta = karty.find((k) => zawartosc[k].length > 0) ?? (user ? 'moje' : 'zapisy');
  const aktywna: Karta = wybrana && karty.includes(wybrana) ? wybrana : domyslna;
  const widoczne = zawartosc[aktywna];
  const pustoWszedzie = karty.every((k) => zawartosc[k].length === 0);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header showMobileWordmark />
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
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm text-slate-400">{PUSTE[aktywna]}</p>
                {AKCJA_PUSTEGO[aktywna] && (
                  <Link href={AKCJA_PUSTEGO[aktywna]!.href}>
                    <Button size="sm" variant="outline">{AKCJA_PUSTEGO[aktywna]!.tekst}</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {widoczne.map((t) => <KartaTurnieju key={t.id} t={t} rola={aktywna === 'moje' ? role.get(t.id) : undefined} />)}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
