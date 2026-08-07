'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { EventRow } from '@/lib/eventFilters';
import { sportColor } from '@/lib/sports';
import { clusterDivIcon } from './mapIcons';

/** Pinezka pojedynczego meczu — pełne kółko w kolorze sportu z białą obwódką
 *  i cieniem, wyraźnie większe niż domyślny marker Leafleta, żeby było je
 *  widać na tle mapy z daleka (dawniej 16px ginęło w tle). */
function eventIcon(sport: string, selected: boolean): L.DivIcon {
  const color = selected ? '#1e40af' : sportColor(sport);
  const size = selected ? 30 : 24;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
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
  onSelect: (id: string) => void;
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
    return () => {
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
        const m = L.marker([event.lat, event.lng], { icon: eventIcon(event.sport, false) }) as L.Marker & { _sports?: string[] };
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
      if (r) markersRef.current[prev].setIcon(eventIcon(r.event.sport, false));
    }
    if (selectedId && markersRef.current[selectedId]) {
      const r = rowsRef.current[selectedId];
      if (r) markersRef.current[selectedId].setIcon(eventIcon(r.event.sport, true));
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
