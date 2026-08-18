'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, Loader2, Smartphone } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { stanPush, wlaczPush, wylaczPush, type StanPush } from '@/lib/push';

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

  const odswiez = useCallback(() => { stanPush().then(setStan).catch(() => setStan('nieobslugiwane')); }, []);
  useEffect(() => { odswiez(); }, [odswiez]);

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
    </div>
  );
}
