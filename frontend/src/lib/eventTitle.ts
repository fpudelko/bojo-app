// Default event title — what a match is called when the organizer left the
// title blank. Previously reimplemented five times across the codebase with
// three different results (EventBrowseCard used the raw sport string,
// GameFeedCard used sportLabel, EventListCard used its own abbreviations).
// One copy here so the wizard's placeholder promises exactly what the cards
// will actually show.
import { sportLabel } from './sports';

/** " 7v7" for an even squad size, " · 9 os." for an odd one, "" when unknown. */
export function squadSuffix(maxPlayers: number): string {
  if (!maxPlayers || maxPlayers <= 0) return '';
  if (maxPlayers % 2 === 0) return ` ${maxPlayers / 2}v${maxPlayers / 2}`;
  return ` · ${maxPlayers} os.`;
}

export function defaultEventTitle(sport: string, maxPlayers: number): string {
  return `${sportLabel(sport)}${squadSuffix(maxPlayers)}`;
}

export function eventDisplayTitle(e: { title?: string | null; sport: string; maxPlayers: number }): string {
  return e.title?.trim() || defaultEventTitle(e.sport, e.maxPlayers);
}
