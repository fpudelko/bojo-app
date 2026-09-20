'use client';

/**
 * „Zaproś z ekipy" — imienne zaproszenia kapitana do drużyny turniejowej.
 *
 * Bliźniak `components/events/InviteFromGroupDialog.tsx` (mecz) i celowo
 * zachowuje się tak samo: domyślnie zaznaczeni są WSZYSCY, których da się
 * zaprosić, bo „zaproś całą ekipę" to najczęstszy przypadek, a odznaczenie
 * dwóch osób jest szybsze niż zaznaczanie ośmiu. Osoby już w składzie albo
 * już zaproszone zostają na liście jako nieaktywne z podpisem — żeby było
 * widać, że nie zniknęły, tylko nie ma po co zapraszać ich drugi raz.
 *
 * Kandydaci pochodzą WYŁĄCZNIE z ekip kapitana. Wyszukiwarka po całym Bojo
 * wymagałaby udostępnienia listy wszystkich kont — decyzja właściciela
 * z 2026-09-20.
 *
 * Osobny plik, nie wspólny komponent z wersją meczową: tamta mówi o `eventId`
 * i uczestnikach meczu, ta o drużynie i składzie, a scalenie ich dałoby
 * komponent z dwoma trybami i pięcioma opcjonalnymi propsami. Wspólne jest
 * zachowanie, nie dane — i to zachowanie opisuje ten komentarz.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Users, X } from 'lucide-react';
import { getMyGroups, getGroupMembers } from '@/lib/groups';
import { zaprosDoDruzyny } from '@/lib/turniejZaproszenia';
import { withCount } from '@/lib/plural';
import { WARSTWA } from '@/lib/warstwy';
import type { Group, GroupMember } from '@/types';

export default function ZaprosZEkipyDialog({
  druzynaId, druzynaNazwa, userId, wSkladzieUserIds, juzZaproszeni, onClose, onZaproszeni,
}: {
  druzynaId: string;
  druzynaNazwa: string;
  userId: string;
  /** Kto jest już w składzie tej drużyny (tylko konta). */
  wSkladzieUserIds: string[];
  /** Kogo kapitan już zaprosił i zaproszenie nadal wisi. */
  juzZaproszeni: string[];
  onClose: () => void;
  onZaproszeni: (ile: number) => void;
}) {
  const [ekipy, setEkipy] = useState<Group[]>([]);
  const [ekipaId, setEkipaId] = useState('');
  const [czlonkowie, setCzlonkowie] = useState<GroupMember[]>([]);
  const [zaznaczeni, setZaznaczeni] = useState<Set<string>>(new Set());
  const [ladowanie, setLadowanie] = useState(true);
  const [wysylam, setWysylam] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  useEffect(() => {
    let aktualne = true;
    getMyGroups(userId)
      .then((g) => {
        if (!aktualne) return;
        setEkipy(g);
        if (g.length > 0) setEkipaId(g[0].id);
      })
      .catch((e) => { if (aktualne) setBlad(e instanceof Error ? e.message : 'Nie udało się wczytać ekip'); })
      .finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
  }, [userId]);

  useEffect(() => {
    if (!ekipaId) { setCzlonkowie([]); return; }
    let aktualne = true;
    getGroupMembers(ekipaId)
      .then((ms) => {
        if (!aktualne) return;
        setCzlonkowie(ms);
        setZaznaczeni(new Set(
          ms.filter((m) => m.userId !== userId
            && !wSkladzieUserIds.includes(m.userId)
            && !juzZaproszeni.includes(m.userId))
            .map((m) => m.userId),
        ));
      })
      .catch(() => { if (aktualne) setCzlonkowie([]); });
    return () => { aktualne = false; };
  }, [ekipaId, userId, wSkladzieUserIds, juzZaproszeni]);

  const powod = (m: GroupMember): string | null => {
    if (m.userId === userId) return 'to Ty';
    if (wSkladzieUserIds.includes(m.userId)) return 'w składzie';
    if (juzZaproszeni.includes(m.userId)) return 'zaproszony';
    return null;
  };

  const doZaproszenia = czlonkowie.filter((m) => powod(m) === null);

  const przelacz = (id: string) => {
    setZaznaczeni((poprzednie) => {
      const nowe = new Set(poprzednie);
      if (nowe.has(id)) nowe.delete(id); else nowe.add(id);
      return nowe;
    });
  };

  const wyslij = async () => {
    setWysylam(true);
    setBlad(null);
    try {
      const ile = await zaprosDoDruzyny(druzynaId, Array.from(zaznaczeni), {
        zaprosilId: userId,
        groupId: ekipaId || undefined,
      });
      onZaproszeni(ile);
    } catch (e) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się wysłać zaproszeń');
      setWysylam(false);
    }
  };

  return (
    <div className={`fixed inset-0 ${WARSTWA.modal} flex items-end justify-center bg-black/40 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4 sm:pb-4`}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white dark:bg-slate-800 shadow-xl sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 px-5 py-4">
          <Users className="h-4 w-4 shrink-0 text-slate-400" />
          <h2 className="min-w-0 truncate font-semibold text-ink">Zaproś do {druzynaNazwa}</h2>
          <button onClick={onClose} className="ml-auto shrink-0 text-slate-400 hover:text-slate-600" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {ladowanie ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700" />)}
            </div>
          ) : ekipy.length === 0 ? (
            /* Ślepy zaułek bez wyjścia byłby tu szczególnie dotkliwy: kapitan
               otwiera to okno w trakcie kompletowania składu, więc „nie masz
               ekipy" bez drogi dalej znaczy „wróć do linku i radź sobie". */
            <div className="py-6 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nie należysz jeszcze do żadnej ekipy. Kolegów spoza Bojo zapraszasz linkiem,
                a ekipa sprawi, że następnym razem zrobisz to jednym dotknięciem.
              </p>
              <Link
                href="/grupy/nowe"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-800"
              >
                <Users className="h-4 w-4" /> Załóż ekipę
              </Link>
            </div>
          ) : (
            <>
              {ekipy.length > 1 && (
                <select
                  value={ekipaId}
                  onChange={(e) => setEkipaId(e.target.value)}
                  className="mb-4 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-ink dark:text-slate-100"
                >
                  {ekipy.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}

              {doZaproszenia.length > 0 && (
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Zaznaczono {zaznaczeni.size} z {doZaproszenia.length}
                  </span>
                  <button
                    onClick={() => setZaznaczeni(
                      zaznaczeni.size === doZaproszenia.length
                        ? new Set()
                        : new Set(doZaproszenia.map((m) => m.userId)),
                    )}
                    className="font-semibold text-primary-700 dark:text-primary-300"
                  >
                    {zaznaczeni.size === doZaproszenia.length ? 'Odznacz wszystkich' : 'Zaznacz wszystkich'}
                  </button>
                </div>
              )}

              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {czlonkowie.map((m) => {
                  const blokada = powod(m);
                  const zaznaczony = zaznaczeni.has(m.userId);
                  return (
                    <li key={m.userId}>
                      <button
                        disabled={blokada !== null}
                        onClick={() => przelacz(m.userId)}
                        className="flex min-h-[44px] w-full items-center gap-3 py-2.5 text-left disabled:opacity-50"
                      >
                        <span
                          className={[
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                            zaznaczony && !blokada
                              ? 'border-primary-700 bg-primary-700 text-white'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700',
                          ].join(' ')}
                        >
                          {zaznaczony && !blokada && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">{m.name}</span>
                        {blokada && <span className="shrink-0 text-xs text-slate-400">{blokada}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {czlonkowie.length > 0 && doZaproszenia.length === 0 && (
                <p className="pt-3 text-center text-sm text-slate-500 dark:text-slate-400">
                  Cała ekipa jest już w składzie albo zaproszona.
                </p>
              )}
            </>
          )}

          {blad && <p className="mt-3 text-sm text-red-600">{blad}</p>}
        </div>

        {ekipy.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-4">
            <button
              onClick={wyslij}
              disabled={wysylam || zaznaczeni.size === 0}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {wysylam && <Loader2 className="h-4 w-4 animate-spin" />}
              {zaznaczeni.size === 0
                ? 'Wybierz kogo zaprosić'
                : doZaproszenia.length > 1 && zaznaczeni.size === doZaproszenia.length
                  ? `Zaproś całą ekipę (${zaznaczeni.size})`
                  : `Zaproś ${withCount(zaznaczeni.size, 'osobę', 'osoby', 'osób')}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
