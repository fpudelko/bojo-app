# Inwentarz funkcji

Co aplikacja potrafi, gdzie to leży i **czy użytkownik to widzi**. Status wobec wizji →
[wizja.md](./wizja.md#2-status-implementacji).

---

## Flagi funkcji

**Najczęstsze źródło pomyłki w tym repo: „funkcja nie działa" — a ona działa, tylko jest
schowana.** Zanim uznasz coś za niezbudowane, sprawdź tę tabelę.

| Flaga | Wartość | Co chowa | Gdzie warunkuje |
|---|---|---|---|
| `SHOW_CUP` | `false` | Turniej / BOJO Cup | `Header.tsx`, `TrustBar.tsx`, `AnnouncementBar.tsx` |
| `SHOW_GAME_ALERTS` | `false` | „Ustaw alert" o grach w okolicy | `HomeHero.tsx` |
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

## Funkcje dla gracza

| Funkcja | Trasy | Logika | Widoczne? |
|---|---|---|---|
| Strona główna | `/` | `SportsSectionWithCounts`, `HomeHero` | tak |
| Mapa boisk i meczów | `/mapa` | `VenueExplorer.tsx`, `lib/fieldFilters.ts` | tak |
| Boiska wg sportu | `/boiska/[sport]` | `lib/api.ts`, `lib/sports.ts` | tak |
| Szczegóły boiska | `/boisko/[id]` | `lib/api.ts` | tak (JSON-LD) |
| Lista meczów | `/wydarzenia` | `getPublicEvents`, `getNearbyEvents` | tak |
| Tworzenie meczu | `/wydarzenia/nowe` | `createEvent` | tak |
| Szczegóły meczu | `/wydarzenia/[id]` | `EventDetailClient.tsx`, `lib/eventFeatures.ts` | tak |
| Edycja meczu | `/wydarzenia/[id]/edytuj` | `updateEvent`, `saveEventAdvancedSettings` | tak |
| Wejście po kodzie | `/d/[code]` | `getEventByJoinCode` | tak (przez link) |
| Moje gry | `/moje-gry` | `getMyEvents`, `getMyParticipatedEvents` | tak |
| Grupy | `/grupy`, `/grupy/[id]`, `/grupy/nowe`, `/grupy/[id]/edytuj` | `lib/groups.ts` | tak |
| Wejście do grupy po kodzie | `/g/[code]` | `getGroupByCode` | tak (przez link) |
| Profil gracza | `/gracz/[id]` | `lib/players.ts` | tak |
| Własny profil | `/profil` | `lib/auth.tsx` | tak |
| Logowanie | `/logowanie`, `/auth/callback`, `/auth/reset` | `lib/auth.tsx` | tak |
| Regulaminy | `/regulamin`, `/prywatnosc` | — | tak |
| **Gry cykliczne** | `/cykliczne`, `/cykliczne/[id]`, `/cykliczne/nowe`, `/cykliczne/[id]/edytuj` | `lib/recurring.ts` | **nie — `SHOW_RECURRING`** |
| **Turniej** | `/turniej`, `/turniej/rejestracja`, `/turniej/drabinka`, `/turniej/druzyna/[teamId]`, `/turniej/druzyna/[teamId]/dolacz` | `lib/tournaments.ts` | **nie — `SHOW_CUP`** |
| **Rezerwacje (gracz)** | `/rezerwacje` | `lib/bookings.ts` | **nie — `FEATURE_RESERVATIONS`** |

⚠️ **`/gracze` to `redirect('/wydarzenia')`** — nie ma listy graczy, mimo że trasa istnieje.

## Funkcje dla menedżera obiektu

| Funkcja | Trasy | Widoczne? |
|---|---|---|
| Moje obiekty, dodawanie | `/obiekt`, `/obiekt/nowe` | **nie — `FEATURE_RESERVATIONS`** |
| Pulpit obiektu | `/obiekt/[id]` | j.w. |
| Harmonogram, cennik, rezerwacje | `/obiekt/[id]/{harmonogram,cennik,rezerwacje}` | j.w. |

## Funkcje admina

Admin = `profiles.is_admin = true`.

| Funkcja | Trasa | Logika |
|---|---|---|
| Przegląd | `/admin/przeglad` | `lib/admin.ts` |
| Użytkownicy | `/admin/uzytkownicy` | `lib/admin.ts` |
| Analityka | `/admin/analityka` | `lib/analytics.ts` |
| Moderacja boisk | `/admin/moderacja` | `lib/admin.ts` |
| **CRM kontaktu z obiektami** | `/admin/outreach` | `lib/outreach.ts` |
| Boisko / rezerwacje obiektu | `/admin/boisko/[id]`, `/admin/[fieldId]` | `lib/bookings.ts` |

---

## Funkcje meczu (opcje zaawansowane)

Włączane per mecz przy tworzeniu lub edycji, obsługiwane przez `lib/eventFeatures.ts`:

| Opcja | Kolumna | Efekt |
|---|---|---|
| Drużyny | `team_mode`, `teams_published` | Podział składu, kapitanowie, losowanie, publikacja |
| Wyniki | `track_results` | Wynik meczu + gole i asysty |
| Obecność | `track_attendance` | Frekwencja → reputacja gracza |
| Płatności | `track_payments`, `show_payment_status` | Podział kosztów, oznaczanie opłaconych |
| Bramkarze | `goalkeepers_enabled`, `max_goalkeepers` | Osobny limit; nadmiarowi na rezerwę |
| Akceptacja zapisów | `require_approval` | Zapis nie zajmuje miejsca do akceptacji |
| Goście bez konta | `allow_guest_adds` | Uczestnicy mogą dopisywać gości |
| Kod dołączenia | `join_code` | Wejście przez `/d/[code]` |
| Potwierdzenie SMS | `require_sms_confirmation`, `confirmation_deadline_h` | **ukryte — `SHOW_SMS_FEATURES`** |

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

- **Auto-awans z listy rezerwowej.** Świadoma decyzja produktowa
  ([domena.md](./domena.md#brak-auto-awansu-z-listy-rezerwowej)). Nie „naprawiać".
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
