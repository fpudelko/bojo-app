import { supabase } from './supabase';
import { czytajStanPrzegladarki } from './instalacja';

/**
 * Powiadomienia push w przeglądarce.
 *
 * TRZY RZECZY, KTÓRE TU DECYDUJĄ O WSZYSTKIM:
 *
 * 1. NA iOS PUSH DZIAŁA WYŁĄCZNIE W APLIKACJI DODANEJ DO EKRANU GŁÓWNEGO.
 *    W Safari otwartym normalnie `Notification` w ogóle nie istnieje albo
 *    prośba o zgodę kończy się odmową bez okna. Dlatego `stanPush()` odróżnia
 *    „nie da się tutaj" od „nie włączone" — komunikat „włącz powiadomienia",
 *    którego fizycznie nie da się spełnić, jest gorszy niż jego brak.
 *
 * 2. O ZGODĘ PYTAMY WYŁĄCZNIE PO KLIKNIĘCIU. Prośba przy wejściu na stronę
 *    to najszybszy sposób na trwałe „Zablokuj" — a odmowy nie da się cofnąć
 *    z poziomu strony, trzeba grzebać w ustawieniach przeglądarki.
 *
 * 3. SUBSKRYPCJA JEST PER PRZEGLĄDARKA, nie per konto. Telefon i laptop to
 *    dwa wiersze w `push_subscriptions` i oba mają dostawać powiadomienia.
 */

export type StanPush =
  | 'nieobslugiwane'   // przeglądarka nie ma push/service workera
  | 'wymaga-instalacji' // iOS w Safari — najpierw „Dodaj do ekranu głównego"
  | 'zablokowane'      // użytkownik odmówił; odblokowanie tylko w ustawieniach
  | 'wylaczone'        // da się włączyć
  | 'wlaczone';

/** Klucz publiczny VAPID — z założenia jawny, siedzi w kodzie strony.
 *  Prywatny mieszka wyłącznie w sekretach funkcji brzegowej. */
const KLUCZ_PUBLICZNY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

/** base64url → Uint8Array; `pushManager.subscribe` nie przyjmuje stringa. */
function naBajty(base64url: string): Uint8Array<ArrayBuffer> {
  const dopelnienie = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + dopelnienie).replace(/-/g, '+').replace(/_/g, '/');
  const surowe = atob(base64);
  const bajty = new Uint8Array(new ArrayBuffer(surowe.length));
  for (let i = 0; i < surowe.length; i += 1) bajty[i] = surowe.charCodeAt(i);
  return bajty;
}

export async function stanPush(): Promise<StanPush> {
  if (typeof window === 'undefined') return 'nieobslugiwane';

  const { system, zainstalowane } = czytajStanPrzegladarki();
  const maApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  // Kolejność ma znaczenie: na iOS w Safari API bywa niewidoczne, więc bez
  // tego sprawdzenia PRZED `maApi` iPhone dostawał „nieobsługiwane" —
  // komunikat prawdziwy technicznie i bezużyteczny dla człowieka, bo nie
  // mówi, że wystarczy dodać Bojo do ekranu głównego.
  if (system === 'ios' && !zainstalowane) return 'wymaga-instalacji';
  if (!maApi || !KLUCZ_PUBLICZNY) return 'nieobslugiwane';
  if (Notification.permission === 'denied') return 'zablokowane';

  const rejestracja = await navigator.serviceWorker.getRegistration();
  const subskrypcja = await rejestracja?.pushManager.getSubscription();
  return subskrypcja ? 'wlaczone' : 'wylaczone';
}

/**
 * Włącza powiadomienia: pyta o zgodę, tworzy subskrypcję, zapisuje ją w bazie.
 * Woła się WYŁĄCZNIE z obsługi kliknięcia (patrz zasada 2 w nagłówku).
 */
export async function wlaczPush(userId: string): Promise<void> {
  if (!KLUCZ_PUBLICZNY) throw new Error('Powiadomienia nie są jeszcze skonfigurowane.');

  const zgoda = await Notification.requestPermission();
  if (zgoda !== 'granted') {
    throw new Error(
      zgoda === 'denied'
        ? 'Powiadomienia są zablokowane w ustawieniach przeglądarki.'
        : 'Bez zgody nie wyślemy powiadomień.',
    );
  }

  const rejestracja = await navigator.serviceWorker.ready;
  // `getSubscription()` przed `subscribe()`: przy ponownym włączeniu
  // przeglądarka odda istniejącą subskrypcję zamiast rzucić błędem, a my
  // i tak musimy ją zapisać — wiersz w bazie mógł zniknąć, gdy ktoś wcześniej
  // wyłączył powiadomienia na innym urządzeniu.
  const subskrypcja = await rejestracja.pushManager.getSubscription()
    ?? await rejestracja.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: naBajty(KLUCZ_PUBLICZNY),
    });

  const dane = subskrypcja.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: subskrypcja.endpoint,
    p256dh: dane.keys?.p256dh ?? '',
    auth: dane.keys?.auth ?? '',
    przegladarka: navigator.userAgent.slice(0, 300),
  }, { onConflict: 'endpoint' });
  if (error) throw new Error(error.message);
}

/**
 * Wyłącza: odpina subskrypcję w przeglądarce i kasuje wiersz.
 *
 * OBA KROKI, nie jeden. Sam wiersz bez odpięcia = przeglądarka dalej trzyma
 * subskrypcję, więc ponowne włączenie oddaje ten sam endpoint i wygląda, jakby
 * nic się nie stało. Samo odpięcie bez kasowania = martwy wiersz, do którego
 * wysyłka leci aż do pierwszego 410.
 */
export async function wylaczPush(userId: string): Promise<void> {
  const rejestracja = await navigator.serviceWorker.getRegistration();
  const subskrypcja = await rejestracja?.pushManager.getSubscription();
  if (subskrypcja) {
    await supabase.from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', subskrypcja.endpoint);
    await subskrypcja.unsubscribe();
  }
}
