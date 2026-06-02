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
    default: 'Zagrajmy — znajdź grę, zbierz skład',
    template: '%s | Zagrajmy',
  },
  description:
    'Organizuj mecze i zbieraj skład w Poznaniu. Znajdź boisko, stwórz wydarzenie, zaproś znajomych linkiem. Piłka nożna, koszykówka, siatkówka, futsal i więcej.',
  keywords: ['organizuj mecz Poznań', 'szukam graczy Poznań', 'boiska sportowe Poznań', 'piłka nożna', 'koszykówka'],
  authors: [{ name: 'Zagrajmy' }],
  openGraph: {
    title: 'Zagrajmy',
    description: 'Znajdź grę. Zbierz skład. Organizuj mecze w Poznaniu.',
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
