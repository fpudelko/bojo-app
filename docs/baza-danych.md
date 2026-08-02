# Baza danych

57 migracji (`001`–`057`) w `supabase/migrations/`. Modele domenowe →
[domena.md](./domena.md).

---

## ⚠️ Migracje uruchamia się RĘCZNIE

Pliki w `supabase/migrations/` trzeba **wkleić do Supabase → SQL Editor**, kolejno wg
numeracji. **Nic nie robi tego automatycznie** — nie ma CI, nie ma `supabase db push`
w pipelinie.

**Dodanie kolumny w pliku migracji ≠ kolumna istnieje w bazie.** Jeśli aplikacja rzuca
błędem o nieznanej kolumnie, pierwsza hipoteza brzmi: migracja nie została puszczona.

**Stanu bazy produkcyjnej nie da się odczytać z repo.** Numer ostatniej migracji w repo
mówi tylko, co zostało napisane — nie co zostało zastosowane.

## ⚠️ RLS po cichu unieważnia UPDATE

Gdy polityka RLS nie pasuje, Postgres **nie zgłasza błędu** — po prostu aktualizuje
0 wierszy i zwraca sukces.

Objaw: „przycisk nic nie robi", zero błędów w konsoli.

Realny przypadek: brakowało polityki pozwalającej użytkownikowi zmienić własny wpis
w `event_participants` — naprawione w `053_own_participation_update.sql`.

**Jeśli zapis „nie działa" bez błędu — najpierw sprawdź polityki, potem kod.**

---

## Tabele → migracja tworząca

| Tabela | Powstała w | Rola |
|---|---|---|
| `fields` | `001` | Boiska i obiekty (~1400) |
| `events` | `002` | Mecze |
| `event_participants` | `002` | Zapisy na mecz |
| `profiles` | `005` | Użytkownicy (+ flaga `is_admin`) |
| `recurring_events` | `007` | Szablony meczów cyklicznych |
| `recurring_event_invites` | `007` | Zapraszani do cyklicznych |
| `bookings` | `008` | Rezerwacje terminów |
| `venue_schedules` | `008` | Godziny otwarcia obiektu |
| `venue_pricing` | `008` | Cennik obiektu |
| `match_results` | `011` | Wyniki meczów |
| `player_goals` | `011` | Gole i asysty per gracz |
| `player_stats` | `011` | Statystyki gracza |
| `player_reports` | `011` | Zgłoszenia graczy |
| `event_reminders` | `013` | Przypomnienia o meczu |
| `player_match_stats` | `014` | Statystyki per mecz |
| `rate_limits` | `016` | Limity (m.in. usuwanie konta) |
| `field_outreach` | `020` | CRM kontaktu z obiektami |
| `game_alerts` | `025` | Alerty o grach w okolicy |
| `notifications` | `025` | Powiadomienia in-app |
| `event_comments` | `026` | Komentarze pod meczem |
| `event_activity_log` | `026` | Log zdarzeń meczu |
| `event_invites` | `036` | Zaproszenia na mecz |
| `groups` | `044` | Stałe ekipy |
| `group_members` | `044` | Członkowie ekip |
| `analytics_events` | `047` | Log akcji do analityki |
| `tournaments` i 5 tabel `tournament_*` | `029` | Turniej |

**Tabela `games` (`001`) jest martwa** — powstała w pierwszym schemacie i została
zastąpiona przez `events` (`002`). Żaden kod jej nie używa.

---

## Migracje zmieniające zachowanie (nie tylko schemat)

Te warto znać, bo wyjaśniają, dlaczego coś działa tak, a nie inaczej:

| Migracja | Co wprowadziła |
|---|---|
| `011_advanced_event_features` | Drużyny, wyniki, płatności, statystyki |
| `025_game_alerts` | Alerty + tabela `notifications` + RPC `get_nearby_events` |
| `033_contact_visibility` | Telefony i e-maile boisk **ukryte domyślnie**, egzekwowane w DB |
| `041_join_code` | Kod dołączenia + `require_approval` |
| `043_player_stats_fn` | RPC `get_player_stats` (poprawki w `045`, `055`) |
| `048_participant_pending_approval` | Oczekiwanie na akceptację nie zajmuje miejsca |
| `049_participant_rsvp` | RSVP „Obserwuję" (`maybe`) |
| `053_own_participation_update` | **Polityka RLS na własny wiersz uczestnika** — patrz ostrzeżenie wyżej |
| `055_stats_exclude_observing` | Obserwujący nie liczą się do statystyk |
| `056_payment_options` | Metody płatności i karty sportowe |

---

## Funkcje w bazie (RPC)

| Funkcja | Rola |
|---|---|
| `get_nearby_events` | Mecze w promieniu (używa `haversine_km`) |
| `get_player_stats` | Statystyki gracza |
| `set_event_teams_published` | Publikacja składów |
| `generate_join_code` | Kod dołączenia do meczu |
| `add_group_creator_as_member` | Trigger — twórca grupy zostaje członkiem |
| `tournament_team_count`, `shared_availability_days`, `admin_team_contacts` | Turniej |
| `haversine_km` | Odległość geograficzna |
| `trigger_set_updated_at`, `trigger_set_expires_at` | Triggery czasowe |

---

## Konwencja nowych migracji

Kolejny numer + krótka nazwa: `058_nazwa_zmiany.sql`. W nagłówku komentarz mówiący
**dlaczego** migracja powstała — nie co robi (to widać w SQL).

Dodając kolumnę do tabeli, która ma politykę RLS na `UPDATE`, sprawdź, czy polityka
obejmuje nową kolumnę.

---

## Dane testowe

| Plik | Zawartość |
|---|---|
| `supabase/seed_test_data.sql` | 20 wydarzeń pokrywających wszystkie kombinacje ustawień. Bezpieczny do wielokrotnego użycia — czyści po markerze `[TEST]` w opisie |
| `supabase/seed-test-users.sql` | Konta `test1..test10@example.com`, hasło `test1234` |

Oba uruchamiane ręcznie w SQL Editor.
