import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Strażnik kolumn skasowanych migracjami.
//
// Powód powstania: migracja `064_usun_statusy_uczestnika.sql` zdjęła z tabeli
// `event_participants` kolumny `status` i `confirmed_at`, ale `lib/events.ts`
// wysyłał `status` dalej — w TRZECH insertach (organizator przy tworzeniu
// meczu, dołączanie gracza, dopisanie gościa). PostgREST odrzuca insert
// z nieistniejącą kolumną, więc dołączanie do składu przestało działać
// w produkcji, a w jednym z tych miejsc błąd był w dodatku połykany.
//
// TypeScript tego nie złapie: obiekt przekazany do `.insert()` nie jest
// typowany schematem bazy. Repo nie ma też mocków Supabase, więc test
// integracyjny odpada. Zostaje sprawdzenie źródła — tanie i celne akurat dla
// tej klasy błędu.
//
// Gdy kolumna wróci do schematu, usuń ją z listy w tym samym commicie co
// migracja przywracająca.
const SKASOWANE_KOLUMNY = ['status', 'confirmed_at'] as const;

function zrodloEvents(): string {
  return readFileSync(join(process.cwd(), 'src/lib/events.ts'), 'utf8');
}

/** Wycina treść każdego `.from('event_participants').insert({ ... })`. */
function insertyUczestnikow(src: string): string[] {
  const out: string[] = [];
  const marker = "from('event_participants')";
  let from = src.indexOf(marker);
  while (from !== -1) {
    const insertAt = src.indexOf('.insert(', from);
    // Bierzemy tylko wywołania, w których `.insert(` jest tuż obok — inaczej
    // złapalibyśmy `.select()`/`.update()` z dalszej części pliku.
    if (insertAt !== -1 && insertAt - from < 40) {
      const otwarcie = src.indexOf('{', insertAt);
      let glebokosc = 0;
      for (let i = otwarcie; i < src.length; i++) {
        if (src[i] === '{') glebokosc++;
        else if (src[i] === '}') {
          glebokosc--;
          if (glebokosc === 0) { out.push(src.slice(otwarcie, i + 1)); break; }
        }
      }
    }
    from = src.indexOf(marker, from + marker.length);
  }
  return out;
}

describe('lib/events.ts — insert do event_participants nie używa skasowanych kolumn', () => {
  const inserty = insertyUczestnikow(zrodloEvents());

  it('test znajduje inserty, które ma pilnować', () => {
    // Gdyby refaktor zmienił kształt wywołań, ten test zgaśnie jako pierwszy —
    // zamiast po cichu przepuszczać wszystko.
    expect(inserty.length).toBeGreaterThanOrEqual(3);
  });

  for (const kolumna of SKASOWANE_KOLUMNY) {
    it(`żaden insert nie ustawia \`${kolumna}\``, () => {
      const winne = inserty.filter((blok) => new RegExp(`(^|[\\s{,])${kolumna}\\s*:`).test(blok));
      expect(winne).toEqual([]);
    });
  }
});
