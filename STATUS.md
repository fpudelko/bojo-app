# Bojo — Status projektu

*Aktualizacja: 2 czerwca 2026*

---

## Co aplikacja potrafi dziś

- **Przeglądanie boisk** — mapa Poznania z pinezkami, lista boisk, podstrona każdego boiska z adresem, zdjęciem i dostępnymi sportami
- **Tworzenie wydarzeń** — zalogowany użytkownik ustawia sport, datę, godzinę, maksymalną liczbę graczy i widoczność (publiczne/prywatne)
- **Dołączanie do wydarzeń** — lista chętnych, lista rezerwowa (gdy komplet), możliwość opuszczenia meczu
- **Strona „Moje mecze"** — widok wydarzeń, które organizujesz lub na które się zapisałeś
- **Logowanie przez Google** — przez Supabase Auth
- **Widok mapy** (`/mapa`) — wszystkie boiska i planowane mecze na mapie

---

## Co działa technicznie

| Obszar | Stan |
|---|---|
| Strona główna | Działa — ikony sportów, liczniki meczów w ten weekend, sekcja „Jak to działa" |
| Podstrony boisk (`/boisko/orlik-rataje`) | Działa — adresy SEO-friendly, tytuł i opis dla Google, lista nadchodzących meczów, schemat JSON-LD dla wyszukiwarek |
| Kategorie sportów (`/boiska/pilka-nozna`) | Działa — lista boisk per sport, prawidłowy tytuł dla Google |
| Mapa boisk | Działa |
| Tworzenie/edycja wydarzeń | Działa |
| Dołączanie / lista rezerwowa | Działa |
| Robots.txt i Sitemap XML | Działa — Google będzie indeksować poprawnie |
| Testy automatyczne | 14 testów — tworzenie wydarzeń, dołączanie, lista rezerwowa, generowanie adresów URL |

---

## Czego brakuje (priorytety)

### Pilne
1. **Brak powiadomień** — organizator nie dostaje e-maila gdy ktoś dołączy; gracz nie wie, że został awansowany z rezerwy
2. **Brak obsługi płatności** — można zaznaczyć „zapłacił", ale prawdziwy przelew/BLIK nie jest podłączony
3. **Brak weryfikacji numeru telefonu** — można wpisać dowolne imię i dołączyć jako gość

### Do przemyślenia
4. **Zdjęcia boisk** — na razie tylko dane z bazy; brak możliwości wgrania własnych fotek przez użytkownika
5. **Cykliczne mecze** — zakładka `/cykliczne` istnieje, ale nie ma jeszcze pełnej funkcjonalności
6. **Wyszukiwanie** — brak wyszukiwarki po nazwie boiska lub dzielnicy

---

## Rzeczy, o które warto się martwić

### Mała troska (do ogarnięcia przy okazji)
- **Martwy kod backendu** — w folderze `/backend/` jest plik Pythona z fałszywymi danymi testowymi. Nigdy nie jest uruchamiany. Warto usunąć, żeby nie mylić przyszłych deweloperów.
- **Pliki React Native** — `App.js`, `screens/`, `components/` w głównym folderze to pozostałość po wersji mobilnej, która nie powstała. Bezpieczne do usunięcia.

### Średnia troska (warto rozwiązać)
- **Autoryzacja po stronie frontendu** — sprawdzenie, czy użytkownik jest organizatorem, odbywa się w przeglądarce, nie na serwerze. Oznacza to, że technicznie sprytny użytkownik mógłby edytować cudzy mecz. Wymaga zabezpieczenia w bazie danych (Row Level Security w Supabase).
- **Zmienne środowiskowe** — klucze Supabase są publiczne (NEXT_PUBLIC_*), co jest normalną praktyką dla tego rodzaju kluczy, ale trzeba pilnować, żeby prywatny klucz serwisowy nigdy nie trafił do kodu.

### Brak poważnych problemów bezpieczeństwa
Nie znaleziono haseł ani sekretów w kodzie. Połączenie z bazą danych przez Supabase jest standardowe i bezpieczne.

---

## Podsumowanie jednym zdaniem

Aplikacja działa jako solidny prototyp — można przez nią planować mecze i zarządzać składem — ale brakuje jej powiadomień i zabezpieczeń po stronie serwera zanim trafi do szerszej publiczności.
