# Dokumentacja Bojo

Baza wiedzy o projekcie. Zasady pracy w repo (komendy, konwencje, pułapki) →
[AGENTS.md](../AGENTS.md).

## Który plik na jakie pytanie

| Pytanie | Plik |
|---|---|
| Po co jest ten produkt? Co ma robić? Czy funkcja X jest w planie? | [wizja.md](./wizja.md) |
| Co jest zbudowane? Czy użytkownik to widzi? Gdzie leży kod funkcji X? | [funkcje.md](./funkcje.md) |
| Jak to jest zamodelowane? Dlaczego status/pojemność/cena działa tak? | [domena.md](./domena.md) |
| Gdzie leży logika? Jak dane płyną? Czemu nie ma backendu? | [architektura.md](./architektura.md) |
| Która migracja tworzy tabelę X? Czemu zapis nie działa? | [baza-danych.md](./baza-danych.md) |
| Ile to kosztuje? Kto co robi? Co jest w której fazie? | [strategia.md](./strategia.md) |

## Hierarchia

**[wizja.md](./wizja.md) jest dokumentem nadrzędnym.** Gdy kod nie zgadza się z wizją,
to kod nie nadążył — rozbieżność trafia do [BACKLOG.md](../BACKLOG.md) jako zadanie,
a nie do dokumentacji jako sprostowanie.

Pozostałe pliki opisują **stan faktyczny**: co jest w kodzie dzisiaj, łącznie z tym, co
jest zbudowane, ale ukryte za flagą.

## Zasada aktualizacji

Zmiana kodu pociąga za sobą aktualizację dokumentu:

| Zmieniasz | Sprawdź |
|---|---|
| `frontend/src/lib/features.ts`, `config/features.ts` | [funkcje.md](./funkcje.md#flagi-funkcji) |
| `frontend/src/lib/*` | [domena.md](./domena.md), [funkcje.md](./funkcje.md) |
| `frontend/src/app/*` (nowa lub usunięta trasa) | [funkcje.md](./funkcje.md), `frontend/public/llms.txt` |
| `supabase/migrations/*` | [baza-danych.md](./baza-danych.md) |

Hook `.claude/hooks/doc-guard.sh` przypomina o tym w trakcie pracy — nie blokuje,
więc odpowiedzialność zostaje po stronie piszącego.

## Odbiorcy dokumentacji

- **Modele rozwijające kod** — `AGENTS.md` (zasady) + `docs/` (wiedza)
- **Wyszukiwarki i modele czytające aplikację** — `frontend/public/llms.txt`,
  JSON-LD na stronach publicznych, `robots.txt`
- **Ludzie** — [PRZEWODNIK.md](../PRZEWODNIK.md) (opis funkcji),
  [README.md](../README.md) (start)
