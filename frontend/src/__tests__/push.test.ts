import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Klucz USTAWIONY PRZED importem modułu: `lib/push.ts` czyta go raz, przy
// wczytaniu (`const KLUCZ_PUBLICZNY = process.env…`), więc ustawienie go
// w `beforeEach` byłoby już spóźnione.
vi.hoisted(() => { process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-klucz'; });

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn().mockResolvedValue({ error: null }) } }));

const stanPrzegladarki = vi.hoisted(() => ({
  wartosc: {
    zainstalowane: false,
    system: 'inny' as 'ios' | 'android' | 'inny',
    wbudowana: false,
    telefon: true,
  },
}));
vi.mock('@/lib/instalacja', () => ({
  czytajStanPrzegladarki: () => stanPrzegladarki.wartosc,
}));

import { supabase } from '@/lib/supabase';
import { stanPush, dopnijSubskrypcjePush } from '@/lib/push';

/** Podstawia API przeglądarki, którego jsdom nie ma. */
function ustawPrzegladarke({ api, zgoda, subskrypcja }: {
  api: boolean;
  zgoda?: NotificationPermission;
  subskrypcja?: boolean;
}) {
  if (!api) {
    // @ts-expect-error — celowo usuwamy API, tak wygląda stara przeglądarka
    delete window.PushManager;
    // @ts-expect-error — jw.
    delete window.Notification;
    return;
  }
  // @ts-expect-error — atrapa wystarczy, `stanPush` sprawdza samą obecność
  window.PushManager = function () {};
  // @ts-expect-error — jw.
  window.Notification = { permission: zgoda ?? 'default' };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: async () => ({
        pushManager: {
          getSubscription: async () => (subskrypcja
            ? { endpoint: 'https://x', toJSON: () => ({ endpoint: 'https://x', keys: { p256dh: 'p', auth: 'a' } }) }
            : null),
        },
      }),
    },
  });
}

beforeEach(() => {
  stanPrzegladarki.wartosc = { zainstalowane: false, system: 'inny', wbudowana: false, telefon: true };
});

afterEach(() => { vi.resetModules(); });

describe('stanPush', () => {
  it('iPhone w Safari prosi o instalację, a nie mówi „nieobsługiwane"', async () => {
    // To jest cały sens tego rozróżnienia: na iOS push działa WYŁĄCZNIE
    // w aplikacji z ekranu głównego, więc „nieobsługiwane" byłoby prawdą
    // techniczną i bezużyteczną informacją dla człowieka.
    stanPrzegladarki.wartosc = { zainstalowane: false, system: 'ios', wbudowana: false, telefon: true };
    ustawPrzegladarke({ api: false });
    expect(await stanPush()).toBe('wymaga-instalacji');
  });

  it('iPhone z ekranu głównego przechodzi dalej — instalacja już jest', async () => {
    stanPrzegladarki.wartosc = { zainstalowane: true, system: 'ios', wbudowana: false, telefon: true };
    ustawPrzegladarke({ api: true, zgoda: 'default', subskrypcja: false });
    expect(await stanPush()).toBe('wylaczone');
  });

  it('odmowa zgody to stan trwały, odróżniony od „wyłączone"', async () => {
    ustawPrzegladarke({ api: true, zgoda: 'denied' });
    expect(await stanPush()).toBe('zablokowane');
  });

  it('istniejąca subskrypcja = włączone', async () => {
    ustawPrzegladarke({ api: true, zgoda: 'granted', subskrypcja: true });
    expect(await stanPush()).toBe('wlaczone');
  });

  it('brak klucza VAPID = nieobsługiwane, zamiast przycisku, który nie zadziała', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = '';
    vi.resetModules();
    const { stanPush: swiezy } = await import('@/lib/push');
    ustawPrzegladarke({ api: true, zgoda: 'default', subskrypcja: false });
    expect(await swiezy()).toBe('nieobslugiwane');
  });
});

// Naprawa migracji 117: subskrypcja przeglądarki dostaje user_id wyłącznie
// przy kliknięciu „Włącz" — na współdzielonym urządzeniu zostawała przypięta
// do PIERWSZEGO konta na zawsze. `dopnijSubskrypcjePush()` woła się po cichu
// przy logowaniu i przez RPC (nie zwykły upsert — RLS UPDATE sprawdzałby
// właściciela STAREGO wiersza i po cichu blokował reassignment).
describe('dopnijSubskrypcjePush', () => {
  it('bez istniejącej subskrypcji nic nie woła — nie ma czego dopinać', async () => {
    ustawPrzegladarke({ api: true, zgoda: 'default', subskrypcja: false });
    await dopnijSubskrypcjePush();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('z istniejącą subskrypcją woła RPC z jej endpointem i kluczami', async () => {
    ustawPrzegladarke({ api: true, zgoda: 'granted', subskrypcja: true });
    await dopnijSubskrypcjePush();
    expect(supabase.rpc).toHaveBeenCalledWith('dopnij_subskrypcje_push', expect.objectContaining({
      p_endpoint: 'https://x',
    }));
  });

  it('błąd przeglądarki nie rzuca — logowanie nie może się wywrócić', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: async () => { throw new Error('brak'); } },
    });
    await expect(dopnijSubskrypcjePush()).resolves.toBeUndefined();
  });
});
