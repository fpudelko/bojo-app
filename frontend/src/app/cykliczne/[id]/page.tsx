import { redirect } from 'next/navigation';

// Gry cykliczne usunięte całkowicie (decyzja właściciela, runda 9) — patrz
// AGENTS.md, „Zanim uznasz, że funkcja nie istnieje". Trasa zostaje jako
// przekierowanie na jeden release, żeby stare linki (zakładki, powiadomienia)
// nie kończyły się błędem 404.
export default function CykliczneSzczegolyRedirect() {
  redirect('/moje-gry');
}
