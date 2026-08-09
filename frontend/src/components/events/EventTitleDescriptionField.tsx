'use client';

import ToggleRow from '@/components/ui/ToggleRow';

/**
 * Tytuł + opis za przełącznikiem „Dodaj opis” (pusta textarea sama w sobie
 * sugerowała, że trzeba ją wypełnić). Wspólne dla kreatora (`wydarzenia/nowe`)
 * i edycji wydarzenia — edycja miała dotąd zawsze widoczną textarea opisu.
 */
export default function EventTitleDescriptionField({
  title, setTitle, placeholderTitle,
  description, setDescription,
  descriptionEnabled, setDescriptionEnabled,
  inputCls,
}: {
  title: string;
  setTitle: (v: string) => void;
  placeholderTitle: string;
  description: string;
  setDescription: (v: string) => void;
  descriptionEnabled: boolean;
  setDescriptionEnabled: (v: boolean) => void;
  inputCls: string;
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Tytuł <span className="text-slate-400 font-normal">(opcjonalnie)</span>
        </label>
        <input
          type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholderTitle} className={inputCls} maxLength={80}
        />
        <p className="mt-1 text-xs text-slate-500">
          Zostaw puste, a mecz nazwie się{' '}
          <span className="font-semibold text-slate-700">{placeholderTitle}</span>.
        </p>
      </div>

      {/* Description — behind a toggle: the empty textarea itself read
          like something to fill in, when most matches don't need it. */}
      <div className="rounded-lg border border-slate-200 px-4">
        <ToggleRow
          label="Dodaj opis"
          desc="Poziom, zasady, co zabrać — pokaże się na stronie meczu"
          checked={descriptionEnabled}
          onChange={setDescriptionEnabled}
        />
        {descriptionEnabled && (
          <div className="pb-3">
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Poziom, zasady, co zabrać…" rows={3} className={inputCls}
            />
          </div>
        )}
      </div>
    </>
  );
}
