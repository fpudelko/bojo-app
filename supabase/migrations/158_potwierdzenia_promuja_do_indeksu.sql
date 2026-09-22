-- 158_potwierdzenia_promuja_do_indeksu.sql
--
-- DOMKNIĘCIE PĘTLI „indeks rośnie wtedy, gdy rośnie produkt"
-- (docs/seo-geo-strategia.md, rozdz. 4c, akapit „Efekt uboczny").
--
-- Migracja `112` zbudowała tę pętlę dla DWÓCH sygnałów i oba mają wyzwalacz:
-- rozegrany mecz (`events_promuj_tier`) i komentarz pod obiektem
-- (`field_comments_promuj_tier`). Trzeci sygnał, potwierdzenia graczy, powstał
-- dopiero w `123` — czyli PO `112` — i nikt go do tej pętli nie podłączył.
-- Skutek: obiekt, na którym dwoje ludzi potwierdziło oświetlenie i nawierzchnię,
-- zostawał w Tier 3, czyli z `noindex` i poza sitemapem, mimo że miał już
-- dokładnie tę treść, której nie ma żaden inny katalog.
--
-- To jest dotkliwe akurat przy tym sygnale, bo rozdz. 4c nazywa go wprost
-- jedyną wartością dodaną Bojo przy obiekcie: „czy tu się gra i czy dane się
-- zgadzają według ludzi, którzy tam byli".
--
-- CO TA MIGRACJA ROBI, A CZEGO NIE:
--
-- Robi: dokłada trzeci wyzwalacz promocji, tym samym wzorcem co dwa istniejące.
-- Indeks przez to ROŚNIE — obiekty wchodzą do niego, gdy zbiorą potwierdzenia.
--
-- NIE robi: nie zmienia `oblicz_seo_tier()` i nie rusza progu indeksacji.
-- Propozycja z rozdz. 4c, żeby UGC było WARUNKIEM obecności w wyszukiwarce
-- (czyli żeby indeks ZMNIEJSZYĆ), została ODRZUCONA przez właściciela
-- 2026-08-25: „obiekty w katalogu są przede wszystkim pinezkami na mapie,
-- dodatkowe dane są plusem, nie warunkiem obecności". Ta migracja jest zgodna
-- z tamtą decyzją i celowo idzie tylko w jedną stronę, w górę.
--
-- PRÓG = KWORUM, NIE POJEDYNCZY GŁOS. Ten sam próg, co w interfejsie:
-- `QUORUM_POTWIERDZEN` w `frontend/src/lib/potwierdzeniaObiektu.ts`. Powód jest
-- ten sam co tam („jeden klik nie jest jeszcze potwierdzeniem, tylko czyjąś
-- opinią") plus drugi, ważniejszy tutaj: przy progu 1 każdy zalogowany mógłby
-- sam jednym kliknięciem wepchnąć dowolny obiekt do indeksu Google.
--
-- Liczymy per PARA (fakt, wartość) — dokładnie tak, jak `najlepszePotwierdzenie()`
-- i strona obiektu: „oświetlenie: tak" od dwóch osób to potwierdzony fakt,
-- a „tak" od jednej i „nie" od drugiej to spór, nie treść. Dzięki temu do
-- indeksu wchodzi wyłącznie obiekt, przy którym CZŁOWIEK NA STRONIE też widzi
-- potwierdzony fakt — ta sama zasada, którą `QUORUM_POTWIERDZEN` trzyma między
-- `AnkietyObiektu.tsx` a `lib/structuredData.ts`: robot nigdy nie wyprzedza
-- tego, co widać.
--
-- Uruchamiana drugi raz nie psuje niczego: sam `CREATE OR REPLACE`,
-- `DROP TRIGGER IF EXISTS` i backfill, który jest idempotentny z definicji
-- (ustawia 1 tam, gdzie jeszcze nie ma 1).

-- ---------------------------------------------------------------------------
-- Wyzwalacz promocji
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_potwierdzenia_promuj_tier() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_ma_kworum boolean;
BEGIN
  -- Czy DOWOLNY fakt tego obiektu osiągnął kworum. `LIMIT 1` w podzapytaniu,
  -- bo interesuje nas istnienie, nie liczba potwierdzonych faktów.
  SELECT EXISTS (
    SELECT 1
    FROM potwierdzenia_obiektu p
    WHERE p.field_id = NEW.field_id
    GROUP BY p.fakt, p.wartosc
    HAVING count(*) >= 2   -- QUORUM_POTWIERDZEN (lib/potwierdzeniaObiektu.ts)
    LIMIT 1
  ) INTO v_ma_kworum;

  -- Jednokierunkowo, tak jak przy meczu i komentarzu w `112`: raz zdobyty
  -- Tier 1 nie spada. Gdyby spadał, wycofany głos wyrzucałby stronę z indeksu,
  -- a wejście i wyjście z indeksu Google kosztuje tygodnie w obie strony.
  IF v_ma_kworum THEN
    UPDATE fields SET seo_tier = 1 WHERE id = NEW.field_id AND seo_tier <> 1;
  END IF;

  RETURN NEW;
END;
$$;

-- INSERT ORAZ UPDATE: `zapiszPotwierdzenie()` robi UPSERT z `onConflict`
-- na (field_id, user_id, fakt), więc zmiana zdania przez drugą osobę przychodzi
-- jako UPDATE i może właśnie tym ruchem dopchnąć parę (fakt, wartość) do kworum.
-- Sam INSERT przegapiłby ten przypadek.
DROP TRIGGER IF EXISTS potwierdzenia_promuj_tier ON potwierdzenia_obiektu;
CREATE TRIGGER potwierdzenia_promuj_tier
  AFTER INSERT OR UPDATE ON potwierdzenia_obiektu
  FOR EACH ROW EXECUTE FUNCTION trg_potwierdzenia_promuj_tier();

-- ---------------------------------------------------------------------------
-- Backfill — obiekty, które kworum MAJĄ już dziś
--
-- Bez tego wyzwalacz działałby wyłącznie na przyszłość, a potwierdzenia zbierane
-- od migracji `123` (sierpień 2026) zostałyby poza indeksem do czasu, aż ktoś
-- zagłosuje jeszcze raz. To jest ta sama klasa błędu, co seed, którego nikt nie
-- uruchamia: mechanizm formalnie istnieje i nic nie robi.
-- ---------------------------------------------------------------------------

UPDATE fields f
SET seo_tier = 1
WHERE f.seo_tier <> 1
  AND EXISTS (
    SELECT 1
    FROM potwierdzenia_obiektu p
    WHERE p.field_id = f.id
    GROUP BY p.fakt, p.wartosc
    HAVING count(*) >= 2
  );

COMMENT ON FUNCTION trg_potwierdzenia_promuj_tier IS
  'Awans obiektu do Tier 1, gdy dowolna para (fakt, wartość) w potwierdzenia_obiektu osiągnie kworum 2 głosów. Trzeci sygnał promocji obok meczu i komentarza (migracja 112); jednokierunkowy. Próg musi zostać równy QUORUM_POTWIERDZEN z frontend/src/lib/potwierdzeniaObiektu.ts — pilnuje tego kworumPotwierdzen.test.ts.';
