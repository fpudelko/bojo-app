'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, Loader2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { WARSTWA } from '@/lib/warstwy';
import { useToast } from '@/lib/toast';
import { czyZachetaOdlozona, odlozZachetePush, stanPush, wlaczPush, type StanPush } from '@/lib/push';
import { zaproponujInstalacje } from '@/components/ZachetaInstalacji';

/**
 * „Damy znać, gdy coś się zmieni" — propozycja włączenia powiadomień
 * pokazywana NA STRONIE MECZU, w którym gram.
 *
 * DLACZEGO W OGÓLE: przełącznik w profilu jest jedynym wejściem, a do profilu
 * nikt nie zagląda. Funkcja, o której trzeba się dowiedzieć samemu, dla
 * większości ludzi nie istnieje — a to akurat ta funkcja, która decyduje, czy
 * Bojo dowozi informację o meczu, czy przegrywa z komunikatorem.
 *
 * NA iOS PRZED INSTALACJĄ NIE POKAZUJE SIĘ WCALE — tam sprawę przejmuje
 * `ZachetaInstalacji`, bo bez aplikacji na ekranie głównym push i tak nie
 * zadziała, a dwa paski mówiące to samo to nie jest wybór, tylko przeoczenie.
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

  // iOS przed instalacją: zamiast milczeć, prosimy o pokazanie paska
  // instalacji. Ten sam pasek pilnuje własnych reguł (raz na odrzucenie,
  // tylko gdy jest sens), więc to jest prośba, nie rozkaz.
  useEffect(() => {
    if (widoczna && stan === 'wymaga-instalacji') zaproponujInstalacje();
  }, [widoczna, stan]);

  if (!user || !widoczna || schowana || stan === null) return null;
  // Pytamy WYŁĄCZNIE wtedy, gdy da się coś włączyć. `wlaczone` — już jest,
  // `zablokowane` — odmowy nie cofniemy ze strony, `nieobslugiwane` — nie ma
  // czego proponować. Zostaje `wylaczone` oraz iOS przed instalacją, gdzie
  // zamiast przycisku pokazujemy, co zrobić.
  if (stan === 'wlaczone' || stan === 'zablokowane' || stan === 'nieobslugiwane') return null;
  if (czyZachetaOdlozona()) return null;
  // iOS przed instalacją NIE dostaje własnego kafelka. Instalacja ma już swój
  // pasek wysuwany z dołu (`ZachetaInstalacji`) — z instrukcją, ikoną i tą samą
  // treścią. Dwa różne elementy mówiące to samo w dwóch różnych językach
  // wizualnych to nie jest wybór, tylko przeoczenie.
  if (stan === 'wymaga-instalacji') return null;

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
    /* WYSUWANY PASEK, nie kafelek w treści strony.
     *
     * Poprzednia wersja stała w środku zakładki „Mecz" i wyglądała jak jedna
     * z sekcji meczu — czyli jak coś, co ma tam być na stałe, a nie jak
     * propozycja, którą można zamknąć (zgłoszone wprost: „nie wygląda jak coś
     * dodatkowego"). Ten sam język wizualny co pasek instalacji: dół ekranu,
     * cień do góry, krzyżyk po prawej, wjazd animacją.
     *
     * Nad dolną nawigacją, nie pod nią — dopełnienie liczone ze zmiennej
     * `--bottom-nav-h`, bo pasek jest `fixed` i dopełnienie strony go nie
     * dotyczy. Warstwa `zachetaInstalacji`: nad zwykłą treścią, ale POD
     * modalem, żeby nie przykryć okna, które ktoś właśnie otworzył.
     */
    <div
      className={`fixed inset-x-0 bottom-0 ${WARSTWA.zachetaInstalacji} animate-slide-up border-t border-slate-200 bg-white shadow-[0_-2px_16px_rgba(0,0,0,0.10)] dark:border-slate-700 dark:bg-slate-800`}
      style={{ paddingBottom: 'calc(var(--bottom-nav-h) + 0.5rem)' }}
      role="dialog"
      aria-label="Włącz powiadomienia"
    >
      <div className="mx-auto flex max-w-lg items-start gap-3 px-4 py-3.5">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/40">
          <Bell className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink dark:text-slate-100">
            Damy znać, gdy coś się zmieni
          </p>
          {/* Konkret, nie „włącz powiadomienia": trzy rzeczy, które naprawdę
              przychodzą i których nie chce się przegapić. */}
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Ktoś napisze do ekipy, zwolni się miejsce, mecz zostanie odwołany.
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={wlacz}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-800 active:scale-95 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Włącz powiadomienia
            </button>
            <button
              type="button"
              onClick={odloz}
              className="rounded-xl px-2.5 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400"
            >
              Nie teraz
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={odloz}
          aria-label="Nie teraz"
          className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
