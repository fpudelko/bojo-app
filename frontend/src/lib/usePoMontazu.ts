'use client';

import { useEffect, useState } from 'react';

/**
 * `false` na serwerze i w pierwszym renderze klienta, `true` po montażu.
 *
 * Do wszystkiego, co zależy od „teraz” albo od strefy czasowej PRZEGLĄDARKI
 * („Dzisiaj”, „za 2 h”) w komponencie, który bywa renderowany na serwerze.
 * Serwer liczy w UTC, gracz w Warszawie: różny tekst w HTML i w pierwszym
 * renderze klienta to błąd hydracji, po którym React wyrzuca cały HTML
 * z serwera i renderuje stronę od nowa (W-3, docs/faza1-przejscie-e2e-plan.md).
 */
export function usePoMontazu(): boolean {
  const [zamontowany, ustaw] = useState(false);
  useEffect(() => { ustaw(true); }, []);
  return zamontowany;
}
