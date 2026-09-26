// Page-indexing reasons (Search Console → Indexing → Pages) with a bojo.pl verdict.
//
// Every reason is matched by a pattern that covers the Polish and the English
// UI wording, because both show up (screenshots, exports, emails). The verdict
// is what we KNOW about bojo.pl, not generic SEO advice: most "not indexed"
// rows on this site are deliberate (Tier 3 venues, past matches, join-code
// routes), and the expensive mistake is "fixing" those. Where the answer
// depends on which URLs are affected, the verdict says so and `sprawdz` says
// how to find out; the example URLs of a reason can be classified with
// mapa-bojo.mjs (`gsc-eksport.mjs --adresy`).

export const PRZYCZYNY = [
  {
    id: 'noindex',
    wzorzec: /noindex/i,
    nazwa: 'Strona wykluczona za pomocą tagu „noindex”',
    werdykt: 'zamierzone',
    bojo:
      'Zamierzone dla: obiektów Tier 3 (robots index:false w generateMetadata, migracja 112), minionych meczów publicznych (noindex,follow), meczów prywatnych i nieistniejących (noindex,nofollow).',
    sprawdz:
      'Sklasyfikuj przykładowe adresy. Obiekty: sprawdź seo_tier w bazie (tylko Tier 3 ma noindex). Huby, treść albo strona główna z noindex = BŁĄD.',
    walidowac: false,
  },
  {
    id: 'alternatywna-canonical',
    wzorzec: /alternatywn|alternate page with proper canonical/i,
    nazwa: 'Alternatywna strona zawierająca prawidłowy tag strony kanonicznej',
    werdykt: 'zamierzone',
    bojo:
      'Adres obiektu po surowym UUID (/boisko/<uuid>, linkowany np. ze strony meczu) renderuje się z canonical na adres ze slugiem. Google robi dokładnie to, o co prosimy.',
    sprawdz: 'Przykłady w postaci /boisko/<uuid> albo z parametrami ?… potwierdzają. Adres kanoniczny obiektu na tej liście = sprawdź, dokąd wskazuje jego canonical.',
    walidowac: false,
  },
  {
    id: 'duplikat-bez-canonical',
    wzorzec: /duplikat.*(nie oznaczy|nie wskaza|bez)|duplicate without user-selected canonical/i,
    nazwa: 'Duplikat, użytkownik nie oznaczył strony kanonicznej',
    werdykt: 'do-zbadania',
    bojo:
      'Każda strona obiektu, meczu i treści ma własny canonical, więc zwykle to DWA RÓŻNE wiersze fields o niemal tej samej treści (podwójny import OSM) albo strona bez canonical (listy aplikacji).',
    sprawdz:
      "Sklasyfikuj przykłady. Obiekty: SELECT name, address, count(*) FROM fields GROUP BY 1,2 HAVING count(*) > 1. Listy (/wydarzenia, /grupy): sprawdź, czy mają alternates.canonical.",
    walidowac: true,
  },
  {
    id: 'duplikat-google-inny',
    wzorzec: /(wybran\S* przez google|google wybra)|google chose different canonical/i,
    nazwa: 'Duplikat, Google wybrał inną stronę kanoniczną niż użytkownik',
    werdykt: 'do-zbadania',
    bojo:
      'Google uznał dwie strony za tę samą treść wbrew naszemu canonical: typowo obiekty o nazwie rodzajowej w tej samej miejscowości (ten sam szablon opisu) albo rozjazd www/bez www.',
    sprawdz: 'Inspekcja adresu (API albo UI) pokazuje googleCanonical vs userCanonical. Różnica tylko hostem = sprawdź NEXT_PUBLIC_SITE_URL na produkcji.',
    walidowac: true,
  },
  {
    id: 'przekierowanie',
    wzorzec: /przekierowanie|page with redirect/i,
    nazwa: 'Strona zawiera przekierowanie',
    werdykt: 'zalezy',
    bojo:
      'Zamierzone dla /gracze (→ /wydarzenia) i STARYCH linków do obiektów (sama nazwa → 307 na adres kanoniczny). BŁĄD, jeśli takie adresy pochodzą z naszej sitemapy albo linków: do 2026-09-26 sitemapa boisk i huby /boiska/… generowały adresy z samej nazwy (naprawione, PR #435). Po naprawie liczba może chwilowo urosnąć, zanim spadnie.',
    sprawdz: 'Porównaj z datą poprawki w docs/gsc-dziennik.md. Przykłady z samą nazwą obiektu po 2026-10-15 = sprawdź, skąd Google je bierze (linki wewnętrzne, sitemapa).',
    walidowac: false,
  },
  {
    id: 'robots-zindeksowana',
    wzorzec: /zindeksowan.*(chociaż|mimo|choć).*robots|indexed,? though blocked by robots/i,
    nazwa: 'Zindeksowana, chociaż zablokowana przez plik robots.txt',
    werdykt: 'do-zbadania',
    bojo:
      'robots.txt blokuje SKANOWANIE, nie indeks: Google nie zobaczy noindex na stronie, której nie może pobrać (docs/seo-geo-strategia.md, P4).',
    sprawdz: 'Jeśli adres ma zniknąć z indeksu: najpierw noindex w wrapperze serwerowym i ODBLOKOWANIE w robots.ts, dopiero po wypadnięciu z indeksu ponowna blokada.',
    walidowac: true,
  },
  {
    id: 'robots',
    wzorzec: /robots\.txt/i,
    nazwa: 'Strona zablokowana przez plik robots.txt',
    werdykt: 'zamierzone',
    bojo: 'Zamierzone dla listy DISALLOW w frontend/src/app/robots.ts (kody dołączenia /d/ /g/ /t/, profile graczy, kreatory, trasy za wyłączonymi flagami, technika).',
    sprawdz: 'Adres spoza listy DISALLOW = sprawdź, czy robots.txt na produkcji jest aktualny.',
    walidowac: false,
  },
  {
    id: 'zeskanowana-nie-zindeksowana',
    wzorzec: /zeskanowan.*(nie.*zindeksowan|bez indeksu)|crawled.*currently not indexed/i,
    nazwa: 'Strona zeskanowana, ale jeszcze nie zindeksowana',
    werdykt: 'sygnal-r1',
    bojo:
      'Decyzja jakościowa Google. Sygnał ryzyka R1 (docs/seo-geo-strategia.md, rozdz. 9): katalog oceniony jako treść masowa, jeśli ta liczba rośnie do dziesiątek tysięcy przy stojącej liczbie zaindeksowanych. 2026-09-14: 85 (0,5%).',
    sprawdz: 'Udział w znanych adresach i trend między odczytami (dziennik). Przykłady obiektów: czy to Tier 2 z cienkim opisem (nazwa rodzajowa, brak nawierzchni)?',
    walidowac: false,
  },
  {
    id: 'wykryta-nie-zindeksowana',
    wzorzec: /wykryt.*(nie.*zindeksowan|bez indeksu)|discovered.*currently not indexed/i,
    nazwa: 'Strona wykryta – obecnie niezindeksowana',
    werdykt: 'sygnal-r1',
    bojo:
      'Google zna adres, ale go nie pobrał: limit skanowania albo przeciążenie serwera. W Bojo realne ryzyko: plan darmowy Vercela (limit CPU funkcji, rendery stron obiektów idą niemal wyłącznie na roboty, patrz komentarz przy revalidate w boisko/[id]/page.tsx).',
    sprawdz: 'Ustawienia → Statystyki indeksowania (czas odpowiedzi, kody 5xx). Logi Vercela (konektor Vercel) dla /boisko/* ze statusem 5xx.',
    walidowac: false,
  },
  {
    id: 'soft-404',
    wzorzec: /soft 404/i,
    nazwa: 'Soft 404',
    werdykt: 'blad',
    bojo: 'Strona odpowiada 200, ale wygląda na pustą. Kandydaci: strona obiektu, której dane nie doszły w HTML (render klienta), hub z pustą listą.',
    sprawdz: 'Pobierz HTML bez JS (scripts/audyt-robota.mjs --baza https://www.bojo.pl) dla przykładów.',
    walidowac: true,
  },
  {
    id: '404',
    wzorzec: /\b404\b|nie znaleziono|not found/i,
    nazwa: 'Nie znaleziono (404)',
    werdykt: 'zalezy',
    bojo:
      'Zamierzone: usunięte mecze i obiekty, hub miasta poniżej progu jakości (lib/hubMiasta.ts). BŁĄD: adres z naszej sitemapy albo linków wewnętrznych.',
    sprawdz: 'Czy przykłady są w sitemapie? Obiekt przemianowany: stary slug trafia w nowy indeks slugów dopiero po odświeżeniu (TTL 1 h).',
    walidowac: true,
  },
  {
    id: '5xx',
    wzorzec: /\b5xx\b|\b50\d\b|serwera|server error/i,
    nazwa: 'Błąd serwera (5xx)',
    werdykt: 'blad',
    bojo: 'Funkcja Vercela padła albo przekroczyła limit (CPU, czas), albo Supabase nie odpowiedział. Bez tego Google zwalnia skanowanie całej witryny.',
    sprawdz: 'Logi runtime Vercela (statusCode 5xx, ścieżka przykładu), status Supabase w dniu z wykresu.',
    walidowac: true,
  },
  {
    id: 'blad-przekierowania',
    wzorzec: /błąd przekierowania|blad przekierowania|redirect error/i,
    nazwa: 'Błąd przekierowania',
    werdykt: 'blad',
    bojo: 'Pętla albo zbyt długi łańcuch. Kandydat: slug obiektu przekierowujący na slug, który znowu przekierowuje (rozjazd nazwy w indeksie slugów).',
    sprawdz: 'curl -sIL na przykładzie (z własnej maszyny) i liczba skoków.',
    walidowac: true,
  },
  {
    id: '4xx-dostep',
    wzorzec: /\b40[13]\b|nieautoryzowan|zakaz|access forbidden|unauthorized|inny problem 4xx|other 4xx/i,
    nazwa: 'Zablokowana (401/403/inne 4xx)',
    werdykt: 'do-zbadania',
    bojo: 'Ochrona wdrożenia Vercela na domenie produkcyjnej albo trasa zwracająca 4xx robotowi.',
    sprawdz: 'Otwórz przykład w oknie incognito; sprawdź ustawienia Deployment Protection w projekcie Vercela.',
    walidowac: true,
  },
  {
    id: 'bez-tresci',
    wzorzec: /bez treści|without content/i,
    nazwa: 'Zindeksowana bez treści',
    werdykt: 'blad',
    bojo: 'Google zindeksował pusty HTML: treść dorysowywana po zamontowaniu (dług D5/D10).',
    sprawdz: 'scripts/audyt-robota.mjs na przykładowym adresie.',
    walidowac: true,
  },
];

export const OPISY_WERDYKTOW = {
  zamierzone: 'zamierzone (nie naprawiać, sprawdzić tylko przykłady)',
  'do-zbadania': 'do zbadania (zależy od przykładów)',
  zalezy: 'zależy od przykładów',
  'sygnal-r1': 'sygnał ryzyka R1 (śledzić trend)',
  blad: 'błąd do naprawy',
  nieznany: 'nierozpoznany powód',
};

export function dopasujPrzyczyne(tekst) {
  // Order matters: "indexed though blocked by robots" before plain "robots".
  return PRZYCZYNY.find((p) => p.wzorzec.test(tekst ?? '')) ?? null;
}

/**
 * R1 share: pages Google knows but refuses to index on quality or capacity
 * grounds, as a fraction of all known pages. Thresholds are a proposal
 * (docs/seo-geo-strategia.md only says "tens of thousands while indexed stays
 * flat"); the trend between readings matters more than one number.
 */
export function udzialR1(przyczyny, zindeksowane) {
  const r1 = przyczyny
    .filter((w) => dopasujPrzyczyne(w.reason)?.werdykt === 'sygnal-r1')
    .reduce((s, w) => s + (w.pages ?? 0), 0);
  const nieZind = przyczyny.reduce((s, w) => s + (w.pages ?? 0), 0);
  const znane = (zindeksowane ?? 0) + nieZind;
  const udzial = znane ? r1 / znane : null;
  let ocena = 'brak danych';
  if (udzial != null) ocena = udzial < 0.1 ? 'spokój' : udzial < 0.3 ? 'obserwować' : 'alarm R1';
  return { r1, znane, udzial, ocena };
}
