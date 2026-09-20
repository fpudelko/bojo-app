'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Loader2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { SHOW_GAME_ALERTS } from '@/lib/features';
import {
  getMojeAlerty, ustawAktywnoscAlertu, deleteMyAlert, nazwaAlertu, opisAlertu,
} from '@/lib/alerts';
import { sportEmoji } from '@/lib/sports';
import AlertSetupDialog from '@/components/home/AlertSetupDialog';
import type { GameAlert } from '@/types';

/**
 * ALERTY MAJĄ DOM — 2026-09-15.
 *
 * Do tej pory alert nie istniał w żadnych ustawieniach. Żeby go zobaczyć albo
 * wyłączyć, trzeba było natknąć się na jedno z wejść w `/mapa` lub
 * `/wydarzenia` — czyli wejść do WYSZUKIWARKI MECZÓW, żeby wyłączyć
 * powiadomienie. Odkąd alert jest domyślnie bezterminowy (migracja `149`), to
 * przestało być niedogodnością i zaczęło być tą samą drogą do „Zgłoś spam",
 * przed którą broni się `UstawieniaMaili` obok.
 *
 * Karta stoi pod kotwicą `#powiadomienia`, razem z pushem i pocztą, bo to
 * JEDNO miejsce, którego człowiek szuka, gdy chce coś wyciszyć.
 *
 * ROZWINIĘTA OD RAZU, w kontrze do `UstawieniaMaili`. Tamta karta chowa listę
 * dwudziestu kilku rodzajów, których nikt nie przegląda bez powodu; tu wierszy
 * jest tyle, ile ktoś sam założył — zwykle zero albo dwa — a sama liczba jest
 * odpowiedzią na pytanie, z którym się tu przychodzi.
 */
export default function MojeAlerty() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [alerty, setAlerty] = useState<GameAlert[] | null>(null);
  const [okno, setOkno] = useState<{ alert?: GameAlert } | null>(null);
  // Ten sam wzorzec co w `UstawieniaMaili`: bez tego nieudane pobranie robi
  // pętlę żądań, bo `toast` wywołuje re-render, a efekt startuje od nowa.
  const proba = useRef(false);

  const wczytaj = useCallback(async () => {
    try {
      setAlerty(await getMojeAlerty());
    } catch {
      setAlerty([]);
      toast('Nie udało się wczytać alertów', 'error');
    }
  }, [toast]);

  useEffect(() => {
    if (!user || proba.current) return;
    proba.current = true;
    wczytaj();
  }, [user, wczytaj]);

  const przelacz = async (a: GameAlert, aktywny: boolean) => {
    // Optymistycznie — przełącznik ma reagować od razu, tak samo jak przy
    // rodzajach maili. Przy błędzie wracamy do stanu sprzed dotknięcia.
    setAlerty((prev) => prev?.map((x) => (x.id === a.id ? { ...x, isActive: aktywny } : x)) ?? null);
    try {
      await ustawAktywnoscAlertu(a.id, aktywny);
    } catch {
      setAlerty((prev) => prev?.map((x) => (x.id === a.id ? { ...x, isActive: !aktywny } : x)) ?? null);
      toast('Nie udało się zapisać ustawienia', 'error');
    }
  };

  const usun = async (a: GameAlert) => {
    const poprzednie = alerty;
    setAlerty((prev) => prev?.filter((x) => x.id !== a.id) ?? null);
    try {
      await deleteMyAlert(a.id);
      toast('Alert usunięty');
    } catch {
      setAlerty(poprzednie);
      toast('Nie udało się usunąć alertu', 'error');
    }
  };

  if (!user || !SHOW_GAME_ALERTS) return null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Alerty o nowych meczach</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Damy znać, gdy w Twojej okolicy pojawi się mecz, którego szukasz
          </p>
        </div>
      </div>

      {alerty === null ? (
        <div className="flex justify-center py-4 text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <>
          {alerty.length > 0 && (
            <ul className="mt-3 space-y-0.5 border-t border-slate-100 pt-2 dark:border-slate-700">
              {alerty.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-xl px-1 py-2">
                  {/* Cały wiersz otwiera edycję — nazwa i opis są jedyną
                      różnicą między alertami, więc to one muszą być celem
                      dotyku, a nie osobna ikonka ołówka obok. */}
                  <button
                    type="button"
                    onClick={() => setOkno({ alert: a })}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <span aria-hidden className="text-lg leading-none">
                      {/* Emoji tylko przy JEDNYM sporcie. Przy dwóch pierwsze
                          z nich kłamałoby o drugim, a sklejanie kilku emoji
                          w jednej linii rozpycha wiersz i przestaje się czytać
                          — stadion znaczy tu „więcej niż jeden sport albo
                          dowolny", a dokładną listę niesie nazwa obok. */}
                      {a.sports.length === 1 ? sportEmoji(a.sports[0]) : '🏟️'}
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-medium ${a.isActive ? 'text-ink' : 'text-slate-400'}`}>
                        {nazwaAlertu(a)}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                        {a.isActive ? opisAlertu(a) : 'wyłączony'}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => usun(a)}
                    aria-label={`Usuń alert: ${nazwaAlertu(a)}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-50 hover:text-red-500 dark:hover:bg-slate-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  {/* Wyłączenie ZOSTAWIA wiersz — to samo, co robi link „nie
                      chcę więcej" z maila, tylko z drugiej strony. Kto wyłączył
                      alert na zimę, wraca do niego wiosną jednym dotknięciem. */}
                  <span className="relative shrink-0">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={a.isActive}
                      aria-label={`Alert ${nazwaAlertu(a)}: ${a.isActive ? 'włączony' : 'wyłączony'}`}
                      onChange={(e) => przelacz(a, e.target.checked)}
                    />
                    <span className="block h-6 w-10 rounded-full bg-slate-200 transition peer-checked:bg-primary-600 dark:bg-slate-600" />
                    <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                  </span>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setOkno({})}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-700 dark:border-slate-600 dark:text-slate-300"
          >
            <Plus className="h-4 w-4" />
            {alerty.length === 0 ? 'Ustaw pierwszy alert' : 'Dodaj alert'}
          </button>
        </>
      )}

      {okno && (
        <AlertSetupDialog
          alert={okno.alert}
          onClose={() => setOkno(null)}
          onSaved={() => { setOkno(null); wczytaj(); }}
        />
      )}
    </div>
  );
}
