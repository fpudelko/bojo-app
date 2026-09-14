// Etykiety statusów, formatów i faz turnieju — jedno miejsce, żeby ta sama
// wartość bazy nie doczekała się dwóch różnych podpisów w dwóch komponentach.
// Wzorem `lib/teamLabels.ts` i `lib/tournamentLabels.ts` (usunięte razem ze
// starym modułem — to jest ich duchowy następca, inny kształt danych).

import { withCount } from './plural';
import type { DruzynaStatus, MeczFaza, MeczStatus, TurniejFormat, TurniejStatus, Turniej } from '@/types';

export const STATUS_TURNIEJU: Record<TurniejStatus, { label: string; ton: string }> = {
  szkic:            { label: 'W przygotowaniu', ton: 'bg-slate-100 text-slate-600' },
  zapisy:           { label: 'Trwają zapisy',   ton: 'bg-primary-50 text-primary-700' },
  // Ten sam szary i to samo znaczenie co „Zapisy zamknięte" przy meczu
  // (`lib/stanZapisow.ts`, migracja `141`) — „ta droga jest zamknięta, nic
  // się nie zepsuło", nie czerwień („coś poszło źle") ani błękit (zajęty przez
  // „wymaga akceptacji" i komplet). Patrz AGENTS.md, sekcja o kolorystyce.
  zamkniete_zapisy: { label: 'Zapisy zamknięte', ton: 'bg-slate-100 text-slate-600' },
  trwa:             { label: 'Trwa',             ton: 'bg-primary-50 text-primary-700' },
  zakonczony:       { label: 'Zakończony',       ton: 'bg-slate-100 text-slate-600' },
  odwolany:         { label: 'Odwołany',         ton: 'bg-red-50 text-red-600' },
};

export const STATUS_DRUZYNY: Record<DruzynaStatus, { label: string; ton: string }> = {
  // Niebieski jak wszędzie w tej apce: „wymaga akceptacji uczestnictwa"
  // (organizator ma decyzję do podjęcia), nie inny odcień znaczenia.
  zgloszona: { label: 'Czeka na przyjęcie', ton: 'bg-blue-50 text-blue-600' },
  przyjeta:  { label: 'W turnieju',         ton: 'bg-primary-50 text-primary-700' },
  rezerwa:   { label: 'Rezerwa',            ton: 'bg-slate-100 text-slate-600' },
  odrzucona: { label: 'Nieprzyjęta',        ton: 'bg-slate-100 text-slate-600' },
  wycofana:  { label: 'Wycofana',           ton: 'bg-slate-100 text-slate-600' },
};

export const STATUS_MECZU: Record<MeczStatus, { label: string; ton: string }> = {
  zaplanowany: { label: 'Zaplanowany', ton: 'bg-slate-100 text-slate-500' },
  // Zielony jak licznik meczów w dolnej nawigacji: to STAN, nie zdarzenie
  // wymagające reakcji — nie błękit (zajęty przez „wymaga akceptacji").
  trwa:        { label: 'Na żywo',     ton: 'bg-primary-50 text-primary-700' },
  zakonczony:  { label: 'Zakończony',  ton: 'bg-slate-100 text-slate-500' },
  walkower:    { label: 'Walkower',    ton: 'bg-slate-100 text-slate-500' },
  odwolany:    { label: 'Odwołany',    ton: 'bg-red-50 text-red-600' },
};

export const FORMAT_LABEL: Record<TurniejFormat, string> = {
  grupy_puchar: 'Grupy → puchar',
  puchar:       'Puchar',
  liga:         'Liga',
};

export const FORMAT_OPIS: Record<TurniejFormat, string> = {
  grupy_puchar: 'Drużyny grają najpierw w grupach, dwie najlepsze z każdej awansują do drabinki pucharowej.',
  puchar:       'Od razu drabinka pucharowa — przegrana kończy udział w turnieju.',
  liga:         'Każdy z każdym, bez fazy pucharowej — liczy się tylko tabela.',
};

export const FAZA_LABEL: Record<MeczFaza, string> = {
  grupa:        'Faza grupowa',
  liga:         'Liga',
  '1/32':       '1/32 finału',
  '1/16':       '1/16 finału',
  '1/8':        '1/8 finału',
  cwierc:       'Ćwierćfinał',
  polfinal:     'Półfinał',
  o_3_miejsce:  'Mecz o 3. miejsce',
  final:        'Finał',
};

/** Zdanie po ludzku pod nazwą formatu w kreatorze i na stronie turnieju. */
export function opisFormatu(t: Pick<Turniej, 'format'>, liczbaDruzyn: number): string {
  const baza = FORMAT_OPIS[t.format];
  if (t.format === 'liga') {
    return `${baza} ${odmienDruzyny(liczbaDruzyn)} gra między sobą.`;
  }
  return baza;
}

export function odmienDruzyny(n: number): string {
  return withCount(n, 'drużyna', 'drużyny', 'drużyn');
}

// Rzeczownik męskoosobowy — ta sama odmiana co „gracz" (`EventBrowseCard.tsx`):
// 1 zawodnik, 2-4 zawodnicy, 5+/12-14 zawodników.
export function odmienZawodnikow(n: number): string {
  return withCount(n, 'zawodnik', 'zawodnicy', 'zawodników');
}
