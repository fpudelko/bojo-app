-- 117: Dopięcie subskrypcji push do aktualnego konta przy logowaniu.
--
-- BUG: subskrypcja push jest PER PRZEGLĄDARKA, nie per konto (patrz nagłówek
-- `lib/push.ts`) — jeden wiersz w `push_subscriptions` na urządzenie, kluczowany
-- `endpoint`-em. Wiersz dostaje `user_id` WYŁĄCZNIE w `wlaczPush()`, czyli po
-- kliknięciu „Włącz". Na wspólnym urządzeniu (telefon do testów, kilka kont
-- Bojo) `stanPush()` sprawdza WYŁĄCZNIE, czy przeglądarka ma jakąkolwiek
-- subskrypcję (`pushManager.getSubscription()`) — nie sprawdza, czyja. Gdy
-- konto B loguje się na telefonie, na którym konto A wcześniej włączyło push,
-- `stanPush()` od razu pokazuje „Włączone" — więc konto B nigdy nie klika
-- „Włącz" i wiersz zostaje przypisany do konta A NA ZAWSZE.
--
-- SKUTEK ZGŁOSZONY WPROST: powiadomienie push o CUDZEJ wiadomości (adresowane
-- do konta A) przyszło na telefon, na którym w danej chwili zalogowane jest
-- konto B — wyglądające jak „dostałem powiadomienie o własnej wiadomości",
-- bo to ten sam fizyczny telefon. Wyzwalacz `powiadom_o_wiadomosci_w_meczu`
-- (migracja `109`/`111`) POPRAWNIE wyklucza autora z odbiorców — problem nie
-- jest w regule powiadomień, tylko w tym, do kogo jest przypięty telefon.
--
-- FIX: RPC wołane po cichu przy KAŻDYM logowaniu (`lib/auth.tsx`), gdy
-- przeglądarka ma już subskrypcję — bez pytania o zgodę (już udzielona) i bez
-- klikania „Włącz". Musi być SECURITY DEFINER: zwykły UPSERT z klienta
-- (`push_subscriptions.upsert(..., {onConflict:'endpoint'})`, jak w
-- `wlaczPush()`) trafiłby na ten sam problem, który naprawia — polityka
-- UPDATE `USING (auth.uid() = user_id)` sprawdza WŁAŚCICIELA ISTNIEJĄCEGO
-- wiersza (konto A), nie nowego (konto B), więc RLS po cichu odrzuciłby
-- reassignment (ta sama pułapka co w AGENTS.md „RLS po cichu unieważnia
-- UPDATE" — zero błędu, zero zmiany).
--
-- Bezpieczeństwo: RPC zawsze przypisuje wiersz do `auth.uid()` wołającego —
-- nigdy do cudzego konta. Jedyny nowy wektor to przejęcie CUDZEGO `endpoint`
-- (świadome podanie nie swojego), a `endpoint` to nieprzewidywalny adres
-- wydany przez usługę push przeglądarki — porównywalny poziom zaufania co
-- dzisiejsza polityka INSERT, która i tak przyjmuje `endpoint` bez weryfikacji.
CREATE OR REPLACE FUNCTION dopnij_subskrypcje_push(
  p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT, p_przegladarka TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, przegladarka)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, p_przegladarka)
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id      = excluded.user_id,
        p256dh       = excluded.p256dh,
        auth         = excluded.auth,
        przegladarka = excluded.przegladarka;
END;
$$;

GRANT EXECUTE ON FUNCTION dopnij_subskrypcje_push(TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION dopnij_subskrypcje_push IS
  'Przypina istniejącą subskrypcję push (per przeglądarka) do aktualnie zalogowanego konta. Wołane po cichu przy logowaniu (lib/auth.tsx) — naprawia sytuację, w której współdzielone urządzenie zostaje na zawsze przypięte do PIERWSZEGO konta, które kiedykolwiek kliknęło „Włącz" (migracja 117).';
