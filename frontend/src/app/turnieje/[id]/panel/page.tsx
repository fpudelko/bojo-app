import { Suspense } from 'react';
import PanelClient from './PanelClient';

export default function TurniejPanelPage() {
  return (
    <Suspense>
      <PanelClient />
    </Suspense>
  );
}
