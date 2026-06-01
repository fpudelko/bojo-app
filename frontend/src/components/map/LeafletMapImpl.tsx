'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Field, SportType } from '@/types';
import { getFields } from '@/lib/api';
import { surfaceLabel, venueThumbnail } from '@/lib/labels';

const POZNAN: [number, number] = [52.4064, 16.9252];
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function fieldIcon(available: boolean) {
  const color = available ? '#16a34a' : '#9ca3af';
  return L.divIcon({
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

interface Props {
  className?: string;
  sport?: SportType;
  onlyAvailable?: boolean;
}

export default function LeafletMapImpl({ className, sport, onlyAvailable }: Props) {
  const [fields, setFields] = useState<Field[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFields({ sport, available: onlyAvailable })
      .then((res) => { if (!cancelled) setFields(res.fields); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Błąd pobierania boisk'); });
    return () => { cancelled = true; };
  }, [sport, onlyAvailable]);

  return (
    <div className={['w-full h-full min-h-[400px] relative', className ?? ''].join(' ')}>
      <MapContainer
        center={POZNAN}
        zoom={12}
        style={{ height: '100%', width: '100%', minHeight: '400px' }}
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
        <ZoomControl position="topright" />

        {fields.map((field) => (
          <Marker
            key={field.id}
            position={[field.lat, field.lng]}
            icon={fieldIcon(field.available)}
          >
            <Popup>
              <div className="min-w-[220px]">
                {venueThumbnail(field.lat, field.lng, 240, 120) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={venueThumbnail(field.lat, field.lng, 240, 120)!}
                    alt={field.name}
                    className="w-full h-24 object-cover rounded-md mb-2"
                  />
                )}
                <p className="font-semibold text-gray-900 text-sm">{field.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{field.address}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {field.sport.map((s) => (
                    <span key={s} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-[11px]">
                      {s}
                    </span>
                  ))}
                </div>
                <p className="text-xs mt-2">
                  <span className={field.available ? 'text-green-600' : 'text-gray-400'}>
                    {field.available ? '● Dostępne' : '● Niedostępne'}
                  </span>
                  {field.surface && <span className="text-gray-400"> · {surfaceLabel(field.surface)}</span>}
                </p>
                {field.website && (
                  <a
                    href={field.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-green-600 underline"
                  >
                    Strona boiska →
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {error && (
        <div className="absolute bottom-4 left-4 right-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2 shadow z-[1000]">
          Nie udało się pobrać boisk: {error}
        </div>
      )}
    </div>
  );
}
