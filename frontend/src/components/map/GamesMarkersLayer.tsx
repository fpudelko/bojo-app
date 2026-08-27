'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { EventRow } from '@/lib/eventFilters';
import { sportColor, sportEmoji } from '@/lib/sports';
import { matchWhenLabel } from '@/lib/eventDates';
import { clusterDivIcon } from './mapIcons';

/** Pinezka pojedynczego meczu — kółko w kolorze sportu z emoji sportu w
 *  środku (odpowiada na „jaki sport") i etykietą „kiedy + która godzina" pod
 *  spodem (dziś · 18:00 / jutro · 18:00 / w piątek · 20:30 / 12 wrz · 18:00 —
 *  ten sam format co `matchWhenLabel` gdzie indziej w apce, np. na kartach
 *  `/moje-gry`).
 *  Cena i reszta szczegółów zostają w panelu po dotknięciu — na samej pinezce
 *  więcej tekstu byłoby nieczytelne. */
function eventIcon(row: EventRow, selected: boolean): L.DivIcon {
  const { event } = row;
  const color = selected ? '#1e40af' : sportColor(event.sport);
  const circle = selected ? 34 : 28;
  const width = 92;
  const emoji = sportEmoji(event.sport);
  const when = matchWhenLabel(event.date, event.time);
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;width:${width}px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">
      <div style="width:${circle}px;height:${circle}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;border:2.5px solid white;flex-shrink:0">
        <span style="font-size:${selected ? 16 : 13}px;line-height:1">${emoji}</span>
      </div>
      <span style="margin-top:2px;padding:1px 6px;border-radius:8px;background:white;font-size:10px;font-weight:700;color:#334155;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.22)">${when}</span>
    </div>`,
    className: '',
    iconSize: [width, circle + 20],
    iconAnchor: [width / 2, circle / 2],
  });
}

/**
 * Klastrowana warstwa pinezek meczów — dziecko `<MapContainer>`. Dane wchodzą
 * jako prop (już przefiltrowane przez wywołującego), bez własnego fetcha
 * ograniczonego do viewportu: zbiór publicznych meczów jest już w całości
 * w pamięci (getPublicEvents() bez limitu), więc nie ma po co dociągać go
 * per-kadr tak jak robi to VenueExplorer dla boisk.
 *
 * Współdzielona przez widok mapy w /wydarzenia (GamesMapCanvas, własny
 * MapContainer) i tryb „Pokaż gry" na /mapa (wewnątrz istniejącego
 * MapContainer VenueExplorera) — jeden komponent zamiast dwóch kopii.
 */
export default function GamesMarkersLayer({
  rows, selectedId, onSelect,
}: {
  rows: EventRow[];
  selectedId: string | null;
  /** `null` zamyka panel — wołane też przy kliknięciu mapy poza pinezką. */
  onSelect: (id: string | null) => void;
}) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const rowsRef = useRef<Record<string, EventRow>>({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      // Bez tego klaster renderował domyślną, nieostylowaną ikonę Leafleta —
      // sam numer bez tła/obwódki, prawie niewidoczny na mapie. clusterDivIcon
      // to ten sam wygląd co klastry boisk na /mapa (kolorowe kółko z liczbą).
      iconCreateFunction: (c) => {
        const ms = c.getAllChildMarkers() as Array<L.Marker & { _sports?: string[] }>;
        return clusterDivIcon(c.getChildCount(), ms.flatMap((m) => m._sports ?? []));
      },
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16,
      animate: true,
      chunkedLoading: true,
      removeOutsideVisibleBounds: true,
    });
    clusterRef.current = cluster;
    map.addLayer(cluster);
    // Dotknięcie mapy poza pinezką zamyka otwarty panel — markery zatrzymują
    // własne kliknięcie (Leaflet nie propaguje go do mapy), więc ten listener
    // odpala się wyłącznie na pustym tle.
    const onMapClick = () => onSelectRef.current(null);
    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
      map.removeLayer(cluster);
      clusterRef.current = null;
      markersRef.current = {};
      rowsRef.current = {};
    };
  }, [map]);

  // Diff markerów przy zmianie `rows` — dodaj brakujące, usuń nieaktualne,
  // wzorem MapLayer z VenueExplorer.tsx (nie pełny rebuild przy każdej zmianie).
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    const seen = new Set<string>();
    for (const r of rows) {
      const { event } = r;
      if (event.lat == null || event.lng == null) continue;
      seen.add(event.id);
      rowsRef.current[event.id] = r;
      let marker = markersRef.current[event.id];
      if (!marker) {
        const m = L.marker([event.lat, event.lng], { icon: eventIcon(r, false) }) as L.Marker & { _sports?: string[] };
        m._sports = [event.sport];
        m.on('click', () => onSelectRef.current(event.id));
        marker = m;
        markersRef.current[event.id] = marker;
        cluster.addLayer(marker);
      }
    }
    for (const id of Object.keys(markersRef.current)) {
      if (!seen.has(id)) {
        cluster.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
        delete rowsRef.current[id];
      }
    }
  }, [rows]);

  // Przemalowanie tylko markera, którego dotyczy zmiana selekcji — nie całej warstwy.
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevSelectedRef.current;
    if (prev && markersRef.current[prev]) {
      const r = rowsRef.current[prev];
      if (r) markersRef.current[prev].setIcon(eventIcon(r, false));
    }
    if (selectedId && markersRef.current[selectedId]) {
      const r = rowsRef.current[selectedId];
      if (r) markersRef.current[selectedId].setIcon(eventIcon(r, true));
    }
    prevSelectedRef.current = selectedId;
  }, [selectedId]);

  // Auto-fitBounds na cały (przefiltrowany) zbiór przy zmianie rows.
  useEffect(() => {
    const coords = rows
      .filter(({ event }) => event.lat != null && event.lng != null)
      .map(({ event }) => [event.lat as number, event.lng as number] as [number, number]);
    if (coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 14 });
    }
  }, [rows, map]);

  return null;
}
