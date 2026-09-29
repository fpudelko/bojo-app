-- ============================================================
-- Bojo — MECZE DO NAGRAŃ EKRANU (animacja „dla organizatorów" na landingu)
-- ============================================================
-- To NIE jest migracja. Wklej całość w Supabase → SQL Editor i uruchom.
-- Bezpieczne do wielokrotnego uruchamiania: kasuje poprzedni przebieg i stawia
-- wszystko od nowa, POD TYMI SAMYMI ADRESAMI (patrz „Bez markera" niżej).
--
-- PO CO. Animacja na górze bojo.pl pokazuje drogę organizatora: skład, goście
-- bez konta, rezerwa, drużyny, rozliczenie, „kto nie przyszedł". Żeby ją
-- dopracować na wzór prawdziwych ekranów, trzeba te ekrany nagrać — a do tego
-- potrzebne są mecze w KAŻDYM z tych stanów naraz. Doklikanie ich ręcznie to
-- kilkanaście minut na każde nagranie.
--
-- CZYM SIĘ RÓŻNI OD RESZTY SEEDÓW. Wszystko tu jest NA EKRANIE nagrania:
--   • żadnych markerów w tytułach, opisach, rozmowach ani nazwach —
--     brzmią jak prawdziwe wpisy organizatora (ta sama lekcja co
--     `seed_landing_demo.sql`: marker w opisie wylądował raz na zrzucie),
--   • bez długiego myślnika w treściach widocznych dla gracza (AGENTS.md),
--   • gracze z kontem to konta test1..test5 (imię, nazwisko, zdjęcie), goście
--     bez konta mają zwykłe imiona i nazwiska — te same, co w animacji.
--
-- BEZ MARKERA — jak to sprząta. Mecze i ekipa dostają STAŁE identyfikatory
-- liczone z `md5('bojo-nagranie-<n>')`. Wyglądają jak każdy inny UUID (widać je
-- w pasku adresu na nagraniu), a jednocześnie dają się jednoznacznie
-- skasować — bez ryzyka, że poleci mecz założony ręcznie w trakcie nagrania,
-- np. „Czwartkowa ligówka" z kreatora. Drugi zysk: po ponownym uruchomieniu
-- adresy się NIE zmieniają, więc zakładki w przeglądarce dalej działają.
--
-- WYMAGANIA
--   • konto j4n.brz0@gmail.com — organizator wszystkiego (zaloguj się na nie),
--   • konta test1..test5@example.com (`seed-test-users.sql`) — opcjonalne:
--     bez nich te osoby trafiają do składu jako goście bez konta, pod tym
--     samym imieniem i nazwiskiem.
--
-- WIDOCZNOŚĆ. Mecze są domyślnie PRYWATNE: widzi je organizator, uczestnicy
-- i każdy z linkiem, ale nie ma ich na liście otwartych gier na bojo.pl, więc
-- nikt obcy nie zapisze się do fikcyjnej gierki. Na nagranie listy otwartych
-- gier zmień `widocznosc` niżej na 'public' — i puść seed jeszcze raz po
-- nagraniu z 'private'.
--
-- POWIADOMIENIA. Wstawienie graczy uruchamia te same wyzwalacze co prawdziwy
-- zapis: dostaniesz dzwonek (i push, jeśli masz włączone) o dwóch prośbach
-- o dołączenie, o komplecie i o wiadomościach w rozmowie. Tak ma być — to
-- dokładnie to, co organizator widzi w prawdziwym życiu. Maili nie wysyła:
-- poczta idzie wyłącznie przy odwołaniu, zmianie terminu, przypomnieniu
-- i ofercie miejsca z rezerwy (`169`), a żadnej z tych rzeczy seed nie robi.
--
-- CO JEST W ŚRODKU (tytuł → stan → co da się nagrać)
--   1. Czwartkowa ligówka        najbliższy czwartek, 10/14, płatny 15 zł, BLIK,
--                                bramkarz, gość dopisany przez gracza, rozmowa
--                                → skład, „Dopisz osobę bez konta", rozliczenia
--                                  przed meczem, udostępnianie linku
--   2. Piątkowa gierka           piątek, KOMPLET 12/12 + 2 na rezerwie (z kontem),
--                                drużyny Niebiescy/Czerwoni opublikowane,
--                                kapitanowie → rezerwa, podział na drużyny
--   3. Sobotnie granie           sobota, wymaga akceptacji, 8/14 + 2 prośby
--                                → niebieska karta „Prośby o dołączenie"
--   4. Granie na Wildzie         WCZORAJ, nic nierozliczone, wynik nie wpisany
--                                → karta „Po meczu" na żywo: Nieobecni,
--                                  Zapłacili, Wyślij rozliczenie, Wpisz wynik
--   5. Czwartkowa ligówka        poprzedni czwartek, ROZLICZONA: wynik 6:4
--                                ze strzelcami, 1 osoba nie oddała, 1 oznaczona
--                                jako nieobecna → stan „po", gotowy do zrzutu
--   6. Siatkówka w hali          przyszła środa, 8/12 → druga dyscyplina na
--                                liście „Moje gry"
--   + ekipa „Czwartkowa gierka" (5 osób, wpis na tablicy), do której należą
--     oba mecze „Czwartkowa ligówka".
--
-- SPRZĄTANIE: `supabase/wyczysc-testowe.sql` (sekcja 2) kasuje to razem
-- z resztą danych testowych — po tych samych identyfikatorach.
-- ============================================================

-- Gracz do składu. Z kontem, gdy konto istnieje (imię bierze wtedy z profilu,
-- żeby lista i profil gracza mówiły to samo), w przeciwnym razie jako gość bez
-- konta dopisany przez organizatora albo przez `p_dodal` — tak samo jak robi
-- to aplikacja. Zwraca id wpisu (potrzebne pod gole i nieobecności).
CREATE OR REPLACE FUNCTION pg_temp.gracz(
  p_event      uuid,
  p_email      text,
  p_imie       text,
  p_minut_temu int     DEFAULT 600,
  p_dodal      text    DEFAULT NULL,   -- e-mail osoby, która dopisała gościa
  p_druzyna    text    DEFAULT NULL,
  p_kapitan    boolean DEFAULT false,
  p_bramkarz   boolean DEFAULT false,
  p_rezerwa    boolean DEFAULT false,
  p_prosba     boolean DEFAULT false,
  p_platnosc   text    DEFAULT NULL,   -- 'blik' | 'gotowka'
  p_zaplacil   boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_user  uuid := (SELECT id FROM auth.users WHERE email = p_email);
  v_org   uuid := (SELECT organizer_id FROM events WHERE id = p_event);
  v_cena  int  := (SELECT cost_grosz FROM events WHERE id = p_event);
  v_imie  text := p_imie;
  v_kiedy timestamptz := now() - make_interval(mins => p_minut_temu);
  v_id    uuid;
BEGIN
  IF v_user IS NOT NULL THEN
    v_imie := COALESCE(NULLIF((SELECT display_name FROM profiles WHERE id = v_user), ''), p_imie);
  END IF;

  INSERT INTO event_participants (
    event_id, user_id, name, is_guest, added_by, team, is_captain, is_goalkeeper,
    is_reserve, pending_approval, payment_method, has_paid, paid_amount,
    created_at, zapisano_at
  ) VALUES (
    p_event, v_user, v_imie, v_user IS NULL,
    CASE WHEN v_user IS NULL
         THEN COALESCE((SELECT id FROM auth.users WHERE email = p_dodal), v_org) END,
    p_druzyna, p_kapitan, p_bramkarz,
    p_rezerwa, p_prosba, p_platnosc, p_zaplacil,
    CASE WHEN p_zaplacil THEN v_cena ELSE 0 END,
    v_kiedy, v_kiedy
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

DO $$
DECLARE
  -- 'private' albo 'public' — patrz „WIDOCZNOŚĆ" w nagłówku.
  widocznosc TEXT := 'private';

  jan   UUID := (SELECT id FROM auth.users WHERE email = 'j4n.brz0@gmail.com');
  JA    CONSTANT TEXT := 'j4n.brz0@gmail.com';
  T1    CONSTANT TEXT := 'test1@example.com';   -- Jakub Kowalski
  T2    CONSTANT TEXT := 'test2@example.com';   -- Mateusz Nowak
  T3    CONSTANT TEXT := 'test3@example.com';   -- Piotr Wiśniewski
  T4    CONSTANT TEXT := 'test4@example.com';   -- Kacper Wójcik
  T5    CONSTANT TEXT := 'test5@example.com';   -- Michał Kamiński
  T6    CONSTANT TEXT := 'test6@example.com';   -- Zuzanna Lewandowska
  T7    CONSTANT TEXT := 'test7@example.com';   -- Julia Zielińska
  T8    CONSTANT TEXT := 'test8@example.com';   -- Maja Szymańska
  jan_n TEXT;

  -- Stałe identyfikatory — patrz „BEZ MARKERA" w nagłówku.
  e_liga     UUID := md5('bojo-nagranie-1')::uuid;
  e_piatek   UUID := md5('bojo-nagranie-2')::uuid;
  e_sobota   UUID := md5('bojo-nagranie-3')::uuid;
  e_wczoraj  UUID := md5('bojo-nagranie-4')::uuid;
  e_rozlicz  UUID := md5('bojo-nagranie-5')::uuid;
  e_siatka   UUID := md5('bojo-nagranie-6')::uuid;
  g_ekipa    UUID := md5('bojo-nagranie-grupa')::uuid;

  -- Daty liczone w polskiej strefie, bo tak liczy je aplikacja
  -- (`lib/czasPolski.ts`): po północy UTC `CURRENT_DATE` bywa jeszcze wczoraj.
  dzis      DATE := (now() AT TIME ZONE 'Europe/Warsaw')::date;
  czwartek  DATE;   -- najbliższy czwartek PO dzisiejszym dniu
  poprzedni DATE;   -- ostatni czwartek, który już minął
  wczoraj   DATE;

  -- Obiekty z katalogu (migracja `002`) — jeśli któregoś nie ma, mecz dostaje
  -- samą nazwę i współrzędne, bez linku do strony obiektu.
  f_grunwald UUID := 'c0000000-0000-0000-0000-000000000008';
  f_rataje   UUID := 'c0000000-0000-0000-0000-000000000001';
  f_jezyce   UUID := 'c0000000-0000-0000-0000-000000000002';
  f_wilda    UUID := 'c0000000-0000-0000-0000-000000000006';
  f_hala     UUID := 'c0000000-0000-0000-0000-000000000009';

  p     UUID;
  p1 UUID; p2 UUID; p3 UUID; p4 UUID; p5 UUID; p6 UUID;
BEGIN
  IF jan IS NULL THEN
    RAISE EXCEPTION 'Brak konta j4n.brz0@gmail.com w auth.users — zaloguj się raz do aplikacji.';
  END IF;
  IF to_regclass('public.event_blik') IS NULL THEN
    RAISE EXCEPTION 'Baza nie ma migracji 120_rozmowa_i_blik_tylko_dla_swoich.sql (tabela event_blik) — uruchom brakujące migracje i puść seed jeszcze raz.';
  END IF;

  -- Kasowanie poprzedniego przebiegu ZA sprawdzeniami — nieudany seed zostawia
  -- bazę taką, jaką zastał. Uczestnicy, rozmowy, wynik, gole, BLIK
  -- i nieobecności lecą kaskadą razem z meczem.
  DELETE FROM events WHERE id IN (e_liga, e_piatek, e_sobota, e_wczoraj, e_rozlicz, e_siatka);
  DELETE FROM groups WHERE id = g_ekipa;

  jan_n := COALESCE(NULLIF((SELECT display_name FROM profiles WHERE id = jan), ''), 'Jan Brzozowski');

  czwartek  := dzis + CASE WHEN extract(isodow FROM dzis) < 4
                           THEN 4 - extract(isodow FROM dzis)::int
                           ELSE 11 - extract(isodow FROM dzis)::int END;
  poprzedni := czwartek - 7;
  IF poprzedni >= dzis THEN poprzedni := poprzedni - 7; END IF;
  wczoraj   := dzis - 1;
  IF wczoraj = poprzedni THEN wczoraj := dzis - 2; END IF;

  -- ==========================================================
  -- EKIPA
  -- ==========================================================
  -- Właściciel trafia do `group_members` sam (wyzwalacz z migracji `044`).
  INSERT INTO groups (id, name, description, sport, city, created_by)
  VALUES (g_ekipa, 'Czwartkowa gierka',
    'Gramy w czwartki o 18:00 na Grunwaldzie, 7 na 7. Nowi mile widziani, wystarczy dołączyć przez link i zapisać się na najbliższy mecz.',
    'piłka nożna', 'Poznań', jan);

  INSERT INTO group_members (group_id, user_id, role)
  SELECT g_ekipa, u.id, 'member'
    FROM auth.users u WHERE u.email IN (T1, T2, T3, T4, T5)
  ON CONFLICT DO NOTHING;

  IF to_regclass('public.group_posts') IS NOT NULL THEN
    INSERT INTO group_posts (group_id, user_id, user_name, body, created_at)
    VALUES (g_ekipa, jan, jan_n,
      'Od października gramy do 19:30, boisko jest nasze na pełne półtorej godziny. Zapisy na czwartek już otwarte.',
      now() - interval '2 days');
  END IF;

  -- ==========================================================
  -- 1. CZWARTKOWA LIGÓWKA — przed meczem, skład się zbiera
  -- ==========================================================
  -- Ten sam mecz, który zakłada animacja (czwartek 18:00, Grunwald, 14 miejsc,
  -- 15 zł, BLIK). 10/14, żeby na nagraniu dało się jeszcze dopisać graczy
  -- i dojść do kompletu.
  INSERT INTO events (
    id, organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
    title, description, event_date, event_time, end_time,
    max_players, visibility, group_id,
    goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved,
    cost_grosz, accepted_payment_methods, track_payments, show_payment_status
  )
  SELECT e_liga, jan, jan_n, 'piłka nożna',
    f.id, COALESCE(f.name, 'Boisko Grunwald'), COALESCE(f.lat, 52.4010), COALESCE(f.lng, 16.9000),
    'Czwartkowa ligówka',
    'Gramy 7 na 7 na sztucznej trawie, turfy albo lanki. Zbiórka 15 minut przed, rozgrzewka wspólna. Za boisko 210 zł, wychodzi po 15 zł od osoby.',
    czwartek, '18:00', '19:30',
    14, widocznosc, g_ekipa,
    true, 2, false,
    1500, ARRAY['blik','gotowka']::text[], true, true
  FROM (SELECT 1) x LEFT JOIN fields f ON f.id = f_grunwald;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (e_liga, '500 100 200');

  PERFORM pg_temp.gracz(e_liga, JA, jan_n,               p_minut_temu => 2900);
  PERFORM pg_temp.gracz(e_liga, T1, 'Jakub Kowalski',    p_minut_temu => 2850, p_platnosc => 'blik', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_liga, T2, 'Mateusz Nowak',     p_minut_temu => 2700, p_bramkarz => true, p_platnosc => 'blik', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_liga, T3, 'Piotr Wiśniewski',  p_minut_temu => 2400, p_platnosc => 'gotowka');
  PERFORM pg_temp.gracz(e_liga, NULL, 'Bartek Lis',      p_minut_temu => 2300);
  PERFORM pg_temp.gracz(e_liga, T4, 'Kacper Wójcik',     p_minut_temu => 1500, p_platnosc => 'blik', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_liga, NULL, 'Szymon Mazur',    p_minut_temu => 1400);
  PERFORM pg_temp.gracz(e_liga, T5, 'Michał Kamiński',   p_minut_temu => 700,  p_platnosc => 'blik');
  PERFORM pg_temp.gracz(e_liga, NULL, 'Krzysiek Zając',  p_minut_temu => 650,  p_dodal => T1);
  PERFORM pg_temp.gracz(e_liga, NULL, 'Adam Krawczyk',   p_minut_temu => 90);

  INSERT INTO event_comments (event_id, user_id, user_name, body, created_at)
  SELECT e_liga, u.id, COALESCE(pr.display_name, x.imie), x.tresc, now() - x.temu
    FROM (VALUES
      (JA, 'Jan',              'Zapisy otwarte, jest 14 miejsc. Kto może, niech płaci BLIKiem od razu, będzie mniej liczenia po meczu.', interval '47 hours'),
      (T1, 'Jakub Kowalski',   'Dopisałem Krzyśka, gra z nami pierwszy raz.',                                                           interval '11 hours'),
      (T2, 'Mateusz Nowak',    'Biorę bramkę. Ktoś ma pompkę? Moja padła.',                                                             interval '9 hours'),
      (T3, 'Piotr Wiśniewski', 'Mam, przyniosę. Płacę gotówką na miejscu.',                                                             interval '8 hours')
    ) AS x(mail, imie, tresc, temu)
    JOIN auth.users u ON u.email = x.mail
    LEFT JOIN profiles pr ON pr.id = u.id;

  -- ==========================================================
  -- 2. PIĄTKOWA GIERKA — komplet, rezerwa, drużyny
  -- ==========================================================
  INSERT INTO events (
    id, organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
    title, description, event_date, event_time, end_time,
    max_players, visibility, team_mode, teams_published,
    cost_grosz, accepted_payment_methods, track_payments, show_payment_status
  )
  SELECT e_piatek, jan, jan_n, 'piłka nożna',
    f.id, COALESCE(f.name, 'Orlik Rataje'), COALESCE(f.lat, 52.3942), COALESCE(f.lng, 16.9580),
    'Piątkowa gierka',
    'Szóstki na orliku, gramy dwie połówki po 40 minut. Składy już są, zmiana stron w przerwie.',
    czwartek + 1, '20:00', '21:30',
    12, widocznosc, 'reczne', true,
    1200, ARRAY['blik','gotowka']::text[], true, true
  FROM (SELECT 1) x LEFT JOIN fields f ON f.id = f_rataje;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (e_piatek, '500 100 200');

  PERFORM pg_temp.gracz(e_piatek, JA, jan_n,              p_minut_temu => 4000, p_druzyna => 'A', p_kapitan => true);
  PERFORM pg_temp.gracz(e_piatek, T1, 'Jakub Kowalski',   p_minut_temu => 3900, p_druzyna => 'A', p_platnosc => 'blik', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_piatek, T4, 'Kacper Wójcik',    p_minut_temu => 3800, p_druzyna => 'B', p_kapitan => true, p_platnosc => 'blik', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_piatek, NULL, 'Filip Jankowski', p_minut_temu => 3500, p_druzyna => 'A');
  PERFORM pg_temp.gracz(e_piatek, T5, 'Michał Kamiński',  p_minut_temu => 3300, p_druzyna => 'B', p_platnosc => 'blik', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_piatek, NULL, 'Bartek Lis',     p_minut_temu => 3100, p_druzyna => 'A');
  PERFORM pg_temp.gracz(e_piatek, NULL, 'Kamil Nowicki',  p_minut_temu => 3000, p_druzyna => 'B');
  PERFORM pg_temp.gracz(e_piatek, NULL, 'Szymon Mazur',   p_minut_temu => 2600, p_druzyna => 'A');
  PERFORM pg_temp.gracz(e_piatek, NULL, 'Łukasz Dudek',   p_minut_temu => 2200, p_druzyna => 'B');
  PERFORM pg_temp.gracz(e_piatek, NULL, 'Adam Krawczyk',  p_minut_temu => 1800, p_druzyna => 'A');
  PERFORM pg_temp.gracz(e_piatek, NULL, 'Wojtek Król',    p_minut_temu => 1500, p_druzyna => 'B');
  PERFORM pg_temp.gracz(e_piatek, NULL, 'Marek Zięba',    p_minut_temu => 1200, p_druzyna => 'B', p_dodal => T4);
  -- Rezerwa: kolejność w kolejce idzie po `zapisano_at`. Z KONTEM, bo gość
  -- bez konta na rezerwie dostaje czerwone „Bez adresu e-mail, nie dostanie
  -- oferty miejsca" — na nagraniu wygląda to na błąd, a nie na kolejkę.
  PERFORM pg_temp.gracz(e_piatek, T2, 'Mateusz Nowak',    p_minut_temu => 400, p_rezerwa => true, p_platnosc => 'blik');
  PERFORM pg_temp.gracz(e_piatek, T3, 'Piotr Wiśniewski', p_minut_temu => 120, p_rezerwa => true, p_platnosc => 'gotowka');

  -- ==========================================================
  -- 3. SOBOTNIE GRANIE — prośby o dołączenie
  -- ==========================================================
  INSERT INTO events (
    id, organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
    title, description, event_date, event_time, end_time,
    max_players, visibility, require_approval
  )
  SELECT e_sobota, jan, jan_n, 'piłka nożna',
    f.id, COALESCE(f.name, 'Boisko Orlik Jeżyce'), COALESCE(f.lat, 52.4205), COALESCE(f.lng, 16.9020),
    'Sobotnie granie',
    'Poranna gra na luzie, poziom rekreacyjny. Zapisy zatwierdzam ręcznie, żeby składy były w miarę równe.',
    czwartek + 2, '10:00', '11:30',
    14, widocznosc, true
  FROM (SELECT 1) x LEFT JOIN fields f ON f.id = f_jezyce;

  PERFORM pg_temp.gracz(e_sobota, JA, jan_n,              p_minut_temu => 3000);
  PERFORM pg_temp.gracz(e_sobota, T1, 'Jakub Kowalski',   p_minut_temu => 2800);
  PERFORM pg_temp.gracz(e_sobota, T2, 'Mateusz Nowak',    p_minut_temu => 2500);
  PERFORM pg_temp.gracz(e_sobota, T3, 'Piotr Wiśniewski', p_minut_temu => 2000);
  PERFORM pg_temp.gracz(e_sobota, NULL, 'Bartek Lis',     p_minut_temu => 1900);
  PERFORM pg_temp.gracz(e_sobota, NULL, 'Szymon Mazur',   p_minut_temu => 1600);
  PERFORM pg_temp.gracz(e_sobota, NULL, 'Igor Sikora',    p_minut_temu => 1000);
  PERFORM pg_temp.gracz(e_sobota, NULL, 'Dawid Baran',    p_minut_temu => 800);
  -- Prośby — z kontem, bo prośbę składa zalogowany gracz (dzwonek organizatora
  -- dostaje powiadomienie z migracji `072`).
  PERFORM pg_temp.gracz(e_sobota, T4, 'Kacper Wójcik',    p_minut_temu => 45, p_prosba => true);
  PERFORM pg_temp.gracz(e_sobota, T5, 'Michał Kamiński',  p_minut_temu => 12, p_prosba => true);

  -- ==========================================================
  -- 4. GRANIE NA WILDZIE — wczoraj, NIC jeszcze nierozliczone
  -- (tytuł bez dnia tygodnia: „wczoraj" wypada w inny dzień przy każdym
  -- uruchomieniu, a „Środowe granie" w poniedziałek wyglądało na pomyłkę)
  -- ==========================================================
  -- Mecz do nagrania karty „Po meczu" na żywo: oznacz nieobecnych, odhacz
  -- wpłaty, wyślij rozliczenie, wpisz wynik. Drużyny są, żeby wynik miał się
  -- do czego odnieść. Po nagraniu puść seed jeszcze raz — wraca do stanu „przed".
  INSERT INTO events (
    id, organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
    title, description, event_date, event_time, end_time,
    max_players, visibility, team_mode, teams_published, track_results,
    cost_grosz, accepted_payment_methods, track_payments, show_payment_status
  )
  SELECT e_wczoraj, jan, jan_n, 'piłka nożna',
    f.id, COALESCE(f.name, 'Orlik Wilda'), COALESCE(f.lat, 52.3850), COALESCE(f.lng, 16.9180),
    'Granie na Wildzie',
    'Szóstki na Wildzie, boisko 144 zł, czyli po 12 zł od osoby. Płatność BLIKiem albo gotówką po meczu.',
    wczoraj, '19:00', '20:30',
    12, widocznosc, 'reczne', true, true,
    1200, ARRAY['blik','gotowka']::text[], true, true
  FROM (SELECT 1) x LEFT JOIN fields f ON f.id = f_wilda;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (e_wczoraj, '500 100 200');

  PERFORM pg_temp.gracz(e_wczoraj, JA, jan_n,              p_minut_temu => 7000, p_druzyna => 'A');
  PERFORM pg_temp.gracz(e_wczoraj, T1, 'Jakub Kowalski',   p_minut_temu => 6900, p_druzyna => 'A', p_platnosc => 'blik', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_wczoraj, T2, 'Mateusz Nowak',    p_minut_temu => 6800, p_druzyna => 'B', p_platnosc => 'blik');
  PERFORM pg_temp.gracz(e_wczoraj, T3, 'Piotr Wiśniewski', p_minut_temu => 6500, p_druzyna => 'B', p_platnosc => 'gotowka');
  PERFORM pg_temp.gracz(e_wczoraj, T4, 'Kacper Wójcik',    p_minut_temu => 6000, p_druzyna => 'A', p_platnosc => 'blik', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_wczoraj, T5, 'Michał Kamiński',  p_minut_temu => 5500, p_druzyna => 'B', p_platnosc => 'blik');
  PERFORM pg_temp.gracz(e_wczoraj, NULL, 'Bartek Lis',     p_minut_temu => 5000, p_druzyna => 'A');
  PERFORM pg_temp.gracz(e_wczoraj, NULL, 'Szymon Mazur',   p_minut_temu => 4800, p_druzyna => 'B');
  PERFORM pg_temp.gracz(e_wczoraj, NULL, 'Adam Krawczyk',  p_minut_temu => 4000, p_druzyna => 'A');
  PERFORM pg_temp.gracz(e_wczoraj, NULL, 'Kamil Nowicki',  p_minut_temu => 3500, p_druzyna => 'B');
  PERFORM pg_temp.gracz(e_wczoraj, NULL, 'Wojtek Król',    p_minut_temu => 3000, p_druzyna => 'A');
  PERFORM pg_temp.gracz(e_wczoraj, NULL, 'Oskar Pawlak',   p_minut_temu => 2500, p_druzyna => 'B', p_dodal => T2);

  INSERT INTO event_comments (event_id, user_id, user_name, body, created_at)
  SELECT e_wczoraj, u.id, COALESCE(pr.display_name, x.imie), x.tresc, now() - x.temu
    FROM (VALUES
      (T1, 'Jakub Kowalski', 'Dobra gra, dzięki! Poszło BLIKiem.',                interval '14 hours'),
      (T2, 'Mateusz Nowak',  'Oddam jutro, dziś już nie miałem jak.',             interval '13 hours')
    ) AS x(mail, imie, tresc, temu)
    JOIN auth.users u ON u.email = x.mail
    LEFT JOIN profiles pr ON pr.id = u.id;

  -- ==========================================================
  -- 5. CZWARTKOWA LIGÓWKA (poprzednia) — ROZLICZONA
  -- ==========================================================
  -- Stan „po" do zrzutu: wynik 6:4 ze strzelcami, 13 z 14 oddało, Wojtek
  -- oznaczony jako nieobecny. Jedna osoba bez wpłaty jest CELOWO — przy
  -- wszystkich rozliczonych karta „Po meczu" zwija się do jednej linii
  -- i przycisk „Nieobecni" znika (`PoMeczuCard.tsx`).
  INSERT INTO events (
    id, organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
    title, description, event_date, event_time, end_time,
    max_players, visibility, group_id, team_mode, teams_published, track_results,
    cost_grosz, accepted_payment_methods, track_payments, show_payment_status
  )
  SELECT e_rozlicz, jan, jan_n, 'piłka nożna',
    f.id, COALESCE(f.name, 'Boisko Grunwald'), COALESCE(f.lat, 52.4010), COALESCE(f.lng, 16.9000),
    'Czwartkowa ligówka',
    'Gramy 7 na 7 na sztucznej trawie, turfy albo lanki. Zbiórka 15 minut przed, rozgrzewka wspólna. Za boisko 210 zł, wychodzi po 15 zł od osoby.',
    poprzedni, '18:00', '19:30',
    14, widocznosc, g_ekipa, 'reczne', true, true,
    1500, ARRAY['blik','gotowka']::text[], true, true
  FROM (SELECT 1) x LEFT JOIN fields f ON f.id = f_grunwald;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (e_rozlicz, '500 100 200');

  p1 := pg_temp.gracz(e_rozlicz, JA, jan_n,              p_minut_temu => 12000, p_druzyna => 'A', p_kapitan => true);
  p2 := pg_temp.gracz(e_rozlicz, T1, 'Jakub Kowalski',   p_minut_temu => 11900, p_druzyna => 'A', p_platnosc => 'blik', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_rozlicz, T2, 'Mateusz Nowak',  p_minut_temu => 11800, p_druzyna => 'A', p_bramkarz => true, p_platnosc => 'blik', p_zaplacil => true);
  p3 := pg_temp.gracz(e_rozlicz, T3, 'Piotr Wiśniewski', p_minut_temu => 11500, p_druzyna => 'B', p_kapitan => true, p_platnosc => 'gotowka', p_zaplacil => true);
  p4 := pg_temp.gracz(e_rozlicz, T4, 'Kacper Wójcik',    p_minut_temu => 11000, p_druzyna => 'B', p_platnosc => 'blik', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_rozlicz, T5, 'Michał Kamiński', p_minut_temu => 10500, p_druzyna => 'A', p_platnosc => 'blik', p_zaplacil => true);
  p5 := pg_temp.gracz(e_rozlicz, NULL, 'Bartek Lis',     p_minut_temu => 10000, p_druzyna => 'A', p_platnosc => 'blik', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_rozlicz, NULL, 'Szymon Mazur', p_minut_temu => 9500,  p_druzyna => 'B', p_platnosc => 'gotowka', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_rozlicz, NULL, 'Adam Krawczyk', p_minut_temu => 9000, p_druzyna => 'B');
  PERFORM pg_temp.gracz(e_rozlicz, NULL, 'Kamil Nowicki', p_minut_temu => 8500, p_druzyna => 'A', p_platnosc => 'blik', p_zaplacil => true);
  p6 := pg_temp.gracz(e_rozlicz, NULL, 'Wojtek Król',    p_minut_temu => 8000,  p_druzyna => 'B', p_platnosc => 'blik', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_rozlicz, NULL, 'Łukasz Dudek', p_minut_temu => 7500,  p_druzyna => 'B', p_bramkarz => true, p_platnosc => 'gotowka', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_rozlicz, NULL, 'Krzysiek Zając', p_minut_temu => 7000, p_druzyna => 'A', p_dodal => T1, p_platnosc => 'blik', p_zaplacil => true);
  PERFORM pg_temp.gracz(e_rozlicz, NULL, 'Filip Jankowski', p_minut_temu => 6500, p_druzyna => 'B', p_platnosc => 'blik', p_zaplacil => true);

  INSERT INTO match_results (event_id, score_a, score_b, recorded_by, winner)
  VALUES (e_rozlicz, 6, 4, jan, 'A');
  INSERT INTO player_goals (event_id, participant_id, goals) VALUES
    (e_rozlicz, p2, 3), (e_rozlicz, p1, 2), (e_rozlicz, p5, 1),
    (e_rozlicz, p3, 2), (e_rozlicz, p4, 2);

  INSERT INTO player_reports (event_id, reported_participant_id, reporter_id, report_type, created_at)
  VALUES (e_rozlicz, p6, jan, 'nie_przyszedl', now() - interval '6 days');

  INSERT INTO event_comments (event_id, user_id, user_name, body, created_at)
  SELECT e_rozlicz, u.id, COALESCE(pr.display_name, x.imie), x.tresc,
         (poprzedni + x.godz)::timestamp AT TIME ZONE 'Europe/Warsaw'
    FROM (VALUES
      (JA, 'Jan',              'Dzięki za grę! 6:4 dla Niebieskich. Rozliczenie poszło, kto jeszcze nie oddał, BLIK na numer z zakładki Rozliczenia.', interval '20 hours 5 minutes'),
      (T3, 'Piotr Wiśniewski', 'Rewanż w czwartek, tym razem bierzemy Mateusza na bramkę.',                                                              interval '20 hours 40 minutes')
    ) AS x(mail, imie, tresc, godz)
    JOIN auth.users u ON u.email = x.mail
    LEFT JOIN profiles pr ON pr.id = u.id;

  -- ==========================================================
  -- 6. SIATKÓWKA W HALI — druga dyscyplina na liście
  -- ==========================================================
  INSERT INTO events (
    id, organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
    title, description, event_date, event_time, end_time,
    max_players, visibility, cost_grosz, accepted_payment_methods
  )
  SELECT e_siatka, jan, jan_n, 'siatkówka',
    f.id, COALESCE(f.name, 'Hala Sportowa Politechniki Poznańskiej'), COALESCE(f.lat, 52.4070), COALESCE(f.lng, 16.9530),
    'Siatkówka w hali',
    'Szóstki mieszane, dwa sety do 25 i tie-break. Obuwie halowe obowiązkowe.',
    czwartek + 6, '19:00', '20:30',
    12, widocznosc, 1000, ARRAY['blik']::text[]
  FROM (SELECT 1) x LEFT JOIN fields f ON f.id = f_hala;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (e_siatka, '500 100 200');

  PERFORM pg_temp.gracz(e_siatka, JA, jan_n,                  p_minut_temu => 1500);
  PERFORM pg_temp.gracz(e_siatka, T6, 'Zuzanna Lewandowska',  p_minut_temu => 1400, p_platnosc => 'blik');
  PERFORM pg_temp.gracz(e_siatka, T7, 'Julia Zielińska',      p_minut_temu => 1300, p_platnosc => 'blik');
  PERFORM pg_temp.gracz(e_siatka, T8, 'Maja Szymańska',       p_minut_temu => 1100, p_platnosc => 'blik');
  PERFORM pg_temp.gracz(e_siatka, T3, 'Piotr Wiśniewski',     p_minut_temu => 900,  p_platnosc => 'blik');
  PERFORM pg_temp.gracz(e_siatka, NULL, 'Ola Kowalska',       p_minut_temu => 700);
  PERFORM pg_temp.gracz(e_siatka, NULL, 'Tomek Wójcik',       p_minut_temu => 300);
  PERFORM pg_temp.gracz(e_siatka, NULL, 'Hubert Górski',      p_minut_temu => 60);

  -- ==========================================================
  -- DZWONEK — porządek po wyzwalaczach
  -- ==========================================================
  -- Wyzwalacz rozmowy (`109`) stempluje powiadomienie chwilą WSTAWIENIA, a nie
  -- chwilą wiadomości. Dla rozliczonego meczu sprzed tygodnia dawało to „nową
  -- wiadomość" na górze dzwonka, a przy pozostałych kolejność inną niż
  -- w rozmowie. Wyrównujemy czas do wiadomości, a ten jeden stary mecz
  -- zdejmujemy z dzwonka całkiem.
  DELETE FROM notifications WHERE event_id = e_rozlicz;
  UPDATE notifications n
     SET created_at = (SELECT max(c.created_at) FROM event_comments c WHERE c.event_id = n.event_id)
   WHERE n.type = 'wiadomosc_w_meczu'
     AND n.event_id IN (e_liga, e_wczoraj);

  RAISE NOTICE 'Gotowe: 6 meczów i ekipa „Czwartkowa gierka". Zaloguj się jako j4n.brz0@gmail.com, lista kontrolna niżej.';
END $$;

-- ============================================================
-- LISTA KONTROLNA — adresy do otwarcia przy nagrywaniu
-- ============================================================
SELECT
  e.title                                        AS mecz,
  to_char(e.event_date, 'DD.MM') || ' ' || left(e.event_time::text, 5) AS termin,
  (SELECT count(*) FROM event_participants x
    WHERE x.event_id = e.id AND NOT x.is_reserve AND NOT x.pending_approval) || '/' || e.max_players AS sklad,
  (SELECT count(*) FROM event_participants x WHERE x.event_id = e.id AND x.is_reserve)       AS rezerwa,
  (SELECT count(*) FROM event_participants x WHERE x.event_id = e.id AND x.pending_approval) AS prosby,
  '/wydarzenia/' || e.id                         AS adres
FROM events e
WHERE e.id IN (SELECT md5('bojo-nagranie-' || n)::uuid FROM generate_series(1, 6) n)
ORDER BY e.event_date, e.event_time;

SELECT name AS ekipa, join_code AS kod, '/grupy/' || id AS adres
FROM groups WHERE id = md5('bojo-nagranie-grupa')::uuid;
