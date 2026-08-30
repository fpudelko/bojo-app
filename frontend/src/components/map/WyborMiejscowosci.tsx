'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import {
  szukajMiejscowosci, toKodPocztowy, PROMIENIE_KM,
  type Miejscowosc,
} from '@/lib/miejscowosci';

/**
 * „Szukaj wokół: <miejscowość>, w promieniu N km".
 *
 * Jedna kontrolka na dwa pytania, bo to jedna decyzja: sam punkt bez promienia
 * nic nie zawęża, a sam promień bez punktu nie ma od czego liczyć. Dlatego
 * promień pokazuje się DOPIERO po wybraniu miejscowości — pusty wybór
 * promienia byłby pytaniem bez treści.
 *
 * Wpisać można nazwę albo kod pocztowy: kod jest jedyną rzeczą, którą człowiek
 * zna na pewno o okolicy, w której nie mieszka.
 */
export default function WyborMiejscowosci({
  wybrana, promienKm, naZmiane,
}: {
  wybrana: Miejscowosc | null;
  promienKm: number;
  naZmiane: (m: Miejscowosc | null, promienKm: number) => void;
}) {
  const [fraza, setFraza] = useState('');
  const [podpowiedzi, setPodpowiedzi] = useState<Miejscowosc[]>([]);
  const [szuka, setSzuka] = useState(false);
  const ostatnie = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = fraza.trim();
    if (wybrana || q.length < 2) { setPodpowiedzi([]); setSzuka(false); return; }
    setSzuka(true);
    // Debounce 350 ms. Nominatim ma politykę użycia liczoną w zapytaniach na
    // sekundę, a pole podpowiedzi bez odczekania wysyła jedno na znak.
    const t = setTimeout(async () => {
      ostatnie.current?.abort();
      const ctrl = new AbortController();
      ostatnie.current = ctrl;
      const wynik = await szukajMiejscowosci(q, ctrl.signal);
      if (!ctrl.signal.aborted) { setPodpowiedzi(wynik); setSzuka(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [fraza, wybrana]);

  if (wybrana) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-primary-600 bg-primary-50 px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-primary-700" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">{wybrana.nazwa}</span>
              {wybrana.kontekst && (
                <span className="block truncate text-xs text-slate-500">{wybrana.kontekst}</span>
              )}
            </span>
          </span>
          <button
            type="button"
            onClick={() => { setFraza(''); naZmiane(null, promienKm); }}
            aria-label="Wyczyść miejscowość"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <p className="mb-2 mt-3 text-xs text-slate-500">W promieniu</p>
        <div className="flex flex-wrap gap-2">
          {PROMIENIE_KM.map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => naZmiane(wybrana, km)}
              aria-pressed={promienKm === km}
              className={[
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                promienKm === km
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300',
              ].join(' ')}
            >
              {km} km
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <input
        type="text"
        value={fraza}
        onChange={(e) => setFraza(e.target.value)}
        onKeyDown={(e) => {
          // Enter nic nie robił — trzeba było kliknąć podpowiedź myszą/palcem.
          // Zgłoszone wprost z sesji QA. Wybiera pierwszą podpowiedź, tak jak
          // Enter w wyszukiwarce zwykle wybiera pierwszy wynik.
          if (e.key !== 'Enter' || podpowiedzi.length === 0) return;
          e.preventDefault();
          const m = podpowiedzi[0];
          setFraza(''); setPodpowiedzi([]); naZmiane(m, promienKm);
        }}
        placeholder="Nazwa miejscowości albo kod pocztowy"
        aria-label="Miejscowość albo kod pocztowy"
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      {fraza.trim().length >= 2 && (
        <div className="mt-2 space-y-1">
          {szuka && <p className="px-1 text-xs text-slate-400">Szukam…</p>}
          {!szuka && podpowiedzi.length === 0 && (
            <p className="px-1 text-xs text-slate-500">
              {toKodPocztowy(fraza)
                ? 'Nie znam tego kodu pocztowego.'
                : 'Nie znam takiej miejscowości. Spróbuj kodu pocztowego.'}
            </p>
          )}
          {podpowiedzi.map((m) => (
            <button
              key={`${m.nazwa}-${m.lat}-${m.lng}`}
              type="button"
              onClick={() => { setPodpowiedzi([]); naZmiane(m, promienKm); }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-slate-50"
            >
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">{m.nazwa}</span>
                {m.kontekst && <span className="block truncate text-xs text-slate-500">{m.kontekst}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
