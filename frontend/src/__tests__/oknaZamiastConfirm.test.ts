import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// Systemowe `confirm()` na ścieżce organizatora zostało wymiecione przy
// ustaleniu `O-38` — a mimo to jedno wystąpienie przetrwało do 2026-09-03:
// „Otwórz dla okolicy" w `CzyGramyPanel.tsx`, przeoczone, bo siedzi
// w komponencie POTOMNYM, a nie na samej stronie meczu.
//
// Trzy powody, dla których to nie jest kosmetyka (za komentarzem w
// `components/ui/OknoPotwierdzenia.tsx`): na telefonie systemowe okno czyta się
// jak błąd strony, mieści JEDNO zdanie — więc nie powie, kto dostanie
// powiadomienie ani czy da się to cofnąć — i nie pokazuje stanu zapisu.
//
// Ten test jest bramką, nie sprzątaniem: pilnuje, żeby `confirm()` nie wrócił
// tam, gdzie decyzje podejmuje organizator. Panel administratora i rezerwacje
// (za wyłączoną flagą) są świadomie POZA zakresem — tam pyta się kogoś innego
// i w innym kontekście.
const KATALOGI = [
  path.join('src', 'app', 'wydarzenia'),
  path.join('src', 'app', 'grupy'),
  path.join('src', 'app', 'moje-gry'),
  path.join('src', 'components', 'events'),
  path.join('src', 'components', 'groups'),
];

function pliki(katalog: string): string[] {
  const pelny = path.join(process.cwd(), katalog);
  const wynik: string[] = [];
  const zejdz = (dir: string) => {
    for (const wpis of readdirSync(dir)) {
      const p = path.join(dir, wpis);
      if (statSync(p).isDirectory()) zejdz(p);
      else if (/\.tsx?$/.test(wpis)) wynik.push(p);
    }
  };
  zejdz(pelny);
  return wynik;
}

describe('okna potwierdzeń zamiast confirm() przeglądarki', () => {
  it('na ścieżce organizatora nie ma ani jednego confirm()', () => {
    const winne: string[] = [];
    for (const katalog of KATALOGI) {
      for (const plik of pliki(katalog)) {
        const tresc = readFileSync(plik, 'utf8');
        // `window.confirm(` albo gołe `confirm(` — ale nie `potwierdz(`
        // ani słowo „confirm" w nazwie zmiennej czy w komentarzu.
        // Komentarze (oba rodzaje) odpadają PRZED sprawdzeniem: opis „kiedyś
        // było tu confirm()" jest dokumentacją, nie wywołaniem.
        const kod = tresc
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/[^\n]*/g, '');
        if (/(^|[^.\w])(window\.)?confirm\s*\(/m.test(kod)) {
          winne.push(path.relative(process.cwd(), plik));
        }
      }
    }
    expect(winne, `użyj usePotwierdzenie() zamiast confirm() w: ${winne.join(', ')}`).toEqual([]);
  });
});
