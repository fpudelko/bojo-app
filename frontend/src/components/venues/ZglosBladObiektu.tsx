'use client';

import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { useToast } from '@/lib/toast';
import { POWODY_OBIEKTU, zglosBladObiektu, type PowodObiektu } from '@/lib/bledy';

/**
 * „Coś się tu nie zgadza" na stronie obiektu.
 *
 * DLACZEGO OSOBNO OD ZGŁOSZENIA BŁĘDU W APLIKACJI: to są dwie różne rzeczy
 * z dwoma różnymi odbiorcami. Błąd aplikacji naprawiamy my w kodzie; błąd
 * w danych obiektu dotyczy katalogu pochodzącego z OpenStreetMap, którego
 * NIE jesteśmy właścicielem.
 *
 * Dlatego są tu DWIE drogi i obie mają sens:
 *  - ten formularz — trafia do nas, bo tylko my możemy zdjąć obiekt z mapy
 *    albo go ukryć („tego obiektu tu nie ma"),
 *  - odnośnik „Zgłoś poprawkę" pod spodem (już istniał) — otwiera notatkę
 *    w OSM, czyli naprawia dane U ŹRÓDŁA, z pożytkiem dla wszystkich.
 *
 * Zgłoszenie świadomie NICZEGO nie zmienia automatycznie: jedno kliknięcie
 * kogoś złośliwego nie może wywrócić katalogu.
 */
export default function ZglosBladObiektu({ fieldId }: { fieldId: string }) {
  const { toast } = useToast();
  const [otwarte, setOtwarte] = useState(false);
  const [powod, setPowod] = useState<PowodObiektu | null>(null);
  const [komentarz, setKomentarz] = useState('');
  const [wysylanie, setWysylanie] = useState(false);

  const wyslij = async () => {
    if (!powod) return;
    setWysylanie(true);
    try {
      await zglosBladObiektu(fieldId, powod, komentarz);
      toast('Dzięki — sprawdzimy to');
      setOtwarte(false);
      setPowod(null);
      setKomentarz('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wysłać zgłoszenia', 'error');
    } finally {
      setWysylanie(false);
    }
  };

  if (!otwarte) {
    return (
      <button
        type="button"
        onClick={() => setOtwarte(true)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 underline underline-offset-2 transition hover:text-slate-600"
      >
        <Flag className="h-3 w-3" /> Zgłoś błąd w danych
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm font-semibold text-ink">Co się nie zgadza?</p>

      <div className="mt-3 space-y-1.5">
        {POWODY_OBIEKTU.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPowod(p)}
            className={`block w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
              powod === p
                ? 'border-primary-600 bg-primary-50 font-semibold text-primary-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <textarea
        value={komentarz}
        onChange={(e) => setKomentarz(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Chcesz coś dodać? (opcjonalnie)"
        className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => { setOtwarte(false); setPowod(null); }}
          className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Anuluj
        </button>
        <button
          type="button"
          onClick={wyslij}
          disabled={!powod || wysylanie}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-700 py-2 text-sm font-semibold text-white transition hover:bg-primary-800 disabled:opacity-50"
        >
          {wysylanie && <Loader2 className="h-4 w-4 animate-spin" />}
          Wyślij
        </button>
      </div>
    </div>
  );
}
