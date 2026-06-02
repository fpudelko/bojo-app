'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Field, SportType } from '@/types';
import { getFields } from '@/lib/api';
import { surfaceLabel, venueThumbnail } from '@/lib/labels';
import { useAdmin } from '@/lib/admin';

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
  search?: string;
}

export default function LeafletMapImpl({ className, sport, onlyAvailable, search }: Props) {
  const [fields, setFields] = useState<Field[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = useAdmin();

  useEffect(() => {
    let cancelled = false;
    getFields({ sport, available: onlyAvailable || undefined })
      .then((res) => { if (!cancelled) setFields(res.fields); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Błąd pobierania boisk'); });
    return () => { cancelled = true; };
  }, [sport, onlyAvailable]);

  const q = search?.trim().toLowerCase() ?? '';
  const displayed = q
    ? fields.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.address.toLowerCase().includes(q),
      )
    : fields;

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

        {displayed.map((field) => (
          <Marker
            key={field.id}
            position={[field.lat, field.lng]}
            icon={fieldIcon(field.available)}
          >
            <Popup>
              <div style={{ minWidth: 230 }}>
                {venueThumbnail(field.lat, field.lng, 240, 120) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={venueThumbnail(field.lat, field.lng, 240, 120)!}
                    alt={field.name}
                    style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }}
                  />
                )}
                <p style={{ fontWeight: 600, fontSize: 13, color: '#111', margin: '0 0 2px' }}>{field.name}</p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px' }}>{field.address}</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {field.sport.map((s) => (
                    <span key={s} style={{ background: '#f0fdf4', color: '#15803d', borderRadius: 4, padding: '1px 7px', fontSize: 11 }}>
                      {s}
                    </span>
                  ))}
                </div>

                <p style={{ fontSize: 11, margin: '0 0 8px', color: field.available ? '#16a34a' : '#9ca3af' }}>
                  {field.available ? '● Dostępne' : '● Niedostępne'}
                  {field.surface && <span style={{ color: '#9ca3af' }}> · {surfaceLabel(field.surface)}</span>}
                </p>

                {/* Action links */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  <a
                    href={`/wydarzenia/nowe?fieldId=${field.id}`}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      background: '#16a34a',
                      color: '#fff',
                      borderRadius: 6,
                      padding: '5px 8px',
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    + Wydarzenie
                  </a>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${field.lat},${field.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      background: '#f3f4f6',
                      color: '#374151',
                      borderRadius: 6,
                      padding: '5px 8px',
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Prowadź →
                  </a>
                </div>

                {field.website && (
                  <a
                    href={field.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#16a34a' }}
                  >
                    Strona boiska →
                  </a>
                )}

                {isAdmin && (
                  <a
                    href={`/admin/boisko/${field.id}`}
                    style={{
                      display: 'block',
                      marginTop: 6,
                      fontSize: 11,
                      color: '#6b7280',
                      textDecoration: 'none',
                    }}
                  >
                    ✏️ Edytuj boisko (admin)
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Search result count */}
      {q && (
        <div className="absolute top-2 left-2 z-[1000] bg-white/90 text-xs text-gray-600 px-2 py-1 rounded shadow">
          {displayed.length} / {fields.length} boisk
        </div>
      )}

      {error && (
        <div className="absolute bottom-4 left-4 right-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2 shadow z-[1000]">
          Nie udało się pobrać boisk: {error}
        </div>
      )}
    </div>
  );
}
