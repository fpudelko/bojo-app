'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, ChevronDown, Loader2, Smartphone } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  probnePowiadomienie, stanPush, widziDiagnostyke, wlaczPush, wylaczPush, type StanPush,
} from '@/lib/push';
import {
  RODZAJE_POWIADOMIEN, pobierzWylaczone, przelacz as przelaczNaLiscie, zapiszWylaczone,
} from '@/lib/ustawieniaPowiadomien';

/**
 * Przełącznik powiadomień na telefon.
 *
 * KAŻDY STAN MÓWI, CO ZROBIĆ — albo nie renderuje się wcale. To jest cała
 * trudność tego elementu: „powiadomienia niedostępne" bez powodu i bez wyjścia
 * jest gorsze niż brak przełącznika, bo zostawia człowieka z poczuciem, że coś
 * jest zepsute u niego.
 *
 *   wymaga-instalacji → iPhone w Safari: push zadziała dopiero po dodaniu Bojo
 *                       do ekranu głównego. Mówimy to wprost, bo inaczej
 *                       jedyną informacją byłoby „nie działa".
 *   zablokowane       → odmowa jest trwała i NIE da się jej cofnąć ze strony;
 *                       jedyna droga to ustawienia przeglądarki.
 *   nieobslugiwane    → nic nie renderujemy. Nie ma czego zaproponować.
 */
export default function PowiadomieniaPush() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stan, setStan] = useState<StanPush | null>(null);
  const [busy, setBusy] = useState(false);
  // Lista rodzajów jest ZWINIĘTA. Dziesięć przełączników rozwiniętych na
  // dzień dobry robi z prostego „włącz powiadomienia" ekran konfiguracji,
  // przez który trzeba się przebić — a domyślne ustawienie (wszystko
  // włączone) jest dobre dla większości.
  const [rozwiniete, setRozwiniete] = useState(false);
  const [wylaczone, setWylaczone] = useState<string[] | null>(null);

  const odswiez = useCallback(() => { stanPush().then(setStan).catch(() => setStan('nieobslugiwane')); }, []);
  useEffect(() => { odswiez(); }, [odswiez]);

  // Ustawienia wczytujemy dopiero przy rozwinięciu: przy zwiniętej liście
  // to zapytanie do bazy, którego wynik i tak nie byłby widoczny.
  useEffect(() => {
    if (!rozwiniete || !user || wylaczone !== null) return;
    pobierzWylaczone(user.id)
      .then(setWylaczone)
      .catch(() => setWylaczone([]));
  }, [rozwiniete, user, wylaczone]);

  if (!user || stan === null || stan === 'nieobslugiwane') return null;

  const przelacz = async () => {
    setBusy(true);
    try {
      if (stan === 'wlaczone') {
        await wylaczPush(user.id);
        toast('Powiadomienia wyłączone');
      } else {
        await wlaczPush(user.id);
        toast('Powiadomienia włączone — damy znać o meczach');
      }
      odswiez();
    } catch (blad) {
      toast(blad instanceof Error ? blad.message : 'Nie udało się zmienić ustawienia', 'error');
      odswiez();
    } finally {
      setBusy(false);
    }
  };

  const przelaczRodzaj = async (typ: string, wlaczyc: boolean) => {
    if (!wylaczone) return;
    const nowe = przelaczNaLiscie(wylaczone, typ, wlaczyc);
    const poprzednie = wylaczone;
    setWylaczone(nowe);   // od razu w widoku — przełącznik ma reagować pod palcem
    try {
      await zapiszWylaczone(user.id, nowe);
    } catch (blad) {
      setWylaczone(poprzednie);
      toast(blad instanceof Error ? blad.message : 'Nie udało się zapisać ustawienia', 'error');
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700 dark:bg-primary-950/40">
          {stan === 'wlaczone' ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Powiadomienia na telefon</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {stan === 'wlaczone'
              ? 'Dostajesz powiadomienie, gdy ekipa zakłada mecz, ktoś pisze albo zwalnia się miejsce.'
              : stan === 'wymaga-instalacji'
                ? 'Na iPhonie działają dopiero po dodaniu Bojo do ekranu głównego: Udostępnij → „Dodaj do ekranu początkowego".'
                : stan === 'zablokowane'
                  ? 'Powiadomienia są zablokowane w ustawieniach przeglądarki — tylko tam da się to cofnąć.'
                  : 'Nowy mecz ekipy, wiadomość w rozmowie, zwolnione miejsce — bez zaglądania do aplikacji.'}
          </p>

          {stan === 'wymaga-instalacji' && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-700/50">
              <Smartphone className="h-3 w-3" /> Wróć tutaj po dodaniu do ekranu głównego
            </p>
          )}
        </div>

        {(stan === 'wlaczone' || stan === 'wylaczone') && (
          <button
            type="button"
            onClick={przelacz}
            disabled={busy}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${
              stan === 'wlaczone'
                ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                : 'bg-primary-700 text-white hover:bg-primary-800'
            }`}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {stan === 'wlaczone' ? 'Wyłącz' : 'Włącz'}
          </button>
        )}
      </div>

      {/* Próba na żądanie — gdy „nie przychodzą", to jedno kliknięcie mówi,
          po której stronie szukać: telefonu czy drogi do niego. */}
      {stan === 'wlaczone' && widziDiagnostyke(user.email) && (
        <button
          type="button"
          onClick={async () => {
            try {
              await probnePowiadomienie();
              toast('Wysłane — powinno pojawić się za chwilę');
            } catch (blad) {
              toast(blad instanceof Error ? blad.message : 'Nie udało się wysłać próbnego', 'error');
            }
          }}
          className="mt-3 text-xs font-medium text-primary-700 underline underline-offset-2"
        >
          Wyślij próbne powiadomienie
        </button>
      )}

      {/* Lista rodzajów pojawia się WYŁĄCZNIE przy włączonych powiadomieniach.
          Przy wyłączonych byłaby ustawianiem czegoś, co i tak nie przyjdzie —
          czyli pracą bez skutku. */}
      {stan === 'wlaczone' && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setRozwiniete((v) => !v)}
            aria-expanded={rozwiniete}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              O czym powiadamiać
              {wylaczone && wylaczone.length > 0 && (
                <span className="ml-1.5 text-xs text-slate-400">
                  · {wylaczone.length} wyłączonych
                </span>
              )}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${rozwiniete ? 'rotate-180' : ''}`}
            />
          </button>

          {rozwiniete && (
            wylaczone === null ? (
              <div className="flex justify-center py-4 text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <ul className="mt-2 space-y-0.5">
                {RODZAJE_POWIADOMIEN.map((r) => {
                  const wlaczony = !wylaczone.includes(r.typ);
                  return (
                    <li key={r.typ}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-700/40">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink">
                            {r.nazwa}
                            {/* „Ważne" nie blokuje wyłączenia — tylko mówi, co
                                się traci. Ostrzeżenie zamiast zakazu: to jest
                                telefon użytkownika, nie nasz. */}
                            {r.wazne && (
                              <span className="ml-1.5 align-middle text-[10px] font-bold uppercase tracking-wide text-amber-600">
                                ważne
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                            {r.opis}
                          </span>
                        </span>

                        {/* Przełącznik, nie checkbox: „włączone/wyłączone" to
                            stan, a nie zaznaczenie pozycji na liście. */}
                        <span className="relative mt-0.5 shrink-0">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={wlaczony}
                            onChange={(e) => przelaczRodzaj(r.typ, e.target.checked)}
                          />
                          <span className="block h-6 w-10 rounded-full bg-slate-200 transition peer-checked:bg-primary-600 dark:bg-slate-600" />
                          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  );
}
