'use client';

import { useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { dismissInvite, type InviteWithEvent } from '@/lib/playerInvites';
import { joinEvent, type MyEventRelation } from '@/lib/events';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { EventItem } from '@/types';

interface InviteListProps {
  invites: InviteWithEvent[];
  statusFor: (event: EventItem) => MyEventRelation;
  /** Cap how many render — omit for no limit (the /moje-gry tab). */
  limit?: number;
  /** Shown instead of nothing when the list is empty — omit to render null
   *  (the dashboard's InvitesSection behaviour: the whole section vanishes). */
  emptyMessage?: React.ReactNode;
  /** Controlled mode: parent owns the dismissed-ids set, e.g. so a header
   *  count can shrink in step with the list. Omit both props for
   *  uncontrolled mode — the list tracks its own dismissals. */
  dismissedIds?: Set<string>;
  onDismiss?: (inviteId: string) => void;
}

/**
 * Lista otwartych zaproszeń — wspólna dla strony głównej i zakładki
 * „Zaproszenia" w Moich grach, żeby obie renderowały to samo zamiast dwóch
 * kopii tego samego układu.
 *
 * Zaproszenie to pytanie, więc pod kartą stoją dwie odpowiedzi: „Dołączam"
 * i „Odrzuć". Wcześniej była tylko ta druga, przez co jedyną drogą do zapisania
 * się było wejście na stronę meczu — czyli odpowiedź „tak" wymagała trzech
 * kliknięć, a „nie" jednego.
 */
export function InviteList({ invites, statusFor, limit, emptyMessage, dismissedIds, onDismiss }: InviteListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [localDismissed, setLocalDismissed] = useState<Set<string>>(new Set());
  const [dolaczam, setDolaczam] = useState<string | null>(null);
  const dismissed = dismissedIds ?? localDismissed;

  const ukryj = (inviteId: string) => {
    if (onDismiss) { onDismiss(inviteId); return; }
    setLocalDismissed((prev) => new Set(prev).add(inviteId));
  };

  const dismiss = (inviteId: string) => {
    // Optimistic: the invite disappears immediately — dismissing never
    // breaks anything, so waiting on the network here would just look like
    // a stall.
    ukryj(inviteId);
    if (!onDismiss) dismissInvite(inviteId).catch(() => {});
  };

  /**
   * Zapis prosto z zaproszenia — bez wyboru bramkarza i metody płatności.
   * Te ustawienia zmienia się potem na stronie meczu; blokowanie odpowiedzi
   * „tak" do czasu ich podania odwracałoby proporcje: najczęstsza decyzja
   * byłaby najdroższa w kliknięciach.
   */
  const dolacz = async (inviteId: string, event: EventItem) => {
    if (!user) return;
    setDolaczam(inviteId);
    try {
      await joinEvent(event.id, user.id, displayName(user));
      // Zaproszenie schodzi z listy razem z zapisem — po dołączeniu nie ma już
      // na co odpowiadać.
      dismissInvite(inviteId).catch(() => {});
      ukryj(inviteId);
      toast('Jesteś zapisany — mecz jest w Twoich grach');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się dołączyć', 'error');
    } finally {
      setDolaczam(null);
    }
  };

  const visible = invites.filter(({ invite }) => !dismissed.has(invite.id));
  const shown = limit ? visible.slice(0, limit) : visible;

  if (shown.length === 0) {
    return emptyMessage ? <>{emptyMessage}</> : null;
  }

  return (
    <div className="space-y-4">
      {shown.map(({ invite, event }) => {
        const zajety = dolaczam === invite.id;
        return (
          <div key={invite.id}>
            <EventBrowseCard event={event} relation={statusFor(event)} />
            {/* Dwie odpowiedzi obok siebie, dosunięte do karty: zielona po
                prawej, bo to działanie oczekiwane, czerwona po lewej i węższa,
                bo odmowa nie powinna wyglądać na równorzędną zachętę. */}
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={() => dismiss(invite.id)}
                disabled={zajety}
                className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Odrzuć
              </button>
              <button
                type="button"
                onClick={() => dolacz(invite.id, event)}
                disabled={zajety || !user}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {zajety
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Check className="h-4 w-4" strokeWidth={2.5} />}
                Dołączam
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
