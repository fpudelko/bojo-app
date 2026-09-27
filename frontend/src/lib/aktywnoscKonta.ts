import { supabase } from '@/lib/supabase';

/**
 * Czy użytkownik ma już jakąś aktywność: zorganizowany mecz, udział w meczu,
 * lub członkostwo w grupie. Potrzebne do PostSignupRoleModal — jeśli ma
 * aktywność, modalna nie pojawia się, użytkownik od razu widzi swoją rolę
 * z historii, a nie jest proszony żeby ją wybrać.
 */
export async function maJuzAktywnosc(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;

  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve({ count: 0 }), 3000)
  );

  const queries = Promise.all([
    Promise.race([
      supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      timeoutPromise,
    ]),
    Promise.race([
      supabase
        .from('event_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      timeoutPromise,
    ]),
    Promise.race([
      supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      timeoutPromise,
    ]),
  ]);

  try {
    const [{ count: eventCount }, { count: participantCount }, { count: groupCount }] = await queries;
    return (eventCount ?? 0) > 0 || (participantCount ?? 0) > 0 || (groupCount ?? 0) > 0;
  } catch {
    return false;
  }
}
