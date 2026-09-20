import { Suspense } from 'react';
import DruzynaClient from './DruzynaClient';

export default function TurniejDruzynaPage() {
  return (
    <Suspense>
      <DruzynaClient />
    </Suspense>
  );
}
