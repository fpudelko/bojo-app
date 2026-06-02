'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Field } from '@/types';
import { getFields } from '@/lib/api';

const POZNAN: [number, number] = [52.37, 16.97];
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function pin(selected: boolean) {
  const color = selected ? '#ef4444' : '#16a34a';
  const size = selected ? 20 : 14;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
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
      <ZoomControl position="topright" />

      {fields.map((field) => (
        <Marker
          key={field.id}
          position={[field.lat, field.lng]}
          icon={pin(field.id === selectedId)}
          eventHandlers={{ click: () => onSelect(field) }}
        />
      ))}
    </MapContainer>
  );
}
