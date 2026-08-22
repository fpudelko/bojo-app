/* Service worker Bojo — CELOWO MINIMALNY.
 *
 * Robi dwie rzeczy i nic więcej: odbiera powiadomienia push i otwiera stronę
 * po kliknięciu w powiadomienie.
 *
 * DLACZEGO BEZ TRYBU OFFLINE. Service worker cache'ujący HTML potrafi serwować
 * stary build długo po deployu — a Bojo żyje z bazy, więc użytkownik oglądałby
 * nieaktualny skład meczu i nie miał pojęcia dlaczego. „Nie działa offline"
 * jest zrozumiałe; „pokazuje wczorajszy skład bez ostrzeżenia" nie jest.
 * Z tego samego powodu nie ma tu `next-pwa` ani Serwista: do samego pusha
 * żadna z tych bibliotek nie jest potrzebna, a obie domyślnie włączają
 * cache'owanie, którego tu nie chcemy.
 *
 * `install`/`activate` z pominięciem oczekiwania: nowa wersja przejmuje
 * kontrolę od razu, zamiast czekać, aż użytkownik zamknie wszystkie karty.
 * Przy pliku, który nic nie cache'uje, to jest bezpieczne i oszczędza
 * tygodnia z dwiema wersjami workera naraz.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (zdarzenie) => zdarzenie.waitUntil(self.clients.claim()));

self.addEventListener('push', (zdarzenie) => {
  // Serwer wysyła JSON, ale push bez treści też jest legalny (np. „obudź się
  // i sprawdź") — dlatego zapasowy tekst zamiast wyjątku w workerze, którego
  // i tak nikt by nie zobaczył.
  let dane = {};
  try {
    dane = zdarzenie.data ? zdarzenie.data.json() : {};
  } catch {
    dane = { tytul: 'Bojo', tresc: zdarzenie.data ? zdarzenie.data.text() : '' };
  }

  const tytul = dane.tytul || 'Bojo';
  const opcje = {
    body: dane.tresc || '',
    icon: '/ikony/ikona-192.png',
    badge: '/ikony/maskowalna-192.png',
    // `tag` sprawia, że kolejne powiadomienie o TYM SAMYM meczu podmienia
    // poprzednie, zamiast układać stos pięciu identycznych.
    tag: dane.tag || 'bojo',
    // `id` — identyfikator wiersza w `notifications` (migracja 119) — jedzie
    // do `notificationclick` niżej, żeby kliknięcie oznaczyło TĘ konkretną
    // pozycję jako przeczytaną w dzwonku. Bez tego dzwonek nie wiedział, że
    // telefon już to pokazał i użytkownik już to otworzył.
    data: { adres: dane.adres || '/', id: dane.id || null },
  };

  zdarzenie.waitUntil(self.registration.showNotification(tytul, opcje));
});

self.addEventListener('notificationclick', (zdarzenie) => {
  zdarzenie.notification.close();
  const dane = zdarzenie.notification.data || {};
  let adres = dane.adres || '/';
  // Service worker nie ma dostępu do sesji Supabase (localStorage strony), więc
  // nie może sam oznaczyć wiersza jako przeczytany — dokleja identyfikator do
  // adresu, a `NotificationBell.tsx` odczytuje go po stronie klienta i woła
  // `markRead()`. `adres` może już nieść `?tab=rozmowa` (patrz `adresPowiadomienia`
  // w `send-push`), stąd sprawdzenie, czy doklejać `?` czy `&`.
  if (dane.id) {
    adres += (adres.includes('?') ? '&' : '?') + 'przeczytaj=' + encodeURIComponent(dane.id);
  }

  zdarzenie.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((okna) => {
      // Jeśli Bojo jest już otwarte, przenosimy użytkownika w tej karcie
      // zamiast otwierać drugą — inaczej po tygodniu ma ich sześć.
      for (const okno of okna) {
        if ('focus' in okno) {
          okno.navigate(adres);
          return okno.focus();
        }
      }
      return self.clients.openWindow(adres);
    }),
  );
});
