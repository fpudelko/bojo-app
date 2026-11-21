// Mecz turnieju w JEDNYM wierszu, przyszły i rozegrany tak samo (decyzja
// właściciela z 2026-11-21): znacznik grupy albo fazy, mała data nad większą
// godziną, drużyny, wynik albo „vs”, a boisko tylko wtedy, gdy turniej ma
// ich kilka. Wszystko inne (strzelcy, przebieg, kartki) jest na stronie
// meczu: wiersz jest do niej odnośnikiem.
//
// Wcześniej były dwa wzory: trzywierszowa karta dla meczów przed nami
// i rozwijany wiersz dla wyników. Lista trzydziestu meczów turnieju czytała
// się jak dwa różne ekrany sklejone w jeden.
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { terminMeczuNaKarcie, znacznikFazy } from '@/lib/turniejEtykiety';
import { chwilaWPolsce } from '@/lib/czasPolski';
import { czyWolnyLos, stronaZwyciezcy } from '@/lib/turniejWynik';
import { nazwaSlotu } from './KartaMeczu';
import type { TurniejGrupa, TurniejMecz } from '@/types';

export default function WierszMeczu({
  mecz, href, druzynyPoId, meczePoId, arenyPoId, grupyPoId, pokazBoisko,
}: {
  mecz: TurniejMecz;
  href: string;
  druzynyPoId: Map<string, string>;
  meczePoId: Map<string, TurniejMecz>;
  arenyPoId: ReadonlyMap<string, string>;
  grupyPoId?: ReadonlyMap<string, TurniejGrupa>;
  /** Boisko tylko przy kilku boiskach: przy jednym powtarzałoby się przy każdym meczu. */
  pokazBoisko: boolean;
}) {
  const wolnyLos = czyWolnyLos(mecz);
  const nazwaA = wolnyLos && !mecz.druzynaAId ? 'awans bez gry' : nazwaSlotu(mecz, 'a', druzynyPoId, meczePoId, grupyPoId);
  const nazwaB = wolnyLos && !mecz.druzynaBId ? 'awans bez gry' : nazwaSlotu(mecz, 'b', druzynyPoId, meczePoId, grupyPoId);
  const naZywo = mecz.status === 'trwa';
  const rozegrany = !wolnyLos && (mecz.status === 'zakonczony' || mecz.status === 'walkower');
  const zwyciezca = rozegrany ? stronaZwyciezcy(mecz) : null;
  const ton = (strona: 'a' | 'b') =>
    zwyciezca === strona ? 'font-semibold text-ink' : zwyciezca ? 'text-slate-500 dark:text-slate-400' : 'text-ink';
  const termin = mecz.zaplanowanyAt ? terminMeczuNaKarcie(mecz.zaplanowanyAt) : null;
  // Mała data w jednej linijce nad godziną: „28.11” albo „Dziś”, „Jutro”.
  const krotkaData = mecz.zaplanowanyAt && termin
    ? (/^(Dziś|Jutro|Wczoraj)$/.test(termin.dzien)
        ? termin.dzien
        : chwilaWPolsce(mecz.zaplanowanyAt).data.slice(5).split('-').reverse().join('.'))
    : null;
  const boisko = pokazBoisko && mecz.arenaId ? arenyPoId.get(mecz.arenaId) : undefined;
  const karne = mecz.karneA !== undefined && mecz.karneB !== undefined ? `k. ${mecz.karneA}:${mecz.karneB}` : null;

  return (
    <Link
      href={href}
      className={[
        'flex min-h-[52px] items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700',
        // Lewa krawędź jak na karcie meczu: zielona przed meczem i na żywo,
        // szara po meczu. Oko trafia na to, co jeszcze przed nami.
        rozegrany || wolnyLos ? 'border-l-4 border-l-slate-300 dark:border-l-slate-600' : 'border-l-4 border-l-primary-600',
        wolnyLos ? 'opacity-60' : '',
      ].join(' ')}
    >
      <span className="flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-md bg-slate-100 px-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
        {znacznikFazy(mecz, grupyPoId)}
      </span>
      <span className="w-11 shrink-0 text-center leading-tight">
        {naZywo ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 dark:text-primary-300">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-600" /> żywo
          </span>
        ) : termin ? (
          <>
            <span className="block whitespace-nowrap text-[10px] text-slate-500 dark:text-slate-400">{krotkaData}</span>
            <span className={`block text-sm font-bold ${rozegrany ? 'text-slate-500 dark:text-slate-400' : 'text-ink'}`}>{termin.godzina}</span>
          </>
        ) : null}
      </span>
      <span className={`min-w-0 flex-1 truncate text-right text-sm ${ton('a')}`}>{nazwaA}</span>
      {rozegrany || naZywo ? (
        <span className="shrink-0 text-center">
          <span className="block font-mono text-sm font-bold text-ink">{mecz.wynikA}:{mecz.wynikB}</span>
          {karne && <span className="block font-mono text-[9px] leading-tight text-slate-500">{karne}</span>}
        </span>
      ) : (
        <span className="shrink-0 text-xs text-slate-400">vs</span>
      )}
      <span className={`min-w-0 flex-1 truncate text-sm ${ton('b')}`}>{nazwaB}</span>
      {boisko && (
        <span className="inline-flex max-w-[4.5rem] shrink-0 items-center gap-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
          <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{boisko}</span>
        </span>
      )}
    </Link>
  );
}
