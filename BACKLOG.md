# BOJO — backlog: ukryte funkcje i pomysły

Notatnik na to, co jest **zbudowane ale schowane**, oraz **pomysły jeszcze
niezrobione**. Żeby nic nie umknęło przed publicznym uruchomieniem.

_Ostatnia aktualizacja: 2026-06-11_

---

## 1. Ukryte za flagami (`frontend/src/lib/features.ts`)

Jedno miejsce, jeden przełącznik. Zmień flagę na `true`, żeby przywrócić funkcję.

| Flaga | Co chowa | Dlaczego schowane | Gdzie jest kod |
|---|---|---|---|
| `SHOW_CUP` | Turniej **BOJO Cup** — pasek ogłoszeń, TrustBar, link w nagłówku | Brak gotowego turnieju; nie chcemy obiecywać na zapas | `AnnouncementBar`, `TrustBar`, `Header`, route `/turniej`, migracje `029`/`030` |
| `SHOW_GAME_ALERTS` | **„Ustaw alert"** — powiadomienie gdy pojawi się pasująca gra w okolicy | Brak kanału dostarczania (SMS/e-mail/push) — alert bez powiadomienia to ściema | `lib/alerts.ts`, `AlertSetupDialog`, `NearbyGames` (i tak nieużywany), migracja `025` |
| `SHOW_SMS_FEATURES` | **„Potwierdzenie SMS"** na meczu + **przypomnienia** SMS/e-mail | Brak bramki SMS | `RemindersSection`, `lib/reminders.ts`, `sendConfirmationSms` w `lib/eventFeatures.ts` |

> Gdy pojawi się kanał powiadomień (SMS/e-mail/push) — odblokowanie alertów,
> przypomnień i potwierdzeń SMS to w zasadzie przełączenie tych flag (plus
> faktyczne wysyłanie po stronie backendu).

---

## 2. Zbudowane, ale nieużywane / martwy kod

- **`components/home/NearbyGames.tsx`** — kompletny komponent „gry w pobliżu +
  alert", nigdzie nie renderowany. Do decyzji: wpiąć (po włączeniu alertów) albo usunąć.
- **`RemindersSection` / `AlertSetupDialog`** — renderowane tylko za flagami powyżej.

---

## 3. Funkcje częściowo wdrożone (do przeglądu przed launchem)

- **Rezerwacje boisk / panel zarządcy obiektu** — routy `/obiekt`, `/rezerwacje`,
  migracja `008_venue_bookings`. Status: czy to live, czy odkładamy? Jeśli
  odkładamy — rozważyć ukrycie wejść w nawigacji.
- **Gry cykliczne (stałe gierki)** — route `/cykliczne`, migracja `007`. Działa?
  Czy pokazujemy w głównej nawigacji?
- **Statystyki / wyniki meczów, drużyny, płatności** — zaawansowane opcje meczu
  (w szczegółach wydarzenia). Działają, ale warto zweryfikować spójność UX.

---

## 4. Zadania do zrobienia (technika / dane)

- [ ] **Migracje na produkcję** — upewnić się, że `032`–`036` są zaaplikowane
  (`032` venue_type, `033` contact_visibility, `034` goalkeeper, `035`
  allow_guest_adds, `036` invite_only).
- [ ] **Czyszczenie bazy boisk** — odsianie siłowni, kortów tylko-tenisowych,
  kartingów itp. Teraz filtr `RELEVANT_SPORTS` jest **po stronie klienta**
  (`VenueExplorer`). Docelowo: oznaczyć śmieciowe obiekty `map_visibility =
  'hidden'` w bazie + prosty **panel admina** do przeglądania i wybierania,
  które boiska mają sens.
- [ ] **Dane demo** — `supabase/seed-events.sql` (fake userzy + wydarzenia na 2
  tygodnie). Sprzątanie: `DELETE FROM auth.users WHERE email LIKE '%@seed.bojo';`

### Bezpieczeństwo (już wdrożone — pilnować)
- Telefony/e-maile zescrapowane z OSM **ukryte domyślnie**; widoczność per obiekt
  włącza admin (`contact_visible`, migracja `033`). Egzekwowane na poziomie DB.

---

## 5. Turniej — TODO (gdy wracamy do `SHOW_CUP`)

**Zakres: 3 sporty — piłka nożna, koszykówka, siatkówka plażowa.**

> ⭐ **Siatkówka plażowa to główny przypadek użycia** — więcej osób będzie
> robić turnieje plażówki niż hali. Halową siatkówkę traktujemy jako zwykły
> sport meczowy, a w turniejach wyraźnie eksponujemy plażową.

### Baza
- [ ] `tournaments`: sport, organizer, field, data, format (pucharowy /
  grupowy / każdy-z-każdym), liczba drużyn, rozmiar drużyny, deadline zapisów,
  status, regulamin, nagrody.
- [ ] `tournament_teams`: nazwa, kapitan, członkowie, potwierdzona, rozstawienie.
- [ ] `tournament_matches`: runda, drużyna A/B, wynik, zwycięzca, boisko.
- [ ] RLS: organizator zarządza; drużyny widzą swój pojedynek; publicznie po starcie.
- _(częściowo: migracje `029`/`030` już istnieją — zweryfikować pokrycie.)_

### UI
- [ ] `/turnieje` — lista (filtr po sporcie)
- [ ] `/turnieje/[id]` — drabinka, lista drużyn, terminarz
- [ ] `/turnieje/nowe` — kreator (jak tworzenie meczu)
- [ ] rejestracja drużyny (kapitan: nazwa + skład)
- [ ] panel organizatora: potwierdzanie drużyn, losowanie drabinki, wpisywanie wyników

### Decyzje do podjęcia
- [ ] Rozmiar drużyny: konfigurowalny czy stały per sport? (plażówka 2v2 / 4v4)
- [ ] Zapisy otwarte vs tylko zaproszone drużyny (re-użyć logiki „tylko dla zaproszonych")
- [ ] Płatność za drużynę? (re-użyć `trackPayments`)
- [ ] Wizualizacja drabinki na mobile (drzewko jest trudne na małym ekranie)
- [ ] Powiadomienia: gdy wylosowano drabinkę / kiedy następny mecz

| Sport | Format domyślny | Rozmiar | Uwaga |
|---|---|---|---|
| **Siatkówka plażowa** ⭐ | pucharowy | 2v2 / 4v4 | główny przypadek; boiska już na mapie |
| Piłka nożna | grupy → puchar | 5v5 / 7v7 | trzeba wiele boisk lub sloty czasowe |
| Koszykówka | pucharowy | 3v3 | streetball, najpopularniejszy format amatorski |

---

## 6. Pomysły jeszcze niezbudowane

- **Kanał powiadomień** (SMS / e-mail / web-push) — odblokowuje alerty,
  przypomnienia, potwierdzenia. Fundament pod sekcję 1.
- **Onboarding / pierwsza gra** — co widzi świeży user bez gier w okolicy.
- **Profil gracza / reputacja** — frekwencja, „rzetelny gracz", raporty (część
  infrastruktury już jest: `submitReport`).
- **Udostępnianie gry** poza apką (link / obrazek do social/WhatsApp).
- **Statystyki sezonowe** dla stałych ekip.
