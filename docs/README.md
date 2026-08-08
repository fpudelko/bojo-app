# Dokumentacja Bojo

Baza wiedzy o projekcie. Zasady pracy w repo (komendy, konwencje, pułapki) →
[AGENTS.md](../AGENTS.md).

## Który plik na jakie pytanie

| Pytanie | Plik |
|---|---|
| Po co jest ten produkt? Co ma robić? Czy funkcja X jest w planie? | [wizja.md](./wizja.md) |
| Co jest zbudowane? Które flagi co ukrywają? Czego NIE ma? | [funkcje.md](./funkcje.md) |
| Jak to jest zamodelowane? Dlaczego architektura wygląda tak? | [domena.md](./domena.md) |
| Która migracja tworzy tabelę X? Czemu zapis nie działa? | [baza-danych.md](./baza-danych.md) |
| Ile to kosztuje? Kto co robi? Co jest w której fazie? | [strategia.md](./strategia.md) |
| Jak opisać Bojo modelowi, który nie ma dostępu do repo? | [llm-context.md](./llm-context.md) |
| Chcę, żeby model zakwestionował ten produkt — co mu wkleić? | [prompt-rewizja.md](./prompt-rewizja.md) |
| Co wyszło z rewizji przed startem? | [rewizja-2026-08.md](./rewizja-2026-08.md) |
| Gdzie organizator się zacina przy tworzeniu meczu? Co zostaje bez zmian i dlaczego? | [przeplyw-organizatora.md](./przeplyw-organizatora.md) |

## Hierarchia

**[wizja.md](./wizja.md) jest dokumentem nadrzędnym.** Gdy kod nie zgadza się z wizją,
to kod nie nadążył — rozbieżność trafia do [BACKLOG.md](../BACKLOG.md) jako zadanie,
a nie do dokumentacji jako sprostowanie.

Celowo NIE utrzymujemy inwentarzy tras, funkcji i komponentów — agent znajdzie je
w kodzie szybciej, niż my utrzymamy tabelę. Dokumentujemy tylko to, czego kod sam
nie powie: wizję, nieoczywiste reguły, schemat bazy, stan flag.

## Rytmy aktualizacji

| Rytm | Co obejmuje | Mechanizm |
|---|---|---|
| **Zdarzenie — ten sam PR/commit** | [domena.md](./domena.md), [funkcje.md](./funkcje.md), [baza-danych.md](./baza-danych.md), [llm-context.md](./llm-context.md), `frontend/public/llms.txt`, [AGENTS.md](../AGENTS.md) | hook doc-guard przypomina; `npm run check:docs` weryfikuje; CI odrzuca rozjazd |
| **Audyt kwartalny** | statusy w [wizja.md](./wizja.md) §2–3, [BACKLOG.md](../BACKLOG.md), [PRZEWODNIK.md](../PRZEWODNIK.md) | checklista poniżej |
| **Ręcznie, gdy ludzie coś ustalą** | [wizja.md](./wizja.md) §1 (werbatim — nigdy przez agenta), [strategia.md](./strategia.md) | człowiek |

### Checklista audytu kwartalnego

1. `npm run check:docs` — zielony?
2. Statusy w [wizja.md](./wizja.md) §2 nadal zgodne z flagami i kodem?
3. [BACKLOG.md](../BACKLOG.md): wykreśl zrobione, zaktualizuj „luki wobec wizji".
4. Liczby w [AGENTS.md](../AGENTS.md) i [PRZEWODNIK.md](../PRZEWODNIK.md) (testy,
   migracje, workflowy) — aktualne?
5. Czy funkcja odmrożona od ostatniego audytu czeka na wpis w `llms.txt` i sitemap?

## Mapowanie: zmiana kodu → dokument

| Zmieniasz | Sprawdź |
|---|---|
| `frontend/src/lib/features.ts`, `config/features.ts` | [funkcje.md](./funkcje.md#flagi-funkcji) |
| `frontend/src/lib/*` | [domena.md](./domena.md), [funkcje.md](./funkcje.md) |
| `frontend/src/app/*` (nowa lub usunięta trasa) | [funkcje.md](./funkcje.md), `frontend/public/llms.txt` |
| `supabase/migrations/*` | [baza-danych.md](./baza-danych.md) |

## Odbiorcy dokumentacji

- **Modele rozwijające kod** — `AGENTS.md` (zasady) + `docs/` (wiedza)
- **Modele czytające o Bojo na zimno, bez dostępu do repo** —
  [llm-context.md](./llm-context.md), serwowany też pod `bojo.pl/llm-context.md`
  (kopia w `frontend/public/`, synchronizacja: `npm run sync:llm-context`)
- **Wyszukiwarki i crawlery** — JSON-LD na stronach publicznych
  (`lib/structuredData.ts`), `robots.txt`, `sitemap.xml` oraz `frontend/public/llms.txt`
  — indeks odsyłający do `llm-context.md`. Zastrzeżenie zostaje aktualne: żaden duży
  dostawca nie potwierdził, że czyta `llms.txt`, więc plik ma być krótki i tani
  w utrzymaniu, a nie rozbudowywany
- **Ludzie** — [PRZEWODNIK.md](../PRZEWODNIK.md) (opis funkcji),
  [README.md](../README.md) (start)
