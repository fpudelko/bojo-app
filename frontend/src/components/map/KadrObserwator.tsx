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
