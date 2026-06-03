'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Field } from '@/types';
import { getFields } from '@/lib/api';

const POZNAN: [number, number] = [52.37, 16.97];
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const SPORT_EMOJI: Record<string, string> = {
  'piłka nożna': '⚽', futsal: '⚡', koszykówka: '🏀',
  siatkówka: '🏐', 'siatkówka plażowa': '🏖️', 'piłka ręczna': '🤾', inne: '🏅',
};

function primaryEmoji(sports: string[]): string {
  for (const s of ['piłka nożna', 'futsal', 'koszykówka', 'siatkówka', 'siatkówka plażowa', 'piłka ręczna']) {
    if (sports.includes(s)) return SPORT_EMOJI[s];
  }
  return SPORT_EMOJI[sports[0]] ?? '🏅';
}

function pin(field: Field, selected: boolean): L.DivIcon {
  const emoji = primaryEmoji(field.sport ?? []);
  const bg = selected ? '#1e40af' : '#15663E';
  const size = selected ? 38 : 32;
  return L.DivIcon
    ? L.divIcon({
        html: `<div style="
          display:flex;align-items:center;justify-content:center;
          width:${size}px;height:${size}px;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          background:${bg};
          border:${selected ? '2.5px' : '1.5px'} solid rgba(255,255,255,0.9);
          box-shadow:0 2px ${selected ? '12px' : '6px'} rgba(0,0,0,${selected ? '.45' : '.3'});
          cursor:pointer
        ">
          <span style="transform:rotate(45deg);font-size:${selected ? 16 : 13}px;line-height:1">${emoji}</span>
        </div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size - 2],
        popupAnchor: [0, -size],
      })
    : L.divIcon({ html: '', className: '' });
}

function FlyToSelected({ field }: { field: Field | null }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (field) map.flyTo([field.lat, field.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field?.id]);
  return null;
}

interface Props {
  selectedId?: string;
  onSelect: (field: Field) => void;
}

export default function VenuePickerImpl({ selectedId, onSelect }: Props) {
  const [fields, setFields] = useState<Field[]>([]);

  useEffect(() => {
    let cancelled = false;
    getFields()
      .then((res) => { if (!cancelled) setFields(res.fields); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const selectedField = fields.find((f) => f.id === selectedId) ?? null;

  return (
    <MapContainer
      center={POZNAN}
      zoom={11}
      style={{ height: '100%', width: '100%', minHeight: '320px' }}
      zoomControl={false}
    >
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
      <ZoomControl position="bottomright" />
      <FlyToSelected field={selectedField} />

      {fields.map((field) => (
        <Marker
          key={field.id}
          position={[field.lat, field.lng]}
          icon={pin(field, field.id === selectedId)}
          eventHandlers={{ click: () => onSelect(field) }}
        />
      ))}
    </MapContainer>
  );
}
