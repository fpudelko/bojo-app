'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Field } from '@/types';
import { getFields } from '@/lib/api';

const POZNAN: [number, number] = [52.37, 16.97];
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function sportColor(sport: string): string {
  if (sport === 'piłka nożna') return '#15663E';
  if (sport === 'siatkówka plażowa') return '#d97706';
  if (sport === 'koszykówka') return '#ea580c';
  return '#2563eb';
}

function primaryColor(sports: string[]): string {
  const order = ['piłka nożna', 'siatkówka plażowa', 'koszykówka'];
  for (const s of order) {
    if (sports.includes(s)) return sportColor(s);
  }
  return sportColor(sports[0] ?? 'inne');
}

function pin(field: Field, selected: boolean): L.DivIcon {
  const color = selected ? '#1e40af' : primaryColor(field.sport ?? []);
  const size = selected ? 36 : 28;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      background:${color};
      border:${selected ? '2.5px' : '1.5px'} solid rgba(255,255,255,0.9);
      box-shadow:0 2px ${selected ? '10px' : '5px'} rgba(0,0,0,${selected ? '.4' : '.25'});
      cursor:pointer
    "></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size - 2],
    popupAnchor: [0, -size],
  });
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
