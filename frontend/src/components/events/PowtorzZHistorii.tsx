'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Loader2 } from 'lucide-react';
import { repeatEvent } from '@/lib/events';
import { domyslnyTerminPowtorki } from '@/lib/recurring';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { WARSTWA } from '@/lib/warstwy';
import { useBlokadaPrzewijania } from '@/lib/blokadaPrzewijania';
import Button from '@/components/ui/Button';
import type { EventItem } from '@/types';

/**
 * „Powtórz" przy rozegranym meczu na `/moje-gry → Historia`.
 *
 * PO CO. Gry cykliczne są świadomie wyłączone (`SHOW_RECURRING`, decyzja
 * produktowa 2026-08-16), więc „Powtórz mecz" jest ich JEDYNYM zamiennikiem —
 * a żyło wyłącznie na stronie meczu i przy najbliższym meczu ekipy. Organizator
 * wracający w poniedziałek, żeby wrzucić czwartek, miał przed sobą cztery
 * kroki: Moje gry → Historia → otwórz mecz → przewiń do panelu → Powtórz.
 * Teraz jeden.
 *
 * DLACZEGO NOWY KOMPONENT, A NIE WSPÓLNY Z OKNEM NA STRONIE MECZU. Tamto okno
 * siedzi w `EventDetailClient.tsx`, który audyt ścieżki organizatora oznacza
 * jako regresyjny hot spot (trzy zabezpieczenia przed przypadkową publikacją
 * powstały po realnych awariach). Wyciąganie go stamtąd przy okazji innej
 * zmiany to dokładnie ten rodzaj refaktoru, który psuje działające rzeczy —
 * scalenie obu w jedno wejście zostaje jako osobne zadanie.
 *
 * Data wypełniona z góry (`domyslnyTerminPowtorki` — najbliższy przyszły ten
 * sam dzień tygodnia), bo pusta wywracała cały sens: dla cotygodniowej gierki
 * to były trzy zbędne kliknięcia (ustalenie `O-33`).
 */
export default function PowtorzZHistorii({ event }: { event: EventItem }) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [otwarte, setOtwarte] = useState(false);
  const [data, setData] = useState('');
  const [godzina, setGodzina] = useState('');
  const [zajete, setZajete] = useState(false);

  useBlokadaPrzewijania(otwarte);

  const otworz = () => {
    setData(domyslnyTerminPowtorki(event.date, event.time));
    setGodzina((event.time ?? '18:00').slice(0, 5));
    setOtwarte(true);
  };

  const powtorz = async () => {
    if (!user || !data || !godzina) return;
    setZajete(true);
    try {
      const id = await repeatEvent(
        event, data, godzina, user.id, displayName(user),
        true, false,
        // Długość meczu zachowana: bez `endTime` powtórka gubiła czas trwania
        // i mecz robił się „do odwołania".
        event.endTime ?? undefined,
      );
      // `?utworzono=1` — organizator ląduje od razu w panelu „Mecz gotowy —
      // wyślij link", tak samo jak po kreatorze. To jest ten moment, w którym
      // ma wysłać link ekipie.
      router.push(`/wydarzenia/${id}?utworzono=1`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się powtórzyć meczu', 'error');
      setZajete(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={otworz}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-primary-700 transition hover:text-primary-800 dark:text-primary-400"
      >
        <Copy className="h-3.5 w-3.5" /> Powtórz ten mecz
      </button>

      {otwarte && (
        <div
          className={`fixed inset-0 flex items-end justify-center bg-black/50 p-4 sm:items-center ${WARSTWA.modal}`}
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          onClick={() => !zajete && setOtwarte(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Powtórz mecz"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-ink">Powtórz mecz</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Powstanie nowy mecz z tymi samymi ustawieniami: miejsce, liczba miejsc, koszt
              i sposoby płatności. Skład zaczyna się od zera.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Data</span>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Godzina</span>
                <input
                  type="time"
                  value={godzina}
                  onChange={(e) => setGodzina(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                />
              </label>
            </div>

            <div className="mt-5 space-y-2">
              <Button onClick={powtorz} isLoading={zajete} disabled={!data || !godzina} className="w-full">
                {zajete ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Utwórz mecz
              </Button>
              <Button variant="ghost" onClick={() => setOtwarte(false)} disabled={zajete} className="w-full">
                Anuluj
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
