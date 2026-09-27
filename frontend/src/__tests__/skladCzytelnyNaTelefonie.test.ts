import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// PR-J (runda 9): X-2, X-10, X-11. `EventDetailClient.tsx` jest monolitem —
// ten sam wzorzec asercji na tekście źródła co `listaRezerwowa.test.ts` dla
// tego samego pliku, bo pełne wyrenderowanie wymagałoby atrapy większości
// aplikacji (auth, supabase, router).
const stronaMeczu = readFileSync(
  resolve(__dirname, '../app/wydarzenia/[id]/EventDetailClient.tsx'), 'utf8');
const bottomNav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8');
const toast = readFileSync(resolve(__dirname, '../lib/toast.tsx'), 'utf8');
const grupa = readFileSync(resolve(__dirname, '../app/grupy/[id]/GroupDetailClient.tsx'), 'utf8');

describe('X-2: imiona w składzie organizatora nie są ucinane do zera', () => {
  it('brak max-w-[140px] na imieniu — ograniczeniem jest wyłącznie szerokość wiersza', () => {
    expect(stronaMeczu).not.toMatch(/max-w-\[140px\] sm:max-w-\[220px\]/);
  });

  it('akcje „Usuń"/„Na rezerwę" stoją POD imieniem na bazie, obok od `sm:`', () => {
    expect(stronaMeczu).toMatch(/className="flex w-full gap-2 pl-10 sm:ml-auto sm:w-auto sm:pl-0"/);
  });

  it('obie akcje zostają widoczne przy graczu — bez menu „⋯" (decyzja D-6: wariant A)', () => {
    expect(stronaMeczu).toContain('<Trash2 className="h-3.5 w-3.5" /> Usuń');
    expect(stronaMeczu).toContain('<Clock className="h-3.5 w-3.5" /> Na rezerwę');
  });
});

describe('X-10: toast na telefonie stoi u góry, nie zasłania dolnego arkusza (decyzja D-8)', () => {
  it('kontener na bazie u góry (safe-area), od `md:` wraca na dół', () => {
    expect(toast).toMatch(/top-\[calc\(env\(safe-area-inset-top\)\+0\.75rem\)\].*md:top-auto md:bottom-5/);
  });

  it('animacja wjazdu z góry na bazie, z dołu od `md:`', () => {
    expect(toast).toContain('animate-[slide-down_0.2s_ease-out] md:animate-[slide-up_0.2s_ease-out]');
  });
});

describe('X-11: drobne zdania mówią dokładnie to, co się dzieje', () => {
  it('dolna nawigacja: dymek wskazuje zakładkę „Ekipy", nie „Grupy" (etykieta z 2026-08)', () => {
    expect(bottomNav).toContain('Przytrzymaj „Ekipy" → najbliższa ekipa');
    expect(bottomNav).not.toContain('Przytrzymaj „Grupy"');
  });

  it('goście bez konta: zdanie rozróżnia skład od rezerwy', () => {
    expect(stronaMeczu).toMatch(
      /niePrzejeciGoscie\.some\(\(p\) => p\.isReserve\) \? 'w składzie i na rezerwie' : 'w składzie'/,
    );
  });

  it('odwołany mecz: bez „wolne miejsca"/„Komplet" i bez „Wypisz się z meczu" pod banerem', () => {
    // Nagłówek licznika od redesignu 2026-09: lewa kolumna rzędu z „N / max”.
    expect(stronaMeczu).toMatch(/\{!isCancelled && \(\s*<p className=\{`text-\[15px\] font-semibold/);
    expect(stronaMeczu).toContain('{!statusBarVisible && !isCancelled && (');
  });

  it('okno gościa: „Ten zapis już jest na liście" — bez rodzaju, w obu miejscach', () => {
    expect(stronaMeczu).not.toContain('Wcześniej dołączyłeś do tej gry.');
    const wystapienia = stronaMeczu.match(/Ten zapis już jest na liście\./g) ?? [];
    expect(wystapienia.length).toBe(2);
  });

  it('pusty stan ekipy: drugie zdanie „Brak meczów" nie powtarza karty wyżej', () => {
    expect(grupa).toMatch(/events\.length === 0 && !\(member && !nextMatch && !ostatniMecz\)/);
  });
});
