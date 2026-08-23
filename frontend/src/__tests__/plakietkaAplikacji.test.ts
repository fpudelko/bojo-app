import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { plakietkaObslugiwana, ustawPlakietke } from '@/lib/plakietkaAplikacji';

/**
 * Plakietka na ikonie aplikacji (Badging API).
 *
 * Sprawdzamy tu jedno, ale za to jedyne, co da się sprawdzić bez telefonu:
 * że wywołania idą do przeglądarki w oczekiwanej postaci i że ŻADEN wariant
 * nie rzuca. Rzucający wyjątek jest tu realnym zagrożeniem, nie hipotezą —
 * `setAppBadge()` odrzuca obietnicę na iOS bez zgody na powiadomienia i w
 * zwykłej karcie przeglądarki, czyli w najczęstszym stanie, w jakim ten kod
 * się wykona.
 */

const ustaw = vi.fn<(n?: number) => Promise<void>>();
const wyczysc = vi.fn<() => Promise<void>>();

function podstawApi() {
  ustaw.mockReset().mockResolvedValue(undefined);
  wyczysc.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'setAppBadge', { value: ustaw, configurable: true, writable: true });
  Object.defineProperty(navigator, 'clearAppBadge', { value: wyczysc, configurable: true, writable: true });
}

function zabierzApi() {
  // @ts-expect-error — celowo zdejmujemy metodę, żeby odtworzyć przeglądarkę bez Badging API
  delete navigator.setAppBadge;
  // @ts-expect-error — j.w.
  delete navigator.clearAppBadge;
}

beforeEach(podstawApi);
afterEach(zabierzApi);

describe('plakietka na ikonie aplikacji', () => {
  it('liczba nieprzeczytanych ląduje na ikonie', async () => {
    await ustawPlakietke(3);
    expect(ustaw).toHaveBeenCalledWith(3);
    expect(wyczysc).not.toHaveBeenCalled();
  });

  it('zero ZDEJMUJE plakietkę', async () => {
    // Plakietka, która nie gaśnie po przeczytaniu, w tydzień uczy człowieka,
    // żeby jej nie ufać — i przestaje działać także wtedy, gdy coś jest.
    await ustawPlakietke(0);
    expect(wyczysc).toHaveBeenCalledTimes(1);
    expect(ustaw).not.toHaveBeenCalled();
  });

  it('wartość bez sensu zdejmuje plakietkę, zamiast ją zepsuć', async () => {
    await ustawPlakietke(Number.NaN);
    await ustawPlakietke(-2);
    expect(wyczysc).toHaveBeenCalledTimes(2);
    expect(ustaw).not.toHaveBeenCalled();
  });

  it('ułamek idzie w dół do pełnej liczby', async () => {
    await ustawPlakietke(2.7);
    expect(ustaw).toHaveBeenCalledWith(2);
  });

  it('odmowa przeglądarki nie wywraca wywołującego', async () => {
    // Tak wygląda iOS bez zgody na powiadomienia i każda zwykła karta.
    ustaw.mockRejectedValue(new Error('Not allowed'));
    await expect(ustawPlakietke(5)).resolves.toBeUndefined();
  });

  it('przeglądarka bez Badging API to cisza, nie wyjątek', async () => {
    zabierzApi();
    expect(plakietkaObslugiwana()).toBe(false);
    await expect(ustawPlakietke(4)).resolves.toBeUndefined();
    expect(ustaw).not.toHaveBeenCalled();
  });
});
