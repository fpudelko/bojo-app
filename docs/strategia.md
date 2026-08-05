# Bojo — strategia operacyjna i plan działania

> Warstwa **operacyjna**: infrastruktura, koszty, podział ról, roadmapa fazowa.
> Kierunek produktu i propozycje wartości → [wizja.md](./wizja.md) (dokument nadrzędny).
>
> Scalony z `STRATEGIA.md` (stan na 2026-06-05), dane zweryfikowane wobec kodu 2026-08-02.

---

## 0. Obecny priorytet - KRÓTKI TERMIN (1–3 msc)
Strategia. Skupiamy się na pozyskiwaniu organizatorów i szlifowaniu przepływu
organizacji gry. Baza graczy zbuduje się sama, bo żeby dołączyć do meczu, trzeba założyć konto - organizator przyprowadza 10–14 osób.
To klasyczne rozwiązanie problemu jajka i kury zwane single-player mode: narzędzie daje wartość jednej stronie rynku, zanim druga w ogóle istnieje.
Kanoniczny przykład to OpenTable, które zaczęło jako darmowy system rezerwacji dla restauracji, użyteczny w dniu zero, bez ani jednego gościa online.
Bojo.pl ma więc mówić językiem organizatora, a nie targowiska.

## 1. Gdzie jesteśmy

**Produkt działa i jest wdrożony.** Aplikacja webowa (Next.js 14 + Supabase, hosting
Vercel), spójny design, większość funkcji core gotowa:

- Mapa boisk w Poznaniu (~1400 obiektów z OSM + wzbogacone AI: telefon, www, godziny,
  sposób rezerwacji)
- Organizacja meczów: tworzenie gry, zapisy, lista rezerwowa, goście bez konta
- Zaawansowane: drużyny (drag&drop, losowanie, kapitanowie), wyniki meczów, statystyki,
  płatności
- Logowanie Google + e-mail (hasło / magic link / reset)
- Komentarze, profile publiczne graczy z reputacją, powtarzanie meczu, podział kosztów
- Panel admina: kontakt z obiektami (CRM), zarządzanie użytkownikami, analityka

**Zbudowane, ale niewidoczne dla użytkownika** (za flagami — patrz
[funkcje.md](./funkcje.md#flagi-funkcji)): gry cykliczne, alerty o grach w okolicy,
potwierdzenia i przypomnienia SMS, turniej, rezerwacje obiektów.

**Infrastruktura:**
- Frontend: Vercel | Baza + Auth: Supabase | E-mail: Resend | SMS: SMSAPI.pl (główny)
  + Twilio (zapasowy)
- **57 migracji** bazy, **11 workflowów** GitHub Actions

**Jedno wąskie gardło infrastrukturalne:** jest tylko **jedno środowisko** (prod). Każda
zmiana idzie od razu na żywo. To pierwsza rzecz do naprawienia przy „realnym starcie".

---

## 2. SMS — bramka i optymalizacja kosztów

### Stan
**SMSAPI.pl** = główny dostawca, **Twilio** = fallback. Limit 30 SMS/h na organizatora.
Funkcje SMS są dziś ukryte flagą `SHOW_SMS_FEATURES`.

### Analiza kosztów (orientacyjnie, PL)
| Dostawca | Koszt / SMS | Uwagi |
|----------|-------------|-------|
| **SMSAPI.pl** (standard, z nazwą nadawcy „Bojo") | ~0,06–0,09 zł | pakiety obniżają cenę; nazwa nadawcy wymaga rejestracji (darmowa) |
| **SMSAPI.pl ECO** (bez nazwy nadawcy) | ~0,04 zł | tańsze, ale wolniejsze i bez brandingu |
| **Twilio** (PL) | ~0,16–0,30 zł | **3-5× drożej**, wymaga rejestracji Alphanumeric Sender ID, rozliczenie w USD |

### Rekomendacja
1. **Zostać przy SMSAPI jako głównym** — dla Polski jest bezkonkurencyjny cenowo. Twilio
   rozważyć do **usunięcia** (komplikuje kod i sekrety, a jest 3-5× droższy). Ewentualnie
   zostawić wyłączony jako „break glass".
2. **Zarejestrować nazwę nadawcy „Bojo"** w SMSAPI (darmowe) — SMS z „Bojo" zamiast
   losowego numeru wygląda profesjonalnie i buduje markę.
3. **SMS to najdroższy kanał — minimalizować jego użycie.** Przesuwać komunikację na
   kanały darmowe:
   - **Link sharing (WhatsApp/Messenger)** — 0 zł, już działa, to główny kanał zapraszania
   - **Powiadomienia in-app** — 0 zł, już działa (tabela `notifications`, `NotificationBell`)
   - **E-mail (Resend)** — ~0 zł, idealny do przypomnień
   - **Push notifications (PWA)** — 0 zł, do zbudowania (Faza 1) — **przyszły główny
     darmowy kanał przypomnień**
   - **SMS rezerwować TYLKO na:** potwierdzenia obecności od osób bez konta oraz pilne
     „gramy dziś". To realnie tnie koszt SMS o ~80%.

**Wniosek:** przy 100 aktywnych grach/mies. i SMS tylko na potwierdzenia → kilka-kilkanaście
zł/mies. Nie jest to bariera.

---

## 3. E-mail

- **Dostawca: Resend.** Szablony zaszyte w Edge Functions (zaproszenia, alerty o grach).
- **Koszt:** darmowy plan = **3000 maili/mies. (100/dzień)**. Płatny: $20/mies. za 50k.
  Na start z dużym zapasem — **0 zł**.
- ⚠️ **Do zrobienia — zależne od decyzji o domenie:** nadawcą jest dziś `noreply@bojo.app`,
  a domeną kanoniczną aplikacji jest **`bojo.pl`** (patrz §9). Maile wysyłane z domeny
  innej niż strona częściej lądują w spamie. Trzeba zweryfikować **`bojo.pl`** w Resend
  (rekordy **SPF + DKIM** w DNS) i zmienić nadawcę na `noreply@bojo.pl`. Wymaga dostępu
  do DNS i panelu Resend — nie da się tego zrobić z poziomu repo.

---

## 4. Rozdzielenie środowisk dev / prod

**Priorytet #1 techniczny.** Niski wysiłek, duża wartość — przestajemy testować na żywych
użytkownikach.

### Plan (koszt: 0 zł na start)
1. **Supabase: drugi projekt `bojo-dev`** (darmowy tier) jako baza dev/staging. Migracje
   i nowe funkcje testujemy najpierw tam.
2. **Vercel: Preview Deployments już działają** — każdy branch/PR dostaje własny URL.
   Trzeba ustawić **osobne zmienne środowiskowe**: `Production` → Supabase produkcyjny,
   `Preview` → `bojo-dev`.
3. **Workflow gitowy:** `feature branch → PR → preview deploy → review → merge → prod`.
4. **Sekrety Edge Functions** ustawić osobno per projekt Supabase.

---

## 5. Dług techniczny

- [ ] **Zweryfikować w Supabase, które migracje są zastosowane.** W repo jest **57**
      migracji (`001`–`057`). Stanu bazy produkcyjnej **nie da się odczytać z repo** —
      migracje uruchamia się ręcznie w SQL Editor. Objaw braku: aplikacja rzuca błędem
      o nieznanej kolumnie. Patrz [baza-danych.md](./baza-danych.md).
- [ ] **Zod — walidacja danych z bazy** (mappery `toEvent`, `toField` — dziś rzutowanie
      bez walidacji runtime)
- [ ] **Dokończyć logowanie błędów** — część `.catch(()=>{})` już zastąpiona
- [ ] **Ujednolicić copy „Zapisz się" / „Dołącz do gry"**
- [ ] **Weryfikacja domeny w Resend** (SPF/DKIM) — patrz §3
- [ ] **Domknąć reguły dostępu w RLS** — część sprawdzana dziś po stronie przeglądarki

---

## 6. Roadmapa (fazowa)

Priorytet: **wzrost i retencja** (monetyzacja dopiero przy trakcji).
Statusy zweryfikowane wobec kodu — część pozycji jest zbudowana wcześniej, niż zakładała
pierwotna kolejność faz.

### Faza 0 — Fundamenty
- Rozdzielenie dev/prod
- Domknięcie długu technicznego (§5)
- Weryfikacja domeny Resend, rejestracja nadawcy „Bojo" w SMSAPI
- **Cel: stabilna baza pod growth.**

### Faza 1 — Akwizycja / viral
- **PWA + push notifications** — instalowalna apka + darmowy kanał przypomnień
- **Onboarding** — pierwsze wejście prowadzi do „stwórz lub znajdź grę" w < 1 min
- **Wzmocnienie pętli viralowej** — „udostępnij grę" wszędzie, ładny podgląd OG
- **Seed treści** — kilka realnych publicznych gier tygodniowo
- **SEO i widoczność w wyszukiwarkach AI** — strony obiektów i sportów są indeksowalne;
  doszła warstwa maszynowa (`llms.txt`, JSON-LD, `robots.txt`) — patrz §9
- **Cel: pierwszych 100 aktywnych użytkowników.**

### Faza 2 — Retencja
- **Cykliczne gierki / stałe ekipy — kod jest kompletny, ukryty flagą `SHOW_RECURRING`.**
  Zadanie sprowadza się do decyzji o odmrożeniu, nie do budowy.
- Reputacja i profile graczy (zaczęte) — frekwencja, znaczek „rzetelny gracz"
- Powiadomienia push o stałych grach, przypomnienia
- **Cel: użytkownik wraca co tydzień bez naszej zachęty.**

### Faza 3 — Monetyzacja (gdy jest trakcja)
- **Rezerwacje obiektów z prowizją — warstwa techniczna jest zbudowana** (`lib/bookings.ts`,
  tabele `bookings`, `venue_schedules`, `venue_pricing`, trasy `/obiekt/*`, `/rezerwacje`),
  ukryta flagą `FEATURE_RESERVATIONS`. Brakuje strony biznesowej: partnerstw z obiektami.
- **Premium dla organizatorów** — darmowy core, płatne dodatki (SMS, statystyki, branding)
- **Cel: pierwszy przychód, walidacja modelu.**

---

## 7. Podział ról

### Jan (biznes / growth)
- **Outreach do obiektów** — panel CRM (`/admin/outreach`) z danymi wzbogaconymi AI.
  Domykanie partnerstw, włączanie `booking_enabled`.
- **Marketing / akwizycja** — grupy FB (piłka/siatka/kosz Poznań), uczelnie (AWF, PP, UAM),
  kluby amatorskie, orliki
- **Pierwsze ekipy** — osobiście zebrać pierwsze stałe gierki (seed)
- **Feedback od użytkowników** → backlog
- **Partnerstwa i sprzedaż B2B** (obiekty) w Fazie 3

### Franek (tech / produkt)
- Rozwój aplikacji, infrastruktura, decyzje produktowo-techniczne
- Roadmapa techniczna, jakość, bezpieczeństwo

### Wspólnie
- Decyzje strategiczne i o monetyzacji
- **Cotygodniowy sync** + wspólny backlog
- **KPI tygodniowe:** nowi użytkownicy, aktywne gry/tydzień, retencja

### ⚠️ Do ustalenia (ważne wcześnie, nie później)
1. **Własność / equity** — jak dzielimy udziały? Spółka czy umowa partnerska?
2. **Zaangażowanie czasowe** — ile godzin/tydzień każdy realnie wkłada?
3. **Definicja sukcesu na 3 i 6 miesięcy**
4. **Budżet** — czy wkładamy własne pieniądze, ile, jak rozliczamy?

---

## 8. Szata graficzna i UX

### Stan obecny
Design jest spójny: system kolorów (zielony `#15663E`, amber `#F5A623`), fonty
(Inter + Bricolage Grotesque), tokeny w Tailwind.

### Grafika — gdzie da najwięcej wartości
1. **Finalne logo + warianty** (dziś placeholder „B") — pozioma/kwadratowa/favicon
2. **Zestaw ilustracji „empty state"**
3. **Szablony social media** (post zapowiadający grę, plakat na uczelnię/orlik)
4. **Dopracowany OG image**

→ Najwięcej daje **logo + zestaw marketingowy**, bo bezpośrednio wspiera akwizycję.

### UX
Świeże oko zewnętrznego UX-a warto **po pierwszych użytkownikach** — na bazie realnego
feedbacku, nie abstrakcyjnie. Pilniejsze: branding + zebranie pierwszych użytkowników.

---

## 9. Domena i widoczność w wyszukiwarkach

**Domena kanoniczna: `bojo.pl`.** Ustawiana przez `NEXT_PUBLIC_SITE_URL`; fallback
w kodzie (`layout.tsx`, `robots.ts`, `sitemap.ts`) wskazuje `https://bojo.pl`.

Warstwa maszynowa dla wyszukiwarek i modeli językowych:
- `frontend/public/llms.txt` — zwięzły opis aplikacji i tras dla modeli
- JSON-LD: `SportsActivityLocation` (boisko), `SportsEvent` (mecz publiczny),
  `WebSite` + `Organization` (globalnie), `ItemList` (lista boisk sportu)
- `robots.ts` — panel admina, API i trasy z kodami zaproszeń wyłączone z indeksowania

Otwarte: nadawca e-mail w Resend wciąż na `bojo.app` (§3).
