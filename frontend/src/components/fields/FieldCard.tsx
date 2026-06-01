'use client';

import { MapPin, Phone, Globe, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import Card from '@/components/ui/Card';
import type { Field } from '@/types';

interface FieldCardProps {
  field: Field;
  distance?: number; // km
  onClick?: () => void;
  compact?: boolean;
}

const SPORT_LABELS: Record<string, string> = {
  'piłka nożna': 'Piłka nożna',
  koszykówka: 'Koszykówka',
  siatkówka: 'Siatkówka',
  tenis: 'Tenis',
  futsal: 'Futsal',
};

const SURFACE_LABELS: Record<string, string> = {
  grass: 'Trawa naturalna',
  artificial: 'Sztuczna trawa',
  concrete: 'Beton',
  clay: 'Kortex / ziemia',
  hardcourt: 'Tartan',
};

export default function FieldCard({ field, distance, onClick, compact = false }: FieldCardProps) {
  return (
    <Card
      className={clsx('transition-shadow', onClick && 'cursor-pointer hover:shadow-md')}
      padding={compact ? 'sm' : 'md'}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{field.name}</h3>

          {/* Sport badges */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {field.sport.map((s) => (
              <span
                key={s}
                className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full font-medium"
              >
                {SPORT_LABELS[s] ?? s}
              </span>
            ))}
            {field.isIndoor && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                Kryte
              </span>
            )}
          </div>
        </div>

        {/* Availability badge */}
        <div
          className={clsx(
            'flex items-center gap-1 text-xs font-semibold shrink-0 mt-0.5',
            field.available ? 'text-green-600' : 'text-red-500',
          )}
          title={field.available ? 'Dostępne' : 'Niedostępne'}
        >
          {field.available ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          <span>{field.available ? 'Dostępne' : 'Zajęte'}</span>
        </div>
      </div>

      {!compact && (
        <div className="mt-3 space-y-1.5 text-sm text-gray-500">
          {/* Address */}
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
            <span className="truncate">{field.address}</span>
            {distance !== undefined && (
              <span className="ml-auto shrink-0 text-xs text-gray-400">
                {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}
              </span>
            )}
          </div>

          {/* Surface */}
          {field.surface && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">Nawierzchnia:</span>
              <span className="text-xs">{SURFACE_LABELS[field.surface] ?? field.surface}</span>
            </div>
          )}

          {/* Contact */}
          <div className="flex gap-3 pt-1">
            {field.phone && (
              <a
                href={`tel:${field.phone}`}
                className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="w-3 h-3" />
                {field.phone}
              </a>
            )}
            {field.website && (
              <a
                href={field.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <Globe className="w-3 h-3" />
                Strona WWW
              </a>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
