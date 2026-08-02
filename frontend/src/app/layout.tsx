import type { Metadata, Viewport } from 'next';
import { Inter, Bricolage_Grotesque } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/lib/toast';
import CookieBanner from '@/components/CookieBanner';
import AnnouncementBar from '@/components/AnnouncementBar';
import { siteJsonLd } from '@/lib/structuredData';

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
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bojo.pl';
const OG_IMAGE = '/poznan-satellite.jpg';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // NOTE: no `alternates.canonical` here on purpose — the layout's metadata is
  // inherited by every page that doesn't define its own, so a canonical set
  // here would stamp "/" onto /logowanie, /gracz/[id] and every other page,
  // telling crawlers they are duplicates of the home page. Canonicals live on
  // the individual public pages instead.
  title: {
    default: 'Bojo — zbierz ekipę, zagraj dziś | Boiska i mecze w Poznaniu',
    template: '%s | Bojo',
  },
  description:
    'Znajdź boisko, zbierz skład i zagraj w Poznaniu. Piłka nożna, koszykówka, siatkówka i więcej — bez szukania po grupach na Facebooku.',
  keywords: ['organizuj mecz Poznań', 'szukam graczy Poznań', 'boiska sportowe Poznań', 'piłka nożna', 'koszykówka'],
  authors: [{ name: 'Bojo' }],
  openGraph: {
    title: 'Bojo — zbierz ekipę, zagraj dziś',
    description: 'Znajdź boisko, zbierz skład i zagraj w Poznaniu. Bez szukania po grupach na Facebooku.',
    locale: 'pl_PL',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Bojo — boiska i mecze w Poznaniu' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bojo — zbierz ekipę, zagraj dziś',
    description: 'Znajdź boisko, zbierz skład i zagraj w Poznaniu. Bez szukania po grupach na Facebooku.',
    images: [OG_IMAGE],
  },
  // Favicon is inlined as a data-URI <link> in <head> below, so we don't
  // reference external icon files here (they would 404 in the console).
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
              <AnnouncementBar />
              {children}
              <CookieBanner />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
