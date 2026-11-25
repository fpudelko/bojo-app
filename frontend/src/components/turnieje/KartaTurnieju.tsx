'use client';

// Karta turnieju na listach: `/turnieje` i sekcja „Twoje turnieje” na
// `/moje-gry` (od 2026-11-22). `rola` dopisuje, skąd turniej jest „mój”.
import Link from 'next/link';
import { CalendarDays, MapPin } from 'lucide-react';
import { czyTurniejProbny, type RolaWTurnieju } from '@/lib/turnieje';
import { stanTurnieju, etykietaTerminu } from '@/lib/turniejEtykiety';
import { sportEmoji } from '@/lib/sports';
import type { Turniej } from '@/types';

export const ETYKIETA_ROLI: Record<RolaWTurnieju, string> = {
  organizujesz: 'Organizujesz',
  wspolorganizujesz: 'Współorganizujesz',
  prowadzisz: 'Prowadzisz mecze',
  grasz: 'Grasz w drużynie',
  obserwujesz: 'Obserwujesz',
};

export default function KartaTurnieju({ t, rola }: { t: Turniej; rola?: RolaWTurnieju }) {
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
          {rola && (
            <p className="mt-1.5 text-xs font-semibold text-primary-700 dark:text-primary-400">{ETYKIETA_ROLI[rola]}</p>
          )}
          {/* PRÓBA WPROST NA LIŚCIE (uwaga właściciela 2026-11-22): w „Wszystkie”
              pojawiał się turniej „Próba: …” i nie było wiadomo, skąd się wziął. */}
          {czyTurniejProbny(t) && (
            <p className="mt-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <span className="font-semibold">Kopia do ćwiczeń.</span> Powstała z przycisku „Przetestuj” w panelu
              prawdziwego turnieju. Nikt jej nie widzi. Usuniesz ją w panelu: „Zakończ próbę”.
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

