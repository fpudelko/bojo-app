'use client';

import { usePathname } from 'next/navigation';

/**
 * Widget dla zarządców obiektów (roadmapa SEO/GEO, poz. 24 — F5) osadza się
 * w `<iframe>` na cudzej stronie. `app/layout.tsx` montuje globalnie baner
 * cookies, zachętę do instalacji PWA, modal onboardingu i dolną nawigację —
 * wszystko zaprojektowane pod pełny ekran aplikacji Bojo, nie pod fragment
 * renderowany na stronie kogoś innego. Bez tej flagi zarządca zobaczyłby po
 * kilku sekundach baner cookies Bojo wewnątrz WŁASNEJ witryny.
 *
 * Sprawdzenie po ścieżce, nie po osobnym layoucie: Next.js App Router nie
 * pozwala żadnej trasie pominąć root layoutu (`<html>`/`<body>` istnieją
 * dokładnie raz), więc jedyna dźwignia to komponenty globalne same decydujące
 * o własnej widoczności — tak jak `AnnouncementBar` już dziś sprawdza
 * `usePathname()` dla `/turniej`.
 */
export function jestSciezkaWidgetu(pathname: string | null): boolean {
  return pathname?.startsWith('/widget/') ?? false;
}

export function useJestWidget(): boolean {
  return jestSciezkaWidgetu(usePathname());
}

/**
 * Kod `<iframe>` do wklejenia na stronie zarządcy obiektu (F5) — jedno
 * źródło używane w `/admin/outreach` (przycisk „Kopiuj kod widgetu"), żeby
 * podana wysokość i adres nie rozjechały się z tym, co faktycznie renderuje
 * `app/widget/boisko/[id]/page.tsx`.
 *
 * Wysokość jest STAŁA (420 px), nie auto-dopasowana do liczby meczów — sam
 * widget przewija się w środku (`overflow-y-auto`), gdy treści jest więcej.
 * Auto-resize przez `postMessage` między domenami to realna, ale osobna
 * funkcja: dopóki nikt jej nie poprosił, stały rozmiar jest tańszy i nie ma
 * czego psuć na stronie zarządcy.
 */
export function kodOsadzeniaWidgetu(fieldId: string, base: string): string {
  return (
    `<iframe src="${base}/widget/boisko/${fieldId}" width="100%" height="420" `
    + 'style="border:0;max-width:420px" loading="lazy" title="Najbliższe mecze na Bojo"></iframe>'
  );
}
