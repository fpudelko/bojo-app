'use client';

import { LocateFixed, Loader2 } from 'lucide-react';

/**
 * Pusty stan listy obiektów przy oddalonej mapie.
 *
 * CO TU BYŁO: jedno zdanie („N boisk w tym widoku") i przycisk „Przybliż tam,
 * gdzie jest ich najwięcej". Przycisk odpowiadał na pytanie, którego nikt nie
 * zadaje — gracz nie chce wiedzieć, gdzie w Polsce jest najwięcej pinezek,
 * tylko gdzie MOŻE ZAGRAĆ. Kazał też naprawić stan mapy zamiast dać odpowiedź:
 * w widoku „Lista" mapy nawet nie widać.
 *
 * CO JEST TERAZ, w kolejności od najczęstszej potrzeby:
 *
 *  1. „Blisko mnie" — jedno dotknięcie, zero wiedzy o mapie. Działa na
 *     `lat`/`lng`, które w katalogu ma KAŻDY obiekt, więc nie zależy od
 *     backfillu lokalizacji.
 *  2. Miasta z liczbami — dla kogoś bez zgody na lokalizację albo szukającego
 *     gdzie indziej niż stoi. Liczba przy nazwie jest istotna: mówi, gdzie
 *     w ogóle jest co oglądać, zamiast obiecywać katalog wszędzie jednakowy.
 *     Sekcja znika w całości, gdy `fields.city` nie jest wypełnione (patrz
 *     `policzBoiskaWMiastach()`).
 *  3. Przybliżenie do największego skupiska — zostaje, ale jako cichy odnośnik
 *     na końcu, nie główna droga.
 *
 * Pole szukania (nad listą) przeszukuje CAŁY katalog i jest czwartą drogą —
 * dlatego kafelków miast jest kilkanaście, a nie sto.
 */
export default function PustaListaObiektow({
  miasta, ladujeMiasta, ladujeBlisko, bladGeo,
  naBliskoMnie, naMiasto, naPrzyblizenie,
}: {
  miasta: Array<{ nazwa: string; ile: number }>;
  ladujeMiasta: boolean;
  ladujeBlisko: boolean;
  /** Komunikat, gdy przeglądarka odmówiła lokalizacji. */
  bladGeo: string | null;
  naBliskoMnie: () => void;
  naMiasto: (nazwa: string) => void;
  naPrzyblizenie: () => void;
}) {
  return (
    // Liczba obiektów w kadrze stoi już w nagłówku listy nad tym miejscem —
    // powtórzona tutaj była drugim „4360 boisk" na jednym ekranie.
    <div className="pt-8 text-center">
      <button
        type="button"
        onClick={naBliskoMnie}
        disabled={ladujeBlisko}
        className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-70"
      >
        {ladujeBlisko
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <LocateFixed className="h-4 w-4" />}
        Pokaż boiska blisko mnie
      </button>

      {bladGeo && (
        <p className="mx-auto mt-2 max-w-[18rem] text-xs text-slate-400">{bladGeo}</p>
      )}

      {/* Miasta pokazujemy dopiero, gdy znamy liczby — kafelek bez liczby
          obiecuje katalog, którego możemy tam nie mieć. */}
      {!ladujeMiasta && miasta.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Albo wybierz miasto
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {miasta.map((m) => (
              <button
                key={m.nazwa}
                type="button"
                onClick={() => naMiasto(m.nazwa)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-primary-700 hover:text-primary-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {m.nazwa}
                <span className="text-xs font-semibold text-slate-400">
                  {m.ile.toLocaleString('pl-PL')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={naPrzyblizenie}
        className="mt-6 text-xs font-semibold text-slate-400 underline underline-offset-2 hover:text-slate-600"
      >
        Przybliż tam, gdzie jest ich najwięcej
      </button>
    </div>
  );
}
