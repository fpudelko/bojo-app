'use client';

// KOD QR DO ZESKANOWANIA (2026-11-27, prośba właściciela): na hali kapitan
// i zawodnicy stoją obok, więc zamiast wysyłać link wystarczy pokazać ekran
// telefonu. Organizator pokazuje kod kapitana (`/k/<kod>`, przejęcie drużyny),
// kapitan kod drużyny (`/t/<kod>`, dołączenie do składu). Ten sam link co
// w wiadomości, więc po zeskanowaniu wszystko dzieje się jak po kliknięciu.
import { X } from 'lucide-react';
import KodQr from '@/components/ui/KodQr';
import { useBlokadaPrzewijania } from '@/lib/blokadaPrzewijania';
import { WARSTWA } from '@/lib/warstwy';

export default function OknoKoduQr({ tytul, opis, link, onZamknij }: {
  tytul: string;
  opis: string;
  link: string;
  onZamknij: () => void;
}) {
  useBlokadaPrzewijania(true);
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black/60 p-4 ${WARSTWA.modal}`}
      onClick={onZamknij}
      role="dialog"
      aria-modal="true"
      aria-label={tytul}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onZamknij}
          aria-label="Zamknij"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="pr-6 font-semibold text-ink">{tytul}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{opis}</p>
        <KodQr tekst={link} etykieta={`Kod QR: ${tytul}`} className="mx-auto mt-4 aspect-square w-full max-w-[18rem] rounded-xl" />
        <p className="mt-3 break-all font-mono text-xs text-slate-400">{link.replace(/^https?:\/\//, '')}</p>
        <button
          type="button"
          onClick={onZamknij}
          className="mt-4 min-h-[44px] w-full rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Zamknij
        </button>
      </div>
    </div>
  );
}
