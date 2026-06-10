'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMapEvents } from 'react-leaflet';
import MapAttribution from './MapAttribution';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationPickerProps } from './LocationPicker';

const POZNAN: [number, number] = [52.37, 16.97];
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const pinIcon = L.divIcon({
  html: `<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;background:#15803d;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);transform:rotate(-45deg)"></div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

function ClickHandler({
  onSelect,
}: {
  onSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function PinLayer({ lat, lng }: { lat: number; lng: number }) {
  const map = useMapEvents({});
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
    }
    return () => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return null;
}

export default function LocationPickerImpl({ lat, lng, onSelect }: LocationPickerProps) {
  async function handleClick(clickLat: number, clickLng: number) {
    let address = `${clickLat.toFixed(5)}, ${clickLng.toFixed(5)}`;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${clickLat}&lon=${clickLng}&format=json`,
        { headers: { 'User-Agent': 'bojo-app/1.0' } },
      );
      const data = await res.json();
      if (data.display_name) address = data.display_name;
    } catch { /* keep coord string */ }
    onSelect(clickLat, clickLng, address);
  }

  return (
    <div className="w-full h-full min-h-[280px] relative">
      <div className="absolute top-2 left-2 right-2 z-[1000] bg-white/90 backdrop-blur-sm text-xs text-gray-500 px-2.5 py-1.5 rounded-lg shadow text-center">
        Kliknij na mapie, aby wskazać lokalizację
      </div>
      <MapContainer
        center={lat && lng ? [lat, lng] : POZNAN}
        zoom={lat && lng ? 15 : 11}
        style={{ height: '100%', width: '100%', minHeight: '280px' }}
        zoomControl={false}
      >
        <MapAttribution />
        {MAPBOX_TOKEN ? (
          <TileLayer
            attribution='&copy; Mapbox &copy; OpenStreetMap'
            url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
            tileSize={512}
            zoomOffset={-1}
          />
        ) : (
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        <ZoomControl position="topright" />
        <ClickHandler onSelect={handleClick} />
        {lat !== null && lng !== null && <PinLayer lat={lat} lng={lng} />}
      </MapContainer>
    </div>
  );
}
