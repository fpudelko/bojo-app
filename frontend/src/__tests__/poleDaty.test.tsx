import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import EventDateTimeField from '@/components/events/EventDateTimeField';

// Pole daty kreatora i edycji — dwie rzeczy, które łatwo zgniły po cichu.
//
// SKĄD TEN PLIK. Zrzut `kreator-krok-1.png` robił `fullPage` z komentarzem
// „krok 1 nie ma w sobie żadnej daty ani liczby z bazy". Było to prawdą do
// 2026-08-22, gdy krok pierwszy pytał o sport i miejsce. Po zamianie kroków
// data przeszła na krok pierwszy, komentarz został — i wzorzec zaczął padać
// KAŻDEGO DNIA, bo wartość domyślna to „jutro". Za każdym razem wyglądało to
// na świeżą zmianę wyglądu, więc nikt nie szukał przyczyny.
//
// Maska w scenariuszu zasłania to miejsce selektorem `[data-pole-daty]`.
// Playwright NIE zgłasza błędu, gdy maska nie trafia w nic — po prostu maluje
// zero pikseli. Czyli usunięcie tego atrybutu przywróciłoby dokładnie ten sam
// cichy rozjazd, od którego zaczęliśmy. Ten test jest jedynym miejscem, które
// tego pilnuje.

afterEach(cleanup);

const bazowe = {
  time: '18:00',
  setTime: () => {},
  durationMin: 90,
  setDurationMin: () => {},
  czasWlasny: false,
  setCzasWlasny: () => {},
  inputCls: '',
};

describe('EventDateTimeField', () => {
  it('opakowanie daty niesie `data-pole-daty` — po tym selektorze maskuje je scenariusz', () => {
    const { container } = render(
      <EventDateTimeField {...bazowe} date="2099-08-30" setDate={() => {}} />,
    );
    const opakowanie = container.querySelector('[data-pole-daty]');
    expect(opakowanie, 'brak `data-pole-daty` — maska w scenariuszu przestanie cokolwiek zasłaniać').not.toBeNull();
    // Maska ma zakryć OBIE ruchome wartości: samo pole i zdanie pod nim.
    expect(opakowanie!.querySelector('input[type="date"]')).not.toBeNull();
    expect(opakowanie!.textContent).toContain('niedziela, 30 sierpnia');
  });

  it('pod datą stoi dzień tygodnia — to jest cała wartość tej linijki', () => {
    render(<EventDateTimeField {...bazowe} date="2099-08-30" setDate={() => {}} />);
    expect(screen.getByText(/niedziela, 30 sierpnia/)).toBeTruthy();
  });

  it('komunikat błędu wypiera opis daty — dwie linijki pod jednym polem to szum', () => {
    render(
      <EventDateTimeField
        {...bazowe}
        date="2099-08-30"
        setDate={() => {}}
        dateError="Mecz nie może zaczynać się w przeszłości."
      />,
    );
    expect(screen.getByText(/w przeszłości/)).toBeTruthy();
    expect(screen.queryByText(/niedziela, 30 sierpnia/)).toBeNull();
  });
});
