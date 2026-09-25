# Przegląd konkurencji — wrzesień 2026

**Stan na:** 2026-09-25. Zakres: aplikacje do umawiania meczów (gierek), rezerwacji
obiektów i organizacji turniejów/lig, działające w Polsce, plus kilka zagranicznych
wzorców, które warto znać.

Ten dokument **nie zmienia osi strategii**. [wizja.md](./wizja.md) mówi, że Bojo zaczyna
od organizacji gry, a rezerwacje przychodzą później; [analiza-gtm-2026-09.md](./analiza-gtm-2026-09.md)
(„Poziom 5") mówi, że realnym konkurentem dziś są Messenger i WhatsApp, nie aplikacje.
Oba wnioski stoją. Ten plik odpowiada na węższe pytanie: **kto jeszcze robi to samo co
Bojo i co z tego wynika dla produktu, copy i turniejów.** Poprzednie rozpoznanie
(sierpień 2026) → [seo-geo-strategia.md](./seo-geo-strategia.md#tło-konkurencyjne--poza-osią-strategii).

## Jak powstał i czego nie wie

- Źródło: wyszukiwarka (wyniki ustawione pod rynek amerykański), opisy ze sklepów
  z aplikacjami, artykuły prasowe. **Stron samych konkurentów nie dało się otworzyć**
  (proxy środowiska agenta blokuje te domeny), więc opisy funkcji pochodzą z ich
  własnych opisów w sklepach i z prasy, nie z klikania w produkt.
- **Liczby użytkowników to deklaracje** z prasy albo od samych firm, często sprzed lat.
  Traktuj je jako rząd wielkości, nie pomiar.
- Nikt nie zakładał kont ani nie przechodził ścieżek. Zanim cokolwiek z tego pójdzie do
  copy („jako jedyni…"), sprawdź ręką na telefonie.

## Mapa pola w jednym zdaniu na kategorię

| Kategoria | Kto | Stan pola |
|---|---|---|
| **Umawianie gierek** (to, co Bojo robi dziś) | Orlikfy, GRAMY, amator.app, LocalPlay, Meet and Play | **Zatłoczone.** Pięć polskich produktów z tą samą obietnicą; żaden nie ma pozycji dominującej. |
| **Rezerwacja obiektów** | BallSquad, Playmore, Playtomic, Kluby.org, systemy gminne (Orlik+, e-Rezerwacja) | **Podzielone po typie obiektu:** BallSquad = obiekty publiczne i szkolne, Playmore/Playtomic/Kluby.org = korty (tenis, padel, squash). |
| **Turnieje i ligi** | FC.APP, 4league, Playarena, Tournify, Challonge, Winner, Competize, Tourney, tg-app, Gampre, ligowe.pl, Tenisime, Piłka Lokalna | **Bardzo zatłoczone** w wersji „generator drabinki"; puste w wersji „turniej zrośnięty z graczami, którzy już grają razem". |
| **Zarządzanie drużyną** | Spond, SportEasy, Heja (Teamer znika 5.10.2026) | Klubowe i młodzieżowe, nie gierkowe. Obok pola Bojo, nie na nim. |

---

## 1. Umawianie meczów — bezpośrednia konkurencja

| Aplikacja | Co robi | Skala / zasięg | Czym różni się od Bojo |
|---|---|---|---|
| **Orlikfy** | Mapa gier w okolicy, filtry, tworzenie wydarzenia, zarządzanie składem, powiadomienie o nowej grze w okolicy | Kraków od połowy 2024, ok. 3,5 tys. użytkowników (prasa), plan wejścia do dużych miast; iOS + Android | **Najbliższy bliźniak obietnicy** („gry na orliku w pobliżu" + alert). Nastawiony na piłkę na orliku. Aplikacja do instalacji. |
| **GRAMY** (gramyapp.pl) | Gierki: siatkówka, piłka, koszykówka, futsal, ręczna. Drużyna zaprasza cały skład jednym kliknięciem. **Lista rezerwowa: pierwszy z rezerwy dostaje powiadomienie i ma 30 minut na potwierdzenie.** Ocena rzetelności gracza, punkty (bonus za wskoczenie w ostatniej chwili), poziom gry, cena | brak danych | **Najbliższy bliźniak funkcji.** Kolejka z oknem na decyzję i „ekipa zaprasza skład" to dokładnie mechanika Bojo. Dokłada to, czego Bojo nie ma: ocenę rzetelności i grywalizację. |
| **amator.app** | Tworzenie meczu w minutę, dołączanie jednym kliknięciem, **automatyczny czat przy każdym meczu** („zamiast Messengera"), historia meczów i wyników, społeczność graczy | Warszawa, Kraków, Gdańsk, „cała Polska"; darmowa; LLM-y polecają ją na pytanie o aplikację do meczów ([seo-geo-strategia.md](./seo-geo-strategia.md)) | Tylko piłka nożna. Ta sama argumentacja co Bojo („zamiast komunikatora"). |
| **LocalPlay** | Wydarzenia i mapa, drużyny, **turnieje i zapisy na nie**, profile i statystyki graczy z całej Polski, miejsce dla szkółek i obiektów | Deklarowane 100 tys. użytkowników dwa tygodnie po starcie (prasa sprzed lat); inwestor ICEO Ventures; wiele dyscyplin, nawet e-sport i planszówki | Najszerszy zakres (gierki + turnieje + obiekty). Najmocniejszy ślad medialny (INNPoland, rp.pl). |
| **Meet and Play** | Wybór sportu/boiska/godziny, tworzenie spotkania z preferowanym wiekiem graczy, czat, **ranking i nagrody za aktywność** | brak danych; piłka, koszykówka, tenis stołowy | Grywalizacja zamiast rozliczeń. |
| Playarena (aplikacja Nike Football) | Narzędzie kapitana drużyny w lidze Playarena: skład, powiadomienia o meczach ligowych | Ligi w ok. 90 miastach | Służy lidze, nie gierce. Patrz §3. |

### Zagraniczne wzorce (nie działają w Polsce, ale pokazują, dokąd idzie kategoria)

- **Capo** (Wielka Brytania, start 2025) — cotygodniowa gierka ze znajomymi: jedno
  kliknięcie „gram/nie gram", **automatyczny awans z listy rezerwowej**, zaproszenia
  warstwowe (stali gracze mają pierwszeństwo), **płatność pobierana przy zapisie
  z automatyczną wypłatą dla organizatora**, dobór wyrównanych składów algorytmem
  (forma, bilans, gole), statystyki w stylu fantasy, profile gracza pisane przez AI.
  To niemal lista funkcji Bojo plus płatności w aplikacji i balans składów.
- **Footy Addicts** (UK), **Plei** (USA) — płatne gry prowadzone przez operatora:
  gracz kupuje miejsce w meczu, operator dba o boisko i komplet. Inny model
  (operator, nie organizator-amator).
- **Teamer** (UK, grupa Pitchero) **zamyka się 5 października 2026**, bez eksportu
  danych. Sygnał, że kategoria „narzędzie do drużyny" konsoliduje się u graczy
  z modelem przychodowym, a darmowe narzędzie bez modelu po latach znika.

## 2. Rezerwacja obiektów

| Aplikacja | Co robi | Zasięg | Znaczenie dla Bojo |
|---|---|---|---|
| **BallSquad** | SaaS dla obiektów + marketplace: wyszukanie i rezerwacja boiska, hali, sali (także szkolnych i konferencyjnych), rezerwacje jednorazowe i długoterminowe, **płatność online z podziałem kosztu między uczestników**, profil gracza z ulubionymi sportami, **tworzenie wydarzenia dla ludzi z okolicy** | Warszawa, Kraków (komunikat w BIP miasta), Poznań, Wrocław, Gdynia, Sosnowiec, Radom, Ruda Śląska, Świętochłowice, Lubań; od 2018, inwestor Brave VC, pożyczka BGK | Jedyny, który **od strony obiektów wchodzi w pole Bojo** — podział kosztu i wydarzenia to już organizacja meczu. Siła: umowy z gminami i szkołami, czyli właśnie hale zimą. |
| **Playmore** (dawniej Reservise) | Rezerwacje kortów, zajęć, karnetów; system dla klubu (grafik, płatności, automatyka obiektu, „regularne granie") | Setki klubów rakietowych; w rejestrze KNF jako dostawca płatności | Rakiety, nie gry zespołowe. LLM-y polecają go na pytanie o rezerwację zamiast Bojo. |
| **Playtomic** | Rezerwacja kortów (padel, tenis, pickleball), **otwarte mecze do dobrania graczy**, grupy, poziomy | Globalnie ok. 6 tys. klubów, 1,5 mln aktywnych graczy/mies., 63 kraje; w Polsce duże kluby padlowe (Interpadel, Warsaw Padel Club, Padel PL Wrocław); zbiórka crowdfundingowa 5,1 mln € (XI 2025) | Pokazuje model docelowy wizji Bojo (rezerwacja + dobieranie graczy) — ale dla sportów, gdzie gra się we czwórkę na korcie klubowym. |
| **Kluby.org** | Rezerwacje kortów online, turnieje | Wiele klubów tenisowych i padlowych | Jak Playmore. |
| **Systemy gminne i MOSiR** | Orlik+ (Ozimek, Wieliczka i in.), e-Rezerwacja Sportowy Rzeszów, rezerwacje boisk szkolnych w Gdyni, Kalety, Czarnków, Chorzów | Rozproszone, każdy na swoim adresie | Nie konkurent, tylko **dane**: to tam jest odpowiedź „jak wynająć orlik w X". Katalog obiektów Bojo mógłby do nich odsyłać. |

## 3. Turnieje i ligi

| Aplikacja | Dla kogo | Uwagi |
|---|---|---|
| **FC.APP** | Akademie i drużyny młodzieżowe, organizatorzy turniejów piłkarskich | ~10 tys. użytkowników z ok. 3,5 tys. drużyn (Lech Poznań, Górnik Łęczna); generator turnieju: liga, każdy z każdym, puchar, grupy; „turniej w 5 minut, za darmo"; zbierała kapitał na Emiteo. Najmocniejsza marka turniejowa w polskiej piłce. |
| **4league** | Ligi i puchary amatorskie, grupy społecznościowe, federacje (plan Pro) | Tabele i terminarz z automatu, **relacja na żywo** (gole, kartki, zmiany), profile graczy ze statystykami, XP i osiągnięcia, **każda liga publiczna do obserwowania**. Darmowe dla grup społecznościowych. LLM-y polecają ją na pytanie o aplikację do meczów. |
| **Playarena** | Ligi piłkarskie w ok. 90 miastach, sezon 2025/26 | Operator lig, nie narzędzie — gracz płaci za udział w rozgrywkach. |
| **ligowe.pl**, **Piłka Lokalna** | Organizatorzy lig amatorskich; kibice lig okręgowych | ligowe.pl = system do prowadzenia ligi; Piłka Lokalna = wyniki i tabele od III ligi po ligi osiedlowe. |
| **Tournify** | Turnieje drużynowe (piłka, kosz, siatka), zapisy, terminarz, wyniki na żywo | Darmowe do 128 drużyn; Pro 19 €/mies. |
| **Challonge**, **Competize**, **Winner**, **Tourney**, **tg-app.pl**, **Gampre** | Generatory drabinek i tabel, dowolny sport | Szybkie „wpisz drużyny, dostań drabinkę". Bez graczy z kontami, bez historii. |
| **Tenisime**, **tenis4U** | Tenis: turnieje, ligi, sparingi, ranking ELO, mapa kortów | Pokazuje, że w jednej dyscyplinie da się złożyć gierkę + turniej + ranking w jednym produkcie za darmo. |

---

## Co z tego wynika dla Bojo

### 1. „Lista rezerwowa z czasem na decyzję" nie jest już wyróżnikiem

GRAMY ma dokładnie tę mechanikę (30 minut na potwierdzenie), Capo ma automatyczny
awans. Bojo nadal ma rzeczy, których w opisach konkurentów nie widać:

- **zapis z linku bez instalacji i bez konta** (wszyscy polscy konkurenci to
  aplikacje ze sklepu; to jest realna przewaga wobec grupy na Messengerze, gdzie
  link otwiera się jednym kliknięciem),
- **tryby miejsc dla bramkarzy** (osobny limit / wspólna pula),
- **rozliczenie po polsku**: BLIK na numer organizatora, zniżka z kartą sportową,
  „wszyscy oddali" (Capo robi płatność w aplikacji, ale w UK; BallSquad dzieli koszt,
  ale tylko przy rezerwacji w swoim obiekcie),
- **katalog obiektów z informacją, kto tam gra i kiedy** (tego nie mają ani Mapy
  Google, ani Orlikfy w wersji mapy gier),
- wiele sportów w jednym miejscu (Orlikfy i amator.app to głównie piłka).

**Wniosek dla copy:** nie pisać „jako jedyni masz rezerwę z kolejką". Pisać o skutku:
link, który działa bez instalacji, i rozliczenie, które się samo liczy.

Brak auto-awansu z rezerwy jest w Bojo **świadomą decyzją** (AGENTS.md). Capo i GRAMY
robią to inaczej — to informacja, nie argument za zmianą. Jeśli rozmowa kiedyś wróci,
wraca z tym porównaniem, a nie z hasłem „konkurencja ma".

### 2. Czego konkurenci mają, a Bojo nie — do rozważenia, nie do wdrożenia

| Funkcja | Kto ma | Komentarz |
|---|---|---|
| Ocena rzetelności gracza (czy przychodzi) | GRAMY | Bojo ma już oznaczanie nieobecności ([funkcje.md](./funkcje.md#oznaczanie-nieobecności)) — wskaźnik jest o krok. Ryzyko: ocena ludzi w małej ekipie potrafi zniechęcić. |
| Wyrównane składy z algorytmu | Capo | Bojo ma losowanie drużyn; algorytm potrzebuje historii wyników, której przy starcie nie ma. |
| Grywalizacja (punkty, rankingi, XP) | Meet and Play, GRAMY, 4league | Wizja mówi o „historii, statystykach i rywalizacji" — to ten kierunek, ale później. |
| Relacja meczu na żywo, obserwowanie ligi | 4league, Tournify | Moduł turniejowy Bojo ma zdarzenia meczu (migracja `147`) — to już jest. |
| Płatność w aplikacji | Capo, BallSquad, Playmore, Playtomic | Wymaga podmiotu prawnego i operatora płatności ([analiza-gtm-2026-09.md](./analiza-gtm-2026-09.md)). Nie teraz. |

### 3. Turnieje: nie wchodzić w wojnę generatorów drabinek

Generatorów drabinki jest kilkanaście, darmowych. FC.APP ma młodzieżową piłkę, 4league
ligi publiczne z relacją na żywo, Playarena ligi płatne w 90 miastach. Moduł turniejowy
Bojo (flaga `SHOW_TURNIEJE`, [turnieje-plan-duze-klocki.md](./turnieje-plan-duze-klocki.md))
ma sens tylko tam, gdzie reszta jest słaba:

- **zawodnicy mają konta i historię** — skład prowadzi do profilu, gole liczą się
  do statystyk gracza, turniej wyrasta z ekip, które już grają razem w Bojo;
- **jednorazowy turniej lokalny** (osiedlowy, firmowy, charytatywny), nie liga
  sezonowa — organizator zaprasza linkiem, drużyny zapisują się bez instalacji.

Odmrażając flagę, pozycjonować „turniej dla ludzi, którzy już grają razem", nie
„stwórz drabinkę w 5 minut" (to jest dokładnie hasło FC.APP).

### 4. BallSquad to nie przyszły, tylko obecny sąsiad — i właśnie wchodzi w zimę

BallSquad ma podział kosztu między uczestników i tworzenie wydarzeń, a jego mocną
stroną są hale szkolne i gminne, czyli dokładnie to, gdzie gra się od listopada.
[analiza-gtm-2026-09.md](./analiza-gtm-2026-09.md) („Poziom 6") uznaje zimę za sezon
najsilniejszej przewagi Bojo (rozliczenia płatnych obiektów). **To ten sam sezon
i ten sam argument u BallSquadu.** Różnica, której trzeba pilnować: w Bojo rozlicza
się dowolny obiekt, także wynajęty telefonicznie; w BallSquadzie tylko obiekt, który
jest w ich systemie.

### 5. Kolejność zagrożeń na dziś

1. Messenger / WhatsApp / grupy FB — bez zmian ([analiza-gtm-2026-09.md](./analiza-gtm-2026-09.md)).
2. **GRAMY i Orlikfy** — ta sama obietnica, ten sam typ użytkownika; Orlikfy rośnie
   miasto po mieście, jak Bojo.
3. **BallSquad** — zimą, w halach.
4. amator.app, LocalPlay, Meet and Play — obecne w wynikach wyszukiwania i w odpowiedziach
   modeli językowych; wpływają na to, czy Bojo w ogóle trafia do zestawienia.
5. Aplikacje rakietowe i turniejowe — obok pola, do obserwowania.

## Do sprawdzenia ręcznie (czego ten przegląd nie rozstrzyga)

- Zainstalować GRAMY, Orlikfy i amator.app, przejść ścieżkę „zbieram 10 osób na
  czwartek" i porównać liczbę kroków z Bojo.
- Sprawdzić, czy BallSquad pozwala założyć wydarzenie **bez** rezerwacji w swoim obiekcie.
- Sprawdzić, czy któraś z polskich gierkowych aplikacji ma zapis z linku bez instalacji
  (web). Jeśli tak — punkt 1 traci najmocniejszy argument.
- Polski SERP dla „aplikacja do organizowania meczów": kto jest w pierwszej dziesiątce.

## Źródła

- Orlikfy: [App Store](https://apps.apple.com/pl/app/orlikfy-gry-na-orliku/id6503027981), [MamBiznes — rozmowa z założycielami](https://mambiznes.pl/porady/od-hobby-do-biznesu-rozmowa-z-zalozycielami-startupu-orlikfy-ktory-ulatwia-organizowanie-gier-orlikowych/), [KR24](https://kr24.pl/krakow/wirtualna-rewolucja-na-orlikach-krakowianie-stworzyli-aplikacje-orlikfy/)
- GRAMY: [app.gramyapp.pl](https://app.gramyapp.pl/)
- amator.app: [amator.app](https://amator.app/en/), [Google Play](https://play.google.com/store/apps/details?id=com.gamehunter.app)
- LocalPlay: [INNPoland](https://innpoland.pl/166875,polska-aplikacja-localplay-idealny-pomysl-dla-fanow-pilki-noznej-na-zywo), [MamStartup — ICEO Ventures](https://mamstartup.pl/iceo-ventures-inwestuje-w-sportech-localplay-pomoze-polakom-wrocic-do-formy/), [localplay.app](https://localplay.app/pl)
- Meet and Play: [meet-and-play.com](https://meet-and-play.com/)
- Capo: [caposport.com](https://caposport.com/), [przegląd aplikacji 2026](https://caposport.com/guides/best-5-a-side-apps-2026)
- Teamer: [Teamer Shutdown FAQs](https://help.teamer.net/knowledge/teamer-shutdown-faqs)
- Footy Addicts: [footyaddicts.com](https://footyaddicts.com/); Plei: [plei.com](https://www.plei.com/)
- BallSquad: [ballsquad.io](https://www.ballsquad.io/), [BIP Kraków](https://bip.krakow.pl/?news_id=132768), [MOSiR Ruda Śląska](https://mosir.rsl.pl/aktualnosci/zarezerwuj-boisko-z-aplikacja-ballsquad), [Brave VC](https://brave.vc/en/new-investment-ballsquad), [BGK](https://www.bgk.pl/produkty/pozyczki-unijne-2014-2020/historie-klientow/ballsquad-aplikacja-do-zarzadzania-i-rezerwacji-obiektow/)
- Playmore: [playmore.pl](https://playmore.pl/), [Cashless — KNF](https://www.cashless.pl/18857-reservise-playmore)
- Playtomic: [Global Padel Report 2026](https://playtomic.com/global-padel-report), [Crowdcube XI 2025](https://www.crowdcube.com/companies/playtomic/pitches/qrMYkb), [Interpadel Warszawa](https://playtomic.com/clubs/interpadel-warszawa)
- Kluby.org: [kluby.org](https://kluby.org/)
- Systemy gminne: [Orlik+ Wieliczka](https://orlik.wieliczka.eu/), [e-Rezerwacja Rzeszów](https://sportowyrzeszow.pl/e-rezerwacja), [Gdynia](https://www.gdynia.pl/sport-i-zdrowie,7717/zarezerwuj-boisko-jednym-kliknieciem,549555)
- FC.APP: [fcapp.eu](https://fcapp.eu/en/), [Emiteo](https://emiteo.pl/fcapp-s-a/), [Konspekty Piłka Nożna](https://www.konspektypilkanozna.pl/aplikacja-do-organizowania-sparingow-i-turniejow-fcapp/)
- 4league: [4league.app](https://4league.app/pl/index.html)
- Playarena: [playarena.pl](https://playarena.pl/lnp/nikeApp)
- ligowe.pl: [ligowe.pl](https://ligowe.pl/); Piłka Lokalna: [App Store](https://apps.apple.com/us/app/pi%C5%82ka-lokalna/id6757909863)
- Tournify i inne generatory: [Score7 — porównanie 2026](https://kb.score7.io/blog/comparisons/best-free-tournament-software-2026/), [tg-app.pl](https://tg-app.pl/), [Gampre](https://www.gampre.pl/stworz-turniej/), [Competize](https://apps.apple.com/pl/app/competize-turnieje-ligi/id595756807?l=pl), [Winner](https://apps.apple.com/pl/app/winner-organizatora-ligi/id1453673502?l=pl), [Tourney](https://apps.apple.com/pl/app/tourney-tw%C3%B3rca-turniej%C3%B3w/id6450659011?l=pl)
- Tenisime: [tenisime.pl](https://www.tenisime.pl/)
- Spond / SportEasy / Heja: [Spond](https://www.spond.com/en-us/), [SportEasy](https://play.google.com/store/apps/details?id=com.sporteasy.android)
