'use client';

import Link from 'next/link';
import { Crown, Shield, Trash2, User as UserIcon } from 'lucide-react';
import type { GroupMember, GroupPermissions } from '@/types';

/**
 * Skład ekipy. Kebab „Usuń z ekipy" jest dostępny każdemu z
 * `can_manage_members` (nie tylko założycielowi) — spójnie z polityką DELETE
 * na `group_members` (migracja `092`). Zmiana UPRAWNIEŃ innego członka nie
 * jest tu dostępna wcale: politykę UPDATE na `group_members` ma wyłącznie
 * założyciel, więc ta akcja żyje jedynie w Ustawieniach (`/grupy/[id]/edytuj`),
 * a nie w tym menu — inaczej przycisk „nic by nie robił" reszcie zarządzających.
 */
export default function SkladGrupy({
  members, myUserId, permissions, founderId, onRemove,
}: {
  members: GroupMember[];
  myUserId?: string;
  permissions: GroupPermissions;
  founderId?: string;
  onRemove: (userId: string) => void;
}) {
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
          return (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
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
                  ) : (m.canManageMembers || m.canCreateEvents || m.canModerateWall) ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-700">
                      <Shield className="h-3 w-3" /> Współorganizator
                    </span>
                  ) : null}
                </span>
              </Link>
              {mozeUsunac && (
                <button
                  onClick={() => onRemove(m.userId)}
                  title="Usuń z ekipy"
                  className="shrink-0 rounded p-1.5 text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
