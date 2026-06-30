import { supabase } from './supabase';
import type { Field, FieldFilters, FieldsResponse, BookingType, MapVisibility } from '@/types';
import { slugify } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Row mappers  (DB snake_case → TS camelCase)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toField(row: any): Field {
  const bookingType: BookingType = row.booking_type ?? 'none';
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: Number(row.lat),
    lng: Number(row.lng),
    sport: row.sport ?? [],
    available: row.available,
    surface: row.surface ?? '',
    isIndoor: row.is_indoor,
    isBookable: bookingType === 'internal',
    bookingType,
    bookingUrl: row.booking_url ?? undefined,
    bookingEnabled: row.booking_enabled ?? false,
    managerId: row.manager_id ?? undefined,
    phone: row.contact_visible ? (row.phone ?? undefined) : undefined,
    website: row.website ?? undefined,
    email: row.contact_visible ? (row.email ?? undefined) : undefined,
    contactVisible: row.contact_visible ?? false,
    operator: row.operator ?? undefined,
    operatorType: row.operator_type ?? undefined,
    description: row.description ?? undefined,
    imageUrl: row.image_url ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    photoReference: row.photo_reference ?? undefined,
    photoSource: row.photo_source ?? undefined,
    openingHours: row.opening_hours ?? undefined,
    postcode: row.postcode ?? undefined,
    lit: row.lit ?? undefined,
    access: row.access ?? undefined,
    fee: row.fee ?? undefined,
    hasChangingRooms: row.has_changing_rooms ?? undefined,
    hasShower: row.has_shower ?? undefined,
    hasToilets: row.has_toilets ?? undefined,
    capacity: row.capacity ?? undefined,
    mapVisibility: (row.map_visibility ?? 'organizer_only') as MapVisibility,
    district: row.district ?? undefined,
    venueType: row.venue_type ?? undefined,
    dimensionsM: row.dimensions_m ?? undefined,
    accessType: row.access_type ?? undefined,
    isVerifiedVenue: row.is_verified_venue ?? undefined,
    condition: row.condition ?? undefined,
    aiTypedAt: row.ai_typed_at ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export async function getFields(filters?: FieldFilters): Promise<FieldsResponse> {
  let query = supabase.from('fields').select('*', { count: 'exact' });

  if (filters?.sport) {
    query = query.contains('sport', [filters.sport]);
  }
  if (filters?.available) {
    query = query.eq('available', true);
  }
  if (filters?.managerId) {
    query = query.eq('manager_id', filters.managerId);
  }
  if (filters?.bookable !== undefined) {
    query = query.eq('is_bookable', filters.bookable);
  }
  if (filters?.bookingType !== undefined) {
    query = query.eq('booking_type', filters.bookingType);
  }
  if (filters?.mapVisibility !== undefined) {
    query = query.eq('map_visibility', filters.mapVisibility);
  }
  if (filters?.search?.trim()) {
    // Match by venue name or address (case-insensitive).
    const term = filters.search.trim();
    query = query.or(`name.ilike.%${term}%,address.ilike.%${term}%`);
  }
  if (filters?.limit !== undefined) {
    const from = filters.offset ?? 0;
    query = query.range(from, from + filters.limit - 1);
  } else {
    query = query.limit(10000);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return { fields: (data ?? []).map(toField), total: count ?? 0 };
}

export async function createManagedField(
  data: Pick<Field, 'name' | 'address' | 'lat' | 'lng' | 'sport' | 'surface' | 'isIndoor' | 'bookingType' | 'bookingUrl' | 'available' | 'phone' | 'website'>,
  managerId: string,
): Promise<string> {
  const bookingType = data.bookingType ?? 'internal';
  const { data: row, error } = await supabase
    .from('fields')
    .insert({
      name: data.name,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      sport: data.sport,
      surface: data.surface,
      is_indoor: data.isIndoor,
      is_bookable: bookingType === 'internal',
      booking_type: bookingType,
      booking_url: data.bookingUrl ?? null,
      available: data.available ?? true,
      manager_id: managerId,
      phone: data.phone ?? null,
      website: data.website ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return row.id as string;
}

export async function updateFieldBookingSettings(
  fieldId: string,
  bookingType: BookingType,
  bookingUrl?: string,
  bookingEnabled?: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('fields')
    .update({
      booking_type: bookingType,
      booking_url: bookingUrl ?? null,
      is_bookable: bookingType === 'internal',
      ...(bookingEnabled !== undefined ? { booking_enabled: bookingEnabled } : {}),
    })
    .eq('id', fieldId);
  if (error) throw new Error(error.message);
}

export async function getField(fieldId: string): Promise<Field> {
  const { data, error } = await supabase
    .from('fields')
    .select('*')
    .eq('id', fieldId)
    .single();

  if (error) throw new Error(error.message);
  return toField(data);
}

export async function getFieldBySlug(slug: string): Promise<Field | null> {
  const { data } = await supabase.from('fields').select('*');
  const match = (data ?? []).find((row) => slugify(row.name) === slug);
  return match ? toField(match) : null;
}

export async function getAllFieldSlugs(): Promise<{ slug: string; id: string }[]> {
  const { data } = await supabase.from('fields').select('id, name');
  return (data ?? []).map((row) => ({ slug: slugify(row.name), id: row.id }));
}

export async function updateField(
  fieldId: string,
  data: Pick<Field, 'name' | 'address' | 'sport' | 'available' | 'surface' | 'isIndoor' | 'phone' | 'website'> & { contactVisible?: boolean },
): Promise<void> {
  const { error } = await supabase
    .from('fields')
    .update({
      name: data.name,
      address: data.address,
      sport: data.sport,
      available: data.available,
      surface: data.surface,
      is_indoor: data.isIndoor,
      phone: data.phone ?? null,
      website: data.website ?? null,
      ...(data.contactVisible !== undefined ? { contact_visible: data.contactVisible } : {}),
    })
    .eq('id', fieldId);
  if (error) throw new Error(error.message);
}
