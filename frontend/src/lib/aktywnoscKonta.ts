import { supabase } from '@/lib/supabase';

/**
 * Czy użytkownik ma już jakąś aktywność: zorganizowany mecz, udział w meczu,
 * lub członkostwo w grupie. Potrzebne do PostSignupRoleModal — jeśli ma
 * aktywność, modalna nie pojawia się, użytkownik od razu widzi swoją rolę
 * z historii, a nie jest proszony żeby ją wybrać.
 */
export async function maJuzAktywnosc(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;

  const [{ count: eventCount }, { count: participantCount }, { count: groupCount }] = await Promise.all([
    // Zorganizowane mecze
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    // Udziały w meczach
    supabase
      .from('event_participants')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    // Członkostwo w grupach
    supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  return (eventCount ?? 0) > 0 || (participantCount ?? 0) > 0 || (groupCount ?? 0) > 0;
}
