import { supabase } from './supabase';
import { validateName } from './validation';
import { getEventsByGroup, toEvent } from './events';
import { track } from './analytics';
import { zaktualizujJedenWiersz } from './zapytania';
import type { Group, GroupMember, GroupPermissions, GroupWithNext, EventItem } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGroup(row: any): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    sport: row.sport ?? undefined,
    city: row.city ?? undefined,
    createdBy: row.created_by ?? undefined,
    joinCode: row.join_code,
    createdAt: row.created_at,
    memberCount: Array.isArray(row.group_members) ? row.group_members.length : undefined,
    coverImageUrl: row.cover_image_url ?? undefined,
    fieldId: row.field_id ?? undefined,
    fieldName: row.field_name ?? undefined,
    joinCodeRotatedAt: row.join_code_rotated_at ?? undefined,
  };
}

/**
 * Uprawnienia wyliczone TAK SAMO, jak robi to trigger `ustaw_role_czlonka`
 * w bazie (migracja `092`): założyciel ma zawsze komplet, niezależnie od
 * tego, co siedzi w wierszu `group_members`. Czysta funkcja — UI może jej
 * użyć od razu, bez czekania na drugi round-trip do bazy.
 */
export function uprawnieniaCzlonka(
  group: Pick<Group, 'createdBy'>,
  member: Pick<GroupMember, 'userId' | 'canManageMembers' | 'canCreateEvents' | 'canModerateWall' | 'canInvite'> | null | undefined,
): GroupPermissions {
  const isFounder = !!group.createdBy && !!member && group.createdBy === member.userId;
  if (isFounder) {
    return { isFounder: true, canManageMembers: true, canCreateEvents: true, canModerateWall: true, canInvite: true };
  }
  return {
    isFounder: false,
    canManageMembers: !!member?.canManageMembers,
    canCreateEvents: !!member?.canCreateEvents,
    canModerateWall: !!member?.canModerateWall,
    canInvite: !!member?.canInvite,
  };
}

export async function createGroup(
  data: { name: string; description?: string; sport?: string; city?: string; fieldId?: string; fieldName?: string },
  userId: string,
): Promise<string> {
  const safeName = validateName(data.name, 'Nazwa grupy', 60);
  const { data: row, error } = await supabase
    .from('groups')
    .insert({
      name: safeName,
      description: data.description?.trim() || null,
      sport: data.sport || null,
      city: data.city?.trim() || null,
      field_id: data.fieldId || null,
      field_name: data.fieldName?.trim() || null,
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  track('group_created', { groupId: row.id, sport: data.sport });
  return row.id as string;
}

/** Update a group's details. RLS ("Zalozyciel lub zarzadzajacy edytuje grupe",
 *  migracja `092`) restricts this to the founder or a can_manage_members
 *  delegate, so callers should also gate the UI on `uprawnieniaCzlonka()`. */
export async function updateGroup(
  groupId: string,
  data: { name: string; description?: string; sport?: string; city?: string; fieldId?: string; fieldName?: string },
): Promise<void> {
  const safeName = validateName(data.name, 'Nazwa grupy', 60);
  const { error } = await supabase
    .from('groups')
    .update({
      name: safeName,
      description: data.description?.trim() || null,
      sport: data.sport || null,
      city: data.city?.trim() || null,
      field_id: data.fieldId || null,
      field_name: data.fieldName?.trim() || null,
    })
    .eq('id', groupId);
  if (error) throw new Error(error.message);
}

/** Groups the user belongs to, with member counts. */
export async function getMyGroups(userId: string): Promise<Group[]> {
  const { data: memberRows, error: mErr } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  if (mErr) throw new Error(mErr.message);

  const ids = (memberRows ?? []).map((r) => r.group_id as string);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('groups')
    .select('*, group_members(id)')
    .in('id', ids)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toGroup);
}

/**
 * Grupy użytkownika razem z najbliższym meczem każdej z nich — karta na
 * `/grupy` ma odpowiadać od razu na pytanie „kiedy gramy", nie tylko „jak się
 * nazywa ekipa". Dwa zapytania na cały ekran: lista grup, potem jedno
 * zbiorcze `events.in('group_id', ids)` posortowane rosnąco, złożone w mapę
 * `groupId → pierwszy nadchodzący`.
 */
export async function getMyGroupsZTerminem(userId: string): Promise<GroupWithNext[]> {
  const groups = await getMyGroups(userId);
  if (groups.length === 0) return [];

  const dzis = new Date().toISOString().slice(0, 10);
  const { data: eventRows, error } = await supabase
    .from('events')
    // event_participants — bez tego karta ekipy na `/grupy` nie ma jak
    // pokazać paska zapełnienia składu, tylko gołą nazwę i termin.
    .select('*, event_participants(id, is_reserve, pending_approval)')
    .in('group_id', groups.map((g) => g.id))
    .neq('status', 'cancelled')
    .gte('event_date', dzis)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true });
  if (error) throw new Error(error.message);

  const nextByGroup = new Map<string, EventItem>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (eventRows ?? []) as any[]) {
    const groupId = row.group_id as string | null;
    if (!groupId || nextByGroup.has(groupId)) continue;
    nextByGroup.set(groupId, toEvent(row));
  }

  // Lista /grupy ma odpowiadać na "kiedy gramy najbliżej" — grupa z terminem
  // jutro idzie przed grupą z terminem za miesiąc, niezależnie od tego, kiedy
  // która ekipa powstała. Grupy bez terminu lądują na końcu, w kolejności
  // z `getMyGroups()` (created_at malejąco) — `.sort()` w V8 jest stabilny,
  // więc wystarczy nie zwracać 0 tylko dla par bez terminu.
  return groups
    .map((g) => ({ ...g, nextEvent: nextByGroup.get(g.id) }))
    .sort((a, b) => {
      if (a.nextEvent && b.nextEvent) {
        const ak = `${a.nextEvent.date}T${a.nextEvent.time}`;
        const bk = `${b.nextEvent.date}T${b.nextEvent.time}`;
        return ak < bk ? -1 : ak > bk ? 1 : 0;
      }
      if (a.nextEvent) return -1;
      if (b.nextEvent) return 1;
      return 0;
    });
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*, group_members(id)')
    .eq('id', groupId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toGroup(data) : null;
}

export async function getGroupByCode(code: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*, group_members(id)')
    .eq('join_code', code.toUpperCase().trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toGroup(data) : null;
}

/**
 * Members of a group, with display name + avatar + permissions.
 *
 * Nazwa: `profiles.display_name` PRZED nazwą z ostatniego udziału w meczu.
 * Wcześniej brano wyłącznie `event_participants.name`, więc świeży członek,
 * który jeszcze nigdzie w Bojo nie grał, był bezimienny („Gracz") mimo że
 * jego profil ma imię i nazwisko od rejestracji.
 */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data: rows, error } = await supabase
    .from('group_members')
    .select('id, group_id, user_id, role, joined_at, can_manage_members, can_create_events, can_moderate_wall, can_invite, invited_by')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return [];

  const userIds = rows.map((r) => r.user_id as string);

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, avatar_url, display_name')
    .in('id', userIds);
  const avatarMap = Object.fromEntries(
    (profileRows ?? []).filter((p) => p.avatar_url).map((p) => [p.id, p.avatar_url as string]),
  );
  const profileNameMap = Object.fromEntries(
    (profileRows ?? []).filter((p) => p.display_name).map((p) => [p.id, p.display_name as string]),
  );

  // Fallback dla kont bez display_name: nazwa z ostatniego udziału w meczu.
  const { data: nameRows } = await supabase
    .from('event_participants')
    .select('user_id, name, created_at')
    .in('user_id', userIds)
    .eq('is_guest', false)
    .order('created_at', { ascending: false });
  const participationNameMap: Record<string, string> = {};
  for (const r of nameRows ?? []) {
    if (r.user_id && !participationNameMap[r.user_id]) participationNameMap[r.user_id] = r.name as string;
  }

  return rows.map((r) => ({
    id: r.id,
    groupId: r.group_id,
    userId: r.user_id,
    role: r.role,
    joinedAt: r.joined_at,
    canManageMembers: !!r.can_manage_members,
    canCreateEvents: !!r.can_create_events,
    canModerateWall: !!r.can_moderate_wall,
    canInvite: !!r.can_invite,
    invitedBy: r.invited_by ?? undefined,
    name: profileNameMap[r.user_id] ?? participationNameMap[r.user_id] ?? 'Gracz',
    avatarUrl: avatarMap[r.user_id],
  }));
}

export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const { count } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('user_id', userId);
  return (count ?? 0) > 0;
}

/** Moje uprawnienia w grupie — `null`, gdy nie jestem członkiem. */
export async function getMyGroupPermissions(groupId: string, userId: string): Promise<GroupPermissions | null> {
  const [{ data: groupRow, error: gErr }, { data: memberRow, error: mErr }] = await Promise.all([
    supabase.from('groups').select('created_by').eq('id', groupId).maybeSingle(),
    supabase.from('group_members')
      .select('user_id, can_manage_members, can_create_events, can_moderate_wall, can_invite')
      .eq('group_id', groupId).eq('user_id', userId).maybeSingle(),
  ]);
  if (gErr) throw new Error(gErr.message);
  if (mErr) throw new Error(mErr.message);
  if (!memberRow) return null;
  return uprawnieniaCzlonka(
    { createdBy: groupRow?.created_by ?? undefined },
    {
      userId: memberRow.user_id,
      canManageMembers: memberRow.can_manage_members,
      canCreateEvents: memberRow.can_create_events,
      canModerateWall: memberRow.can_moderate_wall,
      canInvite: memberRow.can_invite,
    },
  );
}

/** Ustawia cztery przełączniki uprawnień jednego członka. RLS (migracje
 *  `092`, `096`) przepuszcza to wyłącznie założycielowi —
 *  `zaktualizujJedenWiersz` zamienia odmowę w wyjątek, zamiast pozwolić
 *  przyciskowi „nic nie robić" po cichu. */
export async function setMemberPermissions(
  memberRowId: string,
  perms: { canManageMembers: boolean; canCreateEvents: boolean; canModerateWall: boolean; canInvite: boolean },
): Promise<void> {
  await zaktualizujJedenWiersz(
    'group_members',
    memberRowId,
    {
      can_manage_members: perms.canManageMembers,
      can_create_events: perms.canCreateEvents,
      can_moderate_wall: perms.canModerateWall,
      can_invite: perms.canInvite,
    },
    'Nie udało się zmienić uprawnień',
  );
}

/** Dołączenie kodem zaproszenia — jedyna droga samodzielnego wejścia do grupy
 *  od migracji `094` (polityka INSERT na `group_members` została zdjęta).
 *  `od` to `?od=<uuid>` z linku zaproszenia; baza sama sprawdza, czy ta osoba
 *  naprawdę należy do grupy, zanim zapisze ją jako zapraszającego. */
export async function joinGroupByCode(code: string, od?: string): Promise<string> {
  const { data, error } = await supabase.rpc('dolacz_do_grupy_kodem', {
    p_code: code.toUpperCase().trim(),
    p_od: od ?? null,
  });
  if (error) throw new Error(error.message);
  track('group_joined', { groupId: data as string, zZaproszenia: !!od });
  return data as string;
}

/** Dopisanie osoby do grupy bez kodu — dla kogoś z `can_manage_members`. */
export async function addMemberToGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('dodaj_czlonka_do_grupy', { p_group_id: groupId, p_user_id: userId });
  if (error) throw new Error(error.message);
}

/** Unieważnia stary link/kod i zwraca nowy — wyłącznie założyciel. */
export async function regenerateJoinCode(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc('odswiez_kod_grupy', { p_group_id: groupId });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Kto zaprosił: publiczny profil, zwracany tylko gdy naprawdę należy do tej
 *  grupy (patrz komentarz w `dolacz_do_grupy_kodem`, migracja `094`). Dla
 *  lądowania `/g/[kod]` — „Marek zaprasza Cię do ekipy". */
export async function getInviter(userId: string, groupId: string): Promise<{ name: string; avatarUrl?: string } | null> {
  const { data: memberRow } = await supabase
    .from('group_members').select('user_id').eq('group_id', groupId).eq('user_id', userId).maybeSingle();
  if (!memberRow) return null;
  const { data: profile } = await supabase
    .from('profiles').select('display_name, avatar_url').eq('id', userId).maybeSingle();
  if (!profile?.display_name) return null;
  return { name: profile.display_name, avatarUrl: profile.avatar_url ?? undefined };
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Nie udało się opuścić grupy — spróbuj ponownie.');
  }
}

/** Usuwa innego członka — wymaga `can_manage_members` (RLS, migracja `092`).
 *  `.select('id')` po `.delete()` zamienia cichą odmowę RLS (zero usuniętych
 *  wierszy, brak błędu) w jawny wyjątek. */
export async function removeMember(groupId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Nie udało się usunąć gracza — brak uprawnień albo już go tu nie ma.');
  }
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) throw new Error(error.message);
}

/** Zapisuje adres okładki grupy.
 *
 *  Wcześniej strona grupy robiła to inline w JSX: dynamiczny import klienta
 *  Supabase i surowy `update` w środku komponentu — jedyna mutacja grupy poza
 *  lib/. RLS („Creator updates group") i tak przepuści to wyłącznie
 *  założycielowi, ale interfejs też powinien pytać o to w jednym miejscu. */
export async function setGroupCover(groupId: string, url: string | null): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .update({ cover_image_url: url })
    .eq('id', groupId);
  if (error) throw new Error(error.message);
}

/** Events attached to a group, newest first. */
export async function getGroupEvents(groupId: string): Promise<EventItem[]> {
  return getEventsByGroup(groupId);
}
