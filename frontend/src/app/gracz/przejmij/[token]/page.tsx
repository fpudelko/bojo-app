import type { Metadata } from 'next';
import PrzejmijClient from './PrzejmijClient';

// Strona jest osobista i jednorazowa — nie ma czego indeksować ani cache'ować.
export const metadata: Metadata = {
  title: 'Przejmij swój wpis',
  robots: { index: false, follow: false },
};

export default function PrzejmijPage({ params }: { params: { token: string } }) {
  return <PrzejmijClient token={params.token} />;
}
