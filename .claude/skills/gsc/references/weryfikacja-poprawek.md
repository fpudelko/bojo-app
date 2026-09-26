# Weryfikacja poprawek („Sprawdź poprawkę”)

## Jak to działa po stronie Google

- Weryfikacja dotyczy **jednego problemu** w jednym raporcie, nie całej strony
  ani wszystkich typów danych strukturalnych.
- Po kliknięciu Google od razu sprawdza **kilka** stron z listy przykładów (prekontrola).
  Jeśli choć jedna nadal ma problem, weryfikacja kończy się od razu komunikatem
  „Nie można kontynuować weryfikacji” i listą adresów.
- Jeśli prekontrola przejdzie: stan „Rozpoczęto”, Google przechodzi resztę adresów przy
  kolejnych skanowaniach. Typowo do ~2 tygodni, przy rzadko skanowanych stronach dłużej.
- Wynik: „Poprawka zweryfikowana”/„Naprawiono” albo „Niepowodzenie” (lista adresów).
- W trakcie („Rozpoczęto”) nie klikaj ponownie: to nic nie przyspiesza.

## Lekcja z 2026-09-24

Po merge PR #424 cztery weryfikacje („availability”, „validFrom”, „image”,
„description”) dostały „Nie można kontynuować weryfikacji” na tych samych dwóch
meczach, a piąta („performer”) ruszyła. `performer` istnieje wyłącznie w nowym kodzie,
a `description` i `image` powstają w tym samym bloku bez warunków. Strona z
`performer` nie może więc nie mieć `description`. Wniosek: pierwsze cztery kliknięcia
trafiły w stary HTML (deploy jeszcze trwał albo Google zapamiętał wcześniejsze
pobranie). Ponowne kliknięcie godzinę później: wszystkie ruszyły.

## Procedura

1. **Poprawka na produkcji?** Merge ≠ deploy. Sprawdź deploy produkcyjny commita
   z mastera (konektor Vercel: lista wdrożeń, stan READY; bez konektora: odczekaj
   ~10 minut od merge'u i sprawdź commit na liście wdrożeń w panelu Vercela).
2. **Strona serwuje nowy HTML?** Najpewniej: Sprawdzanie adresu URL → „Sprawdź
   opublikowany URL” (test na żywo) na jednym z przykładów z raportu, albo Test wyników
   z elementami rozszerzonymi. Z kontenera agenta bojo.pl nie jest dostępne: prosi
   się o to właściciela albo sprawdza lokalny build (`gsc-dane-strukturalne`).
3. Dopiero wtedy **„Sprawdź poprawkę”** przy każdym problemie osobno.
4. Wpis do `docs/gsc-dziennik.md`: data rozpoczęcia, problemy, termin odczytu (+14 dni).
5. **Gdy przyjdzie „Niepowodzenie”:** eksport adresów, które nie przeszły →
   `gsc-eksport.mjs --adresy` → czy to jeden typ strony, czy pojedyncze przypadki
   (np. mecz prywatny, który zmienił widoczność, stary cache ISR). Popraw, wróć do 1.

## Czego weryfikacja NIE mówi

- Że wynik rozszerzony się pojawi. Poprawne dane to warunek konieczny, nie wystarczający.
- Nic o problemach niekrytycznych innych niż weryfikowany: każdy ma własny przycisk.
- Nic o stronach, których Google nie ma w raporcie (np. nowe mecze). Te pokażą się
  przy kolejnych skanowaniach.
