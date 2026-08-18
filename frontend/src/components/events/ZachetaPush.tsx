'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, Loader2, Smartphone, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { czyZachetaOdlozona, odlozZachetePush, stanPush, wlaczPush, type StanPush } from '@/lib/push';

/**
 * „Damy znać, gdy coś się zmieni" — propozycja włączenia powiadomień
 * pokazywana NA STRONIE MECZU, w którym gram.
 *
 * DLACZEGO W OGÓLE: przełącznik w profilu jest jedynym wejściem, a do profilu
 * nikt nie zagląda. Funkcja, o której trzeba się dowiedzieć samemu, dla
 * większości ludzi nie istnieje — a to akurat ta funkcja, która decyduje, czy
 * Bojo dowozi informację o meczu, czy przegrywa z komunikatorem.
 *
 * DLACZEGO TUTAJ, A NIE NA STARCIE APLIKACJI. Prośba o powiadomienia „na
 * wejściu" to najkrótsza droga do trwałego „Zablokuj" — a tej odmowy NIE DA
 * SIĘ cofnąć ze strony, trzeba grzebać w ustawieniach przeglądarki. Na stronie
 * meczu, w którym się gra, pytanie ma oczywisty powód i widać, co się dostanie:
 * wiadomość od ekipy, zwolnione miejsce, odwołany mecz.
 *
 * SYSTEMOWE OKNO ZGODY OTWIERA SIĘ DOPIERO PO KLIKNIĘCIU „Włącz" — nigdy samo
 * z siebie (patrz zasada 2 w `lib/push.ts`). Ta karta jest zwykłą treścią
 * strony, nie prośbą przeglądarki.
 *
 * „Nie teraz" odkłada o 30 dni, nie chowa na zawsze — patrz `odlozZachetePush()`.
 */
export default function ZachetaPush({ widoczna }: {
  /** Czy w ogóle jest po co pytać — dziś: „gram w tym meczu i mecz się jeszcze
   *  nie odbył". Warunek liczy strona meczu, żeby ten komponent nie musiał
   *  znać reguł uczestnictwa. */
  widoczna: boolean;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stan, setStan] = useState<StanPush | null>(null);
  const [busy, setBusy] = useState(false);
  const [schowana, setSchowana] = useState(false);

  const odswiez = useCallback(() => {
    stanPush().then(setStan).catch(() => setStan('nieobslugiwane'));
  }, []);
  useEffect(() => { if (widoczna) odswiez(); }, [widoczna, odswiez]);

  if (!user || !widoczna || schowana || stan === null) return null;
  // Pytamy WYŁĄCZNIE wtedy, gdy da się coś włączyć. `wlaczone` — już jest,
  // `zablokowane` — odmowy nie cofniemy ze strony, `nieobslugiwane` — nie ma
  // czego proponować. Zostaje `wylaczone` oraz iOS przed instalacją, gdzie
  // zamiast przycisku pokazujemy, co zrobić.
  if (stan === 'wlaczone' || stan === 'zablokowane' || stan === 'nieobslugiwane') return null;
  if (czyZachetaOdlozona()) return null;

  const odloz = () => {
    odlozZachetePush();
    setSchowana(true);
  };

  const wlacz = async () => {
    setBusy(true);
    try {
      await wlaczPush(user.id);
      toast('Damy znać o tym meczu — powiadomienia włączone');
      setSchowana(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się włączyć powiadomień', 'error');
      odswiez();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4">
      <div className="relative rounded-2xl border border-primary-100 bg-primary-50/60 p-4 dark:border-primary-900/40 dark:bg-primary-950/20">
        <button
          type="button"
          onClick={odloz}
          aria-label="Nie teraz"
          className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 transition hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary-700 shadow-sm">
            <Bell className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Damy znać, gdy coś się zmieni</p>
            {stan === 'wymaga-instalacji' ? (
              <>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Na iPhonie powiadomienia działają po dodaniu Bojo do ekranu głównego:
                  Udostępnij → „Dodaj do ekranu początkowego".
                </p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11px] font-medium text-slate-500">
                  <Smartphone className="h-3 w-3" /> Wróć tutaj po dodaniu
                </p>
              </>
            ) : (
              <>
                {/* Konkret, nie „włącz powiadomienia": trzy rzeczy, które
                    naprawdę przychodzą i których nie chce się przegapić. */}
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Ktoś napisze do ekipy, zwolni się miejsce, mecz zostanie odwołany —
                  dostaniesz powiadomienie na telefon, bez wchodzenia do aplikacji.
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={wlacz}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-800 disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Włącz powiadomienia
                  </button>
                  <button
                    type="button"
                    onClick={odloz}
                    className="rounded-xl px-2.5 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-700"
                  >
                    Nie teraz
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
