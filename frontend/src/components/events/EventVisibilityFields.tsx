'use client';

import { Globe, Lock } from 'lucide-react';
import ToggleRow from '@/components/ui/ToggleRow';
import type { Visibility } from '@/types';

/**
 * Karty Publiczne/Prywatne + „Wymagaj akceptacji”. Wspólne dla kreatora
 * (`wydarzenia/nowe`) i edycji wydarzenia (dawniej edycja miała Prywatne
 * jako pierwszą kartę — ujednolicone z kolejnością kreatora).
 */
export default function EventVisibilityFields({
  visibility, setVisibility, requireApproval, setRequireApproval,
}: {
  visibility: Visibility;
  setVisibility: (v: Visibility) => void;
  requireApproval: boolean;
  setRequireApproval: (v: boolean) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">Widoczność</label>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button" onClick={() => setVisibility('public')}
          className={['flex items-start gap-2 p-3 rounded-lg border text-left transition-colors', visibility === 'public' ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-slate-400'].join(' ')}
        >
          <Globe className="w-4 h-4 mt-0.5 text-slate-600 shrink-0" />
          <span>
            <span className="block text-sm font-medium text-slate-900">Publiczne</span>
            <span className="block text-xs text-slate-500">Widoczne dla wszystkich, każdy może dołączyć</span>
          </span>
        </button>
        <button
          type="button" onClick={() => setVisibility('private')}
          className={['flex items-start gap-2 p-3 rounded-lg border text-left transition-colors', visibility === 'private' ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-slate-400'].join(' ')}
        >
          <Lock className="w-4 h-4 mt-0.5 text-slate-600 shrink-0" />
          <span>
            <span className="block text-sm font-medium text-slate-900">Prywatne</span>
            <span className="block text-xs text-slate-500">Nie pojawia się na liście. Wchodzą tylko zaproszeni, grupa i osoby z linkiem</span>
          </span>
        </button>
      </div>

      {/* Approval toggle — applies to both public and private events */}
      <div className="mt-3 rounded-lg border border-slate-200 px-4">
        <ToggleRow
          label="Wymagaj akceptacji"
          desc="Każdą prośbę o dołączenie zatwierdzasz ręcznie, zanim gracz wejdzie do składu"
          checked={requireApproval}
          onChange={setRequireApproval}
        />
      </div>
    </div>
  );
}
