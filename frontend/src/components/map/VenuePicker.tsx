'use client';

import dynamic from 'next/dynamic';
import type { Field } from '@/types';

const Impl = dynamic(() => import('./VenuePickerImpl'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[320px] bg-slate-100 flex items-center justify-center text-sm text-slate-400">
      Ładowanie mapy…
    </div>
  ),
});

interface Props {
  selectedId?: string;
  onSelect: (field: Field) => void;
  sport?: string;
}

export default function VenuePicker(props: Props) {
  return <Impl {...props} />;
}
