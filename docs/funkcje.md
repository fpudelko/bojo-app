# Inwentarz funkcji

Co aplikacja potrafi, gdzie to leży i **czy użytkownik to widzi**. Status wobec wizji →
[wizja.md](./wizja.md#2-status-implementacji).

---

## Flagi funkcji

**Najczęstsze źródło pomyłki w tym repo: „funkcja nie działa" — a ona działa, tylko jest
schowana.** Zanim uznasz coś za niezbudowane, sprawdź tę tabelę.

| Flaga | Wartość | Co chowa | Gdzie warunkuje |
|---|---|---|---|
| `SHOW_CUP` | `false` | Turniej / BOJO Cup | `Header.tsx`, `AnnouncementBar.tsx` |
| `SHOW_GAME_ALERTS` | `false` | „Ustaw alert" o grach w okolicy | `components/home/dashboard/DashboardSections.tsx` (sekcja „Otwarte mecze" na dashboardzie zalogowanego) |
| `SHOW_SMS_FEATURES` | `false` | Potwierdzenia SMS i przypomnienia | `app/wydarzenia/[id]/edytuj/page.tsx` |
| `SHOW_RECURRING` | `false` | Gry cykliczne / stałe gierki (wyłączona ponownie 2026-08-16, produktowa decyzja — kod i istniejące serie zostają) | `Header.tsx`, `SiteFooter.tsx`, `app/moje-gry/page.tsx` (link „Stałe gierki" i sekcja „Kolejne stałe gierki"), `app/wydarzenia/nowe/page.tsx` (kafelek „Wydarzenie cykliczne") |
| `SHOW_MIN_PLAYERS_THRESHOLD` | `false` | Toggle progu „gra się odbędzie" i werdykt „Gramy ✓ / Brakuje N do minimum" (wyłączona 2026-08-21, produktowa decyzja — `events.min_players` i logika zostają) | `EventCapacityFields.tsx` (kreator + edycja), `CzyGramyPanel.tsx` |
| `FEATURE_RESERVATIONS` | z env `NEXT_PUBLIC_FEATURE_RESERVATIONS` | Rezerwacje obiektów | `LeafletMapImpl.tsx`, `app/admin/[fieldId]/page.tsx` |

Pierwszych pięć: `frontend/src/lib/features.ts` (stałe w kodzie).
Ostatnia: `frontend/src/config/features.ts` (zmienna środowiskowa).

**Rezerwacje mają drugą furtkę per obiekt:** `showBookingForField()` zwraca `true`, jeśli
flaga globalna jest włączona **albo** dany obiekt ma `fields.booking_enabled = true`.
Czyli rezerwacje można włączyć pojedynczemu boisku bez odmrażania całej funkcji.

**Flagi ukrywają wejścia, nie trasy.** Trasa `/turniej` odpowiada normalnie, jeśli ktoś
wpisze adres ręcznie — flaga (`SHOW_CUP`) usuwa tylko linki w nawigacji. Dlatego trasy za
flagami nie trafiają do `llms.txt` ani do `sitemap.ts`: reklamowanie ich wyszukiwarce
obiecuje coś, czego użytkownik nie znajdzie w interfejsie.

---

## Gdzie jest spis tras

Celowo nie utrzymujemy tu inwentarza tras i komponentów — agent znajdzie je szybciej
przez `frontend/src/app/**` niż w tabeli, która by się zestarzała. Ludzki opis funkcji
z trasami: [PRZEWODNIK.md](../PRZEWODNIK.md). Admin = `profiles.is_admin = true`,
panel pod `/admin/*` (CRM kontaktu z obiektami: `/admin/outreach`, logika `lib/outreach.ts`).

---

## Funkcje meczu (opcje zaawansowane)

Włączane per mecz przy tworzeniu lub edycji, obsługiwane przez `lib/eventFeatures.ts`:

| Opcja | Kolumna | Efekt |
|---|---|---|
| Drużyny | `team_mode`, `teams_published` | Podział składu, kapitanowie, losowanie, publikacja |
| Wyniki | `track_results` | Wynik meczu + gole i asysty |
| Płatności | `track_payments`, `show_payment_status` | Podział kosztów (organizator), karta „Twoja płatność" (uczestnik) |
| Bramkarze | `goalkeepers_enabled`, `max_goalkeepers` | Osobny limit; nadmiarowi na rezerwę |
| Akceptacja zapisów | `require_approval` | Zapis nie zajmuje miejsca do akceptacji |
| Goście bez konta | `allow_guest_adds` | Uczestnicy mogą dopisywać gości — formularz „Dopisz osobę bez konta" widoczny dla każdego potwierdzonego uczestnika (także rezerwowego) do startu meczu, nie tylko organizatora. **Ustawiane wyłącznie w edycji meczu** (`/wydarzenia/[id]/edytuj`, przełącznik w `EventDetailClient.tsx`) — kreator (`/wydarzenia/nowe`) nie ma tej kontrolki i `createEvent()` jej nie wysyła, więc każdy nowy mecz startuje z domyślnym `false` |
| Kod dołączenia | `join_code` | Wejście przez `/d/[code]` |
| Przejęcie wpisu gościa | `claim_token` | Osoba dopisana ręcznie wiąże wpis z kontem przez `/gracz/przejmij/[token]`; zaproszenie „Zaproś do Bojo" niesie argument (`tekstZaproszeniaGoscia`), nie sam link, i działa też po starcie meczu. Wysłać może też ten, kto gościa dopisał (`allowGuestAdds`), nie tylko organizator — `mozeZaprosic()` w `EventDetailClient.tsx`. Przycisk jest identyczny w składzie i na rezerwie — gość-rezerwowy też ma `claim_token`. Zaraz po dodaniu gościa (`handleAddGuest()`) otwiera się modal `GuestInviteNudge.tsx` z tą samą argumentacją, proaktywnie — raz na wydarzenie (`localStorage`, klucz `bojo:goscie-cta-widziano:<eventId>`), żeby organizator dopisujący kilkanaście osób pod rząd nie dostał tylu samo modali |
| Potwierdzenie SMS | `require_sms_confirmation`, `confirmation_deadline_h` | **ukryte — `SHOW_SMS_FEATURES`** |

**„Twoja płatność" — uczestnik widzi, ile ma zapłacić.** Do niedawna kwotę po
uwzględnieniu zniżki kartowej i status opłacone/nieopłacone widział wyłącznie
organizator w panelu „Podział kosztów". Karta na stronie meczu
(`EventDetailClient.tsx`, `costGrosze > 0 && !isOwner && event.showPaymentStatus &&
myConfirmed && !myConfirmed.isReserve`) liczy cenę przez `priceForParticipant()` —
ten sam wzorzec co panel organizatora, jedno źródło prawdy. Rezerwowy nie widzi tej
karty: jeszcze nie ma za co płacić, dopóki nie wejdzie do składu.

**„Wyślij rozliczenie ekipie" — rozliczenie da się wysłać, nie tylko obejrzeć.**
Przycisk w panelu „Podział kosztów" (`lib/settlementShare.ts`, `tekstRozliczenia()`)
otwiera systemowy arkusz udostępniania z gotową wiadomością: kwota od osoby, ile
zebrano z ile oczekiwanych, lista zaległości z kwotami (uwzględniają zniżkę kartową)
i numer BLIK, gdy organizator akceptuje tę metodę płatności. Bez tego organizator
przepisywał to ręcznie na czat — goście bez konta w ogóle nie mają jak zobaczyć
swojej kwoty w Bojo, więc wiadomość na czacie jest dla nich jedynym kanałem.

**Numer BLIK mieszka w osobnej tabeli `event_blik`, nie w `events`** (migracje `120`/`121`).
RLS w Postgresie jest WIERSZOWE, a `events` ma politykę SELECT `USING (true)` — dopóki numer
siedział w tym wierszu, `canSeeBlikPhone()` chowało go w interfejsie, a baza i tak oddawała go
w każdej odpowiedzi `select('*')`, każdemu, także niezalogowanemu. Odebranie uprawnienia do
samej kolumny (`REVOKE SELECT (blik_phone)`) wywróciłoby wszystkie `select('*')` w repo, więc
numer przeniósł się tam, gdzie da się go zamknąć polityką. Wiersz `event_blik` widzi
organizator, delegat od płatności/edycji (`089`) i uczestnik meczu. Klient dociąga numer
osadzeniem w `getEvent()` (`select('*, fields(address), event_blik(blik_phone)')`), zapisuje
przez `zapiszNumerBlik()` (`lib/blik.ts`) — także dla całej serii cyklicznej naraz.
**`anon` MUSI mieć GRANT SELECT** na tej tabeli, choć nie zobaczy ani jednego wiersza: bez
tego PostgREST oddaje wylogowanemu „permission denied" i pada cała strona meczu.
Reguła „numer dopiero na godzinę przed meczem" zostaje ŚWIADOMIE w UI — to wygoda dla
uczestnika, nie ochrona przed nim. Kto nie jest w składzie, widzi zdanie „numer do BLIKA
zobaczysz, jeśli dołączysz do składu" (nagłówek meczu) albo „Numer do BLIKA zobaczysz po
zapisaniu się" (okno dołączania) — wcześniej okno pokazywało numer każdemu.

**„Wszyscy oddali" — masowe oznaczenie płatności, nie klikanie po jednej osobie.**
Przycisk w panelu „Podział kosztów" (`EventDetailClient.tsx`, `handleWszyscyOddali`) stoi
**na górze panelu**, zaraz pod podsumowaniem „Zebrano" — nad listą uczestników z
przełącznikami, nie pod nią: to najczęstsza akcja na tej zakładce po meczu, więc nie ma
czekać za przewijaniem całego składu (zgłoszone wprost: pierwsza wersja stała na dole,
obok „Wyślij rozliczenie ekipie"). Ta sama akcja dostępna jest też jako trzeci przycisk
(skrócona etykieta „Zapłacili"/„Cofnij" — pełna „Wszyscy oddali" nie mieściła się obok
dwóch innych przycisków w jednej linii, patrz niżej) w rzędzie karty „Po meczu" — patrz
[„Karta »Po meczu«"](#karta-po-meczu) niżej. Oznacza jako opłaconych wszystkich w składzie
(`regulars` — bez rezerwy, bez oczekujących na akceptację; goście bez konta się liczą,
bo też są w składzie i też płacą), którzy jeszcze nie oddali. Gdy już wszyscy oddali,
ten sam przycisk zmienia się w „Cofnij — nikt nie oddał" i odwraca oznaczenie
jednym kliknięciem. Kwota per osoba liczona jak wszędzie przez `priceForParticipant()`
— zniżka z karty sportowej jest respektowana, więc masowe oznaczenie robi tyle UPDATE-ów,
ile jest różnych kwot w składzie (`ustawPlatnoscWszystkim()`, `lib/eventFeatures.ts`),
nie jeden. Dostępne dla organizatora i delegata z `can_manage_payments`, potwierdzane
`confirm()` jak reszta masowych/nieodwracalnych akcji na tej stronie. Helper
`zaktualizujWiersze()` (`lib/zapytania.ts`) sprawdza, że baza zmieniła dokładnie tyle
wierszy, ile podano — ta sama pułapka cichej porażki RLS co przy pojedynczym zapisie,
tylko na skalę całego składu.

**Po starcie meczu cena ustępuje miejsca rozliczeniu.** Chip ceny w nagłówku strony
meczu i badge na karcie `EventBrowseCard` (zakładka „Historia") pokazują przed
meczem cenę i „Wymaga akceptacji"; po starcie meczu (`eventStarted`) — organizator
widzi „Rozliczono" albo „X osób nie zapłaciło" (`event.unpaidCount`, liczone z już
pobranego `event_participants` w `getMyParticipatedEvents()`), gracz widzi „Zapłacono"
albo „Zapłać" (`relation.hasPaid`). „Wymaga akceptacji" znika po starcie — bez
znaczenia po fakcie. Sekcje „Podział kosztów"/„Twoja płatność" na stronie meczu
renderują się nad „Składy"/„Wynik meczu" po starcie meczu (przed startem — odwrotnie);
treść sekcji się nie zmienia, tylko kolejność (`skladWynikSection`/`platnosciSection`
w `EventDetailClient.tsx`).

**Nazwy drużyn są jednym słownikiem.** `lib/teamLabels.ts` (`TEAM_LABELS`,
`TEAM_LETTERS`, `TEAM_COLOR_CLASSES`) — „Niebiescy"/„Czerwoni" + litery N/C wszędzie,
w składzie (`TeamsPanel`, `PublishedTeamsCard`) i w wyniku (`MatchResultForm`). Dane
w bazie zostają literami A/B, zmieniła się wyłącznie warstwa etykiet.

**Strzelcy nie mogą przebić wyniku końcowego.** `MatchResultForm` blokuje zapis
(i disabluje przycisk), gdy suma goli albo asyst u strzelców przekracza
`scoreA + scoreB` — dotyczy wyłącznie `family === 'goals'` (piłka nożna/futsal/piłka
ręczna), bo tylko tam jest sekcja „Strzelcy".

---

## Zapis na mecz bez logowania

**Problem.** Nieznajomi obawiają się założenia konta w obcej aplikacji. Organizator chce
dać im możliwość szybkiego dołączenia, bez wymuszania logowania — wystarczy imię i e-mail.

**Rozwiązanie w Bojo.** Osoba bez konta może dołączyć do meczu, podając imię i e-mail
(dokładnie tak samo jak uczestnik zalogowany). Zanim kliknie „Zapisz się", widzi tę
samą zapowiedź rezerwy co zalogowany („Mecz ma już komplet — zapiszesz się na listę
rezerwową jako 2. w kolejce"). Zapisuje się na główny skład lub rezerwę zgodnie
z tymi samymi regułami pojemności; ekran po zapisie pokazuje faktyczny status
(„Jesteś w składzie" albo „Jesteś na liście rezerwowej") nad już zaktualizowaną listą
uczestników. Może dokończyć profil bez ponownego wpisywania imienia/maila — hasłem
albo przez Google — i od razu ląduje na stronie meczu, bez dodatkowego ekranu
potwierdzenia „to ja". Gdy podany e-mail ma już konto w Bojo, to samo pole hasła
przełącza się z rejestracji na logowanie — po zalogowaniu wpis przejmowany jest
tak samo od razu. Nawet jeśli gość zamknie ten ekran bez logowania (albo w ogóle
go nie zobaczy — np. wpis dodał organizator ręcznie), a e-mail pasuje do istniejącego
lub przyszłego konta, właściciel tego konta dostanie **powiadomienie** z gotowym
linkiem do przejęcia przy najbliższej okazji (patrz niżej) — nic nie ginie w milczeniu.
Anonimowy zapis **nie wymaga logowania ani wymyślania po stronie organizatora** —
link do dołączenia to ten sam link, co do każdego innego meczu. Ten sam e-mail nie
zapisze się dwa razy na ten sam mecz. Gdy to wciąż e-mail bez konta (nieprzejęty
wpis-gość), druga próba pokazuje ten sam ekran zachęty, tylko z nagłówkiem
„Wcześniej dołączyłeś do tej gry." zamiast „Zapisano!". Gdy e-mail **ma już konto
w Bojo**, ekran skraca się do logowania — bez listy korzyści i bez namawiania na
drugie konto, z podlinią „Zaloguj się, żeby zobaczyć więcej szczegółów" i małym
„Pomiń i zobacz skład bez logowania"; nagłówek nadal mówi, czy to świeży zapis, czy
powrót do zapisu sprzed chwili. Gdy wpis ma już właściciela (konto przejęło zapis
albo dołączyło normalnie, po zalogowaniu), pokazuje się ten sam skrócony ekran bez
pola hasła — nie ma czego przejmować, więc zostaje samo logowanie. W żadnym z tych
przypadków nie powstaje drugi wiersz w składzie i nie leci czerwony błąd.

**Mechanika.** Funkcja RPC `dolacz_do_meczu_jako_goscie()` (migracja `082`, poprawiona
migracją `083` — INSERT…RETURNING z jawnym prefiksem tabeli) w Supabase, wołana z
`frontend/src/lib/events.ts` (`joinEventAsGuest()`, zwraca `claimToken` i `isReserve`).
Wpis gościa to wiersz `event_participants` z kolumnami `user_id = NULL`, `is_guest = true`,
`guest_email`, `is_reserve` (liczony przez tę samą logikę co zalogowani). Trigger
`nadaj_token_gosciowi` (migracja `066`) generuje unikalny `claim_token` (UUID). Dialog
gościa w `EventDetailClient.tsx` liczy zapowiedź rezerwy z `wolneMiejscaWgRol()`
(bez zapytania do bazy); `handleJoinAsGuest()` woła `load()` po udanym zapisie, żeby
lista uczestników była aktualna, zanim pokaże się ekran zachęty. Tam
`handleCreateAccountFromGuest()` woła `signUpWithEmail()` i — gdy sesja jest aktywna
od razu — `przejmij_wpis_goscia()` wprost, bez przejścia przez `/logowanie`. Gdy
`signUpWithEmail()` rzuci błąd „już istnieje", `handleSignInFromGuest()` woła
`signInWithEmail()` na tym samym polu hasła i przejmuje wpis po udanym logowaniu.
Przycisk Google woła `signInWithGoogle()` z `next=/gracz/przejmij/[token]?auto=1` —
parametr `auto=1` na tej stronie (`PrzejmijClient.tsx`) każe przejąć wpis automatycznie,
gdy user jest już zalogowany, zamiast czekać na klik „To ja — potwierdzam".

Migracja `084` dodaje dwa wyzwalacze SQL, które kojarzą wpis gościa z kontem po
e-mailu w tle, niezależnie od tego, czy gość w ogóle przeszedł przez ekran zachęty:
`event_participants` → `auth.users` (nowy wpis, e-mail pasuje do istniejącego konta)
i `auth.users` → `event_participants` (nowe konto, e-mail pasuje do wcześniejszych
nieprzejętych wpisów). Oba wstawiają powiadomienie typu `niepotwierdzony_wpis_goscia`
z kolumną `notifications.claim_token`; `NotificationBell.tsx` kieruje kliknięcie na
`/gracz/przejmij/[token]` zamiast na stronę meczu. **Żaden z wyzwalaczy nie ustawia
`user_id` sam** — samo powiadomienie niczego nie przejmuje, to nadal wymaga
świadomego kliknięcia i `auth.uid()` po stronie `przejmij_wpis_goscia()` (migracja `066`).

Migracja `085` dodaje na starcie `dolacz_do_meczu_jako_goscie()` sprawdzenie
duplikatu: wpis z tym e-mailem już w tym meczu (nieprzejęty gość → zwraca istniejący
`claim_token` zamiast tworzyć drugi wiersz; przejęty → wyjątek) albo e-mail pasuje do
konta już będącego uczestnikiem przez normalne, zalogowane dołączenie (JOIN
`auth.users`→`event_participants.user_id`) → wyjątek. Sprawdzenie idzie przed
`sync_reserve_claim()`/`czy_na_rezerwe()`, żeby odrzucone żądanie nie ruszało kolejki
rezerwowych. `signUpWithEmail()` w `lib/auth.tsx` dostała drugi sposób wykrycia
„e-mail już ma konto" — `data.user.identities.length === 0` — bo gdy w projekcie
włączona jest ochrona przed enumeracją e-maili, Supabase dla istniejącego adresu nie
rzuca błędu, tylko zwraca fałszywy sukces bez sesji; bez tej dodatkowej detekcji
`handleCreateAccountFromGuest()` nigdy by nie przełączył się na logowanie w tym
trybie. Naprawia to też tę samą lukę w zwykłej rejestracji przez `/logowanie`.

Migracja `087` dodaje do wyniku `dolacz_do_meczu_jako_goscie()` kolumnę
`already_joined` (zmiana `RETURNS TABLE` — wymagała `DROP FUNCTION` + `CREATE`,
`CREATE OR REPLACE` nie pozwala zmienić typu zwracanego, i ponownego `GRANT EXECUTE`).
`joinEventAsGuest()` w `lib/events.ts` przekazuje ją dalej jako `alreadyJoined`,
a `handleJoinAsGuest()` w `EventDetailClient.tsx` używa jej do nagłówka ekranu zachęty
(„Wcześniej dołączyłeś" zamiast „Zapisano!").

Migracja `088` dokłada czwartą kolumnę `has_account` (`EXISTS` na `auth.users` po
zlowercase'owanym e-mailu — pytanie globalne, nie „czy jest w tym meczu"), zamienia
wyjątek `'Jesteś już zapisany na ten mecz.'` na zwykły wiersz z `claim_token = NULL`
i zakłada unikalny indeks `idx_participants_unique_guest_email` na
`(event_id, lower(guest_email))`, wcześniej kasując duplikaty sprzed `085` (bez tego
indeks się nie zakłada). Wyszukanie istniejącego wpisu dostało `ORDER BY (claim_token
IS NULL) DESC, created_at` — przy danych z duplikatami samo `LIMIT 1` losowało wariant
ekranu. `handleJoinAsGuest()` wybiera ekran po kształcie wyniku: pusty `claimToken` →
`showAlreadyJoinedPrompt`, w przeciwnym razie `showAccountPrompt` z `newUserHasAccount`
i `accountEmailTaken` ustawionymi z `has_account` (pole hasła startuje w trybie
logowania). Dopasowanie po treści wyjątku zostało tylko jako furtka zgodności na czas,
zanim `088` zostanie wgrana ręcznie w Supabase — `joinEventAsGuest()` czyta
`has_account` przez `?? false`, więc stary, trzykolumnowy kształt RPC nadal działa.

**Pytania, na które odpowiada ta sekcja:** Czy mogę dołączyć do meczu bez konta w Bojo?
Jak niezalogowany gracz może się zapisać na mecz? Czy gość bez konta zajmuje miejsce
w składzie? Jak przejąć wpis gościa po założeniu konta? Co się stanie, jeśli zapiszę
się jako gość na e-mail, który ma już konto w Bojo?

---

## Zaproszenia na mecz

Imienne zaproszenie (`event_player_invites`, migracja `060`, `lib/playerInvites.ts`) —
organizator albo dowolny potwierdzony uczestnik zaprasza konkretne osoby z grupy
(`components/events/InviteFromGroupDialog.tsx`, przycisk „Zaproś z grupy" na stronie
meczu). Zaproszenie nie zajmuje miejsca w składzie; odpowiedź to zwykłe „Dołącz" /
„Obserwuj" na stronie meczu albo „Nie tym razem" (odrzucenie, zapisywane trwale, żeby
ponowne „zaproś grupę" nie wskrzeszało odrzuconego zaproszenia).

Gdzie widać otwarte zaproszenia:

| Miejsce | Co pokazuje |
|---|---|
| Strona główna (dashboard) | Sekcja „Zaproszenia" — max 3, znika przy zerze |
| `/moje-gry?tab=nadchodzace` | Ten sam teaser co na dashboardzie — max 3, link „Wszystkie" prowadzi do zakładki niżej |
| `/moje-gry?tab=zaproszenia` | Pełna lista, bez limitu, z pustym stanem |
| `/wydarzenia` | Plakietka „Zaproszenia N" obok pola wyszukiwania — **widoczna tylko gdy N > 0**, prowadzi do zakładki wyżej |

Wspólny hook `lib/useMyInvites.ts` (pobiera zaproszenia + mapę uczestnictwa, filtruje do
statusu `'invited'`) i wspólny komponent listy `components/events/InviteList.tsx` — cztery
powyższe miejsca renderują ten sam kod, żeby nie rozjeżdżały się przy zmianie.
`InvitesSection` (`components/home/dashboard/DashboardSections.tsx`) przyjmuje opcjonalne
`href`/`dismissedIds`/`onDismiss` właśnie po to, żeby dashboard i `/moje-gry` mogły dzielić
jeden komponent zamiast dwóch kopii — patrz sekcja „Układ `/moje-gry`" niżej.

Nie mylić z `lib/invites.ts` (tabela `event_invites`, migracja `036`) — zaproszenia po
e-mailu z tokenem, martwy kod, nic go nie importuje.

**Jeden przycisk „Zaproś z grupy" na stronie, nie dwa.** Do niedawna były dwa — przy
liczniku wolnych miejsc i osobno w sekcji „Zaproś znajomych" — z różnymi ikonami i różnymi
warunkami widoczności. Zostaje wyłącznie ten przy liczniku (`!isFull`, ikona `Users`);
sekcja niżej na stronie ma dziś tylko udostępnianie linku.

**Kto zaprosił, kto odpowiedział — widok organizatora.**
`components/events/EventInvitesStatus.tsx`, tylko `isOwner` (RLS na
`event_player_invites` i tak nie przepuści reszty — SELECT widzi zaproszony, organizator
i admin). Lista imion z awatarami i statusem: Czeka / Dołączył(a) / Nie tym razem. Nazwy
dociąga `getEventInvitesWithNames()` (`lib/playerInvites.ts`) drugim zapytaniem do
`profiles` — `event_player_invites` ma klucz obcy do `auth.users`, nie do `profiles`, więc
PostgREST nie potrafi tego wbudować jednym joinem. Reguła „uczestnictwo bije wcześniejszą
odmowę" (`lib/inviteStatus.ts`, pod testem) — ktoś mógł kliknąć „Nie tym razem" i mimo to
dołączyć innym kanałem; `dismissed_at` sprawdza się dopiero, gdy w składzie go nie ma.

---

## Dolny panel nawigacji (mobile)

`components/layout/BottomNav.tsx`, montowany globalnie przez `BottomNavGate.tsx`
(`app/layout.tsx`) dla zalogowanych na mobile. Panel chowa się na dwóch ścieżkach, gdzie
zasłaniałby ważniejsze CTA:

- **Kreator meczu** (`/wydarzenia/nowe`) — cały czas, żeby nie rozpraszać organizatora
  i nie zasłaniać przycisku „Dalej".
- **Strona meczu**, dopóki widoczny jest pasek „Dołącz →" / „Obserwuj" (czyli dopóki
  użytkownik nie ma potwierdzonego miejsca ani oczekującej prośby). Po dołączeniu panel
  wraca — to zachęta do kolejnej akcji.

Mechanizm: `lib/bottomNavVisibility.tsx` — kontekst z licznikiem (nie boolean), żeby dwa
niezależne powody ukrycia nie odsłaniały panelu przedwcześnie. Komponent `<HideBottomNav/>`
montowany warunkowo chowa panel, dopóki jest zamontowany.

**„Ukryty" chowa przez CSS, nie odmontowuje — od 2026-08-30.** `BottomNavGate.tsx`
renderuje `<BottomNav hidden={hidden}/>` zawsze (poza „nie zalogowany"/„widget"), a
`BottomNav.tsx` dokłada klasę `hidden` zamiast `return null`. Wcześniej `BottomNavGate`
zwracało `null` na ukrytych ekranach — `BottomNav` się odmontowywał, a razem z nim
znikały refy pilnujące kolejki dymków z podpowiedziami (`poprzednieAktywne`, limit
`LIMIT_DYMKA = 5` pokazań na typ w `localStorage`). Przy każdym powrocie z kreatora
(`<HideBottomNav/>`) komponent montował się od nowa, `poprzednieAktywne` wracał do `{}`
i przejście „nieaktywny → aktywny" wyglądało jak nowe — dymek „Przytrzymaj «Grupy»”
odpalał się ponownie, aż wyczerpał limit w kilka wejść i wyjść z kreatora. Zgłoszone
wprost: dymek „wisi na każdym ekranie".

**Miejsce pod paskiem — zmienna `--bottom-nav-h`.** Pasek jest `fixed`, więc sam z siebie
nie rezerwuje miejsca w dokumencie. `BottomNavGate.tsx` ustawia `document.documentElement
.dataset.bottomNav = '1'`, dopóki pasek faktycznie jest widoczny (zalogowany, mobile, nie
schowany); `app/globals.css` reaguje na `html[data-bottom-nav='1']` i:
- dokłada `padding-bottom: var(--bottom-nav-h)` do `<body>`,
- odejmuje `--bottom-nav-h` od `.min-h-screen` / `.h-screen` (kolejność `vh` → `svh`, jak
  w `.hero-first-screen` — `svh` ignoruje chowający się pasek adresu).

Od `md:` (768px) `--bottom-nav-h` wraca do `0px` — pasek i tak jest `md:hidden`. Zastąpiło
to element-dystans (`<div className="h-16" />`), który **nie działał**: `BottomNavGate`
montuje się w layoucie po `{children}`, więc dystans lądował poza kontenerem strony i tylko
wydłużał dokument o 64 px — po dojechaniu do dołu każda strona dla zalogowanego na mobile
kończyła się pustym pasem tła. Wartość `--bottom-nav-h` (`3.5rem` + `env(safe-area-inset-bottom)`)
musi się zgadzać z rzeczywistą wysokością paska (`h-14` w `BottomNav.tsx`).

**Kropki na „Mecze", „Ekipy" i „Szukaj".** Niebieska na „Mecze" (dolny róg, pod
zieloną plakietką) — oczekujące prośby o dołączenie (`hasPendingApprovalRequests()`,
`lib/events.ts`). Pomarańczowa na „Ekipy" (prawy górny róg) — nowy mecz w którejkolwiek
mojej ekipie od ostatniej wizyty na jej stronie (`hasNewGroupEvents()` w `lib/groups.ts`,
ten sam znacznik `kluczGrupyWidziano()` co kropka na karcie ekipy niżej). Pomarańczowa na
„Szukaj" (prawy górny róg) — nowe wydarzenie w promieniu 5 km od ostatniej wizyty
(`maNoweWydarzeniaWPobolizu()` w `lib/events.ts`, znacznik `KLUCZ_WYDARZENIA_WIDZIANO`).
Kolor ma stałe znaczenie w całej apce, patrz `AGENTS.md` → Konwencje.

**Nieprzeczytane wiadomości to LICZBA na „Rozmowy", nie kropka ani chmurka —
od 2026-08-23.** Wcześniej wisiała tam różowa chmurka: bez liczby i tylko dla meczów
i ekip. Trzy rzeczy były z tym nie tak. Po pierwsze, nad ikoną podpisaną „Rozmowy"
chmurka powtarzała słowo stojące tuż obok, zamiast dokładać cokolwiek nowego. Po drugie,
człowiek przed dotknięciem pyta ILE tego jest — czy to moment na przeczytanie, czy na
później — a chmurka na to nie odpowiadała. Po trzecie, **rozmowy prywatne nie były
liczone w ogóle**, więc DM (jedyna wiadomość skierowana wprost do jednej osoby) nie
zapalał wskaźnika. Dziś stoi tam różowa plakietka z sumą nieprzeczytanych wiadomości ze
WSZYSTKICH trzech źródeł, o tej samej geometrii co zielona plakietka z liczbą meczów na
„Mecze" (`h-[15px]`, „9+" powyżej dziewięciu): kształt mówi „policzalna rzecz", kolor
mówi jaka.

Liczbę daje `policzNieprzeczytane()` z **`lib/rozmowy.ts`** — tej samej funkcji używa
nagłówek ekranu `/rozmowy`, więc plakietka nie może pokazać czegoś innego, niż człowiek
zobaczy po jej dotknięciu. Wcześniej były na to trzy różne odpowiedzi w dwóch miejscach
interfejsu: `nieprzeczytaneWMeczach()` liczyło MECZE z nieprzeczytanymi (nie wiadomości),
`hasUnreadGroupMessages()` zwracało samo `true/false`, a ekran rozmów sumował wiadomości.
`pobierzRozmowy()` zastąpiło w `BottomNav.tsx` trzy zapytania jednym.

**Każde zapytanie ignoruje odpowiedź, która wróciła po zmianie trasy.** Wszystkie cztery
efekty w `BottomNav.tsx` (prośby, wiadomości „Moje", wiadomości+nowość „Grupy", pobliskie
nowe) trzymają lokalną flagę `aktualne`, zerowaną w funkcji sprzątającej efektu — bez tego
wolniejsza odpowiedź z POPRZEDNIEJ trasy mogła wrócić PO szybszej odpowiedzi ze świeżo
odpalonego zapytania i nadpisać poprawny stan starym, zostawiając kropkę zapaloną bez
żadnego realnego powodu. Zgłoszone wprost jako różowa kropka na „Moje" mimo zera
nieprzeczytanych wiadomości widocznych na samej stronie.

**Błąd zapytania gasi kropkę, nie zostawia poprzedniej wartości.** Powyższa poprawka nie
wystarczyła — kropka na „Moje" wracała mimo przeczytania wiadomości. Każdy `.then()` w tych
efektach kończył się gołym `.catch(() => {})`: przy błędzie (chwilowy problem sieci,
odświeżenie tokenu Supabase w trakcie) stan po prostu zostawał taki, jaki był PRZED
nieudanym zapytaniem — jeśli ostatnia udana odpowiedź brzmiała „są nieprzeczytane", kropka
świeciła dalej w nieskończoność, aż trafi się kolejne udane zapytanie. `catch` w każdym z
czterech efektów ustawia teraz jawnie `false` (`null` dla nazwy grupy) zamiast nic nie
robić — brak pewności o stanie ma zawsze wygrywać z fałszywie zapaloną kropką.

Pomarańczowa kropka **wymaga zgody na lokalizację JUŻ udzielonej** — sprawdzana cicho przez
`hasGeolocationPermission()` (`lib/geo.ts`, Permissions API), bez pytania o nią. Gdyby zamiast
tego kropka wołała `getCurrentLocation()` wprost, każda zmiana trasy wywoływałaby systemowe
okno o zgodę na lokalizację bez żadnego kontekstu — dla kogoś, kto jej nigdy nie udzielił.
Brak zgody = brak kropki, nie prośba w tle.

**Liczba nadchodzących meczów na „Moje".** W prawym górnym rogu ikony „Moje" stoi
zielona plakietka z liczbą meczów, w których gram, czekam na rezerwie albo organizuję —
od dzisiaj w przód, bez odwołanych (`policzNadchodzaceMoje()` w `lib/events.ts`, ten sam
zbiór co `getMyActiveEventIds()`, więc kliknięcie pokazuje dokładnie tyle pozycji, ile
mówi plakietka). Zero nie renderuje nic, powyżej dziewięciu pokazuje „9+". Kolor zielony,
nie różowy/niebieski/pomarańczowy — to stan, nie zdarzenie (patrz AGENTS.md, Konwencje).
Niebieska kropka „prośba o dołączenie" schodzi przez to do dolnego rogu ikony.

**Chmurka wiadomości to własny kształt, nie ikona z biblioteki.** `MessageCircle` z lucide
w rozmiarze 12 px zlewał się w plamę (okrąg z detalami w środku; wypełniony traci wszystko
poza obrysem). `components/layout/IkonaWiadomosci.tsx` rysuje prostokąt z zaokrąglonymi
rogami i ogonkiem, bez detali w środku, z białą obwódką wpisaną w kształt
(`paint-order: stroke` — ring z Tailwinda rysowałby prostokąt wokół pola ikony).

**Dymki przy pierwszym zapaleniu kropki.** Gdy kropka na dolnej nawigacji przechodzi z
wyłączonej na włączoną (nie przy każdej zmianie trasy, dopóki świeci — `poprzednieAktywne`
w `BottomNav.tsx` łapie wyłącznie to przejście), nad ikoną na 4 s pojawia się mała czarna
etykieta z krótkim wyjaśnieniem: „Nowa prośba o dołączenie" (niebieska, „Mecze"), „Nowa
wiadomość w meczu {tytuł}" i „Nowa wiadomość w grupie {nazwa}" (obie kierowane na
„Rozmowy" — tytuł i nazwa z `najswiezszaNieprzeczytana()` w `lib/rozmowy.ts`, czyli
z tej samej listy, która karmi plakietkę; osobne typy/liczniki, żeby dymek jednoznacznie
wiedział, przy której ikonie stanąć), „Nowa gra w grupie {nazwa}" (pomarańczowa na „Ekipy"
— `getNewGroupEventGroup()` w `lib/groups.ts`, ekipa z najświeższym nowym meczem, gdy
nowych jest kilka naraz), „Nowa gra w promieniu 5 km" (pomarańczowa na „Szukaj").
Licznik pokazań w `localStorage` (`bojo:dymek-pokazania:<typ>`) jest per typ — po 5
pokazaniach danego typu dymek przestaje się pojawiać, zakładamy że użytkownik już wie,
co ten wskaźnik znaczy.

**Pomarańczowy wskaźnik gaśnie razem ze swoim dymkiem, różowy nie.** Gdy dymek znika,
`wygasWskaznik()` zapisuje „widziano" pod tym samym kluczem, co odwiedzenie strony
(`kluczGrupyWidziano(id)` dla nowego meczu w ekipie, `KLUCZ_WYDARZENIA_WIDZIANO` dla gier
w pobliżu) — więc gaśnie też kropka na karcie ekipy na `/grupy`. Uzasadnienie wprost
z konwencji kolorów: pomarańczowy znaczy „nowość, o której jeszcze nie wiesz", a dymek
wymieniający ekipę z nazwy tę wiadomość właśnie dostarczył. Różowa plakietka NIE gaśnie —
ona nie mówi „jest nowość", tylko „jest coś do przeczytania", co znika dopiero po
przeczytaniu; dymek trwa 4 s i można na niego nie patrzeć, a zgubiona w ten sposób
wiadomość nie ma jak się upomnieć.

**Najwyżej jeden dymek na ekranie naraz.** Gdy kilka kropek zapala się w tym samym
przeliczeniu (typowo przy pierwszym załadowaniu), dymki nie renderują się równolegle —
zasłaniałyby się nawzajem na wąskim pasku pięciu ikon. `BottomNav.tsx` trzyma pojedynczy
stan `dymekWidoczny` (typ + tekst + `href` ikony, do której należy) i kolejkę
`kolejkaDymkow`: pierwszy trafiony typ pokazuje się od razu, reszta czeka w kolejce
i pokazuje się po kolei, jeden po drugim, każdy na swoje 4 sekundy. Dymek jest zawsze
przypięty do konkretnej ikony przez `href` — komponent `NavLink` dostaje gotowy tekst
tylko wtedy, gdy `dymekWidoczny.href` zgadza się z jego własnym `href`.

Dymek nad skrajną ikoną (pierwszą — „Znajdź grę", ostatnią — „Grupy") wystawał poza ekran:
wyśrodkowany nad wąską kolumną blisko krawędzi, ciągnął się poza jej brzeg (zgłoszone wprost,
ze zrzutem). `NavLink` dostaje prop `dymekAlign` (`'left' | 'center' | 'right'`) — skrajne
kolumny w `BottomNav.tsx` przypinają dymek do swojej wewnętrznej krawędzi zamiast centrować
go nad ikoną, środkowe trzy kolumny zostają wyśrodkowane jak dotąd.

**Plakietka „💬 N" na karcie meczu prowadzi prosto do Rozmowy, nie do zakładki Mecz.**
Cała karta (`EventBrowseCard.tsx`) to jeden `<Link>` na `/wydarzenia/[id]`; plakietka
z liczbą nieprzeczytanych wewnątrz niej przejmuje kliknięcie (`stopPropagation` +
`router.push`) i nawiguje na `/wydarzenia/[id]?tab=rozmowa` — adres, który
`EventDetailClient.tsx` już umiał czytać (`?tab=`), tylko nic go dotąd nie generowało.
`role="link"` + `onKeyDown` (Enter/Spacja), żeby plakietka została osiągalna
z klawiatury mimo że nie jest osobnym `<a>`.

**Panel rozmów pod przytrzymaniem „Moje" już nie istnieje — zastąpił go ekran
`/rozmowy`.** Wysuwany arkusz (`components/layout/PanelRozmow.tsx`) miał dwa
ograniczenia nie do naprawienia bez zmiany formy: otwierał go GEST, którego nikt nie
odkryje sam, i jako warstwa nad inną stroną nie miał własnego adresu — nie dało się
do niego wrócić „wstecz" ani wysłać linku. Rozmowy mają dziś własne miejsce w dolnej
nawigacji, własną trasę i plakietkę z liczbą nieprzeczytanych (wyżej).

**Pomarańczowa kropka na konkretnej karcie, nie tylko na ikonie/liście.** Zbiorcza kropka
(„Grupy", „Znajdź grę", karta ekipy na `/grupy`) mówi „coś jest nowe", ale nie wskazuje
CO — zgłoszone wprost. `EventBrowseCard` dostał prop `isNew`: pomarańczowa kropka w rogu
ikony sportu na konkretnym wpisie. Na `/wydarzenia` — `EventsListClient.tsx` odczytuje
`KLUCZ_WYDARZENIA_WIDZIANO` PRZED nadpisaniem go na „teraz" (inaczej porównanie zawsze
wypadałoby „nic nie jest nowe") i przekazuje starą wartość do `EventsListView` jako
`widzianoWczesniej`; `null`/`undefined` (pierwsza wizyta) świadomie nie oznacza niczego —
na pierwszej wizycie KAŻDE wydarzenie byłoby „nowe", co zalałoby listę kropkami. Na
`/grupy/[id]` (zakładka Mecze, też „Najbliższy mecz" nad zakładkami) — ten sam wzorzec ze
starą wartością `kluczGrupyWidziano()`, zmienna `grupaWidzianaWczesniej` w
`GroupDetailClient.tsx`.

„Nieprzeczytane" liczy się z `localStorage` („ostatnio widziano" per mecz/ekipa,
`kluczRozmowyWidziano()`/`kluczTablicaWidziano()`), nie z tabeli w bazie — własne
wiadomości nigdy się nie liczą, bo nadawca widział je w momencie wysyłania.
`getMyActiveEventIds()` (gram/rezerwa/organizuję) **nie filtruje po dacie** — mecz
z historii z nową wiadomością też zapala różową kropkę na „Moje"; `/moje-gry` (zakładka
Historia) i mecze ekipy (`/grupy/[id]`, sekcja Historia) przekazują `unreadMessages` do
`EventBrowseCard` również tam, nie tylko w Nadchodzących. To jednak nie wystarczyło samo
w sobie — **`EventBrowseCard` w ogóle nie renderował plakietki w gałęzi JSX dla
rozegranych meczów** (osobny branch od meczów nadchodzących, bez badge'a niezależnie od
propa `unreadMessages`), więc kropka na „Moje" świeciła się bez żadnego widocznego śladu,
gdzie szukać wiadomości — zgłoszone wprost, dwa razy, zanim znaleziono właściwe miejsce.
Plakietka (razem ze `statusChip`) teraz stoi też w gałęzi „rozegrany/anulowany", owinięta
wspólnym `ml-auto`, żeby oba elementy trzymały się prawej krawędzi niezależnie od tego,
czy któryś z nich akurat istnieje. Ten sam mechanizm zasila plakietkę z liczbą przy
zakładce Rozmowa/Tablica (patrz zakładki `/wydarzenia/[id]` i `/grupy/[id]` niżej) oraz
ikonę z liczbą obok chipu „N wolnych miejsc"/„Rozegrany" na karcie meczu (tylko gdy
gram/organizuję/jestem na rezerwie w tym meczu).

**Kropki na karcie ekipy (`/grupy`).** Na ikonie każdej ekipy: różowa w lewym górnym rogu —
nieprzeczytana wiadomość na tablicy (ten sam `nieprzeczytane()` co wyżej) — pomarańczowa
w prawym górnym rogu — nowy mecz w ekipie od ostatniej wizyty na `/grupy/[id]`
(`maNoweMecze()`/`getGroupEventsForNew()` w `lib/groups.ts`, znacznik `kluczGrupyWidziano()`,
ustawiany przy KAŻDYM wejściu na stronę ekipy, niezależnie od zakładki — osobny od
`kluczTablicaWidziano()`, bo odpowiada na inne pytanie). Sama kropka, bez licznika — karta
listy grup ma być czytelna na pierwszy rzut oka, nie kolejnym miejscem do liczenia.

**Filtra na `/moje-gry` NIE MA** (usunięty 2026-08-28, zgłoszone wprost: „tam
z założenia nie będzie za dużo meczów więc filtr niepotrzebny"). Chip „Brakuje graczy"
zawężał listę, ale przy niewielkiej liczbie meczów na tej zakładce sam był rozwiązaniem
problemu, którego praktycznie nie ma — plakietka „N wolne miejsca" na karcie już mówi to
samo. `needsPlayers()` (`DashboardSections.tsx`) i cała logika `przechodziFiltry` zostały
usunięte razem z nim.

**Filtra „nieprzeczytane" tu NIE MA** (decyzja z 2026-08-24). Nieprzeczytane wiadomości
mają własne, mocniejsze wejście — zakładkę „Rozmowy" w dolnej nawigacji z chmurką —
a różowa plakietka na karcie i tak mówi, w którym meczu ktoś pisał.

---

## Rozmowa otwarta z listy rozmów zostaje rozmową

`/rozmowy/grupa/[id]` (`RozmowaGrupyClient.tsx`) i `/rozmowy/mecz/[id]`
(`RozmowaMeczuClient.tsx`) — od 2026-08-23. Wcześniej lista rozmów prowadziła na
`/grupy/[id]?tab=tablica` i `/wydarzenia/[id]?tab=rozmowa`, czyli **dotknięcie rozmowy
wyrzucało z komunikatora na stronę ekipy albo meczu** — z paskiem zakładek, składem,
statystykami i zarządzaniem. Człowiek dotykał wiadomości, a dostawał panel administracyjny;
„wstecz" wracało stamtąd na `/grupy`, nie do listy rozmów, więc z komunikatora nie dało się
wyjść tam, skąd się weszło (zgłoszone wprost).

Obie trasy to pełny ekran o układzie 1:1 z rozmową prywatną `/rozmowy/[id]`: własny
nagłówek zamiast paska serwisu na mobile (`hideMobileBarForUser`), `HideBottomNav`,
wysokość liczona z widocznego okna (`useOknoCzatu` — inaczej composer ucieka nad
klawiaturę na iOS). Treść rozmowy to te same komponenty co w zakładkach
(`RozmowaGrupy`, `RozmowaWydarzenia`) i te same tabele — nic się nie duplikuje.

**Kontekst jest ODNOŚNIKIEM, nie paskiem zakładek.** `components/rozmowy/NaglowekRozmowy.tsx`
daje jeden wiersz: strzałka wstecz, awatar (okładka ekipy albo emoji sportu), nazwa,
podpis mówiący dokąd prowadzi („Otwórz ekipę", „Otwórz mecz · jutro · 18:00") i strzałka
w prawo. Cały wiersz jest celem dotknięcia (44 px) — na telefonie sama nazwa to za mały
cel. Wyjście do ekipy/meczu jest więc na żądanie, a nie nad każdą wiadomością.

Rozmowy pozostają dostępne **także** jako zakładka na stronie ekipy i meczu — kto przyszedł
zarządzać, ma je tam, gdzie były. Nowe trasy obsługują drugą drogę wejścia.

**Kto widzi.** Ekipa: członkowie (`getMyGroupPermissions()` zwraca `null` dla nieczłonka).
Mecz: uczestnicy — gram / rezerwa / organizuję (`getMyActiveEventIds()`, ten sam zbiór,
z którego bierze się lista rozmów). Prawdziwą bramką jest RLS (`group_posts`,
`event_comments`, migracja `120`); warunek w komponencie istnieje po to, żeby ktoś
z linku dostał zdanie wyjaśnienia i przycisk do ekipy/meczu zamiast pustego czatu z polem
do pisania, które i tak odbije baza. Obie trasy są `noindex`.

---

## „Wstecz" wraca do poprzedniego ekranu, nie do sztywnego rodzica

`lib/historia.tsx` — od 2026-08-23. Ekrany szczegółowe miały wstecz zapisane na sztywno
do JEDNEGO rodzica, mimo że wchodzi się na nie z wielu miejsc. Do `/grupy/[id]` prowadzi
siedem dróg (kafelek na stronie głównej, `/moje-gry`, lista rozmów, strona meczu,
przytrzymanie „Ekipy", kod zaproszenia, przełącznik ekip), a wstecz zawsze szło na
`/grupy`; do `/rozmowy/[id]` wchodzi się też z profilu gracza, a wstecz zawsze szło na
`/rozmowy`. Opisane przez użytkownika jako „wstecz prowadzi w losowe miejsca" — nie było
losowe, było stałe i przez to prawie zawsze złe.

Druga połowa problemu: te ekrany robiły `router.push()`, nie `back()`. Push **dokłada**
wpis do historii, więc systemowe „wstecz" tuż po naszym „wstecz" wracało na ekran, z
którego się właśnie wyszło — pętla.

**Mechanika.** `SledzenieHistorii` (montowane w `app/layout.tsx`) liczy przejścia między
ekranami w tej karcie przeglądarki. `useWstecz(zapasowyCel)` woła `router.back()`, gdy
jest dokąd wracać w aplikacji, a `router.replace(zapasowyCel)`, gdy nie ma — czyli po
wejściu z powiadomienia push, z linku od kolegi albo z ikony PWA, gdzie kontekst JS jest
świeży, a historia pusta albo cudza. `replace`, nie `push`, właśnie po to: po wejściu
z linku systemowe „wstecz" ma wyprowadzić z aplikacji, a nie odbić z powrotem.

Powrót ZDEJMUJE poziom licznika zamiast go dokładać (`oznaczPowrot()` przed `router.back()`)
— bez tego licznik tylko by rósł, bo `back()` też zmienia trasę, i po dojściu do korzenia
aplikacja dalej twierdziłaby, że jest gdzie cofać.

**Ograniczenie, świadome:** licznik żyje w pamięci modułu, więc twarde przeładowanie (F5)
zeruje go i wstecz użyje rodzica zamiast prawdziwej historii. To bezpieczna strona pomyłki
— rodzic zawsze istnieje i jest sensowny, a `router.back()` na cudzy wpis w historii
wyprowadziłby z aplikacji bez ostrzeżenia.

**Gdzie działa:** `/grupy/[id]`, `/grupy/[id]/edytuj`, `/grupy/nowe`, `/wydarzenia/[id]`
(z zachowanym wyjątkiem „prosto z kreatora" → `replace('/moje-gry')`, żeby wstecz nie
wracało do wypełnionego formularza), `/rozmowy/[id]`, obie nowe trasy rozmów oraz
`/gracz/[id]` — ten ostatni **nie miał wcześniej ŻADNEGO wyjścia**, mimo że otwiera się
ze składu meczu, z awatara w rozmowie i z listy ekipy.

`/boisko/[id]` zostaje przy własnym mechanizmie (`lib/powrot.ts`, `sessionStorage`):
trasa jest prerenderowana i cel powrotu niesie tam pełny stan mapy, którego sama historia
nie odda.

**Pisząc nowy ekran szczegółowy: `useWstecz(rodzic)`, nie `router.push(rodzic)`.**

---

## Górny pasek nawigacji — inny dla zalogowanych na mobile

Poniżej `md` (768px) zalogowany użytkownik dostaje w `Header.tsx` **inny pasek** niż
wylogowany i niż desktop: bez logo, `h-12` zamiast `h-16`, po prawej dzwonek powiadomień
(`NotificationBell`) i awatar linkujący do `/profil` — zamiast logo + hamburgera. Powód:
wszystko, co było w arkuszu hamburgera dla zalogowanego (Moje mecze, Grupy, Moje obiekty,
panel admina, profil, motyw, Wyloguj), już jest dostępne w dolnym panelu nawigacji albo na
`/profil` — drugi zestaw tych samych skrótów tylko zjadał pierwszy ekran.

Skutek uboczny: dzwonek powiadomień, wcześniej wyłącznie w bloku `hidden md:flex`, jest
teraz dostępny na telefonie.

### Pasek znika całkiem na `/`, `/wydarzenia`, `/mapa`

Na tych trzech trasach zalogowany na mobile **w ogóle nie widzi paska Header** — dzwonek
i awatar wędrują do własnego wiersza strony, wzorem tego, jak od dawna robi to pulpit
(`GreetingBar`: powitanie + awatar w jednym wierszu). Mechanizm: `Header` dostaje prop
`hideMobileBarForUser` — gdy jest `true` **i** ktoś jest zalogowany, cały `<header>`
dostaje `hidden md:block` (znika na mobile, wraca od `md:`), a jego własny mobilny
dzwonek/awatar w ogóle się nie montuje (żeby nie było trzeciego, niewidocznego kanału
realtime obok tego w treści strony).

Zastępczy wiersz to nowy, współdzielony komponent `components/layout/MobileIdentityRow.tsx`
(dzwonek + awatar, markup 1:1 z mobilnego klastra `Header`) — sam sprawdza `useAuth()`
i zwraca `null` dla wylogowanego, więc wywołujący wstawia go bezwarunkowo:

| Trasa | Gdzie wiersz siedzi |
|---|---|
| `/` | `GreetingBar` — dzwonek obok istniejącego awatara `h-10 w-10` |
| `/wydarzenia` | `EventsListView` — jeden wiersz z polem szukania (`flex-1`) + `MobileIdentityRow` |
| `/mapa` | `VenueExplorer` — ten sam wiersz obok pływającego pola szukania nad mapą |

`/moje-gry` i `/grupy` **zachowują pełny pasek Header bez zmian** — `hideMobileBarForUser`
się tam nie przekazuje. Wylogowanych i desktop `hideMobileBarForUser` nie dotyczy nigdy:
wylogowany na tych trasach nadal widzi marketingowy pasek (mapa/Dołącz/awatar) opisany
niżej, a desktop ma pełny pasek jak zawsze.

**Kompaktowy wordmark „bojo" na mobile — `/moje-gry`, `/grupy`, `/grupy/[id]`, widok
wydarzenia.** Te trasy zostawiają pasek Header (nie mają `MobileIdentityRow` we własnej
treści), a zalogowany na mobile ma tam dziś pusty lewy slot — logo (`LogoPill`) jest
`hidden md:block`. Nowy prop `Header({ showMobileWordmark })` wypełnia ten slot
tekstowym linkiem „bojo" (`font-display font-bold text-primary-700`) do `/`, bez zmiany
wysokości paska (`h-12` na mobile zostaje). Przekazywany na `app/moje-gry/page.tsx`,
`app/grupy/GroupsClient.tsx`, `app/grupy/[id]/GroupDetailClient.tsx` i
`app/wydarzenia/[id]/EventDetailClient.tsx` — nigdzie indziej.

**Hamburgera nie ma już w ogóle** — ani dla zalogowanych, ani dla wylogowanych. Arkusz
pełnoekranowy, pułapka focusa i blokada przewijania zostały usunięte z `Header.tsx`.

Wylogowany na mobile dostaje po prawej trzy elementy: **ikonę mapy** (`/mapa`), zielony
przycisk **„Dołącz"** i **ikonę awatara** (logowanie). „Dołącz" prowadzi na
`/logowanie?mode=rejestracja` i otwiera formularz od razu na zakładaniu konta —
`AuthForm` przyjmuje prop `initialMode`, domyślnie `'signin'`, więc pozostałe ~20 wejść
na `/logowanie` zachowuje się bez zmian.

Konsekwencja świadoma: **pasek przestał być nawigacją dla wylogowanego.** Do
`/wydarzenia` i `/wydarzenia/nowe` prowadzą CTA w hero landingu, klikalny krok
„Stwórz mecz" w sekcji „Jak to działa", kafelek w „Co dostajesz", pływający przycisk `+`
(`StickyCta`) oraz linki w stopce.

Desktop (`md:` i wyżej) ma na to miejsce, więc pokazuje oba wejścia z nazwami:
tekstowe „Zaloguj się" i zielone „Dołącz".

### `/profil` — nowy dom opcji z dawnego hamburgera

Zalogowany na mobile, chcąc przełączyć motyw, wejść do panelu admina albo zobaczyć swoje
obiekty, robi to na `/profil` (`app/profil/page.tsx`), nie w nagłówku:

| Sekcja | Warunek | Źródło |
|---|---|---|
| Moje statystyki | zawsze | link do `/gracz/[id]` |
| Moje obiekty | `hasManagedVenue(userId)` (`lib/api.ts`) | zarządza ≥1 obiektem |
| Wygląd (jasny/ciemny) | `next-themes` załadowany | `useTheme()`, ten sam wzorzec co w `Header.tsx` |
| Panel administratora | `useAdmin()` | lista z `lib/adminLinks.ts` — ta sama, co w `AdminMenu` na desktopie |
| Wyloguj się | zawsze | istniało już wcześniej |

`lib/adminLinks.ts` i `lib/api.ts#hasManagedVenue` to wspólne źródła prawdy między
`Header.tsx` (desktop) a `/profil` (mobile) — jedna lista tras, jedno zapytanie.

---

## Szkic kreatora meczu

Kreator (`app/wydarzenia/nowe/page.tsx`) zapamiętuje wypełniany formularz w
`localStorage` przez **12 godzin** (`lib/eventDraft.ts`, `EVENT_DRAFT_TTL_MS`) — jeśli
organizator wyjdzie w trakcie (np. sprawdzić godzinę wynajmu) i wróci, formularz stoi tam,
gdzie go zostawił, zamiast zerować się do stanu początkowego.

- **Odtwarzanie**: raz, przy montowaniu. **Pomijane całkowicie** przy wejściu z `?group=`
  albo `?fieldId=` — te parametry mają własne efekty prefill i kolidowałyby z odtworzonym
  szkicem; wejście z linku obiektu/grupy to świadomy start od nowa.
- **Data w przeszłości**: jeśli odtworzona data blokowałaby krok 2 (`isPast()`), podmieniana
  jest na jutro — reszta szkicu zostaje.
- **Zapis dopiero po pierwszej realnej zmianie**: efekt zapisujący szkic pomija swoje
  pierwsze uruchomienie po hydratacji (`useRef` `isFirstSave`) — bez tego zapisywał czyste
  wartości domyślne przy samym wejściu na stronę, więc kolejna wizyta w oknie 12h TTL
  pokazywała baner odtworzenia mimo braku jakiejkolwiek edycji.
- **Pasek informacyjny**: jedna linia „Wróciliśmy do Twojego szkicu (N minut/godzin temu).
  Zacznij od nowa" + osobny krzyżyk. „Zacznij od nowa" czyści `localStorage` i resetuje
  formularz do stanu początkowego; krzyżyk tylko chowa baner na czas tej wizyty
  (lokalny `useState`, nie dotyka `localStorage` ani TTL) — pojawi się znów po odświeżeniu,
  jeśli szkic wciąż jest ważny.
- **Kasowanie**: po udanej publikacji meczu, automatycznie.

Pole `nazwaWlasnaMiejsca` (nazwa dla pinezki spoza katalogu) jest w `EventDraftValues`
**opcjonalne**, a wersja schematu została na `v: 1`. To celowe: `loadEventDraft` odrzuca
szkic przy `parsed.v !== 1`, więc podbicie wersji unieważniłoby każdy formularz wypełniany
w chwili wdrożenia. Odczyt robi `?? ''`. Pokryte testem w `eventDraft.test.ts`. Tak samo
opcjonalne — i z tego samego powodu — jest `grupaId` (grupa wybrana w kroku 3).

---

## Kreator meczu — co widać na którym kroku

**Wordmark „bojo" w pasku.** Kreator montuje `<HideBottomNav />`, więc bez wordmarku
zalogowany na telefonie nie miał stamtąd żadnego wyjścia „do domu". Oba `<Header />`
w `app/wydarzenia/nowe/page.tsx` (brama logowania i właściwy kreator) dostają
`showMobileWordmark` — ten sam prop co `/moje-gry`, `/grupy`, `/wydarzenia/[id]`.
Wysokość paska bez zmian (`h-12`, sticky stepper na `top-12`).

**Krok 1 „Kiedy" — termin, liczba miejsc, trzy przełączniki.** Ekran niesie datę,
godzinę, czas trwania i liczbę miejsc, a pod nimi trzy przełączniki
(`components/events/OpcjaMeczu.tsx`): „Lista rezerwowa", „Mecz płatny",
„Bramkarze osobno" (ostatni tylko dla sportów z `GK_SPORTS`). Szczegóły każdego —
czas na decyzję z rezerwy, kwota i metody płatności, tryb miejsc dla bramkarzy —
**montują się dopiero po włączeniu**, nie są chowane CSS-em: ukryte pole nadal
wysyła wartość i nadal się waliduje. Wyłączenie „Mecz płatny" CZYŚCI kwotę i metody.
Na dole kroku stoi „Biorę udział" (z wyborem bramkarz/z pola, gdy podział jest
włączony) — pod przełącznikiem, który tę kontrolkę włącza, nie nad nim.

**„Lista rezerwowa" startuje WŁĄCZONA — od 2026-08-27, decyzja właściciela.** Pozostałe
dwa przełączniki dokładają zachowanie, którego domyślnie nie ma (mecz płatny, podział na
bramkarzy); rezerwa jest odwrotnie — to zachowanie domyślne w całej reszcie systemu, więc
przełącznik służy do jej WYŁĄCZENIA. Kreator był jedynym miejscem startującym z `false`,
przy `DEFAULT true` w kolumnie (migracja `124`), `?? true` na stronie edycji i `?? true`
w mapperze `lib/events.ts` — czyli każdy nowy mecz powstawał bez rezerwy wbrew czterem
innym miejscom. Zgodność wszystkich czterech pilnuje `src/__tests__/listaRezerwowa.test.ts`.

**Włączony przełącznik „Bramkarze osobno" nie pokazuje już „Bez podziału na role"**
(ta sama data). `UstawieniaBramkarzy` ma trzy tryby, z których pierwszy (`gk: false`)
jest DOKŁADNIE stanem wyłączonego przełącznika. Wystawienie go w środku włączonego
dawało dwie kontrolki na jedno pytanie, umiejące się ze sobą nie zgadzać: przełącznik
mówił „dziel skład", a wybrany tryb „nie dziel". W kreatorze zostają więc dwa tryby,
które naprawdę dzielą skład — „Rozróżniaj, ale nie rezerwuj miejsc" i „Rezerwuj miejsca
dla bramkarzy" — a nagłówek „Bramkarze" znika, bo powtarzał tytuł przełącznika. Robi to
prop `wPrzelaczniku`; **strona edycji go nie podaje** i widzi wszystkie trzy tryby, bo
tam nie ma przełącznika i wszystkie ustawienia są równorzędne.

Pilnuje tego `e2e/kreator-bramkarze-i-rezerwa.klikalnosc.spec.ts` — sprawdzone w obie
strony: bez którejkolwiek z tych dwóch zmian testy padają.

`STEP_OF_FIELD` w `app/wydarzenia/nowe/page.tsx` mapuje pole → krok dla skoku steppera
przy błędzie: termin, BLIK, zniżka i bramkarze to krok 1, lokalizacja krok 2. To samo
rozbicie ma `validateStep()` w `lib/eventWizard.ts`.

**Błąd blokujący nie ma prawa być niewidoczny.** Zgłoszone wprost: „jak nie włączę
toggle z bramkarzami, to wewnątrz jest ukryty błąd" — „Dalej" na kroku 1 przestawało
reagować bez słowa wyjaśnienia. Mechanizm składał się z dwóch rzeczy:

1. **Reguła żądała decyzji, która stoi na ekranie — usunięta.** `validateGoalkeepers()`
   blokowała krok 1, gdy `goalkeepersEnabled` był `null`. Miało to sens, dopóki
   rozróżnianie bramkarzy było domyślnie WŁĄCZONE po cichu. Dziś to widoczny
   przełącznik, domyślnie wyłączony, a wyłączony przełącznik JEST decyzją — więc
   „Dalej" odmawiało, a obok świeciło „Zdecyduj, czy mecz rozróżnia bramkarzy" przy
   przełączniku ustawionym na NIE (zgłoszone wprost: „to też bez sensu błąd").
   Walidator jest skasowany razem z parametrami `sportMaBramkarza`/`goalkeepersEnabled`
   w `validateStep()`: nic tej decyzji nie potrzebowało — publikacja zapisuje
   `goalkeepersEnabled ?? false`, a strona edycji trzyma zwykły `boolean`. Przywracanie
   szkicu normalizuje `null` → `false` niezależnie od tego.
2. **Komunikat renderował się w niezamontowanej sekcji.** `OpcjaMeczu` montuje treść
   dopiero po włączeniu, więc błąd z `UstawieniaBramkarzy` nie istniał, dopóki ktoś
   nie włączył przełącznika — a „Dalej" i tak go respektowało. Dziś `OpcjaMeczu`
   przyjmuje `blad` i przy ZWINIĘTEJ sekcji pokazuje go w nagłówku, z
   `data-field-error` (czyli stepper do niego przewija). Reguła jest komponentu,
   nie tej jednej strony: dotyczy każdego przyszłego przełącznika.

Pilnuje tego `e2e/kreator-ukryty-blad.klikalnosc.spec.ts` — sprawdzone, że bez
poprawki (1) test pada, zatrzymując się na kroku 1.

**„Mecz płatny" bez podanej kwoty też jest błędem blokującym — od 2026-08-30.**
`platny` (`useState`) jest NIEZALEŻNY od `costPln > 0` — da się włączyć przełącznik
i zostawić pole ceny puste. `validatePayments()` (`lib/eventWizard.ts`) sprawdzała
do tej pory wyłącznie samą kwotę: przy `platny === true` i pustym `costPln` „Dalej"
przechodziło bez ostrzeżenia, a mecz zapisywał się jako darmowy mimo zaznaczonego
przełącznika. Funkcja przyjmuje dziś dodatkowy parametr `platny`; komunikat
`fieldErrors.costPln` renderuje się zarówno nad samym polem ceny, jak i w nagłówku
zwiniętej sekcji (ten sam wzorzec `blad` co przy bramkarzach wyżej). Pilnuje tego
`e2e/kreator-mecz-platny-bez-ceny.klikalnosc.spec.ts`.

**Nazwa etykiety pola ceny ujednolicona między kreatorem a edycją.** Kreator mówił
„Koszt od osoby (zł)", strona edycji „Koszt uczestnictwa (PLN)" — ta sama liczba,
dwie różne nazwy w dwóch miejscach tego samego przepływu. Edycja przyjęła etykietę
i podpowiedź „Przy komplecie (N os.) to X zł za cały obiekt" po kreatorze.

**Nazwa miejsca z pinezki własnej nie pokazuje już numeru domu — od 2026-08-30.**
`display_name` z Nominatim porządkuje segmenty od najbardziej szczegółowego —
pierwszy bywał numerem domu („19C, Stanisława Zwierzchowskiego, …”), nie nazwą
miejsca. Branie wprost pierwszego segmentu (`address.split(',')[0]`) dawało więc
mecz z „GDZIE: 19C" — zgłoszone wprost z sesji QA. `nazwaZAdresu()` (`lib/utils.ts`)
pomija bare-number segmenty (`isBareNumber`, ten sam test co w `eventLocation()`)
i bierze pierwszy, który realnie coś nazywa; używa go zarówno kreator, jak i strona
edycji.

**Krok 2 „Gdzie" — propozycja ostatniego boiska.** `lib/lastVenue.ts` zapamiętuje ostatnio
wybrany obiekt z katalogu (`localStorage`, klucz `bojo_ostatnie_boisko_v1`, TTL 60 dni,
guardowany `try/catch` jak `eventDraft.ts`). Zapis następuje po udanej publikacji,
**przed** `clearEventDraft()`, i tylko gdy miejsce pochodziło z katalogu — pinezka własna
nie ma `id`. Odczyt pokazuje chip „Ostatnio: «nazwa» — Użyj", widoczny wyłącznie gdy
miejsce nie jest jeszcze wybrane. To **propozycja, nie autowybór**: ciche ustawienie
miejsca meczu jest najgorszą możliwą pomyłką do przeoczenia.

**„Czas na decyzję z rezerwy" (krok 1, pod przełącznikiem rezerwy).** Pole stoi tuż pod
przełącznikiem „Lista rezerwowa" (presety 30 min – 24 h, gęściej w przedziale 30 min – 3 h, plus „Inny czas…"
z polem liczbowym w minutach, 15 min – 72 h; domyślnie 180 min = 3 h). Wcześniej
siedziało pod rozwijanym „Więcej opcji" — sekcja została w kodzie, ale nie ma dziś czego
pokazać i się nie renderuje. Od 2026-08-23 całość jest za przełącznikiem: mecz bez
rezerwy nie pokazuje ani tego pola, ani zdania o kolejce. Odwrócenie ustalenia O-11 audytu, patrz
[przeplyw-organizatora.md](./przeplyw-organizatora.md). Kolumna `events.reserve_claim_minutes`
(do migracji `118` — `reserve_claim_hours`, wyłącznie pełne godziny) opisana w
[domena.md](./domena.md#zwolnione-miejsce-oferta-nie-auto-awans). Obok steppera liczby miejsc stoi podpowiedź,
że graczy dopisuje się po utworzeniu meczu, na jego stronie, także bez konta.

**Krok 1 — kafelek „Wydarzenie cykliczne".** Obok pól daty/godziny, kafelek otwiera
`components/events/RecurringSettingsDialog.tsx` z dniem tygodnia wyliczonym z wybranej
daty (`lib/recurring.ts#dayOfWeekFromDate`) i suwakiem „otwieraj zapisy X dni przed
terminem" (dawniej „powiadamiaj" — od migracji `073` ta wartość steruje AUTOMATYCZNYM
tworzeniem kolejnego terminu, nie tylko treścią przypomnienia, więc minimum to 1, nie 0).
Kliknięcie aktywnego kafelka wyłącza cykliczność, ikona ołówka na aktywnym kafelku
ponownie otwiera modal. Ustawienia żyją wyłącznie w stanie kreatora — dopiero publikacja
meczu tworzy szablon w `recurring_events` (`createRecurringEvent`) i wiąże z nim ten
pierwszy mecz przez `events.recurring_event_id`. Po publikacji strona meczu pokazuje
jednorazowy link do panelu serii (`/cykliczne/{id}`) przez `?cykliczne=<id>`, a stały badge
„Stała gierka" (organizator, w pasku u góry strony meczu) prowadzi tam samo z powrotem.
Patrz „Serie wydarzeń cyklicznych" niżej.

**Krok 3 „Dla kogo" — widoczność, akceptacja, ekipa, tytuł, opis.** Sam ekran nie ma pól
wymaganych (`validateStep3` zwraca `{}`).

**Krok 3 — mecz w ramach grupy.** Wiersz pod kartami widoczności otwiera
`components/events/WybierzGrupeDialog.tsx` (bottom sheet od najmniejszych ekranów,
wyśrodkowana karta od `sm:`) z listą `getMyGroups()`. Wybór trafia do `createEvent`
jako `groupId`. Wiersz jest **osobny od widoczności**, bo przypisanie do grupy jest
wobec niej ortogonalne: mecz grupy bywa publiczny. Wejście `?group=` preselekcjonuje
ten sam stan. Ten sam dialog reużyty jest na stronie meczu (badge grupy w pasku u góry,
tylko dla organizatora) — patrz sekcja „Strona meczu" niżej.

„Załóż grupę"/„Załóż nową grupę" **nie prowadzi na `/grupy/nowe`** — otwiera drugi tryb
tego samego dialogu, okrojony formularz (nazwa + sport) w tym samym oknie. Nawigacja na
osobną trasę wyrzucała organizatora z kreatora w połowie wypełniania; po `createGroup()`
+ `getGroup()` dialog wywołuje ten sam `onWybierz(grupa)` co wybór z listy — zamyka się
i wraca dokładnie na krok 3, z nowo założoną grupą już wybraną.

**Powrót po publikacji.** „← Wróć" na stronie świeżo utworzonego meczu (`?utworzono=1`)
prowadzi na `/moje-gry`, nie `router.back()` — cofanie wracało do wypełnionego kreatora.
Wejścia z listy, mapy czy linku zachowują zwykłe „wstecz".

---

## Podsumowanie przed publikacją

„Opublikuj mecz →" na kroku 3 **nie publikuje** — otwiera okno **„Tak zobaczą to gracze"**
(`app/wydarzenia/nowe/PodsumowanieMeczu.tsx`, logika w `lib/eventSummary.ts`) z dwoma
przyciskami: „Popraw" i „Publikuję". Powód: data, miejsce, skład i cena są ustawiane na
krokach 1–2 i w chwili publikacji nie są widoczne, a mecz jest widoczny natychmiast po
utworzeniu i od razu idzie linkiem do ekipy — pomyłka w godzinie rozchodzi się szybciej,
niż da się ją poprawić.

Do 2026-08-23 to samo podsumowanie stało jako karta NA kroku 3, nad przyciskiem. Karta
zniknęła razem z wejściem okna: dwie kopie tej samej treści na jednej ścieżce znaczą,
że jedną z nich się przewija bez czytania. Okno stoi POZA `<form>` — każdy `<button>`
w formularzu bez `type` jest przyciskiem wysyłającym. Błąd walidacji i błąd zapisu
zamykają okno, żeby komunikat nie renderował się pod nim; kręciołek „Publikuję" zostaje
widoczny na czas zapisu.

Sześć wierszy — Co / Kiedy / Gdzie / Skład / Koszt / Kto widzi — każdy z przyciskiem
„Zmień" wołającym `attemptGoToStep`. Cofanie nigdy nie waliduje, więc skok jest bezpieczny
z każdego wiersza. Siódmy wiersz to **organizator**: „Wyświetlasz się jako X" z edycją
inline przez `updateDisplayName`; gdy konto nie ma **pełnej** nazwy własnej (imię
i nazwisko — `lib/profileName.ts#isPelneImie`, nie tylko dowolnie niepuste pole), pole
startuje rozwinięte.

Trzy ostrzeżenia, które **nie blokują** publikacji (krok 3 celowo nie ma pól wymaganych —
`validateStep3` zwraca `{}`): mecz jest dzisiaj, miejsce zostało bez nazwy (same
współrzędne po nieudanym reverse geocodingu), cena bez wybranej metody płatności.

---

## Po publikacji: „Mecz gotowy — wyślij link"

Kreator przekierowuje na `/wydarzenia/{id}?utworzono=1`, a strona meczu pokazuje
organizatorowi odrzucalny panel: „Wyślij link znajomym" (pełna szerokość, systemowy
share sheet — nie ogranicza się do członków żadnej grupy), pod nim „Kopiuj link" i „Zaproś
z grupy" (to już konkretnie funkcja Grupy — `InviteFromGroupDialog`), na dole jedno zdanie
o konsekwencji wybranej widoczności.

Parametr czytany jest z `window.location.search` w `useEffect`, **nie** przez
`useSearchParams()` — ten hak wymusza na trasie prerenderowanej bail-out do CSR i wywala
produkcyjny build (pułapka opisana w `AGENTS.md`). Zaraz po odczycie parametr znika
z adresu przez `history.replaceState`, więc odświeżenie nie pokazuje panelu drugi raz.

Gdy kreator utworzył razem z meczem szablon cykliczny (kafelek na kroku 1), doszedł
`?cykliczne=<id>` — czytany tym samym `useEffect` i zdejmowany tak samo. Panel dostaje
wtedy dodatkowy link „Ustawiłeś powtarzanie co tydzień — zarządzaj serią" do
`/cykliczne/{id}`.

**Jeden link i jeden tekst dla całej aplikacji** — `lib/eventShare.ts`. `eventUrl()` zwraca
adres kanoniczny `/wydarzenia/{id}`, a nie krótki `/d/{kod}`: `robots.ts` trzyma `/d/` poza
indeksowaniem, więc crawlery Facebooka i WhatsAppa nie pobiorą Open Graph i taki link leci
na czat bez podglądu. `eventShareText()` składa cztery linie (sport i tytuł / dzień, data,
zakres godzin / miejsce z adresem / liczba miejsc i cena), a `shareEvent()` przekazuje je
do arkusza systemowego razem z adresem — osobno od tekstu, żeby podgląd linku działał.

Trasa `/d/[code]` zostaje żywa dla linków już rozesłanych; zniknęła tylko jako drugi,
konkurencyjny przycisk „Udostępnij" na tej samej stronie.

---

## Serie wydarzeń cyklicznych

Od migracji `073` termin cykliczny to prawdziwa **seria**, nie zbiór niepowiązanych kopii.
Moduł jest dziś schowany za `SHOW_RECURRING = false` (patrz „Flagi funkcji" wyżej) —
kod, istniejące serie i ich strony zarządzania zostają nietknięte, chowają się wyłącznie
wejścia w nawigacji. Model, żeby nie duplikować schematu `events` w `recurring_events` —
pełny opis w [domena.md](./domena.md):

- **szablon** (`recurring_events`) niesie regułę powtarzania: dzień tygodnia, godzina,
  miejsce, limit miejsc, widoczność i wyprzedzenie (`notify_days_before`),
- **ostatni termin serii** jest żywym wzorcem reszty ustawień (cena, metody płatności,
  bramkarze, akceptacja zapisów, grupa) — nowy termin dziedziczy je z niego, nie z ubogiego
  szablonu. To naprawia dawny błąd, w którym płatna gierka odradzała się jako darmowa.

**Auto-tworzenie.** `pg_cron` (jeśli włączony w Supabase) odpala co godzinę
`utworz_nalezne_terminy_serii()`, która dla każdego aktywnego szablonu tworzy należny
termin — gdy jest w zasięgu `notify_days_before` i jeszcze nie istnieje. Bez `pg_cron`
funkcja działa tylko wywołana ręcznie z SQL Editora albo przez przycisk „Utwórz termin"
na `/cykliczne/[id]` (`spawnEventInstance()` w `lib/recurring.ts` woła to samo RPC —
`utworz_termin_serii` — więc ręczne i automatyczne tworzenie dają identyczny wynik).
Uczestnicy poprzedniego terminu dostają wtedy powiadomienie „Nowy termin stałej gierki".

**Edycja jednego meczu z serii.** Zmiana godziny w modalu „Zmień termin" albo zapis
formularza edycji (gdy seria ma więcej niż jeden termin) pyta o zakres —
`components/events/ZakresEdycjiSerii.tsx`, logika w `lib/series.ts`:

| Zakres | Co obejmuje |
|---|---|
| Tylko to wydarzenie | sam edytowany termin |
| To i przyszłe | ten termin + terminy z datą ≥ dzisiaj + szablon (żeby kolejne dziedziczyły) |
| Cała seria | wszystkie terminy, także rozegrane, + szablon |

**Data nigdy nie idzie zbiorczo** (`lib/series.ts#POLA_POZA_ZAKRESEM`) — niezależnie od
zakresu zmienia się wyłącznie w edytowanym terminie. Przesunięcie całej gierki na inny
dzień tygodnia to zmiana reguły, czyli edycja szablonu, nie zbiorcza zmiana terminów.

**Edycja szablonu** — `/cykliczne/[id]/edytuj` (dawniej zaślepka „w przygotowaniu").
Pola pokrywają się z `/cykliczne/nowe`: sport, miejsce, dzień tygodnia, godzina, limit,
tytuł/opis, widoczność, wyprzedzenie — bo szablon opisuje regułę, nie komplet ustawień
meczu (cena i płatności edytuje się na konkretnym terminie, z pytaniem o zakres wyżej).

---

## Układ `/moje-gry`

Cztery zakładki w URL (`?tab=`): **Nadchodzące** (`nadchodzace`) / **Historia**
(`historia`) / **Zaproszenia** (`zaproszenia`) / **Obserwowane** (`obserwowane`).
`SLUG_TO_TAB`/`TAB_TO_SLUG` w `app/moje-gry/page.tsx` — nieznany `?tab=` cicho wraca do
„Nadchodzące", nie rzuca błędem. Pasek zakładek scrolluje się w bok (`overflow-x-auto`
z ukrytym scrollbarem, `shrink-0` na każdym przycisku) — cztery zakładki + dwie plakietki
liczników nie mieściły się zawsze na 360px.

**Swipe w bok przełącza zakładki** — tu i na `/grupy/[id]` oraz `/wydarzenia/[id]`
(patrz te sekcje niżej), ten sam hak `useSwipeZakladek()` (`lib/useSwipeZakladek.ts`).
Tylko dotyk, mysz na desktopie bez zmian (kolidowałaby z zaznaczaniem tekstu i z
przeciąganiem graczy między drużynami). Bez zawijania — swipe w prawo na pierwszej
zakładce i w lewo na ostatniej nic nie robi, kraniec jest krańcem. Próg 60 px, limit
czasu 800 ms (wolne przeciąganie to przewijanie strony, nie gest) i wymóg wyraźnej
przewagi poziomej nad pionową — te same reguły wszędzie, bo logika (`nastepnaZakladka()`)
jest jedna, czysta funkcja. Gest wyłącza się sam nad elementem przewijanym w poziomie
(pasek zakładek, żeby nie odbierać mu własnego przewijania) i jawnie, przez atrybut
`data-bez-swipe`, tam gdzie już jest inny gest dotykowy: podział na drużyny (własny
swipe „przypisz do drużyny" plus `@dnd-kit`) i pole tekstowe rozmowy.

**`/moje-gry` JEST pulpitem zalogowanego — drugiego nie ma** (2026-08-23). Wcześniej
`/` renderowało dla zalogowanego osobny pulpit (`AppHome.tsx`) z tymi samymi sekcjami
(`InvitesSection`, `NextMatchCard`, `MyMatchesSection`), co ta zakładka. Dwa ekrany na
to samo pytanie rozjeżdżały się same z siebie, a ten na `/` był w dodatku poza dolną
nawigacją — pasek prowadzi na `/moje-gry`, `/mapa`, `/rozmowy`, `/grupy` i do kreatora,
więc na `/` wchodziło się wyłącznie przez logo. Wygrał ten z paska: `AppHome.tsx`
i `useDashboardData.ts` **nie istnieją**, a `HomeSwitch` przekierowuje zalogowanego na
`/moje-gry`. Landing na `/` zostaje bez zmian dla wylogowanych i dla robotów (nie mają
ciasteczka sesji), więc SEO strony głównej się nie rusza.

### Zakładka „Nadchodzące" to JEDNA lista moich meczów, od najbliższego

Do 2026-08-23 stało tu **siedem sekcji**, z czego **trzy kroiły tę samą listę**
`upcoming`: „Czekają na Twoją decyzję", „Brakuje graczy" i właściwa lista meczów. Mecz
organizowany, bez kompletu i z prośbą o dołączenie pokazywał się przez to na jednym
ekranie **trzy razy**, a zanim dojechało się do własnych meczów, trzeba było minąć trzy
nagłówki.

Reguła, która to porządkuje:

- **fakt o meczu** (prośby o dołączenie, brakujący skład, nieprzeczytane) → **plakietka
  na karcie**, mecz występuje raz;
- **osobną sekcję** dostaje wyłącznie to, czego na tej liście NIE MA — zaproszenie
  (jeszcze nie mój mecz) i mecz ekipy, do którego nie dołączyłem.

**Kolejność i podział wg RELACJI do meczu** (2026-08-24, zgłoszone wprost:
„najbardziej intuicyjny podział"): `InvitesSection` (limit 3, link do zakładki
„Zaproszenia") → **Grasz** → **Organizujesz** → **Rezerwa
i oczekujące** → `GroupGamesSection` („Możesz dołączyć").

Trzy środkowe sekcje to ten sam `MyMatchesSection` z podmienianym `title`, karmiony
rozłącznymi kubełkami liczonymi z `playing` (czyli `upcoming` bez obserwowanych — te
mają własną zakładkę):

| Sekcja | Warunek | Po co osobno |
|---|---|---|
| **Grasz** | `status === 'playing'` | to, o co pyta się najczęściej; obejmuje też mecze, które organizuję I gram |
| **Organizujesz** | `isOrganizer && status !== 'playing'` | mój mecz, w którym sam nie gram — inna rola, inne pytania |
| **Rezerwa i oczekujące** | reszta (`!isOrganizer`, status ≠ `playing`) | rezerwa i czekanie na akceptację na CUDZYM meczu; „Grasz" byłoby nieprawdą. Renderuje się tylko, gdy jest co pokazać — u większości nie pojawi się nigdy |

Kubełki są rozłączne i razem pokrywają całe `playing`, więc żaden mecz nie może wypaść
z listy przy zmianie statusu.

**„Grasz" jest jedyną z trzech sekcją, która NIE znika przy pustej liście** (2026-08-28,
zgłoszone wprost: „niech będzie na stałe «grasz»"). `MyMatchesSection` dostał opcjonalny
prop `emptyState` — gdy podany, nagłówek zostaje widoczny, a zamiast kart renderuje się
przekazana treść zamiast `null`. Na `/moje-gry` to `PustyStanMeczow` (patrz niżej):
„Organizujesz" i „Rezerwa i oczekujące" propa nie dostają, więc nadal chowają się same,
gdy nie mają czego pokazać.

**Karty-hero „NAJBLIŻSZY MECZ" nie ma** (zgłoszone wprost: „bez sensu jest ten jeden
osobny najbliższy mecz"). Przy podziale na „Grasz"/„Organizujesz" pierwszy element
pierwszej sekcji I TAK jest meczem najbliższym w czasie — `splitMyEvents` sortuje
rosnąco po terminie — więc osobny nagłówek nad nim powtarzał to, co lista mówi sama.
Z dawnego `NextMatchCard` został wyłącznie pusty stan, jako `PustyStanMeczow` — dziś
renderowany jako `emptyState` sekcji „Grasz" (patrz wyżej), gdy `graszWidoczne` jest puste.

`PendingRequestsSection` i `NeedsPlayersSection` **nie istnieją**. Ich rolę przejęła
plakietka `odznakiOrganizatora` na `EventBrowseCard` — „N próśb" (niebieska, bo
AGENTS.md rezerwuje niebieski dla „wymaga akceptacji uczestnictwa"; wypiera ogólne
„Wymaga akceptacji", więc rząd tytułu niesie tyle samo plakietek co zawsze). Opt-in
propem, bo poza `/moje-gry` ta liczba nie ma komu służyć.

Plakietki „brakuje N" **nie ma i nie było jej sensu dokładać**: karta mówi to samo już
trzy razy — paskiem postępu, licznikiem „7/10 graczy" i bursztynową plakietką
„3 wolne miejsca" (zgłoszone wprost jako zbędny szary duplikat).

**Tytuł karty ma `line-clamp-2`, nie `truncate`.** Plakietki obok są `shrink-0`, więc
na 390 px tytułowi zostawało ~150 px i „Czwartkowa gierka" wychodziło jako
„Czwartkowa …". Dwie linie mieszczą normalną nazwę w całości, a bardzo długą ucinają
dopiero wtedy, gdy naprawdę nie ma jej gdzie zmieścić.

**Cała karta zieleni się, gdy naprawdę gram** (`bg-primary-50/60` + `ring-primary-200`)
— sama plakietka w rogu wymagała szukania wzrokiem, a tło i obwódka odpowiadają „to jest
moje" z odległości ręki. Wyłącznie `status === 'playing'`: nie rezerwa, nie oczekiwanie
i nie „organizuję, ale nie gram". Zieleń ma znaczyć DOKŁADNIE jedno — jesteś w składzie;
rozmyta na „prawie gram" przestałaby cokolwiek znaczyć. Lewa krawędź zostaje w kolorze
SPORTU, bo to inna informacja.

**„Grasz ✓" jest WYPEŁNIONE** (`bg-primary-700 text-white`), a pozostałe stany
(`Rezerwa`, `Obserwujesz`, `Czeka na akceptację`) zostają bladymi obwódkami — celowa
nierówność. Na liście własnych meczów pytanie brzmi „w których naprawdę gram", a blada
plakietka w prawym dolnym rogu odpowiadała na nie dopiero po wpatrzeniu się (zgłoszone
wprost). Zieleń, nie różowy/niebieski/pomarańczowy: udział w składzie to **stan**, tak
samo jak zielony licznik nadchodzących meczów na ikonie „Mecze".

Filtr nieprzeczytanych miał wcześniej **trzy miejsca postoju** (nagłówek „Brakuje
graczy" → „Najbliższy mecz" → pusty wiersz jako ostateczność), bo doczepiał się do
sekcji, która bywała pusta. Zniknęły razem z tamtą sekcją: filtry mają jeden, stały
rząd.

**`GroupGamesSection` nosi nagłówek „Możesz dołączyć"** z podtytułem „Mecze Twojej
ekipy, w których jeszcze Cię nie ma". Dawne „Mecze Twoich grup" brzmiało jak kolejna
lista własnych gier i zlewało się z sekcją wyżej — a to jedyne miejsce na tej stronie,
gdzie mecz jest CUDZY i można do niego dołączyć (zgłoszone wprost).

**Przyszła tu z kasowanego pulpitu jako JEDYNA sekcja stamtąd** —
bo jako jedyna niosła treść, której nie ma nigdzie indziej: mecze mojej ekipy, do
których **jeszcze nie dołączyłem** (`rel.status === 'none' && !rel.isOrganizer`).
Pozostałe listy na tej stronie pokazują mecze, w których już jestem, więc bez tego
przeniesienia „moja ekipa gra, a mnie nie ma" nie miałoby ani jednego miejsca w apce.
Reszta sekcji dawnego pulpitu miała już swoje miejsca i została skasowana: otwarte
mecze to zakładka „Szukaj" (`/mapa?gry=1`), obserwowane i historia to zakładki obok,
ekipy to `/grupy`, a „Jak to działa" i FAQ mają własne strony (`/jak-dziala-bojo`,
`/faq`). Relacja do meczu ekipy liczy się z `items` (czyli z `getMyParticipatedEvents`,
które bierze wszystkie moje wiersze `event_participants` plus mecze, które organizuję)
— bez osobnego zapytania o mapę uczestnictwa.

**Zakładka „Obserwowane"** to osobna lista `EventBrowseCard` (wzorem „Historii").
Obserwowane mecze mają **jedno** miejsce, nie dwa: wcześniej `ObservingSection`
renderowała się też inline pod „Nadchodzące", co dublowało tę samą informację na tej
samej stronie. Sam komponent `ObservingSection` zniknął razem z pulpitem na `/`.

`MyMatchesSection` dostaje tu `limit={null} href={null}` — pełna lista bez obcięcia do
2 pozycji i bez linku „Wszystkie", który wracałby na tę samą stronę. (Te parametry są
pozostałością po skróconym wariancie z dawnego pulpitu na `/`; zostają, bo `/grupy/[id]`
nadal korzysta ze skracania.)

Pusty stan „Nadchodzące" to `PustyStanMeczow` („Nie masz zaplanowanych gier" +
„Stwórz mecz" / „Znajdź grę"), renderowany, gdy `playing` jest puste. Odpowiada na inne
pytanie niż lista — „nie mam nic, co teraz?" — i daje dwie drogi wyjścia zamiast pustki.

Nagłówek „Twoje mecze" i przycisk „+ Nowy mecz" zniknęły ze strony — mecz tworzy się
z FAB-a (`+`) w dolnej nawigacji, dostępnego z każdego ekranu na mobile.

**Zakładka „Historia" ma na górze sekcję „Do rozliczenia"** (`DoRozliczeniaSection`,
`components/home/dashboard/DashboardSections.tsx`) — rozegrane, płatne mecze organizatora,
w których ktoś ze składu nie oddał pieniędzy. Selektor `doRozliczenia()`
(`lib/myEvents.ts`) filtruje i sortuje od najświeższego dane, które `getMyParticipatedEvents()`
już zwraca (`unpaidCount` liczony przez `toEvent()`) — zero nowego zapytania. Bez tej
sekcji zakładka Historia nie odróżniała meczu w pełni rozliczonego od meczu z zaległością —
oba wyglądały identycznie na płaskiej liście.

---

## Karta „Po meczu"

**Problem.** Po starcie meczu + 30 minut (`resultsAvailable`) strona meczu pokazywała
organizatorowi wyłącznie jedną bursztynową linijkę „wpisz wynik". Nic nie przypominało
o rozliczeniu ani o zaproszeniu gości bez konta do Bojo — organizator musiał sam
wywnioskować, co jeszcze zostało. Skutek widoczny w danych: większość rozegranych meczów
nie ma wpisanego wyniku, sporo nie ma domkniętego rozliczenia, a wpisy gości prawie nigdy
nie są przejmowane.

**Rozwiązanie.** `components/events/PoMeczuCard.tsx`, renderowana w `EventDetailClient.tsx`
pod warunkiem `tab === 'sklad' && (isOwner || canManageSquad || canManagePayments) &&
resultsAvailable && !isCancelled` (drugi i trzeci człon warunku uprawnień: delegaci, patrz
[„Uprawnienia (delegowanie)"](#uprawnienia-delegowanie) niżej). Zbiera do trzech zadań —
każde renderowane tylko, gdy dotyczy tego meczu:

| Zadanie | Warunek renderowania | „Zrobione" |
|---|---|---|
| Rozlicz ekipę | `event.costGrosze > 0` | nikt nie ma `hasPaid === false` wśród `regulars` |
| Wpisz wynik | `event.trackResults` | `matchResult != null` |
| Zaproś gości do Bojo | są nieprzejęci goście w składzie | znika, gdy `0` |

Karta żyje **wyłącznie w zakładce Skład** — świadomie NIE jest uniwersalna, bo dubluje się
z jej własną treścią (roster, zarządzanie graczami); na pozostałych zakładkach znika razem
ze zmianą zakładki (patrz „Zakładki na `/wydarzenia/[id]`" niżej). Zadania, które kiedyś
przewijały do sekcji na tej samej stronie, dziś żyją na osobnych zakładkach — samo
`scrollIntoView`/`href="#..."` by nie trafiło. Klik na „Wpisz wynik" woła `onWpiszWynik` →
`goToTab('wynik')`. Klik na
„Rozlicz ekipę" nadal woła `handleWyslijRozliczenie()` (generuje tekst i otwiera arkusz
udostępniania — nie przełącza zakładki, bo nie musi). Zadanie „Zaproś do Bojo" łączy oba:
`handleZaprosGosciaPoMeczu()` najpierw `goToTab('sklad')` i `setRosterOpen(true)` (skład po
meczu jest domyślnie zwinięty do awatarów), dopiero potem `scrollIntoView` po re-renderze
(`requestAnimationFrame`) — bez przełączenia zakładki scroll trafiał w pustkę, gdy karta
była widoczna z innej zakładki niż Skład.

**Wiersz zadania pokazuje status i samą strzałkę, nie powtarza etykiety akcji.** Pierwsza
wersja renderowała obok statusu jeszcze pełną etykietę akcji („Wyślij rozliczenie ›",
„Wpisz wynik ›") — na wąskim telefonie to zabierało większość szerokości wiersza i status
(np. „4 osoby jeszcze nie oddały") zawijał się do dwóch linii, mimo widocznego luzu wokół
(zgłoszone wprost, ze zrzutem). Cały wiersz jest już jednym przyciskiem (`onClick={z.onClick}`
na całej szerokości), więc etykieta akcji jest zbędna wizualnie — została wyłącznie
w `aria-label` przycisku (`"{etykieta}. {akcjaLabel}"`), dla czytników ekranu.

Pod zadaniami stoi zawsze wiersz do trzech przycisków: **„Nieobecni"** (widoczny
tylko dla `isOwner || canManageSquad` — otwiera modal „Kto nie przyszedł", patrz
[„Oznaczanie nieobecności"](#oznaczanie-nieobecnosci) niżej), **„Zapłacili"**/„Cofnij"
(widoczny tylko gdy `event.costGrosze > 0` i skład nie jest pusty — ta sama akcja
`handleWszyscyOddali` co przycisk „Wszyscy oddali" w panelu „Podział kosztów" wyżej,
sekcja „Funkcje meczu") i **„Powtórz"** (zawsze). Trzy przyciski w jednej linii na
360 px wymagają węższego wariantu niż domyślny przycisk apki I krótszych etykiet niż
pełne wersje gdzie indziej w apce — samo zmniejszenie czcionki nie wystarczało (zgłoszone
wprost, ze zrzutem: nawet przy najmniejszej czytelnej czcionce „Kto nie przyszedł" ucinało
się do „Kto nie p..."). `PRZYCISK_CLS` w `PoMeczuCard.tsx`: czcionka 10 px, wąski padding,
te same ikony co pełne wersje przycisku gdzie indziej. Gdy wszystkie zadania są zrobione
(albo mecz żadnego nie śledzi), karta zwija się do jednej linii tekstu nad tym samym
wierszem przycisków — łącznie z „Zapłacili", który wtedy pokazuje „Cofnij".

„Powtórz" pojawia się teraz w dwóch miejscach (tu, skrócone z powodu ciasnoty, i pełne
„Powtórz mecz (skopiuj)" w „Zarządzaj wydarzeniem"), ale to ta sama akcja pod tą samą
ikoną (`handleOpenRepeat`) — nie dwie różne rzeczy pod wspólną nazwą jak w `O-20` z audytu
przepływu organizatora.

**Okno „Powtórz mecz" ma domyślną datę i zachowuje długość meczu.** Otwierało się dotąd
z pustym polem i zablokowanym przyciskiem. `domyslnyTerminPowtorki()` (`lib/recurring.ts`)
liczy najbliższy przyszły termin tego samego dnia tygodnia co pierwowzór — ta sama
matematyka, którą `nastepnyTermin()` już robi dla serii cyklicznych. Pole zostaje
edytowalne.

Modal ma teraz też pole „Koniec" obok „Godziny" — wcześniej zmiana samej godziny startu
(np. z 18:00 na 10:00) kopiowała `end_time` źródłowego meczu dosłownie, co potrafiło dać
kopię „trwającą" 690 minut. Zmiana startu przesuwa koniec o tę samą deltę (zachowuje
długość), zmiana końca nigdy nie rusza startu — dokładnie ten sam wzorzec co w modalu
„Zmień termin" (`toMinutes`/`fromMinutes`, wydzielone do `lib/time.ts`).

---

## Oznaczanie nieobecności

**Problem.** Organizator nie miał jak oznaczyć, że ktoś zapisany na mecz się nie pojawił —
jedyną drogą było ręczne zapamiętanie i unikanie tej osoby przy kolejnym zapraszaniu.
Infrastruktura istniała od migracji `011` (tabela `player_reports`, `get_player_stats()`
już liczyła `no_shows`), ale nic w aplikacji do niej nie zapisywało.

**Rozwiązanie.** Przycisk „Nieobecni" w karcie „Po meczu" (widoczny dla
`isOwner || canManageSquad`) otwiera dedykowany modal „Kto nie przyszedł" z listą
`regulars` i przełącznikiem
przy każdej osobie (`lib/attendance.ts`: `getNieobecni`/`oznaczNieobecnosc`/
`cofnijNieobecnosc`). **Świadomie osobny modal, nie kontrolka w głównym widoku składu** —
oznaczenia nie mają wpływać na to, co widzi reszta uczestników na stronie meczu.

Zapis idzie do `player_reports` (`report_type = 'nie_przyszedl'`) i od razu wpływa na
publiczny profil gracza (`/gracz/[id]`) — pasek frekwencji i plakietka „Niezawodny", patrz
[docs/domena.md § Reputacja](./domena.md#reputacja--dwa-niezależne-mechanizmy-nie-jeden).
Migracja `091` dodaje unikalny indeks (chroni przed podwójnym zawyżeniem licznika) i
zaostrza RLS — INSERT/DELETE/SELECT na `player_reports` wymaga teraz organizatora albo
delegata z `can_manage_squad` (wcześniej: dowolny zalogowany użytkownik).

Wiadomość rozliczeniowa (`tekstRozliczenia()`, `lib/settlementShare.ts`) dopisuje przy
zalegającym oznaczonym jako nieobecny adnotację „(nie przyszedł/-a)" — ekipa widzi kontekst
długu, nie samą kwotę.

---

## Czy gramy? — próg minimum, otwarcie dla okolicy

**Problem.** Ekipy grające co tydzień odtwarzały ręcznie w wątku na WhatsAppie
dokładnie ten model, który Bojo już ma — a całą resztą wątku była praca biurowa
organizatora: „Brakuje nam 1go? Dobrze liczę?", „10 to minimum żeby zagrać", „Może
jeszcze ktoś się decyduje?".

**Rozwiązanie.** `CzyGramyPanel.tsx` (`components/events/`), widoczny na stronie meczu
wyłącznie dla organizatora/delegata z `canManageSquad`, przed startem meczu. Dwa
niezależne bloki, każdy renderuje się tylko wtedy, gdy ma o czym mówić:

1. **Werdykt progu** — **ukryte za `SHOW_MIN_PLAYERS_THRESHOLD`** (wyłączona 2026-08-21,
   produktowa decyzja: nie chcemy tej funkcji w aplikacji). Gdy odkryta, działa tak: gdy
   organizator ustawił `min_players` (kompaktowy toggle „+ Ustaw minimum, żeby gra się
   odbyła" w `EventCapacityFields.tsx`, obok stepperu liczby miejsc, wspólny dla kreatora
   i edycji): „Gramy ✓ 11 z 10 minimum" albo „Brakuje 2 do minimum — 8/10". Liczy to jedna
   czysta funkcja, `werdyktGry()` (`lib/events.ts`) — ten sam werdykt na stronie meczu
   i w linijce pod „Najbliższym meczem" na `/grupy/[id]`. Flaga chowa wyłącznie toggle
   i werdykt; `events.min_players`, `werdyktGry()`, RPC `zapytaj_milczacych()` i wyzwalacz
   `powiadom_o_progu_gry()` (migracja `097`) zostają w bazie i w kodzie nietknięte —
   istniejące mecze z ustawionym progiem po prostu przestają go pokazywać.
2. **„Otwórz dla okolicy"** — dla prywatnego meczu z wolnymi miejscami, niezależnie od
   tego, czy jest przypięty do grupy. Woła istniejący `handleSetVisibility('public')`
   (ten sam kod co ręczny przełącznik widoczności), z potwierdzeniem tłumaczącym, co się
   stanie. To jedyna rzecz w tym panelu, której żaden komunikator nie potrafi: zamienia
   prywatny brak ludzi w publiczną podaż na `/wydarzenia`.

**„Nie gram"** (`NieGramButton.tsx`) — osobny, mały przycisk dla członka ekipy, który
jeszcze nie dołączył do meczu przypiętego do jego grupy. Zapisuje wiersz w
`event_declines` (migracja `097`) — **nie** w `player_reports`, które karmi
„Niezawodność" wyłącznie ze zgłoszeń nieobecności na mecz, na który ktoś się zapisał;
wcześniejsza odmowa jest zachowaniem dobrym. Da się cofnąć („Nie gram — cofnij").

**Panel miał wcześniej trzeci blok, „Nie odpowiedziało: N"** (kto z ekipy jeszcze nie
zareagował na mecz, z przyciskami „Zapytaj w Bojo"/„Tekst na WhatsAppa") — usunięty na
wyraźną prośbę: zamiast ścigać milczących, prostszą odpowiedzią na „brakuje ludzi" jest
„Otwórz dla okolicy" powyżej. `lib/eventResponses.ts` (`ktoMilczy()`, `zapytajMilczacych()`)
i `tekstZaczepki()` z `lib/eventShare.ts` usunięte jako martwy kod — nic już ich nie
importuje. RPC `zapytaj_milczacych()` i typ powiadomienia `pytanie_o_udzial` (migracja
`097`) **zostają w bazie** nietknięte (migracji się nie kasuje po wdrożeniu), po prostu
nic już ich nie wywołuje — `lib/notifications.ts` nadal umie wyświetlić taki wpis, gdyby
kiedyś powstał, ale od tej zmiany żaden nie powstanie.

**Świadomie NIE zbudowane** (patrz `docs/domena.md § Czy gramy`): automatyczny zapis
milczących do składu, powiadomienie o każdej pojedynczej odpowiedzi, próg minimum na
poziomie szablonu serii cyklicznej.

---

## Uprawnienia (delegowanie)

**Problem.** Organizator, który sam nie gra albo dzieli się obowiązkami prowadzenia meczu
z kimś z ekipy, nie miał jak przekazać części swoich praw — jedyną opcją było dawanie
komuś danych logowania do własnego konta.

**Rozwiązanie.** Panel „Zarządzaj wydarzeniem" → „Uprawnienia" (wyłącznie dla prawdziwego
organizatora) otwiera modal z listą kandydatów — uczestnicy meczu z kontem plus, jeśli
mecz jest przypięty do grupy, jej członkowie (`lib/eventDelegates.ts`:
`getDelegateCandidates`). Dla każdego trzy niezależne przełączniki: „Może edytować jak
organizator", „Dzieli składy i wpisuje wyniki", „Oznacza rozliczenia i BLIK" — zapisywane
per-osoba od razu przy zmianie, bez zbiorczego „Zapisz".

Pełny model uprawnień, w tym dlaczego to trzy osobne przełączniki i jak są egzekwowane w
RLS (nie tylko w UI) → [docs/domena.md § Delegowanie uprawnień organizatora](./domena.md#delegowanie-uprawnień-organizatora).

Delegat z `can_manage_payments` bez `can_edit` nie ma dostępu do pełnego formularza
edycji (RLS go tam nie przepuszcza) — dostaje lekki, samodzielny panel „Sposoby
płatności" obok karty „Podział kosztów" na stronie meczu, zapisujący przez RPC
`event_set_payment_settings()`.

**Świadome ograniczenie zakresu**: delegat zarządza meczem wyłącznie ze strony
`/wydarzenia/[id]`. Dashboard, listy „Moje mecze" (poza jednym wyjątkiem dla delegatów
z `can_edit`, żeby mecz w ogóle im się pokazał, gdy sami nie grają) i etykieta
„organizator" w historii gracza nie uwzględniają delegacji w tej fazie.

---

## Strony treści — `/jak-dziala-bojo`, `/dlaczego-bojo`, `/faq`

Trzy statyczne strony serwerowe pod SEO/GEO/AEO, dodane pod strategię „pozyskiwanie
organizatorów" ([strategia.md §0](./strategia.md)). Wspólna powłoka
`components/tresc/StronaTresci.tsx` (+ `SekcjaTresci.tsx`, `SpisTresci.tsx` jako
`<details>`), treść jako dane w `frontend/src/content/*.ts` — testowalna bez renderowania,
wzorem `components/home/landing/content.ts`.

| Trasa | Co zawiera | Źródło treści |
|---|---|---|
| `/jak-dziala-bojo` | cała ścieżka od kreatora po rozliczenie, w tym co dokładnie widzi zaproszony gracz, że dołączenie nie wymaga konta i co zrobić, gdy brakuje 1-2 graczy do składu | `content/jakDziala.ts` |
| `/dlaczego-bojo` | tabela porównawcza z grupą FB/WhatsApp, argument na „moi gracze nie założą konta" | `content/dlaczego.ts` |
| `/faq` | 36 pytań w sześciu kategoriach | `content/faq.ts` |

**FAQ ma jedno źródło.** `content/faq.ts` eksportuje `FAQ` (wszystko, renderowane na
`/faq`) i `FAQ_LANDING` (osiem pozycji oznaczonych `naLandingu: true`, pokazywane na
stronie głównej). `components/home/landing/content.ts` re-eksportuje
`FAQ_LANDING as LANDING_FAQ` zamiast trzymać kopię — `LandingFaq.tsx` i
`landingContent.test.ts` nie wiedzą, że coś się zmieniło. Cztery miejsca renderują
`faqJsonLd()` (`lib/structuredData.ts`) nad dokładnie tą treścią, którą pokazują —
widoczny tekst i schema nie mają jak się rozjechać: landing (`LANDING_FAQ`), `/faq`
(`FAQ` w całości, pogrupowane po kategorii), `/jak-dziala-bojo` i `/dlaczego-bojo`
(każda strona swój tematyczny podzbiór — organizator/pieniądze na jednej, podstawy/konto
na drugiej, dobrany ręcznie po treści pytania, żeby się nie dublował między stronami).
Accordion `<details>`/`ChevronDown` żyje w jednym miejscu — `components/tresc/MiniFaq.tsx`
— zamiast być kopiowany na każdej stronie z osobna.

`/jak-dziala-bojo` emituje dodatkowo `HowTo` (`lib/structuredData.ts#howToJsonLd`) nad
trzema krokami sekcji „zakładasz-mecz” — treść kroków to te same akapity, które widać na
stronie, nie osobno pisany tekst. `siteJsonLd()` (renderowany raz, w `layout.tsx`) niesie
od teraz też węzeł `SoftwareApplication` z `featureList` — lista funkcji musi zostać
zsynchronizowana z tabelą flag niżej, jeśli któraś z wymienionych funkcji trafi za flagę.

`eventJsonLd()` (`lib/structuredData.ts`, wywoływane z `app/wydarzenia/[id]/page.tsx`)
dodaje `location.geo` (`GeoCoordinates`), gdy mecz ma zapisane `lat`/`lng` — kolumny
istnieją na `events` od `002_events_and_auth.sql` i są wypełniane przy każdym insertcie,
niezależnie od tego, czy lokalizacja to boisko z katalogu czy przypięta pinezka, więc nie
trzeba joina do `fields`. `/jak-dziala-bojo` i `/dlaczego-bojo` linkują teraz w swoich
CTA-boxach do `/mapa`, a `/boiska/[sport]` linkuje z powrotem do `/jak-dziala-bojo` —
wcześniej strona treści i katalog boisk nie odsyłały do siebie nawzajem.

**Uczciwość treści pilnowana testem.** `content/zakazaneFrazy.ts` trzyma dwie listy fraz:
`ZAKAZANE_NA_LANDINGU` (landing nie wspomina ich w ogóle — nawet przecząco, bo samo
przeczenie na czysto sprzedażowej stronie brzmi jak reklama) i `ZAKAZANE_WSZEDZIE` (strony
treści mogą o nich pisać wyłącznie w zdaniu, które je zaprzecza). `landingContent.test.ts`
i `tresciStron.test.ts` sprawdzają odpowiednio każdą z nich, plus dwa testy pozytywne: każda
wzmianka o powiadomieniach mówi „w aplikacji"/„pod dzwonkiem", każda wzmianka o SMS-ie mówi,
że Bojo go nie wysyła.

**Nawigacja do stron treści:** link „Zobacz krok po kroku…" pod „Trzy kroki do składu"
(`LandingHowItWorks.tsx`) do `/jak-dziala-bojo`; link „Wszystkie pytania i odpowiedzi"
pod FAQ landingu (`LandingFaq.tsx`) do `/faq`; `SiteFooter.tsx` ma teraz dwie grupy
linków („Produkt", „Bojo") zamiast jednej płaskiej listy, z czterema nowymi stronami
w grupie „Bojo". Główna nawigacja (`Header.tsx`) zostaje bez zmian — dwie pozycje
(„Znajdź grę", „Mapa boisk") to świadomy wybór, dokładanie stron treści by je rozmyło.

---

## Strona `/[sport]/[miasto]` — Poznań, Warszawa, Kraków

Landing pod SEO/GEO ([strategia.md](./strategia.md)), osobny wzorzec od katalogu boisk:
`/boiska/[sport]` odpowiada „gdzie jest boisko", `/[sport]/[miasto]` — „dołącz do
meczu albo znajdź brakujących graczy" w konkretnym mieście. Cztery sporty (`FOCUS_SPORTS`
z `lib/sports.ts`, te same co w kreatorze meczu) × trzy miasta = dwanaście stron, generowane
statycznie (`generateStaticParams`) z `revalidate = 3600` — bo zbiór jest z góry
ograniczony, w przeciwieństwie do `/boiska/[sport]`, który celowo renderuje się na żądanie
(katalog rośnie z każdym importem, patrz AGENTS.md).

**Trasa siedzi na PIERWSZYM segmencie ścieżki, więc ma `dynamicParams = false`.** Bez tego
`/[sport]/[miasto]` łapałby każdy nieznany adres dwuczłonowy i renderował go na żądanie;
z tym istnieją wyłącznie kombinacje z `generateStaticParams`, a reszta dostaje 404.
Istniejące trasy są bezpieczne, bo w App Routerze segment statyczny ma pierwszeństwo nad
dynamicznym — `/boiska/…`, `/wydarzenia/…`, `/grupy/…` wygrywają z `[sport]`. W `src/app`
nie ma żadnej innej trasy z dynamicznym pierwszym segmentem i **nie wolno takiej dodać**
bez rozstrzygnięcia kolizji.

Strony mieszkały wcześniej pod `/graj/[sport]/[miasto]`; `next.config.mjs` trzyma trwałe
przekierowanie 301 ze starych adresów, bo były w sitemapie od 2026-08-19.

**Miasta w `content/miasta.ts`** — slug, mianownik, miejscownik z przyimkiem (bo „we
Wrocławiu" łamie regułę „w " + forma) i współrzędne centrum. Dodanie miasta to jeden wpis
w tej tablicy; `sitemap.ts`, `generateStaticParams` i walidator `check-docs.mjs` czytają
z niej, więc nie mają jak się rozjechać. Blokada nazw miast w `content/zakazaneFrazy.ts`
**zostaje** i nie stała temu na przeszkodzie: dotyczy `ZAKAZANE_NA_LANDINGU`, czyli
wyłącznie `components/home/landing/content.ts` — landing ma pozostać ogólnopolski, a
strony miejskie żyją w `content/miasta.ts` i podlegają `ZAKAZANE_WSZEDZIE`.

**Liczba obiektów w okolicy** — `lib/api.ts#policzBoiskaWOkolicy()`, kadr **prostokątny**
wokół centrum (PostgREST nie policzy haversine, a RPC do tego nie ma), stąd treść mówi
„w okolicy", nie „w promieniu N km". Przy błędzie zapytania funkcja zwraca 0, a strona
pomija całą sekcję — brak liczby jest uczciwszy niż zero udające pustą okolicę.
Sekcja **nie** opiera się na `fields.city`: ta kolumna jest pusta we wszystkich wierszach,
dopóki nie przejdzie `scraper/backfill_lokalizacja.py`.

**Dane na żywo, nie zaszyte.** Strona woła `getNearbyEvents()` (`lib/events.ts`, RPC
`get_nearby_events` z `025_game_alerts.sql`, wcześniej nieużywane w kodzie poza wyłączoną
flagą `SHOW_GAME_ALERTS`) z promieniem 15 km od centrum danego miasta, filtruje wynik po sporcie
i pokazuje do 5 najbliższych meczów jako listę z linkami do `/wydarzenia/[id]`. Licznik
u góry pokazuje pełną liczbę dopasowań, nie tylko wyświetloną piątkę. Gdy lista jest pusta,
strona pokazuje uczciwe zastrzeżenie (`content/graj.ts#GRAJ_BRAK_MECZY`) zamiast chować
pusty stan — ten sam ton co `content/dlaczego.ts#wczesny-etap`.

**Treść bez nowych faktów.** Kroki zakładania meczu i zdanie o tym, czego Bojo nie robi
(brak rezerwacji boiska) są importowane z `content/jakDziala.ts`, nie przepisywane —
`tresciStron.test.ts` pilnuje ich raz, w jednym miejscu. Copy unikalne dla tej strony
(`content/graj.ts`) jest dopisane do tego samego testu i podlega tym samym zakazanym
frazom co `/jak-dziala-bojo` i `/dlaczego-bojo`, mimo że AGENTS.md nie wymusza tego
automatycznie dla nowych tras.

**CTA prefill.** „Stwórz mecz publiczny” prowadzi do `/wydarzenia/nowe?sport=<slug>` —
kreator czyta ten parametr (`FOCUS_SPORT_BY_SLUG` z `lib/sports.ts`) i ustawia sport przez
istniejący `selectSport()`, tym samym mechanizmem co ręczny wybór w UI (więc domyślna
liczba miejsc też się dostraja). Wcześniej `?sport=` było ignorowane.

**Cross-linki (dopełnienie roadmapy #9):** `/boiska/[sport]` linkuje do
`/[sport]/poznan` dla czterech sportów, które tę stronę mają; `sitemap.ts` ma osobny,
bounded blok `grajPages` z iloczynu `FOCUS_SPORT_BY_SLUG` × `MIASTA`, więc nie może się
rozjechać z `generateStaticParams`. Sama strona linkuje w dół do `/mapa`,
`/boiska/[sport]`, do pozostałych sportów w tym mieście i do tego samego sportu
w pozostałych miastach.

**Treść pod odpowiedzi generatywne.** Pod H1 stoi Direct Answer
(`content/miasta.ts#odpowiedzMiasta()`, 40–50 słów), niżej blok „Czym Bojo nie jest"
(`CZYM_BOJO_NIE_JEST`) odróżniający Bojo od systemów rezerwacji obiektów, a na dole
`MiniFaq` z czterema pytaniami z `content/faq.ts` — te same pytania idą do `FAQPage`
JSON-LD, bo schema bez pokrycia w widocznym tekście to sygnał spamu, nie boost
(`lib/structuredData.ts#faqJsonLd`). Cały tekst, łącznie z szablonami składanymi per
sport i miasto, jest dopisany do `tresciStron.test.ts`.

---

## Tierowanie indeksacji katalogu boisk (SEO/GEO, migracja `112`)

Katalog ma dziś **36 268 wierszy** (import całej Polski z OSM, `scraper/import_osm_pbf.py`)
i rośnie z każdym kolejnym importem. Indeksowanie wszystkich naraz ryzykuje karę Google za
cienką treść (thin content) — większość obiektów ma tylko nazwę, adres i sport, bez
żadnego realnego ruchu: audyt produkcyjnej bazy przy wdrożeniu pokazał, że **tylko 40
obiektów w całej historii miało kiedykolwiek mecz**.

**Trzy poziomy, kolumna `fields.seo_tier`:**
- **Tier 1** (`index,follow`) — miasto z listy `miasta_priorytetowe` (~100 dużych/średnich
  miast, dane GUS) LUB `is_verified_venue` LUB ma mecz LUB ma komentarz pod obiektem.
- **Tier 2** (`index,follow`) — ma miejscowość, sport i nazwę, ale nie spełnia kryteriów
  Tier 1.
- **Tier 3** (`noindex,follow`) — reszta: brak miejscowości, ubogie dane. Strona dalej
  działa dla użytkowników (mapa, wyszukiwanie) i przekazuje linki dalej (`follow`), tylko
  nie trafia do indeksu Google.

Tier liczy funkcja `oblicz_seo_tier()` w bazie, wołana automatycznie z trzech triggerów
(`fields_przelicz_tier`, `events_promuj_tier`, `field_comments_promuj_tier`) — **nie
ustawiać `seo_tier` ręcznie z kodu aplikacji**. Awans do Tier 1 po pierwszym meczu albo
komentarzu jest jednokierunkowy (odwołanie meczu nie degraduje z powrotem), dokładnie tak
jak wklejony przez użytkownika plan proponował: „gdy ktoś zorganizuje mecz — obiekt
automatycznie awansuje".

**`city`/`voivodeship` nie parsować z `address`.** Kolumny wypełnia osobny, ręcznie
uruchamiany skrypt `scraper/backfill_lokalizacja.py` (reużywa `nearest_place()` z
`import_osm_pbf.py` — ten sam plik `.osm.pbf`, ten sam najbliższy węzeł `place=`), nie
funkcja `miejscowoscZAdresu()` w `boisko/[id]/page.tsx` (ta zostaje jako fallback dla
wierszy sprzed backfillu — 169 duplikatów nazw i niejednoznaczny format adresu robią
z parsowania tekstu zgadywankę). Backfill przeszedł realnie przez
`.github/workflows/backfill-lokalizacja.yml` (sesja agenta nie ma dostępu do
`download.geofabrik.de` — polityka sieciowa środowiska — więc backfill uruchamia się z
GitHub Actions, tym samym mechanizmem co import). Rozkład na produkcji: **3 605 w Tier 1,
28 491 w Tier 2, 4 172 w Tier 3**.

**Sitemap partycjonowany per województwo**, nie jeden rosnący bez końca plik:
`sitemap.ts` (strony statyczne, huby sportów, `/[sport]/[miasto]`, 16 hubów wojewódzkich
`/boiska/woj/[wojewodztwo]`) + 16× `sitemap-boiska/[plik]/route.ts` (po jednym na
województwo, tylko boiska — Tier 3 ma `noindex`, więc wpis w sitemapie byłby sprzeczną
instrukcją dla Googlebota), zebrane w `sitemap-index.xml/route.ts`. `robots.ts` wskazuje
na ten indeks, nie na goły `sitemap.xml`.

### Faza 1 — fact-dense opis obiektu

`content/opisObiektu.ts#opisObiektu()` buduje jeden akapit z danych katalogu (sport,
miejscowość, kryty/odkryty, nawierzchnia, oświetlenie) — ten sam tekst widoczny na górze
`/boisko/[id]` (`VenueDetailClient.tsx`, tuż pod nagłówkiem) i jako `description` w JSON-LD
`SportsActivityLocation` (`boisko/[id]/page.tsx`), jedno źródło. Podlega
`content/zakazaneFrazy.ts` tak samo jak `/faq`/`/jak-dziala-bojo`/`/dlaczego-bojo` —
próbka reprezentatywnych obiektów (różne miasto/nawierzchnia/kryte-odkryte/oświetlenie)
jest dopisana do wspólnej listy jednostek treści w `tresciStron.test.ts`, bo to czysty
szablon: jeśli zakazana fraza nie wchodzi w kilka kombinacji, nie wejdzie w żadną inną
(interpolowane są dane katalogu, nie nasza proza).

### Faza 2b — huby wojewódzkie

`/boiska/woj/[wojewodztwo]` — 16 stron, wzorem `/boiska/[sport]`: `force-dynamic`,
paginacja `?strona=` po 60 obiektów (katalog per województwo bywa duży, np. mazowieckie
ma ponad 8 tysięcy boisk w samym pliku PBF), bez prerenderu z tych samych powodów co
`/boisko/[id]`. Adres celowo NIE jest `/boiska/[wojewodztwo]` — Next.js nie pozwala dwóm
dynamicznym segmentom na tym samym poziomie katalogu mieć różne nazwy (`[sport]` już
zajmuje `/boiska/[cokolwiek]`), więc `woj` jest literalnym segmentem pośrednim. Nazwy do
wyświetlenia w `lib/wojewodztwa.ts#WOJEWODZTWO_LABEL` — mianownik z wielkiej litery,
świadomie bez odmiany przez przypadki (nagłówek składa się jako „Województwo {Nazwa} —
…", więc fleksja przymiotnika nigdy nie wchodzi w grę). `/boisko/[id]` linkuje do swojego
huba wojewódzkiego (widoczny link pod „direct answer" i okruszek w JSON-LD breadcrumbs),
gdy `field.voivodeship` jest wypełnione.

### Faza 3 — mikro-ankiety UGC

`AnkietyObiektu.tsx` na `/boisko/[id]` (nad `VenueComments`) — dwa pytania: „czy
oświetlone?" (tak/nie) i „jaka nawierzchnia?" (te same sześć wartości co `SURFACE_MAP` w
`import_osm_pbf.py`). Tabela `potwierdzenia_obiektu` (migracja `123`), jeden głos na fakt
na osobę (`UNIQUE (field_id, user_id, fakt)`, `.upsert()` pozwala zmienić zdanie). Wynik
pokazuje się jako „potwierdzone przez N graczy" dopiero od **quorum = 2** — jeden klik to
czyjaś opinia, nie potwierdzony fakt. Świadomie **nic nie nadpisuje** w `fields` (`lit`,
`surface` z OSM zostają nietknięte) — głos graczy pokazuje się OBOK danych z katalogu, nie
zamiast nich; decyzja o ewentualnym nadpisywaniu kolumn zostaje otwartym punktem (patrz
„Zgłaszanie błędów: w aplikacji i w danych obiektu" w BACKLOG.md).

---

## Układ `/wydarzenia` — filtry, sortowanie, sekcje dzienne

Widok jest rozdzielony na dwie warstwy: **`EventsListView.tsx`** (sama treść) i
**`EventsListClient.tsx`** (`<Header/>` + widok). Podział jest po to, żeby ten sam widok
mógł posłużyć za tło ekranu logowania — patrz niżej.

**Nagłówek zależy od tego, kto patrzy.** Zalogowany na mobile (Header ma tu schowany
pasek, patrz wyżej) dostaje jeden wiersz: pole szukania (placeholder **„Znajdź grę"**,
bez osobnego `<h1>`) + `MobileIdentityRow` (dzwonek, awatar); plakietka „Zaproszenia N"
schodzi pod spód, bo na 360px szerokości cała czwórka nie mieści się bezpiecznie w
jednej linii. Wylogowany (dowolna szerokość) i zalogowany na desktopie widzą klasyczny
układ: `<h1>Znajdź grę</h1>` + plakietka, potem osobny wiersz szukania z placeholderem
„Nazwa, boisko albo dzielnica…". Oba warianty pola szukania są osobnymi blokami JSX
(nie jednym elementem sterowanym media query) — dokładnie ten sam wzorzec, co mobile/
desktop gałęzie w `Header.tsx`.

**Jeden pasek kafelków**, w tej kolejności, scrolluje się w bok gdy nie mieści się w
jednej linii (`overflow-x-auto` z ukrytym scrollbarem):

| Element | Zachowanie |
|---|---|
| **„Sortuj"** *(dropdown)* | `PillDropdown` (`components/ui/FilterPill.tsx`), single-select, aplikuje się **natychmiast** po kliknięciu opcji (nie przez szkic modala): Najbliższy termin *(domyślnie)* / **Najbliżej mnie** (pyta o lokalizację od razu, pokazuje „Szukam Cię…" w trakcie) / Najwięcej wolnych miejsc |
| **„Filtry"** *(przycisk → modal)* | otwiera `FilterSheet` z czterema suwakami: Kiedy / Odległość / Cena / Wolne miejsca |
| **Sport** *(dropdown)* | `PillDropdown`, multi-select, źródło `FOCUS_SPORTS` (4 opcje); „piłka nożna" łapie też `futsal` |
| „Wolne miejsca" *(toggle)* | odsiewa komplety (`participantsCount < maxPlayers`) — **inny** filtr niż suwak „Wolne miejsca" w modalu, patrz niżej |
| „Za darmo" *(toggle)* | `costGrosze === 0` |

**Cztery suwaki w modalu** (`components/ui/RangeSlider.tsx` — jeden generyczny suwak,
etykieta wartości nad nim, opisy skrajów pod spodem; reużywany też w trybie gier na
`/mapa`). Skrajna prawa pozycja = brak ograniczenia:

| Suwak | Zakres | Prawy skraj |
|---|---|---|
| Kiedy | Dzisiaj / Jutro / Ten tydzień / Ten miesiąc / Wszystko (5 pozycji) | Wszystko |
| Odległość | 1–20 km, krok 1 | Bez limitu |
| Cena | 0–100 zł, krok 5 | Bez limitu (0 zł = Za darmo) |
| Wolne miejsca | 0–14, krok 1 | 0 = dowolna liczba (nie ogranicza) |

Suwak „Wolne miejsca" w modalu to **próg minimum** (`freeSpots(e) >= N`,
`filterByMinFreeSpots()`), świadomie osobny od toggle'a „Wolne miejsca" w pasku (który
tylko odsiewa komplety) — oba filtry łączą się przez AND, gdy oba aktywne. „Kiedy" nie
ma już opcji „Weekend" (zastąpiona „Ten miesiąc" — `matchesDateFilter` case `'miesiac'`,
`isSameMonth()` z `date-fns`).

**Modal filtrów działa na szkicu, nie na żywym stanie** (styl Booking: wybierz kilka
rzeczy, potem zatwierdź). Otwarcie kopiuje bieżące `dateFilter`/`radiusKm`/
`maxPriceGrosze`/`minFreeSpots` do stanu szkicu; dotykanie suwaków zmienia wyłącznie
szkic. Przycisk zatwierdzenia pokazuje na żywo `Pokaż N meczów` i dopiero jego kliknięcie
commituje szkic do prawdziwego stanu — jeśli suwak Odległości jest ustawiony i pozycja
użytkownika jeszcze nie jest znana, pyta wtedy raz o zgodę na lokalizację (przy odmowie
promień wraca do wyłączonego). „Sortuj" ma **własny**, niezależny geo-trigger (patrz
tabela wyżej) — nie czeka na zatwierdzenie modala. „Wyczyść" resetuje szkic bez
zamykania modala (i przy okazji resetuje `sortBy` do „Najbliższy termin" — wcześniej
zostawał); zamknięcie przez tło/X/Escape odrzuca szkic bez dotykania prawdziwych filtrów.

**Licznik wyników nad listą usunięty** — zostaje tylko link „Wyczyść filtry", widoczny
wyłącznie gdy jest co czyścić.

| Element | Zachowanie |
|---|---|
| Szukanie | po tytule, sporcie, boisku i **dzielnicy**, przez `foldText` — „pilka" znajduje „piłka" |
| Sekcje dzienne | Dzisiaj / Jutro / W tym tygodniu / Później — **tylko** przy sortowaniu po terminie |
| Stronicowanie | 20 pozycji + „Pokaż więcej"; licznik resetuje się przy zmianie filtrów |

Sekcje dzienne wyłączają się przy sortowaniu po odległości i po liczbie miejsc: dwa
porządki naraz („po czasie" w nagłówkach, „po dystansie" w treści) wprowadzałyby w błąd.

Logika filtrowania, grupowania, sortowania, promienia, ceny i minimalnych wolnych miejsc
(`filterByRadius`, `filterByMaxPrice`, `filterByMinFreeSpots`) żyje w
`lib/eventFilters.ts` — w komponencie nie dałoby się jej przetestować. Ten sam plik
eksportuje `multiLabel`/`toggleInArray` (etykieta dropdownu multi-select, przełącznik
wartości w tablicy) — reużywane przez sportowy dropdown na `/wydarzenia` **i** na
`/mapa` w trybie gier.

**Modal filtrów** (`components/ui/FilterSheet.tsx`) jest wspólny z mapą boisk
(`VenueExplorer.tsx`) — jedna powłoka (portal do `<body>`, bottom sheet na mobile,
wyśrodkowana karta od `md:`), różna wyłącznie treść sekcji. **Pigułki filtrów**
(`components/ui/FilterPill.tsx`: `PillDropdown`, `TogglePill`) też są wspólne z mapą.

### Widok mapy w `/wydarzenia` (mobile-only)

**Od 2026-08-23 `/wydarzenia` nie jest już celem „Szukaj" na dolnej nawigacji —
zastąpił ją `/mapa`, patrz „Scalona wyszukiwarka" niżej.** Trasa i `EventsListView`
zostają żywe (linki z `/gracz`, głębokie linki, tło ekranu logowania —
`LoginBackdrop.tsx`), ale to już nie jest ekran, na który trafia dotknięcie „Szukaj".

Przycisk obok dzwonka powiadomień (mobile, zalogowany) przełącza treść strony między
listą a mapą — **to nie jest nawigacja na `/mapa`**, tylko stan komponentu
(`viewMode: 'lista' | 'mapa'`) w tym samym `EventsListView`. Desktop zawsze pokazuje
listę (ma już osobny link „Mapa boisk" w nawigacji) — przełącznik jest `md:hidden`.

Pigułka „Sortuj" **nie pokazuje się** w tym widoku — na mapie nie ma listy do
sortowania, chowa się razem z przełączeniem na `viewMode === 'mapa'` (`sortBy` samo
w sobie zostaje bez zmian, po prostu nie jest tu eksponowane w UI).

Mapa (`components/map/GamesMapCanvas.tsx`, ładowany przez `next/dynamic({ ssr: false })`)
renderuje pinezki dla **całego już przefiltrowanego zbioru** (`sorted` z pipeline'u
strony) — bez własnego zapytania ograniczonego do widocznego kadru: zbiór publicznych
wydarzeń jest już w całości w pamięci (`getPublicEvents()`, bez limitu). Klastrowanie
przez `L.markerClusterGroup` (`leaflet.markercluster`) w nowym, współdzielonym
`components/map/GamesMarkersLayer.tsx` — ten sam komponent montowany też wewnątrz
`VenueExplorer.tsx` w trybie „Gry", patrz „Układ `/mapa`" niżej. Mapa robi
`fitBounds` na cały zbiór przy każdej zmianie filtrów.

**Mecz bez współrzędnych nie trafia na mapę — i mapa musi to POWIEDZIEĆ.** Pinezka
potrzebuje `lat`/`lng`; wiersz bez nich `GamesMarkersLayer` pomija. Zgłoszone wprost:
„na liście są, na mapie pusto". Złożyły się na to trzy rzeczy i każda jest naprawiona
osobno:

1. **Współrzędne z obiektu jako zapasowe źródło** (`wspolrzedna()` w `toEvent()`,
   `lib/events.ts`). Mecz przypięty do obiektu z katalogu ma znane położenie — tylko
   w tabeli `fields`, nie w swoim wierszu. Zapytania listowe ciągną więc
   `fields(district, lat, lng)`, a mapper sięga po nie, gdy mecz nie ma własnych.
   Pinezka postawiona ręcznie (bez `field_id`) fallbacku nie ma i mieć nie może.
2. **Licznik liczy PINEZKI, nie wiersze** (`GamesMapCanvas`). Brał `rows.length`, więc
   nad pustą mapą stało „12 meczy na mapie" — brak danych czytał się jak zepsuta mapa.
   Dziś liczy zlokalizowane i dopisuje „· N bez lokalizacji", gdy któreś wypadły.
3. **Pusta mapa tłumaczy się sama** — gdy ani jeden mecz nie ma lokalizacji, na
   kafelkach stoi zdanie, że to brak danych, a nie awaria, i że na liście są wszystkie.

Pilnuje tego `e2e/mapa-bez-wspolrzednych.klikalnosc.spec.ts` (atrapa PostgREST, bez bazy).

**Seedy ustawiają współrzędne** — do 2026-08-23 nie robił tego żaden, więc KAŻDY widok
mapy na danych testowych był pusty (111 ze 112 zaseedowanych meczów bez `lat`). Każdy
seed kończy się jednym `UPDATE` rozrzucającym mecze wokół centrum Poznania,
deterministycznie z tytułu (ten sam mecz zawsze w tym samym punkcie, więc zrzuty ekranu
się nie ruszają; różne mecze w różnych, więc pinezki nie siedzą jedna na drugiej).

**Pinezka pojedynczego meczu** to kółko w kolorze sportu (`sportColor()`) z emoji
sportu w środku — odpowiada wprost na „jaki sport", bez potrzeby legendy — etykietą
„kiedy + godzina" pod spodem (`matchWhenLabel(date, time)`: dziś · 18:00 / jutro · 18:00
/ w piątek · 20:30 / 12 wrz · 18:00, ten sam format co gdzie indziej w apce, np. na
kartach `/moje-gry`). Cena i reszta szczegółów zostają
/ w piątek · 20:30 / 12 wrz · 18:00, ten sam format co gdzie indziej w apce, np.
`NextMatchCard`), a pod nią **skład w formacie „8/14"** (`etykietaSkladu()`
w `lib/eventFilters.ts`). Pytanie, które decyduje o dotknięciu pinezki, brzmi „czy jest
tam jeszcze miejsce" — bez tej liczby trzeba było otwierać każdą po kolei, żeby się
dowiedzieć, że wszystkie są pełne. Komplet malowany niebiesko (`lib/komplet.ts`, ta sama
reguła co na kartach: komplet nie jest awarią). Druga linijka, nie doklejenie do
pierwszej — „jutro · 18:00 · 8/14" nie mieści się w szerokości pinezki. Gdy
`participantsCount` nie jest znane (zapytania bez joinu do `event_participants`),
pigułki nie ma wcale: lepiej nic niż „undefined/14". Cena i reszta szczegółów zostają
w panelu po dotknięciu — na samej pinezce więcej tekstu byłoby nieczytelne. Klaster
(kilka meczów blisko siebie) pokazuje kolorowe kółko z liczbą, tym samym
`clusterDivIcon()` co klastry boisk na `/mapa`.

Dotknięcie pinezki otwiera dolną kartę `EventBrowseCard` (ten sam komponent co lista),
bez natywnych popupów Leaflet:
- **Swipe w lewo/prawo** na karcie przełącza na kolejny/poprzedni mecz w tej samej
  kolejności co pinezki (`swipeEventId()` w `lib/eventFilters.ts` — indeks w `rows`,
  zawija się na końcach listy). Wykrywanie gestu: `lib/useSwipe.ts` (próg 50px, wymaga
  wyraźnej przewagi ruchu poziomego nad pionowym, żeby nie kolidować ze scrollem).
- **Dotknięcie mapy poza pinezką zamyka kartę** — `GamesMarkersLayer` nasłuchuje
  `map.on('click', …)` i czyści zaznaczenie; kliknięcie samej pinezki nie dociera do
  tego listenera, bo Leaflet nie propaguje kliknięcia markera do mapy.
- **Przycisk „Zlokalizuj mnie"** (prawy dolny róg) — `components/map/LocateMeButton.tsx`,
  wspólny z `/mapa` (patrz niżej), ikona `LocateFixed` (celownik), nie pinezka.

### `/logowanie` na tle listy meczów

`app/logowanie/page.tsx` renderuje pod kartą formularza **prawdziwy** `EventsListView`
(`components/auth/LoginBackdrop.tsx`), przykryty mgiełką `bg-black/20` + delikatnym
rozmyciem. `/logowanie` **zostaje zwykłą trasą**, nie modalem przechwytującym: większość
wejść na ten ekran to twarde `window.location.href`, których intercepting route i tak by
nie złapał, a trasa musi działać po odświeżeniu i z linku w mailu.

Tło jest dekoracją i jest całkowicie bierne: `pointer-events-none`, `overflow-hidden`,
`aria-hidden` **oraz `inert`**. Samo `aria-hidden` nad kontenerem pełnym odnośników
byłoby błędem dostępności — czytnik ekranu ich nie widzi, ale Tab dalej w nie wchodzi.
React 18 nie zna propa `inert` (doszedł w 19), więc atrybut ustawiany jest przez `ref`.

### Gdzie ląduje zalogowany

Domyślny cel po zalogowaniu/rejestracji to **`/`** — strona główna, gdzie świeże konto
trafia na modal wyboru roli (niżej). `?next=` (brama kreatora, strona boiska, grupa,
dołączanie do meczu, przejęcie wpisu gościa) ma pierwszeństwo i zawsze wygrywa z
domyślnym celem. `AuthForm.tsx` i `app/auth/callback/page.tsx` (Google, magic link)
deklarują ten sam domyślny cel — wcześniej się rozjeżdżały (`/wydarzenia` kontra `/`),
co przy braku `?next=` dawało niedeterministyczny wynik zależny od kolejności async
między ręcznym `router.push` w `AuthForm` a efektem w `app/logowanie/page.tsx`
reagującym na zmianę stanu zalogowania.

Konsekwencja: baner „Gracze zobaczą Cię jako…" (`UzupelnijProfilBanner`) renderuje się
**także na `/wydarzenia`**, nie tylko na pulpicie. Bez tego konto bez imienia — typowo
Google bez `full_name` — nie zobaczyłoby go nigdy. Powiadomienie z migracji `070`/`071`
tej luki nie zamykało (wyzwalacz w praktyce nigdy nie wstawiał wiersza — patrz sekcja
„Powiadomienia — co realnie istnieje" niżej); od migracji `086` RPC wołane z
`lib/auth.tsx` robi to niezawodnie dla świeżych kont.

**Modal wyboru roli po rejestracji** (`components/onboarding/PostSignupRoleModal.tsx`,
montowany globalnie w `layout.tsx`) pokazuje się raz, tylko po organicznej rejestracji
(konto młodsze niż 10 minut, cel logowania jeden z `/`, `/wydarzenia`, `/moje-gry`,
`/mapa` — czyli bez konkretnego kontekstu w rodzaju dołączania do meczu albo przejęcia
wpisu gościa, sprawdzane przez `ostatniZamierzonyCel()` w `lib/powrotPoLogowaniu.ts`).
Proponuje „Jestem organizatorem" (`/grupy/nowe`, wizualnie pierwsze) albo „Jestem
graczem" (`/grupy` albo `/wydarzenia`). Zamknięcie krzyżykiem też oznacza wpis jako
widziany (`localStorage`, klucz `bojo:onboarding-rola:<uid>`) — nie wraca przy kolejnym
logowaniu.

---

## Układ `/grupy` — lista ekip

Karta ekipy pokazuje od razu to, po co się tu wchodzi: **kiedy gramy**, nie tylko nazwę.
`getMyGroupsZTerminem()` (`lib/groups.ts`) dociąga do listy grup najbliższy nadchodzący
mecz każdej z nich — dwa zapytania na cały ekran. Karta ma termin, miejsce i pasek
zapełnienia składu; gdy grupa nie ma terminu, pokazuje „Brak terminu" z odnośnikiem do
kreatora. **Lista jest posortowana po najbliższym terminie** (rosnąco: grupa z meczem
jutro przed grupą z meczem za miesiąc), nie po dacie założenia ekipy; grupy bez terminu
lądują na końcu, w kolejności `created_at` malejąco. Kod zaproszenia (jedyna droga
samodzielnego dołączenia, patrz niżej) żyje w dyskretnym wierszu na dole, nie w karcie
na pół ekranu jak wcześniej — otwiera bottom sheet (`KodGrupySheet.tsx`).

**Formularz `/grupy/nowe`** dorównuje dziś zakładce Ogólne w ustawieniach — dochodzi
wgrywanie okładki (`CoverUpload`, ścieżka w storage generowana lokalnie przed
utworzeniem grupy, bo prawdziwe `id` powstaje dopiero po zapisie) i zdanie „Wszystko
zmienisz później w ustawieniach ekipy". Po utworzeniu formularz przekierowuje na
`/grupy/{id}?zapros=1` zamiast na goły `/grupy/{id}` — `GroupDetailClient` widząc ten
parametr od razu otwiera `ZaprosDoGrupySheet` i czyści adres (ten sam wzorzec, co
obsługa `?dolacz=`). Powód: ekipa z jedną osobą jest martwa, a chwila tuż po utworzeniu
to jedyny moment, w którym organizator na pewno chce zapraszać.

## Układ `/grupy/[id]`

Trasa jest rozdzielona na serwerowy `page.tsx` (z `generateMetadata`) i
`GroupDetailClient.tsx`, który składa cztery komponenty z `components/groups/`:
`NajblizszyMeczGrupy`, `RozmowaGrupy`, `SkladGrupy`, `StatystykiGrupy`. Metadane są tu
istotne, bo **strona grupy jest jednym z celów linku zaproszenia** `/g/[kod]` — bez nich
każde udostępnienie pokazywało generyczny tytuł całej aplikacji.

Układ od góry: **niska belka** łącząca powrót, tożsamość ekipy i akcje w jednym rzędzie —
strzałka powrotu, mały kafelek 32×32 (okładka albo emoji sportu), nazwa, przycisk
„Zaproś" (otwiera `ZaprosDoGrupySheet.tsx`, widoczny tylko z `can_invite`) i na mobile
dzwonek (`NotificationBell`) na końcu. **Kod dołączenia i zębatka ustawień zniknęły
z belki** — miała za dużo elementów. Kod dołączenia żyje wyłącznie w arkuszu „Zaproś"
(`ZaprosDoGrupySheet`); ustawienia dostały własny wpis w pasku zakładek (Link do
`/grupy/[id]/edytuj`, stylowany identycznie jak reszta zakładek, widoczny dla
założyciela/`can_manage_members`) zamiast osobnej ikony. Awatar też zniknął — sam dzwonek
wystarczy, profil jest w dolnej nawigacji. Osobny wiersz pod belką niesie meta
(sport/miasto/boisko/liczba członków) — dawniej to wszystko zajmowało osobny wiersz
„← Ekipy" plus kartę nagłówka z okładką na pół ekranu, co zgłoszono wprost jako
zajmujące za dużo miejsca.

**Nazwa ekipy w belce jest przełącznikiem, nie tylko tytułem** — kliknięcie rozwija
listę pozostałych ekip użytkownika (`getMyGroups()`) pod belką, z ikoną, nazwą i
strzałką ChevronDown, która się obraca po otwarciu; wybór innej ekipy nawiguje do jej
`/grupy/[id]`. Widoczne (nazwa klikalna, strzałka) tylko gdy jest co przełączać — dla
kogoś w jednej ekipie nazwa zostaje zwykłym `<h1>`. Zamyka się automatycznie po wyborze
i przy każdej zmianie `id` w URL-u; tło na cały ekran (`fixed inset-0`) łapie kliknięcie
poza listą, tak jak każdy inny dropdown w apce.

Zaraz pod belką stoją **zakładki** — nawigacja ma być
najwyżej, nad treścią którą przełącza, nie pod pierwszą kartą. **Belka i zakładki dzielą
jeden `sticky top-0` kontener** (poza zakładką Rozmowa, patrz niżej) — dwa osobne sticky
elementy na tej samej wysokości nakładałyby się na siebie zamiast układać w stos, więc
to jest jedna sticky całość, nie dwie. Poziome przewijanie zakładek na wąskim telefonie
nie pokazuje paska przewijania (`.scrollbar-hide` w `globals.css`).

**Swipe w bok przełącza zakładki** — mechanika opisana przy `/moje-gry` wyżej
(`useSwipeZakladek()`), tu z jedną pułapką: „Ustawienia" na końcu paska WYGLĄDA jak
zakładka, ale jest `<Link>` do `/grupy/[id]/edytuj`, nie przełącznikiem stanu `tab` —
nie wchodzi do listy, po której porusza się gest.

**„Najbliższy mecz" (`NajblizszyMeczGrupy.tsx`) jest widoczny wyłącznie w zakładce
Mecze** — to jest jej treść (skrót najbliższego terminu), nie uniwersalny nagłówek
strony; wcześniej wyświetlał się na każdej zakładce oprócz Rozmowy, co pod Statystykami
czy Składem po prostu zajmowało miejsce. **Tu żyje cotygodniowa pętla**: gdy grupa ma
nadchodzący mecz, ten sam komponent karty co na `/wydarzenia` (`EventBrowseCard`, z moim
statusem uczestnictwa) plus osobny przycisk „Udostępnij mecz" pod spodem; gdy nie ma, ale
ma historię, przycisk „Powtórz na {dzień} {data}" tworzy nowy termin jednym kliknięciem
(`repeatEvent()` + `domyslnyTerminPowtorki()`, ta sama data i godzina co poprzednio —
całą ekipę powiadamia trigger `powiadom_o_nowym_meczu_w_grupie`, migracja `072`/`093`);
gdy grupa nie miała jeszcze żadnego meczu, link prosto do kreatora. Środkowy FAB dolnej
nawigacji na trasie `/grupy/<id>` sam prowadzi do `/wydarzenia/nowe?group=<id>`
(`BottomNav.tsx`) — to samo działanie na desktopie robi tekstowy „+ Nowy termin"
w zakładce Mecze.

Cztery zakładki plus link „Ustawienia" na końcu paska (nawiguje do `/grupy/[id]/edytuj`,
nie przełącza stanu `tab` — ta strona ma już własne zakładki Ogólne/Zaproszenia/
Uprawnienia, więc nie duplikujemy ich treści tutaj — **zakładka Zaproszenia sama jest
widoczna tylko dla founder/`can_invite`**, Uprawnienia jak dawniej wyłącznie dla
foundera; kogo dana zakładka nie dotyczy, ten jej w ogóle nie widzi).

**Link „Ustawienia" migał widoczny osobie bez żadnej roli w nowej ekipie** — `/grupy/[id]`
jest trasą dynamiczną: przejście z ekipy, gdzie ktoś jest założycielem, do ekipy, gdzie nie
ma żadnej roli, nie odmontowuje `GroupDetailClient`, tylko zmienia `id`. `load()` woła teraz
`setMember(false)`/`setPermissions(null)` na SAMYM POCZĄTKU, przed pobraniem danych nowej
ekipy — inaczej `permissions` z poprzedniej ekipy zostawało w stanie, dopóki nowe zapytanie
nie wróciło, i link „Ustawienia" (gated `perms.isFounder || perms.canManageMembers`) świecił
się przez chwilę komuś, kogo nie dotyczy. Ten sam wzorzec błędu naprawiono na
`/wydarzenia/[id]` — tam zakładka „Ustawienia" w ogóle nie była gated na poziomie przycisku,
tylko treści (patrz „Zakładki na `/wydarzenia/[id]`" niżej).

**Mecze**
(nadchodzące/historia, jak dawniej — sekcja „Najbliższy mecz" nad zakładkami pokazuje
najbliższy termin raz; „Nadchodzące" niżej filtruje go z listy, żeby nie dublować tego
samego meczu na jednym ekranie) / **Rozmowa** (dawniej
„Tablica" — patrz niżej, różowa plakietka z liczbą nieprzeczytanych; własne wpisy nigdy
się nie liczą — wysyłający już je widział w momencie wysyłania) / **Skład** (mała belka
„Zaproś do ekipy" + kod dołączenia + ikona udostępnienia nad rzędem awatarów — ten sam
kod/link co w `ZaprosDoGrupySheet`, tylko bez otwierania arkusza; widoczna z tych samych
warunków co dawny przycisk „Zaproś" w belce, `member && can_invite` — **powyżej niej,
wyłącznie dla założyciela i wyłącznie gdy `memberCount > 30`, informacja „Nie musisz
dodawać do ekipy jak najwięcej osób — publiczny mecz i tak widzą gracze z okolicy"**:
duża prywatna ekipa zwykle znaczy, że organizator rozrasta grupę zamiast po prostu
otworzyć mecz publicznie (patrz „Otwórz dla okolicy" niżej) — potem rząd awatarów
+ lista, plakietka „Założyciel"/„Współorganizator", zębatka „Uprawnienia" rozwijająca
panel z czterema przełącznikami inline — dla założyciela — i kebab „Usuń z ekipy" dla
`can_manage_members`) / **Statystyki** (patrz „Wyniki i statystyki" w `docs/domena.md`;
kafelki liczbowe mają wspólną minimalną wysokość i wyśrodkowaną treść — „nadchodzące"
jest dłuższe niż sąsiednie etykiety i na wąskim telefonie łamie się do dwóch linii, bez
tego kafelek wyglądał na rozjechany względem reszty rzędu).
Zmiana uprawnień innego członka jest dostępna w dwóch miejscach o identycznej treści
panelu (`UprawnieniaCzlonkaPanel.tsx`): tu, w Składzie, i w Ustawieniach — obie ścieżki
działają tylko dla założyciela, bo politykę UPDATE na `group_members` ma wyłącznie on.

**Rozmowa wygląda i przewija się jak WhatsApp**, nie jak lista wpisów odgórnie na
najnowszy. `RozmowaGrupy.tsx` wypełnia wysokością cały dostępny ekran (`h-full` w
elastycznym kontenerze rodzica — na tej zakładce `GroupDetailClient` ustawia stronę na
`h-[100dvh] overflow-hidden`, żeby po ukryciu `BottomNav` rozmowa sięgała do samego dołu
ekranu, zamiast zostawiać pod sobą pustą przestrzeń — a niska belka na tej jednej
zakładce traci `position: sticky` (zostaje zwykłym, statycznie pozycjonowanym elementem):
`sticky` wewnątrz `overflow-hidden`, nieprzewijalnego kontenera liczy punkt zaczepienia
inaczej niż przy zwykłym scrollu i belka lądowała niżej niż na pozostałych zakładkach —
zgłoszone wprost), chronologię
rosnącą (najstarsza u góry, najnowsza na dole) i composer pod listą, nie nad nią —
auto-scroll na dół po wejściu i po wysłaniu wiadomości, przycisk powrotu (strzałka w
kółku, `sticky` wewnątrz kontenera, nie `fixed` względem ekranu — dzięki temu nigdy nie
wchodzi w konflikt z dolną nawigacją) pojawia się dopiero, gdy ktoś odjedzie od dołu.
Wiadomości tej samej osoby pod rząd grupują się bez powtarzania nazwy, dni rozdzielają
wyśrodkowane pigułki („Dzisiaj"/„Wczoraj"/data), godzina siedzi w rogu dymka zamiast
w osobnym wierszu pod spodem. Przypięty wpis (`can_moderate_wall`) nie wskakuje na górę
listy — wisi jako osobny pasek nad kontenerem przewijania, tapnięcie przewija do niego.
Akcje (przypnij/usuń) chowają się pod małym „⋮" przy dymku, nie stoją stale widoczne.
`getGroupPosts()` (`lib/groupPosts.ts`) nie zmienił kontraktu — nadal zwraca
przypięty-pierwszy/malejąco (tego wciąż potrzebuje licznik nieprzeczytanych); kolejność
chronologiczną liczy sam komponent, do wyświetlenia.

**„Opuść ekipę" mieszka pod listą w Składzie**, nie na dole strony grupy jak wcześniej —
`/grupy/[id]/edytuj` jest dostępne wyłącznie dla założyciela i `can_manage_members`, więc
zwykły członek bez żadnych uprawnień nigdy tam nie trafi; Skład jest jego jedyną drogą
wyjścia z ekipy. **„Usuń ekipę"** (wyłącznie założyciel) mieszka tylko w Ustawieniach →
Ogólne — nie duplikuje się już na stronie grupy.

Zakładka trzyma stan w URL (`?tab=tablica` — nazwa parametru zostaje bez zmian mimo
etykiety „Rozmowa", żeby nie psuć zapisanych linków), ale przez
`window.history.replaceState`, **nie** `router.replace` jak na `/moje-gry`. Powód:
`/moje-gry` jest trasą statyczną i nawigacja nic nie kosztuje, a `/grupy/[id]` jest
dynamiczna — każde `router.replace` byłoby round-tripem po dane z serwera (łącznie
z `generateMetadata`), przez co adres w praktyce w ogóle się nie zmieniał.

**Pierwsze zejście z zakładki domyślnej dokłada JEDEN wpis do historii — od
2026-08-28.** Zgłoszone wprost, z sesji QA, dla `/wydarzenia/[id]`: „wejdź na
mecz → zakładka Rozmowa → systemowe wstecz. Jest: pusta strona (about:blank).
Powinno: powrót do zakładki Mecz." `replaceState` NIGDY nie dokłada wpisu do
historii — nadpisuje bieżący — więc kliknięcie zakładki nie zostawiało śladu
„byłem na domyślnej" i systemowe „wstecz" szło o wpis DALEJ, niż użytkownik
naprawdę wszedł. Ten sam kod (`goToTab`/`replaceState`) siedzi w obu miejscach,
więc ten sam błąd dotyczył też `/grupy/[id]`.

Naprawa: `goToTab()` sprawdza, czy WŁAŚNIE opuszcza zakładkę domyślną
(„Mecz"/„Mecze") — jeśli tak i jeszcze nie zrobił tego w tej wizycie, robi
JEDNORAZOWY `pushState` (znacznik w `useRef`, resetowany dopiero powrotem na
domyślną). Wszystkie kolejne przełączenia — w tym swipe między zakładkami —
dalej idą przez `replaceState`, żeby szybkie przewijanie nie zasypało historii
dziesiątkami wpisów. Osobny słuchacz `popstate` synchronizuje widoczną
zakładkę z adresem, gdy ten jeden wpis zostanie użyty — bez niego adres
wracał do zakładki domyślnej, a widoczna treść zostawała bez zmian aż do
odświeżenia.

Pilnuje tego `e2e/rozmowa-wstecz.klikalnosc.spec.ts` (`/wydarzenia/[id]`;
`/grupy/[id]` ma identyczny mechanizm, bez osobnego testu — ten sam kod,
ta sama naprawa).

Członkostwo pochodzi z **osobnego** zapytania `isGroupMember()`, nie z listy członków:
gdy dogrywka danych padnie, członek grupy nie zobaczy przycisku „Dołącz do grupy".

## Zakładki na `/wydarzenia/[id]`

`EventDetailClient.tsx` ma od tej zmiany pięć zakładek nad treścią, analogicznie do
`/grupy/[id]`, ale dostosowane do pojedynczego meczu: **Skład** (domyślna — dawne „Info":
prośby o dołączenie, panel „Czy gramy?", licznik miejsc, awatary i lista uczestników,
podział na drużyny jako zwinięty panel — patrz niżej, „Wypisz się"/„Nie gram" i inne
banery statusu uczestnictwa, zarządzanie graczami, karta „Po meczu", panel „Zaproś
znajomych", status zaproszeń), **Rozmowa** (`RozmowaWydarzenia.tsx`, zastępuje dawny
komponent `EventComments` — usunięty, nic innego go nie importowało; **wyłącznie okno
czatu**, żadnych innych elementów), **Wynik** (drużyny i formularz wyniku — dawna
`skladWynikSection`), **Rozliczenia** (podział kosztów per uczestnik — dawna
`platnosciSection`) i **Ustawienia** (panel „Zarządzaj wydarzeniem", **domyślnie
rozwinięty** — dawniej zwinięty, bo był jedną z wielu kart na długiej stronie; teraz to
cała treść osobnej zakładki, więc zwijanie na wejściu nie miało już sensu: widoczność,
goście, edycja, powtórka, uprawnienia, odwołanie/przywrócenie, usunięcie). Stan zakładki
w `?tab=`, odczytany ręcznie z `window.location.search` przez `useEffect`, **nie** przez
`useSearchParams()` — ta trasa jest prerenderowana i ten hak wywala produkcyjny build
(`missing-suspense-with-csr-bailout`, patrz pułapka w `AGENTS.md`); dokładnie ten sam
powód, dla którego `?utworzono=`/`?cykliczne=`/`?dolacz=` na tej stronie też są czytane
ręcznie.

**Swipe w bok przełącza zakładki** — mechanika opisana przy `/moje-gry` wyżej
(`useSwipeZakladek()`). Lista zakładek, po której porusza się gest, jest liczona
`useMemo`-em umieszczonym PRZED `if (loading)`/`if (notFound)` wyżej w komponencie —
musi się wywołać bezwarunkowo na każdym renderze (to hook), więc duplikuje cztery reguły
widoczności zakładek (patrz niżej) w bezpiecznej dla `event === null` wersji zamiast
czekać na konsty liczone dopiero po tych early returnach; komentarz w kodzie łączy oba
miejsca. Podział na drużyny (własny swipe + `@dnd-kit`) i pole tekstowe rozmowy
wyłączają gest przez `data-bez-swipe`.

**Zakładka „Ustawienia" znika z paska dla kogokolwiek bez `canManageEvent`** — treść
panelu zawsze była gated (`tab === 'ustawienia' && canManageEvent`), ale sam **przycisk
zakładki** renderował się dla każdego (`EVENT_TAB_LABELS.map(...)` bez filtra), więc ktoś
bez żadnej roli w meczu widział w pasku zakładkę, która po kliknięciu okazywała się pusta.
Pokrewny błąd co „Ustawienia" na `/grupy/[id]` (patrz „Układ `/grupy/[id]`" wyżej) — inny
mechanizm (tam stan nie zerował się między ekipami, tu przycisk zakładki w ogóle nie był
gated), ten sam efekt: widoczny, ale martwy element UI dla kogoś bez odpowiedniej roli.

**Nazwa meczu przeniosła się nad zakładki** — pasek na samej górze to teraz `[Wróć]`
(bez etykiety, sama strzałka) + nazwa (`<h1>` obcinany wielokropkiem), tak jak belka na
`/grupy/[id]`. „Udostępnij"/„Kopiuj", które wcześniej tam stały, przeniosły się **pod
zakładki** — w miejsce, które kiedyś zajmował `<h1>`. To jest świadoma zamiana miejscami,
nie usunięcie: obie pary elementów zostały, zmieniła się tylko ich kolejność w pionie.
Ten pasek nazwy i zakładki dzielą jeden `sticky top-0` kontener (poza zakładką Rozmowa,
z tego samego powodu co na `/grupy/[id]`), a poziome przewijanie zakładek chowa pasek
przewijania (`.scrollbar-hide`).

**Kilka elementów zostaje uniwersalnych** — renderują się niezależnie od aktywnej
zakładki (poza Rozmową, patrz niżej), bo dotyczą całego meczu, nie treści jednej
podstrony: baner odwołania meczu, panel „Mecz gotowy" tuż po publikacji, blok
„Udostępnij"/„Kopiuj" + chipy meczu (data/miejsce/cena/widoczność/grupa), sticky pasek
„Dołącz"/„Obserwuj" na dole ekranu oraz modale (zaproszenie z grupy, wybór grupy, zakres
edycji terminu serii). Bez tego np. osoba przeglądająca zakładkę Rozliczenia nie
widziałaby przycisku dołączenia do meczu. **Karta „Po meczu" (`PoMeczuCard`) NIE jest
uniwersalna** — żyje wyłącznie w zakładce Skład, żeby nie duplikować się z jej własną
treścią (roster, zarządzanie graczami) na każdej innej zakładce.

**Zakładka Rozmowa nie pokazuje nic poza oknem czatu** — baner odwołania, „Mecz gotowy",
blok „Udostępnij"/chipy i sticky pasek dołączenia mają jawny warunek `tab !== 'rozmowa'`.
Bez niego uniwersalne elementy zaśmiecały jedyny ekran, który ma wyglądać jak zwykły czat.
Zakładka nosi różową plakietkę z liczbą nieprzeczytanych, tym samym mechanizmem co
Rozmowa/Tablica w `/grupy/[id]` (patrz „Kropki na »Moje« i »Grupy«" wyżej) —
`kluczRozmowyWidziano()`, własne komentarze wyłączone z liczenia.

**Zakładka Wynik pokazuje treść uczestnikowi, nie tylko organizatorowi, zanim mecz się
zacznie.** Przed poprawką pusty ekran widział każdy, kto nie jest organizatorem/`can
ManageSquad` — trzy warunkowe bloki w `wynikFormSection` wymagały tej roli albo
`resultsAvailable`, a zwykły uczestnik przed startem meczu nie spełniał żadnego. Dziś
uczestnik widzi ten sam komunikat „Wynik pojawi się po zakończeniu meczu", co organizator
(z inną treścią — organizator widzi „Wynik można wpisać po rozpoczęciu…").

Karta „Po meczu" wskazuje zadania na innych zakładkach, więc jej przyciski **przełączają
zakładkę zamiast (albo obok) przewijania** — `onWpiszWynik` woła `goToTab('wynik')`,
`handleZaprosGosciaPoMeczu()` woła `goToTab('sklad')` przed `setRosterOpen(true)` i
`scrollIntoView`. Bez tego klik z innej zakładki niż cel trafiał w treść, która nie była
jeszcze zamontowana w DOM. Pełny opis → sekcja „Karta »Po meczu«" wyżej.

**Podział na drużyny renderuje się w dwóch zakładkach naraz** — Skład (jako domyślnie
zwinięty panel z przyciskiem „Podział na drużyny" ▾, stan `druzynyOtwarteWSkladzie`) i
Wynik (zawsze rozwinięty, bo to jej główna treść). To nie są dwie kopie: obie zakładki
renderują dokładnie ten sam JSX (`druzynySection`, wydzielony ze `skladWynikSection`) na
tym samym stanie z rodzica (`teamA`/`teamB`/handlery `TeamsPanel`), więc zmiana w jednym
miejscu — przypisanie gracza, losowanie, publikacja — jest natychmiast widoczna w drugim
bez żadnej synchronizacji: to dosłownie ten sam stan React, wyświetlony dwa razy.

**Rozmowa meczu jest domknięta REGUŁĄ W BAZIE, nie tylko warunkiem w komponencie**
(migracja `120`). Do tej pory polityka SELECT na `event_comments` brzmiała
`USING (deleted_at IS NULL)` — bez warunku na osobę, więc treść rozmowy dowolnego meczu,
także prywatnego, dało się pobrać jednym zapytaniem do REST-a bez zakładania konta.
`czy_widzi_rozmowe_meczu()` jest lustrem `mozeWidziecRozmowe` z `EventDetailClient`
(uczestnik — każdy wpis w `event_participants`, także oczekujący i obserwujący —
organizator, członek ekipy meczu) i stoi teraz w politykach SELECT oraz INSERT: pisać
w rozmowie może tylko ten, kto ma prawo ją czytać. Człon `OR auth.uid() = user_id`
w polityce SELECT stoi POZA tym warunkiem — inaczej autor, który zdążył wypisać się
z meczu, wpadłby przy kasowaniu własnej wiadomości w pułapkę opisaną w `100`
(polityka SELECT rządzi też widocznością wiersza PO zmianie, a kasowanie jest miękkie).

`RozmowaWydarzenia.tsx` to ten sam mechanizm i wygląd co `RozmowaGrupy.tsx` (chronologia
rosnąca, grupowanie wiadomości tej samej osoby, separatory dni, własny scroll z
auto-przewijaniem i przyciskiem powrotu, composer pod listą), ale **bez przypinania i bez
moderacji** — dane to płaskie `event_comments` (`lib/comments.ts`), bez kolumny na
przypięcie i bez odpowiednika `can_moderate_wall` na poziomie meczu. Każdy usuwa
wyłącznie swoją wiadomość, tak jak w dawnym `EventComments`. **Widoczna dla uczestników,
organizatora (bez względu na to, czy sam gra) i — gdy mecz jest przypięty do ekipy — dla
całej ekipy** (`myParticipation || isOwner || czlonekGrupyMeczu`, ten ostatni z osobnego
`isGroupMember()` doładowanego razem z `groupInfo`) — dawne komentarze widzieli wyłącznie
zapisani uczestnicy, co odcinało organizatora niegrającego i resztę ekipy od rozmowy
o własnym meczu. Na tej zakładce strona zachowuje się jak `/grupy/[id]` na Rozmowie:
`BottomNav` chowa się (`HideBottomNav`), a strona dostaje `h-[100dvh] overflow-hidden`,
żeby czat sięgał do dołu ekranu.

**Wysokość ekranu czatu bierze się z `visualViewport`, nie z `100dvh`**
(`lib/oknoCzatu.ts`, hak `useOknoCzatu()` w `EventDetailClient` i `GroupDetailClient`).
`viewport.interactiveWidget: 'resizes-content'` w `app/layout.tsx` załatwia sprawę na
Androidzie, ale na iOS-ie nie robi nic: `dvh` zostaje takie samo, a przeglądarka tylko
przesuwa widoczne okno w górę, żeby odsłonić pole tekstowe — i przesuwa je z zapasem,
przez co composer zatrzymywał się kilkadziesiąt pikseli NAD klawiaturą, a pod nim
świeciło tło strony (zgłoszone na iPhonie 15 Pro). `visualViewport.height` kurczy się
razem z klawiaturą na obu systemach, więc korzeń strony dostaje tę wysokość w pikselach
i nie ma już czego przewijać. Bez pomiaru (SSR, brak API) styl jest `undefined`
i zostaje `h-[100dvh]` z klasy.

Ten sam hak mówi, czy klawiatura jest otwarta, a to rozstrzyga **odstęp na pasek gestów
pod composerem**: przy schowanej klawiaturze kontener rozmowy dostaje
`pb-[…env(safe-area-inset-bottom)]`, bo bez tego composer siedzi pod samą kreską na dole
ekranu; przy otwartej odstęp znika, bo pasek gestów jest wtedy schowany za klawiaturą
i ten sam margines zrobiłby dokładnie tę pustkę, której unikamy. Otwarcie klawiatury
dociąga też listę na dół (`RozmowaWydarzenia`/`RozmowaGrupy`, prop `klawiatura`) — lista
kurczy się od dołu przy niezmienionym `scrollTop`, więc najnowsza wiadomość uciekała pod
krawędź dokładnie w chwili, gdy ktoś zaczynał na nią odpowiadać. Kto czytał starsze
wiadomości (`atBottom === false`), zostaje przy nich.

## Uprawnienia w grupie i lądowanie zaproszenia `/g/[kod]`

**Cztery niezależne przełączniki** (`can_manage_members`, `can_create_events`,
`can_invite`, `can_moderate_wall`, migracje `092`/`096`) — panel „Uprawnienia", dostępny
z dwóch miejsc: rozwijany przy członku w zakładce Skład i w osobnej zakładce
„Uprawnienia" na `/grupy/[id]/edytuj` (akordeon, rozwijany po imieniu). Obie ścieżki
widoczne wyłącznie założycielowi (RLS pozwala zmieniać te kolumny tylko jemu). Pełny
model → [docs/domena.md § Uprawnienia w grupie](./domena.md#uprawnienia-w-grupie).

Strona ustawień grupy (`/grupy/[id]/edytuj`) ma od tej zmiany zakładki: **Ogólne**
(nazwa, sport, miasto, boisko, opis, okładka, strefa niebezpieczna), **Zaproszenia**
(link, kod, rotacja kodu) i, wyłącznie dla założyciela, **Uprawnienia**.

**`/g/[kod]` to dziś lądowanie, nie sam redirect.** Serwerowy `page.tsx` czyta grupę,
najbliższy mecz i (gdy w adresie jest `?od=<uuid>`, zweryfikowane w bazie) imię
zapraszającego kluczem anonimowym — `groups` i `group_members` są publicznie czytelne,
więc to działa bez konta. `ZaproszenieClient.tsx` renderuje to wszystko i, dla
wylogowanego, formularz rejestracji (`AuthForm` w trybie `signup`, `next` wskazuje
z powrotem na `/grupy/[id]?dolacz=<kod>&od=<uuid>`) — dokładnie ta sama miękka ścieżka,
co przejęcie wpisu gościa (`/gracz/przejmij/[token]?auto=1`). Zalogowany odwiedzający
jest przekierowany od razu, bez migania tego widoku; `GroupDetailClient` widząc
`?dolacz=` dołącza go kodem automatycznie (`dolacz_do_grupy_kodem()`, migracja `094`)
i czyści adres. Stare linki `/grupy/[id]?join=1` (bez kodu) nadal się otwierają, ale
pokazują komunikat, że trzeba poprosić o nowy — bez kodu dołączenie od tej migracji nie
jest już możliwe (patrz niżej).

**Dołączenie do grupy wymaga kodu — zawsze.** Migracja `094` zdjęła politykę INSERT na
`group_members`, którą wcześniej wystarczało obejść, znając samo UUID grupy (publicznie
czytelne). Jedyne drogi wejścia: `dolacz_do_grupy_kodem()` (trzeba znać kod),
`dodaj_czlonka_do_grupy()` (trzeba mieć `can_manage_members`) i trigger przy założeniu
grupy. `joinGroup()` (surowy INSERT) zostało usunięte z `lib/groups.ts` —
zastępuje je `joinGroupByCode()`.

---

## Scalona wyszukiwarka: `/mapa` jest dziś celem „Szukaj"

Od 2026-08-23 dolna nawigacja prowadzi „Szukaj" na `/mapa` (dawniej `/wydarzenia`) —
`BottomNav.tsx` zmienia href, `MapaClient.tsx` przejmuje po `EventsListClient.tsx`
gaszenie pomarańczowej kropki „nowe wydarzenia w pobliżu" (`KLUCZ_WYDARZENIA_WIDZIANO`)
i plakietkę „Nowość" na kartach meczów (`isNew`/`widzianoWczesniej`, ten sam wzorzec).
Powód: dawne `/wydarzenia` i `/mapa` były dwoma osobnymi implementacjami tego samego
pytania („co jest grane / gdzie się gra") — Gry↔Obiekty na `/wydarzenia` NAWIGOWAŁO na
`/mapa`, więc przełączenie kosztowało przeskok strony i gubiło ustawienia.

**Pasek ma dziś JEDEN, stały kształt niezależnie od trybu** (`SearchToolbar` w
`VenueExplorer.tsx`) — trzy kontrolki, bo odpowiadają na trzy różne pytania:

| Kontrolka | Pytanie | Uwaga |
|---|---|---|
| `Gry \| Obiekty` (`SegmentedToggle`) | NA CO patrzę | pełny przełącznik, zmienia dane |
| `Lista \| Mapa` (`SegmentedToggle size="sm"`) | JAK patrzę | mniejszy wariant — świadomie WIDOCZNY, podpisany przełącznik, nie mały guzik z ikoną (guzik nie mówił, w jakim stanie jest teraz) |
| Ikona filtrów, z plakietką liczby aktywnych | CZEGO SZUKAM | reszta (sport, cena, odległość, typ obiektu, nawierzchnia, „Gry dziś", „Wolne miejsca", „Za darmo") zjeżdża do arkusza |

Sport, „Wolne miejsca"/„Za darmo" (tryb gier) i „Gry dziś" (tryb obiektów) **przeniosły
się z paska do arkusza filtrów** — wcześniej stały jako osobne pigułki i przełączenie
Gry↔Obiekty przestawiało je miejscami (zgłoszone wprost). Sport aplikuje się teraz na
szkicu, razem z resztą arkusza (`draftSports`), zamiast natychmiast po kliknięciu —
jedna reguła „Pokaż N" dla całej zawartości modala, nie dwie różne.

### Widok listy (mobile) — nowość

**Kadr startowy mapy meczów pokazuje WSZYSTKIE mecze, a przy znanej lokalizacji —
okolicę gracza** (`dopasujKadr()` w `GamesMarkersLayer`). Zgłoszone wprost: mapa
otwierała się „w miejscu, które jest pomiędzy meczami, z mocnym przybliżeniem".

Przyczyna nie była w matematyce kadru, tylko w MOMENCIE jego liczenia. `VenueExplorer`
trzyma mapę zamontowaną, ale z `display: none`, gdy wybrany jest widok „Lista" — żeby
Leaflet nie gubił kadru przy każdym przełączeniu. Kontener ma wtedy 0×0, a `fitBounds`
na zerowym kontenerze liczy MAKSYMALNE przybliżenie i środek prostokąta, czyli dokładnie
punkt pomiędzy meczami. `invalidateSize()` po przełączeniu na mapę naprawiało rozmiar,
ale nikt nie powtarzał dopasowania.

Dziś `dopasujKadr()` odmawia pracy przy kontenerze mniejszym niż 80 px (próg, nie `> 0`
— kontener w trakcie pokazywania potrafi mieć kilka pikseli) i dopisuje się na zdarzenie
`resize` Leafleta, które emituje `invalidateSize()`. Kadr liczy się więc dokładnie wtedy,
gdy jest co mierzyć. `maxZoom` zszedł z 14 na 13: przy jednym meczu `fitBounds` dobijał
do sufitu, a widok ulicy nie mówi nic o tym, gdzie ten mecz jest w mieście.

**Z lokalizacją gracza** (`gamesUserPos`) kadr obejmuje jego pozycję i mecze w promieniu
25 km. Gdy w tym promieniu nie ma nic, pokazujemy wszystko — „pusto w promieniu 25 km"
jest gorszą odpowiedzią niż „najbliższy mecz jest tutaj".

Pilnuje tego `e2e/mapa-kadr-startowy.klikalnosc.spec.ts` (dwa mecze po przeciwnych
stronach Polski; przy dopasowaniu do zerowego kontenera żadna pinezka nie jest w kadrze).

**`/mapa` otwiera się na OTWARTYCH MECZACH w liście, nie na katalogu boisk** (od
2026-08-26). Wcześniej domyślny był katalog, a gry wymagały `?gry=1`. Dolna nawigacja
obchodziła to własnym adresem (`hrefPelny: '/mapa?gry=1'`), ale każde INNE wejście —
kropka „Nowa gra w promieniu 5 km", udostępniony link, wynik z wyszukiwarki — lądowało
na obiektach, czyli na odpowiedzi na inne pytanie niż „w co mogę dziś zagrać". Katalog
~33 tys. obiektów z OSM jest podstawą pod SEO i „zorganizuj tutaj"; pierwszym ekranem dla
gracza są mecze (zgłoszone wprost).

Semantyka parametru odwrócona: `showGames = searchParams.get('gry') !== '0'`, a przy
wyjściu z gier w adresie ląduje `gry=0` (wcześniej gry zostawiały `gry=1`). Widok idzie za
trybem — `useState(showGames ? 'lista' : 'mapa')` — więc gołe `/mapa` to lista kart
z liczbą graczy, nie oddalona mapa ze skupiskami.

**Druga połowa tej zmiany jest równie ważna:** wszystkie wejścia, które naprawdę chcą
katalogu, mówią to teraz wprost adresem `?gry=0` — „Mapa boisk" w nagłówku i stopce,
landing, `/jak-dziala-bojo`, `/dlaczego-bojo`, strony `/boiska/*` i `/[sport]/[miasto]`,
powrót ze strony boiska (`backHref`), panele obiektu w `/admin` oraz **przełącznik
„Obiekty" na `/wydarzenia`** — ten ostatni bez `gry=0` odsyłałby z powrotem do gier.
Pilnuje tego `e2e/szukaj-domyslnie-mecze.klikalnosc.spec.ts`, sprawdzając obie strony
zamiany.

**Pusta lista obiektów nie jest ślepym zaułkiem — dobiera się SAMA, po współrzędnych**
(`components/map/PustaListaObiektow.tsx` + `pokazWokol()` w `VenueExplorer`).

Przy oddalonej mapie lista jest pusta Z ZAŁOŻENIA: w trybie skupisk z bazy lecą same
liczby w siatce, nie obiekty. Ten ekran przeszedł trzy wcielenia i warto znać powód
każdego kroku:

1. **Jeden przycisk „Przybliż tam, gdzie jest ich najwięcej"** — odpowiadał na pytanie,
   którego nikt nie zadaje (gracz nie szuka największego skupiska pinezek w Polsce), i
   kazał naprawić stan mapy, której w widoku „Lista" nawet nie widać. Został jako cichy
   odnośnik na końcu.
2. **Kafelki miast z liczbami z `fields.city`** — i tu skończyły się domysły. Zrzut
   z produkcji (2026-08-27) pokazał, ile ta kolumna jest warta: katalog ma **38 314
   obiektów**, a wszystkie największe miasta razem **~900** (Warszawa 303, Łódź 164,
   Poznań 54). Backfill lokalizacji (`scraper/backfill_lokalizacja.py`) przeszedł po
   jakichś **dwóch procentach**, więc kafelek kłamał liczbą I dowoził do garstki zamiast
   do wszystkiego, co w mieście jest. Kafelki, podpowiedzi miast w szukajce,
   `policzBoiskaWMiastach()`, `getFieldsWMiescie()` i `lib/miasta.ts` — wszystko usunięte.
3. **Dziś lista wypełnia się sama**, po `lat`/`lng`, które ma KAŻDY obiekt:
   - zgoda na lokalizację już udzielona → okolica gracza (`pozycjaBezPytania()`),
   - bez zgody → okolica Poznania (`POZNAN` w `lib/startowyPunkt.ts` — miasto, w którym
     Bojo startuje; środek geograficzny Polski to pole pod Łodzią, gdzie katalog nie ma
     nic ciekawego),
   - pusto wokół gracza → i tak pokazujemy Poznań, bo „pusto" nie jest odpowiedzią.

   Promień 15 km (`PROMIEN_LISTY_KM`), sortowanie po `distanceKm` — `kadrWokol()` daje
   KWADRAT (baza nie ma PostGIS), więc dopiero sortowanie robi z tego użyteczną kolejność.

**O zgodę na lokalizację NIE prosimy przy wejściu.** `pozycjaBezPytania()` (`lib/geo.ts`)
pyta Permissions API i pobiera pozycję tylko wtedy, gdy zgoda już jest; w przeciwnym razie
zwraca `null` i lista idzie na Poznań. Prośba z zaskoczenia przy starcie strony jest
odruchowo odrzucana, a odrzuconej zgody nie da się cofnąć inaczej niż w ustawieniach
przeglądarki — jedno niepotrzebne pytanie psuje tę drogę na trwałe. Pyta dopiero przycisk,
który człowiek nacisnął sam.

Pilnuje tego `e2e/pusta-lista-obiektow.klikalnosc.spec.ts`.

Do 2026-08-23 `/mapa` na telefonie było wyłącznie mapą: przewijana lista obiektów/meczów
istniała tylko na desktopie (`<aside>`, `hidden md:flex`), bo tam jest miejsce na pasek
boczny obok mapy. Telefon dostawał jedną kartę — tę, której pinezkę dotknięto — i żadnego
sposobu przejrzenia wyników jak listy.

`widok: 'lista' | 'mapa'` (lokalny stan, bez synchronizacji z URL — nie ma tu nawigacji
do zachowania) rządzi tym samym `<aside>`, który wcześniej był desktop-only:
`widok === 'lista'` pokazuje go na PEŁNĄ szerokość na obu breakpointach (bez mapy obok);
`widok === 'mapa'` wraca do dotychczasowego układu (mobile: mapa + jedna karta; desktop:
lista + mapa obok siebie, bez zmian). Mapa **nie jest odmontowywana** przy przełączeniu
na listę (`hidden`, nie unmount) — Leaflet trzyma kadr/zoom we własnej instancji, a nie
w stanie Reacta, więc odmontowanie zerowałoby widok do całej Polski przy każdym powrocie.
`mapInstance.invalidateSize()` (w `useEffect` po `widok`) doprowadza canvas do właściwego
rozmiaru po powrocie z `display: none`, gdzie miał zerowy rozmiar.

## Układ `/mapa` — szukanie, filtry, powrót z boiska

**Szukanie po tekście działa poza bieżącym kadrem.** Wcześniej pole szukania filtrowało
wyłącznie `allFields` — to, co i tak było już wczytane dla widocznego fragmentu mapy: przy
oddaleniu (tryb skupisk) ta lista jest pusta, więc szukanie nic nie znajdowało; przy
przybliżeniu ograniczało się do tego, co widać, więc wpisanie miasta spoza kadru też nic
nie dawało. Od dwóch znaków zapytania (debounce 300 ms) `VenueExplorer` woła
`searchExplorerFields()` z `lib/api.ts` — funkcję, która już istniała (używają jej
pickery lokalizacji), tylko nigdy nie była tu wpięta — i mapa robi `fitBounds` do
wyników. Tryb skupisk wyłącza się na czas aktywnego szukania niezależnie od przybliżenia.

**Dwie poprawki z 2026-08-27, obie na to samo zgłoszenie** („po wyszukaniu np. »poznan«
w widoku mapy nie działa rozbijanie zgrupowanych pinesek i wgl całość się pierdoli"):

- **Kółka skupisk znikają na czas szukania.** `trybSkupisk` był liczony poprawnie
  (`search.trim().length < 2 && zoom < ZOOM_SKUPISK`), ale `WarstwaSkupisk` renderowała
  się bezwarunkowo, a efekt pobierający dane dla kadru wychodzi wcześniej, gdy trwa
  szukanie („aktywne szukanie ma własne źródło"), więc `skupiska` nigdy nie było
  czyszczone. Po wpisaniu miasta mapa doleciała do wyników — i NA wynikach leżały kółka
  z liczbami sprzed szukania. To wyglądało jak zepsute rozbijanie grup, bo mapa ma dwa
  różne grupowania, których użytkownik nie odróżnia: kółko ze skupiska tylko przybliża
  (`flyTo(zoom + 3, max 14)`, czyli po `fitBounds` do wyników na przybliżeniu 15
  ODDALA), a grupę z `L.markerClusterGroup` klik naprawdę rozbija.
- **Szukanie przestało gubić ogonki.** Lokalny filtr tekstowy robił
  `name.toLowerCase().includes(q)`, więc „poznan" nie zawierało się w „Orlik Poznań"
  i filtr wyrzucał WSZYSTKO, co przyszło z serwera. Dziś idzie przez `foldText()`
  /`foldedIncludes()` z `lib/searchText.ts` — helper istnieje od tego samego błędu na
  `/wydarzenia` („pilka" nie znajdowało „piłka nożna"), tylko nigdy nie był wpięty
  w mapę.

**Strona serwera domknięta migracją `126`.** Sam filtr lokalny nie wystarczał: to filtr
NA TYM, co przyszło z serwera, a serwer nie zwracał nic. `searchExplorerFields()` robił
`ilike '%poznan%'` na `name`/`address`, a Postgres porównuje znak po znaku — „poznan" nie
jest zgodne z „Poznań". Wpisanie miasta zwracało ZERO wyników przy 38 tysiącach obiektów
w katalogu. Dziś `fields` ma kolumnę generowaną `szukaj_norm` (nazwa + adres, małymi
literami, bez ogonków) z indeksem GIN po trigramach, a zapytanie idzie po niej, z frazą
przepuszczoną przez ten sam `foldText()`.

**Obie strony MUSZĄ składać tekst identycznie** — `translate()` w migracji i `foldText()`
w przeglądarce. Filtr lokalny przepuszcza dalej to, co znajdzie serwer, więc rozjazd
którejkolwiek strony wycina wyniki po cichu.

`searchExplorerFields()` ma wyjście awaryjne na stare `or(...)`, gdy kolumny jeszcze nie
ma — migracje puszcza się w Bojo ręcznie, a szukajka nie może wywalać się na czerwono
tylko dlatego, że migracja czeka w kolejce. Rozpoznaje po kodzie `42703` (Postgres) albo
`PGRST204` (pamięć podręczna schematu PostgREST).

Pilnuje tego `e2e/szukanie-skupiska.klikalnosc.spec.ts` (kółka skupisk i filtr lokalny)
oraz `src/__tests__/szukanieBezOgonkow.test.ts` (zapytanie do bazy i wyjście awaryjne).

**Pinezki na mapie i lista mają OSOBNE źródła — od 2026-08-27.** Zgłoszone wprost:
„pinezki znikają". Lista startowa (okolica gracza albo Poznania, dobierana przy wejściu)
wpisywała się w `searchResults`, a z tego samego pola żyły pinezki
(`searchResults ?? allFields`). Po wejściu do katalogu mapa pokazywała więc Poznań
NIEZALEŻNIE od tego, dokąd użytkownik przewinął — nad Krakowem pinezki po prostu znikały,
bo te jedyne, które istniały, leżały 400 km dalej. Dziś:

- `searchResults` znaczy WYŁĄCZNIE „wynik szukania po tekście",
- `listaStartowa` to osobny stan, widziany tylko przez LISTĘ i tylko w trybie skupisk
  (gdy `allFields` jest puste z założenia),
- `fieldsNaMapie` (mapa) = kadr albo wyniki szukania; `fields` (lista) = to samo plus
  wspomniany wyjątek. Wspólna funkcja `zastosujFiltry()` trzyma oba w zgodzie — rozjazd
  znaczy „widzę pinezkę, której nie ma na liście".

**Filtry katalogu zatwierdzają się JEDNYM `updateParams`.** Zgłoszone wprost: „filtry się
resetują". `onApply` wołał cztery settery pod rząd (`setVenueTypes`, `setSurfaces`,
`setSports`, `setOnlyGamesToday`), a każdy budował nowy adres z `searchParams`, które
**nie odświeża się synchronicznie**. Cztery wywołania czytały więc ten sam stan sprzed
kliknięcia i nadpisywały się nawzajem: wygrywało ostatnie (`today`), a Sport, Typ
i Nawierzchnia znikały dokładnie w chwili zatwierdzania. Dlatego filtry NIE mają dziś
setterów per pole — arkusz oddaje wszystkie pola naraz.

Obie poprawki pilnuje `e2e/mapa-pinezki-i-filtry.klikalnosc.spec.ts`.

**Przycisk „Filtry" ma dziś 44×44 px, chipy filtrów niosą `aria-pressed` — od
2026-08-30.** Przycisk był `h-9 w-9` (36 px) — poniżej progu WCAG 2.5.5 i mniejszy
niż sąsiedni `LocateMeButton`, z którym stoi w jednym rzędzie. Sześć grup
przełączalnych przycisków w `VenueExplorer.tsx` (sport w trybie gier, sport w
trybie katalogu, typ obiektu, nawierzchnia) dostało `aria-pressed`, żeby czytnik
ekranu mówił, który wybór jest aktywny — `TogglePill` (`components/ui/FilterPill.tsx`)
już to miał, tylko nie te przyciski w arkuszu filtrów.

**Pinezki z kadru nie znikają już po szukaniu, które trafiło w zero wyników —
`UnifiedLocationPickerImpl.tsx` (piker w kreatorze), od 2026-08-30.** Zgłoszone
wprost: „wpisz «Orlik Poznań» → znikają wszystkie pinezki z mapy". `znalezione ?? fields`
podmieniało źródło pinezek na pustą tablicę w tej samej chwili, w której pojawiał się
komunikat „nie znaleziono" — mapa traciła WSZYSTKIE pinezki z kadru zamiast pokazać
pustkę tylko tam, gdzie realnie jej szukano. Dziś zero wyników wraca do `fields`
(kadr): `znalezione && znalezione.length > 0 ? znalezione : fields`.

## Filtr „miejscowość + ile km"

Arkusz filtrów — w OBU trybach, gier i katalogu — otwiera sekcja **„Gdzie szukam"**:
pole na nazwę miejscowości albo **kod pocztowy**, a po wyborze promień (5/10/25/50 km,
domyślnie 10).

**Znowu miasta, a przecież `fields.city` odpadło?** To jest inny mechanizm i dlatego
działa. Kolumna `fields.city` jest wypełniona w jakichś dwóch procentach, więc filtr po
NAZWIE mówiłby „w Poznaniu 54 boiska" przy kilkuset. Tu miejscowość służy wyłącznie do
wyznaczenia PUNKTU (`lat`/`lng`), a dobór idzie po odległości — a współrzędne ma każdy
obiekt w katalogu i każdy mecz. Wynik nie zależy od backfillu lokalizacji.

**Gotowym modułem jest Nominatim przez własne proxy** `/api/geocode` — to samo, którego
używają pickery lokalizacji, więc nic nowego do utrzymania. Tryb `?miejscowosc=` zwraca
LISTĘ (`limit=6`) z `featuretype=settlement`, żeby podpowiadać miejsca, a nie dowolne
adresy („Kwiatowa 3" nie jest odpowiedzią na „gdzie szukam boisk"). **Kod pocztowy jest
wyjątkiem od `featuretype`**: kod nie jest osadą, więc z tym ograniczeniem Nominatim nie
zwróciłby nic — rozpoznajemy polski format (`61-001`, też bez myślnika) i wtedy pytamy
bez niego. Podpowiedzi mają debounce 350 ms (polityka użycia Nominatima) i **nigdy nie
rzucają wyjątkiem**: pole podpowiedzi, które wywala ekran, jest gorsze niż pole bez
podpowiedzi.

Stan siedzi w adresie (`m`, `mlat`, `mlng`, `mopis`, `km`), więc wraca z „wstecz" i daje
się wysłać linkiem. Konsekwencje wyboru:

- **katalog** — osobne zapytanie o kadr wokół punktu (nie filtrowanie `allFields`: przy
  oddalonej mapie `allFields` jest puste, więc filtr nie miałby czego zawężać), lista
  sortowana po odległości, mapa leci w to miejsce z przybliżeniem dobranym do promienia,
- **mecze** — wybrana miejscowość BIJE położenie gracza (kto wpisał „Wrocław", pyta
  o Wrocław, choćby stał w Poznaniu) i staje się środkiem istniejącego filtra promienia.
  O zgodę na lokalizację wtedy nie pytamy — byłoby to pytanie o coś, czego nie użyjemy.

Pilnuje tego `e2e/filtr-miejscowosci.klikalnosc.spec.ts` (geokoder podstawiony
`page.route()`, żeby scenariusz nie zależał od cudzego serwera).

**Trzy poprawki z sesji QA (2026-08-28), wszystkie w widoku „Lista" po
`/mapa` → „Obiekty" → „Lista"** — czyli mapa NIGDY nie dostaje realnego
rozmiaru (montuje się od razu z `display:none`, bo `widok` startuje jako
'lista' w trybie gier i przełącznik „Obiekty" tego nie zmienia):

- **Licznik nad listą pokazywał „0 boisk" nad pełną listą.** Liczył z
  `wKadrze` — sumą skupisk z KADRU MAPY — a lista renderowała się z zupełnie
  innego źródła (`listaStartowa`/`listaWokolMiejscowosci`, patrz sekcja
  „Pusta lista" niżej). Skoro mapa nigdy nie dostaje kadru, skupiska nigdy
  się nie liczą, a lista i tak ma treść. Dziś licznik nad listą i podgląd
  „Pokaż N boisk" w arkuszu liczą z `fields.length` — z tego samego źródła,
  co karty pod spodem. `wKadrze` zostaje wyłącznie dla nakładki NAD SAMĄ
  MAPĄ („N boisk w tym widoku"), gdzie „w tym widoku" naprawdę znaczy kadr
  Leafleta.
- **Po wybraniu miejscowości lista bywała (pozornie) pusta, dopóki ktoś nie
  przełączył Mapa→Lista.** Sprawdzone: mapa ukryta nie aktualizuje kadru
  wcale (Leaflet nie odpala `moveend`/`zoomend` na niezaładowanym
  kontenerze), więc `listaWokolMiejscowosci` i tak dociąga się poprawnie,
  własnym zapytaniem, bez udziału mapy. Prawdziwa przyczyna: W TRAKCIE tego
  zapytania `fields` spada na `listaStartowa` (STARĄ okolicę), która po
  przefiltrowaniu do nowo wybranego sportu/typu często wychodzi na zero —
  i wtedy renderował się pusty stan z przyciskami „Pokaż blisko mnie"/
  „Przybliż", nie na temat tuż po wybraniu konkretnego miejsca. Dziś ten
  ułamek sekundy ma własny stan — „Szukam w okolicy: «nazwa»…” — zamiast
  pustego stanu, który sugerował trwałą usterkę.
- `KadrObserwator` dostał przy okazji osłonę na kontener mniejszy niż 80×80
  (ten sam wzorzec co `GamesMarkersLayer.dopasujKadr`) — defensywne
  dociągnięcie do reszty kodu, nie mechanizm naprawiający punkt wyżej.

Pilnuje tego `e2e/mapa-licznik-i-miejscowosc-lista.klikalnosc.spec.ts`
(druga naprawa sprawdzona z celowo OPÓŹNIONĄ odpowiedzią sieciową — inaczej
zapytanie zawsze się kiedyś kończy i test przechodziłby również z regresją,
zanim ktokolwiek zobaczyłby mylący pusty stan).

**Powrót ze strony boiska wraca na ten sam obiekt.** Karta „Zobacz boisko" (`VenueCard`)
linkuje do czystego `/boisko/<slug>` (bez parametrów) i przy kliknięciu zapamiętuje cel
powrotu (`/mapa?boisko=<id>`) w `sessionStorage` przez `lib/powrot.ts` — dawniej jechał
w `?wroc=` w samym URL-u, ale to znaczyło dwa różne, niekanoniczne adresy tej samej
strony boiska do zeskanowania przez wyszukiwarki (jeden z mapy, jeden ze strony meczu),
mimo że `canonical` i tak zwijał je w jeden przy indeksowaniu (migracja `112`, SEO/GEO).
Strona boiska (`VenueDetailClient.tsx`) odczytuje ten cel z `sessionStorage` po
zamontowaniu, `VenueExplorer` już umiał obsłużyć `?boisko=<id>` po wejściu z linku
(`boiskoZLinku`) — brakowało tylko połączenia obu gotowych mechanizmów. Link ze strony
meczu (`EventDetailClient.tsx`) do boiska działa tak samo.

**Filtry — ikona „Filtry" + modal, jak na `/wydarzenia`.** Od 2026-08-23 WSZYSTKO
(Sport, „Gry dziś", Typ obiektu, Nawierzchnia) siedzi w `FilterSheet` — patrz „Scalona
wyszukiwarka" wyżej. Nic z tego nie stoi już w pasku jako osobna, zawsze-widoczna
pigułka:

| Filtr | Gdzie | Uwaga |
|---|---|---|
| Sport | w modalu, sekcja „Sport" | źródło `MAP_FILTER_SPORTS` (`lib/sports.ts`) — **6** opcji, nie 4: dołożone `wielofunkcyjne` (4118 obiektów) i `piłka ręczna` (806), które miały już kolorową pinezkę na mapie, ale nie dało się ich wybrać w filtrze |
| „Gry dziś" | w modalu, `TogglePill` | bez zmian w działaniu, tylko przeniesiona z paska |
| Typ obiektu | w modalu | lista bez zmian, tylko przeniesiona z zawsze-widocznego dropdownu |
| Nawierzchnia | w modalu | checklist: Trawa naturalna / Sztuczna trawa / Nawierzchnia twarda / Piasek / Beton / Mączka ceglana; etykiety przez `surfaceLabel()` z `lib/labels.ts` |

„Otwarte gry" (obiekt ma co najmniej jeden mecz, na który da się jeszcze dołączyć) było
tu przez chwilę jako osobny przełącznik — usunięte jako zbędne obok „Gry dziś" i trybu
„Gry | Obiekty" (patrz niżej), którego tryb „Gry" pokazuje realnie otwarte mecze wprost jako pinezki.

**Dlaczego Typ obiektu przestał być zawsze widoczny, a Nawierzchnia się pojawiła:**
`venue_type` ma dziś **98,3%** publicznych obiektów jako `NULL` (import z OSM go nie
ustawia) — wybranie jakiegokolwiek konkretnego typu wyglądało jak zepsuta wyszukiwarka,
bo odsiewało niemal cały katalog. `surface` ma dane w **37%** wierszy z realnym
zróżnicowaniem (trawa, nawierzchnia twarda, piasek, beton, sztuczna trawa, mączka) — to
jest facet, który realnie coś filtruje, mimo że wcześniej nie dało się po nim szukać.
Kolumna `surface` dołączona do okrojonego `EXPLORER_COLS` w `lib/api.ts` (istniała w
tabeli, po prostu nie była pobierana) — zero migracji.

Modal ma tę samą mechanikę szkicu co na `/wydarzenia`: wybory w „Typ obiektu"/
„Nawierzchnia" aplikują się dopiero po „Pokaż N obiektów", „Wyczyść" resetuje szkic bez
zamykania. Renderowany **raz** na komponent (nie raz na sidebar desktopu i raz na
mobilny overlay) — oba przyciski „Filtry" otwierają ten sam, współdzielony stan.

**Licznik „Pokaż N obiektów" w trybie skupisk** (domyślny widok całej Polski, mapa
oddalona) liczy się z `wKadrze` (suma z kółek skupisk, uwzględnia już filtr sportu),
nie z `allFields` — w tym trybie `allFields` jest zawsze pustą tablicą (obiekty
pobiera się dopiero po przybliżeniu, patrz niżej), więc liczenie z niej dawało zawsze
„Pokaż 0 obiektów" niezależnie od tego, ile realnie było w kadrze. Typ obiektu
i Nawierzchnia i tak nie mają w tym trybie efektu (brak per-obiektowego rozbicia
w danych ze skupisk), więc podgląd pokazuje to, co faktycznie widać na mapie.

Filtr nawierzchni działa **tylko w trybie pojedynczych obiektów** (przybliżenie ≥ próg
skupisk) — w trybie skupisk (oddalona mapa) nie jest przekazywany do
`getExplorerClusters()`, dokładnie tak jak już wcześniej działało „Gry dziś". Sport
i Typ obiektu działają w obu trybach — RPC `mapa_skupiska` przyjmuje
generyczne tablice `p_sporty`/`p_typy`, więc nowe wartości sportu przechodzą bez żadnej
zmiany funkcji.

**Zalogowany na mobile** dostaje w tym samym pływającym wierszu co pole szukania również
`MobileIdentityRow` (dzwonek + awatar) — Header na tej trasie chowa swój pasek, patrz
„Górny pasek nawigacji" wyżej.

**Przycisk „Zlokalizuj mnie"** (prawy dolny róg) ma ikonę `LocateFixed` (celownik) —
wcześniej był tu `MapPin` (pinezka), myląca ikona dla akcji „pokaż moją okolicę".
Wspólny komponent `components/map/LocateMeButton.tsx`, patrz niżej.

### Tryb gier — przełącznik „Gry | Obiekty"

Segmentowany przełącznik (`components/ui/SegmentedToggle.tsx`) na początku paska
przełącza **cały** pasek i **cały** `<MapContainer>` między dwoma trybami, bez
remontowania mapy (zoom/pan usera zostaje, tylko podmieniają się warstwy pinezek).

Wcześniej był to `TogglePill` „Pokaż gry" — wyłączony pill nie mówił, w jakim trybie
mapa jest teraz, tylko czego brakuje. Oba tryby są równorzędne, więc widać oba naraz;
semantyka i URL bez zmian („Gry" = dotychczasowe `?gry=1`).

`SegmentedToggle` jest generyczny (dwie opcje `{ value, label }`, `role="radiogroup"`),
z kontenerem `grid grid-cols-2` — wskaźnik ma stałą szerokość połowy kontenera, więc
przy `flex` szerszy tekst przesunąłby podświetlenie obok przycisku, który podświetla.

| | „Obiekty" (domyślnie) | „Gry" |
|---|---|---|
| Pasek | `Gry\|Obiekty` / `Lista\|Mapa` / Filtry (patrz „Scalona wyszukiwarka" wyżej — identyczny kształt w obu trybach) | jw. |
| Modal „Filtry" | Sport(6) / „Gry dziś" / Typ obiektu / Nawierzchnia | Sport(4) / „Wolne miejsca" / „Za darmo" / Kiedy / Odległość / Cena / Wolne miejsca (suwak) |
| Pinezki (widok „Mapa") | boiska, `MapLayer`/`WarstwaSkupisk` (bez zmian) | mecze, `GamesMarkersLayer` (emoji sportu + etykieta „kiedy", swipe w panelu, zamykanie kliknięciem w puste miejsce mapy) |
| Źródło danych | `getExplorerFields`/`getExplorerClusters` (viewport-scoped) | `events` — **to samo**, co już pobierane wyżej dla `fieldStats`; zero nowego zapytania |
| Karta wyniku (lista/sidebar/karta wybranej pinezki) | `VenueCard` | `EventBrowseCard`, z plakietką „Nowość" (`isNew`) na liście — patrz „Scalona wyszukiwarka" |

**Sortuj nie ma tu UI** — kolejność pinezek/karty listy zostaje na stałe chronologiczna
(`gamesSort` to dziś stała `'termin'`), niezależnie od tego, czy widok jest listą czy
mapą: to jedyna kolejność, która ma sens w OBU. Nie mylić z widokiem „Lista" (2026-08-23,
wyżej) — ten pokazuje wyniki jako przewijaną listę zamiast pinezek, ale nie dokłada
wyboru KOLEJNOŚCI.

Stan trybu gier (`gamesSort`, `gamesDate`, `gamesRadius`, `gamesMaxPriceGrosze`,
`gamesMinFreeSpots`, `gamesOnlyFreeSpots`, `gamesOnlyNoCost`) jest **lokalny**, nie w URL
— spójnie z tym, że `/wydarzenia` też nie trzyma swoich filtrów w adresie. Jedyny stan
trybu w URL to sam przełącznik: `?gry=1`, ten sam wzorzec co `today`/`open`.

Filtr `sports` jest **współdzielony** między oboma trybami (ten sam parametr URL
`?sport=`). Przełączenie na „Gry" ma guard: jeśli w `sports` jest wartość spoza
`FOCUS_SPORTS` (np. `wielofunkcyjne` — sensowna tylko jako opis obiektu, żaden mecz nigdy
nie ma takiego sportu), filtr się czyści zamiast po cichu zerować wyniki.

---

## Powiadomienia — co realnie istnieje

Wbrew starszym notatkom kanał powiadomień **jest zbudowany**:

| Element | Gdzie |
|---|---|
| Tabela `notifications` | migracja `025` |
| Logika | `lib/notifications.ts` |
| UI (dzwonek) | `components/layout/NotificationBell.tsx`, renderowany w `Header.tsx` |
| E-mail | Edge function `notify-game-alert` → Resend |
| SMS | Edge function `send-event-sms` → SMSAPI + Twilio |
| Zaproszenia cykliczne | Edge function `send-invites` |

Wpisy do `notifications` powstają wyłącznie z wyzwalaczy w bazie albo z wąsko
uprawnionych funkcji RPC (`SECURITY DEFINER`) — tabela ma polityki SELECT i UPDATE dla
własnych wierszy i **żadnej polityki INSERT**, więc przeglądarka nie może wpisać
powiadomienia nawet sobie bez przejścia przez taką funkcję. Dziś jest ich pięć: oferta
zwolnionego miejsca (`062`), akceptacja zapisu i zmiana terminu (`065`), imienne
zaproszenie (`067`) oraz **odwołanie meczu i konto bez nazwy** (`070`).

**Konto bez nazwy — wyzwalacz z `070`/`071` w praktyce nigdy nie zadziałał.**
Potwierdzone zapytaniem po danych produkcyjnych: zero wierszy typu `uzupelnij_profil`
mimo dziesiątek kont bez pełnej nazwy, przyczyna nieznana. Migracja `086` dodaje RPC
`zglos_brak_pelnej_nazwy()`, wołaną z `lib/auth.tsx` przy `SIGNED_IN` dla świeżych kont
(< 10 min), tym samym warunkiem `isPelneImie()` co baner na pulpicie
(`UzupelnijProfilBanner.tsx`) — niezawodny odpowiednik po stronie klienta. Wyzwalacz
zostaje jako potencjalny drugi nadawca; `NOT EXISTS` w RPC chroni przed duplikatem.

`celPowiadomienia()` (`lib/notifications.ts`, użyta przez `NotificationBell`) linkuje
powiadomienie do meczu przez `event_id`; te bez `event_id`, ale z `group_id` (ogłoszenie
na tablicy grupy, migracja `093`) — na `/grupy/{group_id}`; resztę bez żadnego z nich —
przez mapę `TYP_NA_TRASE` (dziś: `uzupelnij_profil` → `/profil`). Bez tego routingu
renderowały się jako martwy, nieklikalny wiersz. **Wiadomość prowadzi wprost na
zakładkę** (`wiadomosc_w_meczu` → `?tab=rozmowa`, `wiadomosc_w_grupie`/`ogloszenie_w_grupie`
→ `?tab=tablica`, migracja `119`) — kliknięcie w powiadomienie o wiadomości ma otwierać
rozmowę, nie domyślną zakładkę meczu/grupy. Ta sama reguła (typ → tab) jest
zduplikowana w `adresPowiadomienia()` w `supabase/functions/send-push/index.ts` (Deno,
osobny runtime — nie da się dzielić importu), żeby push prowadził dokładnie tam, gdzie
dzwonek.

**Dzwonek jest DWA — powiadomienia i wiadomości osobno** (zgłoszone wprost: „ktoś
napisał" ginęło w tej samej liście co „nowy mecz w grupie"). `TYPY_WIADOMOSCI`
(`lib/notifications.ts`: `wiadomosc_w_meczu`, `wiadomosc_w_grupie`, `ogloszenie_w_grupie`)
dzieli listę na dwa niezależne panele w `NotificationBell.tsx` — chmurka (`MessageCircle`,
plakietka różowa zgodnie z konwencją kolorów z AGENTS.md) obok dzwonka. Każdy panel ma
własne „otwarcie oznacza jako przeczytane" — otwarcie chmurki nie gasi nieprzeczytanej
prośby o dołączenie w dzwonku, i odwrotnie.

**Wiadomość w oknie ciszy odświeża powiadomienie, nie ginie** (migracja `122`).
`powiadom_o_wiadomosci_w_meczu()`/`powiadom_o_wiadomosci_w_grupie()` (`109`/`111`) wstawiają
najwyżej jedno powiadomienie na odbiorcę na rozmowę na godzinę — celowa ochrona przed
spamem, rozmowa przed meczem potrafi mieć trzydzieści wiadomości w kwadrans. Do `122`
druga i kolejna wiadomość w tej samej godzinie po prostu nie zostawiała śladu: istniejący
wiersz zostawał z treścią PIERWSZEJ wiadomości z godziny (zgłoszone wprost — panel
„Wiadomości" pokazywał starszą godzinę niż osobny, nieprzepustowany panel „Nieprzeczytane
rozmowy"). Teraz kolejna wiadomość w oknie godziny podmienia treść istniejącego wiersza na
najnowszą, przesuwa `created_at` na `now()` i cofa `read_at` do `NULL`. Limit (najwyżej
jedno powiadomienie na godzinę) zostaje; push nie dubluje się, bo `trg_wyslij_push` (`102`)
łapie wyłącznie `INSERT`, nie `UPDATE`. `NotificationBell.tsx` dostaje drugą subskrypcję
real-time na `UPDATE` obok istniejącej na `INSERT`, żeby odświeżony wiersz pokazał się na
żywo bez przeładowania panelu.

**Kliknięcie w powiadomienie push oznacza je jako przeczytane w dzwonku** (migracja
`119`). Service worker (`public/sw.js`) nie ma dostępu do sesji Supabase, więc nie może
sam wykonać `UPDATE notifications`; wyzwalacz `wyslij_push_po_powiadomieniu()` dokłada
`id` wiersza do payloadu wysyłanego przez `send-push`, `sw.js` doczepia go do adresu jako
`?przeczytaj=<id>` po kliknięciu, a `NotificationBell.tsx` czyta ten parametr przy
montażu i woła `markRead([id])`. Wcześniej dzwonek oznaczał wszystko na raz WYŁĄCZNIE przy
otwarciu panelu w aplikacji — push to inna ścieżka, o której dzwonek nic nie wiedział.

**Liczba nieprzeczytanych na IKONIE APLIKACJI** (Badging API, `lib/plakietkaAplikacji.ts`).
Chmurka i dzwonek w nagłówku mówią o nieprzeczytanych dopiero temu, kto już otworzył Bojo;
push jest sygnałem jednorazowym i po zniknięciu z ekranu blokady nie zostawia śladu.
Plakietka z liczbą zostaje na ikonie, dopóki jest co przeczytać. Liczba to **suma obu
paneli** (wiadomości + reszta) — na ikonie jest miejsce na jedną, a rozróżnienie niesie
w aplikacji kolor (patrz konwencja w AGENTS.md), czego ikona systemowa i tak nie odda.

Ustawiana w DWÓCH miejscach, bo żadne nie wystarcza samo:

| Kiedy | Kto | Skąd liczba |
|---|---|---|
| aplikacja otwarta | `NotificationBell.tsx` (efekt na `unreadWiadomosci + unreadReszta`) | zna stan wprost, także po oznaczeniu jako przeczytane |
| aplikacja zamknięta | `public/sw.js` przy zdarzeniu `push` | pole `nieprzeczytane` doklejone do payloadu przez `send-push` |

Service worker nie ma dostępu do sesji Supabase, więc sam liczby nie policzy — funkcja
brzegowa robi `count` na `notifications` (`read_at IS NULL`) tuż przed wysyłką; wyzwalacz
`trg_wyslij_push` odpala się PO wstawieniu wiersza, więc świeże powiadomienie już się
liczy. Gdy licznik padnie, pole jedzie jako `null` i worker **plakietki nie dotyka** —
zdjęcie jej w chwili, gdy przychodzi powiadomienie, byłoby gorsze niż liczba nieaktualna
o jeden; aplikacja wyrówna ją przy najbliższym otwarciu.

Plakietka działa **wyłącznie w zainstalowanej aplikacji** (Android/Chromium po instalacji
PWA; iOS 16.4+ po dodaniu do ekranu początkowego **i** zgodzie na powiadomienia). W karcie
przeglądarki `setAppBadge()` odrzuca obietnicę albo metody w ogóle nie ma, dlatego każde
wywołanie jest wykrywane i łykane po cichu — brak plakietki jest brakiem wygody, nie
błędem, a wyjątek leciałby z efektu Reacta przy każdym powiadomieniu
(`plakietkaAplikacji.test.ts` pilnuje, że żaden wariant nie rzuca).

**Zmiana w `send-push` wymaga wdrożenia funkcji brzegowej** (Actions → „Wdróż funkcje
brzegowe"). Sam merge jej nie wdraża — do tego czasu plakietka stawia się wyłącznie przy
otwartej aplikacji.

**Nowy mecz w grupie ma wyzwalacz** — `powiadom_o_nowym_meczu_w_grupie()`, migracja
`072`: każdy `INSERT` do `events` z ustawionym `group_id` wstawia powiadomienie
wszystkim członkom grupy poza organizatorem. Jedyna otwarta luka wobec wizji to
`game_alerts` (promień + sport, oparte o lokalizację, nie o członkostwo) — wciąż za
flagą `SHOW_GAME_ALERTS`, [luka 2 wobec wizji](./wizja.md#3-luki), i to jest inna
funkcja niż powiadomienie o meczu w grupie.

**Trzy nowe typy z migracji `097`** (patrz „Czy gramy?" wyżej): `pytanie_o_udzial` —
RPC `zapytaj_milczacych()`, wołana ręcznie przez organizatora, nie wyzwalacz; jedyny typ
w `WYMAGA_AKCJI` z zamknięciem po DWÓCH stronach (dołączenie **albo** jawna odmowa w
`event_declines` zamykają sprawę jednakowo). `gra_potwierdzona`/`gra_zagrozona` —
wyzwalacz `powiadom_o_progu_gry()` na `event_participants`, wzorem `079`: reaguje na
PRZEKROCZENIE `min_players` w obie strony, nie na każdy zapis, i pomija osobę, której
własny zapis/wypis spowodował zmianę (ona już wie). Wszystkie trzy typy są dziś martwe
w praktyce: `pytanie_o_udzial` bo nic już nie woła RPC (usunięte 2026-08-16), a
`gra_potwierdzona`/`gra_zagrozona` bo UI do ustawienia `min_players` jest schowane za
`SHOW_MIN_PLAYERS_THRESHOLD` (wyłączona 2026-08-21) — trigger i typy zostają w bazie,
`lib/notifications.ts` nadal umie je wyświetlić, gdyby kiedyś powstał wpis.

**Przypięty wpis na tablicy grupy też powiadamia** (`ogloszenie_w_grupie`, migracja
`093`) — jedyny typ wpisu na tablicy, który to robi; zwykły wpis nikogo nie powiadamia,
żeby dzwonek nie zamienił się w kanał czatu.

**Komplet i zwolnione miejsce (migracja `079`).** Organizator nie dowiadywał się
o zmianie stanu składu — jedyny wyzwalacz na `DELETE` z `event_participants`
powiadamiał odrzuconego gracza, nie jego. Nowy wyzwalacz na `event_participants`
(INSERT/UPDATE/DELETE) wysyła `komplet_skladu`, gdy skład przechodzi z niekompletnego
w pełny, i `zwolnilo_sie_miejsce`, gdy komplet się rozpada — w obie strony wyłącznie
przy zmianie STANU, nie przy każdym zapisie z osobna.

---

## Plakietka „Wczesny etap" na landingu

Pozycje w `components/home/landing/content.ts` mogą mieć opcjonalne pole
`wczesnyEtap: true`. Karta renderuje się wtedy wyciszona (`opacity-80`, ikona
`bg-slate-100 text-slate-400`) i dostaje plakietkę `WczesnyEtapBadge` pod tytułem.
To **nie jest** `disabled` ani wyszarzenie do nieczytelności — funkcja działa, tylko nie
w pełnej skali, a karta ma dalej sprzedawać.

Dziś oznaczone są dwie:

| Pozycja | Dlaczego |
|---|---|
| `LANDING_STEPS[2]` „Brakuje ludzi? Otwórz mecz" | otwartych gier bywa mało — obietnica „społeczność dobierze skład" nie ma jeszcze pokrycia |
| `LANDING_VALUES[4]` „Boiska w jednym miejscu" | lokalizacje są kompletne, ale nawierzchnia i typ obiektu wypełnione w mniejszości wierszy |

`LANDING_STEPS` renderuje dziś **wyłącznie** `LandingHowItWorks.tsx` (landing dla
wylogowanego). Druga kopia — `OnboardingSection` na pulpicie zalogowanego — zniknęła
razem z `AppHome.tsx` (2026-08-23): ta treść odpowiada na pytanie osoby BEZ konta,
a stała na ekranie kogoś, kto ma już mecze i ekipy. Kto szuka jej z konta, ma
`/jak-dziala-bojo` i `/faq`. Plakietka `WczesnyEtapBadge` zostaje osobnym komponentem,
bo dzieli ją jeszcze nagłówek i `PustyStanMeczow`.

Pusty stan `PustyStanMeczow` uprzedza tym samym tonem, że otwartych gier bywa mało
i szybszą drogą jest własny mecz plus link do znajomych.

---

## Czego NIE ma

Zapora przed zmyślaniem. Poniższe **nie istnieje** w kodzie — jeśli piszesz dokumentację
albo odpowiadasz na pytanie o aplikację, nie zakładaj, że to działa:

- **Auto-awans z listy rezerwowej.** Zwolnione miejsce jest **oferowane** pierwszej
  osobie z rezerwy, która musi je sama przyjąć — nikt nie trafia do składu po cichu
  ([domena.md](./domena.md#zwolnione-miejsce-oferta-nie-auto-awans)). Nie „naprawiać".
- **Osobna wartość „widoczne dla grupy" w `events.visibility`.** Kolumna to nadal
  wyłącznie `private` / `public` — ale prywatny mecz przypięty do grupy JEST widoczny
  dla jej członków (`getMyGroupEvents()`), patrz [domena.md § Grupy](./domena.md#grupy).
- **MVP** w statystykach. Jedyne wystąpienie słowa to tekst nagrody na `/turniej`.
- **Rankingi publiczne.**
- **Ocena umiejętności, poziom zaawansowania, dopasowywanie gier do poziomu.**
- **Odznaki** — poza znaczkiem „rzetelny gracz".
- **Realny przepływ pieniędzy** (BLIK/Stripe). Aplikacja rejestruje, kto zapłacił —
  nie przelewa.
- **Wynajem sędziego.**
- **Lista graczy pod `/gracze`** — to redirect.
- **Strona pod gołym `/boiska`** — trasa istnieje tylko jako `/boiska/[sport]`;
  `/boiska` samo to redirect na `/mapa?gry=0`, tym samym wzorcem co `/gracze`.
- **Osobny backend, API, kontrolery.** Frontend rozmawia z Supabase bezpośrednio.
- **Automatyczne uruchamianie migracji.**
- **Powiadomienia o nowym terminie serii przez e-mail/SMS.** Auto-tworzenie terminów
  (migracja `073`) powiadamia wyłącznie w aplikacji (dzwonek) — `recurring_event_invites`
  (kontakty e-mail/telefon, dodawane ręcznie na `/cykliczne/[id]`) nie dostają nic przy
  automatycznym tworzeniu, tylko przy ręcznym „Utwórz i wyślij zaproszenia". Wymagałoby
  wywołania Edge Function `send-invites` z poziomu Postgresa (`pg_net`). Zadanie
  w [BACKLOG.md](../BACKLOG.md).
- **Reguły powtarzania inne niż cotygodniowa** — co dwa tygodnie, co miesiąc.

### Martwy kod

| Plik | Uwaga |
|---|---|
| `components/map/MapView.tsx` | nic nie importuje |
| `components/map/LeafletMapImpl.tsx` | nic nie importuje |
| `components/map/EventsMapView.tsx` | nic nie importuje |
| `components/map/EventsMapImpl.tsx` | nic nie importuje |
| `components/home/NearbyGames.tsx` | kompletny, nigdzie nie renderowany |
| tabela `games` | zastąpiona przez `events` w `002` |

**Aktywna mapa to `VenueExplorer.tsx`** (strona `/mapa`) oraz pickery lokalizacji.
