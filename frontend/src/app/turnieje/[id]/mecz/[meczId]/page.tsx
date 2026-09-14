import { Suspense } from 'react';
import MeczClient from './MeczClient';

export default function TurniejMeczPage() {
  return (
    <Suspense>
      <MeczClient />
    </Suspense>
  );
}
