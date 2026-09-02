'use client';

import { X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { WARSTWA } from '@/lib/warstwy';
import { useBlokadaPrzewijania } from '@/lib/blokadaPrzewijania';

/**
 * Okno potwierdzenia dla decyzji, których nie da się cofnąć jednym kliknięciem.
 *
 * PO CO ISTNIEJE. Najcięższe akcje organizatora siedziały za systemowym
 * `window.confirm()`. Trzy rzeczy były z tym nie tak naraz:
 *
 * 1. NA TELEFONIE TO NIE WYGLĄDA JAK APLIKACJA. Szare pudełko przeglądarki
 *    z „OK / Anuluj", bez marki i bez układu — a w PWA na ekranie głównym
 *    czyta się to jak błąd strony, nie jak pytanie, które ktoś świadomie zadał.
 *    Aplikacja miała już własne, porządne okna (np. „Wypisać się z meczu?"),
 *    więc połowa decyzji wyglądała inaczej niż druga połowa.
 * 2. `confirm()` MIEŚCI JEDNO ZDANIE. „Odwołać mecz? Uczestnicy zobaczą że
 *    mecz jest odwołany." nie mówiło ani tego, że wychodzą powiadomienia, ani
 *    tego, że goście bez konta ich NIE dostaną, ani tego, że odwołanie da się
 *    cofnąć. Organizator ma wiedzieć, co się stanie, ZANIM kliknie.
 * 3. NIE DA SIĘ POKAZAĆ STANU. `confirm()` blokuje wątek, więc nie ma jak
 *    zaznaczyć, że akcja trwa — a przy wolnej sieci kończy się to drugim
 *    kliknięciem w to samo.
 *
 * UKŁAD MOBILE-FIRST. Bazowo arkusz przy dolnej krawędzi (kciuk sięga tam bez
 * przekładania telefonu), od `sm:` wyśrodkowany. Żadnych `max-*` — rozszerzamy
 * wyłącznie w górę. Główna akcja jest PIERWSZA i pełnej szerokości, „Anuluj"
 * pod nią: na telefonie kolejność w pionie znaczy więcej niż lewo/prawo.
 */

export interface AkcjaDodatkowa {
  label: string;
  onClick: () => void;
}

export default function OknoPotwierdzenia({
  open,
  tytul,
  opis,
  konsekwencje,
  potwierdzLabel,
  anulujLabel = 'Anuluj',
  wariant = 'zwykly',
  busy = false,
  akcjaDodatkowa,
  onPotwierdz,
  onAnuluj,
}: {
  open: boolean;
  tytul: string;
  opis?: string;
  /** Co się STANIE po potwierdzeniu — jedna myśl na wiersz. To jest sedno tego
   *  komponentu: lista rzeczy, których `confirm()` nie mieścił. */
  konsekwencje?: string[];
  potwierdzLabel: string;
  anulujLabel?: string;
  /** `destrukcyjny` maluje główny przycisk na czerwono. Wyłącznie dla akcji,
   *  które coś kasują albo odwołują — inaczej czerwień przestaje znaczyć. */
  wariant?: 'zwykly' | 'destrukcyjny';
  busy?: boolean;
  /** Druga droga wyjścia, np. „Odwołaj i wyślij wiadomość". Renderuje się pod
   *  główną akcją, nad „Anuluj". */
  akcjaDodatkowa?: AkcjaDodatkowa;
  onPotwierdz: () => void;
  onAnuluj: () => void;
}) {
  // Hook musi lecieć bezwarunkowo — także przy zamkniętym oknie.
  useBlokadaPrzewijania(open);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 flex items-end justify-center bg-black/50 p-4 sm:items-center ${WARSTWA.modal}`}
      style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      onClick={onAnuluj}
      role="dialog"
      aria-modal="true"
      aria-label={tytul}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Jawne zamknięcie: dotknięcie tła też anuluje, ale tego nie widać,
            a sam „Anuluj" na dole czyta się jak jedyne wyjście. */}
        <button
          type="button"
          onClick={onAnuluj}
          aria-label="Zamknij"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="pr-8 font-semibold text-ink">{tytul}</h3>
        {opis && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{opis}</p>}

        {konsekwencje && konsekwencje.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {konsekwencje.map((linia) => (
              <li key={linia} className="flex gap-2">
                <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span>{linia}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 space-y-2">
          <Button
            onClick={onPotwierdz}
            isLoading={busy}
            className={`w-full${wariant === 'destrukcyjny' ? ' bg-red-600 hover:bg-red-700' : ''}`}
          >
            {potwierdzLabel}
          </Button>
          {akcjaDodatkowa && (
            <Button variant="outline" onClick={akcjaDodatkowa.onClick} disabled={busy} className="w-full">
              {akcjaDodatkowa.label}
            </Button>
          )}
          <Button variant="ghost" onClick={onAnuluj} disabled={busy} className="w-full">
            {anulujLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
