'use client';

import ToggleRow from '@/components/ui/ToggleRow';
import type { GroupPermissions } from '@/types';

export type PatchUprawnien = Partial<Pick<GroupPermissions, 'canManageMembers' | 'canCreateEvents' | 'canModerateWall' | 'canInvite'>>;

/**
 * Cztery przełączniki uprawnień jednego członka — wspólne dla akordeonu
 * w ustawieniach grupy (`/grupy/[id]/edytuj`) i przycisku ustawień przy
 * członku w Składzie (`SkladGrupy.tsx`), żeby opisy i kolejność nie rozjechały
 * się w dwóch miejscach.
 */
export default function UprawnieniaCzlonkaPanel({ perms, onChange }: {
  perms: Pick<GroupPermissions, 'canManageMembers' | 'canCreateEvents' | 'canModerateWall' | 'canInvite'>;
  onChange: (patch: PatchUprawnien) => void;
}) {
  return (
    <div className="divide-y divide-slate-50 dark:divide-slate-700">
      <ToggleRow
        label="Zarządza składem"
        desc="Dodaje i usuwa ludzi z ekipy."
        checked={perms.canManageMembers}
        onChange={(v) => onChange({ canManageMembers: v })}
      />
      <ToggleRow
        label="Tworzy mecze ekipy"
        desc="Zakłada terminy przypisane do tej ekipy."
        checked={perms.canCreateEvents}
        onChange={(v) => onChange({ canCreateEvents: v })}
      />
      <ToggleRow
        label="Zaprasza do ekipy"
        desc="Widzi przycisk „Zaproś” i kod dołączenia."
        checked={perms.canInvite}
        onChange={(v) => onChange({ canInvite: v })}
      />
      <ToggleRow
        label="Moderuje rozmowę"
        desc="Kasuje cudze wiadomości i przypina ważne."
        checked={perms.canModerateWall}
        onChange={(v) => onChange({ canModerateWall: v })}
      />
    </div>
  );
}
