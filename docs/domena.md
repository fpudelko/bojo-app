# Modele domenowe

Rzeczy, które trzeba wiedzieć **przed** zmianą kodu — bo są nieoczywiste i już raz kogoś
ugryzły. Warstwy techniczne → [architektura.md](./architektura.md). Inwentarz funkcji →
[funkcje.md](./funkcje.md).

---

## Wydarzenie ↔ użytkownik: dwie niezależne osie

Relacja użytkownika do meczu to **dwie osie, nie jedna etykieta** (`lib/events.ts:701`):

```ts
interface MyEventRelation {
  isOrganizer: boolean;   // czyj to mecz — trwała cecha
  status: MyEventStatus;  // jaki mam udział — zmienny
}
```

```ts
type MyEventStatus =
  | 'none'       // brak relacji — domyślne „Dołącz"
  | 'invited'    // (przyszłość) ktoś mnie zaprosił, czeka na odpowiedź
  | 'pending'    // poprosiłem o dołączenie, organizator jeszcze nie zaakceptował
  | 'observing'  // RSVP „maybe" — obserwuję, nie zajmuję miejsca, nie liczę się do statystyk
  | 'reserve'    // zapisany, czekam na zwolnienie miejsca
  | 'playing';   // zapisany i trzymam miejsce
```

**Nie zwijać tego do jednej etykiety.** Można organizować mecz i w nim grać, albo
organizować bez grania — to dwa różne przypadki i UI musi je rozróżniać.

`'invited'` jest zarezerwowane pod przyszłe zaproszenia — **dziś nic go nie ustawia**.

### Skąd bierze się status

Prywatna `statusFromRow()` (`lib/events.ts:707`). Kolejność sprawdzeń ma znaczenie:

```ts
if (row.pending_approval) return 'pending';
if (row.rsvp === 'maybe')  return 'observing';
return row.is_reserve ? 'reserve' : 'playing';
```

Czyli: oczekujący na akceptację jest `pending`, **nawet jeśli** ma `rsvp = 'maybe'`.

---

## Reguły pojemności

Do limitu miejsc liczą się **wyłącznie** wiersze `event_participants` spełniające:

```
is_reserve = false AND pending_approval = false
```

Reguła jest **celowo zdublowana** w trzech funkcjach: `joinEvent`, `addGuest`,
`confirmFromMaybe`. Zmieniając jedną, sprawdź pozostałe — rozjazd między nimi oznacza,
że mecz przepełni się jedną ścieżką, a drugą nie.

Konsekwencje:
- Przy `require_approval = true` dołączenie **nie zajmuje miejsca** do czasu akceptacji.
- „Obserwuję" (`rsvp = 'maybe'`) nie zajmuje miejsca.
- Limit bramkarzy (`max_goalkeepers`, domyślnie 2, tylko gdy `goalkeepers_enabled`)
  spycha nadmiarowych na rezerwę.

### Brak auto-awansu z listy rezerwowej

Gdy ktoś się wypisze, rezerwowy **nie wskakuje automatycznie** na jego miejsce. Ktoś musi
go powiadomić ręcznie.

**To świadoma decyzja produktowa, nie luka. Nie „naprawiać".**

---

## RSVP „Obserwuję"

W bazie to `rsvp = 'maybe'` (`049_participant_rsvp.sql`). Znaczenie:

- nie zajmuje miejsca w składzie,
- nie liczy się do statystyk gracza (`055_stats_exclude_observing.sql`),
- nie trafia do historii meczów.

Przejście z obserwowania w granie: `confirmFromMaybe()` — i dopiero ono sprawdza
pojemność.

---

## Płatności

`lib/payments.ts`. Organizator wybiera akceptowane metody (`blik`, `gotowka`, `inne`)
i akceptowane karty sportowe (`multisport`, `fitprofit`, `medicover`, `inne`).

**Kwota zniżki jest opcjonalna i to jest istotne semantycznie:**

| `sports_card_discount_grosz` | Znaczenie |
|---|---|
| liczba | Zniżka o tę kwotę |
| `null` | „Zniżka jest, ale zapytaj organizatora" — **nie** „brak zniżki" |

Powód: zniżki z kart w realnym świecie są zbyt różne (procent, dzienne limity, zależność
od obiektu), żeby wymuszać jedną liczbę.

**Zawsze licz cenę przez `priceForParticipant()`** — nigdy nie odejmuj ręcznie. Funkcja
zwraca trzy pola i wszystkie trzy trzeba obsłużyć w UI:

```ts
{
  priceGrosze: number,           // ile zapłacić
  discountApplied: boolean,      // zniżka policzona
  discountUnspecified: boolean,  // ma kartę, ale kwota nieznana → pokaż „zapytaj organizatora"
}
```

`sportsCardLabel()` podstawia własną nazwę karty organizatora zamiast generycznego
„Inna karta”.

⚠️ **Pułapka nazw:** kolumny to `cost_grosz` i `sports_card_discount_grosz` (bez „e"),
pola TS to `costGrosze` i `sportsCardDiscountGrosze`.

---

## Grupy

`lib/groups.ts`. Stała ekipa: sport, miasto, okładka, członkowie, mecze grupy.
Dołączanie przez link zaproszenia `/g/[code]`.

**`events.group_id` steruje listowaniem, nie dostępem.** Przypisanie meczu do grupy
sprawia, że pojawia się on na liście meczów grupy — ale widoczność meczu nadal wynika
wyłącznie z `events.visibility` (`private` / `public`). Trzeciego poziomu widoczności
nie ma — to [luka wobec wizji](./wizja.md#3-luki).

---

## Wyniki i statystyki

`match_results` + `player_goals` (gole i asysty per gracz) + RPC `get_player_stats`.
`MatchResultData` obsługuje trzy kształty wyniku: bramki, sety siatkarskie, statystyki
koszykarskie.

Reputacja: `reliabilityPct()` (`lib/eventFeatures.ts`) liczy frekwencję. Znaczek
„rzetelny gracz" wymaga ≥5 rozegranych gier i 0 nieobecności (`app/gracz/[id]/page.tsx`).

Statystyki **pomijają** uczestników ze statusem `observing`.
