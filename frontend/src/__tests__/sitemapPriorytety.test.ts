import { describe, it, expect, vi } from 'vitest';

// D10 (docs/seo-geo-strategia.md, rozdział 0): /mapa, /wydarzenia i /grupy
// dostawały priorytet WYŻSZY albo równy stronom treści, mimo że są dla
// robota puste — wszystkie trzy dociągają listę po zamontowaniu, a /mapa to
// czysty klient (Leaflet, ssr:false). Ten test pilnuje relacji, nie
// konkretnych liczb, żeby nie trzeba było go poprawiać przy każdej korekcie
// priorytetu gdzie indziej w pliku.
vi.mock('@/lib/hubMiasta', () => ({ paryHubowMiastSportu: vi.fn().mockResolvedValue([]) }));

import sitemap from '@/app/sitemap';

describe('sitemap — priorytet tras renderowanych po stronie klienta', () => {
  it('/mapa, /wydarzenia i /grupy mają priorytet niższy niż strony treści', async () => {
    const wpisy = await sitemap();
    const priorytet = (url: string) => wpisy.find((w) => w.url.endsWith(url))?.priority;

    const tresc = priorytet('/jak-dziala-bojo')!;
    expect(priorytet('/mapa')).toBeLessThan(tresc);
    expect(priorytet('/wydarzenia')).toBeLessThan(tresc);
    expect(priorytet('/grupy')).toBeLessThan(tresc);
  });

  it('/mapa (czysty klient, zero treści) ma priorytet niższy niż /wydarzenia (ma serwerowe metadane i stopkę)', async () => {
    const wpisy = await sitemap();
    const priorytet = (url: string) => wpisy.find((w) => w.url.endsWith(url))?.priority;

    expect(priorytet('/mapa')).toBeLessThan(priorytet('/wydarzenia')!);
  });
});
