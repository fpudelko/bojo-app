'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { Field } from '@/types';
import { fieldPin, clusterDivIcon } from './mapIcons';

/**
 * Clustered venue pins for the location pickers.
 *
 * The pickers used to render one <Marker> per field — up to ~1400 React
 * components with no clustering, which both lagged and left the map an
 * unreadable wall of pins. This mirrors the explorer's cluster layer: markers
 * are managed imperatively, added in chunks, and only the selected pin is
 * repainted when the selection changes.
 */
export default function ClusteredFieldMarkers({
  fields,
  selectedId,
  onSelect,
}: {
  fields: Field[];
  selectedId?: string;
  onSelect: (field: Field) => void;
}) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const fieldsRef = useRef<Record<string, Field>>({});
  const prevSelectedRef = useRef<string | undefined>(undefined);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 60,
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
      fieldsRef.current = {};
    };
  }, [map]);

  // Add/remove only what actually changed (sport filter swaps the set).
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;

    const next: Record<string, Field> = {};
    for (const f of fields) next[f.id] = f;
    fieldsRef.current = next;

    const existing = markersRef.current;
    const toRemove: L.Marker[] = [];
    for (const id of Object.keys(existing)) {
      if (!next[id]) { toRemove.push(existing[id]); delete existing[id]; }
    }
    const toAdd: L.Marker[] = [];
    for (const f of fields) {
      if (existing[f.id]) continue;
      const m = L.marker([f.lat, f.lng], { icon: fieldPin(f, f.id === selectedId) }) as L.Marker & { _sports?: string[] };
      m._sports = f.sport;
      m.on('click', () => onSelectRef.current(f));
      existing[f.id] = m;
      toAdd.push(m);
    }
    if (toRemove.length) cluster.removeLayers(toRemove);
    if (toAdd.length) cluster.addLayers(toAdd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  // Repaint just the previously- and newly-selected pins.
  useEffect(() => {
    const markers = markersRef.current;
    const prev = prevSelectedRef.current;
    if (prev && prev !== selectedId) {
      const pf = fieldsRef.current[prev];
      if (pf && markers[prev]) markers[prev].setIcon(fieldPin(pf, false));
    }
    if (selectedId) {
      const sf = fieldsRef.current[selectedId];
      if (sf && markers[selectedId]) markers[selectedId].setIcon(fieldPin(sf, true));
    }
    prevSelectedRef.current = selectedId;
  }, [selectedId, fields]);

  return null;
}
