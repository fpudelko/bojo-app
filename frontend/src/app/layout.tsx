import type { Metadata, Viewport } from 'next';
import { Inter, Bricolage_Grotesque } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/lib/toast';
import CookieBanner from '@/components/CookieBanner';
import AnnouncementBar from '@/components/AnnouncementBar';
import BottomNavGate from '@/components/layout/BottomNavGate';
import PostSignupRoleModal from '@/components/onboarding/PostSignupRoleModal';
import RejestracjaSW from '@/components/RejestracjaSW';
import PrzechwytywanieBledow from '@/components/PrzechwytywanieBledow';
import ZachetaInstalacji from '@/components/ZachetaInstalacji';
import { BottomNavVisibilityProvider } from '@/lib/bottomNavVisibility';
import { SledzenieHistorii } from '@/lib/historia';
import { siteJsonLd } from '@/lib/structuredData';
import {
  TYTUL_DOMYSLNY, OPIS_DOMYSLNY, HASLO_PODGLADU,
} from '@/content/metaWyszukiwarki';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

// Distinctive editorial display face for headings — characterful but clean,
// full Polish diacritic support (latin-ext).
const bricolage = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display',
  display: 'swap',
  weight: ['600', '700', '800'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#15663E',
  // BEZ TEGO `env(safe-area-inset-*)` ZWRACA ZERO — a repo liczy na te wartości
  // w kilku miejscach (dolna nawigacja, `--bottom-nav-h`, karty na mapie).
  // W karcie przeglądarki nie było tego widać, bo miejsce na pasek gestów
  // rezerwował sam Safari. Po instalacji jako apka paska przeglądarki nie ma
  // i nikt tego miejsca nie pilnuje: pasek „Znajdź grę / Mapa / Nowy…" wjeżdżał
  // pod kreskę gestów iOS, a podpis „Nowy" był przez nią przecięty.
  viewportFit: 'cover',
  // Bez tego klawiatura ekranowa na Androidzie nie zmniejsza layoutu — okno
  // widoczne (visual viewport) się kurczy, ale strona licząca wysokość
  // z `100dvh` tego nie widzi, więc composer w Rozmowie zostawał tam, gdzie
  // był PRZED otwarciem klawiatury, a pod nim robiła się pusta przestrzeń
  // (to, co kiedyś było resztą ekranu, teraz zasłonięte klawiaturą, ale
  // strona o tym nie wie). `resizes-content` każe przeglądarce faktycznie
  // skurczyć layout, więc `h-[100dvh]` w RozmowaGrupy/RozmowaWydarzenia
  // przelicza się razem z klawiaturą.
  interactiveWidget: 'resizes-content',
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bojo.pl';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // NOTE: no `alternates.canonical` here on purpose — the layout's metadata is
  // inherited by every page that doesn't define its own, so a canonical set
  // here would stamp "/" onto /logowanie, /gracz/[id] and every other page,
  // telling crawlers they are duplicates of the home page. Canonicals live on
  // the individual public pages instead.
  // Tytuł i opis żyją w `content/metaWyszukiwarki.ts` — tam też stoi pomiar
  // z Search Console, z którego wynika, dlaczego brzmią tak, a nie jak hasło.
  title: {
    default: TYTUL_DOMYSLNY,
    template: '%s | Bojo',
  },
  description: OPIS_DOMYSLNY,
  keywords: ['organizuj mecz', 'szukam graczy', 'boiska sportowe', 'piłka nożna', 'koszykówka', 'siatkówka'],
  authors: [{ name: 'Bojo' }],
  // Bez `images` w obu blokach niżej — DŁUG D17 (docs/seo-geo-strategia.md):
  // konwencja plikowa `app/opengraph-image.tsx` generuje obrazek per trasa
  // (i podpina go pod `og:image` ORAZ `twitter:image` automatycznie) i ma
  // pierwszeństwo przed tym polem na tym samym segmencie, więc jawny obrazek
  // tutaj był martwy — nigdy nie trafiał do znaczników żadnej strony, które
  // nie mają WŁASNEGO `opengraph-image.tsx` (a te, co mają — `/wydarzenia/[id]`
  // — i tak by go nadpisały). Jeden generator obrazka zamiast dwóch źródeł,
  // z których jedno nigdy się nie renderuje.
  // Podgląd linku (czat, media) i nazwa pod ikoną PWA (app/manifest.ts) ZOSTAJĄ przy
  // haśle „zbierz ekipę, zagraj dziś" — świadomie, nie przez przeoczenie. Te trzy
  // powierzchnie odpowiadają na różne pytania: w wyniku wyszukiwania odbiorca pyta
  // „co to w ogóle jest", przy podglądzie linku i przy ikonie na ekranie telefonu
  // już to wie, bo dostał link od organizatora albo sam zainstalował aplikację.
  // Rozdzielenie jest celem; nie ujednolicaj ich „dla spójności".
  openGraph: {
    title: HASLO_PODGLADU,
    description: 'Znajdź boisko, zbierz skład i zagraj — w całej Polsce. Bez szukania po grupach na Facebooku.',
    locale: 'pl_PL',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: HASLO_PODGLADU,
    description: 'Znajdź boisko, zbierz skład i zagraj — w całej Polsce. Bez szukania po grupach na Facebooku.',
  },
  // Favicon SVG jest wklejony jako data-URI w <head> niżej. Tutaj dokładamy
  // wyłącznie `apple-touch-icon`, bo iOS IGNORUJE ikony z manifestu i czyta
  // tylko ten odnośnik — bez niego na ekranie głównym iPhone'a ląduje zrzut
  // strony zamiast logo. Wygenerowany z tego samego SVG przez
  // `scripts/generuj-ikony.mjs`.
  icons: {
    apple: [{ url: '/ikony/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // Pasek stanu na iOS w trybie standalone. `default` daje ciemny tekst na
  // jasnym tle — czytelne przy naszym jasnym interfejsie.
  appleWebApp: {
    capable: true,
    title: 'Bojo',
    statusBarStyle: 'default',
  },
};

// Site identity as structured data, emitted once so crawlers and language
// models don't have to infer it from page copy.
const SITE_JSON_LD = siteJsonLd(SITE_URL);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning className={`${inter.variable} ${bricolage.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD) }}
        />
        {/* SVG favicon — inlined so it works without a file server */}
        <link
          rel="icon"
          type="image/svg+xml"
          href="data:image/svg+xml,%3Csvg viewBox='0 0 110 110' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='110' height='110' rx='26' fill='%2315663E'/%3E%3Cpath d='M40 33 L40 77 L62 77 Q74 77 74 65.5 Q74 56 64 54.5 Q72 52.5 72 43.5 Q72 33 60 33 Z M51 42 L59 42 Q63 42 63 46.5 Q63 51 59 51 L51 51 Z M51 59 L60 59 Q65 59 65 64 Q65 68 60 68 L51 68 Z' fill='%23ffffff' fill-rule='evenodd'/%3E%3C/svg%3E"
        />
      </head>
      <body className="min-h-screen bg-canvas font-sans antialiased text-ink">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <ToastProvider>
              <BottomNavVisibilityProvider>
                {/* Liczy przejścia między ekranami, żeby „wstecz" na ekranach
                    szczegółowych mogło wrócić do POPRZEDNIEGO ekranu zamiast na
                    sztywno wpisanego rodzica (patrz lib/historia.tsx). */}
                <SledzenieHistorii />
                <AnnouncementBar />
                {children}
                <BottomNavGate />
                <CookieBanner />
                <PostSignupRoleModal />
                <RejestracjaSW />
                <ZachetaInstalacji />
                <PrzechwytywanieBledow />
              </BottomNavVisibilityProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
