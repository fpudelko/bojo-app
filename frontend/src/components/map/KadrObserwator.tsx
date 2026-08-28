'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { Kadr } from '@/lib/api';

/**
 * Zgłasza prostokąt widoku i przybliżenie po każdym ruchu mapy, z opóźnieniem.
 *
 * Bez opóźnienia jedno przeciągnięcie palcem to kilkadziesiąt zapytań do bazy;
 * z opóźnieniem — jedno, po tym jak ręka się zatrzyma.
 *
 * Wspólny dla mapy boisk i pickerów lokalizacji: wszystkie trzy mają ten sam
 * problem, czyli katalog większy niż to, co warto pobrać naraz.
 */
export default function KadrObserwator({ onZmiana, opoznienieMs = 350 }: {
  onZmiana: (kadr: Kadr, zoom: number) => void;
  opoznienieMs?: number;
}) {
  const map = useMap();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const zglos = () => {
      // Kontener 0×0 (mapa zamontowana z `display:none` pod widokiem „Lista")
      // daje ZDEGENEROWANY prostokąt — oba rogi ekranu przeliczają się na ten
      // sam punkt geograficzny. Zgłoszenie takiego kadru zatruwa dane dalej:
      // zapytanie o obiekty w promieniu zera stopni wraca puste, więc lista
      // i licznik nagle pokazują „0", choć w realnym kadrze jest ich tysiące.
      // Ten sam wzorzec co w `GamesMarkersLayer.dopasujKadr()`.
      //
      // Pominięcie zgłoszenia nie zostawia dziury: `pokazWokol()` (lista
      // startowa / okolica wybranej miejscowości) nie zależy od kadru mapy,
      // więc lista i tak się wypełnia. Gdy mapa naprawdę dostanie rozmiar
      // (przełączenie na widok „Mapa" wywołuje `invalidateSize()`), Leaflet
      // sam odpala `moveend` i kadr dociera tu poprawnie.
      const rozmiar = map.getSize();
      if (rozmiar.x < 80 || rozmiar.y < 80) return;
      const b = map.getBounds();
      onZmiana(
        {
          latMin: b.getSouth(), latMax: b.getNorth(),
          lngMin: b.getWest(),  lngMax: b.getEast(),
        },
        map.getZoom(),
      );
    };
    const opozniony = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(zglos, opoznienieMs);
    };

    zglos();                       // pierwszy kadr od razu, bez czekania
    map.on('moveend', opozniony);
    map.on('zoomend', opozniony);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      map.off('moveend', opozniony);
      map.off('zoomend', opozniony);
    };
  }, [map, onZmiana, opoznienieMs]);

  return null;
}
