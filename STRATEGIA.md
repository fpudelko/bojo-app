# Bojo — Strategia i plan działania

> Dokument roboczy na spotkanie z Janem. Stan na 2026-06-05.
> Kontekst: realny startup, monetyzacja później (najpierw użytkownicy), Jan = wspólnik biznesowy.

---

## 1. Gdzie jesteśmy (stan na dziś)

**Produkt działa i jest wdrożony.** Aplikacja webowa (Next.js + Supabase, hosting Vercel), spójny design, większość funkcji core gotowa:

- Mapa boisk w Poznaniu (zaimportowane z OSM + wzbogacone AI: telefon, www, godziny, sposób rezerwacji)
- Organizacja meczów: tworzenie gry, zapisy, lista rezerwowa, goście bez konta
- Zaawansowane: drużyny (drag&drop, losowanie, kapitanowie), wyniki meczów, statystyki, płatności, potwierdzenia SMS
- Cykliczne gierki (stałe ekipy), przypomnienia, alerty o nowych grach w okolicy
- Logowanie Google + email (hasło / magic link / reset)
- Komentarze, profile publiczne graczy z reputacją, powtarzanie meczu, podział kosztów
- Panel admina: kontakt z obiektami (CRM), zarządzanie użytkownikami

**Infrastruktura:**
- Frontend: Vercel | Baza + Auth: Supabase | Email: Resend (`noreply@bojo.app`) | SMS: SMSAPI.pl (główny) + Twilio (zapasowy)
- 26 migracji bazy, 4 workflowy GitHub Actions do wzbogacania danych o obiektach

**Jedno wąskie gardło infrastrukturalne:** jest tylko **jedno środowisko** (prod). Każda zmiana idzie od razu na żywo. To pierwsza rzecz do naprawienia przy "realnym starcie".

---

## 2. SMS — bramka i optymalizacja kosztów

### Stan
- **SMSAPI.pl** = główny dostawca, **Twilio** = fallback. Limit 30 SMS/h na organizatora.

### Analiza kosztów (orientacyjnie, PL)
| Dostawca | Koszt / SMS | Uwagi |
|----------|-------------|-------|
| **SMSAPI.pl** (standard, z nazwą nadawcy "Bojo") | ~0,06–0,09 zł | pakiety obniżają cenę; nazwa nadawcy wymaga rejestracji (darmowa) |
| **SMSAPI.pl ECO** (bez nazwy nadawcy) | ~0,04 zł | tańsze, ale wolniejsze i bez brandingu |
| **Twilio** (PL) | ~0,16–0,30 zł | **3-5× drożej**, wymaga rejestracji Alphanumeric Sender ID, rozliczenie w USD |

### Rekomendacja
1. **Zostać przy SMSAPI jako głównym** — dla Polski jest bezkonkurencyjny cenowo. Twilio rozważyć do **usunięcia** (komplikuje kod i sekrety, a jest 3-5× droższy). Ewentualnie zostawić wyłączony jako "break glass".
2. **Zarejestrować nazwę nadawcy "Bojo"** w SMSAPI (darmowe) — SMS z "Bojo" zamiast losowego numeru = wygląda profesjonalnie i buduje markę.
3. **Najważniejsze — SMS to najdroższy kanał, więc minimalizować jego użycie.** Przesuwać komunikację na kanały darmowe/tanie:
   - **Link sharing (WhatsApp/Messenger)** — 0 zł, już działa, to główny kanał zapraszania
   - **Powiadomienia in-app** — 0 zł, już działa
   - **Email (Resend)** — ~0 zł (patrz niżej), idealny do przypomnień
   - **Push notifications (PWA)** — 0 zł, do zbudowania (Faza 1) — **to nasz przyszły główny darmowy kanał przypomnień**
   - **SMS rezerwować TYLKO na:** potwierdzenia obecności od osób bez konta/appki oraz pilne "gramy dziś". To realnie tnie koszt SMS o ~80%.

**Wniosek dla Jana:** koszt SMS przy rozsądnej strategii to grosze. Przy 100 aktywnych grach/mies. i SMS tylko na potwierdzenia → kilka–kilkanaście zł/mies. Nie jest to bariera.

---

## 3. Email — przypomnienie konfiguracji

- **Dostawca: Resend.** Nadawca: `noreply@bojo.app`. Szablony zaszyte w Edge Functions (zaproszenia, alerty o grach).
- **Koszt:** darmowy plan = **3000 maili/mies. (100/dzień)**. Płatny: $20/mies. za 50k maili. Na start z dużym zapasem — **0 zł**.
- **Do zrobienia:** zweryfikować domenę `bojo.app` w Resend (rekordy **SPF + DKIM** w DNS) — bez tego maile lecą do spamu lub są limitowane. To jednorazowe ~15 min.

---

## 4. Rozdzielenie środowisk dev / prod

To **priorytet #1 techniczny** przy "realnym starcie". Niski wysiłek, duża wartość — przestajemy testować na żywych użytkownikach.

### Plan (koszt: 0 zł na start)
1. **Supabase: drugi projekt `bojo-dev`** (darmowy tier) jako baza dev/staging. Migracje i nowe funkcje testujemy najpierw tam.
2. **Vercel: Preview Deployments już działają** out-of-the-box — każdy branch/PR dostaje własny URL. Trzeba tylko ustawić **osobne zmienne środowiskowe**:
   - `Production` → wskazuje na `bojo-prod` (Supabase produkcyjny)
   - `Preview` → wskazuje na `bojo-dev`
3. **Workflow gitowy:** `feature branch → PR → preview deploy (na bojo-dev) → review → merge do master → prod`. (Dziś pushujemy prosto na master.)
4. **Sekrety Edge Functions** ustawić osobno per projekt Supabase.

**Efekt:** bezpieczne testy, brak ryzyka zepsucia produkcji, możliwość pokazania Janowi/testerom wersji przed wdrożeniem.

---

## 5. Dług techniczny do domknięcia (krótka lista)

Z wcześniejszego zakresu zostało kilka rzeczy — szybkie do dokończenia:

- [ ] **Zastosować migrację 026** na Supabase (komentarze + activity log) — *bez tego nowe funkcje nie działają na prodzie*
- [ ] **Zod — walidacja danych z bazy** (mappery `toEvent`, `toField` itd. — dziś rzutowanie `any` bez walidacji runtime)
- [ ] **Dokończyć logowanie błędów** — część `.catch(()=>{})` już zastąpiona, zostało ~kilka miejsc
- [ ] **Ujednolicić copy "Zapisz się" / "Dołącz do gry"** — wybrać jedną wersję w całej apce
- [ ] **Weryfikacja domeny w Resend** (SPF/DKIM) — patrz pkt 3

---

## 6. Roadmapa (fazowa)

Priorytet: **wzrost i retencja** (monetyzacja dopiero przy trakcji).

### Faza 0 — Fundamenty (najbliższe 1-2 tyg.)
- Rozdzielenie dev/prod
- Domknięcie długu technicznego (pkt 5)
- Weryfikacja domeny Resend, rejestracja nadawcy "Bojo" w SMSAPI
- **Cel: stabilna baza pod growth.**

### Faza 1 — Akwizycja / viral (najbliższy miesiąc)
- **PWA + push notifications** — instalowalna apka na telefon + darmowy kanał przypomnień (zastępuje większość SMS)
- **Onboarding** — pierwsze wejście prowadzi do "stwórz lub znajdź grę" w < 1 min
- **Wzmocnienie pętli viralowej** — zapraszanie przez link już jest; dodać "udostępnij grę" wszędzie, podgląd OG ładny
- **Seed treści** — kilka realnych publicznych gier tygodniowo, żeby mapa nie była pusta (rola Jana: zebrać pierwsze ekipy)
- **SEO** — strony obiektów/sportów już są indeksowalne; rozwinąć pod frazy "boisko Poznań", "szukam do gry Poznań"
- **Cel: pierwszych 100 aktywnych użytkowników.**

### Faza 2 — Retencja (2-3 miesiąc)
- Dopracowane cykliczne gierki / stałe ekipy (to wraca użytkownika co tydzień)
- Reputacja i profile graczy (zaczęte) — frekwencja, "niezawodny gracz"
- Powiadomienia push o stałych grach, przypomnienia
- **Cel: użytkownik wraca co tydzień bez naszej zachęty.**

### Faza 3 — Monetyzacja (gdy jest trakcja)
- **Rezerwacje obiektów z prowizją** — `booking_enabled` już w kodzie; Jan domyka partnerstwa z obiektami (B2B)
- **Premium dla organizatorów** — darmowy core, płatne dodatki (SMS, statystyki, branding ekipy)
- **Cel: pierwszy przychód, walidacja modelu.**

---

## 7. Plan współpracy z Janem

Jan = **wspólnik biznesowy (nietechniczny)**. Podział kompetencji:

### Jan (biznes / growth)
- **Outreach do obiektów** — jest gotowy panel CRM (`admin/outreach`) z danymi wzbogaconymi AI (telefony, maile, sposób rezerwacji). Domykanie partnerstw, włączanie `booking_enabled`.
- **Marketing / akwizycja** — grupy FB (piłka/siatka/kosz Poznań), uczelnie (AWF, PP, UAM), kluby amatorskie, orliki
- **Pierwsze ekipy** — osobiście zebrać pierwsze stałe gierki (seed)
- **Feedback od użytkowników** → backlog
- **Partnerstwa i sprzedaż B2B** (obiekty) w Fazie 3

### Franek (tech / produkt)
- Rozwój aplikacji, infrastruktura, decyzje produktowo-techniczne
- Roadmapa techniczna, jakość, bezpieczeństwo

### Wspólnie
- Decyzje strategiczne i o monetyzacji
- **Cotygodniowy sync** + wspólny backlog (np. Notion / GitHub Projects)
- **KPI tygodniowe:** nowi użytkownicy, aktywne gry/tydzień, retencja (ilu wraca)

### ⚠️ Do ustalenia na tym spotkaniu (ważne wcześnie, nie później)
1. **Własność / equity** — jak dzielimy udziały? Czy zakładamy spółkę, czy umowa partnerska? (lepiej ustalić teraz, gdy nie ma jeszcze wartości, niż przy pierwszym przychodzie)
2. **Zaangażowanie czasowe** — ile godzin/tydzień każdy realnie wkłada?
3. **Definicja sukcesu na 3 i 6 miesięcy** — co musi się wydarzyć, żebyśmy uznali, że "chwyciło"?
4. **Budżet** — czy wkładamy własne pieniądze (domena, ewentualnie płatne plany), ile, jak rozliczamy?

---

## 8. Szata graficzna i UX

### Stan obecny
Design jest **spójny i profesjonalny**: system kolorów (zielony `#15663E`, amber `#F5A623`), fonty (Inter + Bricolage Grotesque), tokeny w Tailwind. To solidna baza — nie wstyd pokazać.

### Siostra (grafika) — gdzie da najwięcej wartości
Wchodzimy w growth, więc branding się opłaca. Konkretna prośba:
1. **Finalne logo + warianty** (dziś jest placeholder "B") — pozioma/kwadratowa/favicon
2. **Zestaw ilustracji "empty state"** (pusta lista gier, brak wyników itp.) — ociepla apkę
3. **Szablony social media** (post zapowiadający grę, plakat na uczelnię/orlik) — Jan będzie tego potrzebował do marketingu
4. **Dopracowany OG image** (podgląd linku) — jest podstawowy, można ładniej

→ Najwięcej daje **logo + zestaw marketingowy**, bo bezpośrednio wspiera akwizycję.

### UX — czy Claude wystarcza?
- Do **iteracji produktowych, flow, copy i implementacji** — tak, ogarniam to na bieżąco.
- **Świeże oko zewnętrznego UX-a** warto **po pierwszych użytkownikach** — na bazie realnego feedbacku (gdzie ludzie się gubią), nie teraz abstrakcyjnie. Wtedy 1-2 sesje testów z prawdziwymi użytkownikami dadzą więcej niż audyt UX bez danych.
- **Teraz nie jest to pilne.** Pilniejsze: branding od siostry + zebranie pierwszych użytkowników, żeby było na czym testować.

---

## TL;DR na spotkanie

1. **Produkt gotowy**, wdrożony, działa. Brakuje rozdzielenia dev/prod (priorytet techniczny #1, koszt 0 zł).
2. **Koszty komunikacji to grosze** — SMSAPI tani, email Resend darmowy, większość przypomnień przeniesiemy na darmowy push (PWA).
3. **Roadmapa:** najpierw fundamenty → akwizycja/viral → retencja → monetyzacja (rezerwacje + premium).
4. **Podział:** Jan = obiekty + marketing + pierwsze ekipy; Franek = tech + produkt.
5. **Ustalić dziś:** equity/własność, zaangażowanie, definicja sukcesu, budżet.
6. **Grafika:** poprosić siostrę o logo + zestaw marketingowy. UX zewnętrzny — później, po pierwszych użytkownikach.
