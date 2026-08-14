import { describe, it, expect } from 'vitest';
import { opisWidocznosciWGrupie } from '@/lib/eventFeatures';

// `opisWidocznosciWGrupie` — jedyne miejsce w kodzie, które mówi wprost, że
// prywatny mecz przypięty do grupy jest widoczny dla całej ekipy (§7 planu
// „widoczność dla grupy"). Testy przypinają dokładnie te trzy przypadki.
describe('opisWidocznosciWGrupie', () => {
  it('returns null when the match has no group', () => {
    expect(opisWidocznosciWGrupie('private', undefined, undefined)).toBeNull();
  });

  it('states that a private match pinned to a group is visible to the whole crew', () => {
    const opis = opisWidocznosciWGrupie('private', 'Czwartkowa Gierka', 14);
    expect(opis).toContain('Czwartkowa Gierka');
    expect(opis).toMatch(/14 członków/);
    expect(opis).toMatch(/^Prywatny/);
  });

  it('still mentions the group for a public match, without implying it is exclusive', () => {
    const opis = opisWidocznosciWGrupie('public', 'Czwartkowa Gierka', 14);
    expect(opis).toMatch(/^Publiczny/);
    expect(opis).toContain('Czwartkowa Gierka');
  });

  it('falls back to a generic word when the member count is unknown', () => {
    const opis = opisWidocznosciWGrupie('private', 'Czwartkowa Gierka', undefined);
    expect(opis).toContain('członkowie ekipy');
  });
});
