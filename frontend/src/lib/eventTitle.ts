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

/**
 * Nazwa meczu w interfejsie: SPORT I SKŁAD, nigdy tytuł wpisany przez
 * organizatora — od 2026-09-27, decyzja właściciela („usuń tytuły, po co to").
 *
 * Tytuł był opcjonalny, więc połowa meczów i tak nazywała się „Piłka nożna
 * 7v7", a druga połowa „Czwartkowa gierka", czyli tym, co już mówi data.
 * Mecz rozpoznaje się po TERMINIE i MIEJSCU; karty i strona meczu stawiają je
 * na pierwszym planie, a ta nazwa jest dopiskiem „co".
 *
 * `title` zostaje w sygnaturze i w bazie (`events.title`), żeby nie ruszać
 * kilkunastu wywołań ani danych — funkcja go po prostu nie czyta. Pole zniknęło
 * z kreatora i edycji, więc nowe mecze mają `title = null`, a powiadomienia
 * liczone w bazie (`coalesce(title, sport)`) mówią wtedy nazwą sportu.
 */
export function eventDisplayTitle(e: { title?: string | null; sport: string; maxPlayers: number }): string {
  return defaultEventTitle(e.sport, e.maxPlayers);
}
