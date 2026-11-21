'use client';

// Wybór układu i motywu ekranu na halę: menu w pasku panelu (komputer)
// i sekcja w Ustawieniach (także telefon). Każdy układ to link w nowej
// karcie: ekran idzie na rzutnik, panel zostaje u organizatora.
import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { UKLADY_EKRANU, adresEkranu, type MotywEkranu } from '@/lib/ekranTurnieju';

export default function WyborEkranu({ adresTurnieju }: { adresTurnieju: string }) {
  const [motyw, setMotyw] = useState<MotywEkranu>('ciemny');
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900" role="group" aria-label="Motyw ekranu">
        {([['ciemny', 'Ciemny', Moon], ['jasny', 'Jasny', Sun]] as const).map(([klucz, etykieta, Ikona]) => (
          <button
            key={klucz}
            type="button"
            onClick={() => setMotyw(klucz)}
            aria-pressed={motyw === klucz}
            className={`inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-medium ${
              motyw === klucz ? 'bg-white text-ink shadow-sm dark:bg-slate-700' : 'text-slate-500'
            }`}
          >
            <Ikona className="h-4 w-4" aria-hidden /> {etykieta}
          </button>
        ))}
      </div>
      {UKLADY_EKRANU.map((u) => (
        <a
          key={u.klucz}
          href={adresEkranu(adresTurnieju, { uklad: u.klucz, motyw })}
          target="_blank"
          rel="noopener"
          className="block rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <span className="block text-sm font-semibold text-ink">{u.etykieta}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{u.opis}</span>
        </a>
      ))}
    </div>
  );
}
