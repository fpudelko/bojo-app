import { supabase } from './supabase';
import { validateName } from './validation';
import { getEventsByGroup } from './events';
import type { Group, GroupMember, EventItem } from '@/types';

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
  };
}

export async function createGroup(
  data: { name: string; description?: string; sport?: string; city?: string },
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
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return row.id as string;
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
 * Members of a group, with display name + avatar. Names come from the most
 * recent participation (event_participants.name), mirroring /gracz/[id].
 */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data: rows, error } = await supabase
    .from('group_members')
    .select('id, group_id, user_id, role, joined_at')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return [];

  const userIds = rows.map((r) => r.user_id as string);

  // Avatars from profiles
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, avatar_url')
    .in('id', userIds);
  const avatarMap = Object.fromEntries(
    (profileRows ?? []).filter((p) => p.avatar_url).map((p) => [p.id, p.avatar_url as string]),
  );

  // Names from latest participation
  const { data: nameRows } = await supabase
    .from('event_participants')
    .select('user_id, name, created_at')
    .in('user_id', userIds)
    .eq('is_guest', false)
    .order('created_at', { ascending: false });
  const nameMap: Record<string, string> = {};
  for (const r of nameRows ?? []) {
    if (r.user_id && !nameMap[r.user_id]) nameMap[r.user_id] = r.name as string;
  }

  return rows.map((r) => ({
    id: r.id,
    groupId: r.group_id,
    userId: r.user_id,
    role: r.role,
    joinedAt: r.joined_at,
    name: nameMap[r.user_id] ?? 'Gracz',
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

export async function joinGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId, role: 'member' });
  // Ignore duplicate (already a member)
  if (error && !error.message.toLowerCase().includes('duplicate')) {
    throw new Error(error.message);
  }
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) throw new Error(error.message);
}

/** Events attached to a group, newest first. */
export async function getGroupEvents(groupId: string): Promise<EventItem[]> {
  return getEventsByGroup(groupId);
}
