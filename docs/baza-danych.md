# Baza danych

121 migracji (`001`–`123`, z lukami w numeracji — dwóch numerów tuż przed `082` brak) w
`supabase/migrations/`. Modele domenowe → [domena.md](./domena.md).

---

## ⚠️ Migracje uruchamia się RĘCZNIE

Pliki w `supabase/migrations/` trzeba **wkleić do Supabase → SQL Editor**, kolejno wg
numeracji. **Nic nie robi tego automatycznie** — nie ma CI, nie ma `supabase db push`
w pipelinie.

**Dodanie kolumny w pliku migracji ≠ kolumna istnieje w bazie.** Jeśli aplikacja rzuca
błędem o nieznanej kolumnie, pierwsza hipoteza brzmi: migracja nie została puszczona.

**Stanu bazy produkcyjnej nie da się odczytać z repo.** Numer ostatniej migracji w repo
mówi tylko, co zostało napisane — nie co zostało zastosowane.

### ⚠️ Migracja przerwana w połowie zostaje w połowie

Ręczne uruchamianie ma drugi, gorszy tryb awarii niż „nie puszczono migracji":
**puszczono jej kawałek.** Realny przebieg (sierpień 2026): seed wywala się na
`column reserve_claim_minutes does not exist`, ktoś puszcza z ręki samą pierwszą
linijkę `118` (`ALTER TABLE … RENAME COLUMN`), żeby się odblokować — i baza
zostaje ze stanem, którego nie przewiduje ani stara, ani nowa wersja kodu:
kolumna ma nową nazwę, ale **`ALTER TABLE … RENAME COLUMN` nie zmienia nazwy
ograniczenia**, więc wisi na niej dalej `CHECK 1..72` z `058`, wartość domyślna
`3` i wartości liczone w godzinach. Następny komunikat brzmi już
`violates check constraint events_reserve_claim_hours_check` i nie ma w nim ani
słowa o tym, że przyczyną jest niedokończona migracja.

Stąd dwie zasady, obie już wdrożone:

- **migracja ma dać się puścić drugi raz** (patrz „Konwencja nowych migracji"),
  i to tak, żeby doprowadziła bazę do stanu docelowego także ze stanu
  połowicznego — `118` rozpoznaje dziś trzy stany i przelicza godziny na minuty
  dokładnie raz,
- **seedy sprawdzają schemat, zanim cokolwiek zapiszą** (patrz „Dane testowe") —
  zamiast błędu Postgresa o nieznanej kolumnie dostajesz nazwę pliku migracji
  do uruchomienia.

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

### Testy reguł dostępu — `supabase/test/rls.sql`

Odczyt psuje się jeszcze ciszej niż zapis: zła polityka SELECT nie zgłasza niczego,
po prostu WYPUSZCZA dane. Dlatego `scripts/baza-testowa.sh` (a więc i zadanie
„Migracje od zera" w CI) uruchamia po migracjach zestaw asercji: zakłada mecz
prywatny przypięty do ekipy i sprawdza, ile wierszy widzi każda rola — niezalogowany,
obcy zalogowany, uczestnik, organizator, członek ekipy. Role są prawdziwe
(`SET ROLE`), tożsamość podstawiana tak jak robi to PostgREST
(`request.jwt.claim.sub`); superusera świadomie nie używamy, bo omija RLS.

**Dopisując politykę, dopisz asercję.** Osobna sekcja „ZNANE, ŚWIADOMIE OTWARTE"
pilnuje stanu faktycznego — dziś `events` i `event_participants` czyta każdy — więc
lista tego, co zostało do domknięcia, jest wykonywalna, a nie pamiętana.

---

## Tabele → migracja tworząca

| Tabela | Powstała w | Rola |
|---|---|---|
| `fields` | `001` | Boiska i obiekty (36 268 wierszy po kolejnym imporcie z OSM, `scraper/import_osm_pbf.py` — dawne „~1400" opisywało wyłącznie katalog poznański). `city`/`voivodeship`/`seo_tier` (`112`) — patrz niżej. Backfill `city`/`voivodeship` realnie przeszedł (`scraper/backfill_lokalizacja.py` przez `.github/workflows/backfill-lokalizacja.yml`): 3 605 Tier 1, 28 491 Tier 2, 4 172 Tier 3 |
| `miasta_priorytetowe` | `112` | Statyczna lista ~100 dużych/średnich miast (dane GUS), wejście do `oblicz_seo_tier()`. WYŁĄCZNIE do tieringu indeksacji — nie mylić z hubami `/[sport]/[miasto]` (`content/miasta.ts`, dziś Poznań/Warszawa/Kraków) |
| `potwierdzenia_obiektu` | `123` | Mikro-ankiety UGC pod obiektem („czy oświetlone?", „jaka nawierzchnia?") — jeden głos na fakt na osobę (`UNIQUE (field_id, user_id, fakt)`), publiczny odczyt, zapis wyłącznie we własnym imieniu. Świadomie NIE nadpisuje `fields.lit`/`fields.surface` — pokazywane obok danych z OSM, nie zamiast nich |
| `events` | `002` | Mecze. `recurring_event_id` (`073`) wiąże termin z szablonem — patrz sekcja o seriach niżej. `min_players` (`097`) — próg „gra się odbędzie", `NULL` = brak progu. `reserve_claim_minutes` (`118`, wcześniej `reserve_claim_hours`) — okno na przyjęcie zwolnionego miejsca, w minutach. `reserve_enabled` (`124`) — czy przy komplecie chętni w ogóle trafiają na rezerwę; `false` = mecz przy komplecie zamknięty |
| `event_participants` | `002` | Zapisy na mecz. Kolumny `status` i `confirmed_at` usunięte w `064` — relację gracza do meczu opisują `pending_approval` i `rsvp`. `claim_token` (`066`) pozwala gościowi przejąć wpis po założeniu konta. `zapisano_at` (`110`) — moment liczący się do kolejki rezerwowej, osobny od `created_at` |
| `event_blik` | `120` | Numer BLIK organizatora, jeden wiersz na mecz (PK = FK do `events`). OSOBNA TABELA, bo RLS w Postgresie jest wierszowe, a `events` czyta każdy — dopóki numer siedział w tamtym wierszu, leciał w każdym `select('*')` do kogokolwiek. Widzi go organizator, delegat (`089`) i uczestnik meczu; reguła „dopiero godzinę przed meczem" (`canSeeBlikPhone`) zostaje w UI |
| `dm_conversations` | `124` | Rozmowa prywatna 1-na-1. Para KANONICZNA `low_user_id < high_user_id` (CHECK) — rozmowa A↔B to zawsze jeden wiersz bez względu na to, kto pisze pierwszy; bez tego porządku trzeba by pilnować dwóch permutacji przy każdym zapisie i odczycie. Klucz główny na parze daje unikalność za darmo, więc tabela nie ma własnego `id` |
| `dm_messages` | `124` | Wiadomości prywatne. Kształt bliźniaczy do `event_comments`: płaska lista, 1..1000 znaków, miękkie kasowanie. CHECK pilnuje, że nadawca JEST stroną rozmowy — także dla zapisów omijających RLS. Czyta i pisze wyłącznie uczestnik pary; polityki dla `anon` nie ma w ogóle |
| `user_blocks` | `124` | Kto kogo zablokował. Wpis kierunkowy, ale `czy_zablokowani()` sprawdza OBIE strony przy pisaniu: kanał działający po blokadzie w jedną stronę jest gorszy niż brak blokady, bo daje złudzenie kontaktu. Blokada wchodzi w warunek ZAPISU, nie odczytu — historia sprzed niej zostaje widoczna, żeby zgłoszenie miało się do czego odwołać |
| `user_reports` | `124` | Zgłoszenia użytkowników. WYŁĄCZNIE do zapisu: ani zgłaszający, ani zgłoszony nie czytają niczego. Możliwość sprawdzenia „czy ktoś mnie zgłosił" zamieniłaby narzędzie ochrony w narzędzie nacisku |
| `event_declines` | `097` | Jawne „nie gram" — NIE nieobecność. Klucz główny `(event_id, user_id)`, RLS: widoczna dla siebie/organizatora/członków grupy meczu, zapis wyłącznie za siebie |
| `profiles` | `005` | Użytkownicy (+ flaga `is_admin`) |
| `recurring_events` | `007` | Szablony meczów cyklicznych — reguła powtarzania (dzień, godzina, wyprzedzenie), nie komplet ustawień meczu |
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
| `notifications` | `025` | Powiadomienia in-app. `claim_token` (`084`) — dla typu `niepotwierdzony_wpis_goscia`, link do przejęcia wpisu |
| `event_comments` | `026` | Komentarze pod meczem |
| `field_comments` | `063` | Komentarze pod obiektem z katalogu boisk — osobne od `event_comments`, bo przeżywają pojedynczy mecz |
| `event_activity_log` | `026` | Log zdarzeń meczu |
| `event_invites` | `036` | Zaproszenia na mecz po e-mailu — **martwa**, `lib/invites.ts` nie jest nigdzie importowany |
| `event_player_invites` | `060`, RLS poprawione w `061` | Imienne zaproszenia użytkowników na mecz |
| `groups` | `044` | Stałe ekipy. `cover_image_url` (`046`), `field_id`/`field_name` (`051`), `join_code_rotated_at` (`094`) |
| `group_members` | `044` | Członkowie ekip. `can_manage_members`/`can_create_events`/`can_moderate_wall`/`granted_by` (`092`), `invited_by` (`094`), `can_invite` (`096`) — patrz `092`/`094`/`096` niżej |
| `group_posts` | `093` | Rozmowa grupy (dawniej „Tablica") — płaska lista, `pinned_at` dla ogłoszenia, zamknięta dla nie-członków |
| `analytics_events` | `047` | Log akcji do analityki |
| `team_proposals` | `059` | Propozycje składów od uczestników |
| `team_proposal_picks` | `059` | Przypisania graczy w propozycji |
| `team_proposal_votes` | `059` | Poparcia propozycji |
| `tournaments` i 5 tabel `tournament_*` | `029` | Turniej |
| `event_delegates` | `089` | Delegowanie uprawnień organizatora (`can_edit`/`can_manage_squad`/`can_manage_payments`) — patrz `090` niżej |
| `push_subscriptions` | `102` | Subskrypcje web-push, jedna na przeglądarkę. Każdy widzi i kasuje wyłącznie swoje |
| `konfiguracja_push` | `102` | Adres funkcji `send-push` i sekret wyzwalacza. RLS bez polityk — przez API nieczytelna |
| `event_team_setup` | `103` | Ustawienie i taktyka drużyny (jeden wiersz na drużynę meczu) |
| `event_team_slots` | `103` | Przypisanie gracza do pozycji w ustawieniu |
| `event_team_messages` | `103` | Czat drużyny — czyta wyłącznie ta drużyna (+ organizator/delegat) |

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
| `073_serie_wydarzen_cyklicznych` | `events.recurring_event_id` — termin cykliczny staje się prawdziwą **serią**, nie zbiorem niepowiązanych kopii. Funkcja `utworz_termin_serii()` (RPC dla przeglądarki i crona) kopiuje pełne ustawienia z ostatniego terminu, nie z ubogiego szablonu — wcześniej `spawnEventInstance()` gubił cenę, płatności i bramkarzy. Cron co godzinę (`pg_cron`, jeśli włączony) tworzy należne terminy z wyprzedzeniem `notify_days_before`; wyzwalacz powiadamia o nowym terminie uczestników poprzedniego |
| `079_powiadom_o_zmianie_kompletu` | Wyzwalacz na `event_participants` (INSERT/UPDATE/DELETE): powiadamia organizatora, gdy skład **przechodzi** ze stanu niekompletnego w komplet albo z kompletu z powrotem w niekompletny (kogoś zabrakło). Nie powiadamia o każdym pojedynczym zapisie — tylko o zmianie stanu, żeby nie zagłuszyć dwóch naprawdę ważnych momentów kilkunastoma wpisami na jeden mecz |
| `082_guest_self_signup` | RPC `dolacz_do_meczu_jako_goscie()` — zapis na mecz bez konta (imię + e-mail), kolumny `guest_email`/`guest_phone` w `event_participants` |
| `083_fix_guest_signup_claim_token` | Poprawka `082` — `INSERT…RETURNING` z jawnym prefiksem tabeli, naprawia „ambiguous column reference" w `claim_token` |
| `084_powiadomienie_o_koncie_z_wpisem_goscia` | Dwa wyzwalacze po obu stronach skojarzenia po e-mailu: nowy wpis gościa → istniejące konto z tym e-mailem dostaje powiadomienie od razu; nowe konto → dostaje powiadomienie o już istniejących nieprzejętych wpisach gościa z tym e-mailem. Kolumna `notifications.claim_token`, indeks na `event_participants (lower(guest_email))`. Świadomie bez automatycznego przejęcia — tylko powiadomienie z linkiem, przejęcie nadal wymaga `auth.uid()` |
| `085_zapobiegaj_duplikatom_wpisu_goscia` | `dolacz_do_meczu_jako_goscie()` (`082`/`083`) sprawdza na starcie, czy ten sam e-mail już ma wpis w TYM meczu (nieprzejęty gość → zwraca istniejący `claim_token` zamiast duplikatu; przejęty → odrzuca) albo pasuje do konta już uczestniczącego przez normalne dołączenie. Naprawia realny przypadek z produkcji — ten sam e-mail zapisywał się jako gość wielokrotnie na jeden mecz |
| `086_rpc_powiadomienie_braku_nazwy` | Wyzwalacz z `070`/`071` na `auth.users` jest poprawnie zdefiniowany, ale w produkcji **nigdy nie wstawił ani jednego powiadomienia** `uzupelnij_profil` — potwierdzone zapytaniem po danych produkcyjnych (dziesiątki kont z niepełną nazwą, zero wierszy tego typu w `notifications`), przyczyna nieznana. RPC `zglos_brak_pelnej_nazwy()` (`SECURITY DEFINER`, `GRANT EXECUTE TO authenticated`) to niezawodny odpowiednik po stronie klienta — wołany z `lib/auth.tsx` przy `SIGNED_IN` dla świeżych kont (< 10 min), tym samym warunkiem `isPelneImie()` co baner na pulpicie. Wyzwalacz zostaje — `NOT EXISTS` w RPC chroni przed duplikatem, gdyby jednak zadziałał |
| `087_juz_dolaczony_flaga` | `dolacz_do_meczu_jako_goscie()` zwraca dodatkową kolumnę `already_joined` (true przy idempotentnym zwrocie istniejącego `claim_token`, false przy świeżym zapisie) — frontend rozróżnia po niej ekran „Zapisano!" od „Wcześniej dołączyłeś do tej gry.". Zmiana `RETURNS TABLE` wymagała `DROP FUNCTION` + `CREATE` (nie `CREATE OR REPLACE`) i ponownego `GRANT` |
| `088_konto_i_zamek_na_duplikaty` | Czwarta kolumna wyniku `dolacz_do_meczu_jako_goscie()`: `has_account` (`EXISTS` na `auth.users` po `lower(email)` — pytanie globalne, nie „czy w tym meczu"), dzięki czemu ekran po zapisie namawia na LOGOWANIE zamiast na drugie konto. Wyjątek `'Jesteś już zapisany na ten mecz.'` zamieniony na zwykły wiersz z `claim_token = NULL` (frontend rozpoznaje sytuację po kształcie wyniku, nie po treści komunikatu). Wyszukanie istniejącego wpisu dostało `ORDER BY (claim_token IS NULL) DESC, created_at` — samo `LIMIT 1` losowało wariant ekranu przy duplikatach. Unikalny indeks `idx_participants_unique_guest_email` na `(event_id, lower(guest_email)) WHERE guest_email IS NOT NULL` zamyka wyścig dwóch równoległych zapisów; **migracja KASUJE nadmiarowe wpisy** sprzed `085` (zostaje przejęty, a jak nie ma — najstarszy), bo inaczej indeks się nie zakłada |
| `089_delegaci_wydarzenia` | Tabela `event_delegates` (organizator deleguje `can_edit`/`can_manage_squad`/`can_manage_payments` uczestnikowi meczu albo członkowi przypiętej grupy) + trzy funkcje pomocnicze `can_edit_event()`/`can_manage_squad()`/`can_manage_payments()` (`SECURITY DEFINER`) do użycia w politykach RLS innych tabel. Listą delegatów zarządza wyłącznie prawdziwy organizator |
| `090_rozszerzenie_rls_o_delegatow` | Rozszerza polityki RLS na `events`, `event_participants`, `team_proposals`, `team_proposal_picks`, `match_results`, `player_goals`, `event_player_invites` o funkcje z `089`. Nowa RPC `event_set_payment_settings()` — jedyna droga dla delegata z samym `can_manage_payments` (bez `can_edit`) do zmiany metod płatności/BLIK, bo ogólna polityka UPDATE na `events` celowo nie obejmuje `can_manage_payments` (tabela ma ~30 niezwiązanych kolumn). `set_event_teams_published()` (`042`) przechodzi z `SECURITY INVOKER` na `SECURITY DEFINER` + `can_manage_squad()` z tego samego powodu |
| `091_oznaczanie_nieobecnosci` | Unikalny indeks na `player_reports (event_id, reported_participant_id, report_type)` — bez niego powtórne oznaczenie nieobecności zawyżało `no_shows` w `get_player_stats()`. Zaostrza RLS: `player_reports` INSERT był otwarty dla dowolnego zalogowanego użytkownika (`auth.uid() IS NOT NULL`), teraz tylko organizator/delegat z `can_manage_squad`; dodaje brakującą politykę DELETE (cofnięcie błędnego oznaczenia) |
| `092_uprawnienia_w_grupie` | `group_members` dostaje `can_manage_members`/`can_create_events`/`can_moderate_wall` (wzorem `089`) + pięć funkcji `SECURITY DEFINER` (`czy_zalozyciel_grupy`, `czy_czlonek_grupy`, `czy_moze_zarzadzac_grupa`, `czy_moze_tworzyc_wydarzenia_w_grupie`, `czy_moze_moderowac_tablice`, wszystkie z `GRANT` dla `anon` I `authenticated` — strona grupy renderuje się kluczem anonimowym). Trigger `ustaw_role_czlonka()` wylicza `role` z przełączników przy każdym zapisie, nadpisując to, co przyszło z klienta. Wyzwalacz `pilnuj_uprawnien_do_grupy()` na `events.group_id` pilnuje, kto może przypiąć mecz do grupy — pomija kontrolę, gdy `auth.uid() IS NULL` (seedy, admin z SQL Editora, przyszłe zadania w tle — ten sam wzorzec co `073`) oraz gdy termin dziedziczy grupę z serii cyklicznej (`recurring_event_id`) |
| `093_tablica_grupy` | Tabela `group_posts` (płaska lista, `pinned_at`, RLS zamknięte dla nie-członków przez `czy_czlonek_grupy`). `notifications.group_id` — powiadomienie bez meczu. Wyzwalacz `powiadom_o_ogloszeniu_w_grupie()` powiadamia ekipę WYŁĄCZNIE przy przypięciu wpisu przez kogoś z `can_moderate_wall`; `powiadom_o_nowym_meczu_w_grupie()` (`072`) dostaje `group_id` w insercie |
| `094_zaproszenia_do_grupy` | `group_members.invited_by` + `groups.join_code_rotated_at`. RPC `dolacz_do_grupy_kodem(kod, od)` (jedyna droga samodzielnego dołączenia — weryfikuje `od` w bazie, zanim zapisze zapraszającego), `dodaj_czlonka_do_grupy` (dla `can_manage_members`, bez kodu), `odswiez_kod_grupy` (wyłącznie założyciel). **Zdejmuje politykę INSERT na `group_members`** — dotąd wystarczyło znać UUID grupy (publicznie czytelne), żeby się do niej dopisać |
| `095_statystyki_grupy` | RPC `get_group_stats` (publiczne — pięć liczb do nagłówka grupy) i `get_group_leaderboard` (wyłącznie dla członków — `SECURITY DEFINER`, bo `player_reports` czyta tylko organizator/delegat). Zwycięstwa liczone wyłącznie tam, gdzie mecz miał podział na drużyny I zapisany wynik — stąd dodatkowa kolumna `matches_with_teams` jako mianownik |
| `096_zaproszanie_do_grupy` | `group_members.can_invite` (domyślnie `true`, jak `can_create_events` w `092` — dziś każdy widzi „Zaproś" bez bramki) — czwarty niezależny przełącznik, kto widzi przycisk „Zaproś" i kod dołączenia. Bramka wyłącznie UI: `dolacz_do_grupy_kodem` (`094`) nie sprawdzała i nadal nie sprawdza uprawnień zapraszającego. Trigger `ustaw_role_czlonka()` (`092`) przedefiniowany, żeby wymusić `can_invite = true` na founderze |
| `097_czy_gramy` | `events.min_players` (próg „gra się odbędzie", `NULL` domyślnie — zero zmiany dla istniejących meczów) + tabela `event_declines` (jawne „nie gram", osobna od `rsvp` — patrz `docs/domena.md`). RPC `zapytaj_milczacych(event_id)` (`SECURITY DEFINER`, wyłącznie mecze przypięte do grupy) powiadamia członków ekipy bez wpisu w składzie ani odmowy, z zaporą przed spamem (12 h). Wyzwalacz `powiadom_o_progu_gry()` na `event_participants` — wzorem `079`, reaguje na PRZEKROCZENIE progu w obie strony, nie na każdy zapis |
| `098_admin_bez_rekurencji` | Funkcja `czy_admin()` (`SECURITY DEFINER`, `STABLE`) plus przepięcie na nią polityk „Admins can update any profile" (`022`) i „Admins can update any event" (`005`). Poprzednia wersja sprawdzała uprawnienie podzapytaniem o `profiles` WEWNĄTRZ polityki na `profiles` — podzapytanie samo podlegało RLS tej tabeli, więc warunek wychodził fałsz i UPDATE zmieniał ZERO wierszy, zwracając sukces. Objaw: przełącznik admin/użytkownik „nic nie robi", wraca po odświeżeniu |
| `099_zgloszenia_bledow` | Tabela `zgloszenia_bledow` (zgłoszenia od ludzi i automatyczne awarie w jednym miejscu) plus RPC `zapisz_zgloszenie_bledu()` — `SECURITY DEFINER`, JEDYNE wejście do zapisu, bo tabela nie ma polityki INSERT. Awarie grupowane po `odcisk` (`ON CONFLICT` dokłada do licznika zamiast tworzyć kopię). SELECT/UPDATE wyłącznie dla `czy_admin()` — w kolumnie `adres` bywa link do prywatnego meczu. Trzeci rodzaj `obiekt` (`field_id`) to zgłoszenie błędu w danych boiska: NIE zmienia danych, bo katalog pochodzi z OSM |
| `100_kasowanie_wiadomosci` | Naprawa polityk SELECT na `event_comments`, `group_posts` i `field_comments`. Kasowanie wiadomości jest MIĘKKIE (UPDATE ustawiający `deleted_at`), a polityka `SELECT USING (deleted_at IS NULL)` wypychała nowy wiersz poza własną widoczność — Postgres sprawdza nowy wiersz także politykami SELECT, więc UPDATE kończył się wyjątkiem `new row violates row-level security policy`, mimo poprawnych polityk UPDATE. Skasowany wiersz widzi teraz ten, kto miał prawo go skasować (warunek jest lustrem polityki UPDATE danej tabeli); zapytania aplikacji i tak filtrują `deleted_at IS NULL` |
| `101_kto_sie_wypisal` | Druga (permissive) polityka SELECT na `event_activity_log`, obejmująca WYŁĄCZNIE wpisy `participant_left` i `participant_removed` — widzi je każdy, kto widzi mecz (podzapytanie o `events` wykonuje się z uprawnieniami pytającego, więc RLS `events` załatwia widoczność). Reszta dziennika zostaje przy organizatorze (polityka z `026`). Powód: wypisanie się kasuje wiersz z `event_participants` i nie zostawia śladu — nie da się odróżnić „odpadł" od „nigdy się nie zapisał" |
| `102_push` | Tabela `push_subscriptions` (jeden wiersz = jedna przeglądarka; kluczem `endpoint`, nie `user_id`, bo telefon i laptop to dwie subskrypcje jednej osoby) + `konfiguracja_push` (adres funkcji brzegowej i sekret; RLS WŁĄCZONE i ZERO polityk, więc przez API nieczytelna — czyta wyłącznie wyzwalacz jako `SECURITY DEFINER`). Wyzwalacz `trg_wyslij_push` na `notifications` woła funkcję `send-push` przez `pg_net`. Brak konfiguracji albo brak `pg_net` = wyjście CICHE: kanał dodatkowy nie może wywrócić INSERT-a, w którym powstało powiadomienie w aplikacji. Wdrożenie ręczne → `supabase/functions/send-push/README.md` |
| `103_taktyka_druzyny` | Trzy tabele pod zakładkę „Taktyka": `event_team_setup` (schemat jako TEKST, np. `1-4-4-2` — pozycje wylicza `lib/taktyka.ts`, więc nowe ustawienie nie wymaga migracji; taktyka jako `jsonb`), `event_team_slots` (kto na której pozycji; UNIQUE po `(event_id, participant_id)`, żeby jedna osoba nie stała w dwóch miejscach) i `event_team_messages` (czat WEWNĄTRZ drużyny, osobny od wspólnej rozmowy meczu). Funkcja `czy_w_druzynie()` (`SECURITY DEFINER`, `STABLE`). Polityka SELECT czatu ma od razu `deleted_at IS NULL OR auth.uid() = user_id` — bez tego autor nie skasuje własnej wiadomości (błąd naprawiany migracją `100` w trzech innych tabelach) |
| `104_taktyka_admin` | Dopisanie `czy_admin()` do polityk zapisu z `103` (`event_team_setup`, `event_team_slots`) oraz do odczytu i pisania w `event_team_messages`. Zakładka „Taktyka" jest za bramką `isAdmin` w interfejsie, a polityki znały wyłącznie organizatora, delegata i członka drużyny — czyli jedyna osoba, która mogła ją otworzyć, nie mogła nic zapisać (`new row violates row-level security policy`). Ta sama klasa błędu co `098`: jedno uprawnienie egzekwowane w dwóch miejscach według dwóch reguł. Kasowanie cudzych wiadomości zostaje przy autorze |
| `105_taktyka_kapitan` | Zapis ustawienia i pozycji (`event_team_setup`, `event_team_slots`) wyłącznie dla KAPITANA drużyny (`czy_kapitan_druzyny()`); czat drużyny dla całej drużyny (`czy_w_druzynie()`), bez administratora. Zmiana DECYZJI, nie naprawa: `104` wpuszczała admina, bo zakładka była wtedy schowana za `isAdmin` — teraz widzi ją każdy, kto gra, i wyłącznie swoją drużynę. Ustalenie ustawienia to jedna decyzja, nie głosowanie dziesięciu osób z prawem zapisu |
| `106_admin_zarzadza_skladem` | `czy_admin()` w politykach UPDATE/INSERT/DELETE na `event_participants`. `isOwner` w interfejsie to `organizer || isAdmin`, więc administrator widzi pełny panel organizatora (losowanie składu, przypisanie drużyny, gwiazdka kapitana), a polityki z `090` znały wyłącznie organizatora i delegata — kontrolki się klikały i nic nie robiły. Trzeci raz ten sam wzorzec po `098` i `104` |
| `107_publikacja_taktyki` | `event_team_setup.opublikowana` + zawężenie SELECT na `event_team_setup` i `event_team_slots`: kapitan widzi zawsze, reszta drużyny dopiero po publikacji (`czy_taktyka_opublikowana()`). Wzorem `events.teams_published` z `031` — kapitan układa na raty, a drużyna nie ogląda wersji pośrednich. Czat drużyny NIEzależny od publikacji |
| `108_koniec_admina_w_meczu` | Odwrócenie `106`: polityki na `event_participants` wracają do brzmienia z `090`, bez `czy_admin()`. `106` naprawiała objaw — panel organizatora pokazywany administratorowi przez `isOwner = organizer \|\| isAdmin`. Przyczyną było samo `\|\| isAdmin`, które zniknęło z `EventDetailClient.tsx`; uprawnienie, z którego nic nie korzysta, to wyłącznie ryzyko. „Admins can update any event" (`005`) zostaje — to moderacja wydarzenia, nie zarządzanie cudzym składem |
| `109_ustawienia_powiadomien` | `profiles.push_wylaczone` (tablica rodzajów, których użytkownik NIE chce na telefon; pusta = wszystko włączone, więc nowy rodzaj nie wymaga migracji danych) plus filtr w `wyslij_push_po_powiadomieniu()`. Filtr dotyczy WYŁĄCZNIE pusha — dzwonek w aplikacji pokazuje wszystko, bo to historia, a nie kanał przerywający dzień. Trzy nowe wyzwalacze: `powiadom_o_wiadomosci_w_meczu()` (`event_comments`), `powiadom_o_wiadomosci_w_grupie()` (`group_posts`, pomija przypięte — te ma `093`) i `powiadom_o_skladach()` (`events`, tylko przejście `teams_published` false→true). Obie wiadomości mają zaporę 60 min per odbiorca: rozmowa przed meczem potrafi mieć 30 wpisów w kwadrans |
| `110_moment_zapisu` | `event_participants.zapisano_at` (`NOT NULL DEFAULT now()`, backfill `= created_at`) — moment, od którego liczy się miejsce w kolejce rezerwowej, osobny od `created_at`. Trigger `trg_moment_zapisu` (`ustaw_moment_zapisu()`) ustawia go na `now()` WYŁĄCZNIE przy przejściu `rsvp` z `'maybe'` na `'yes'` — bo „Obserwuję" to ten sam wiersz co zwykły zapis (patrz `049`), a wiersz obserwującego powstaje wcześniej niż jego realne dołączenie. `sync_reserve_claim()` (`CREATE OR REPLACE`, ciało jak w `078` poza `ORDER BY zapisano_at` zamiast `created_at` w obu kolejkach — pole i bramkarze) — to ona rozdaje zwolnione miejsca, więc to ona musiała się zmienić, nie tylko etykieta na liście. Bez migracji (klient nie sortuje po `zapisano_at` w SQL) aplikacja zachowuje się jak przed nią |
| `111_tresci_powiadomien` | Treści powiadomień wg zasady: TYTUŁ = konkret, którego dotyczy (nazwa meczu, nazwa ekipy), TREŚĆ = co się wydarzyło. Przy wiadomościach treść niesie teraz samą wiadomość (`autor: tekst`, ucięty do 140 znaków z wielokropkiem) zamiast „X napisał w rozmowie" — bez tego po powiadomieniu trzeba było otworzyć aplikację, żeby dowiedzieć się, czy chodzi o „będę 10 minut później", czy o „nie dam rady". Poprawione też `sklady_opublikowane` i `nowy_mecz_w_grupie` (nazwa ekipy w tytule, termin i miejsce w treści) |
| `112_seo_tier_i_lokalizacja` | `fields.city`/`voivodeship`/`seo_tier` + tabela `miasta_priorytetowe` + funkcja `oblicz_seo_tier()` (patrz „Funkcje w bazie" niżej). Fundament pod tierowanie indeksacji katalogu boisk w wyszukiwarkach — Tier 3 dostaje `noindex,follow` w `generateMetadata` (`boisko/[id]/page.tsx`), sitemap jest partycjonowany per województwo (`sitemap-boiska/[plik]/route.ts`, zebrane w `sitemap-index.xml`). `city`/`voivodeship` wypełnia osobny, ręcznie uruchamiany skrypt `scraper/backfill_lokalizacja.py` (reużywa `nearest_place()` z `import_osm_pbf.py`) — sama migracja zostawia je puste, więc świeżo zaaplikowana baza ma wszystkie boiska w Tier 3, dopóki backfill nie przejdzie |
| `113_powiadomienie_o_usunieciu_uczestnika` | Trigger `BEFORE DELETE ON event_participants` — powiadomienie `usuniety_ze_skladu`, gdy organizator/delegat usuwa POTWIERDZONEGO gracza (nie pending — to pokrywa `076`, nie samowypisanie — `auth.uid() IS NOT DISTINCT FROM OLD.user_id`). Wcześniej wyrzucenie z już zajętego miejsca w składzie było całkowicie ciche |
| `114_powiadomienie_o_zmianie_warunkow` | Trigger `AFTER UPDATE ON events` — powiadomienie `zmiana_warunkow_meczu`, gdy zmieni się miejsce (`field_id`/`field_name`/`custom_location_name`/`custom_address`/`lat`/`lng`) lub koszt (`cost_grosz`). Jeden trigger na oba pola, bo `updateEvent()` zapisuje cały wiersz jedną instrukcją — osobne triggery dawałyby dwa powiadomienia z jednego zapisu formularza |
| `115_gosc_wymaga_akceptacji` | `DROP`/`CREATE` `dolacz_do_meczu_jako_goscie()` (sygnatura i zwrotka bez zmian) — gość respektuje `require_approval` tak samo jak zalogowany zapis (`dolacz_do_meczu`, `078`): `pending_approval = event.require_approval`, wiersz pending nie zajmuje miejsca. Wcześniej wstawiała `pending_approval = false` na sztywno — gość z linku omijał akceptację zapisów, którą organizator świadomie włączył |
| `116_powiadomienie_o_usunieciu_meczu` | Trigger `BEFORE DELETE ON events` — powiadomienie `mecz_usuniety` do uczestników (pending i potwierdzonych) przy twardym `deleteEvent()`. `event_id = NULL` w INSERT-cie — CELOWO, bo `notifications.event_id` ma `ON DELETE CASCADE` na `events(id)`, więc wiersz z `OLD.id` zostałby skasowany momenty po wstawieniu. Ta sama migracja naprawia odkryty przy tej okazji, wcześniej istniejący bug: `powiadom_o_odrzuceniu_prosby()` (`076`) nie sprawdzała, czy mecz nadrzędny wciąż istnieje — przy kaskadowym usuwaniu `event_participants` po `DELETE FROM events` z choćby jedną oczekującą prośbą, INSERT do `notifications` łamał FK i **cała transakcja usuwania meczu wywracała się błędem** |
| `117_dopiecie_subskrypcji_push` | RPC `dopnij_subskrypcje_push()` (`SECURITY DEFINER`) — przypina istniejącą subskrypcję push (kluczowaną `endpoint`) do `auth.uid()` wołającego. Naprawia realny przypadek: subskrypcja dostaje `user_id` wyłącznie przy kliknięciu „Włącz" (`wlaczPush()`); na współdzielonym urządzeniu drugie konto nigdy tego nie klika (bo `stanPush()` widzi cudzą subskrypcję i pokazuje „Włączone"), więc powiadomienia PIERWSZEGO konta lądują na telefonie, na którym jest teraz zalogowane DRUGIE. Zwykły `.upsert()` by tego nie naprawił — polityka RLS UPDATE sprawdza właściciela ISTNIEJĄCEGO wiersza, więc po cichu odrzuciłaby reassignment (`053`-owa pułapka RLS) |
| `118_rezerwa_czas_w_minutach` | `events.reserve_claim_hours` (SMALLINT, pełne godziny, `CHECK 1–72`) przenumerowana na `reserve_claim_minutes` (`CHECK 15–4320`, istniejące wartości × 60; **plik jest odporny na powtórne uruchomienie i naprawia stan połowiczny** — patrz „Migracja przerwana w połowie zostaje w połowie" wyżej) — wybór w UI był „mocno ograniczony", godzina jako jednostka fizycznie nie mieściła 30 minut. `sync_reserve_claim()` (`CREATE OR REPLACE`, ciało jak w `110` poza jednostką i czytelnym formatem czasu w treści powiadomienia — „30 min." zamiast mylącego „0 godz.") |
| `119_id_powiadomienia_w_push` | `wyslij_push_po_powiadomieniu()` (`CREATE OR REPLACE`, ciało jak w `109`) dokłada `'id', NEW.id` do payloadu wysyłanego do funkcji brzegowej `send-push`. Identyfikator jedzie do przeglądarki (`data.id` w `public/sw.js`) i wraca po kliknięciu jako `?przeczytaj=<id>` w adresie — service worker nie ma dostępu do sesji Supabase, więc nie może sam oznaczyć wiersza jako przeczytany; robi to `NotificationBell.tsx` po stronie klienta |
| `120_rozmowa_i_blik_tylko_dla_swoich` | Domyka DWA wycieki widoczne z samego internetu, bez logowania. (1) `event_comments` miało politykę SELECT `USING (deleted_at IS NULL)` — bez warunku na osobę, więc treść rozmów WSZYSTKICH meczów, także prywatnych, dało się pobrać jednym zapytaniem do REST-a. Nowa funkcja `czy_widzi_rozmowe_meczu()` (SECURITY DEFINER, lustro `mozeWidziecRozmowe` z `EventDetailClient`: uczestnik, organizator, członek ekipy meczu) wchodzi do polityk SELECT i INSERT. Człon `OR auth.uid() = user_id` stoi POZA warunkiem widoczności — inaczej autor wpadłby w pułapkę z `100` przy kasowaniu własnej wiadomości. (2) Numer BLIK przenosi się z `events.blik_phone` do nowej tabeli `event_blik` z własną polityką; `event_set_payment_settings()` (`090`) pisze już do niej |
| `121_koniec_blik_phone_w_events` | `ALTER TABLE events DROP COLUMN blik_phone` — dopiero to zamyka wyciek numeru. URUCHAMIAĆ PO WDROŻENIU frontendu z tego samego PR-a: kolejność `120` → deploy → `121`. Przed skasowaniem kolumny dokłada do `event_blik` numery, które zdążyły wejść starym frontendem między `120` a deployem |
| `125_rozmowy_prywatne` | Rozmowy prywatne 1-na-1 WRAZ z blokowaniem i zgłaszaniem — celowo w jednej migracji. Otwarty kanał do dowolnej osoby bez wyjścia awaryjnego to nie jest wersja „pierwsza, uproszczona", tylko wersja, której nie wolno wypuścić. Cztery tabele (`dm_conversations`, `dm_messages`, `user_blocks`, `user_reports`) i `czy_zablokowani()` — SECURITY DEFINER, bo polityka INSERT musi zajrzeć do cudzych blokad. Asercje w `supabase/test/rls.sql` |
| `122_odswiezenie_powiadomienia_o_wiadomosci` | `powiadom_o_wiadomosci_w_meczu()`/`powiadom_o_wiadomosci_w_grupie()` (`CREATE OR REPLACE`, ciało jak w `111`) — druga i kolejna wiadomość w tej samej rozmowie w oknie godziny (limit z `109`/`111`) już nie ginie bez śladu: zamiast pomijanego INSERT-u robi `UPDATE` istniejącego wiersza (nowa treść, świeży `created_at`, `read_at = NULL`) i dopiero `INSERT` dla odbiorców bez żadnego powiadomienia w tej godzinie. Push nie dubluje się — `trg_wyslij_push` (`102`) łapie wyłącznie `INSERT`, `UPDATE` go nie odpala |
| `123_potwierdzenia_obiektu` | Faza 3 SEO/GEO (BACKLOG.md §7a). Tabela `potwierdzenia_obiektu` — mikro-ankiety UGC pod obiektem (oświetlenie, nawierzchnia), bliźniacza RLS do `field_comments` (`063`). Zapis idzie wprost przez klienta (`.upsert()` z `onConflict`), nie przez RPC — nie ma tu nic do ukrycia przed klientem, w przeciwieństwie do `zgloszenia_bledow` (`099`), które trzyma `status`/`liczba` poza jego zasięgiem |
| `124_lista_rezerwowa_opcjonalna` | `events.reserve_enabled` (BOOLEAN NOT NULL DEFAULT `true`) — lista rezerwowa przestaje być stałą regułą i staje się wyborem organizatora. Kreator mówił pod licznikiem miejsc „Kolejni chętni trafią na listę rezerwową”, czyli opisywał zachowanie, którego nie dało się zmienić; mecz na zamkniętą ekipę albo halę opłaconą z góry rezerwy nie potrzebuje. `DEFAULT true` znaczy, że migracja nikomu niczego nie wyłącza. Wyłączenie NIE kasuje istniejących wpisów `is_reserve` — kolejka, która już powstała, zostaje widoczna, tylko nikt nowy do niej nie wejdzie. Reguły pilnuje WYZWALACZ `trg_pilnuj_wylaczonej_rezerwy` na `event_participants` (BEFORE INSERT OR UPDATE OF `is_reserve`), nie poprawka w `dolacz_do_meczu()` — na rezerwę wchodzi się kilkoma drogami (RPC, akceptacja prośby, gość bez konta, przeniesienie przez organizatora) i cztery kopie tej samej reguły by się rozjechały. Wyjątek na `rsvp = 'maybe'`: obserwujący siedzi w bazie z `is_reserve = true`, więc bez niego wyłączenie rezerwy wyłączałoby OBSERWOWANIE |

**Powiadomienia mogą powstawać wyłącznie z wyzwalaczy albo z wąsko uprawnionych
funkcji RPC** (np. `zglos_brak_pelnej_nazwy`, `086`) — nigdy z gołego INSERT-a
z przeglądarki. Tabela `notifications` (`025`) ma polityki SELECT i UPDATE dla
własnych wierszy i **żadnej polityki INSERT** — przeglądarka nie zapisze
powiadomienia nawet sobie bez przejścia przez taką funkcję. Każda z nich to
`SECURITY DEFINER` z `SET search_path = public`, wzorowana na `065`.

---

## Funkcje w bazie (RPC)

| Funkcja | Rola |
|---|---|
| `get_nearby_events` | Mecze w promieniu (używa `haversine_km`) |
| `get_player_stats` | Statystyki gracza |
| `set_event_teams_published` | Publikacja składów. `SECURITY DEFINER` + `can_manage_squad()` od `090` (wcześniej `SECURITY INVOKER` z `organizer_id` wpisanym wprost w `WHERE`) |
| `generate_join_code` | Kod dołączenia do meczu |
| `add_group_creator_as_member` | Trigger — twórca grupy zostaje członkiem |
| `tournament_team_count`, `shared_availability_days`, `admin_team_contacts` | Turniej |
| `sync_reserve_claim` | Utrzymuje kolejkę ofert zwolnionego miejsca i powiadamia o ofercie (`SECURITY DEFINER`, `062`) |
| `zglos_brak_pelnej_nazwy` | Wołana z przeglądarki (`supabase.rpc()`) przez świeżo zalogowanego użytkownika bez pełnego imienia i nazwiska — wstawia powiadomienie `uzupelnij_profil`, chyba że już istnieje (`SECURITY DEFINER`, `086`) |
| `accept_team_proposal` | Przenosi propozycję składów na realne drużyny (`SECURITY DEFINER`) |
| `can_edit_event`, `can_manage_squad`, `can_manage_payments` | Organizator ORAZ delegat z odpowiednim uprawnieniem (`event_delegates`) — używane wewnątrz polityk RLS innych tabel, nie wołane bezpośrednio z przeglądarki (`SECURITY DEFINER`, `089`) |
| `event_set_payment_settings` | Zmienia `accepted_payment_methods`/`blik_phone` na `events` dla delegata z `can_manage_payments` bez `can_edit` — jedyna droga, bo ogólna polityka UPDATE na `events` go tam nie przepuszcza (`SECURITY DEFINER`, `090`) |
| `haversine_km` | Odległość geograficzna |
| `trigger_set_updated_at`, `trigger_set_expires_at` | Triggery czasowe |
| `utworz_termin_serii(szablon_id, data)` | Tworzy jeden termin serii, kopiując ustawienia z ostatniego terminu. Wołana przez `supabase.rpc()` (przycisk „Utwórz termin” na `/cykliczne/[id]`) i przez `utworz_nalezne_terminy_serii()` — **to samo wejście dla ręcznego i automatycznego tworzenia**, żeby oba dawały identyczny wynik (`073`, `SECURITY DEFINER`, kontrola „tylko organizator” w środku) |
| `utworz_nalezne_terminy_serii` | Pętla po aktywnych szablonach, woła `utworz_termin_serii` dla każdego terminu w zasięgu `notify_days_before`. Cel zadania `pg_cron` (`073`) — działa też wywołana ręcznie, gdy `pg_cron` nie jest włączony |
| `czy_zalozyciel_grupy`, `czy_czlonek_grupy`, `czy_moze_zarzadzac_grupa`, `czy_moze_tworzyc_wydarzenia_w_grupie`, `czy_moze_moderowac_tablice` | Pomocnicze do polityk RLS na `group_members`/`groups`/`group_posts` — `SECURITY DEFINER` unika nieskończonej rekurencji polityki, która sama odpytuje `group_members` (`092`) |
| `dolacz_do_grupy_kodem`, `dodaj_czlonka_do_grupy`, `odswiez_kod_grupy` | Jedyne drogi wejścia do `group_members` po zdjęciu polityki INSERT — kolejno: dołączenie kodem, dopisanie przez zarządzającego, rotacja kodu przez założyciela (`SECURITY DEFINER`, `094`) |
| `get_group_stats`, `get_group_leaderboard` | Statystyki grupy — pierwsza publiczna, druga wyłącznie dla członków, sama sprawdza członkostwo i odmawia wyjątkiem (`095`) |
| `zapytaj_milczacych` | Wołana z przeglądarki przez organizatora/delegata z `can_create_events` — wstawia powiadomienie `pytanie_o_udzial` dla członków ekipy bez wpisu w składzie ani odmowy, pomija zaczepionych w ciągu ostatnich 12 h. Wyłącznie dla meczów przypiętych do grupy (`SECURITY DEFINER`, `097`) |
| `oblicz_seo_tier` | Tier indeksacji boiska (1/2/3) dla `sitemap.ts`/`generateMetadata` w `boisko/[id]/page.tsx` — miasto priorytetowe (`miasta_priorytetowe`) LUB `is_verified_venue` LUB ma mecz LUB ma komentarz → 1; ma miejscowość+sport+nazwę → 2; reszta → 3. Wołana z triggerów `fields_przelicz_tier` (BEFORE INSERT/UPDATE OF city, is_verified_venue, sport, name), `events_promuj_tier`, `field_comments_promuj_tier` (`112`) — nie ustawiać `seo_tier` ręcznie, triggery to przeliczają same. Audyt przy wdrożeniu: tylko 40 boisk w całej bazie miało kiedykolwiek mecz, więc to kryterium samo w sobie nie mogło być głównym sitem |

**`pg_cron` wymaga jednorazowego włączenia** (Supabase → Database → Extensions)
— migracja `073` sprawdza jego obecność i pomija harmonogram, jeśli go nie ma
(`RAISE NOTICE`, migracja się nie wywraca). Bez `pg_cron` terminy serii trzeba
tworzyć ręcznie z `/cykliczne/[id]`, albo uruchomić
`SELECT utworz_nalezne_terminy_serii();` z SQL Editora.

---

## Konwencja nowych migracji

Kolejny numer + krótka nazwa: `058_nazwa_zmiany.sql`. W nagłówku komentarz mówiący
**dlaczego** migracja powstała — nie co robi (to widać w SQL).

Dodając kolumnę do tabeli, która ma politykę RLS na `UPDATE`, sprawdź, czy polityka
obejmuje nową kolumnę.

**Migracja ma przeżyć drugie uruchomienie.** Nie dlatego, że ktoś lubi klikać dwa
razy, tylko dlatego, że przerwany przebieg zostawia bazę w połowie drogi i jedynym
narzędziem naprawy jest ten sam plik (patrz „Migracja przerwana w połowie"). W praktyce:
`IF NOT EXISTS` / `IF EXISTS` przy DDL, `DROP … IF EXISTS` przed `ADD CONSTRAINT`,
a przeliczenia danych (`UPDATE … * 60`) w gałęzi warunkowej, po znaczniku, który
mówi, czy przeliczenie już było. Uwaga na `ALTER TABLE … RENAME COLUMN`: zmienia
nazwę kolumny, **nie** nazwę ograniczenia ani wartości domyślnej — sama zmiana nazwy
nie jest migracją, tylko jej pierwszą trzecią.

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

**Seedy sprawdzają schemat, zanim cokolwiek zapiszą.** `seed_test_data.sql`,
`seed_regresja.sql` i `seed_przedpremiera.sql` zaczynają od sprawdzenia po jednym
znaczniku na wymaganą migrację (kolumna `events.reserve_claim_minutes` dla `118`,
tabela `event_blik` dla `120`) i przerywają komunikatem z **nazwą pliku migracji
do uruchomienia** — zamiast wywrócić się w środku na `column … does not exist`.
Rozpoznają też stan połowiczny `118` (patrz sekcja o migracjach wyżej). Kasowanie
poprzedniego przebiegu siedzi ZA tym sprawdzeniem, więc nieudany seed zostawia bazę
taką, jaką zastał. **Dopisując do seeda kolumnę z nowej migracji, dopisz znacznik.**
