# Bojo — przewodnik dla współpracownika

> **Bojo** (Boiska Poznań) to aplikacja webowa, która pomaga znaleźć boisko w Poznaniu,
> zorganizować mecz i zebrać skład. Działa w przeglądarce, logowanie przez Google.

Ten dokument w 5 minut wprowadza Cię w to, co aplikacja potrafi i jak jest zbudowana.

---

## 1. Co widzi użytkownik

| Strona | Co robi |
|---|---|
| **Start** (`/`) | Strona główna — sporty, najbliższe mecze, „jak to działa" |
| **Mapa** (`/mapa`) | Interaktywna mapa z dwiema zakładkami: **Boiska** i **Mecze**. Filtry po sporcie, dostępności, nawierzchni. Klik w pinezkę → szczegóły |
| **Boiska wg sportu** (`/boiska/pilka-nozna`) | Lista boisk dla danego sportu (przyjazne adresy pod Google) |
| **Szczegóły boiska** (`/boisko/...`) | Adres, sporty, zdjęcie, opis, dane kontaktowe, nadchodzące mecze. Strona zoptymalizowana pod wyszukiwarki (JSON-LD) |
| **Wydarzenia** (`/wydarzenia`) | Lista meczów — publiczne i „moje". Filtry po sporcie, sortowanie po odległości od Ciebie |
| **Nowy mecz** (`/wydarzenia/nowe`) | Tworzysz mecz: sport, miejsce (z mapy lub adresu), data, godzina, liczba graczy, widoczność (publiczny/prywatny link) + opcje zaawansowane (obecność, płatności, termin potwierdzenia) |
| **Mecz** (`/wydarzenia/...`) | Dołącz / dodaj gościa / kopiuj link / podział na drużyny / wynik / lista rezerwowa / zgłoszenie gracza |
| **Moje gry** (`/moje-gry`) | Mecze, które organizujesz lub na które się zapisałeś + historia |
| **Cykliczne** (`/cykliczne`) | Szablony powtarzalnych meczów (np. „każdy wtorek 18:00") z zapisami |
| **Rezerwacje** (`/rezerwacje`) | Twoje rezerwacje terminów (funkcja włączana flagą — patrz niżej) |
| **Profil** (`/profil`) | Imię, awatar, telefon (za zgodą), usunięcie konta |

**Logowanie:** Google OAuth (przez Supabase). Bez logowania można przeglądać mapę i boiska; do tworzenia/dołączania trzeba się zalogować.

---

## 2. Co może menedżer obiektu

Właściciel/zarządca boiska (przypisany do obiektu) dostaje panel:

| Strona | Co robi |
|---|---|
| **Moje obiekty** (`/obiekt`) | Lista zarządzanych boisk + dodawanie nowego |
| **Pulpit obiektu** (`/obiekt/...`) | Skróty do harmonogramu, cennika i rezerwacji |
| **Harmonogram / Cennik** | Godziny otwarcia, długość slotów, ceny wg dnia i pory |
| **Rezerwacje obiektu** | Zatwierdzanie / odrzucanie rezerwacji graczy |

---

## 3. Co może admin

Admin = pole `is_admin = true` w tabeli `profiles`. Nadajesz je w panelu użytkowników albo SQL-em w Supabase.

| Strona | Co robi |
|---|---|
| **Użytkownicy** (`/admin/uzytkownicy`) | Lista kont, nadawanie/odbieranie roli admina, szukanie |
| **Kontakt z obiektami** (`/admin/outreach`) | **CRM do pozyskiwania boisk** — najważniejszy panel admina (opis niżej) |
| **Rezerwacje obiektu** (`/admin/...`) | Zarządzanie rezerwacjami i konfiguracją systemu rezerwacji dowolnego boiska |

### Panel „Kontakt z obiektami" (CRM)

Tu prowadzimy rozmowy z obiektami, żeby podłączyć je do rezerwacji. Dla każdego boiska:

- **Status w lejku:** nowy → do kontaktu → w toku → czeka na odpowiedź → zainteresowany → umówiony / odrzucony
- **Pełne dane kontaktowe** (telefon, e-mail, strona, operator, godziny, opis) — klik rozwija kartę
- **Przypisanie** — „Przejmij", żeby wziąć obiekt na siebie; widać, kto się nim zajmuje
- **Notatki, osoba kontaktowa, data oddzwonienia, ostatni kontakt**
- **Sekcja „AI znalazł"** — dane, które wyszukała automatyzacja (podsumowanie, link do rezerwacji)
- **Wykrywanie duplikatów** — jeśli ten sam telefon/e-mail jest w 3+ obiektach (zwykle błąd danych), pojawia się ostrzeżenie i przycisk „Wyczyść"
- **Filtry** (sport, kontakt, przypisanie, status, duplikaty) z licznikiem wyników + **eksport CSV**

---

## 4. Skąd się biorą dane o boiskach

Boisk jest ~1400. Dane uzupełniamy **automatycznie**, uruchamiając skrypty z zakładki **GitHub → Actions** (ręcznie, „Run workflow"). Kolejność:

| # | Workflow (Actions) | Co dorzuca | Koszt |
|---|---|---|---|
| 1 | **Import boisk** (`scraper.py`) | Boiska z OpenStreetMap + Google (z odsiewaniem duplikatów po GPS) | darmowe |
| 2 | **Google Venue Enrichment** | Telefon, strona, godziny — z Google Places (po współrzędnych) | w ramach $200/mc Google |
| 3 | **AI Venue Enrichment** (Claude) | E-mail, operator, opis, sposób rezerwacji — wyszukiwarka Claude | ~grosze/obiekt |
| 4 | **Booking System Extractor** (Claude) | Czyta stronę WWW i wykrywa system rezerwacji (telefon/własny/zewnętrzny) | ~grosze |

> Każdy job ma tryb **dry_run** (podgląd bez zapisu) — zawsze warto najpierw sprawdzić jakość na małym `limit`.

Wyniki trafiają do tabel `fields` (dane boiska) i `field_outreach` (status kontaktu + AI).

---

## 5. Stack i uruchomienie

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS → hosting na **Vercel**
- **Dane/Auth:** **Supabase** (PostgreSQL, logowanie Google, RLS). Migracje w `supabase/migrations/`
- **Mapa:** Leaflet + OpenStreetMap (bez tokenu). Mapbox tylko do miniaturek zdjęć (opcjonalny)
- **Automatyzacja:** Python (`scraper/`) + API Google i Claude, odpalane w GitHub Actions

```bash
# lokalnie
cp .env.example .env        # uzupełnij klucze Supabase
cd frontend
npm install
npm run dev                 # http://localhost:3000
npm test                    # testy jednostkowe (Vitest)
```

Struktura: `frontend/` (apka), `scraper/` (skrypty danych), `supabase/` (schema + migracje).

---

## 6. Pomysły na rozwój

- **Powiadomienia** — e-mail/push, gdy ktoś dołączy do meczu albo awansuje z rezerwy (dziś brak)
- **Agent kontaktowy** — automat, który wysyła maile do obiektów, zbiera odpowiedzi i podpowiada następny ruch w CRM (szkic gotowy, do uzgodnienia)
- **Wyszukiwarka** boisk po nazwie/dzielnicy na mapie
- **Zdjęcia** wgrywane przez użytkowników/menedżerów
- **Twardsze zabezpieczenia** (część reguł dostępu sprawdzana dziś po stronie przeglądarki — do domknięcia w RLS)

---

*Pytania? Najszybciej ogarnąć kod zaczynając od `frontend/src/app` (strony) i `frontend/src/lib` (logika + zapytania do Supabase).*
