import type { MetadataRoute } from 'next';

// Manifest PWA — to on sprawia, że Bojo da się dodać do ekranu głównego jako
// apkę, a nie jako skrót w przeglądarce. Bez niego „dodaj do ekranu głównego"
// robi zakładkę: zostaje pasek adresu, nie ma własnej ikony ani ekranu
// startowego.
//
// Next generuje z tego `/manifest.webmanifest`; odnośnik w <head> dokłada sam.
//
// UWAGA NA PRZYSZŁOŚĆ: `display: 'standalone'` jest też warunkiem web-push
// na iOS — Safari wysyła powiadomienia wyłącznie do PWA dodanej do ekranu
// głównego. Ten plik nie jest więc ozdobnikiem przed powiadomieniami, tylko
// ich warunkiem (patrz BACKLOG §8, „PWA + web-push").

// Podbijana przy każdej zmianie obrazka ikony. Chrome odświeża ikonę
// zainstalowanej apki dopiero, gdy w manifeście zmieni się jej adres; ten sam
// adres z nowym plikiem zostaje na ekranie głównym ze starym obrazkiem.
export const WERSJA_IKON = 'boisko2';
const ikona = (plik: string) => `/ikony/${plik}?v=${WERSJA_IKON}`;

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bojo, zbierz ekipę, zagraj dziś',
    // Pod ikoną na ekranie telefonu mieści się ~12 znaków. Dłuższa nazwa
    // zostaje przycięta wielokropkiem, więc tu świadomie samo „Bojo".
    short_name: 'Bojo',
    description:
      'Znajdź boisko, zbierz skład i zagraj. Piłka nożna, koszykówka, siatkówka '
      + 'i więcej, w całej Polsce.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    // Ta sama zieleń co `themeColor` w `layout.tsx` i co tło ikon —
    // rozjazd byłoby widać jako inny kolor paska stanu po instalacji.
    theme_color: '#15663E',
    background_color: '#15663E',
    lang: 'pl',
    categories: ['sports', 'lifestyle'],
    icons: [
      { src: ikona('ikona-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: ikona('ikona-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android przycina ikonę do kształtu wybranego przez producenta telefonu.
      // Wariant `maskable` ma pełne tło i logo w strefie bezpiecznej, więc
      // przycięcie nie zjada zaokrąglonych rogów.
      { src: ikona('maskowalna-192.png'), sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: ikona('maskowalna-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
