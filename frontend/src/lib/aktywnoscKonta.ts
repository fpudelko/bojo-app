import { supabase } from '@/lib/supabase';

/**
 * Czy użytkownik ma już jakąś aktywność: zorganizowany mecz, udział w meczu,
 * lub członkostwo w grupie. Potrzebne do PostSignupRoleModal — jeśli ma
 * aktywność, modalna nie pojawia się, użytkownik od razu widzi swoją rolę
 * z historii, a nie jest proszony żeby ją wybrać.
 */
export async function maJuzAktywnosc(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;

  try {
    const timeoutMs = 3000;

    const checkActivity = async (table: string): Promise<boolean> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        return (count ?? 0) > 0;
      } finally {
        clearTimeout(timeout);
      }
    };

    const [hasEvents, hasParticipations, hasGroupMemberships] = await Promise.all([
      checkActivity('events').catch(() => false),
      checkActivity('event_participants').catch(() => false),
      checkActivity('group_members').catch(() => false),
    ]);

    return hasEvents || hasParticipations || hasGroupMemberships;
  } catch {
    return false;
  }
}
