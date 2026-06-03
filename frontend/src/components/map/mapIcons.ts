import L from 'leaflet';
import type { Field } from '@/types';

export const POZNAN: [number, number] = [52.37, 16.97];

export const SPORT_ORDER = [
  'piłka nożna', 'siatkówka plażowa', 'koszykówka',
  'futsal', 'siatkówka', 'piłka ręczna', 'gokarty', 'inne',
];

const SPORT_META: Record<string, { color: string; emoji: string }> = {
  'piłka nożna':       { color: '#15663E', emoji: '⚽' },
  'siatkówka plażowa': { color: '#d97706', emoji: '🏖️' },
  'koszykówka':        { color: '#9a3412', emoji: '🏀' },
  'siatkówka':         { color: '#2563eb', emoji: '🏐' },
  'futsal':            { color: '#4f46e5', emoji: '⚡' },
  'piłka ręczna':      { color: '#0891b2', emoji: '🤾' },
  'gokarty':           { color: '#0d9488', emoji: '🏎️' },
  'inne':              { color: '#6b7280', emoji: '🏅' },
};

export function metaFor(sport: string) {
  return SPORT_META[sport] ?? { color: '#6b7280', emoji: '🏅' };
}

export function primaryMeta(sports: string[]) {
  for (const s of SPORT_ORDER) {
    if (sports.includes(s)) return metaFor(s);
  }
  return metaFor(sports[0] ?? 'inne');
}

export function primaryColor(sports: string[]): string {
  return primaryMeta(sports).color;
}

// Circle + downward triangle — white background keeps emoji readable on any color
export function fieldPin(field: Field, selected = false): L.DivIcon {
  const { color } = selected ? { color: '#1e40af' } : field.available ? primaryMeta(field.sport) : { color: '#9ca3af' };
  const { emoji } = primaryMeta(field.sport);
  const d = selected ? 34 : 28;
  const bw = selected ? 3 : 2.5;
  const fs = selected ? 16 : 13;
  const tw = 5;
  const th = 7;
  const w = d + 4;
  const h = d + th;
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;width:${w}px;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,.28))">
      <div style="width:${d}px;height:${d}px;border-radius:50%;background:#fff;border:${bw}px solid ${color};display:flex;align-items:center;justify-content:center">
        <span style="font-size:${fs}px;line-height:1;user-select:none">${emoji}</span>
      </div>
      <div style="width:0;height:0;border-left:${tw}px solid transparent;border-right:${tw}px solid transparent;border-top:${th}px solid ${color};margin-top:-1px"></div>
    </div>`,
    className: '',
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -(h + 4)],
  });
}

export function clusterDivIcon(count: number, allSports: string[]): L.DivIcon {
  const uniqueSports = Array.from(new Set(allSports));
  const isMixed = uniqueSports.length > 1;
  const color = isMixed ? '#64748b' : primaryColor(allSports.length ? allSports : ['inne']);
  const sorted = [
    ...SPORT_ORDER.filter((s) => uniqueSports.includes(s)),
    ...uniqueSports.filter((s) => !SPORT_ORDER.includes(s)),
  ].slice(0, 3);
  const emojis = sorted.map((s) => metaFor(s).emoji).join('');
  const size = count >= 100 ? 50 : count >= 20 ? 42 : 36;
  const emSize = sorted.length >= 3 ? 9 : sorted.length === 2 ? (size >= 42 ? 12 : 10) : (size >= 42 ? 14 : 12);
  const numSize = size >= 42 ? 10 : 9;
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer">
      <span style="font-size:${emSize}px;line-height:1;white-space:nowrap">${emojis}</span>
      <span style="font-size:${numSize}px;font-weight:700;color:white;line-height:1">${count}</span>
    </div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
