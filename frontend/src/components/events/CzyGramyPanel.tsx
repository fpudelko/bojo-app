'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { werdyktGry } from '@/lib/events';
import { SHOW_MIN_PLAYERS_THRESHOLD } from '@/lib/features';
import type { EventItem, EventParticipant } from '@/types';

/**
 * Panel organizatora "Czy gramy?" — odpowiada na pytanie, które ekipy dziś
 * liczą ręcznie na WhatsAppie ("brakuje nam 1go? dobrze liczę?", "10 to
 * minimum żeby zagrać"). Pokazuje się tylko wtedy, gdy ma o czym mówić —
 * mecz bez progu nie renderuje nic.
 *
 * "Otwórz dla okolicy" STAŁO TUTAJ do 2026-09-13 i przeniosło się do
 * `ZaprosZnajomychPanel`. Powód: ta karta wisiała nad licznikiem miejsc
 * i podawała tę samą liczbę odwrotnie niż on — licznik „Zostało 13 wolnych
 * miejsc", karta „Brakuje 13" — a sama akcja jest po prostu czwartym
 * sposobem na zapełnienie składu, obok linku, kopiowania i zaproszenia
 * z ekipy. Zgłoszone wprost. `handleOtworzDlaOkolicy` na stronie meczu
 * został nietknięty, zmienił się tylko przycisk, który go woła.
 *
 * Panel miał wcześniej trzeci blok, „Nie odpowiedziało: N" z przyciskiem
 * wywołującym RPC `zapytaj_milczacych()` (migracja `097`) — usunięty na
 * wyraźną prośbę 2026-08-16: zamiast ścigać milczących, prostszą odpowiedzią
 * na „brakuje ludzi" jest „Otwórz dla okolicy" poniżej. RPC zostaje w bazie
 * nietknięty (`docs/funkcje.md § Czy gramy?`), po prostu nic już go nie woła.
 *
 * Werdykt progu („Gramy ✓" / „Brakuje N do minimum") schowany za
 * `SHOW_MIN_PLAYERS_THRESHOLD` — wyłączona 2026-08-21, produktowa decyzja.
 * `event.minPlayers` i `werdyktGry()` zostają nietknięte. Przy wyłączonej fladze
 * panel nie renderuje dziś nic; zostaje na miejscu, bo flaga może wrócić.
 */
export default function CzyGramyPanel({ event, participants, canManage }: {
  event: EventItem;
  participants: EventParticipant[];
  canManage: boolean;
}) {
  const wSkladzie = participants.filter((p) => !p.isReserve && !p.pendingApproval).length;
  const werdykt = SHOW_MIN_PLAYERS_THRESHOLD ? werdyktGry(event, wSkladzie) : { stan: 'brak-progu' as const, brakuje: 0 };

  if (!canManage) return null;
  if (werdykt.stan === 'brak-progu') return null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
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
              <span className="font-normal text-slate-500">: {wSkladzie}/{event.minPlayers}</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
