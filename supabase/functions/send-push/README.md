# Push — co trzeba zrobić RĘCZNIE, żeby ruszył

Kod jest w repo, ale push **nie zadziała**, dopóki nie przejdziesz tych pięciu
kroków. Do momentu ich wykonania wszystko zachowuje się jak dotąd: powiadomienia
w aplikacji działają, przełącznik w profilu się nie pokazuje, wyzwalacz wychodzi
po cichu.

Kolejność ma znaczenie — klucze najpierw, bo wchodzą w dwa różne miejsca.

## 1. Wygeneruj klucze VAPID

Na swoim komputerze (nie w repo, klucz prywatny nigdzie nie ma być zapisany):

```bash
node -e '
const {generateKeyPairSync}=require("crypto");
const {publicKey,privateKey}=generateKeyPairSync("ec",{namedCurve:"prime256v1"});
console.log("PUBLICZNY :", publicKey.export({type:"spki",format:"der"}).subarray(-65).toString("base64url"));
console.log("PRYWATNY  :", privateKey.export({format:"jwk"}).d);
'
```

Publiczny jest jawny (trafia do kodu strony). Prywatny to sekret — wchodzi
**wyłącznie** do sekretów funkcji w Supabase.

## 2. Klucz publiczny → Vercel

Vercel → Settings → Environment Variables:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY = <publiczny>
```

Potem **redeploy** — zmienne `NEXT_PUBLIC_*` wchodzą do kodu przy budowaniu, nie
przy starcie. Bez redeploya przełącznik w profilu dalej się nie pokaże.

## 3. Sekrety funkcji → Supabase

Supabase → Edge Functions → Secrets:

```
VAPID_PUBLIC_KEY   = <publiczny>
VAPID_PRIVATE_KEY  = <prywatny>
VAPID_SUBJECT      = mailto:kontakt@bojo.pl
BOJO_PUSH_SEKRET   = <dowolny długi losowy ciąg — wymyśl własny>
```

`BOJO_PUSH_SEKRET` to hasło, którym baza przedstawia się funkcji. Ten sam ciąg
wpiszesz w kroku 5.

## 4. Wdróż funkcję — z przeglądarki, bez CLI

GitHub → zakładka **Actions** → **„Wdróż funkcje brzegowe"** → **Run workflow**.
Pole „funkcja" zostaw puste (wdroży wszystkie) albo wpisz `send-push`.

Wymaga jednorazowo sekretu `SUPABASE_ACCESS_TOKEN` w repozytorium: Supabase →
Account → Access Tokens → wygeneruj, potem GitHub → Settings → Secrets and
variables → Actions → New repository secret.

Workflow sam dokłada `--no-verify-jwt` dla `send-push` — i to jest
**obowiązkowe**: wołającym jest baza danych, nie zalogowany człowiek, więc bez
tej flagi Supabase odrzuci wywołanie, zanim funkcja zdąży sprawdzić własny
sekret. Autoryzacja odbywa się nagłówkiem `x-bojo-sekret`, sprawdzanym
w pierwszych liniach funkcji. Dlatego lista „funkcje bez JWT" siedzi w pliku
workflow, a nie w pamięci osoby klikającej.

Z konsoli (gdyby kiedyś było pod ręką CLI) to samo robi:

```bash
supabase functions deploy send-push --no-verify-jwt
```

## 5. Powiedz bazie, gdzie dzwonić

Supabase → SQL Editor (podmień oba `<…>`):

Adres funkcji zbudowany jest z identyfikatora projektu — tego samego, który
widać w adresie panelu Supabase (`…/project/TEN-KAWAŁEK/sql/…`) i w publicznym
adresie API aplikacji. Dla tego projektu jest to `qjmizwjwjaprurfesimx`, więc
wystarczy wkleić poniższe bez żadnych podmian — poza sekretem:

```sql
INSERT INTO konfiguracja_push (klucz, wartosc) VALUES
  ('url',    'https://qjmizwjwjaprurfesimx.supabase.co/functions/v1/send-push'),
  ('sekret', '<ta sama wartość co BOJO_PUSH_SEKRET>')
ON CONFLICT (klucz) DO UPDATE SET wartosc = EXCLUDED.wartosc;
```

To NIE jest adres `bojo-app.supabase.co` ani adres panelu
(`supabase.com/dashboard/...`) — panel to strona do klikania, a funkcja stoi pod
adresem API projektu.

Tabela ma RLS bez żadnej polityki, więc przez API nie odczyta jej nikt. Czyta ją
wyłącznie wyzwalacz, bo działa jako `SECURITY DEFINER`.

## Sprawdzenie, że działa

1. Profil → „Powiadomienia na telefon" → **Włącz**, zgódź się w oknie
   przeglądarki.
2. Sprawdź, że subskrypcja doszła:
   ```sql
   SELECT user_id, left(endpoint, 40), przegladarka, created_at
   FROM push_subscriptions ORDER BY created_at DESC LIMIT 5;
   ```
3. Wyślij próbne powiadomienie do siebie (podmień `<twoje-user-id>`):
   ```sql
   INSERT INTO notifications (user_id, type, title, body)
   VALUES ('<twoje-user-id>', 'internal', 'Test', 'Jeśli to widzisz, push działa');
   ```
   Powiadomienie ma przyjść na telefon w kilka sekund.
4. Gdy nie przyszło — logi funkcji: Supabase → Edge Functions → send-push → Logs.
   Najczęstsze przyczyny w kolejności prawdopodobieństwa: brak `--no-verify-jwt`,
   rozjazd `BOJO_PUSH_SEKRET` między sekretami a `konfiguracja_push`, zły adres
   w `url`.

## iPhone

Push na iOS działa **wyłącznie** w Bojo dodanym do ekranu głównego (Udostępnij →
„Dodaj do ekranu początkowego"). W Safari otwartym normalnie nie zadziała i nie
da się tego obejść — to ograniczenie systemu, nie aplikacji. Przełącznik w
profilu sam to rozpoznaje i pokazuje wtedy instrukcję zamiast martwego przycisku.
