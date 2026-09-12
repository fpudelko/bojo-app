import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SportChip from '@/components/ui/SportChip';
import { domyslneZFiltrow, PROMIEN_MIN, PROMIEN_MAX, PROMIEN_DOMYSLNY } from '@/lib/alerts';

afterEach(cleanup);

// Wejście do alertu („Powiadom mnie, gdy się pojawi") siedzi w pustym stanie
// listy meczów, czyli dokładnie tam, gdzie filtry już opisują, czego ktoś
// szuka. Dwie rzeczy, które łatwo zgniją po cichu, bo widać je dopiero po
// przeklikaniu się do pustego wyniku.

describe('domyslneZFiltrow — okno alertu nie pyta o to, co już powiedziały filtry', () => {
  it('jeden wybrany sport przenosi się do alertu', () => {
    const d = domyslneZFiltrow({ sports: ['koszykówka'], radiusKm: null, pozycja: null });
    expect(d.sport).toBe('koszykówka');
  });

  it('dwa sporty naraz to „dowolny" — alert trzyma jeden, więc wybór za kogoś byłby zmyśleniem', () => {
    const d = domyslneZFiltrow({ sports: ['koszykówka', 'siatkówka'], radiusKm: null, pozycja: null });
    expect(d.sport).toBeUndefined();
  });

  it('brak sportu w filtrach to też „dowolny"', () => {
    expect(domyslneZFiltrow({ sports: [], radiusKm: null, pozycja: null }).sport).toBeUndefined();
  });

  it('promień z filtrów wchodzi wprost', () => {
    expect(domyslneZFiltrow({ sports: [], radiusKm: 8, pozycja: null }).radiusKm).toBe(8);
  });

  it('filtr chodzi od 1 km, suwak alertu od 3 — wartość spoza skali jest przycinana, nie przenoszona', () => {
    expect(domyslneZFiltrow({ sports: [], radiusKm: 1, pozycja: null }).radiusKm).toBe(PROMIEN_MIN);
    expect(domyslneZFiltrow({ sports: [], radiusKm: 99, pozycja: null }).radiusKm).toBe(PROMIEN_MAX);
  });

  it('bez promienia w filtrach — wartość domyślna, nie zero', () => {
    expect(domyslneZFiltrow({ sports: [], radiusKm: null, pozycja: null }).radiusKm).toBe(PROMIEN_DOMYSLNY);
  });

  it('pozycja gracza przenosi się, gdy lista ją zna', () => {
    const d = domyslneZFiltrow({ sports: [], radiusKm: null, pozycja: { lat: 52.4, lng: 16.9 } });
    expect(d.lat).toBe(52.4);
    expect(d.lng).toBe(16.9);
  });
});

describe('SportChip — podpis dopiero po wybraniu', () => {
  it('niewybrany sport to sama ikona, ale nazwa zostaje dla czytnika ekranu', () => {
    render(<SportChip emoji="🏐" label="Siatkówka" selected={false} onClick={() => {}} />);
    const chip = screen.getByRole('button', { name: 'Siatkówka' });
    expect(chip.textContent).toBe('🏐');
    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });

  it('wybrany sport pokazuje podpis — wtedy trzeba go przeczytać', () => {
    render(<SportChip emoji="🏐" label="Siatkówka" selected onClick={() => {}} />);
    const chip = screen.getByRole('button', { name: 'Siatkówka' });
    expect(chip.textContent).toContain('Siatkówka');
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });
});
