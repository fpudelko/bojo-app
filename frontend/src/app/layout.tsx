import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';

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
    default: 'Boiska Poznań | Znajdź boisko w Poznaniu',
    template: '%s | Boiska Poznań',
  },
  description:
    'Agregator boisk sportowych w Poznaniu. Znajdź boisko piłkarskie, kort tenisowy, boisko do koszykówki i siatkówki. Szukaj graczy do wspólnej gry.',
  keywords: ['boiska Poznań', 'sporty Poznań', 'piłka nożna', 'koszykówka', 'tenis', 'siatkówka'],
  authors: [{ name: 'Boiska Poznań' }],
  openGraph: {
    title: 'Boiska Poznań',
    description: 'Znajdź boisko sportowe w Poznaniu i szukaj graczy do gry.',
    locale: 'pl_PL',
    type: 'website',
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
