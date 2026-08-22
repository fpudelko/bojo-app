/* Service worker Bojo — CELOWO MINIMALNY.
 *
 * Robi trzy rzeczy i nic więcej: odbiera powiadomienia push, stawia liczbę
 * nieprzeczytanych na ikonie aplikacji i otwiera stronę po kliknięciu
 * w powiadomienie.
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

  // Liczba na ikonie aplikacji. Push jest sygnałem jednorazowym — znika
  // z ekranu blokady i po nim nie zostaje ślad; plakietka zostaje, dopóki
  // jest co przeczytać. Wyliczyć jej tutaj się NIE DA: worker nie ma dostępu
  // do sesji Supabase (siedzi w localStorage strony), więc gotową liczbę
  // dokleja do pusha funkcja brzegowa `send-push`.
  //
  // Brak `nieprzeczytane` w treści oznacza starszą wersję funkcji brzegowej —
  // wtedy plakietki NIE RUSZAMY. Zdjęcie jej byłoby gorsze niż zostawienie
  // nieaktualnej: przychodzi właśnie powiadomienie, więc nieprzeczytane na
  // pewno są. Aplikacja i tak wyrówna liczbę przy najbliższym otwarciu
  // (`NotificationBell.tsx`).
  const zadania = [self.registration.showNotification(tytul, opcje)];
  // `typeof === 'number'`, nie `Number(...)`: brakującą liczbę funkcja
  // brzegowa wysyła jako `null`, a `Number(null)` to ZERO — plakietka
  // zgasłaby dokładnie w chwili, w której przyszło powiadomienie.
  const nieprzeczytane = typeof dane.nieprzeczytane === 'number' ? dane.nieprzeczytane : NaN;
  if (Number.isFinite(nieprzeczytane) && self.navigator && 'setAppBadge' in self.navigator) {
    const ile = Math.max(0, Math.floor(nieprzeczytane));
    zadania.push(
      // Ta sama logika co `ustawPlakietke()` w `lib/plakietkaAplikacji.ts` —
      // osobny runtime, nie da się współdzielić importu (tak samo jak
      // `adresPowiadomienia()` w `send-push`). Wywołanie owinięte, bo
      // odrzucenie (iOS bez zgody na powiadomienia) nie ma prawa przewrócić
      // `waitUntil` razem z samym powiadomieniem.
      Promise.resolve()
        .then(() => (ile === 0 ? self.navigator.clearAppBadge() : self.navigator.setAppBadge(ile)))
        .catch(() => {}),
    );
  }

  zdarzenie.waitUntil(Promise.all(zadania));
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
