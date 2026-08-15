import { describe, it, expect, vi, beforeEach } from 'vitest';

const { chain, fromMock } = vi.hoisted(() => {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'upsert', 'delete', 'eq'];
  methods.forEach((m) => { c[m] = vi.fn(() => c); });
  return { chain: c, fromMock: vi.fn(() => c) };
});

vi.mock('@/lib/supabase', () => ({
  supabase: { from: fromMock },
}));

import { odmow, cofnijOdmowe, getDeclines } from '@/lib/eventDeclines';

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(chain).forEach((fn) => fn.mockReturnValue(chain));
});

describe('odmow', () => {
  it('upserts on (event_id, user_id) so a repeat click never throws a duplicate-key error', async () => {
    chain.upsert.mockResolvedValue({ error: null });
    await odmow('event-1', 'user-1');
    expect(fromMock).toHaveBeenCalledWith('event_declines');
    expect(chain.upsert).toHaveBeenCalledWith(
      { event_id: 'event-1', user_id: 'user-1' },
      { onConflict: 'event_id,user_id' },
    );
  });

  it('throws on a database error', async () => {
    chain.upsert.mockResolvedValue({ error: { message: 'boom' } });
    await expect(odmow('event-1', 'user-1')).rejects.toThrow('boom');
  });
});

describe('cofnijOdmowe', () => {
  it('resolves when the delete removes the row', async () => {
    chain.eq.mockReturnValueOnce(chain).mockReturnValueOnce(chain);
    chain.select.mockResolvedValue({ data: [{ event_id: 'event-1' }], error: null });
    await expect(cofnijOdmowe('event-1', 'user-1')).resolves.toBeUndefined();
  });

  it('throws when RLS silently deleted zero rows, instead of pretending success', async () => {
    chain.select.mockResolvedValue({ data: [], error: null });
    await expect(cofnijOdmowe('event-1', 'user-1')).rejects.toThrow(/Nie udało się cofnąć odmowy/);
  });
});

describe('getDeclines', () => {
  it('maps rows to EventDecline', async () => {
    chain.eq.mockResolvedValue({
      data: [{ event_id: 'event-1', user_id: 'user-1', created_at: '2026-01-01T00:00:00Z' }],
      error: null,
    });
    const rows = await getDeclines('event-1');
    expect(rows).toEqual([{ eventId: 'event-1', userId: 'user-1', createdAt: '2026-01-01T00:00:00Z' }]);
  });
});
