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
| `SHOW_RECURRING` | `false` | Gry cykliczne | `Header.tsx`, `app/page.tsx`, `app/moje-gry/page.tsx` |
| `FEATURE_RESERVATIONS` | z env `NEXT_PUBLIC_FEATURE_RESERVATIONS` | Rezerwacje obiektów | `LeafletMapImpl.tsx`, `app/admin/[fieldId]/page.tsx` |

Cztery pierwsze: `frontend/src/lib/features.ts` (stałe w kodzie).
Piąta: `frontend/src/config/features.ts` (zmienna środowiskowa).

**Rezerwacje mają drugą furtkę per obiekt:** `showBookingForField()` zwraca `true`, jeśli
flaga globalna jest włączona **albo** dany obiekt ma `fields.booking_enabled = true`.
Czyli rezerwacje można włączyć pojedynczemu boisku bez odmrażania całej funkcji.

**Flagi ukrywają wejścia, nie trasy.** Trasa `/cykliczne` odpowiada normalnie, jeśli ktoś
wpisze adres ręcznie — flaga usuwa tylko linki w nawigacji. Dlatego trasy za flagami nie
trafiają do `llms.txt` ani do `sitemap.ts`: reklamowanie ich wyszukiwarce obiecuje coś,
czego użytkownik nie znajdzie w interfejsie.

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
| Płatności | `track_payments`, `show_payment_status` | Podział kosztów, oznaczanie opłaconych |
| Bramkarze | `goalkeepers_enabled`, `max_goalkeepers` | Osobny limit; nadmiarowi na rezerwę |
| Akceptacja zapisów | `require_approval` | Zapis nie zajmuje miejsca do akceptacji |
| Goście bez konta | `allow_guest_adds` | Uczestnicy mogą dopisywać gości |
| Kod dołączenia | `join_code` | Wejście przez `/d/[code]` |
| Potwierdzenie SMS | `require_sms_confirmation`, `confirmation_deadline_h` | **ukryte — `SHOW_SMS_FEATURES`** |

---

## Zaproszenia na mecz

Imienne zaproszenie (`event_player_invites`, migracja `060`, `lib/playerInvites.ts`) —
organizator albo dowolny potwierdzony uczestnik zaprasza konkretne osoby z ekipy
(`components/events/InviteFromGroupDialog.tsx`, przycisk „Zaproś z ekipy" na stronie
meczu). Zaproszenie nie zajmuje miejsca w składzie; odpowiedź to zwykłe „Dołącz" /
„Obserwuj" na stronie meczu albo „Nie tym razem" (odrzucenie, zapisywane trwale, żeby
ponowne „zaproś ekipę" nie wskrzeszało odrzuconego zaproszenia).

Gdzie widać otwarte zaproszenia:

| Miejsce | Co pokazuje |
|---|---|
| Strona główna (dashboard) | Sekcja „Zaproszenia" — max 3, znika przy zerze |
| `/moje-gry?tab=zaproszenia` | Pełna lista, bez limitu, z pustym stanem |
| `/wydarzenia` | Plakietka „Zaproszenia N" obok pola wyszukiwania — **widoczna tylko gdy N > 0**, prowadzi do zakładki wyżej |

Wspólny hook `lib/useMyInvites.ts` (pobiera zaproszenia + mapę uczestnictwa, filtruje do
statusu `'invited'`) i wspólny komponent listy `components/events/InviteList.tsx` — trzy
powyższe miejsca renderują ten sam kod, żeby nie rozjeżdżały się przy zmianie.

Nie mylić z `lib/invites.ts` (tabela `event_invites`, migracja `036`) — zaproszenia po
e-mailu z tokenem, martwy kod, nic go nie importuje.

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

Czego brakuje: **wyzwalacza przy utworzeniu gry w grupie**. Jedyna ścieżka powiadomienia
o nowej grze to `game_alerts` (promień + sport), a ta jest ukryta flagą
`SHOW_GAME_ALERTS`. To [luka 2 wobec wizji](./wizja.md#3-luki).

---

## Czego NIE ma

Zapora przed zmyślaniem. Poniższe **nie istnieje** w kodzie — jeśli piszesz dokumentację
albo odpowiadasz na pytanie o aplikację, nie zakładaj, że to działa:

- **Auto-awans z listy rezerwowej.** Zwolnione miejsce jest **oferowane** pierwszej
  osobie z rezerwy, która musi je sama przyjąć — nikt nie trafia do składu po cichu
  ([domena.md](./domena.md#zwolnione-miejsce-oferta-nie-auto-awans)). Nie „naprawiać".
- **Trzeci poziom widoczności meczu** („widoczne dla grupy"). `events.visibility` to
  wyłącznie `private` / `public`.
- **Powiadomienie dla członków grupy o nowej grze.**
- **MVP** w statystykach. Jedyne wystąpienie słowa to tekst nagrody na `/turniej`.
- **Rankingi publiczne.**
- **Ocena umiejętności, poziom zaawansowania, dopasowywanie gier do poziomu.**
- **Odznaki** — poza znaczkiem „rzetelny gracz".
- **Realny przepływ pieniędzy** (BLIK/Stripe). Aplikacja rejestruje, kto zapłacił —
  nie przelewa.
- **Wynajem sędziego.**
- **Lista graczy pod `/gracze`** — to redirect.
- **Osobny backend, API, kontrolery.** Frontend rozmawia z Supabase bezpośrednio.
- **Automatyczne uruchamianie migracji.**

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
