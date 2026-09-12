import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import PrzyciskMojaLokalizacja from '@/components/ui/PrzyciskMojaLokalizacja';
import { getCurrentLocation } from '@/lib/geo';

vi.mock('@/lib/geo', async (importOryginalu) => ({
  ...(await importOryginalu<typeof import('@/lib/geo')>()),
  getCurrentLocation: vi.fn(),
}));

const geo = vi.mocked(getCurrentLocation);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

// „Ustaw pinezkę na mojej lokalizacji" stoi w obu arkuszach filtrów
// (`/wydarzenia` i `/mapa`). Odmowa zgody na lokalizację to NORMALNY stan tej
// kontrolki, nie awaria — i to jest ta połowa, która psuje się po cichu, bo
// żeby ją zobaczyć w przeglądarce, trzeba najpierw odmówić zgody i potem
// odgrzebać ją w ustawieniach.

describe('PrzyciskMojaLokalizacja', () => {
  it('zgoda udzielona — oddaje współrzędne wywołującemu', async () => {
    geo.mockResolvedValue({ ok: true, lat: 52.4064, lng: 16.9252 });
    const naPozycje = vi.fn();
    render(<PrzyciskMojaLokalizacja onPozycja={naPozycje} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(naPozycje).toHaveBeenCalledWith(52.4064, 16.9252));
  });

  it('odmowa zgody — komunikat pod przyciskiem, wywołujący nie dostaje nic', async () => {
    geo.mockResolvedValue({ ok: false, kind: 'denied' });
    const naPozycje = vi.fn();
    render(<PrzyciskMojaLokalizacja onPozycja={naPozycje} />);

    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText(/Brak zgody na lokalizację/)).toBeTruthy();
    expect(naPozycje).not.toHaveBeenCalled();
  });

  it('własna etykieta — na mapie przycisk mówi o miejscowości, nie o promieniu', () => {
    render(<PrzyciskMojaLokalizacja onPozycja={() => {}} etykieta="Użyj mojej lokalizacji" />);
    expect(screen.getByRole('button').textContent).toContain('Użyj mojej lokalizacji');
  });
});
