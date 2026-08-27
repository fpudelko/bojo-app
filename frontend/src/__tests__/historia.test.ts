import { describe, it, expect, beforeEach } from 'vitest';
import { zanotujPrzejscie, oznaczPowrot, maHistorieWAplikacji, zerujHistorie } from '@/lib/historia';

beforeEach(() => { zerujHistorie(); });

describe('głębokość historii w aplikacji', () => {
  // Wejście z linku (powiadomienie push, WhatsApp, ikona PWA) to świeży
  // kontekst JS: nie było żadnego przejścia, więc `router.back()` wyprowadziłby
  // z Bojo. To jest cały powód istnienia tego licznika.
  it('po wejściu z linku nie ma dokąd wracać', () => {
    expect(maHistorieWAplikacji()).toBe(false);
  });

  it('jedno przejście daje dokąd wracać', () => {
    zanotujPrzejscie();
    expect(maHistorieWAplikacji()).toBe(true);
  });

  // Powrót ZDEJMUJE poziom, nie dokłada. Bez tego licznik tylko rósłby (bo
  // `router.back()` też zmienia trasę, więc `SledzenieHistorii` go widzi)
  // i po powrocie do korzenia aplikacja dalej twierdziłaby, że jest gdzie
  // cofać — czyli wyprowadzałaby z Bojo przy następnym „wstecz".
  it('powrót zdejmuje poziom zamiast go dokładać', () => {
    zanotujPrzejscie();
    oznaczPowrot();
    zanotujPrzejscie(); // zmiana trasy wywołana przez router.back()
    expect(maHistorieWAplikacji()).toBe(false);
  });

  it('liczy zagnieżdżenie wielu ekranów', () => {
    zanotujPrzejscie();
    zanotujPrzejscie();
    zanotujPrzejscie();
    oznaczPowrot(); zanotujPrzejscie();
    expect(maHistorieWAplikacji()).toBe(true);
    oznaczPowrot(); zanotujPrzejscie();
    oznaczPowrot(); zanotujPrzejscie();
    expect(maHistorieWAplikacji()).toBe(false);
  });

  // Znacznik powrotu jest jednorazowy — inaczej jeden „wstecz" kasowałby
  // każde kolejne przejście w głąb.
  it('znacznik powrotu zużywa się po jednym przejściu', () => {
    zanotujPrzejscie();
    oznaczPowrot();
    zanotujPrzejscie(); // konsumuje znacznik, 1 → 0
    zanotujPrzejscie(); // zwykłe wejście w głąb, 0 → 1
    expect(maHistorieWAplikacji()).toBe(true);
  });

  // Nie schodzimy poniżej zera: powrót bez historii (np. po odświeżeniu
  // strony, które zeruje licznik) nie może zostawić ujemnego stanu, bo
  // kolejne wejście w głąb wróciłoby wtedy do zera i wstecz przestałoby
  // działać bez powodu.
  it('nie schodzi poniżej zera', () => {
    oznaczPowrot();
    zanotujPrzejscie();
    expect(maHistorieWAplikacji()).toBe(false);
    zanotujPrzejscie();
    expect(maHistorieWAplikacji()).toBe(true);
  });
});
