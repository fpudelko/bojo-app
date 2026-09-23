import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { withCount } from './plural';

/**
 * Czy opis od organizatora nadaje się na opis linku.
 *
 * POWÓD, DLA KTÓREGO TA FUNKCJA ISTNIEJE: do 2026-09-23 opis linku brał
 * `turnieje.opis` wprost. Na produkcji dało to podgląd na WhatsAppie o treści
 * „[TUR] SPRAWDŹ: plakietka „Na żywo" na karcie meczu…", czyli wewnętrzną
 * notatkę z seedu, pokazaną dwudziestu kapitanom jako pierwsza rzecz o
 * turnieju. Jedno zdanie, które załatwia wrażenie „projekt weekendowy".
 *
 * Odrzucamy treść zaczynającą się od znacznika w nawiasie kwadratowym (tak
 * wyglądają WSZYSTKIE markery seedowe: [TUR], [REG], [TEST]…) oraz notatki
 * zaczynające się od „SPRAWDŹ". Nie próbujemy być mądrzejsi: opis pisany przez
 * człowieka do ludzi nie zaczyna się w ten sposób.
 */
export function opisNadajeSie(opis: string | null | undefined): boolean {
  const t = opis?.trim();
  if (!t) return false;
  if (t.startsWith('[')) return false;
  if (/^SPRAWDŹ/i.test(t)) return false;
  return true;
}

/**
 * Opis linku budowany z DANYCH turnieju, nie z pola tekstowego.
 *
 * Kolejność jest celowa: kapitan czytający podgląd w komunikatorze decyduje
 * w tej kolejności — co to za sport i jaka skala, ile mnie to kosztuje, kiedy
 * i gdzie. Opis od organizatora dochodzi na końcu i tylko jako dopowiedzenie,
 * bo to dane rozstrzygają, a nie zachęta.
 */
export function opisTurnieju(t: {
  sport: string;
  max_druzyn: number;
  wpisowe_grosz: number | null;
  data_startu: string;
  godzina_startu: string | null;
  miejsce_nazwa: string | null;
  miasto: string | null;
  opis: string | null;
}): string {
  const czesci: string[] = [];

  const skala = withCount(t.max_druzyn, 'drużyna', 'drużyny', 'drużyn');
  czesci.push(`${t.sport}, ${skala}`);

  czesci.push(
    t.wpisowe_grosz && t.wpisowe_grosz > 0
      ? `wpisowe ${Math.round(t.wpisowe_grosz / 100)} zł od drużyny`
      : 'bez wpisowego',
  );

  let kiedy = '';
  try {
    kiedy = format(parseISO(t.data_startu), 'd MMMM', { locale: pl });
  } catch { kiedy = t.data_startu; }
  const godzina = t.godzina_startu ? String(t.godzina_startu).slice(0, 5) : '';
  czesci.push(`start ${kiedy}${godzina ? ` o ${godzina}` : ''}`);

  const miejsce = t.miejsce_nazwa || t.miasto;
  if (miejsce) czesci.push(miejsce);

  const zDanych = `${czesci.join('. ')}.`;
  // Pierwsze zdanie musi obronić się samo, bo niektóre komunikatory ucinają
  // opis po kilkudziesięciu znakach.
  return opisNadajeSie(t.opis) ? `${zDanych} ${t.opis!.trim()}` : zDanych;
}
