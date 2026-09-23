'use client';

import { useId } from 'react';

/** A labelled on/off switch, label+description on the left, switch on the
 *  right. Shared by the event creation wizard and the event edit page — used
 *  to live as two copy-pasted local components, one per file.
 *
 *  THE WHOLE ROW IS THE TARGET, and the switch carries an accessible name.
 *  Before: only the 44x24 px switch reacted, tapping the label did nothing,
 *  and `role="switch"` had no name at all. An audit created a match without
 *  the approval requirement precisely this way: tapped the text, saw no
 *  change, assumed it was on. Silent miss on a setting that decides who
 *  gets into the match. */
export default function ToggleRow({ label, desc, checked, onChange }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  const idEtykiety = useId();
  const idOpisu = useId();

  return (
    <div
      onClick={() => onChange(!checked)}
      className="flex cursor-pointer items-start justify-between gap-4 py-3"
    >
      <div>
        <p id={idEtykiety} className="text-sm font-medium text-slate-900">{label}</p>
        {desc && <p id={idOpisu} className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <button
        type="button"
        // Kliknięcie w sam przełącznik nie ma wywołać zmiany DWA razy:
        // raz z przycisku, raz z wiersza wyżej.
        onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
        className={['relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors', checked ? 'bg-primary-600' : 'bg-slate-200'].join(' ')}
        role="switch"
        aria-checked={checked}
        aria-labelledby={idEtykiety}
        aria-describedby={desc ? idOpisu : undefined}
      >
        <span className={['pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
      </button>
    </div>
  );
}
