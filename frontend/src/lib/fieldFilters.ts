import type { Field } from '@/types';

// ---------------------------------------------------------------------------
// Multi-select "what data does this venue have" filters.
// Shared by the public map (/mapa) and the admin outreach panel so the two
// stay consistent. Each key is an AND requirement when selected.
// ---------------------------------------------------------------------------

export type DataKey =
  | 'phone'
  | 'email'
  | 'website'
  | 'address'
  | 'booking'
  | 'hours'
  | 'operator'
  | 'indoor';

export interface DataFilterMeta {
  key: DataKey;
  label: string;
}

/** Filters offered on the public map (only publicly-readable columns). */
export const PUBLIC_DATA_FILTERS: DataFilterMeta[] = [
  { key: 'booking', label: 'Rezerwacja' },
  { key: 'phone', label: 'Telefon' },
  { key: 'website', label: 'Strona WWW' },
  { key: 'address', label: 'Adres z nr' },
  { key: 'hours', label: 'Godziny' },
  { key: 'indoor', label: 'Hala' },
];

/** Filters offered in the outreach panel (includes contact-collection fields). */
export const OUTREACH_DATA_FILTERS: DataFilterMeta[] = [
  { key: 'phone', label: 'Telefon' },
  { key: 'email', label: 'E-mail' },
  { key: 'website', label: 'Strona WWW' },
  { key: 'address', label: 'Adres z nr' },
  { key: 'booking', label: 'System rezerwacji' },
  { key: 'hours', label: 'Godziny' },
  { key: 'operator', label: 'Operator' },
];

export function hasAddressNumber(address?: string): boolean {
  return !!address && /\d/.test(address);
}

/** Does a field satisfy a single data requirement (public columns only). */
export function fieldHasData(f: Field, key: DataKey): boolean {
  switch (key) {
    case 'phone':
      return !!f.phone;
    case 'email':
      return !!f.email;
    case 'website':
      return !!f.website;
    case 'address':
      return hasAddressNumber(f.address);
    case 'booking':
      return f.bookingType !== 'none' || !!f.bookingUrl;
    case 'hours':
      return !!f.openingHours;
    case 'operator':
      return !!f.operator;
    case 'indoor':
      return !!f.isIndoor;
    default:
      return false;
  }
}

/** True when the field satisfies every selected requirement (AND). */
export function fieldMatchesData(f: Field, keys: DataKey[]): boolean {
  return keys.every((k) => fieldHasData(f, k));
}

/** Sorted unique list of districts present in a set of fields. */
export function districtsOf(fields: Field[]): string[] {
  const s = new Set<string>();
  for (const f of fields) if (f.district) s.add(f.district);
  return Array.from(s).sort((a, b) => a.localeCompare(b, 'pl'));
}
