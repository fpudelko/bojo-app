'use client';

import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { WARSTWA } from '@/lib/warstwy';

/**
 * "Dopisz osobę bez konta" — modal, nie stała karta w Składzie.
 *
 * Wcześniej to był zawsze rozwinięty formularz z dwoma akapitami wyjaśnienia
 * (ten komponent + osobny podpis pod polem e-mail) widoczny w dwóch miejscach
 * na stronie (panel organizatora i panel uczestnika przy `allowGuestAdds`) —
 * czyli cztery akapity tekstu na stronie meczu robiące dokładnie to samo.
 * Zgłoszone wprost z sesji UX: rzecz używana rzadko nie musi stać rozwinięta
 * przez cały czas. Zostaje jeden przycisk-wyzwalacz i jedno zdanie wyjaśnienia
 * w środku modala.
 */
export default function DopiszGoscia({
  guestName,
  onGuestNameChange,
  email,
  onEmailChange,
  gkEnabled,
  guestRole,
  onGuestRoleChange,
  onAdd,
  busy,
}: {
  guestName: string;
  onGuestNameChange: (v: string) => void;
  email: string;
  onEmailChange: (v: string) => void;
  gkEnabled: boolean;
  guestRole: 'player' | 'goalkeeper';
  onGuestRoleChange: (r: 'player' | 'goalkeeper') => void;
  onAdd: () => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);

  const dodaj = () => {
    if (!guestName.trim()) return;
    onAdd();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-primary-700 hover:text-primary-800"
      >
        <UserPlus className="h-3.5 w-3.5" /> Dopisz osobę bez konta
      </button>

      {open && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center ${WARSTWA.modal} p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`}
          onClick={() => setOpen(false)}
        >
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Zamknij"
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="mb-4 pr-8 font-semibold text-ink">Dopisz osobę bez konta</h3>

            <div className="flex gap-2">
              <input
                type="text"
                value={guestName}
                onChange={(e) => onGuestNameChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && dodaj()}
                placeholder="Imię znajomego"
                // 80 znaków = limit, który i tak wymusza `validateName()`
                // przy zapisie (`lib/events.ts`). Bez tego pole przyjmowało
                // dowolnie długi tekst, a odmowa przychodziła dopiero
                // z serwera, po kliknięciu „Dodaj".
                maxLength={80}
                autoFocus
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="E-mail znajomego (opcjonalnie)"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            {gkEnabled && (
              <div className="mt-2 flex gap-2">
                {([['field', 'Zawodnik z pola'], ['gk', '🧤 Bramkarz']] as const).map(([r, label]) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onGuestRoleChange(r === 'gk' ? 'goalkeeper' : 'player')}
                    className={[
                      'rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                      (r === 'gk') === (guestRole === 'goalkeeper')
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Jedno zdanie zamiast dawnych dwóch — to jest informacja, która
                naprawdę wpływa na decyzję (wypełnić pole e-mail czy nie), nie
                powtórka tego, co robi przycisk "Dodaj". */}
            <p className="mt-2 text-[11px] text-slate-400">
              Z adresem e-mail dostanie potwierdzenie i przypomnienia; bez adresu powiadom go sam.
            </p>

            <Button
              onClick={dodaj}
              disabled={busy || !guestName.trim()}
              isLoading={busy}
              className="mt-3 w-full"
            >
              <UserPlus className="w-4 h-4" /> Dodaj
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
