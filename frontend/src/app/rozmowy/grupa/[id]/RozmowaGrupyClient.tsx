'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import NaglowekRozmowy from '@/components/rozmowy/NaglowekRozmowy';
import RozmowaGrupy from '@/components/groups/RozmowaGrupy';
import { HideBottomNav } from '@/lib/bottomNavVisibility';
import { useOknoCzatu, styleOknaCzatu } from '@/lib/oknoCzatu';
import { useAuth } from '@/lib/auth';
import { getGroup, getMyGroupPermissions } from '@/lib/groups';
import { sportEmoji } from '@/lib/sports';
import type { Group, GroupPermissions } from '@/types';

/**
 * `/rozmowy/grupa/[id]` — rozmowa ekipy jako PEŁNY EKRAN komunikatora.
 *
 * Ta sama rozmowa (`RozmowaGrupy`, te same `group_posts`) jest nadal dostępna
 * jako zakładka na stronie ekipy — kto przyszedł zarządzać ekipą, ma ją tam,
 * gdzie była. Ta trasa istnieje dla drugiej drogi: wejścia Z LISTY ROZMÓW,
 * gdzie strona ekipy z paskiem zakładek jest odpowiedzią na pytanie, którego
 * nikt nie zadał.
 *
 * Układ 1:1 jak `/rozmowy/[id]` (DM): własny nagłówek zamiast paska serwisu
 * na mobile, `HideBottomNav`, wysokość liczona z widocznego okna
 * (`useOknoCzatu` — inaczej composer ucieka nad klawiaturę na iOS).
 */
export default function RozmowaGrupyClient() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const okno = useOknoCzatu(true);

  const [group, setGroup] = useState<Group | null>(null);
  const [perms, setPerms] = useState<GroupPermissions | null>(null);
  const [stan, setStan] = useState<'ladowanie' | 'ok' | 'obcy' | 'brak'>('ladowanie');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setStan('obcy'); return; }
    let aktualne = true;
    (async () => {
      try {
        const [g, p] = await Promise.all([getGroup(id), getMyGroupPermissions(id, user.id)]);
        if (!aktualne) return;
        if (!g) { setStan('brak'); return; }
        setGroup(g);
        setPerms(p);
        // Rozmowa ekipy jest wyłącznie dla członków — tak samo jak zakładka
        // na stronie ekipy. Bramką jest RLS w bazie; tu chodzi o to, żeby
        // nieczłonek dostał zdanie wyjaśnienia zamiast pustego czatu.
        setStan(p ? 'ok' : 'obcy');
      } catch {
        if (aktualne) setStan('brak');
      }
    })();
    return () => { aktualne = false; };
  }, [id, user, authLoading]);

  const pelnyEkran = stan === 'ok';

  return (
    <div
      className={`flex flex-col bg-canvas ${pelnyEkran ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'}`}
      style={pelnyEkran ? styleOknaCzatu(okno) : undefined}
    >
      <Header hideMobileBarForUser />
      <main className={`mx-auto w-full max-w-lg flex-1 px-4 py-4 ${pelnyEkran ? 'flex min-h-0 flex-col overflow-hidden' : ''}`}>
        {stan === 'ladowanie' ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : stan === 'brak' ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-ink">Nie ma takiej ekipy</p>
            <Link href="/rozmowy" className="mt-3 inline-block text-sm font-semibold text-primary-700 hover:underline">
              Wróć do rozmów
            </Link>
          </div>
        ) : stan === 'obcy' ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-ink">Rozmowa jest dla członków ekipy</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
              Dołącz do ekipy, żeby zobaczyć, o czym piszą.
            </p>
            <Link
              href={group ? `/grupy/${group.id}` : '/grupy'}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-primary-700 px-4 text-sm font-semibold text-white transition hover:bg-primary-800"
            >
              {group ? 'Zobacz ekipę' : 'Twoje ekipy'}
            </Link>
          </div>
        ) : group && perms ? (
          <>
            <HideBottomNav />
            <NaglowekRozmowy
              tytul={group.name}
              podtytul="Otwórz ekipę"
              href={`/grupy/${group.id}`}
              awatar={group.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={group.coverImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-white">{group.sport ? sportEmoji(group.sport) : '👥'}</span>
              )}
            />
            {/* Ten sam zabieg co na stronie ekipy: `min-h-0 flex-1` jest
                jedynym elementem, który może jeszcze rosnąć w stałej
                wysokości ekranu, a wcięcie na pasek gestów znika razem
                z otwarciem klawiatury, bo pasek chowa się wtedy za nią. */}
            <div className={`mt-2 min-h-0 flex-1 ${okno.klawiatura ? '' : 'pb-[max(0.25rem,calc(env(safe-area-inset-bottom)_-_1rem))]'}`}>
              <RozmowaGrupy groupId={group.id} permissions={perms} klawiatura={okno.klawiatura} />
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
