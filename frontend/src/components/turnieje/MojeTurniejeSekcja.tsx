'use client';

// „Twoje turnieje” na `/moje-gry` (2026-11-22, prośba właściciela): turniej,
// w którego drużynie grasz, który organizujesz albo obserwujesz, stoi na
// koncie jako karta, nie tylko jako wejście „🏆 Turnieje”. Bez turniejów
// zostaje samo wejście (dla tych, którzy w ogóle widzą moduł).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getMojeTurniejeZRola, turniejeNaMojeMecze, type MojTurniej } from '@/lib/turnieje';
import { terazWPolsce } from '@/lib/czasPolski';
import KartaTurnieju from './KartaTurnieju';

export default function MojeTurniejeSekcja({ userId, pokazWejscie }: { userId: string | null; pokazWejscie: boolean }) {
  const [moje, setMoje] = useState<MojTurniej[]>([]);

  useEffect(() => {
    if (!userId) { setMoje([]); return; }
    let aktualne = true;
    getMojeTurniejeZRola(userId)
      .then((lista) => { if (aktualne) setMoje(turniejeNaMojeMecze(lista, terazWPolsce().data)); })
      .catch(() => { if (aktualne) setMoje([]); });
    return () => { aktualne = false; };
  }, [userId]);

  if (moje.length === 0 && !pokazWejscie) return null;

  return (
    <section className="space-y-2" aria-label="Twoje turnieje">
      {moje.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-ink">Twoje turnieje</h2>
          {moje.map((m) => <KartaTurnieju key={m.turniej.id} t={m.turniej} rola={m.rola} druzyna={m.druzyna} />)}
        </>
      )}
      <Link prefetch={false}
        href="/turnieje"
        className="flex items-center justify-between rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 px-4 py-3.5 shadow-sm hover:border-primary-200 hover:shadow-md transition-all group"
      >
        <span className="text-sm font-semibold text-ink">🏆 {moje.length > 0 ? 'Wszystkie turnieje' : 'Turnieje'}</span>
        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary-600 transition-colors" />
      </Link>
    </section>
  );
}
