import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { KORZYSCI_KONTA } from '@/content/kontoGoscia';

// F-6 (docs/faza1-organizator-plan.md): jedna lista korzyści konta, renderowana
// w dwóch oknach TSX (okno po zapisie na stronie meczu, `/gracz/przejmij/[token]`)
// i skopiowana ręcznie do maila `zaloz_konto` (funkcja brzegowa `powiadom-goscia`
// jest w Deno i nie importuje z frontendu). Trzy miejsca mówiące o tej samej
// rzeczy rozjeżdżały się już raz (`O-18`/`O-27`/`P-3` — ta sama klasa błędu,
// inne pole) — ten test pilnuje, żeby kopia w mailu nie odjechała od źródła.
const TRESC_MAILA = readFileSync(
  path.join(process.cwd(), '..', 'supabase', 'functions', 'powiadom-goscia', 'tresc.ts'),
  'utf8',
);

describe('KORZYSCI_KONTA — zgodność z mailem zaloz_konto', () => {
  it('lista ma trzy pozycje', () => {
    expect(KORZYSCI_KONTA).toHaveLength(3);
  });

  it.each(KORZYSCI_KONTA)('pozycja „%s” występuje dosłownie w tresc.ts', (pozycja) => {
    expect(TRESC_MAILA).toContain(pozycja);
  });

  it('żadna pozycja nie obiecuje czegoś, czego Bojo dziś nie ma', () => {
    // Dwie nieprawdziwe obietnice sprzed F-6: konto nie dołącza samo do
    // żadnej ekipy, a otwartych gier w okolicy jest dziś za mało.
    for (const pozycja of KORZYSCI_KONTA) {
      expect(pozycja).not.toContain('dołączysz do ekipy');
      expect(pozycja).not.toContain('otwarte gry w okolicy');
    }
  });
});
