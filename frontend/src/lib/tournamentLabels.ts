import type { MatchStage, PlayerPosition, TeamStatus, TournamentStatus } from '@/types';

export const POSITION_LABELS: Record<PlayerPosition, string> = {
  bramkarz: 'Bramkarz',
  obrońca: 'Obrońca',
  pomocnik: 'Pomocnik',
  napastnik: 'Napastnik',
  uniwersalny: 'Uniwersalny',
};

/** Short tag used on squad chips. */
export const POSITION_SHORT: Record<PlayerPosition, string> = {
  bramkarz: 'BR',
  obrońca: 'OB',
  pomocnik: 'PM',
  napastnik: 'NA',
  uniwersalny: 'UN',
};

/** Tailwind colour classes per position (chip styling). */
export const POSITION_TONE: Record<PlayerPosition, string> = {
  bramkarz: 'bg-amber-100 text-amber-800',
  obrońca: 'bg-secondary-100 text-secondary-800',
  pomocnik: 'bg-primary-100 text-primary-800',
  napastnik: 'bg-rose-100 text-rose-700',
  uniwersalny: 'bg-slate-100 text-slate-600',
};

export const STAGE_LABELS: Record<MatchStage, string> = {
  group: 'Faza grupowa',
  round_of_32: '1/16 finału',
  round_of_16: '1/8 finału',
  quarter: 'Ćwierćfinał',
  semi: 'Półfinał',
  third_place: 'Mecz o 3. miejsce',
  final: 'Finał',
};

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: 'W przygotowaniu',
  registration: 'Trwa rejestracja',
  group_stage: 'Faza grupowa',
  knockout: 'Faza pucharowa',
  finals: 'Finały',
  completed: 'Zakończony',
};

export const TEAM_STATUS_LABELS: Record<TeamStatus, string> = {
  pending: 'Oczekuje',
  confirmed: 'Potwierdzona',
  rejected: 'Odrzucona',
  eliminated: 'Odpadła',
  withdrawn: 'Wycofana',
};

export const DAY_NAMES = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'];
export const DAY_NAMES_FULL = [
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
  'Sobota',
  'Niedziela',
];

/** Format the ISO day numbers (1=Mon…7=Sun) as a short Polish list. */
export function formatDays(days: number[]): string {
  if (!days.length) return 'dowolny dzień';
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d - 1] ?? '?')
    .join(', ');
}

export const ALL_POSITIONS: PlayerPosition[] = [
  'bramkarz',
  'obrońca',
  'pomocnik',
  'napastnik',
  'uniwersalny',
];
