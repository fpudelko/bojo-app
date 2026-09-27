import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// `EventDetailClient.tsx` jest monolitem (auth, supabase, router, dziesiątki
// stanów) — jego pełne wyrenderowanie w teście wymagałoby atrapy większości
// aplikacji, więc pilnujemy KLUCZOWYCH GAŁĘZI JSX-a w tekście źródła, tak jak
// `listaRezerwowa.test.ts` już robi dla tego samego pliku. Zachowanie samych
// funkcji czystych (`ofertyWToku`, `wolneMiejscaWgRol`) ma osobny test
// (`ofertyWToku.test.ts`), który faktycznie je wywołuje.
const stronaMeczu = readFileSync(
  resolve(__dirname, '../app/wydarzenia/[id]/EventDetailClient.tsx'), 'utf8');

describe('pasek stanu przy aktywnej ofercie z rezerwy (X-3)', () => {
  it('rezerwowy z ofertą dostaje „Wchodzę”, nie „Rezerwa: N. w kolejce · Wypisz się”', () => {
    // Gałąź `myClaimOffer` MUSI stać PRZED `amIReserve` — inaczej rezerwowy
    // z aktywną ofertą i tak trafia w tekst i przycisk dla zwykłej rezerwy.
    expect(stronaMeczu).toMatch(
      /myClaimOffer\s*\n?\s*\?\s*'Zwolniło się miejsce, jest Twoje'\s*\n?\s*:\s*myPendingRequest/,
    );
  });

  it('przycisk „Wchodzę” woła handleAcceptClaim, a nie okno wypisania', () => {
    expect(stronaMeczu).toMatch(/\{myClaimOffer \? \(/);
    expect(stronaMeczu).toMatch(/onClick=\{handleAcceptClaim\}[\s\S]{0,400}Wchodzę/);
  });

  it('podpis paska pokazuje termin oferty, nie „Wejdziesz, gdy ktoś się wypisze”', () => {
    expect(stronaMeczu).toMatch(
      /myClaimOffer\s*\n?\s*\?\s*\(claimDeadline \? `Masz czas do \$\{format\(claimDeadline/,
    );
  });
});

describe('pasek gościa przy aktywnej ofercie (X-3, przez X-9)', () => {
  it('gość z ofertą widzi „Zwolniło się miejsce, jest Twoje” i „Przyjmij →”', () => {
    expect(stronaMeczu).toMatch(/wpisGoscia\?\.ofertaDo \? 'Zwolniło się miejsce, jest Twoje' : 'Jesteś zapisany\(a\)'/);
    expect(stronaMeczu).toMatch(/wpisGoscia\?\.ofertaDo \? 'Przyjmij →' : 'Mój zapis →'/);
  });
});

describe('wpis gościa, którego już nie ma na liście (X-9)', () => {
  it('brak wiersza pod tokenem zapomina token i wraca do „Dołącz”', () => {
    // `joinBarVisible` (warunek paska „Dołącz") zależy od `!mojTokenGoscia` —
    // to jest KLUCZOWA linia: bez `setMojTokenGoscia(null)` po zniknięciu
    // wiersza pasek „Jesteś zapisany(a)” zostawałby na zawsze, a „Dołącz”
    // nigdy by nie wrócił.
    expect(stronaMeczu).toMatch(/if \(!wpis\) \{[\s\S]{0,300}setMojTokenGoscia\(null\)/);
  });

  it('komunikat mówi, że można zapisać się ponownie', () => {
    expect(stronaMeczu).toContain(
      'Twojego zapisu już nie ma na liście (organizator mógł go usunąć albo odrzucić prośbę). Możesz zapisać się ponownie.',
    );
  });
});

describe('zapis gościa zapamiętuje token od razu, nie po odświeżeniu (X-1)', () => {
  it('setMojTokenGoscia stoi tuż po zapamietajWpisGoscia w handleJoinAsGuest', () => {
    expect(stronaMeczu).toMatch(
      /zapamietajWpisGoscia\(event\.id, result\.claimToken\);\s*\n\s*setMojTokenGoscia\(result\.claimToken\);/,
    );
  });
});

describe('komunikat po wypisaniu opisuje to, co zrobił gracz (X-5)', () => {
  it('wypisanie z paska/okna: „Wypisano Cię z meczu”', () => {
    expect(stronaMeczu).toContain("handleRemove(myEntry.id, 'Wypisano Cię z meczu')");
  });

  it('rezygnacja z rezerwy z kosza na liście: „Zrezygnowano z rezerwy”', () => {
    expect(stronaMeczu).toContain("handleRemove(p.id, 'Zrezygnowano z rezerwy')");
  });

  it('organizator wciąż widzi domyślne „Uczestnik usunięty” (bez podanego komunikatu)', () => {
    expect(stronaMeczu).toMatch(/handleRemove\(p\.id\);/);
    expect(stronaMeczu).toMatch(/komunikat = 'Uczestnik usunięty'/);
  });
});
