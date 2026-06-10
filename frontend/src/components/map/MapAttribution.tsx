'use client';

import { useMap } from 'react-leaflet';
import { useEffect } from 'react';

/**
 * Removes Leaflet's default "Leaflet 🇺🇦" attribution prefix (the Ukrainian
 * flag) while keeping the required map-data attribution (OSM / Mapbox) intact.
 * Drop as a child of any <MapContainer>.
 */
export default function MapAttribution() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl?.setPrefix(false);
  }, [map]);
  return null;
}
