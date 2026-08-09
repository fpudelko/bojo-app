# Baza danych

72 migracje (`001`–`072`) w `supabase/migrations/`. Modele domenowe →
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

### ⚠️ Historia migracji w repo ≠ historia w Supabase (MCP)

Od sesji z dostępem do Supabase przez MCP (`execute_sql`, `list_migrations`,
`apply_migration`) można czytać i pisać do bazy wprost z agenta. **`list_migrations`
na produkcji zwraca pustą listę** — mimo 60 plików w `supabase/migrations/` — bo
wszystkie były wklejane ręcznie do SQL Editora, a nie puszczane przez `apply_migration`.

**Pusta lista nie znaczy „baza jest świeża".** Znaczy tylko, że Supabase nigdy nie
prowadziło własnej księgi migracji dla tego projektu. Pierwsze użycie `apply_migration`
założy **równoległą historię** zaczynającą się od zera — numeracja w repo (`060_…`)
i historia w Supabase nigdy nie będą tożsame, i to jest oczekiwane, nie błąd.

Zasady pracy z `apply_migration` (agent, nie człowiek w SQL Editorze):
- plik w `supabase/migrations/NNN_nazwa.sql` jest źródłem prawdy — `apply_migration`
  go wykonuje, nigdy odwrotnie (żadnego DDL istniejącego wyłącznie w bazie),
- najpierw projekt deweloperski, potem produkcja (patrz „Osobna baza" niżej —
  **projekt `BojoDev` już istnieje**, dziś ze statusem `INACTIVE`),
- nigdy bez wyraźnej zgody użytkownika w danym momencie — zgoda na jedną migrację
  nie jest zgodą na następną,
- po każdym DDL: `get_advisors(type: 'security')` — łapie brakujące polityki RLS.

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
| `event_participants` | `002` | Zapisy na mecz. Kolumny `status` i `confirmed_at` usunięte w `064` — relację gracza do meczu opisują `pending_approval` i `rsvp`. `claim_token` (`066`) pozwala gościowi przejąć wpis po założeniu konta |
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
| `field_comments` | `063` | Komentarze pod obiektem z katalogu boisk — osobne od `event_comments`, bo przeżywają pojedynczy mecz |
| `event_activity_log` | `026` | Log zdarzeń meczu |
| `event_invites` | `036` | Zaproszenia na mecz po e-mailu — **martwa**, `lib/invites.ts` nie jest nigdzie importowany |
| `event_player_invites` | `060`, RLS poprawione w `061` | Imienne zaproszenia użytkowników na mecz |
| `groups` | `044` | Stałe ekipy |
| `group_members` | `044` | Członkowie ekip |
| `analytics_events` | `047` | Log akcji do analityki |
| `team_proposals` | `059` | Propozycje składów od uczestników |
| `team_proposal_picks` | `059` | Przypisania graczy w propozycji |
| `team_proposal_votes` | `059` | Poparcia propozycji |
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
| `062_reserve_claim_notification` | `sync_reserve_claim` dopisuje wpis do `notifications`, gdy oferuje zwolnione miejsce — dotąd oferta była widoczna tylko po ręcznym wejściu na stronę meczu |
| `065_powiadomienia_akceptacja_termin` | Wyzwalacze: akceptacja zapisu i zmiana terminu meczu |
| `067_powiadomienie_o_zaproszeniu` | Wyzwalacz na `event_player_invites` + uzupełnienie zaległych zaproszeń |
| `070_powiadomienia_odwolanie_i_profil` | Wyzwalacze: **odwołanie meczu** (dotąd ciche — uczestnik dowiadywał się wyłącznie wchodząc na stronę) oraz **nowe konto bez imienia** (kieruje do `/profil`) |
| `071_wymagaj_pelnej_nazwy_w_powiadomieniu` | Zaostrza wyzwalacz z `070` na "nowe konto bez imienia" — wymaga co najmniej dwóch członów nazwy (imię i nazwisko), nie tylko dowolnej niepustej wartości. Google OAuth zawsze wypełnia `full_name`, więc słabszy check praktycznie nigdy nie wykrywał braku |
| `072_brakujace_powiadomienia` | Wyzwalacze: **organizator** dostaje powiadomienie o nowej prośbie o dołączenie (`event_participants.pending_approval`), **członkowie grupy** dostają powiadomienie o nowym meczu w grupie (`events.group_id`) |

**Powiadomienia mogą powstawać wyłącznie z wyzwalaczy.** Tabela `notifications` (`025`) ma
polityki SELECT i UPDATE dla własnych wierszy i **żadnej polityki INSERT** — przeglądarka
nie zapisze powiadomienia nawet sobie. Każde nowe powiadomienie to funkcja
`SECURITY DEFINER` z `SET search_path = public`, wzorowana na `065`.

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
| `sync_reserve_claim` | Utrzymuje kolejkę ofert zwolnionego miejsca i powiadamia o ofercie (`SECURITY DEFINER`, `062`) |
| `accept_team_proposal` | Przenosi propozycję składów na realne drużyny (`SECURITY DEFINER`) |
| `haversine_km` | Odległość geograficzna |
| `trigger_set_updated_at`, `trigger_set_expires_at` | Triggery czasowe |

---

## Konwencja nowych migracji

Kolejny numer + krótka nazwa: `058_nazwa_zmiany.sql`. W nagłówku komentarz mówiący
**dlaczego** migracja powstała — nie co robi (to widać w SQL).

Dodając kolumnę do tabeli, która ma politykę RLS na `UPDATE`, sprawdź, czy polityka
obejmuje nową kolumnę.

---

## Osobna baza (dev / preview)

Domyślnie preview na Vercelu korzysta z **produkcyjnej** bazy — wygodne, ale każdy test
zostawia ślad w prawdziwych danych. Żeby to rozdzielić, stawia się drugi projekt Supabase:

**Projekt już istnieje — nie zakładać nowego.** `BojoDev` jest w tej samej organizacji,
dziś ze statusem `INACTIVE` (trzeba go wybudzić przy pierwszym użyciu). Poniższe kroki
(migracje, boiska, buckety, konta testowe, URL Configuration, zmienne na Vercelu) trzeba
i tak przejść — projekt istnieje jako powłoka, nie jako gotowe do użycia środowisko.

1. **Wybudź `BojoDev`** albo, jeśli naprawdę potrzebny jest inny projekt, załóż nowy
   w tej samej organizacji. Zapisz hasło do bazy.
2. **Migracje po kolei** — SQL Editor, od `001` do najnowszej. Kolejność ma znaczenie
   (późniejsze zakładają wcześniejsze). Nie da się tego pominąć: nie ma migratora,
   który zrobi to sam.
3. **Boiska** — `supabase/seed.sql` (5 sztuk, na szybko) albo `seed-orliki.sql`
   (pełniejszy zestaw). Bez tego mapa i pickery będą puste.
4. **Buckety w Storage** — utwórz `covers` i `avatars`, oba **publiczne**. Kod ich nie
   tworzy; przy braku okładki i awatary rzucą błędem przy uploadzie.
5. **Konta testowe** — `supabase/seed-test-users.sql`, potem `seed_test_data.sql`.
   Konta organizatorów muszą istnieć: albo zaloguj się nimi raz w apce wskazującej
   na tę bazę, albo dopisz je do skryptu z kontami.
6. **Auth → URL Configuration** — Site URL na adres preview, a w Redirect URLs wildcard
   dla podglądów Vercela, inaczej logowanie odbije na złą domenę:
   `https://<projekt>-*-<team>.vercel.app/**`
7. **Vercel → Settings → Environment Variables** — `NEXT_PUBLIC_SUPABASE_URL`
   i `NEXT_PUBLIC_SUPABASE_ANON_KEY` z nowego projektu, zaznaczone **tylko dla Preview**
   (Production zostawia stare). Po zmianie **przebuduj** preview — zmienne wchodzą
   przy buildzie.

Od tego momentu preview pisze do własnej bazy, a `bojo.pl` zostaje nietknięte.

---

## Dane testowe

| Plik | Zawartość |
|---|---|
| `supabase/seed_test_data.sql` | 25 wydarzeń pokrywających wszystkie kombinacje ustawień (w tym oferty z rezerwy i propozycje składów). Bezpieczny do wielokrotnego użycia — czyści po markerze `[TEST]` w opisie |
| `supabase/seed-test-users.sql` | Konta `test1..test10@example.com`, hasło `test1234` |

Oba uruchamiane ręcznie w SQL Editor.
