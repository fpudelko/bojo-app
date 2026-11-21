// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { podmienSegmenty, KSZTALT_ADRESU } from '@/lib/adresy';
import { middleware } from '@/middleware';

const T = 'e9a3763f-7bd9-99e9-76d6-1c852d6b8f47';
const M = '11111111-2222-4333-8444-555555555555';

describe('adres z nazwą w pasku przeglądarki', () => {
  it('podmienia uuid turnieju i meczu na nazwę i numer', () => {
    expect(podmienSegmenty(`/turnieje/${T}/mecz/${M}`, { [T]: 'gramy-dla-marysi-28-11-2026', [M]: '5' }))
      .toBe('/turnieje/gramy-dla-marysi-28-11-2026/mecz/5');
  });
  it('nie rusza innych segmentów', () => {
    expect(podmienSegmenty(`/turnieje/${T}/panel`, { [T]: 'a-1' })).toBe('/turnieje/a-1/panel');
  });
  it('kształt adresu jak CHECK w migracji 177', () => {
    expect(KSZTALT_ADRESU.test('gramy-dla-marysi-28-11-2026')).toBe(true);
    expect(KSZTALT_ADRESU.test('Gramy dla Marysi')).toBe(false);
    expect(KSZTALT_ADRESU.test('-zle-')).toBe(false);
  });
});

describe('middleware: adres z nazwą → trasa z uuid', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'klucz');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('adresy_z_nazwa') && url.includes('slug=eq.gramy-dla-marysi-28-11-2026')) {
        return new Response(JSON.stringify([{ turniej_id: T }]), { status: 200 });
      }
      if (url.includes('adresy_z_nazwa') && url.includes('slug=eq.czwartkowa-gierka-27-11-2026')) {
        return new Response(JSON.stringify([{ event_id: M }]), { status: 200 });
      }
      if (url.includes('turniej_mecze') && url.includes('numer=eq.5')) {
        return new Response(JSON.stringify([{ id: M }]), { status: 200 });
      }
      return new Response('[]', { status: 200 });
    }));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  const przepisanie = async (sciezka: string) => {
    const odp = await middleware(new NextRequest(`https://bojo.pl${sciezka}`));
    const cel = odp.headers.get('x-middleware-rewrite');
    return cel ? new URL(cel).pathname : null;
  };

  it('turniej z nazwą trafia na trasę z uuid', async () => {
    expect(await przepisanie('/turnieje/gramy-dla-marysi-28-11-2026')).toBe(`/turnieje/${T}`);
  });
  it('podstrona turnieju też', async () => {
    expect(await przepisanie('/turnieje/gramy-dla-marysi-28-11-2026/panel')).toBe(`/turnieje/${T}/panel`);
  });
  it('mecz turnieju po numerze', async () => {
    expect(await przepisanie('/turnieje/gramy-dla-marysi-28-11-2026/mecz/5')).toBe(`/turnieje/${T}/mecz/${M}`);
  });
  it('zwykły mecz z nazwą', async () => {
    expect(await przepisanie('/wydarzenia/czwartkowa-gierka-27-11-2026')).toBe(`/wydarzenia/${M}`);
  });
  it('uuid, „nowe” i nieznany adres przechodzą bez zmian', async () => {
    expect(await przepisanie(`/turnieje/${T}`)).toBeNull();
    expect(await przepisanie('/wydarzenia/nowe')).toBeNull();
    expect(await przepisanie('/turnieje/nie-ma-takiego')).toBeNull();
  });
});
