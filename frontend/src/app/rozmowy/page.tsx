import type { Metadata } from 'next';
import RozmowyClient from './RozmowyClient';

// Serwerowa otoczka: lista jest komponentem klienckim, ale trasa potrzebuje
// własnych metadanych — bez nich dziedziczy ogólny tytuł z layoutu.
// `noindex`, bo za ekranem stoją dane zalogowanego użytkownika.
export const metadata: Metadata = {
  title: 'Rozmowy',
  description: 'Wszystkie Twoje rozmowy — mecze i ekipy — w jednym miejscu, od najnowszej.',
  robots: { index: false, follow: false },
};

export default function RozmowyPage() {
  return <RozmowyClient />;
}
