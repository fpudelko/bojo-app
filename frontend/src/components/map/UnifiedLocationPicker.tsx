'use client';

import dynamic from 'next/dynamic';
export type { LocationResult } from './UnifiedLocationPickerImpl';

const Impl = dynamic(() => import('./UnifiedLocationPickerImpl'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[300px] bg-slate-100 flex items-center justify-center text-sm text-slate-400">
      Ładowanie mapy…
    </div>
  ),
});

interface Props {
  sport?: string;
  value: import('./UnifiedLocationPickerImpl').LocationResult;
  onChange: (v: import('./UnifiedLocationPickerImpl').LocationResult) => void;
}

export default function UnifiedLocationPicker(props: Props) {
  return <Impl {...props} />;
}
