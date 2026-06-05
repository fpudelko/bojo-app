'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Field } from '@/types';
import { getFields } from '@/lib/api';
import { POZNAN, fieldPin } from './mapIcons';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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
  sport?: string;
}

export default function VenuePickerImpl({ selectedId, onSelect, sport }: Props) {
  const [fields, setFields] = useState<Field[]>([]);

  useEffect(() => {
    let cancelled = false;
    getFields({ mapVisibility: undefined })
      .then((res) => { if (!cancelled) setFields(res.fields.filter(f => f.mapVisibility !== 'hidden')); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const visible = sport ? fields.filter((f) => f.sport.includes(sport)) : fields;
  const selectedField = visible.find((f) => f.id === selectedId) ?? null;

  return (
    <MapContainer
      center={POZNAN}
      zoom={11}
      style={{ height: '100%', width: '100%', minHeight: '320px' }}
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
      <FlyToSelected field={selectedField} />

      {visible.map((field) => (
        <Marker
          key={field.id}
          position={[field.lat, field.lng]}
          icon={fieldPin(field, field.id === selectedId)}
          eventHandlers={{ click: () => onSelect(field) }}
        />
      ))}
    </MapContainer>
  );
}
