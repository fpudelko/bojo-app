// Karta pojedynczego meczu terminarza — używana na publicznej stronie turnieju
// (zakładka Terminarz) i w panelu organizatora. Reużywana dalej przy drabince
// i stronie drużyny (Etap 2/3), stąd osobny plik zamiast JSX wprost w kliencie.
import { Clock, MapPin } from 'lucide-react';
import { STATUS_MECZU, terminMeczuNaKarcie, etykietaFazyMeczu } from '@/lib/turniejEtykiety';
import { czyWolnyLos, stronaZwyciezcy } from '@/lib/turniejWynik';
import { nazwaMiejscaWGrupie } from '@/lib/turniejFormat';
import type { TurniejGrupa, TurniejMecz } from '@/types';

export function nazwaSlotu(
  mecz: TurniejMecz,
  strona: 'a' | 'b',
  druzynyPoId: Map<string, string>,
  meczePoId: Map<string, TurniejMecz>,
  grupyPoId?: ReadonlyMap<string, TurniejGrupa>,
): string {
  const druzynaId = strona === 'a' ? mecz.druzynaAId : mecz.druzynaBId;
  if (druzynaId) return druzynyPoId.get(druzynaId) ?? '-';

  // Miejsce z grupy (175): „Zwycięzca A", dopóki grupa A się nie rozstrzygnie.
  const grupaId = strona === 'a' ? mecz.zrodloAGrupaId : mecz.zrodloBGrupaId;
  const miejsce = strona === 'a' ? mecz.zrodloAMiejsce : mecz.zrodloBMiejsce;
  if (grupaId && miejsce) {
    const nazwaGrupy = grupyPoId?.get(grupaId)?.nazwa;
    return nazwaGrupy ? nazwaMiejscaWGrupie(nazwaGrupy, miejsce) : `${miejsce}. miejsce w grupie`;
  }

  const zrodloId = strona === 'a' ? mecz.zrodloAMeczId : mecz.zrodloBMeczId;
  const zrodloTyp = strona === 'a' ? mecz.zrodloATyp : mecz.zrodloBTyp;
  const etykietaTyp = zrodloTyp === 'przegrany' ? 'Przegrany' : 'Zwycięzca';
  if (!zrodloId) return 'TBD';
  const zrodlo = meczePoId.get(zrodloId);
  return zrodlo ? `${etykietaTyp} meczu M${zrodlo.numer}` : etykietaTyp;
}

export interface KartaMeczuProps {
  mecz: TurniejMecz;
  druzynyPoId: Map<string, string>;
  meczePoId: Map<string, TurniejMecz>;
  arenyPoId: Map<string, string>;
  /** Grupy po id: podpis „Zwycięzca A" przy miejscu z grupy i „Grupa A" w nagłówku. */
  grupyPoId?: ReadonlyMap<string, TurniejGrupa>;
  /** Wyszarza kartę — używane dla wolnych losów bez czasu w terminarzu. */
  przygaszona?: boolean;
  onClick?: () => void;
}

export default function KartaMeczu({ mecz, druzynyPoId, meczePoId, arenyPoId, grupyPoId, przygaszona, onClick }: KartaMeczuProps) {
  // Wolny los to nie walkower: nikt nie przyszedł, bo nie miał kto. Karta
  // mówiła wcześniej „Walkower · Chaos United 0:0 TBD", co organizator
  // przeczytał jako mecz, który już się odbył (turniej pokazowy, 2026-11-08).
  const wolnyLos = czyWolnyLos(mecz);
  const nazwaA = wolnyLos && !mecz.druzynaAId ? 'awans bez gry' : nazwaSlotu(mecz, 'a', druzynyPoId, meczePoId, grupyPoId);
  const nazwaB = wolnyLos && !mecz.druzynaBId ? 'awans bez gry' : nazwaSlotu(mecz, 'b', druzynyPoId, meczePoId, grupyPoId);
  const status = wolnyLos ? { label: 'Wolny los', ton: 'bg-slate-100 text-slate-500' } : STATUS_MECZU[mecz.status];
  const rozegrany = !wolnyLos && (mecz.status === 'zakonczony' || mecz.status === 'walkower' || mecz.status === 'trwa');
  // Termin rozbity jak na zwykłej karcie meczu (`EventBrowseCard`): zegar,
  // dzień skrótem i godzina. Godzina jest na hali najważniejszą informacją
  // karty, więc dostaje zieloną plakietkę; szary wiersz „sob. 28 listopada,
  // 08:30” zlewał się z resztą (uwaga właściciela 2026-11-20).
  // Po meczu kafelek gaśnie do szarości (krawędź, godzina): na liście
  // czterdziestu meczów oko ma trafić na te, które jeszcze przed nami.
  const poMeczu = wolnyLos || mecz.status === 'zakonczony' || mecz.status === 'walkower' || mecz.status === 'odwolany';
  const termin = mecz.zaplanowanyAt ? terminMeczuNaKarcie(mecz.zaplanowanyAt) : null;
  const arena = mecz.arenaId ? arenyPoId.get(mecz.arenaId) : undefined;

  // Kto wygrał, widać po WADZE PISMA, nie po samym wyniku. Bez tego drabinka
  // każe czytającemu porównywać dwie liczby przy każdym meczu z osobna —
  // a przy walkowerze (0:0) i karnych (1:1) porównanie daje złą odpowiedź.
  const zwyciezca = rozegrany && mecz.status !== 'trwa' ? stronaZwyciezcy(mecz) : null;
  const pustaStronaLosu = (strona: 'a' | 'b') =>
    wolnyLos && !(strona === 'a' ? mecz.druzynaAId : mecz.druzynaBId);
  const tonDruzyny = (strona: 'a' | 'b') =>
    pustaStronaLosu(strona) ? 'font-normal italic text-slate-400'
      : zwyciezca === strona ? 'font-semibold text-ink'
      : zwyciezca ? 'font-medium text-slate-400'
      : 'font-medium text-ink';
  const karne = mecz.karneA !== undefined && mecz.karneB !== undefined
    ? `k. ${mecz.karneA}:${mecz.karneB}`
    : null;

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={[
        // Krawędź po lewej i cień jak na zwykłej karcie meczu: kafelek
        // turnieju ma się czytać jak „mecz w Bojo”, nie jak wiersz tabeli.
        'block w-full rounded-2xl border-l-4 bg-white p-3.5 text-left ring-1 ring-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:bg-slate-800 dark:ring-slate-700',
        poMeczu ? 'border-l-slate-300 dark:border-l-slate-600' : 'border-l-primary-600',
        onClick ? 'transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] active:scale-[0.995]' : '',
        przygaszona ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Tekst pomocniczy slate-500 / dark slate-300: przy slate-400 numer
          i godzina miały 2,6:1 (audyt wyglądu 2026-11-19, minimum AA 4,5:1). */}
      {/* GÓRNY WIERSZ: co to za mecz, gdzie i kiedy (2026-11-21). Termin
          i boisko stały w osobnym, trzecim wierszu pod drużynami; karta była
          przez to wysoka i ciężka na dole. Teraz: po lewej numer, grupa
          i boisko, po prawej dzień i godzina na zielonej plakietce, a pod
          spodem tylko drużyny. Stan („Na żywo”, „Walkower”) wypiera godzinę:
          w tej chwili to on odpowiada na pytanie „co z tym meczem”. */}
      <div className="flex min-h-[24px] items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-300">
        <span className="min-w-0 truncate">
          <span className="font-medium">M{mecz.numer} · {etykietaFazyMeczu(mecz, grupyPoId)}</span>
          {arena && (
            <span className="ml-1 inline-flex items-center gap-0.5 align-middle">
              <MapPin className="h-3 w-3 shrink-0" />{arena}
            </span>
          )}
        </span>
        {(wolnyLos || (mecz.status !== 'zaplanowany' && mecz.status !== 'zakonczony')) ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${status.ton}`}>{status.label}</span>
        ) : termin ? (
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <span className="font-medium text-slate-600 dark:text-slate-300">{termin.dzien}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-bold ${
                poMeczu ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
                  : 'bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300'
              }`}
            >
              <Clock className="h-3.5 w-3.5" /> {termin.godzina}
            </span>
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        {/* Dwie linie zamiast wielokropka: „Unilink Szamotuły & MedKomplex”
            ucięte do „Unilink Sza…” nie da się rozpoznać przy boisku (F4). */}
        <span className={`min-w-0 flex-1 line-clamp-2 break-words text-base leading-snug ${tonDruzyny('a')}`}>{nazwaA}</span>
        {rozegrany ? (
          <span className="shrink-0 text-center">
            <span className="block font-mono text-base font-semibold text-ink">{mecz.wynikA}:{mecz.wynikB}</span>
            {karne && <span className="block font-mono text-[10px] leading-tight text-slate-400">{karne}</span>}
          </span>
        ) : wolnyLos ? null : (
          <span className="shrink-0 text-xs text-slate-500 dark:text-slate-300">vs</span>
        )}
        <span className={`min-w-0 flex-1 line-clamp-2 break-words text-right text-base leading-snug ${tonDruzyny('b')}`}>{nazwaB}</span>
      </div>
    </Wrapper>
  );
}
