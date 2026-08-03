import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSelect, mockEq } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  return { mockSelect, mockEq };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({ select: mockSelect }),
  },
}));

import { getPublicVenueCount } from '@/lib/landingStats';

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReturnValue({ eq: mockEq });
});

describe('getPublicVenueCount', () => {
  it('rounds down to the nearest 50 — never overstates the real count', async () => {
    mockEq.mockResolvedValue({ count: 1387, error: null });
    expect(await getPublicVenueCount()).toBe(1350);
  });

  it('returns null when the count is zero', async () => {
    mockEq.mockResolvedValue({ count: 0, error: null });
    expect(await getPublicVenueCount()).toBeNull();
  });

  it('returns null when Supabase throws', async () => {
    mockEq.mockRejectedValue(new Error('network'));
    expect(await getPublicVenueCount()).toBeNull();
  });

  it('returns null when count is null', async () => {
    mockEq.mockResolvedValue({ count: null, error: null });
    expect(await getPublicVenueCount()).toBeNull();
  });
});
