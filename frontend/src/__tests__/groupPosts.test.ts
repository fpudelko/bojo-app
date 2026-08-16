import { describe, it, expect, vi, beforeEach } from 'vitest';

const { tables, chainFor, fromMock } = vi.hoisted(() => {
  const tables: Record<string, { data: unknown; error: unknown }> = {};
  const chains: Record<string, any> = {};
  function chainFor(table: string) {
    if (chains[table]) return chains[table];
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'limit'];
    const chain: any = {};
    methods.forEach((m) => { chain[m] = vi.fn(() => chain); });
    chain.single = vi.fn(() => Promise.resolve(tables[table] ?? { data: null, error: null }));
    chain.then = (resolve: (v: unknown) => void) => resolve(tables[table] ?? { data: null, error: null });
    chains[table] = chain;
    return chain;
  }
  const fromMock = vi.fn((table: string) => chainFor(table));
  return { tables, chainFor, fromMock };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: fromMock } }));

import { getGroupPosts, addGroupPost, deleteGroupPost, setGroupPostPinned, nieprzeczytane } from '@/lib/groupPosts';
import type { GroupPost } from '@/types';

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(tables).forEach((k) => delete tables[k]);
});

describe('getGroupPosts', () => {
  it('orders by pinned first, then newest, and maps rows', async () => {
    tables.group_posts = {
      data: [
        { id: 'p2', group_id: 'g1', user_id: 'u1', user_name: 'Jan', body: 'przypięty', pinned_at: '2026-08-10T10:00:00Z', deleted_at: null, created_at: '2026-08-09T10:00:00Z' },
        { id: 'p1', group_id: 'g1', user_id: 'u2', user_name: 'Ola', body: 'zwykły', pinned_at: null, deleted_at: null, created_at: '2026-08-10T12:00:00Z' },
      ],
      error: null,
    };
    const posts = await getGroupPosts('g1');
    expect(posts).toHaveLength(2);
    expect(posts[0].pinnedAt).toBe('2026-08-10T10:00:00Z');
    const chain = chainFor('group_posts');
    expect(chain.order).toHaveBeenCalledWith('pinned_at', { ascending: false, nullsFirst: false });
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});

describe('addGroupPost', () => {
  it('rejects an empty body before touching the network', async () => {
    await expect(addGroupPost('g1', 'u1', 'Jan', '   ')).rejects.toThrow('Wpis nie może być pusty.');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('trims a body longer than 1000 characters so the DB CHECK never fires', async () => {
    tables.group_posts = { data: { id: 'p1', group_id: 'g1', user_id: 'u1', user_name: 'Jan', body: 'x'.repeat(1000), pinned_at: null, deleted_at: null, created_at: '2026-08-10T10:00:00Z' }, error: null };
    const dlugi = 'x'.repeat(1500);
    await addGroupPost('g1', 'u1', 'Jan', dlugi);
    const chain = chainFor('group_posts');
    const insertedRow = chain.insert.mock.calls[0][0];
    expect(insertedRow.body).toHaveLength(1000);
  });

  it('sends a non-null pinned_at when przypnij is true', async () => {
    tables.group_posts = { data: { id: 'p1', group_id: 'g1', user_id: 'u1', user_name: 'Jan', body: 'ważne', pinned_at: '2026-08-10T10:00:00Z', deleted_at: null, created_at: '2026-08-10T10:00:00Z' }, error: null };
    await addGroupPost('g1', 'u1', 'Jan', 'ważne', { przypnij: true });
    const chain = chainFor('group_posts');
    const insertedRow = chain.insert.mock.calls[0][0];
    expect(insertedRow.pinned_at).not.toBeNull();
  });
});

describe('deleteGroupPost', () => {
  it('throws when RLS silently touched zero rows', async () => {
    tables.group_posts = { data: [], error: null };
    await expect(deleteGroupPost('p1')).rejects.toThrow(/Nie udało się usunąć wpisu/);
  });

  it('resolves when the soft-delete touches the row', async () => {
    tables.group_posts = { data: [{ id: 'p1' }], error: null };
    await expect(deleteGroupPost('p1')).resolves.toBeUndefined();
  });
});

describe('setGroupPostPinned', () => {
  it('sends pinned_at: null when unpinning', async () => {
    tables.group_posts = { data: [{ id: 'p1' }], error: null };
    await setGroupPostPinned('p1', false);
    const chain = chainFor('group_posts');
    const lastUpdate = chain.update.mock.calls.at(-1)[0];
    expect(lastUpdate.pinned_at).toBeNull();
  });
});

describe('nieprzeczytane', () => {
  const post = (id: string, createdAt: string): GroupPost => ({
    id, groupId: 'g1', userId: 'u1', userName: 'Jan', body: 'x', createdAt,
  });

  it('counts everything as unread when there is no marker', () => {
    expect(nieprzeczytane([post('p1', '2026-08-10T10:00:00Z')], null)).toBe(1);
  });

  it('counts nothing as unread when the marker is in the future', () => {
    expect(nieprzeczytane([post('p1', '2026-08-10T10:00:00Z')], '2026-08-11T00:00:00Z')).toBe(0);
  });

  it('returns 0 for an empty list', () => {
    expect(nieprzeczytane([], null)).toBe(0);
  });

  it('excludes my own posts — I already saw them when I sent them', () => {
    const wlasny = post('p1', '2026-08-10T10:00:00Z');
    const cudzy = { ...post('p2', '2026-08-10T11:00:00Z'), userId: 'u2' };
    expect(nieprzeczytane([wlasny, cudzy], null, 'u1')).toBe(1);
  });
});
