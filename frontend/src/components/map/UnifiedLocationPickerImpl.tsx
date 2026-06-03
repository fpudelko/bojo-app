'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Loader2 } from 'lucide-react';
import type { Field } from '@/types';
import { getFields } from '@/lib/api';
import { POZNAN, fieldPin } from './mapIcons';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const customIcon = L.divIcon({
  html: `<div style="display:flex;flex-direction:column;align-items:center;width:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))">
    <div style="width:26px;height:26px;border-radius:50%;background:#fff;border:2.5px solid #15803d;display:flex;align-items:center;justify-content:center">
      <span style="font-size:13px;line-height:1">📍</span>
    </div>
    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #15803d;margin-top:-1px"></div>
  </div>`,
  className: '',
  iconSize: [28, 33],
  iconAnchor: [14, 33],
});

function MapClickHandler({ onCustom }: { onCustom: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onCustom(e.latlng.lat, e.latlng.lng) });
  return null;
}

function CustomPin({ lat, lng }: { lat: number; lng: number }) {
  const map = useMapEvents({});
  const ref = useRef<L.Marker | null>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.setLatLng([lat, lng]);
    } else {
      ref.current = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    }
    return () => {
      if (ref.current) { map.removeLayer(ref.current); ref.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.5 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return null;
}

export interface LocationResult {
  venue: Field | null;
  lat: number | null;
  lng: number | null;
  address: string;
}

interface Props {
  sport?: string;
  value: LocationResult;
  onChange: (v: LocationResult) => void;
}

export default function UnifiedLocationPickerImpl({ sport, value, onChange }: Props) {
  const [fields, setFields] = useState<Field[]>([]);
  const [search, setSearch] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFields().then((r) => { if (!cancelled) setFields(r.fields); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const visible = sport ? fields.filter((f) => f.sport.includes(sport)) : fields;

  async function handleGeocode() {
    const q = search.trim();
    if (!q) return;
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=pl`,
        { headers: { 'User-Agent': 'bojo-app/1.0' } },
      );
      const data = await res.json();
      if (data.length) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lng);
        onChange({ venue: null, lat, lng, address: data[0].display_name });
        setFlyTarget({ lat, lng });
        setSearch('');
      }
    } catch { /* ignore */ }
    setGeocoding(false);
  }

  async function handleMapClick(lat: number, lng: number) {
    let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'User-Agent': 'bojo-app/1.0' } },
      );
      const data = await res.json();
      if (data.display_name) address = data.display_name;
    } catch { /* keep coords */ }
    onChange({ venue: null, lat, lng, address });
  }

  const showFly = flyTarget;

  return (
    <div className="relative w-full h-full min-h-[300px]">
      {/* Address search overlay */}
      <div className="absolute top-2 left-2 right-2 z-[1001] flex gap-1.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGeocode(); } }}
          placeholder="Szukaj adresu lub nazwy miejsca…"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white/95 backdrop-blur-sm shadow focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={handleGeocode}
          disabled={geocoding}
          className="px-3 py-2 rounded-lg bg-white/95 backdrop-blur-sm border border-gray-200 shadow text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center"
        >
          {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>

      <MapContainer
        center={POZNAN}
        zoom={11}
        style={{ height: '100%', width: '100%', minHeight: '300px' }}
        zoomControl={false}
      >
        {MAPBOX_TOKEN ? (
          <TileLayer
            attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
            tileSize={512}
            zoomOffset={-1}
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        <ZoomControl position="bottomright" />
        <MapClickHandler onCustom={handleMapClick} />
        {showFly && <FlyTo lat={showFly.lat} lng={showFly.lng} />}

        {/* Venue pins */}
        {visible.map((f) => (
          <Marker
            key={f.id}
            position={[f.lat, f.lng]}
            icon={fieldPin(f, value.venue?.id === f.id)}
            eventHandlers={{
              click: () => {
                onChange({ venue: f, lat: f.lat, lng: f.lng, address: f.address });
                setFlyTarget({ lat: f.lat, lng: f.lng });
              },
            }}
          />
        ))}

        {/* Custom location pin */}
        {!value.venue && value.lat !== null && value.lng !== null && (
          <CustomPin lat={value.lat} lng={value.lng} />
        )}
      </MapContainer>
    </div>
  );
}
