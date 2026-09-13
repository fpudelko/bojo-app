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

  // Wariant "krotko" (strona meczu, obok pigułek "Prywatne"/nazwa ekipy) nie
  // powtarza tego, co pigułki już mówią — bez "Prywatny —" i bez nazwy grupy.
  describe('krotko', () => {
    it('drops the visibility word and group name for a private match', () => {
      const opis = opisWidocznosciWGrupie('private', 'Czwartkowa Gierka', 14, true);
      expect(opis).not.toContain('Czwartkowa Gierka');
      expect(opis).not.toMatch(/^Prywatny/);
      expect(opis).toMatch(/14 członków/);
    });

    it('stays a single short line for a public match', () => {
      const opis = opisWidocznosciWGrupie('public', 'Czwartkowa Gierka', 14, true);
      expect(opis).not.toContain('Czwartkowa Gierka');
      expect(opis).not.toMatch(/^Publiczny/);
    });

    it('still returns null without a group, same as the long form', () => {
      expect(opisWidocznosciWGrupie('private', undefined, undefined, true)).toBeNull();
    });
  });
});
