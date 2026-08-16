'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CalendarPlus, Loader2, Share2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { repeatEvent } from '@/lib/events';
import type { MyEventRelation } from '@/lib/events';
import { domyslnyTerminPowtorki } from '@/lib/recurring';
import { shareEvent, eventUrl } from '@/lib/eventShare';
import type { EventItem } from '@/types';

/**
 * Tu żyje pętla tygodniowa — najważniejsze miejsce w całym ekranie grupy.
 * Trzy stany: jest nadchodzący mecz / grupa ma historię, ale nie ma terminu /
 * grupa nie miała jeszcze żadnego meczu.
 */
export default function NajblizszyMeczGrupy({
  groupId, upcoming, ostatni, canCreateEvents, relation, unreadMessages,
}: {
  groupId: string;
  upcoming: EventItem | null;
  /** Ostatni rozegrany mecz grupy — źródło danych dla "Powtórz na {data}". */
  ostatni: EventItem | null;
  canCreateEvents: boolean;
  /** Mój status w tym meczu — ten sam kształt, co karty na zakładce "Mecze". */
  relation?: MyEventRelation;
  /** Nieprzeczytane wiadomości w rozmowie tego meczu — patrz `EventBrowseCard`. */
  unreadMessages?: number;
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
    const handleShare = async () => {
      const wynik = await shareEvent(upcoming, eventUrl(upcoming.id, window.location.origin));
      if (wynik === 'copied') toast('Skopiowano link do meczu');
    };

    return (
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-700">Najbliższy mecz</p>
        <EventBrowseCard event={upcoming} relation={relation} unreadMessages={unreadMessages} />
        <Button
          variant="outline"
          onClick={handleShare}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5"
        >
          <Share2 className="h-4 w-4" /> Udostępnij mecz
        </Button>
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
