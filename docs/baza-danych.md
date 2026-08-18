# Baza danych

99 migracji (`001`–`101`, z lukami w numeracji — dwóch numerów tuż przed `082` brak) w
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
| `events` | `002` | Mecze. `recurring_event_id` (`073`) wiąże termin z szablonem — patrz sekcja o seriach niżej. `min_players` (`097`) — próg „gra się odbędzie", `NULL` = brak progu |
| `event_participants` | `002` | Zapisy na mecz. Kolumny `status` i `confirmed_at` usunięte w `064` — relację gracza do meczu opisują `pending_approval` i `rsvp`. `claim_token` (`066`) pozwala gościowi przejąć wpis po założeniu konta |
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
