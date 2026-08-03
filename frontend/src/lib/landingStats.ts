import { supabase } from '@/lib/supabase';

/**
 * Server-only: counted at render time so the landing never quotes a stale
 * number. map_visibility='public' is the same filter sitemap.ts and
 * FieldsTeaser use. Rounded down to the nearest 50 so the figure never
 * overstates the real count.
 */
export async function getPublicVenueCount(): Promise<number | null> {
  try {
    const { count } = await supabase
      .from('fields')
      .select('id', { count: 'exact', head: true })
      .eq('map_visibility', 'public');
    if (!count) return null;
    return Math.floor(count / 50) * 50;
  } catch {
    return null;
  }
}
