'use client';

import { LocateFixed, Loader2 } from 'lucide-react';

/**
 * Pusty stan listy obiektów przy oddalonej mapie.
 *
 * TU JUŻ PRAWIE NIC NIE MA i to jest cel. Lista dobiera się dziś SAMA
 * (`VenueExplorer`): okolica gracza, gdy zgoda na lokalizację jest już
 * udzielona, a bez niej okolica Poznania — po WSPÓŁRZĘDNYCH, które ma każdy
 * obiekt w katalogu. Ten ekran zostaje na przypadek, gdy dobieranie nic nie
 * znalazło albo padło.
 *
 * CO STĄD ZNIKNĘŁO, po kolei:
 *
 *  1. „Przybliż tam, gdzie jest ich najwięcej" jako GŁÓWNA droga —
 *     odpowiadało na pytanie, którego nikt nie zadaje. Zostało jako cichy
 *     odnośnik na końcu.
 *  2. Kafelki miast z liczbami (2026-08-27). Liczby brały się z `fields.city`,
 *     a zrzut z produkcji pokazał, ile ta kolumna jest warta: 38 314 obiektów
 *     w katalogu, wszystkie miasta razem ~900, Poznań 54. Backfill lokalizacji
 *     przeszedł po jakichś dwóch procentach, więc kafelek kłamał liczbą
 *     I dowoził do garstki zamiast do wszystkiego, co w mieście jest.
 */
export default function PustaListaObiektow({
  ladujeBlisko, bladGeo, naBliskoMnie, naPrzyblizenie,
}: {
  ladujeBlisko: boolean;
  /** Komunikat, gdy przeglądarka odmówiła lokalizacji albo w promieniu pusto. */
  bladGeo: string | null;
  naBliskoMnie: () => void;
  naPrzyblizenie: () => void;
}) {
  return (
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
