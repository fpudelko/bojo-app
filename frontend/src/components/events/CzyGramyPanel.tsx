'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MessageCircleQuestion, Radar, Share2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useToast } from '@/lib/toast';
import { werdyktGry } from '@/lib/events';
import { getGroupMembers } from '@/lib/groups';
import { getDeclines } from '@/lib/eventDeclines';
import { ktoMilczy, zapytajMilczacych } from '@/lib/eventResponses';
import { tekstZaczepki, eventUrl } from '@/lib/eventShare';
import type { EventItem, EventParticipant, EventDecline, GroupMember } from '@/types';

/**
 * Panel organizatora "Czy gramy?" — odpowiada na pytania, które ekipy dziś
 * liczą ręcznie na WhatsAppie ("brakuje nam 1go? dobrze liczę?", "10 to
 * minimum żeby zagrać"). Trzy niezależne bloki, każdy pokazuje się tylko
 * wtedy, gdy ma o czym mówić — mecz bez progu i bez grupy nie renderuje nic.
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
  const { toast } = useToast();
  const [czlonkowie, setCzlonkowie] = useState<GroupMember[]>([]);
  const [odmowy, setOdmowy] = useState<EventDecline[]>([]);
  const [loadingMilczacy, setLoadingMilczacy] = useState(!!event.groupId);
  const [busyZapytaj, setBusyZapytaj] = useState(false);

  const load = useCallback(() => {
    if (!event.groupId) { setLoadingMilczacy(false); return; }
    setLoadingMilczacy(true);
    Promise.all([getGroupMembers(event.groupId), getDeclines(event.id)])
      .then(([m, d]) => { setCzlonkowie(m); setOdmowy(d); })
      .catch((e) => console.warn('[CzyGramyPanel]', e))
      .finally(() => setLoadingMilczacy(false));
  }, [event.groupId, event.id]);

  useEffect(() => { load(); }, [load]);

  const wSkladzie = participants.filter((p) => !p.isReserve && !p.pendingApproval).length;
  const werdykt = werdyktGry(event, wSkladzie);
  const milczacy = event.groupId ? ktoMilczy(czlonkowie, participants, odmowy, event.organizerId) : [];
  const freeSpots = Math.max(0, event.maxPlayers - wSkladzie);
  const pokazOtworzDlaOkolicy = canManage && event.visibility === 'private' && freeSpots > 0;

  if (!canManage) return null;
  if (werdykt.stan === 'brak-progu' && !event.groupId && !pokazOtworzDlaOkolicy) return null;

  const handleZapytaj = async () => {
    setBusyZapytaj(true);
    try {
      const n = await zapytajMilczacych(event.id);
      toast(n > 0 ? `Zapytano ${n} ${n === 1 ? 'osobę' : 'osoby'} w Bojo.` : 'Wszyscy już odpowiedzieli albo byli niedawno zapytani.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally {
      setBusyZapytaj(false);
    }
  };

  const handleTekstNaWhatsapp = async () => {
    const tekst = tekstZaczepki(event, werdykt.brakuje, eventUrl(event.id, window.location.origin));
    try {
      await navigator.clipboard.writeText(tekst);
      toast('Skopiowano — wklej na WhatsAppa');
    } catch {
      toast('Nie udało się skopiować', 'error');
    }
  };

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

      {event.groupId && (
        <div className={werdykt.stan !== 'brak-progu' ? 'mt-3 border-t border-slate-100 pt-3 dark:border-slate-700' : ''}>
          {loadingMilczacy ? (
            <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Sprawdzam skład ekipy…</div>
          ) : milczacy.length > 0 ? (
            <>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Nie odpowiedziało: {milczacy.length}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {milczacy.slice(0, 4).map((m) => m.name).join(', ')}{milczacy.length > 4 ? `, +${milczacy.length - 4}` : ''}
              </p>
              {/* `flex-1` na obu przyciskach zamiast `flex-wrap` — dwa pełnej
                  szerokości przyciski jeden pod drugim marnowały miejsce;
                  teraz dzielą wiersz po połowie, z `truncate`, żeby dłuższa
                  etykieta na wąskim telefonie się nie łamała. */}
              <div className="mt-2.5 flex gap-2">
                <Button variant="outline" onClick={handleZapytaj} disabled={busyZapytaj} className="flex-1 items-center gap-1.5 truncate text-xs">
                  {busyZapytaj ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <MessageCircleQuestion className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">Zapytaj w Bojo</span>
                </Button>
                <Button variant="outline" onClick={handleTekstNaWhatsapp} className="flex-1 items-center gap-1.5 truncate text-xs">
                  <Share2 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Tekst na WhatsAppa</span>
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Cała ekipa odpowiedziała.</p>
          )}
        </div>
      )}

      {pokazOtworzDlaOkolicy && (
        <div className={werdykt.stan !== 'brak-progu' || event.groupId ? 'mt-3 border-t border-slate-100 pt-3 dark:border-slate-700' : ''}>
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
