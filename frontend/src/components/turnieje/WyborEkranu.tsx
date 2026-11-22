'use client';

// Wybór układu i motywu ekranu na halę: menu w pasku panelu (komputer)
// i sekcja w Ustawieniach (także telefon). Każdy układ to wiersz z nazwą
// („Tablica wyników”, „Tabele grup”…) i opisem, a po rozwinięciu miniatura
// tego, jak ekran wygląda (zrzut przykładowego turnieju w wybranym motywie,
// `scripts/podglady-ekranu.mjs`) i przycisk otwarcia w nowej karcie: ekran
// idzie na rzutnik, panel zostaje u organizatora.
import { useState } from 'react';
import { ChevronDown, ExternalLink, Moon, Sun } from 'lucide-react';
import { UKLADY_EKRANU, adresEkranu, podgladUkladu, type MotywEkranu, type UkladEkranu } from '@/lib/ekranTurnieju';

export default function WyborEkranu({ adresTurnieju }: { adresTurnieju: string }) {
  const [motyw, setMotyw] = useState<MotywEkranu>('ciemny');
  const [rozwiniety, setRozwiniety] = useState<UkladEkranu | null>(null);

  const miniatura = (u: Exclude<UkladEkranu, 'zmiana'>, mala = false) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={podgladUkladu(u, motyw)}
      alt={mala ? '' : `Podgląd ekranu: ${UKLADY_EKRANU.find((x) => x.klucz === u)?.etykieta}`}
      loading="lazy"
      width={960}
      height={540}
      className="block aspect-video w-full rounded-lg border border-slate-200 object-cover dark:border-slate-700"
    />
  );

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
      {UKLADY_EKRANU.map((u) => {
        const otwarty = rozwiniety === u.klucz;
        return (
          <div key={u.klucz} className="rounded-lg border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
            <button
              type="button"
              onClick={() => setRozwiniety(otwarty ? null : u.klucz)}
              aria-expanded={otwarty}
              className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{u.etykieta}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{u.opis}</span>
              </span>
              <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${otwarty ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {otwarty && (
              <div className="space-y-2 px-3 pb-3">
                {u.klucz === 'zmiana' ? (
                  // „Na zmianę” nie ma jednego widoku: pokazujemy, przez co przechodzi.
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['wynik', 'tabele', 'terminarz', 'ogloszenie'] as const).map((x) => <div key={x}>{miniatura(x, true)}</div>)}
                  </div>
                ) : (
                  miniatura(u.klucz)
                )}
                <a
                  href={adresEkranu(adresTurnieju, { uklad: u.klucz, motyw })}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Otwórz ten ekran <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </div>
            )}
          </div>
        );
      })}
      <p className="px-3 pt-1 text-xs text-slate-500 dark:text-slate-400">
        Podgląd na przykładowym turnieju. Układ i motyw zmienisz też na samym ekranie: rusz myszą.
      </p>
    </div>
  );
}
