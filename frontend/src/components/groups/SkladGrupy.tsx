'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Crown, LogOut, Settings, Shield, Trash2, User as UserIcon } from 'lucide-react';
import UprawnieniaCzlonkaPanel, { type PatchUprawnien } from './UprawnieniaCzlonkaPanel';
import { czyWspolorganizator, uprawnieniaCzlonka } from '@/lib/groups';
import type { GroupMember, GroupPermissions } from '@/types';

/**
 * Skład ekipy. Kebab „Usuń z ekipy" jest dostępny każdemu z
 * `can_manage_members` (nie tylko założycielowi) — spójnie z polityką DELETE
 * na `group_members` (migracja `092`). Zmianę UPRAWNIEŃ innego członka widzi
 * wyłącznie założyciel (ikona ustawień) — politykę UPDATE na `group_members`
 * ma tylko on, więc przycisk pokazany komuś innemu „nic by nie robił".
 *
 * „Opuść ekipę" mieszka tu, nie w Ustawieniach — `/grupy/[id]/edytuj` jest
 * dostępne wyłącznie dla założyciela i `can_manage_members`, więc zwykły
 * członek bez żadnych uprawnień nigdy tam nie trafi. To jest jego jedyna
 * droga wyjścia z ekipy.
 */
export default function SkladGrupy({
  members, myUserId, permissions, founderId, onRemove, onSetPerms, onLeave, leaveBusy,
}: {
  members: GroupMember[];
  myUserId?: string;
  permissions: GroupPermissions;
  founderId?: string;
  onRemove: (userId: string) => void;
  onSetPerms: (member: GroupMember, patch: PatchUprawnien) => void;
  /** Obecne tylko dla członka, który nie jest założycielem — ten nie może opuścić ekipy. */
  onLeave?: () => void;
  leaveBusy?: boolean;
}) {
  const [rozwinietyId, setRozwinietyId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {members.length > 0 && (
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {members.slice(0, 8).map((m) => (
              m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={m.id} src={m.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-canvas" />
              ) : (
                <span key={m.id} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700 ring-2 ring-canvas">
                  {m.name.charAt(0).toUpperCase()}
                </span>
              )
            ))}
          </div>
          {members.length > 8 && <span className="ml-2 text-xs font-medium text-slate-500">+{members.length - 8}</span>}
        </div>
      )}

      <ul className="divide-y divide-slate-50 dark:divide-slate-700">
        {members.map((m) => {
          const jestZalozycielem = !!founderId && m.userId === founderId;
          const mozeUsunac = permissions.canManageMembers && !jestZalozycielem && m.userId !== myUserId;
          const mozeEdytowacUprawnienia = permissions.isFounder && !jestZalozycielem;
          const rozwiniety = rozwinietyId === m.id;
          return (
            <li key={m.id} className="py-2.5">
              <div className="flex items-center gap-3">
                <Link href={`/gracz/${m.userId}`} className="group flex min-w-0 flex-1 items-center gap-3">
                  {m.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                      <UserIcon className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink transition-colors group-hover:text-primary-700">{m.name}</span>
                    {jestZalozycielem ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                        <Crown className="h-3 w-3" /> Założyciel
                      </span>
                    ) : czyWspolorganizator(m) ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-700">
                        <Shield className="h-3 w-3" /> Współorganizator
                      </span>
                    ) : null}
                  </span>
                </Link>
                {mozeEdytowacUprawnienia && (
                  <button
                    onClick={() => setRozwinietyId(rozwiniety ? null : m.id)}
                    title="Uprawnienia"
                    aria-expanded={rozwiniety}
                    className={`shrink-0 rounded p-1.5 ${rozwiniety ? 'text-primary-700' : 'text-slate-400 hover:text-primary-600'}`}
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                )}
                {mozeUsunac && (
                  <button
                    onClick={() => onRemove(m.userId)}
                    title="Usuń z ekipy"
                    className="shrink-0 rounded p-1.5 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {mozeEdytowacUprawnienia && rozwiniety && (
                <div className="mt-2 rounded-xl bg-slate-50 px-3 dark:bg-slate-700/40">
                  <UprawnieniaCzlonkaPanel
                    perms={uprawnieniaCzlonka({ createdBy: founderId }, m)}
                    onChange={(patch) => onSetPerms(m, patch)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {onLeave && (
        <div className="flex justify-center pt-2">
          <button
            onClick={onLeave}
            disabled={leaveBusy}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-600 dark:text-slate-500"
          >
            <LogOut className="h-3.5 w-3.5" /> Opuść ekipę
          </button>
        </div>
      )}
    </div>
  );
}
