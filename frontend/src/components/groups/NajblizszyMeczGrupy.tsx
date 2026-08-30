'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CalendarPlus, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import ZaprosZnajomychPanel from '@/components/events/ZaprosZnajomychPanel';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { repeatEvent } from '@/lib/events';
import type { MyEventRelation } from '@/lib/events';
import { domyslnyTerminPowtorki } from '@/lib/recurring';
import { dzienTygodniaWBierniku } from '@/lib/eventDates';
import type { EventItem } from '@/types';

/**
 * Tu żyje pętla tygodniowa — najważniejsze miejsce w całym ekranie grupy.
 * Trzy stany: jest nadchodzący mecz / grupa ma historię, ale nie ma terminu /
 * grupa nie miała jeszcze żadnego meczu.
 */
export default function NajblizszyMeczGrupy({
  groupId, upcoming, ostatni, canCreateEvents, relation, unreadMessages, isNew,
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
  /** Ten mecz jest nowy od ostatniej wizyty na stronie ekipy — patrz `EventBrowseCard`. */
  isNew?: boolean;
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
    return (
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-700">Najbliższy mecz</p>
        <EventBrowseCard event={upcoming} relation={relation} unreadMessages={unreadMessages} isNew={isNew} />
        {/* Ten sam panel co w widoku meczu, nie własny przycisk „Udostępnij
            mecz". Poprzednia wersja robiła połowę tego samego: otwierała
            systemowe okno wyboru aplikacji i na tym kończyła, więc kto je
            zamknął, zostawał z niczym. Kopiowanie linku działa zawsze. */}
        <div className="mt-2">
          <ZaprosZnajomychPanel event={upcoming} />
        </div>
      </section>
    );
  }

  if (ostatni) {
    let dzienOstatniego = ostatni.date;
    // Biernik ("w niedzielę"), nie mianownik z `format()` wprost — zgłoszone
    // wprost z sesji QA jako „graliście w niedziela".
    try { dzienOstatniego = dzienTygodniaWBierniku(parseISO(ostatni.date)); } catch { /* noop */ }
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
