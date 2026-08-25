import { describe, it, expect, vi, beforeEach } from 'vitest';

// D11 (docs/seo-geo-strategia.md, rozdział 0): huby katalogu `/boiska/[sport]`
// i `/boiska/woj/[wojewodztwo]` listowały obiekty BEZ filtra po `seo_tier`,
// więc same linkowały do stron Tier 3, którym `boisko/[id]/page.tsx` daje
// `robots: {index: false}` — własny hub wydawał budżet skanowania na strony,
// których broni tiering z migracji 112. Ten test nagrywa dokładne wywołanie
// `.in()`, żeby refaktor nie zgubił filtra po cichu — tak jak zgubił go
// pierwotnie, bez żadnego błędu widocznego w interfejsie.
const { chain, fromMock } = vi.hoisted(() => {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'contains', 'eq', 'in', 'order', 'range'];
  methods.forEach((m) => {
    c[m] = vi.fn(() => c);
  });
  return { chain: c, fromMock: vi.fn(() => c) };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: fromMock } }));

import { obiektyHubuSportu, obiektyHubuWojewodztwa, metadanePaginacjiHuba } from '@/lib/hubKatalogu';

beforeEach(() => {
  Object.values(chain).forEach((fn) => fn.mockClear());
  fromMock.mockClear();
});

describe('obiektyHubuSportu', () => {
  it('zawęża listę do Tier 1/2', async () => {
    await obiektyHubuSportu('piłka nożna', 0, 59);
    expect(fromMock).toHaveBeenCalledWith('fields');
    expect(chain.contains).toHaveBeenCalledWith('sport', ['piłka nożna']);
    expect(chain.eq).toHaveBeenCalledWith('map_visibility', 'public');
    expect(chain.in).toHaveBeenCalledWith('seo_tier', [1, 2]);
  });
});

describe('obiektyHubuWojewodztwa', () => {
  it('zawęża listę do Tier 1/2', async () => {
    await obiektyHubuWojewodztwa('wielkopolskie', 0, 59);
    expect(fromMock).toHaveBeenCalledWith('fields');
    expect(chain.eq).toHaveBeenCalledWith('voivodeship', 'wielkopolskie');
    expect(chain.eq).toHaveBeenCalledWith('map_visibility', 'public');
    expect(chain.in).toHaveBeenCalledWith('seo_tier', [1, 2]);
  });
});

// D15 (docs/seo-geo-strategia.md, rozdział 0): `?strona=N` na hubach dostawało
// self-referencing canonical, ale nigdy `noindex` — paginacja bez końca,
// z każdą stroną w indeksie na równi ze stroną 1.
describe('metadanePaginacjiHuba', () => {
  it('strona 1: canonical bez query, bez robots (indeksowalna)', () => {
    expect(metadanePaginacjiHuba('/boiska/pilka-nozna', 1)).toEqual({
      canonical: '/boiska/pilka-nozna',
      robots: undefined,
    });
  });

  it('strona 2+: canonical self-referencing, noindex/follow', () => {
    expect(metadanePaginacjiHuba('/boiska/pilka-nozna', 3)).toEqual({
      canonical: '/boiska/pilka-nozna?strona=3',
      robots: { index: false, follow: true },
    });
  });
});
