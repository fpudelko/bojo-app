'use client';

import { AlertTriangle, CheckCircle2, Loader2, Radar } from 'lucide-react';
import Button from '@/components/ui/Button';
import { werdyktGry } from '@/lib/events';
import type { EventItem, EventParticipant } from '@/types';

/**
 * Panel organizatora "Czy gramy?" — odpowiada na pytania, które ekipy dziś
 * liczą ręcznie na WhatsAppie ("brakuje nam 1go? dobrze liczę?", "10 to
 * minimum żeby zagrać"). Dwa niezależne bloki, każdy pokazuje się tylko
 * wtedy, gdy ma o czym mówić — mecz bez progu i bez wolnych miejsc nie
 * renderuje nic.
 *
 * "Otwórz dla okolicy" nie zmienia widoczności samodzielnie — woła
 * `onOtworzDlaOkolicy` (istniejący `handleSetVisibility('public')` na stronie
 * meczu), żeby logowanie aktywności i komunikat zostały jedną, wspólną drogą.
 */
export default function CzyGramyPanel({ event, participants, canManage, busy, onOtworzDlaOkolicy }: {
  event: EventItem;
  participants: EventParticipant[];
  canManage: boolean;
  busy: boolean;
  onOtworzDlaOkolicy: () => void;
}) {
  const wSkladzie = participants.filter((p) => !p.isReserve && !p.pendingApproval).length;
  const werdykt = werdyktGry(event, wSkladzie);
  const freeSpots = Math.max(0, event.maxPlayers - wSkladzie);
  const pokazOtworzDlaOkolicy = canManage && event.visibility === 'private' && freeSpots > 0;

  if (!canManage) return null;
  if (werdykt.stan === 'brak-progu' && !pokazOtworzDlaOkolicy) return null;

  const handleOtworz = () => {
    if (!confirm('Mecz pojawi się na publicznej liście meczów. Każdy, kto ma link, i tak mógł dołączyć — to tylko dodaje go do listy dla ludzi z okolicy.')) return;
    onOtworzDlaOkolicy();
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      {werdykt.stan !== 'brak-progu' && (
        <div className="flex items-center gap-2">
          {werdykt.stan === 'gramy' ? (
            <>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              <p className="text-sm font-bold text-ink">Gramy ✓ <span className="font-normal text-slate-500">{wSkladzie} z {event.minPlayers} minimum</span></p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-sm font-bold text-ink">
                Brakuje {werdykt.brakuje} do minimum
                <span className="font-normal text-slate-500"> — {wSkladzie}/{event.minPlayers}</span>
              </p>
            </>
          )}
        </div>
      )}

      {pokazOtworzDlaOkolicy && (
        <div className={werdykt.stan !== 'brak-progu' ? 'mt-3 border-t border-slate-100 pt-3 dark:border-slate-700' : ''}>
          <Button
            variant="outline"
            onClick={handleOtworz}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-1.5 text-sm"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
            Brakuje {freeSpots} — otwórz dla okolicy
          </Button>
          <p className="mt-1 text-center text-xs text-slate-400">Mecz pojawi się na publicznej liście, żeby dołączyli ludzie z sąsiedztwa.</p>
        </div>
      )}
    </div>
  );
}
