'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Pencil } from 'lucide-react';
import type { WierszPodsumowania } from '@/lib/eventSummary';

/**
 * Karta „Tak zobaczą to gracze" na ostatnim kroku kreatora.
 *
 * Czysto prezentacyjna — całe składanie wierszy robi `zbudujPodsumowanie`
 * w `lib/eventSummary.ts`. Powód, dla którego ta karta w ogóle istnieje:
 * przycisk „Opublikuj mecz" stoi na kroku 3, a data, miejsce i cena były
 * ustawiane na krokach 1–2 i w momencie publikacji nie były widoczne.
 *
 * Układ mobile-first: jedna kolumna od 320 px, rozjazd dopiero od `sm:`.
 */
interface Props {
  wiersze: WierszPodsumowania[];
  /** Skok na wskazany krok — przekazywany `attemptGoToStep` z kreatora.
   *  Cofanie nigdy nie waliduje, więc jest bezpieczne z każdego wiersza. */
  naKrok: (krok: number) => void;
  /** Nazwa, pod którą organizator pokaże się graczom. */
  nazwaOrganizatora: string;
  /** Czy konto nie ma jeszcze żadnej nazwy własnej — wtedy pole startuje
   *  otwarte, bo pokazywana nazwa pochodzi z adresu e-mail. */
  brakujeNazwy: boolean;
  onZmienNazwe: (nazwa: string) => Promise<void>;
}

export default function PodsumowanieMeczu({
  wiersze, naKrok, nazwaOrganizatora, brakujeNazwy, onZmienNazwe,
}: Props) {
  const [edytujeNazwe, setEdytujeNazwe] = useState(brakujeNazwy);
  const [nazwa, setNazwa] = useState(nazwaOrganizatora);
  const [zapisuje, setZapisuje] = useState(false);
  const [zapisano, setZapisano] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  const zapiszNazwe = async () => {
    const wartosc = nazwa.trim();
    if (!wartosc) { setBlad('Podaj nazwę, pod którą mają Cię widzieć gracze.'); return; }
    setZapisuje(true);
    setBlad(null);
    try {
      await onZmienNazwe(wartosc);
      setZapisano(true);
      setEdytujeNazwe(false);
    } catch (e) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się zapisać nazwy.');
    } finally {
      setZapisuje(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
      <h2 className="text-sm font-semibold text-ink">Tak zobaczą to gracze</h2>

      <dl className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {wiersze.map((w) => (
          <div key={w.klucz} className="flex items-start gap-3 py-2.5">
            <dt className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:w-24">
              {w.etykieta}
            </dt>
            {/* min-w-0 jest konieczne: bez niego długi adres rozpycha wiersz
                w bok zamiast się złamać (pułapka opisana w AGENTS.md). */}
            <dd className="min-w-0 flex-1 text-sm text-slate-900 dark:text-slate-100">
              <span className="break-words">{w.wartosc}</span>
              {w.ostrzezenie && (
                <span className="mt-1 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-500">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">{w.ostrzezenie}</span>
                </span>
              )}
            </dd>
            <button
              type="button"
              onClick={() => naKrok(w.krok)}
              className="shrink-0 rounded-lg px-1.5 py-0.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-slate-800"
            >
              Zmień<span className="sr-only"> — {w.etykieta}</span>
            </button>
          </div>
        ))}

        {/* Organizator — osobno, bo to jedyny wiersz z mutacją, a nie z danymi
            formularza. Bez tego mecz potrafił się opublikować pod nazwą
            wyprowadzoną z adresu e-mail, a organizator dowiadywał się o tym
            dopiero z gotowej strony meczu. */}
        <div className="flex items-start gap-3 py-2.5">
          <dt className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:w-24">
            Organizator
          </dt>
          <dd className="min-w-0 flex-1 text-sm text-slate-900 dark:text-slate-100">
            {edytujeNazwe ? (
              <div>
                <input
                  type="text"
                  value={nazwa}
                  onChange={(e) => { setNazwa(e.target.value); setBlad(null); }}
                  placeholder="Imię i nazwisko"
                  autoComplete="name"
                  maxLength={40}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={zapiszNazwe}
                    disabled={zapisuje}
                    className="rounded-lg bg-primary-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
                  >
                    {zapisuje ? 'Zapisuję…' : 'Zapisz'}
                  </button>
                  {!brakujeNazwy && (
                    <button
                      type="button"
                      onClick={() => { setEdytujeNazwe(false); setNazwa(nazwaOrganizatora); setBlad(null); }}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                      Anuluj
                    </button>
                  )}
                </div>
                {blad && <p className="mt-1 text-xs font-medium text-red-600">{blad}</p>}
                {brakujeNazwy && !blad && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
                    Uzupełnij, żeby gracze wiedzieli, kto organizuje mecz.
                  </p>
                )}
              </div>
            ) : (
              <span className="flex items-center gap-1.5 break-words">
                {nazwa}
                {zapisano && <Check className="h-3.5 w-3.5 shrink-0 text-primary-700" aria-hidden="true" />}
              </span>
            )}
          </dd>
          {!edytujeNazwe && (
            <button
              type="button"
              onClick={() => setEdytujeNazwe(true)}
              className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-slate-800"
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
              Zmień<span className="sr-only"> nazwę organizatora</span>
            </button>
          )}
        </div>
      </dl>
    </section>
  );
}
