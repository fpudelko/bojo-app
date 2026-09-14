-- Czy push jest na produkcji realnie WŁĄCZONY, czy tylko zbudowany.
-- Od tego zależy, czy wygenerowanie nowej pary kluczy VAPID kogokolwiek kosztuje.

-- 1. Ile przeglądarek ma dziś aktywną subskrypcję (te unieważni nowy klucz)
SELECT count(*) AS subskrypcji_push FROM push_subscriptions;

-- 2. Czy baza w ogóle wie, gdzie dzwonić (wiersze z migracji 102)
SELECT klucz, CASE WHEN klucz = 'sekret' THEN '(ustawiony)' ELSE wartosc END AS wartosc
FROM konfiguracja_push ORDER BY klucz;

-- 3. Czy którakolwiek wysyłka kiedykolwiek się udała
SELECT count(*) AS udanych_wysylek, max(last_ok_at) AS ostatnia
FROM push_subscriptions WHERE last_ok_at IS NOT NULL;
