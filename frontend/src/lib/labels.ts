// Central place for human-readable Polish labels and venue imagery.

export const SURFACE_LABELS: Record<string, string> = {
  grass: 'Trawa naturalna',
  natural: 'Trawa naturalna',
  artificial: 'Sztuczna trawa',
  astroturf: 'Sztuczna trawa',
  concrete: 'Beton',
  asphalt: 'Asfalt',
  tartan: 'Tartan',
  hardcourt: 'Nawierzchnia twarda',
  clay: 'Mączka ceglana',
  sand: 'Piasek',
  rubber: 'Nawierzchnia gumowa',
  wood: 'Parkiet',
  paving_stones: 'Kostka brukowa',
};

export function surfaceLabel(surface?: string | null): string {
  if (!surface) return '';
  return SURFACE_LABELS[surface.toLowerCase()] ?? surface;
}

/**
 * Aerial photo of a venue from Mapbox Static Images API (satellite view
 * centred on the field's coordinates). Legal, free with the existing token,
 * and shows the actual pitch from above. Returns null if no token/coords.
 */
/**
 * Returns the best available photo URL for a field:
 * 1. Google Places proxy (/api/venue-photo?ref=…)
 * 2. Stored photo_url (Wikimedia CC or Mapbox satellite from scraper)
 * 3. On-the-fly Mapbox satellite fallback
 */
export function fieldPhotoUrl(
  field: { photoReference?: string; photoUrl?: string; imageUrl?: string; lat?: number; lng?: number },
  width = 480,
  height = 240,
): string | null {
  if (field.photoReference) return `/api/venue-photo?ref=${encodeURIComponent(field.photoReference)}&w=${width}`;
  if (field.photoUrl) return field.photoUrl;
  if (field.imageUrl) return field.imageUrl;
  return venueThumbnail(field.lat, field.lng, width, height);
}

export function venueThumbnail(
  lat?: number,
  lng?: number,
  width = 480,
  height = 240,
  zoom = 16,
): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || lat == null || lng == null) return null;
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lng},${lat},${zoom},0/${width}x${height}@2x?access_token=${token}`;
}
