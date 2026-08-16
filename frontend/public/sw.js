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
    data: { adres: dane.adres || '/' },
  };

  zdarzenie.waitUntil(self.registration.showNotification(tytul, opcje));
});

self.addEventListener('notificationclick', (zdarzenie) => {
  zdarzenie.notification.close();
  const adres = (zdarzenie.notification.data && zdarzenie.notification.data.adres) || '/';

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
