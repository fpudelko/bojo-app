# Moduł turniejowy — specyfikacja wdrożenia (średnie klocki)

> Zatwierdzone 2026-09-13, wdrożenie w toku. Zobacz [turnieje-plan-duze-klocki.md](./turnieje-plan-duze-klocki.md)
> dla kontekstu produktowego i uzasadnień. Ten plik jest odniesieniem historycznym dla
> implementacji — aktualizuj go, gdy realny kształt kodu odjedzie od tego, co tu zapisane
> (a nie odwrotnie: kod ma się z tym zgadzać, chyba że podejmiesz nową decyzję).

## A. Zatwierdzone decyzje

| # | Decyzja | Konsekwencja w kodzie |
|---|---|---|
| 1 | Stary moduł turniejowy znika | Front kasujemy w Etapie 0, sześć tabel `tournament_*` migracją `151` w Etapie 4 |
| 2 | Polskie nazwy tabel | `turnieje`, `turniej_*`; brak kolizji ze starym schematem |
| 3 | Ściana logowania na składach i statystykach | `turniej_zawodnicy` i `turniej_zdarzenia`: SELECT wyłącznie `auth.uid() IS NOT NULL` |
| 4 | MVP wybiera prowadzący | `turniej_mecze.mvp_zawodnik_id`, bez tabeli głosów |
| 5 | Wpisowe bez przepływu pieniędzy | `wpisowe_grosz` + `wpisowe_oplacone_at` + `turniej_blik` |

## B. Mapa plików

### Baza
```
supabase/migrations/
  145_turnieje_fundament.sql          E0   turnieje, osoby, drużyny, zawodnicy, RLS, 4 powiadomienia
  146_turniej_terminarz.sql           E1   grupy, areny, mecze, propagacja, przesunięcie
  147_turniej_rozgrywka.sql           E2   zdarzenia, wynik, zakoncz_mecz, 2 powiadomienia
  150_turniej_ogloszenia_blik.sql     E4   ogłoszenia, BLIK, 1 powiadomienie
  151_zegnaj_stary_turniej.sql        E4   DROP tournament_* (uruchamiana świadomie)
supabase/test/rls.sql                 E0+  sekcja turniejowa rośnie z każdym etapem
supabase/zapytania/stan-migracji.sql  E0+  znaczniki nowych tabel
supabase/seed_turniej.sql             E4   marker [TUR]
```

### lib/
```
frontend/src/lib/
  turnieje.ts             E0   turniej: CRUD, listy, uprawnienia
  turniejDruzyny.ts       E0   drużyny, składy, kod dołączenia
  turniejEtykiety.ts      E0   etykiety statusów, faz, formatów + odmiana
  turniejMecze.ts         E1   mecze, terminarz, zdarzenia, kończenie
  turniejFormat.ts        E1   CZYSTE: grupy, karuzela, drabinka, harmonogram
  turniejTabela.ts        E3   CZYSTE: tabela i sortowanie
  turniejStatystyki.ts    E3   CZYSTE: strzelcy, asysty, kartki, MVP
  turniejShare.ts         E4   adres, tekst udostępnienia

  features.ts             E0   + SHOW_TURNIEJE, − SHOW_CUP
  notifications.ts        E0   celPowiadomienia() zna turniej_id
  ikonyPowiadomien.ts     E0+  9 typów
  ustawieniaPowiadomien.ts E0+ 9 typów
  analytics.ts            E0   + 5 zdarzeń do unii AnalyticsEvent
  tournaments.ts          −    kasujemy
  tournamentLabels.ts     −    kasujemy
```

### Trasy
```
frontend/src/app/
  turnieje/
    page.tsx                              E0   lista
    TurniejeClient.tsx                    E0
    nowe/page.tsx                         E0   kreator, 4 kroki
    [id]/
      page.tsx                            E0   serwerowy: metadata + shell
      TurniejClient.tsx                   E0   zakładki
      turniejMeta.ts                      E0   generateMetadata
      opengraph-image.tsx                 E4
      zglos/page.tsx                      E0   zgłoszenie drużyny
      panel/page.tsx                      E0   panel organizatora
      panel/PanelClient.tsx               E0
      druzyna/[druzynaId]/page.tsx        E3
      mecz/[meczId]/page.tsx              E2
      mecz/[meczId]/MeczClient.tsx        E2
  t/[kod]/page.tsx                        E0   lądowanie linku drużyny
  turniej/**                              −    cały katalog kasujemy
```

### Komponenty
```
frontend/src/components/turniej/
  KartaTurnieju.tsx           E0   kafelek na liście
  PasekStanu.tsx              E0   plakietka statusu turnieju
  KrokKreatora.tsx            E0   wspólna obudowa kroku + stepper
  PodsumowanieTurnieju.tsx    E0   „Tak zobaczą to kapitanowie" + wyliczenie godzin
  ListaDruzyn.tsx             E0   lista z grupami i statusem
  KartaDruzyny.tsx            E0
  FormularzZgloszenia.tsx     E0
  SkladDruzyny.tsx            E0   lista zawodników + edycja dla kapitana
  DodajZawodnika.tsx          E0
  ZaproszenieDoDruzyny.tsx    E0   kod + link + tekst do wysłania
  SciankaLogowania.tsx        E0   „widoczne po zalogowaniu"
  PanelDruzyn.tsx             E0   organizator: przyjmij/odrzuć/rezerwa
  PanelLudzi.tsx              E0   współorganizatorzy i prowadzący
  PanelUstawien.tsx           E0
  PanelLosowania.tsx          E1
  PanelTerminarza.tsx         E1
  PanelAren.tsx               E1
  Terminarz.tsx               E1   pogrupowany po dniu i godzinie
  KartaMeczu.tsx              E1   wspólna: terminarz, drabinka, drużyna
  EdycjaMeczu.tsx             E1   godzina, arena, prowadzący
  PrzesunTerminarz.tsx        E1   presety +5/+10/+15
  KonsolaProwadzacego.tsx     E2
  ArkuszStrzelca.tsx          E2   bottom sheet ze składem
  PrzebiegMeczu.tsx           E2   oś czasu zdarzeń
  ZakonczMecz.tsx             E2   karne + MVP
  PasekNaZywo.tsx             E2   sticky na stronie turnieju
  TabelaGrupy.tsx             E3
  Drabinka.tsx                E3   lista rund → drzewko od md:
  Klasyfikacja.tsx            E3   strzelcy/asysty/kartki/MVP
components/tournament/Countdown.tsx  −
```

### Testy
```
frontend/src/__tests__/
  turniejKreator.test.ts      E0
  turniejDruzyny.test.ts      E0   uprawnienia, walidacja składu
  turniejFormat.test.ts       E1
  turniejMecze.test.ts        E2   wynik ze zdarzeń, walkower
  turniejTabela.test.ts       E3
  turniejStatystyki.test.ts   E3
frontend/e2e/
  turniej.spec.ts             E2   scenariusze za logowaniem
  wizualne.spec.ts            E0+  TRASY: −3 stare, +8 nowych
```

## C. Kontrakt typów

Blok do `frontend/src/types/index.ts`, w miejsce skasowanej sekcji `Tournament*`:

```ts
// ── Turnieje ────────────────────────────────────────────────────────────────

export type TurniejFormat     = 'grupy_puchar' | 'puchar' | 'liga';
export type TurniejStatus     = 'szkic' | 'zapisy' | 'zamkniete_zapisy'
                              | 'trwa' | 'zakonczony' | 'odwolany';
export type TurniejWidocznosc = 'publiczny' | 'na_link';
export type DruzynaStatus     = 'zgloszona' | 'przyjeta' | 'rezerwa'
                              | 'odrzucona' | 'wycofana';
export type MeczFaza          = 'grupa' | 'liga' | '1/16' | '1/8'
                              | 'cwierc' | 'polfinal' | 'o_3_miejsce' | 'final';
export type MeczStatus        = 'zaplanowany' | 'trwa' | 'zakonczony'
                              | 'walkower' | 'odwolany';
export type ZdarzenieTyp      = 'gol' | 'samobojczy' | 'zolta' | 'czerwona' | 'punkty';

export interface Turniej {
  id: string;
  organizatorId: string;
  nazwa: string;
  sport: string;
  format: TurniejFormat;
  status: TurniejStatus;
  widocznosc: TurniejWidocznosc;
  fieldId?: string;
  miejsceNazwa?: string;
  miejsceAdres?: string;
  lat?: number;
  lng?: number;
  miasto?: string;
  dataStartu: string;          // 'YYYY-MM-DD'
  dataKonca?: string;
  godzinaStartu: string;       // 'HH:MM'
  zapisyDo?: string;           // ISO
  maxDruzyn: number;
  minZawodnikow: number;
  maxZawodnikow: number;
  graczyWPolu?: number;
  liczbaGrup?: number;
  awansujeZGrupy: number;
  meczO3Miejsce: boolean;
  czasMeczuMin: number;
  przerwaMin: number;
  punktyZaWygrana: number;
  punktyZaRemis: number;
  karnePrzyRemisie: boolean;
  wpisoweGrosze: number;       // kolumna: wpisowe_grosz (bez „e") — jak cost_grosz
  regulamin?: string;
  opis?: string;
  okladkaUrl?: string;
  wymagaAkceptacji: boolean;
  mvpZawodnikId?: string;
  createdAt: string;
  liczbaDruzyn?: number;       // liczone przy pobieraniu listy, nie kolumna
}

export interface TurniejOsoba {
  turniejId: string;
  userId: string;
  mozeEdytowac: boolean;
  mozeProwadzic: boolean;
  mozeZarzadzacDruzynami: boolean;
  imie?: string;               // z profiles, przy pobraniu listy
  avatarUrl?: string;
}

/** Uprawnienia wyliczone jak `uprawnieniaCzlonka()` dla grup — czysta funkcja. */
export interface TurniejUprawnienia {
  jestOrganizatorem: boolean;
  mozeEdytowac: boolean;
  mozeProwadzic: boolean;
  mozeZarzadzacDruzynami: boolean;
}

export interface TurniejDruzyna {
  id: string;
  turniejId: string;
  nazwa: string;
  kapitanId?: string;
  kodDolaczenia: string;
  status: DruzynaStatus;
  dodanaRecznie: boolean;
  grupaId?: string;
  rozstawienie?: number;
  pozycjaRecznie?: number;
  kontaktImie?: string;
  wpisoweOplaconeAt?: string;
  regulaminZaakceptowanyAt?: string;
  createdAt: string;
  zawodnicy?: TurniejZawodnik[];
  liczbaZawodnikow?: number;
}

export interface TurniejZawodnik {
  id: string;
  druzynaId: string;
  turniejId: string;
  userId?: string;
  imie: string;
  numer?: number;
  kapitan: boolean;
  createdAt: string;
}

export interface TurniejGrupa { id: string; turniejId: string; nazwa: string }
export interface TurniejArena {
  id: string; turniejId: string; nazwa: string; fieldId?: string; kolejnosc: number;
}

export interface TurniejMecz {
  id: string;
  turniejId: string;
  numer: number;
  faza: MeczFaza;
  grupaId?: string;
  kolejka?: number;
  pozycjaWDrabince?: number;
  druzynaAId?: string;
  druzynaBId?: string;
  zrodloAMeczId?: string;
  zrodloBMeczId?: string;
  zrodloATyp?: 'zwyciezca' | 'przegrany';
  zrodloBTyp?: 'zwyciezca' | 'przegrany';
  arenaId?: string;
  zaplanowanyAt?: string;
  prowadzacyId?: string;
  status: MeczStatus;
  rozpoczetyAt?: string;
  zakonczonyAt?: string;
  wynikA: number;
  wynikB: number;
  sety?: { a: number; b: number }[];
  karneA?: number;
  karneB?: number;
  wynikRecznie: boolean;
  walkowerDla?: string;
  zwyciezcaId?: string;
  mvpZawodnikId?: string;
  notatka?: string;
}

export interface TurniejZdarzenie {
  id: string;
  meczId: string;
  turniejId: string;
  druzynaId: string;
  zawodnikId?: string;
  asystaZawodnikId?: string;
  typ: ZdarzenieTyp;
  wartosc: number;
  minuta?: number;
  createdAt: string;
}

export interface TurniejOgloszenie {
  id: string; turniejId: string; autorId: string; tresc: string; createdAt: string;
}

/** Wiersz tabeli — liczony w przeglądarce, nie ma odpowiednika w bazie. */
export interface WierszTabeli {
  druzynaId: string;
  nazwa: string;
  grupaId?: string;
  mecze: number;
  wygrane: number;
  remisy: number;
  przegrane: number;
  bramkiZdobyte: number;
  bramkiStracone: number;
  roznica: number;
  punkty: number;
  /** true, gdy o pozycji zdecydowało `pozycjaRecznie`, a nie kryteria liczone. */
  rozstrzygnietyRecznie: boolean;
}

export interface WpisKlasyfikacji {
  zawodnikId: string;
  imie: string;
  numer?: number;
  druzynaId: string;
  druzynaNazwa: string;
  gole: number;
  asysty: number;
  zolte: number;
  czerwone: number;
  mvp: number;
  mecze: number;
}
```

**Pułapka nazw (trzecia w tym repo):** kolumna to `wpisowe_grosz` (bez „e"), pole TS to
`wpisoweGrosze`. Ta sama asymetria co `cost_grosz`/`costGrosze` i
`sports_card_discount_grosz`/`sportsCardDiscountGrosze`. Robimy tak celowo — trzecia szkoła
nazewnictwa byłaby gorsza niż powtórzona dziwność.

## D. Migracja 145 — pełny SQL

Do wklejenia w `supabase/migrations/145_turnieje_fundament.sql`. Idempotentna.

```sql
-- ============================================================================
-- 145_turnieje_fundament.sql — moduł turniejowy, część 1: turniej i drużyny
-- ----------------------------------------------------------------------------
-- PO CO. Organizator turnieju amatorskiego prowadzi dziś zgłoszenia w grupie
-- na Facebooku, drużyny w arkuszu, a terminarz na kartce. Ta migracja stawia
-- fundament zamiennika: turniej z parametrami, zgłoszenia drużyn, składy
-- i uprawnienia prowadzących.
--
-- DLACZEGO NOWE TABELE, A NIE `tournament_*` Z `029`. Tamten model to inny
-- produkt: turniej zakłada wyłącznie admin, edycja jest jedna, drużyny umawiają
-- mecze same przez tygodnie, a wynik zgłasza kapitan i potwierdza rywal. Tu
-- turniej zakłada każdy organizator, terminarz powstaje z góry, a wynik wpisuje
-- prowadzący przy boisku. Polskie nazwy pozwalają obu modelom istnieć obok
-- siebie przez czas przenosin; stare tabele kasuje migracja `151`.
--
-- ŚCIANA LOGOWANIA. Skład drużyny i zdarzenia meczu czyta WYŁĄCZNIE zalogowany.
-- To jest decyzja produktowa (konto jako cena za statystyki) i RODO naraz —
-- egzekwowana w RLS, bo klucz `anon` siedzi jawnie w paczce JS.
-- ============================================================================

-- ── 1. Turniej ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turnieje (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizator_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  nazwa              text NOT NULL CHECK (char_length(nazwa) BETWEEN 3 AND 80),
  sport              text NOT NULL,
  format             text NOT NULL DEFAULT 'grupy_puchar'
                       CHECK (format IN ('grupy_puchar','puchar','liga')),
  status             text NOT NULL DEFAULT 'szkic'
                       CHECK (status IN ('szkic','zapisy','zamkniete_zapisy',
                                         'trwa','zakonczony','odwolany')),
  widocznosc         text NOT NULL DEFAULT 'publiczny'
                       CHECK (widocznosc IN ('publiczny','na_link')),

  field_id           uuid REFERENCES fields(id) ON DELETE SET NULL,
  miejsce_nazwa      text,
  miejsce_adres      text,
  lat                double precision,
  lng                double precision,
  miasto             text,

  data_startu        date NOT NULL,
  data_konca         date,
  godzina_startu     time NOT NULL DEFAULT '10:00',
  zapisy_do          timestamptz,

  max_druzyn         int NOT NULL DEFAULT 8  CHECK (max_druzyn BETWEEN 2 AND 64),
  min_zawodnikow     int NOT NULL DEFAULT 5  CHECK (min_zawodnikow BETWEEN 1 AND 30),
  max_zawodnikow     int NOT NULL DEFAULT 12 CHECK (max_zawodnikow BETWEEN 1 AND 40),
  graczy_w_polu      int CHECK (graczy_w_polu BETWEEN 1 AND 15),

  liczba_grup        int CHECK (liczba_grup BETWEEN 1 AND 16),
  awansuje_z_grupy   int NOT NULL DEFAULT 2 CHECK (awansuje_z_grupy BETWEEN 1 AND 8),
  mecz_o_3_miejsce   boolean NOT NULL DEFAULT false,
  czas_meczu_min     int NOT NULL DEFAULT 15 CHECK (czas_meczu_min BETWEEN 5 AND 120),
  przerwa_min        int NOT NULL DEFAULT 5  CHECK (przerwa_min BETWEEN 0 AND 60),
  punkty_za_wygrana  int NOT NULL DEFAULT 3  CHECK (punkty_za_wygrana BETWEEN 1 AND 5),
  punkty_za_remis    int NOT NULL DEFAULT 1  CHECK (punkty_za_remis BETWEEN 0 AND 3),
  karne_przy_remisie boolean NOT NULL DEFAULT true,

  wpisowe_grosz      int NOT NULL DEFAULT 0 CHECK (wpisowe_grosz >= 0),
  regulamin          text,
  opis               text,
  okladka_url        text,
  wymaga_akceptacji  boolean NOT NULL DEFAULT true,
  mvp_zawodnik_id    uuid,                      -- FK domknięty w punkcie 4

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT turnieje_sklad_sensowny CHECK (min_zawodnikow <= max_zawodnikow),
  CONSTRAINT turnieje_koniec_po_starcie
    CHECK (data_konca IS NULL OR data_konca >= data_startu)
);

CREATE INDEX IF NOT EXISTS idx_turnieje_organizator ON turnieje(organizator_id);
CREATE INDEX IF NOT EXISTS idx_turnieje_lista       ON turnieje(status, data_startu);

DROP TRIGGER IF EXISTS trg_turnieje_updated ON turnieje;
CREATE TRIGGER trg_turnieje_updated BEFORE UPDATE ON turnieje
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE turnieje IS
  'Turniej amatorski prowadzony w Bojo (migracja 145). Nie mylić z tabelą '
  '`tournaments` (029) — tamta to nieużywany BOJO Community Cup, kasowany w 151.';


-- ── 2. Uprawnienia: współorganizatorzy i prowadzący ─────────────────────────
-- Wzorem `event_delegates` (089) i uprawnień w grupie (092): trzy niezależne
-- przełączniki, `moze_edytowac` jest nadzbiorem pozostałych.

CREATE TABLE IF NOT EXISTS turniej_osoby (
  turniej_id               uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  user_id                  uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  moze_edytowac            boolean NOT NULL DEFAULT false,
  moze_prowadzic           boolean NOT NULL DEFAULT true,
  moze_zarzadzac_druzynami boolean NOT NULL DEFAULT false,
  dodany_przez             uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (turniej_id, user_id)
);


-- ── 3. Drużyny ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turniej_druzyny (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turniej_id         uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  nazwa              text NOT NULL CHECK (char_length(nazwa) BETWEEN 2 AND 40),
  kapitan_id         uuid REFERENCES auth.users ON DELETE SET NULL,
  kod_dolaczenia     text NOT NULL UNIQUE DEFAULT generate_join_code(),
  status             text NOT NULL DEFAULT 'zgloszona'
                       CHECK (status IN ('zgloszona','przyjeta','rezerwa',
                                         'odrzucona','wycofana')),
  dodana_recznie     boolean NOT NULL DEFAULT false,
  grupa_id           uuid,                       -- FK dokłada migracja 146
  rozstawienie       int CHECK (rozstawienie BETWEEN 1 AND 64),
  pozycja_recznie    int CHECK (pozycja_recznie BETWEEN 1 AND 64),
  kontakt_imie       text,
  kontakt_telefon    text,
  kontakt_email      text,
  wpisowe_oplacone_at        timestamptz,
  regulamin_zaakceptowany_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_druzyna_nazwa_w_turnieju
  ON turniej_druzyny(turniej_id, lower(nazwa));
CREATE INDEX IF NOT EXISTS idx_druzyny_turniej ON turniej_druzyny(turniej_id);
CREATE INDEX IF NOT EXISTS idx_druzyny_kapitan ON turniej_druzyny(kapitan_id);

DROP TRIGGER IF EXISTS trg_druzyny_updated ON turniej_druzyny;
CREATE TRIGGER trg_druzyny_updated BEFORE UPDATE ON turniej_druzyny
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- RODO: numer i mail kapitana NIE są publiczne. To ta sama decyzja co w `030`
-- dla starego modułu: podanie numeru organizatorowi nie jest zgodą na
-- pokazywanie go w internecie. INSERT/UPDATE zostają nietknięte — kapitan
-- dalej je zapisuje, tylko nikt ich nie odczyta przez API.
--
-- OD TEJ CHWILI `turniej_druzyny` MA GRANTY KOLUMNOWE. Każda nowa kolumna
-- tej tabeli dostanie INSERT/UPDATE z poziomu tabeli, ale NIE dostanie SELECT-a
-- — dokładnie tak jak `event_participants` od migracji `127`. Dodając kolumnę,
-- dopisz `GRANT SELECT (nowa_kolumna) ON turniej_druzyny TO anon, authenticated;`
REVOKE SELECT (kontakt_telefon, kontakt_email) ON turniej_druzyny FROM anon;
REVOKE SELECT (kontakt_telefon, kontakt_email) ON turniej_druzyny FROM authenticated;


-- ── 4. Skład ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turniej_zawodnicy (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  druzyna_id  uuid NOT NULL REFERENCES turniej_druzyny ON DELETE CASCADE,
  turniej_id  uuid NOT NULL REFERENCES turnieje ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users ON DELETE SET NULL,
  imie        text NOT NULL CHECK (char_length(imie) BETWEEN 1 AND 60),
  numer       int CHECK (numer BETWEEN 0 AND 99),
  kapitan     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Jedna osoba gra w JEDNEJ drużynie danego turnieju. Bez tego indeksu ktoś
-- dopisuje się do dwóch ekip i klasyfikacja strzelców przestaje mieć sens.
CREATE UNIQUE INDEX IF NOT EXISTS idx_zawodnik_raz_w_turnieju
  ON turniej_zawodnicy(turniej_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_numer_w_druzynie
  ON turniej_zawodnicy(druzyna_id, numer) WHERE numer IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zawodnicy_druzyna ON turniej_zawodnicy(druzyna_id);

-- `turniej_id` jest denormalizacją (wynika z drużyny) i właśnie dlatego NIE
-- ufamy klientowi, że poda ją poprawnie — wyzwalacz ją nadpisuje. Kolumna
-- istnieje po to, żeby indeks unikalny wyżej i polityki RLS nie musiały
-- za każdym razem dołączać `turniej_druzyny`.
CREATE OR REPLACE FUNCTION ustaw_turniej_zawodnika()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT d.turniej_id INTO NEW.turniej_id
  FROM turniej_druzyny d WHERE d.id = NEW.druzyna_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_zawodnik_turniej ON turniej_zawodnicy;
CREATE TRIGGER trg_zawodnik_turniej BEFORE INSERT OR UPDATE OF druzyna_id
  ON turniej_zawodnicy FOR EACH ROW EXECUTE FUNCTION ustaw_turniej_zawodnika();

-- Domknięcie FK z punktu 1 (MVP turnieju wskazuje na zawodnika).
ALTER TABLE turnieje DROP CONSTRAINT IF EXISTS fk_turniej_mvp;
ALTER TABLE turnieje ADD CONSTRAINT fk_turniej_mvp
  FOREIGN KEY (mvp_zawodnik_id) REFERENCES turniej_zawodnicy(id) ON DELETE SET NULL;


-- ── 5. Funkcje pomocnicze do polityk ────────────────────────────────────────
-- SECURITY DEFINER, bo polityka na jednej tabeli musi zajrzeć do drugiej,
-- na której pytający może nie mieć prawa odczytu. Wzorem `can_edit_event()`
-- (089) i `czy_czlonek_grupy()` (092). Nie wołane z przeglądarki.

CREATE OR REPLACE FUNCTION czy_organizator_turnieju(p_turniej uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM turnieje t
                 WHERE t.id = p_turniej AND t.organizator_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p
                 WHERE p.id = auth.uid() AND p.is_admin)
$$;

CREATE OR REPLACE FUNCTION czy_zarzadza_turniejem(p_turniej uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT czy_organizator_turnieju(p_turniej)
      OR EXISTS (SELECT 1 FROM turniej_osoby o
                 WHERE o.turniej_id = p_turniej AND o.user_id = auth.uid()
                   AND o.moze_edytowac)
$$;

CREATE OR REPLACE FUNCTION czy_zarzadza_druzynami(p_turniej uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT czy_zarzadza_turniejem(p_turniej)
      OR EXISTS (SELECT 1 FROM turniej_osoby o
                 WHERE o.turniej_id = p_turniej AND o.user_id = auth.uid()
                   AND o.moze_zarzadzac_druzynami)
$$;

CREATE OR REPLACE FUNCTION czy_kapitan_druzyny(p_druzyna uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM turniej_druzyny d
    WHERE d.id = p_druzyna
      AND (d.kapitan_id = auth.uid() OR czy_zarzadza_druzynami(d.turniej_id))
  )
$$;

GRANT EXECUTE ON FUNCTION czy_organizator_turnieju(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION czy_zarzadza_turniejem(uuid)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION czy_zarzadza_druzynami(uuid)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION czy_kapitan_druzyny(uuid)      TO anon, authenticated;


-- ── 6. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE turnieje          ENABLE ROW LEVEL SECURITY;
ALTER TABLE turniej_osoby     ENABLE ROW LEVEL SECURITY;
ALTER TABLE turniej_druzyny   ENABLE ROW LEVEL SECURITY;
ALTER TABLE turniej_zawodnicy ENABLE ROW LEVEL SECURITY;

-- Turniej czyta każdy. `widocznosc = 'na_link'` znaczy „nie ma go na liście",
-- NIE „wiersza nie da się odczytać" — dokładnie ta sama, świadoma słabość co
-- przy `events` (polityka „Events readable by all"). Nie udajemy kontroli
-- dostępu, której tu nie ma; listy filtrują po `widocznosc` w zapytaniu.
DROP POLICY IF EXISTS "Turniej czyta kazdy" ON turnieje;
CREATE POLICY "Turniej czyta kazdy" ON turnieje FOR SELECT USING (true);

DROP POLICY IF EXISTS "Turniej zaklada zalogowany" ON turnieje;
CREATE POLICY "Turniej zaklada zalogowany" ON turnieje FOR INSERT
  WITH CHECK (auth.uid() = organizator_id);

DROP POLICY IF EXISTS "Turniej edytuje zarzadzajacy" ON turnieje;
CREATE POLICY "Turniej edytuje zarzadzajacy" ON turnieje FOR UPDATE
  USING      (czy_zarzadza_turniejem(id))
  WITH CHECK (czy_zarzadza_turniejem(id));

DROP POLICY IF EXISTS "Turniej kasuje organizator" ON turnieje;
CREATE POLICY "Turniej kasuje organizator" ON turnieje FOR DELETE
  USING (czy_organizator_turnieju(id));

-- Uprawnienia widzi zalogowany (plakietka „prowadzący" przy nazwisku),
-- nadaje WYŁĄCZNIE organizator — nie współorganizator z `moze_edytowac`.
-- Inaczej powstaje niekontrolowany łańcuch przekazywania, dokładnie ten sam
-- problem, który zamknięto przy delegatach meczu i uprawnieniach w grupie.
DROP POLICY IF EXISTS "Osoby turnieju czyta zalogowany" ON turniej_osoby;
CREATE POLICY "Osoby turnieju czyta zalogowany" ON turniej_osoby FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Osoby turnieju nadaje organizator" ON turniej_osoby;
CREATE POLICY "Osoby turnieju nadaje organizator" ON turniej_osoby FOR ALL
  USING      (czy_organizator_turnieju(turniej_id))
  WITH CHECK (czy_organizator_turnieju(turniej_id));

-- Lista drużyn jest publiczna (same nazwy — kolumny kontaktowe odebrane grantem).
DROP POLICY IF EXISTS "Druzyny czyta kazdy" ON turniej_druzyny;
CREATE POLICY "Druzyny czyta kazdy" ON turniej_druzyny FOR SELECT USING (true);

-- Zgłosić drużynę można tylko do turnieju, który realnie przyjmuje zgłoszenia,
-- i tylko jako jej kapitan. Sprawdzenie stanu turnieju siedzi TU, a nie w UI:
-- inaczej zgłoszenie wchodzi po zamknięciu zapisów jednym zapytaniem curlem.
DROP POLICY IF EXISTS "Druzyne zglasza zalogowany" ON turniej_druzyny;
CREATE POLICY "Druzyne zglasza zalogowany" ON turniej_druzyny FOR INSERT
  WITH CHECK (
    (auth.uid() = kapitan_id AND EXISTS (
       SELECT 1 FROM turnieje t WHERE t.id = turniej_id AND t.status = 'zapisy'))
    OR czy_zarzadza_druzynami(turniej_id)
  );

DROP POLICY IF EXISTS "Druzyne edytuje kapitan" ON turniej_druzyny;
CREATE POLICY "Druzyne edytuje kapitan" ON turniej_druzyny FOR UPDATE
  USING      (kapitan_id = auth.uid() OR czy_zarzadza_druzynami(turniej_id))
  WITH CHECK (kapitan_id = auth.uid() OR czy_zarzadza_druzynami(turniej_id));

DROP POLICY IF EXISTS "Druzyne kasuje organizator" ON turniej_druzyny;
CREATE POLICY "Druzyne kasuje organizator" ON turniej_druzyny FOR DELETE
  USING (czy_zarzadza_druzynami(turniej_id));

-- ŚCIANA LOGOWANIA. Skład to imiona kilkudziesięciu osób — nie wychodzi do
-- `anon`. To jest jednocześnie główny mechanizm zakładania kont w tym module.
DROP POLICY IF EXISTS "Sklad czyta zalogowany" ON turniej_zawodnicy;
CREATE POLICY "Sklad czyta zalogowany" ON turniej_zawodnicy FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Sklad prowadzi kapitan" ON turniej_zawodnicy;
CREATE POLICY "Sklad prowadzi kapitan" ON turniej_zawodnicy FOR ALL
  USING      (czy_kapitan_druzyny(druzyna_id))
  WITH CHECK (czy_kapitan_druzyny(druzyna_id));

-- Wyjątek do powyższego: zalogowany może przypisać SIEBIE do wolnego wiersza
-- składu — to jest „to ja" na `/t/[kod]`. Bez tej polityki jedyną drogą byłaby
-- funkcja SECURITY DEFINER, a wtedy kapitan nie mógłby przypisania cofnąć.
DROP POLICY IF EXISTS "Przypisz sie do wolnego wpisu" ON turniej_zawodnicy;
CREATE POLICY "Przypisz sie do wolnego wpisu" ON turniej_zawodnicy FOR UPDATE
  USING      (user_id IS NULL AND auth.uid() IS NOT NULL)
  WITH CHECK (user_id = auth.uid());


-- ── 6a. Ochrona przed samodzielnym przyjęciem drużyny ───────────────────────
-- Polityka „Druzyne edytuje kapitan" (punkt 6) pozwala kapitanowi zmienić
-- DOWOLNĄ kolumnę własnej drużyny — w tym `status`, czyli mógłby sam sobie
-- wpisać 'przyjeta'. Ta sama klasa błędu, którą migracja `132` naprawiała
-- w `event_participants`: „uczestnik zmienia własną DEKLARACJĘ, a nie swoje
-- MIEJSCE w składzie". Kapitan zmienia nazwę, kontakt i akceptację regulaminu
-- — status, przydział do grupy, rozstawienie i wpisowe zostają wyłącznie dla
-- zarządzających.

CREATE OR REPLACE FUNCTION pilnuj_wlasnej_druzyny()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF czy_zarzadza_druzynami(NEW.turniej_id) THEN
    RETURN NEW;                      -- zarządzający robi, co chce
  END IF;

  -- Zapis robi sam kapitan — pola zastrzeżone dla organizatora wracają do
  -- poprzednich wartości, niezależnie od tego, co przyszło z klienta.
  NEW.status                     := OLD.status;
  NEW.grupa_id                   := OLD.grupa_id;
  NEW.rozstawienie               := OLD.rozstawienie;
  NEW.pozycja_recznie             := OLD.pozycja_recznie;
  NEW.wpisowe_oplacone_at        := OLD.wpisowe_oplacone_at;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pilnuj_wlasnej_druzyny ON turniej_druzyny;
CREATE TRIGGER trg_pilnuj_wlasnej_druzyny BEFORE UPDATE ON turniej_druzyny
  FOR EACH ROW EXECUTE FUNCTION pilnuj_wlasnej_druzyny();


-- ── 7. Wejście do drużyny: kod ──────────────────────────────────────────────
-- Jedna droga na trzy sytuacje: przejęcie kapitanatu drużyny dodanej ręcznie,
-- przypisanie się do istniejącego wiersza składu („to ja") i dopisanie nowego.
-- Wszystkie trzy sprawdzają to samo: stan turnieju, limit składu, unikalność
-- osoby w turnieju. Rozbicie na trzy ścieżki po stronie klienta rozjechałoby
-- te reguły — tak jak rozjechała się reguła pojemności zdublowana w trzech
-- funkcjach w `lib/events.ts`.

CREATE OR REPLACE FUNCTION dolacz_do_druzyny_kodem(
  p_kod          text,
  p_jako_kapitan boolean DEFAULT false,
  p_zawodnik_id  uuid    DEFAULT NULL,
  p_imie         text    DEFAULT NULL
)
RETURNS TABLE (druzyna_id uuid, turniej_id uuid,
               zostal_kapitanem boolean, zawodnik_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_druzyna  turniej_druzyny%ROWTYPE;
  v_turniej  turnieje%ROWTYPE;
  v_ile      int;
  v_kapitan  boolean := false;
  v_zawodnik uuid;
  v_imie     text;
  v_inna     text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się, żeby dołączyć do drużyny.';
  END IF;

  SELECT * INTO v_druzyna FROM turniej_druzyny
   WHERE upper(kod_dolaczenia) = upper(trim(p_kod));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono drużyny o tym kodzie.';
  END IF;

  SELECT * INTO v_turniej FROM turnieje WHERE id = v_druzyna.turniej_id;
  IF v_turniej.status IN ('zakonczony','odwolany') THEN
    RAISE EXCEPTION 'Ten turniej jest już zamknięty.';
  END IF;
  IF v_druzyna.status IN ('odrzucona','wycofana') THEN
    RAISE EXCEPTION 'Ta drużyna nie bierze udziału w turnieju.';
  END IF;

  -- 1. Kapitanat — pierwszy, kto otworzy link drużyny bez kapitana.
  --    Świadomy kompromis, ten sam co przy kodzie dołączenia do ekipy (094):
  --    kto ma link, ten wchodzi. Organizator dostaje powiadomienie i może
  --    kapitana zmienić, a kod — odświeżyć.
  IF p_jako_kapitan THEN
    IF v_druzyna.kapitan_id IS NOT NULL THEN
      RAISE EXCEPTION 'Ta drużyna ma już kapitana.';
    END IF;
    UPDATE turniej_druzyny SET kapitan_id = auth.uid() WHERE id = v_druzyna.id;
    v_kapitan := true;

    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    VALUES (v_turniej.organizator_id, 'turniej_kapitan_przejal',
            'Drużyna ma kapitana',
            v_druzyna.nazwa || ' — ktoś przejął zarządzanie drużyną.',
            v_turniej.id);
  END IF;

  -- 2. Ta sama osoba nie gra w dwóch drużynach tego samego turnieju.
  SELECT d.nazwa INTO v_inna
    FROM turniej_zawodnicy z JOIN turniej_druzyny d ON d.id = z.druzyna_id
   WHERE z.turniej_id = v_turniej.id AND z.user_id = auth.uid();
  IF v_inna IS NOT NULL THEN
    IF v_inna = v_druzyna.nazwa THEN
      SELECT id INTO v_zawodnik FROM turniej_zawodnicy
       WHERE druzyna_id = v_druzyna.id AND user_id = auth.uid();
      RETURN QUERY SELECT v_druzyna.id, v_turniej.id, v_kapitan, v_zawodnik;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Grasz już w tym turnieju w drużynie %.', v_inna;
  END IF;

  -- 3a. „To ja" — wolny wiersz składu wpisany wcześniej przez kapitana.
  IF p_zawodnik_id IS NOT NULL THEN
    UPDATE turniej_zawodnicy SET user_id = auth.uid()
     WHERE id = p_zawodnik_id AND druzyna_id = v_druzyna.id AND user_id IS NULL
     RETURNING id INTO v_zawodnik;
    IF v_zawodnik IS NULL THEN
      RAISE EXCEPTION 'To miejsce w składzie jest już zajęte.';
    END IF;
  ELSE
  -- 3b. Nowy wiersz — imię z parametru albo z profilu.
    SELECT count(*) INTO v_ile FROM turniej_zawodnicy WHERE druzyna_id = v_druzyna.id;
    IF v_ile >= v_turniej.max_zawodnikow THEN
      RAISE EXCEPTION 'Skład jest pełny (% osób).', v_turniej.max_zawodnikow;
    END IF;

    v_imie := NULLIF(trim(coalesce(p_imie, '')), '');
    IF v_imie IS NULL THEN
      SELECT coalesce(NULLIF(trim(p.display_name), ''), 'Zawodnik')
        INTO v_imie FROM profiles p WHERE p.id = auth.uid();
    END IF;

    INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, user_id, imie, kapitan)
    VALUES (v_druzyna.id, v_turniej.id, auth.uid(), v_imie, v_kapitan)
    RETURNING id INTO v_zawodnik;
  END IF;

  RETURN QUERY SELECT v_druzyna.id, v_turniej.id, v_kapitan, v_zawodnik;
END $$;

GRANT EXECUTE ON FUNCTION dolacz_do_druzyny_kodem(text, boolean, uuid, text)
  TO authenticated;


-- ── 8. Kontakty kapitanów — wyłącznie dla organizatora ──────────────────────
-- Kolumny są odebrane grantem (punkt 3), więc jedyną drogą do nich jest ta
-- funkcja, która twardo sprawdza uprawnienie w środku.

CREATE OR REPLACE FUNCTION turniej_kontakty(p_turniej uuid)
RETURNS TABLE (druzyna_id uuid, druzyna text, kapitan text,
               telefon text, email text, oplacone boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.nazwa, d.kontakt_imie, d.kontakt_telefon, d.kontakt_email,
         d.wpisowe_oplacone_at IS NOT NULL
    FROM turniej_druzyny d
   WHERE d.turniej_id = p_turniej
     AND czy_zarzadza_druzynami(p_turniej)
     AND d.status <> 'odrzucona'
   ORDER BY d.created_at
$$;

GRANT EXECUTE ON FUNCTION turniej_kontakty(uuid) TO authenticated;


-- ── 9. Powiadomienia ────────────────────────────────────────────────────────
-- Kolumna `turniej_id` jest dokładaniem do istniejącej tabeli — wiersze sprzed
-- tej migracji mają NULL i nic się dla nich nie zmienia. Bez niej powiadomienie
-- turniejowe nie ma dokąd prowadzić: `celPowiadomienia()` rozpoznaje cel po
-- `event_id` albo `group_id`, a wiersz bez żadnego z nich renderuje się jako
-- martwy, nieklikalny akapit.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS turniej_id uuid REFERENCES turnieje(id) ON DELETE CASCADE;

-- Zgłoszenie drużyny → organizator. Przy `wymaga_akceptacji = false` drużyna
-- wchodzi od razu jako przyjęta, więc treść jest inna: nie ma czego decydować.
CREATE OR REPLACE FUNCTION powiadom_o_zgloszeniu_druzyny()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t turnieje%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM turnieje WHERE id = NEW.turniej_id;
  IF NEW.dodana_recznie OR v_t.organizator_id = auth.uid() THEN
    RETURN NEW;               -- organizator sam ją dopisał, nie budzimy go
  END IF;

  INSERT INTO notifications (user_id, type, title, body, turniej_id)
  VALUES (
    v_t.organizator_id,
    CASE WHEN NEW.status = 'zgloszona'
         THEN 'turniej_zgloszenie_druzyny' ELSE 'turniej_druzyna_przyjeta' END,
    CASE WHEN NEW.status = 'zgloszona'
         THEN 'Nowe zgłoszenie do turnieju' ELSE 'Nowa drużyna w turnieju' END,
    NEW.nazwa || ' — ' || v_t.nazwa,
    v_t.id
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_zgloszenie_druzyny ON turniej_druzyny;
CREATE TRIGGER trg_zgloszenie_druzyny AFTER INSERT ON turniej_druzyny
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_zgloszeniu_druzyny();

-- Decyzja organizatora → kapitan. Tylko przy realnej zmianie statusu.
CREATE OR REPLACE FUNCTION powiadom_o_decyzji_druzyny()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t turnieje%ROWTYPE;
BEGIN
  IF NEW.status = OLD.status OR NEW.kapitan_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_t FROM turnieje WHERE id = NEW.turniej_id;

  IF NEW.status = 'przyjeta' THEN
    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    VALUES (NEW.kapitan_id, 'turniej_druzyna_przyjeta',
            'Jesteście w turnieju',
            NEW.nazwa || ' gra w: ' || v_t.nazwa || '. Uzupełnij skład.', v_t.id);

  ELSIF NEW.status IN ('rezerwa','odrzucona') THEN
    INSERT INTO notifications (user_id, type, title, body, turniej_id)
    VALUES (NEW.kapitan_id, 'turniej_druzyna_odrzucona',
            CASE WHEN NEW.status = 'rezerwa'
                 THEN 'Jesteście na liście rezerwowej'
                 ELSE 'Zgłoszenie nieprzyjęte' END,
            NEW.nazwa || ' — ' || v_t.nazwa, v_t.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_decyzja_druzyny ON turniej_druzyny;
CREATE TRIGGER trg_decyzja_druzyny AFTER UPDATE OF status ON turniej_druzyny
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_decyzji_druzyny();
```

**Uwaga wdrożeniowa:** kolumna z imieniem w `profiles` to `display_name` (dokłada ją migracja
`022`, funkcja `handle_new_user()` — nie `full_name`). Nowe tabele dostają granty automatycznie
(Supabase ma `ALTER DEFAULT PRIVILEGES` na schemacie `public`) — jawne są tylko dwa `REVOKE` na
kolumnach kontaktowych. `scripts/stos-lokalny.sh` odtwarza ograniczenia z `127` z listy kolumn
UKRYTYCH — dopisz tam `turniej_druzyny.kontakt_telefon` i `kontakt_email`.

## E. lib/ Etapu 0 — sygnatury

### `lib/turnieje.ts`
```ts
function toTurniej(row: any): Turniej                      // jedyna granica snake→camel

/** CZYSTA. Uprawnienia wyliczone tak, jak liczy je RLS — UI nie czeka na
 *  drugi round-trip. Lustro `uprawnieniaCzlonka()` z lib/groups.ts. */
export function uprawnieniaTurnieju(
  turniej: Pick<Turniej,'organizatorId'>,
  osoba: TurniejOsoba | null | undefined,
  userId: string | undefined,
): TurniejUprawnienia

/** CZYSTA. Czy w tym stanie wolno przyjmować zgłoszenia. */
export function przyjmujeZgloszenia(t: Turniej, liczbaDruzyn: number): boolean

/** CZYSTA. Która zakładka ma być domyślna dla tego stanu turnieju. */
export function domyslnaZakladka(status: TurniejStatus): 'terminarz'|'druzyny'|'tabela'|'info'

export async function createTurniej(dane: TurniejCreate, userId: string): Promise<string>
export async function updateTurniej(id: string, dane: Partial<TurniejCreate>): Promise<void>
export async function setStatusTurnieju(id: string, status: TurniejStatus): Promise<void>
export async function deleteTurniej(id: string): Promise<void>

export async function getTurniej(id: string): Promise<Turniej | null>
export async function getTurniejePubliczne(limit?: number): Promise<Turniej[]>
export async function getMojeTurnieje(userId: string): Promise<Turniej[]>

export async function getOsobyTurnieju(turniejId: string): Promise<TurniejOsoba[]>
export async function setUprawnieniaOsoby(
  turniejId: string, userId: string, u: Partial<Omit<TurniejOsoba,'turniejId'|'userId'>>,
): Promise<void>
export async function usunOsobeZTurnieju(turniejId: string, userId: string): Promise<void>

export async function setOkladkaTurnieju(id: string, url: string | null): Promise<void>
```

Wszystkie UPDATE-y idą przez `zaktualizujJedenWiersz('turnieje', id, …)`. `createTurniej` woła
`validateName(dane.nazwa, 'Nazwa turnieju', 80)` i `track('turniej_utworzony', {...})`.

### `lib/turniejDruzyny.ts`
```ts
function toDruzyna(row: any): TurniejDruzyna
function toZawodnik(row: any): TurniejZawodnik

export async function getDruzyny(turniejId: string): Promise<TurniejDruzyna[]>
export async function getDruzynyZeSkladem(turniejId: string): Promise<TurniejDruzyna[]>
export async function getDruzyna(id: string): Promise<TurniejDruzyna | null>
export async function getDruzynaPoKodzie(kod: string): Promise<TurniejDruzyna | null>
export async function getMojaDruzyne(turniejId: string, userId: string)
  : Promise<TurniejDruzyna | null>

export async function zglosDruzyne(turniejId: string, dane: ZgloszenieDruzyny,
  userId: string): Promise<string>
export async function dodajDruzyneRecznie(turniejId: string, nazwa: string,
  kontaktImie?: string): Promise<string>
export async function setStatusDruzyny(id: string, status: DruzynaStatus): Promise<void>
export async function setWpisowe(id: string, oplacone: boolean): Promise<void>
export async function updateDruzyne(id: string, dane: Partial<ZgloszenieDruzyny>)
  : Promise<void>
export async function usunDruzyne(id: string): Promise<void>

export async function dodajZawodnika(druzynaId: string, imie: string, numer?: number)
  : Promise<string>
export async function updateZawodnika(id: string,
  dane: { imie?: string; numer?: number }): Promise<void>
export async function usunZawodnika(id: string): Promise<void>

/** Jedyna droga wejścia do drużyny — RPC `dolacz_do_druzyny_kodem`. */
export async function dolaczDoDruzyny(kod: string, opcje: {
  jakoKapitan?: boolean; zawodnikId?: string; imie?: string;
}): Promise<{ druzynaId: string; turniejId: string; zostalKapitanem: boolean }>

export async function getKontakty(turniejId: string): Promise<KontaktDruzyny[]>

/** CZYSTA. Czy skład wolno jeszcze zmieniać (stan turnieju + stan drużyny). */
export function mozeEdytowacSklad(t: Turniej, d: TurniejDruzyna): boolean
/** CZYSTA. Braki w składzie względem `minZawodnikow` — do plakietki. */
export function brakiWSkladzie(t: Turniej, liczba: number): number
```

### `lib/turniejEtykiety.ts`
```ts
export const STATUS_TURNIEJU: Record<TurniejStatus, { label: string; ton: string }>
//   szkic            → 'W przygotowaniu'      bg-slate-100  text-slate-600
//   zapisy           → 'Trwają zapisy'        bg-primary-50 text-primary-700
//   zamkniete_zapisy → 'Zapisy zamknięte'     bg-slate-100  text-slate-600
//   trwa             → 'Trwa'                 bg-primary-50 text-primary-700
//   zakonczony       → 'Zakończony'           bg-slate-100  text-slate-600
//   odwolany         → 'Odwołany'             bg-red-50     text-red-600

export const STATUS_DRUZYNY: Record<DruzynaStatus, { label: string; ton: string }>
//   zgloszona → 'Czeka na przyjęcie'  bg-blue-50  text-blue-600   ← decyzja
//   przyjeta  → 'W turnieju'          bg-primary-50 text-primary-700
//   rezerwa   → 'Rezerwa'             bg-slate-100 text-slate-600
//   odrzucona → 'Nieprzyjęta'         bg-slate-100 text-slate-600
//   wycofana  → 'Wycofana'            bg-slate-100 text-slate-600

export const FORMAT_LABEL: Record<TurniejFormat, string>
export const FORMAT_OPIS:  Record<TurniejFormat, string>   // zdanie po ludzku
export const FAZA_LABEL:   Record<MeczFaza, string>        // E1

export function opisFormatu(t: Turniej, liczbaDruzyn: number): string
export function odmienDruzyny(n: number): string    // 1 drużyna / 2 drużyny / 5 drużyn
export function odmienZawodnikow(n: number): string
```

**Kolory:** jedyny niebieski to „Czeka na przyjęcie" i powiadomienie o zgłoszeniu — dokładnie to,
co niebieski znaczy w Bojo od zawsze: wymaga akceptacji uczestnictwa. Jedyny różowy to ogłoszenie
organizatora (Etap 4, bo to wiadomość). Pomarańczowego nie używamy. Szary trzyma jedno znaczenie:
„droga zamknięta, nic się nie zepsuło". `odmienDruzyny`/`odmienZawodnikow` idą przez
`lib/plural.ts`, nie własną regułę `n < 5`.

### Dopisania w istniejących plikach
```
lib/features.ts          + export const SHOW_TURNIEJE = false;
                         − export const SHOW_CUP
lib/analytics.ts         + 'turniej_utworzony' | 'turniej_druzyna_zgloszona'
                           | 'turniej_dolaczyl_do_druzyny' | 'turniej_mecz_poprowadzony'
                           | 'turniej_udostepniony'
lib/notifications.ts     celPowiadomienia(): if (n.turniejId) return `/turnieje/${n.turniejId}`
                         toNotif(): turniejId: row.turniej_id ?? undefined
types/index.ts           AppNotification + turniejId?: string
supabase/functions/send-push/index.ts
                         adresPowiadomienia(): gałąź turniej_id
```

## F. Ekrany Etapu 0 z tekstami

### `/turnieje` — lista
Trzy sekcje, każda znika gdy pusta: **Trwają teraz**, **Moje turnieje** (organizowane + gram),
**Nadchodzące**. Zakończone zwinięte na dole. Kafelek: okładka/emoji sportu, nazwa, plakietka
statusu, data, miejsce, „6/8 drużyn". Wpisowe tylko gdy > 0.

Pusty stan (niezalogowany): „Nie ma jeszcze żadnego turnieju" / „Organizujesz turniej? Bojo
poprowadzi zapisy drużyn, terminarz i wyniki na żywo." / [Utwórz turniej]

### `/turnieje/nowe` — kreator, 4 kroki
```ts
const KROKI = ['Podstawy', 'Miejsce', 'Format', 'Zapisy'] as const;
```

| Krok | Pola | Walidacja |
|---|---|---|
| 1 Podstawy | nazwa, sport, data startu, data końca, godzina startu | nazwa 3–80; data ≥ dziś; koniec ≥ start |
| 2 Miejsce | `UnifiedLocationPicker`, nazwa miejsca, liczba aren | wymagany obiekt albo pinezka |
| 3 Format | format, liczba drużyn, awans z grupy, czas meczu, przerwa, skład min/max | min ≤ max; grupy ≤ drużyn÷2 |
| 4 Zapisy | widoczność, akceptacja zgłoszeń, wpisowe, regulamin, opis | wpisowe ≥ 0 |

Pod krokiem 3: „8 drużyn, 2 grupy po 4, 2 areny, mecze po 15 min + 5 min przerwy. Faza grupowa:
12 meczów, koniec ok. 13:40. Finał ok. 15:10." (funkcja `szacunekCzasu()`, patrz Etap 1).

Po publikacji: „Turniej gotowy. Teraz zbierz drużyny." + [Kopiuj link] [Udostępnij].

### `/turnieje/[id]` — strona turnieju
Bez `generateStaticParams` (renderuje się na żądanie, `revalidate = 300`). Sticky belka: `[←]` +
nazwa + `[Panel]` dla zarządzających. Zakładki w `?tab=`, czytane z `window.location.search`.
Etap 0: Info + Drużyny. Baner szkicu (widzi tylko organizator): „Ten turniej jest szkicem — nikt
poza Tobą go nie widzi. Opublikuj, żeby drużyny mogły się zgłaszać." [Opublikuj i otwórz zapisy]

### Zakładka Drużyny
Licznik „6 z 8 drużyn" + pasek zapełnienia (niebieski przy komplecie — jak `lib/komplet.ts`;
szary po zamknięciu zapisów — jak `lib/stanZapisow.ts`). Lista drużyn, dotknięcie rozwija skład
dla zalogowanego. Dla niezalogowanego — `SciankaLogowania`:

„Skład drużyny Dzikie Bażanty" / „Składy i statystyki widzą zalogowani gracze." /
[Kontynuuj z Google] [Załóż konto e-mailem] [Mam konto — zaloguj się]

### `/turnieje/[id]/zglos`
Pola: nazwa drużyny (2–40), imię (z profilu), telefon (opcjonalny), e-mail (opcjonalny),
akceptacja regulaminu. Skład NIE jest wymagany tutaj.

Gdy `wymagaAkceptacji`: „Organizator potwierdzi zgłoszenie. Dostaniesz powiadomienie." Gdy nie:
„Wchodzicie od razu — po zgłoszeniu uzupełnij skład."

Po wysłaniu: „Zgłoszenie wysłane" / „Teraz zaproś swoich do drużyny — każdy, kto wejdzie w ten
link, dopisze się do składu sam." / [Kopiuj link drużyny]

### `/t/[kod]`
| Stan | Co widać |
|---|---|
| Drużyna bez kapitana | [Zostań kapitanem] + [Dołącz jako zawodnik] |
| Kapitan jest, wolne wpisy | Lista imion: „Jesteś na tej liście?" + [Nie ma mnie — dopisz mnie] |
| Kapitan jest, brak wolnych wpisów | Pole na imię + [Dołącz do drużyny] |
| Już w tej drużynie | Przekierowanie + toast „Jesteś już w tej drużynie" |

### `/turnieje/[id]/panel`
Odmowa bez uprawnień: „Ten panel jest dla organizatora turnieju" + [Wróć do turnieju].

**Drużyny.** Sekcje: Czekają na decyzję (niebieskie, [Przyjmij][Na rezerwę][Odrzuć]), W turnieju,
Rezerwa. [+ Dodaj drużynę ręcznie], [Pobierz kontakty (CSV)].

Po ręcznym dodaniu: „Dodano FC Rataje. Wyślij ten link kapitanowi — przejmie drużynę i uzupełni
skład." [Kopiuj link]

**Ludzie.** Trzy przełączniki na osobę: „Może prowadzić mecze" / „Może zarządzać drużynami" /
„Może edytować turniej". Widzi wyłącznie organizator.

**Ustawienia.** Pola z kreatora + [Zamknij zapisy]/[Otwórz zapisy], [Odwołaj turniej], [Usuń
turniej] — przez `usePotwierdzenie()`, wariant `destrukcyjny`.

## G. Powiadomienia Etapu 0

```ts
// lib/ikonyPowiadomien.ts
turniej_zgloszenie_druzyny: { Ikona: UserPlus,   klasa: 'bg-blue-50 text-blue-600',       rodzaj: 'Zgłoszenie' },
turniej_druzyna_przyjeta:   { Ikona: CheckCircle,klasa: 'bg-primary-50 text-primary-700', rodzaj: 'Przyjęci' },
turniej_druzyna_odrzucona:  { Ikona: X,          klasa: 'bg-slate-100 text-slate-600',    rodzaj: 'Decyzja' },
turniej_kapitan_przejal:    { Ikona: UserCog,    klasa: 'bg-slate-100 text-slate-600',    rodzaj: 'Kapitan' },
```

```ts
// lib/ustawieniaPowiadomien.ts
{ typ: 'turniej_zgloszenie_druzyny', nazwa: 'Zgłoszenie drużyny do turnieju',
  opis: 'Drużyna chce zagrać w Twoim turnieju — czeka na Twoją decyzję', wazne: true },
{ typ: 'turniej_druzyna_przyjeta', nazwa: 'Wasza drużyna przyjęta',
  opis: 'Organizator potwierdził zgłoszenie Waszej drużyny', wazne: true },
{ typ: 'turniej_druzyna_odrzucona', nazwa: 'Decyzja o zgłoszeniu drużyny',
  opis: 'Zgłoszenie trafiło na rezerwę albo nie zostało przyjęte' },
{ typ: 'turniej_kapitan_przejal', nazwa: 'Ktoś przejął drużynę',
  opis: 'Drużyna, którą dopisałeś ręcznie, ma teraz swojego kapitana' },
```

`WYMAGA_AKCJI` dostaje `'turniej_zgloszenie_druzyny'` — jedyny z czwórki proszący o decyzję.

## H. Testy Etapu 0

### Vitest
```
turniejKreator.test.ts
  ✓ min > max składu → błąd na kroku 3
  ✓ data końca przed startem → błąd na kroku 1
  ✓ liczba grup większa niż drużyn ÷ 2 → błąd
  ✓ stepForErrors skacze do kroku z pierwszym błędem

turniejDruzyny.test.ts
  ✓ uprawnieniaTurnieju: organizator ma komplet, choćby nie miał wiersza w turniej_osoby
  ✓ uprawnieniaTurnieju: mozeEdytowac implikuje pozostałe dwa
  ✓ przyjmujeZgloszenia: false przy status ≠ 'zapisy'
  ✓ przyjmujeZgloszenia: false przy komplecie drużyn
  ✓ mozeEdytowacSklad: false dla drużyny wycofanej i dla turnieju zakończonego
  ✓ brakiWSkladzie liczy względem minZawodnikow, nie maxZawodnikow
  ✓ domyslnaZakladka dla każdego z sześciu stanów
```

### `supabase/test/rls.sql` — nowa sekcja
Dane: turniej „T" (organizator O), drużyna D1 (kapitan K1) z 3 zawodnikami, drużyna D2 (kapitan
K2), prowadzący P (`moze_prowadzic`), obcy X.

- `anon`: czyta turniej (1), czyta drużyny (2), **nie** czyta skład (0), **nie** czyta
  `kontakt_telefon` (odmowa grantu).
- `authenticated` (X — obcy): czyta skład (3), **nie** czyta kontakt, **nie** dopisuje zawodnika
  do D1, **nie** zmienia status D1, **nie** zgłasza drużyny gdy status ≠ 'zapisy'.
- K1 (kapitan D1): dopisuje zawodnika do D1 (OK), **nie** dopisuje do D2, **nie** zmienia status
  własnej drużyny (blokuje trigger `pilnuj_wlasnej_druzyny`).
- O (organizator): czyta kontakty przez `turniej_kontakty()` (2 wiersze), nadaje uprawnienia.
- P (prowadzący bez `moze_edytowac`): **nie** nadaje uprawnień, **nie** czyta kontaktów (0).

### Playwright — `wizualne.spec.ts`
```
− ['turniej', '/turniej'], ['turniej-drabinka', …], ['turniej-rejestracja', …]
+ ['turnieje',            '/turnieje'],
+ ['turnieje-nowe',       '/turnieje/nowe'],
+ ['turniej-nieznany',    '/turnieje/00000000-0000-4000-8000-000000000000'],
+ ['turniej-zglos',       '/turnieje/00000000-…/zglos'],
+ ['turniej-panel',       '/turnieje/00000000-…/panel'],
+ ['dolacz-do-druzyny',   '/t/NIEISTNIEJE'],
```
Atrapa PostgREST musi oddawać 406 PGRST116 na `.single()` przy zerze wierszy.

## I–L. Etapy 1–4

Pełny opis (migracje 146–147 i 150–151, `lib/turniejFormat.ts`, `lib/turniejMecze.ts`, konsola
prowadzącego, tabela/statystyki, domknięcie) — patrz historia tego dokumentu / kolejne PR-y.
Skrót:

- **Etap 1 (146):** `turniej_grupy`, `turniej_areny`, `turniej_mecze`; `czy_prowadzi_mecz()`;
  `propaguj_zwyciezce()`; RPC `przesun_terminarz`, `zapisz_terminarz`; `lib/turniejFormat.ts`
  (rozlosujGrupy, meczeKazdyZKazdym, zbudujDrabinke, ulozHarmonogram, szacunekCzasu).
- **Etap 2 (147):** `turniej_zdarzenia`; `przelicz_wynik_meczu()`; `zakoncz_mecz()`; konsola
  prowadzącego, optymistyczne zapisy, „Cofnij ostatnie".
- **Etap 3 (bez migracji):** `lib/turniejTabela.ts`, `lib/turniejStatystyki.ts` — czyste funkcje;
  drabinka jako pionowa lista rund na telefonie, drzewko od `md:`.
- **Etap 4 (150, 151):** ogłoszenia, `turniej_blik`, „Zamień drużynę w ekipę", OG image,
  kasowanie `tournament_*`, odmrożenie `SHOW_TURNIEJE`.

## M. Kolejność prac wewnątrz etapu

1. Migracja — lokalny stos + `baza-testowa.sh`.
2. Asercje RLS w `supabase/test/rls.sql` — od razu, nie na końcu.
3. Typy w `types/index.ts`.
4. Czyste funkcje w `lib/` + testy.
5. Funkcje sięgające do bazy w `lib/`.
6. Komponenty od najmniejszego do ekranu.
7. Trasy i podpięcie zakładek.
8. Bramki: `tsc --noEmit` → `lint` → `test` → `build` (atrapy kluczy) → `check:docs`.
9. Dokumentacja w tym samym PR-ze.
10. Zrzuty — nowe trasy w `TRASY`, `zrzuty:zaakceptuj`.

## N. Rozstrzygnięcia z góry

| Sytuacja | Rozstrzygnięcie |
|---|---|
| Organizator gra we własnym turnieju | Wolno — `organizator_id` i wiersz w `turniej_zawodnicy` są niezależne |
| Kapitan oddaje kapitanat | [Przekaż kapitanat] — wybór spośród zawodników z kontem |
| Drużyna bez kapitana po usunięciu konta | `ON DELETE SET NULL` — drużyna „do przejęcia", kod dalej działa |
| Zawodnik wychodzi z drużyny | Może, dopóki turniej nie `trwa`. Potem tylko kapitan usuwa |
| Zdarzenie wskazuje usuniętego zawodnika | `ON DELETE SET NULL` na `zawodnik_id` — gol zostaje, nazwisko znika. Kapitan NIE może usunąć zawodnika z zapisanym zdarzeniem |
| Turniej bez areny | Kreator tworzy domyślnie „Boisko 1" |
| Format `liga` | Brak drabinki, jedna tabela |
| Format `puchar` | Brak tabeli, zakładka nazywa się „Drabinka" |
| Nieparzysta liczba drużyn w `puchar` | Wolne losy w pierwszej rundzie |
| Siatkówka/plażówka | Licznik setów zamiast „Gol"; brak klasyfikacji strzelców — nie obiecujemy jej w kreatorze |
| Koszykówka | `typ='punkty'`, wartość 1/2/3; klasyfikacja „Najwięcej punktów" |
| Dwa turnieje tego samego organizatora naraz | Dozwolone, bez sprawdzania kolizji |
| Odwołany turniej | `status='odwolany'`, baner, powiadomienie, nic nie kasujemy |
| Nazwa drużyny z emoji/40 znakami | `validateName()` + `truncate` + `min-w-0` wszędzie |
| Wynik 0:0 w grupie | Normalny remis. Karne wyłącznie w fazie pucharowej |
| Prowadzący zaczyna przed godziną | Wolno — godzina w terminarzu to plan, nie bramka |
| Mecz z nieznanymi drużynami | Karta pokazuje źródła („Zwycięzca M9"), [Rozpocznij] nieaktywny |
