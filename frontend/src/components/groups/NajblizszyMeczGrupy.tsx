'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CalendarPlus, Loader2, MapPin, Share2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { repeatEvent } from '@/lib/events';
import { domyslnyTerminPowtorki } from '@/lib/recurring';
import { shareEvent, eventUrl } from '@/lib/eventShare';
import type { EventItem } from '@/types';

/**
 * Tu żyje pętla tygodniowa — najważniejsze miejsce w całym ekranie grupy.
 * Trzy stany: jest nadchodzący mecz / grupa ma historię, ale nie ma terminu /
 * grupa nie miała jeszcze żadnego meczu.
 */
export default function NajblizszyMeczGrupy({
  groupId, upcoming, ostatni, canCreateEvents,
}: {
  groupId: string;
  upcoming: EventItem | null;
  /** Ostatni rozegrany mecz grupy — źródło danych dla "Powtórz na {data}". */
  ostatni: EventItem | null;
  canCreateEvents: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handlePowtorz = async () => {
    if (!user || !ostatni || busy) return;
    setBusy(true);
    try {
      const czas = ostatni.time.slice(0, 5);
      const nowaData = domyslnyTerminPowtorki(ostatni.date, czas);
      const newId = await repeatEvent(
        ostatni, nowaData, czas, user.id, displayName(user),
        true, false, ostatni.endTime?.slice(0, 5),
      );
      toast('Nowy termin utworzony — cała ekipa dostanie powiadomienie w aplikacji.');
      router.push(`/wydarzenia/${newId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
      setBusy(false);
    }
  };

  if (upcoming) {
    const max = upcoming.maxPlayers ?? 0;
    const taken = upcoming.participantsCount ?? 0;
    const brakuje = Math.max(0, max - taken);
    const pct = max > 0 ? Math.min(100, Math.round((taken / max) * 100)) : 0;
    let kiedy = upcoming.date;
    try { kiedy = format(parseISO(upcoming.date), 'EEEE, d MMMM', { locale: pl }); } catch { /* noop */ }

    const handleShare = async () => {
      const wynik = await shareEvent(upcoming, eventUrl(upcoming.id, window.location.origin));
      if (wynik === 'copied') toast('Skopiowano link do meczu');
    };

    return (
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-700">Najbliższy mecz</p>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="font-display text-lg font-bold capitalize text-ink">{kiedy}, {upcoming.time.slice(0, 5)}</p>
          {upcoming.fieldName && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> {upcoming.fieldName}
            </p>
          )}
          {max > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-primary-600" style={{ width: `${pct}%` }} />
              </div>
              <span className="shrink-0 text-xs text-slate-400">
                {taken}/{max}{brakuje > 0 ? ` · brakuje ${brakuje}` : ''}
              </span>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Link href={`/wydarzenia/${upcoming.id}`} className="flex-1">
              <Button className="w-full">Zobacz mecz</Button>
            </Link>
            <Button variant="outline" onClick={handleShare} className="inline-flex items-center gap-1.5">
              <Share2 className="h-4 w-4" /> Udostępnij
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (ostatni) {
    let dzienOstatniego = ostatni.date;
    try { dzienOstatniego = format(parseISO(ostatni.date), 'EEEE', { locale: pl }); } catch { /* noop */ }
    let nastepnaData = '';
    try {
      nastepnaData = format(
        parseISO(domyslnyTerminPowtorki(ostatni.date, ostatni.time.slice(0, 5))),
        'd MMMM', { locale: pl },
      );
    } catch { /* noop */ }

    return (
      <section>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ekipa nie ma terminu</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ostatnio graliście w <span className="lowercase">{dzienOstatniego}</span> o {ostatni.time.slice(0, 5)}
            {ostatni.fieldName && ` na ${ostatni.fieldName}`}.
          </p>
          {canCreateEvents && (
            <>
              <Button onClick={handlePowtorz} disabled={busy} className="mt-3 inline-flex w-full items-center justify-center gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Powtórz na ${dzienOstatniego} ${nastepnaData}`}
              </Button>
              <p className="mt-1.5 text-xs text-slate-400">Wszyscy w ekipie dostaną powiadomienie w aplikacji.</p>
              <Link href={`/wydarzenia/nowe?group=${groupId}`} className="mt-2 inline-block text-xs font-medium text-slate-500 hover:text-primary-700">
                Ustaw inny termin →
              </Link>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ekipa nie ma jeszcze żadnego meczu</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Wrzuć pierwszy termin — wszyscy członkowie dostaną powiadomienie w aplikacji.
        </p>
        {canCreateEvents && (
          <Link href={`/wydarzenia/nowe?group=${groupId}`} className="mt-3 inline-block">
            <Button className="inline-flex items-center gap-2"><CalendarPlus className="h-4 w-4" /> Ustaw termin</Button>
          </Link>
        )}
      </div>
    </section>
  );
}
