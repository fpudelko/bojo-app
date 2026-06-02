import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import CookieBanner from '@/components/CookieBanner';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#16a34a',
};

export const metadata: Metadata = {
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
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bojo — zbierz ekipę, zagraj dziś',
    description: 'Znajdź boisko, zbierz skład i zagraj w Poznaniu. Bez szukania po grupach na Facebooku.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={inter.variable}>
      <body className="min-h-screen bg-white font-sans antialiased">
        <AuthProvider>
          {children}
          <CookieBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
