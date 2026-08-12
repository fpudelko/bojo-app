# Przepływ organizatora — audyt

> Przejście całej ścieżki człowieka, który pierwszy raz widzi bojo.pl i chce szybko
> zorganizować mecz: landing → brama logowania → trzy kroki kreatora → publikacja →
> zarządzanie meczem. Powstało pod priorytet z [strategia.md §0](./strategia.md)
> („pozyskiwanie organizatorów i szlifowanie przepływu organizacji gry").
>
> **Stan: 2026-08-08, `O-26`/`O-27` dopisane 2026-08-10, `O-28`…`O-31` dopisane
> 2026-08-12.** Wnioski są czytaniem kodu, nie obserwacją użytkowników — patrz
> „Czego ten audyt nie sprawdził" na końcu.

Ustalenia mają numery `O-n`; [BACKLOG.md](../BACKLOG.md) odwołuje się do tych samych.
Kolumna **stan** mówi, czy rzecz została zrobiona, czy czeka.

---

## Decyzje właściciela produktu (2026-08-08)

Zapisane, żeby nie wracały co kwartał jako „a może by jednak".

1. **Brama logowania przed kreatorem ZOSTAJE.** Odroczenie logowania — kreator dostępny bez
   konta, konto dopiero przy „Opublikuj mecz" — było rozważone i **odrzucone**. Techniczne
   warunki były spełnione (szkic w `localStorage` z TTL 12 h oraz `?next=` już istnieją),
   więc to decyzja produktowa, nie brak możliwości. Poprawiamy bramę, nie znosimy jej.
2. **Nazwa organizatora.** Rejestracja e-mailem wymaga imienia i nazwiska. Konto z Google
   bez nazwy dostaje powiadomienie kierujące do `/profil`. `displayName()` nigdy nie zwraca
   pełnego adresu e-mail, a kreator pokazuje przed publikacją, pod jaką nazwą organizator
   się pojawi.
3. **Kanoniczny link do udostępniania meczu to `/wydarzenia/{id}`**, nie `/d/{kod}`.
   Powód jest twardy: `robots.ts` trzyma `/d/` poza indeksowaniem (kod dołączenia to jedyna
   kontrola dostępu do meczu prywatnego), a crawlery Facebooka i WhatsAppa respektują
   `robots.txt` — więc krótki link leci na czat **bez podglądu**. Trasa `/d/[code]` żyje
   dalej dla linków już rozesłanych; znika tylko jako drugi przycisk w interfejsie.

---

## Faza 0 — landing `/`

**Działa i zostaje bez zmian.** Hero mówi językiem organizatora („Zorganizuj mecz w dwie
minuty", `components/home/landing/content.ts`), jedno mocne CTA zamiast czterech słabych,
pasek zaufania („Za darmo · Google lub e-mail · Bez instalacji"), sekcja „Trzy kroki do
składu", FAQ odpowiadające wprost na „ile to zajmie" i „czy muszę mieć konto".

| # | Ustalenie | Stan |
|---|---|---|
| **O-1** | **Wylogowany traci wejście do kreatora poza stroną główną.** `BottomNavGate.tsx` nie pokazuje dolnej nawigacji niezalogowanym, a pływające `+` (`StickyCta`) żyje wyłącznie na landingu. Oglądając **niepustą** listę na `/wydarzenia` wylogowany nie miał stamtąd żadnego wejścia do kreatora — pusty stan miał swoje CTA od dawna, brakowało go dokładnie w tym przypadku. | zrobione |

`/mapa` świadomie pominięta: mapa jest pełnoekranowa, a dokładanie CTA psuje układ
pływających kontrolek.

---

## Faza 1 — brama logowania (`/wydarzenia/nowe`)

**Ekran-brama zostaje.** To nie jest redirect, tylko strona sprzedażowa: nagłówek, trzy
korzyści, karta „Zaloguj się, żeby opublikować mecz" i rozmyty podgląd kreatora z podpisem
„↑ tak wygląda kreator po zalogowaniu".

| # | Ustalenie | Stan |
|---|---|---|
| **O-2** | **`?next=` gubił query string.** Cel powrotu liczony był z samej ścieżki. Wejście „Zorganizuj tu mecz" ze strony boiska (`?fieldId=`) i „Stwórz mecz w grupie" (`?group=`) wracało po zalogowaniu na goły `/wydarzenia/nowe` — bez boiska i bez grupy, czyli do formularza wyglądającego na zaczęty od zera. | zrobione |
| **O-3** | **Rejestracja e-mailem gubiła cel całkowicie.** `signUpWithEmail` ustawiało `emailRedirectTo` bez argumentu, więc po kliknięciu w link potwierdzający organizator lądował na `/`. Google i magic link przekazywały `next` od zawsze — wyłamywała się tylko rejestracja hasłem. | zrobione |
| **O-4** | **Mecz publikował się pod pełnym adresem e-mail organizatora.** `displayName()` spadało na `user.email`, podczas gdy `firstName()` obcinało adres na „@" od dawna; ta niespójność dwóch funkcji w jednym pliku była wyciekiem na publiczną, indeksowaną stronę meczu z JSON-LD. | zrobione |

---

## Faza 2 — krok 1 „Co i gdzie"

**Zostaje:** cztery sporty jako chipsy + zapasowy `<select>`, domyślnie piłka nożna, jedno
wymagane pole na cały krok. Krok jest lekki i to jest jego zaleta.

| # | Ustalenie | Stan |
|---|---|---|
| **O-5** | **Mapa startowała na sztywno w Poznaniu**, bez geolokalizacji, mimo że mecz da się stworzyć gdziekolwiek w Polsce. Gotowy `components/map/LocateMeButton.tsx` był używany na `/mapa` i w widoku mapy `/wydarzenia` — tu go po prostu nie wpięto. | zrobione |
| **O-6** | **Szukanie nie przesuwało mapy.** Zbiór pinezek się podmieniał, ale widok stał w miejscu, więc wpisanie nazwy boiska spoza kadru wyglądało jak brak reakcji. `/mapa` miało to rozwiązane. | zrobione |
| **O-7** | **Zero wyników = zero komunikatu**, a lupa (geokoder Nominatim) była ukrytą afordancją bez `aria-label`. Filtr sportu potrafił wyzerować listę bez słowa — przy sportach zanieczyszczonych sąsiedztwem przy imporcie z OSM trafia to też w prawidłowe boiska. | zrobione |
| **O-8** | **Zmiana sportu po cichu kasowała wybrane boisko.** Organizator wracał na krok 1 i zastawał pustą mapę bez wyjaśnienia. | zrobione |
| **O-9** | **Mecz mógł się nazwać „52.40123".** Dla pinezki spoza katalogu nazwa brała się z pierwszego segmentu adresu Nominatim, a przy nieudanym reverse geocodingu zostawały same współrzędne. | zrobione |

---

## Faza 3 — krok 2 „Kiedy i ile"

**Zostaje i nie należy tego ruszać:** domyślne wartości (jutro, 18:00, 90 min, skład per
sport), podgląd „Koniec o HH:MM", tryb wpisywania kosztu **„za obiekt"** jako domyślny wraz
z przeliczaniem ceny po zmianie liczby miejsc. To dobrze uzasadnione decyzje — każda
zdejmuje z organizatora jedną decyzję.

| # | Ustalenie | Stan |
|---|---|---|
| **O-10** | **Krok jest przeładowany** — do 15 kontrolek przy 2 na kroku 1 i 4 na kroku 3. Wskaźnik kroków sugeruje równy podział, którego nie ma. Rozwiązywane częściowo przez O-11; osobnej przebudowy kroku 2 świadomie nie zakładamy. | częściowo |
| **O-11** | **„Czas na decyzję z rezerwy" to decyzja, której pierwszy organizator nie ma jak podjąć** — dotyczy listy rezerwowej, która jeszcze nie istnieje, a stała na kroku obiecującym dwie minuty. Schodzi pod „Więcej opcji"; domyślne 3 h bez zmian. | **odwrócone 2026-08-08** |
| **O-12** | **Płatny mecz bez żadnej metody płatności przechodził walidację.** Gracz widział cenę i nie wiedział, jak ją uregulować. Gotówka jest teraz domyślna (jednorazowo), a pusty zestaw daje ostrzeżenie — nie blokadę, bo płatność można ustalić poza aplikacją. | zrobione |
| **O-13** | **Przy numerze BLIK nie padało to, co organizatora uspokaja.** `canSeeBlikPhone()` odsłania numer uczestnikowi dopiero 60 minut przed meczem, a formularz o tym milczał. | zrobione |

**Zostaje:** `maxGoalkeepers = 2` bez kontrolki, opisane w UI jako fakt („Max 2 bramkarzy
i N zawodników z pola") — kolejny suwak nic tu nie kupuje.

---

## Faza 4 — krok 3 „Opcje"

**Zostaje:** tytuł opcjonalny z podglądem domyślnej nazwy, opis za przełącznikiem, dwie
karty widoczności z uczciwym opisem, akceptacja zapisów jako osobny przełącznik działający
dla obu widoczności, domyślna widoczność `public`.

| # | Ustalenie | Stan |
|---|---|---|
| **O-14** | **Nie było podsumowania przed publikacją.** Organizator klikał „Opublikuj mecz" z kroku, na którym nie widział ani daty, ani miejsca, ani ceny, ani liczby miejsc — wszystko ustawił dwa kroki wcześniej. Zła data to najczęstsza pomyłka organizatora. | zrobione |
| **O-15** | **Organizator nie wiedział, pod jaką nazwą się pokaże.** Druga połowa naprawy O-4. | zrobione |

⚠️ **Regresyjny hot spot — nie ruszać bez potrzeby.** `blokujEnter()`, `type="button"`
z osobnymi `key` na przyciskach „Dalej"/„Opublikuj" oraz guard `if (step !== 3)` w
`handleSubmit` (`app/wydarzenia/nowe/page.tsx`). Każde z tych trzech powstało po realnym
błędzie produkcyjnym, w którym mecz publikował się sam. Dowolna przebudowa kroku 3 musi je
zachować.

---

## Faza 5 — publikacja i pierwsza minuta po niej

Największa dziura w całym przepływie i jednocześnie największa dźwignia wzrostu.

| # | Ustalenie | Stan |
|---|---|---|
| **O-16** | **Nie było momentu „wyślij link".** Kreator kończył się przekierowaniem na stronę meczu i niczym więcej — organizator lądował na widoku identycznym z tym, który widzi każdy inny, w chwili największej gotowości do działania. A obietnica produktu brzmi „stwórz grę i wyślij ekipie jeden link". | zrobione |
| **O-17** | **Dwa różne linki pod tą samą etykietą „Udostępnij".** Pasek górny wysyłał `window.location.href`, panel „Zaproś znajomych" — `/d/{kod}`. Ten sam mecz, dwa adresy, dwa przyciski o tej samej nazwie na jednej stronie. | zrobione |
| **O-18** | **`navigator.share` dostawał sam link, bez tekstu.** Na czacie lądował goły odnośnik — gorzej niż post na grupie, który ma datę, miejsce i cenę. Bojo umiało to lepiej w grupach. | zrobione |
| **O-19** | **Podpowiedź cytowała przycisk, którego nie ma** („użyj «Zaproś / wyślij link» niżej"). | zrobione |
| **O-20** | **„Zaproś z ekipy" dublował się** na jednej stronie, z różnymi ikonami i warunkami widoczności. Ślepy zaułek dialogu bez grupy naprawiony (przycisk do `/grupy/nowe`); drugi, redundantny przycisk usunięty — jedyny stały punkt imiennego zaproszenia jest teraz przy liczniku wolnych miejsc, ikona ujednolicona na `Users` wszędzie. | zrobione |

---

## Faza 6 — zarządzanie meczem

**Zostaje bez zmian:** licznik `X / Y` z paskiem postępu i progami koloru, „Zostało N
wolnych miejsc" z poprawną odmianą, karta „Prośby o dołączenie", rozwinięty domyślnie skład
dla organizatora, panel „Podział kosztów" liczący zniżki kartowe.

| # | Ustalenie | Stan |
|---|---|---|
| **O-21** | **Odwołanie meczu było CICHE.** `cancelEvent()` zmieniało `status` i logowało aktywność; uczestnik dowiadywał się wyłącznie wchodząc na stronę meczu. Kto nie wszedł — przyjeżdżał na boisko. To jedyne miejsce, w którym Bojo było obiektywnie gorsze od zwykłej wiadomości na czacie. | zrobione (migracja `070`) |
| **O-22** | **Interfejs kłamał w drugą stronę:** checkbox przy zmianie terminu twierdził „Bojo jeszcze tego nie robi", podczas gdy migracja `065` powiadomienie wysyła. | zrobione |
| **O-23** | **Uczestnik nie widział, ile ma zapłacić.** `showPaymentStatus` było zapisywane przez formularz edycji i **nigdzie nieodczytywane**. Nowa karta „Twoja płatność" (kwota po uwzględnieniu zniżki kartowej, sposób płatności, status opłacone/nieopłacone) — pierwsze miejsce, które tę flagę respektuje. To ta sama luka co [BACKLOG §1.4](../BACKLOG.md), teraz zamknięta z obu stron. | zrobione |
| **O-24** | **Organizator nie miał widoku „gdzie brakuje ludzi".** Nowa sekcja „Brakuje graczy" na `/moje-gry` (zakładka „Nadchodzące") — organizowane, niepełne mecze, sortowane od najbliższego terminu. Dane już były pobierane przez `getMyParticipatedEvents()` (`participantsCount` liczone przez `toEvent()`), więc zero nowego zapytania. Merge organizowanie+granie w `MyMatchesSection` zostaje nietknięty — to osobna, dodatkowa sekcja. | zrobione |
| **O-25** | **Nie było widać, kogo się zaprosiło i kto odpowiedział.** Nowa karta „Zaproszeni" na stronie meczu (tylko organizator — RLS na `event_player_invites` i tak nie przepuści reszty): imię, awatar i status Czeka / Dołączył(a) / Nie tym razem. Reguła „uczestnictwo bije wcześniejszą odmowę" wydzielona do `lib/inviteStatus.ts` pod testem — pierwsza wersja tej logiki inline w komponencie miała to odwrócone. | zrobione |
| **O-26** | **Martwy kod na ścieżce organizatora:** nieosiągalny modal „Zgłoś uczestnika" (`setReportTarget` nigdy nie wołane), `handleSendSms` + stan `smsBusy` zdefiniowane i nieużywane, `lib/invites.ts` (86 linii, gotowy polski szablon zaproszenia mailem) bez ani jednego importu. Usunięto wraz z całym rurociągiem (`submitReport`, `getEventReports`, typy `ReportType`/`PlayerReport`) — nic innego tego nie czytało. | zrobione |
| **O-27** | **Zaproszenie do przejęcia wpisu gościa (`066`) niosło goły link** — `kopiujLinkPrzejecia` kopiował sam URL, bez tekstu tłumaczącego, po co go kliknąć. Ten sam błąd co `O-18`, tu nienaprawiony do 2026-08-10. Naprawione wzorem `eventShareText`/`shareEvent`: `tekstZaproszeniaGoscia()` w `lib/guestClaim.ts`, `navigator.share` z fallbackiem do schowka. Dodatkowo: przycisk „Zaproś do Bojo" żył wyłącznie w edytowalnym składzie przed startem meczu — po starcie meczu organizator przechodzi na widok `ParticipantsList` i przycisk znikał całkowicie, dokładnie w momencie, gdy naturalnie wraca wpisać wynik. Dodano tam ten sam przycisk oraz zbiorczy sygnał „N gości bez konta" nad składem (widoczny w obu widokach). | zrobione |
| **O-28** | **Organizator nie dowiadywał się o zmianie stanu kompletu.** Żaden z wyzwalaczy powiadomień (`025`, `062`, `065`, `067`, `070`, `072`, `073`, `076`) nie mówił niczego organizatorowi o zmianie składu — jedyny wyzwalacz na `DELETE` powiadamiał *odrzuconego gracza*, nie jego. Wypisanie się z kompletnego składu było ostatnim miejscem, w którym Bojo jest gorsze od wątku na czacie: cisza aż do wejścia na stronę meczu. Migracja `079` dodaje wyzwalacz na `event_participants`, który powiadamia o przejściu niekomplet→komplet i komplet→niekomplet (nie o każdym zapisie z osobna — inaczej kilkanaście wpisów pod dzwonkiem na jeden mecz zagłuszyłoby te dwa istotne). | zrobione (migracja `079`) |
| **O-29** | **Rozliczenie kończyło się na ekranie organizatora.** Panel „Podział kosztów" liczy wszystko poprawnie, ale żeby powiedzieć ekipie „jeszcze nie oddali: Marek, Kuba", trzeba było przepisać to ręcznie na czat — ten sam błąd co `O-18`/`O-27`, tu po prostu w innym miejscu. Goście bez konta w ogóle nie mają jak zobaczyć swojej kwoty w Bojo, więc dla nich wiadomość na czacie jest jedynym kanałem. Nowy przycisk „Wyślij rozliczenie ekipie" (`lib/settlementShare.ts`) otwiera systemowy arkusz udostępniania z gotowym tekstem: kwota, lista zaległości z kwotami (uwzględniają zniżkę kartową), numer BLIK, gdy organizator go akceptuje. | zrobione |
| **O-30** | **Powrót z logowania nie kończył zapisu.** Wylogowany na stronie meczu klikał „Zaloguj się, aby dołączyć", zakładał konto i wracał na widok identyczny z tym sprzed logowania — musiał od nowa znaleźć przycisk „Dołącz →". Dwa dodatkowe kroki dokładnie w punkcie największego odpadania. `?dolacz=1` (ten sam wzorzec co `?utworzono=1`) niesie intencję przez logowanie i otwiera okno zapisu automatycznie po powrocie — w trybie rezerwy, jeśli skład jest już pełny. | zrobione |
| **O-31** | **Zaproszenie do przejęcia wpisu gościa mógł wysłać tylko organizator**, mimo że `allowGuestAdds` pozwala dopisać gościa każdemu uczestnikowi — a to właśnie ta osoba zna gościa i ma z nim kontakt, nie organizator. Warunek `isOrganizer` zamieniony na `mozeZaprosic(p)`, który przepuszcza też tego, kto konkretnego gościa dopisał (`p.addedBy === user.id`). Zbiorczy baner „N gości bez konta" nad składem zostaje przy `isOrganizer` — to podsumowanie całego składu, nie pojedynczego gościa. | zrobione |

---

## Co zostaje bez zmian — i dlaczego

Ta lista chroni przed „poprawkami", które przepływ by pogorszyły.

1. **Brama logowania przed kreatorem** — decyzja właściciela, patrz wyżej.
2. **Trzy kroki zamiast jednego długiego formularza.** Spłaszczenie rozbiłoby model
   walidacji i obietnicę powtórzoną w landingu, FAQ i teście `landingContent.test.ts`.
3. **Brak auto-awansu z listy rezerwowej** —
   [świadoma decyzja produktowa](./domena.md#zwolnione-miejsce-oferta-nie-auto-awans).
4. **Domyślne wartości kreatora** — jutro, 18:00, 90 min, skład per sport.
5. **Koszt „za obiekt" jako tryb domyślny** wraz z przeliczaniem po zmianie liczby miejsc.
6. **Tytuł opcjonalny, opis za przełącznikiem.** Puste pole tekstowe samo w sobie sugeruje
   obowiązek — to już raz poprawiano.
7. **Domyślna widoczność `public`.** Publiczna półka potrzebuje podaży, a opis na karcie
   jest uczciwy („każdy może dołączyć"), z przełącznikiem akceptacji tuż pod spodem.
8. **`maxGoalkeepers = 2` bez kontrolki.**
9. **Ukrywanie dolnej nawigacji w kreatorze** (`HideBottomNav`) — nie zasłaniać „Dalej".
10. **Krok 3 bez pól wymaganych.** Podsumowanie ostrzega, nie blokuje.
11. **Trzy zabezpieczenia przed przypadkową publikacją** — patrz hot spot w fazie 4.
12. **Ekran-brama jako strona sprzedażowa** z rozmytym podglądem kreatora.
13. **Trasa `/d/[code]`** — żywa, żeby rozesłane linki działały.

### Odwrócone po audycie (2026-08-08)

Dwa ustalenia zostały cofnięte decyzją właściciela produktu po ręcznym przejściu
kreatora na telefonie. Zapisane tu, żeby dokument nie opisywał stanu, którego
w kodzie nie ma.

- **O-11 — „Czas na decyzję z rezerwy" wraca na stały widok kroku 2**, pod „Liczbę
  miejsc". Argument za odwróceniem: chowanie pola przed organizatorem, który go
  szuka, kosztuje więcej niż jedna kontrolka więcej na kroku. Sekcja „Więcej opcji"
  została w kodzie, ale po tej zmianie nie ma czego pokazać i się nie renderuje.
- **Selektor grupy wchodzi do kroku 3** (patrz niżej, pozycja skreślona w „Rozważone
  i odrzucone"). Wejście `?group=` pokrywało tylko organizatora, który zaczyna ze
  strony grupy — kto wchodzi z „Zorganizuj mecz", nie miał żadnego sposobu przypisać
  meczu do ekipy bez wracania do panelu po publikacji. Wiersz „Mecz w ramach ekipy"
  stoi pod kartami widoczności, nie jest trzecią kartą: przypisanie do grupy jest
  **ortogonalne** do public/private — mecz ekipy bywa publiczny.

### Rozważone i odrzucone

- **Czwarty krok kreatora na płatności** — rozbija „trzy kroki, dwie minuty".
- ~~**Selektor grupy wewnątrz kreatora**~~ — odwrócone 2026-08-08, patrz sekcja wyżej.
- **Automatyczne dopisywanie członków grupy do składu** — łamie regułę „nikt nie trafia do
  składu po cichu".
- **Trzeci poziom widoczności („widoczne dla grupy")** — istniejąca
  [luka wobec wizji](./wizja.md#3-luki), wymaga migracji i polityki RLS; poza przepływem
  organizatora.
- **Odmrażanie flag** (`SHOW_RECURRING`, `SHOW_GAME_ALERTS`, `SHOW_SMS_FEATURES`) — osobna
  decyzja produktowa, nie skutek uboczny audytu UX.
- **Onboarding profilu jako osobny kreator po rejestracji** — zastąpiony węższym O-4.

---

## Czego ten audyt nie sprawdził

1. **Zachowania realnych organizatorów.** Wszystkie wnioski pochodzą z czytania kodu.
   `analytics_events` (migracja `047`) zbiera zdarzenia, na które nikt nie patrzył — dopóki
   nie wiadomo, ilu ludzi odpada na którym kroku, kolejność napraw jest sądem, nie pomiarem.
2. **Czy brama logowania faktycznie kosztuje konwersję**, i ile. Decyzja o jej pozostawieniu
   jest produktowa; nie ma danych ani za, ani przeciw.
3. **Jak wygląda udostępniony link na realnych komunikatorach.** Format tekstu jest pokryty
   testami, ale to, co zrobi z nim WhatsApp, Messenger i Signal na różnych systemach,
   sprawdza się wyłącznie ręcznie, na urządzeniu.
