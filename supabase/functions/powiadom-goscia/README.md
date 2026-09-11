# Poczta do gościa bez konta — co trzeba zrobić RĘCZNIE

> **STATUS: KANAŁ WŁĄCZONY OD 2026-09-10.** Wszystkie cztery kroki niżej są wykonane —
> domena zweryfikowana, funkcja wdrożona, sekrety ustawione, `konfiguracja_poczty`
> wypełniona. Sześć szablonów sprawdzone realną wysyłką, Resend przyjął komplet.
> Instrukcja zostaje jako opis tego, co i po co jest ustawione — i na wypadek
> odtwarzania konfiguracji od zera (np. drugie środowisko).
>
> ⚠️ Gdyby przyszło to robić ponownie: **`konfiguracja_poczty` MUSI być ostatnia.**
> `wyslij_mail_do_goscia()` zapisuje ślad w dzienniku PRZED wysyłką, a `net.http_post`
> jest asynchroniczne — więc przy złym sekrecie funkcja odpowie `401`, baza tego nie
> zobaczy, a mail zostanie oznaczony jako wysłany i **nigdy nieponowiony**. Sekret
> sprawdza się wywołaniem BEZPOŚREDNIM (nie dotyka dziennika), a konfigurację wpisuje
> dopiero po `200`.

Kod jest w repo i migracja `133` jest już w bazie, ale **żaden mail nie wyjdzie**,
dopóki nie przejdziesz tych czterech kroków. I to jest zamierzone: bez
konfiguracji baza nawet nie woła funkcji, a funkcja bez klucza kończy się
sukcesem bez wysyłki. Nic się przez to nie psuje — kanał po prostu milczy.

Kolejność ma znaczenie: **domena najpierw**. Maile z domeny innej niż strona
lądują w spamie, a raz spalona reputacja nadawcy wraca miesiącami.

## 1. Domena `bojo.pl` w Resend

Resend → Domains → `bojo.pl`. DNS trzyma Vercel, więc jest tam przycisk
**Auto configure** — doda rekordy DKIM/SPF/DMARC do Vercela sam. Status musi
zejść z `Pending` na `Verified`; propagacja potrafi zająć od kilkunastu minut
do kilku godzin.

Dopóki domena nie jest zweryfikowana, **nie przechodź dalej**: Resend przyjmie
wysyłkę tylko z adresu w zweryfikowanej domenie.

> Uwaga: pozostałe funkcje (`notify-game-alert`, `send-invites`) mają nadawcę
> `noreply@bojo.app`. Po zweryfikowaniu `bojo.pl` warto przestawić i je —
> to osobne zadanie, nie blokuje tego kanału.

## 2. Klucz API z Resend

Resend → API keys → Create. Uprawnienie **Sending access** wystarczy.
Skopiuj — pokazuje się raz.

## 3. Wdróż funkcję i ustaw sekrety

GitHub → Actions → **Wdróż funkcje brzegowe** → Run workflow, w polu funkcji
wpisz `powiadom-goscia` (albo zostaw puste, żeby wdrożyć wszystkie).

Workflow sam dokłada `--no-verify-jwt` — funkcja jest na liście `BEZ_JWT`.
**To jest obowiązkowe:** woła ją baza, nie zalogowany człowiek, więc bez tej
flagi Supabase odrzuci wywołanie, zanim funkcja zdąży sprawdzić własny sekret.
Awaria byłaby CICHA: `net.http_post` jest asynchroniczne, więc baza nie zobaczy
odmowy — mail po prostu by nie przyszedł.

Potem Supabase → Edge Functions → Secrets:

```
RESEND_API_KEY     = <klucz z kroku 2>
BOJO_POCZTA_SEKRET = <dowolny długi losowy ciąg — wymyśl własny>
BOJO_NADAWCA       = Bojo <noreply@bojo.pl>
```

⚠️ **Sam `RESEND_API_KEY` NIE WYSTARCZA.** Sprawdzone na produkcji 2026-09-08: klucz
był ustawiony, a mimo to nie wychodził ani jeden mail — bo `konfiguracja_poczty` była
pusta (krok 4), a funkcja `powiadom-goscia` w ogóle niewdrożona (krok 3). To są cztery
niezależne kroki i pominięcie któregokolwiek daje ten sam objaw: cisza.

`BOJO_NADAWCA` czytają teraz także `send-invites` i `notify-game-alert` — do 2026-09-08
miały nadawcę `noreply@bojo.app` wpisanego na sztywno, czyli domenę INNĄ niż strona.

`BOJO_URL` jest opcjonalny (domyślnie `https://bojo.pl`) — przyda się tylko,
gdyby linki miały prowadzić gdzie indziej. `BOJO_ODPOWIEDZ_NA` też (domyślnie
`bojopolska@gmail.com`) — to adres, na który trafi ODPOWIEDŹ na maila.

## 4. Wpis w bazie

Supabase → SQL Editor. `<sekret>` musi być **dokładnie tą samą wartością** co
`BOJO_POCZTA_SEKRET` z kroku 3 — to jest całe uwierzytelnienie między bazą
a funkcją.

```sql
INSERT INTO konfiguracja_poczty (klucz, wartosc) VALUES
  ('url',    'https://qjmizwjwjaprurfesimx.supabase.co/functions/v1/powiadom-goscia'),
  ('sekret', '<sekret>')
ON CONFLICT (klucz) DO UPDATE SET wartosc = EXCLUDED.wartosc;
```

Od tej chwili kanał jest włączony.

## Osobno, ale w tej samej sprawie: SMTP dla Supabase — ✅ ZROBIONE 2026-09-11

Panel Supabase (Authentication → Emails) pokazywał ostrzeżenie: **„You're using the
built-in email service. This service has rate limits and is not meant to be used for
production apps.”** Tym kanałem szły **reset hasła** i **magic link** — czyli dwie
drogi logowania w Bojo.

To NIE jest ten sam kanał co poczta z tego katalogu (nasza idzie przez `pg_net` prosto
z bazy, z pominięciem GoTrue), ale dotyczy tego samego problemu: gracz, który nie dostanie
linku do logowania, nie wejdzie do składu. Dziś oba kanały wychodzą przez Resend
i przez zweryfikowane `bojo.pl`:

Authentication → Emails → SMTP Settings — `Enable custom SMTP` włączone:

```
Host:   smtp.resend.com
Port:   465
User:   resend
Pass:   <ten sam klucz API co RESEND_API_KEY>
Sender: noreply@bojo.pl   (nazwa nadawcy: BOJO.PL)
```

**Pole `Pass` przyjmuje WARTOŚĆ klucza, nie jego nazwę.** Sekrety funkcji brzegowych
(`RESEND_API_KEY`) nie podstawiają się w ustawieniach Auth — to inny system. Wpisana tam
nazwa zamiast wartości daje `535` przy każdej wysyłce, a użytkownik widzi wyłącznie
„nie udało się wysłać", więc pomyłka jest praktycznie niewidoczna.

Sprawdzenie, które to rozstrzyga — wywołanie GoTrue i odczyt dziennika, bez zgadywania
po wyglądzie pola (hasła nie da się odczytać po zapisaniu):

```sql
SELECT net.http_post(
  url     := 'https://<projekt>.supabase.co/auth/v1/recover',
  headers := jsonb_build_object('Content-Type','application/json','apikey','<anon>'),
  body    := jsonb_build_object('email','<adres z kontem>')
);
-- po chwili:
SELECT status_code, content FROM net._http_response ORDER BY id DESC LIMIT 1;
```

`200 {}` znaczy, że serwer SMTP przyjął wiadomość — GoTrue przy odmowie SMTP-a oddaje
`500`, więc to jest rozstrzygające. W `auth_logs` widać wtedy `user_recovery_requested`
ze statusem `200`. Sprawdzone 2026-09-11: `200`, czas odpowiedzi ~1 s (realny handshake
z `smtp.resend.com`).

Limit wysyłek Auth zostaje osobnym ustawieniem (Authentication → Rate Limits) i po
wpięciu własnego SMTP-a można go podnieść — wbudowany limit był dobrany pod wbudowaną
usługę, nie pod Resend.

## Jak sprawdzić, że działa

Zapisz się na dowolny mecz jako gość bez konta, podając swój adres — powinien
przyjść mail „Jesteś zapisany". Jeśli nie przyszedł:

```sql
-- Czy baza w ogóle próbowała wysłać?
SELECT * FROM maile_wyslane ORDER BY created_at DESC LIMIT 10;
```

- **Pusto** → baza nie doszła do wysyłki. Sprawdź, czy wpis ma `guest_email`
  i czy `konfiguracja_poczty` ma oba klucze.
- **Jest wiersz, maila nie ma** → problem jest po stronie funkcji. Supabase →
  Edge Functions → `powiadom-goscia` → Logs. `brak klucza` znaczy nieustawiony
  `RESEND_API_KEY`; `401` znaczy rozjazd sekretu między krokiem 3 a 4.

## Co dokładnie wychodzi i kiedy

| Powód | Kiedy | Do kogo |
|---|---|---|
| `zapis` | zaraz po zapisie | każdy gość z adresem (trzy warianty: skład / rezerwa / poczekalnia) |
| `zaakceptowano` / `odrzucono` | organizator rozpatrzył prośbę o dołączenie | gość, który czekał na akceptację |
| `oferta` | zwolniło się miejsce, a gość jest pierwszy w kolejce | gość z rezerwy, z adresem |
| `odwolanie` / `zmiana` | odwołanie meczu, zmiana terminu, miejsca albo kosztu | każdy gość z adresem, także z rezerwy |
| `jutro_grasz` | dzień przed, zadanie `bojo-maile-gosci` (16:10 UTC) | tylko gość w SKŁADZIE — rezerwa jeszcze nie wie, czy gra |
| `zaloz_konto` | dzień po meczu | tylko gość, którego adres nadal nie ma konta w Bojo |
| `powitanie` | po POTWIERDZENIU adresu przy zakładaniu konta | każdy nowy użytkownik, raz w życiu konta |

Najwyżej jeden mail na wpis, na powód, na dobę (`maile_wyslane`) — zadanie cron
potrafi wystartować dwa razy, a dwa identyczne maile to już spam. Powitanie jest
wyjątkiem: jego klucz idempotencji nie ma daty, bo ma pójść **raz w życiu konta**.

Powitanie czeka na potwierdzenie adresu celowo — inaczej przy rejestracji hasłem
przyszłoby równolegle z „potwierdź adres" od Supabase. Przy Google adres jest
potwierdzony od razu, więc mail idzie natychmiast.

Pełny opis decyzji: `docs/funkcje.md`, sekcja „Poczta do gościa bez konta".
