import type { Metadata } from 'next';
import Link from 'next/link';
import StronaTresci from '@/components/tresc/StronaTresci';
import SpisTresci from '@/components/tresc/SpisTresci';
import SekcjaTresci from '@/components/tresc/SekcjaTresci';
import { JAK_DZIALA } from '@/content/jakDziala';

export const metadata: Metadata = {
  title: 'Jak działa Bojo',
  description:
    'Od kreatora meczu po rozliczenie po grze: co dokładnie robi organizator, co widzi ' +
    'zaproszony gracz i czy dołączenie do meczu wymaga konta.',
  alternates: { canonical: '/jak-dziala-bojo' },
};

export default function JakDzialaBojoPage() {
  return (
    <StronaTresci
      nadtytul="Jak działa Bojo"
      h1="Jak działa Bojo — od pomysłu na mecz do rozliczenia"
      lead="Krok po kroku, bez niedomówień: co ustawiasz, co widzi zaproszony i co Bojo robi samo."
      tytulDlaOkruszkow="Jak działa Bojo"
    >
      <SpisTresci pozycje={JAK_DZIALA.map((s) => ({ id: s.id, label: s.label }))} />

      {JAK_DZIALA.map((sekcja) => (
        <SekcjaTresci key={sekcja.id} id={sekcja.id} tytul={sekcja.tytul}>
          {sekcja.id === 'co-widza-gracze' ? (
            <ol className="list-decimal space-y-2 pl-5">
              {sekcja.akapity.map((a, i) => <li key={i}>{a}</li>)}
            </ol>
          ) : (
            sekcja.akapity.map((a, i) => <p key={i}>{a}</p>)
          )}
        </SekcjaTresci>
      ))}

      <section className="rounded-2xl border border-primary-200 bg-primary-50 p-5 dark:border-primary-800 dark:bg-primary-950">
        <p className="font-display text-lg font-bold text-ink">Gotowy spróbować?</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Kreator zajmuje dwie minuty — sport, boisko z mapy, termin, liczba miejsc.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/wydarzenia/nowe"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-700 px-5 text-sm font-bold text-white transition hover:bg-primary-800 active:scale-95"
          >
            Zorganizuj mecz
          </Link>
          <Link
            href="/dlaczego-bojo"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-slate-600 dark:text-slate-300"
          >
            Dlaczego Bojo zamiast Messengera
          </Link>
          <Link
            href="/faq"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-slate-600 dark:text-slate-300"
          >
            Wszystkie pytania
          </Link>
        </div>
      </section>
    </StronaTresci>
  );
}
