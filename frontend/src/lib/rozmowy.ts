import { wszystkieRozmowyMeczow, type RozmowaNaLiscie } from './comments';
import { wszystkieRozmowyGrup } from './groupPosts';
import { wszystkieRozmowyDm } from './dm';

/**
 * Jedno źródło prawdy o rozmowach: lista dla ekranu `/rozmowy` ORAZ liczba
 * nieprzeczytanych dla plakietki w dolnej nawigacji.
 *
 * DLACZEGO RAZEM. Zanim to powstało, nawigacja liczyła nieprzeczytane inaczej
 * niż ekran rozmów: `nieprzeczytaneWMeczach()` zwracało liczbę MECZÓW
 * z nieprzeczytanymi, `hasUnreadGroupMessages()` samo `true/false`, a rozmowy
 * prywatne nie były sprawdzane W OGÓLE — wskaźnik nie zapalał się od DM-a,
 * choć DM to jedyna rozmowa skierowana wprost do jednej osoby. Trzy różne
 * odpowiedzi na to samo pytanie w dwóch miejscach interfejsu to gwarantowany
 * rozjazd; plakietka z LICZBĄ nie ma prawa pokazywać czegoś innego, niż
 * człowiek zobaczy po jej dotknięciu.
 */

/** Jedna rozmowa na liście. `typ` jest po to, żeby lista nie musiała zgadywać
 *  adresu z samego id — mecz, ekipa i rozmowa prywatna mają różne trasy. */
export interface WpisRozmowy extends RozmowaNaLiscie {
  typ: 'mecz' | 'grupa' | 'dm';
  href: string;
}

/**
 * Mecze, ekipy i rozmowy prywatne w JEDNĄ listę, od najnowszej. Komunikator
 * nie pyta, skąd wiadomość przyszła — pokazuje, co się ostatnio działo.
 * Czysta funkcja, żeby dało się ją sprawdzić bez bazy i bez renderowania.
 *
 * WSZYSTKIE TRZY TRASY ZOSTAJĄ POD `/rozmowy`. Wcześniej mecz prowadził na
 * `/wydarzenia/[id]?tab=rozmowa`, a ekipa na `/grupy/[id]?tab=tablica` —
 * dotknięcie rozmowy WYRZUCAŁO z komunikatora na stronę meczu albo ekipy,
 * z paskiem zakładek, składem i zarządzaniem, a „wstecz" wracało stamtąd na
 * `/grupy` zamiast do listy rozmów (zgłoszone wprost). Kontekst ekipy i meczu
 * jest dziś ODNOŚNIKIEM w nagłówku rozmowy (`NaglowekRozmowy`), nie miejscem,
 * do którego prowadzi lista.
 */
export function polaczRozmowy(
  mecze: RozmowaNaLiscie[],
  ekipy: RozmowaNaLiscie[],
  prywatne: RozmowaNaLiscie[] = [],
): WpisRozmowy[] {
  return [
    ...mecze.map((r) => ({ ...r, typ: 'mecz' as const, href: `/rozmowy/mecz/${r.id}` })),
    ...ekipy.map((r) => ({ ...r, typ: 'grupa' as const, href: `/rozmowy/grupa/${r.id}` })),
    ...prywatne.map((r) => ({ ...r, typ: 'dm' as const, href: `/rozmowy/${r.id}` })),
  ].sort((a, b) => b.najnowsza.localeCompare(a.najnowsza));
}

/** Suma nieprzeczytanych WIADOMOŚCI (nie rozmów) — to jest liczba, którą
 *  pokazuje plakietka i nagłówek ekranu rozmów. */
export function policzNieprzeczytane(wpisy: WpisRozmowy[]): number {
  return wpisy.reduce((suma, w) => suma + w.ile, 0);
}

/** Najświeższa rozmowa z nieprzeczytanymi danego typu — wyłącznie do treści
 *  dymka („Nowa wiadomość w meczu {tytuł}"). `null`, gdy nie ma takiej. */
export function najswiezszaNieprzeczytana(
  wpisy: WpisRozmowy[],
  typ: WpisRozmowy['typ'],
): WpisRozmowy | null {
  return wpisy.find((w) => w.typ === typ && w.ile > 0) ?? null;
}

/** Wszystkie rozmowy zalogowanego, gotowe do wyświetlenia i policzenia.
 *  `grupy` przekazuje wywołujący, bo i tak ma je pod ręką — bez tego doszłoby
 *  drugie zapytanie o listę ekip przy każdej zmianie trasy. */
export async function pobierzRozmowy(
  userId: string,
  grupy: { id: string; name: string }[],
): Promise<WpisRozmowy[]> {
  const [mecze, ekipy, prywatne] = await Promise.all([
    wszystkieRozmowyMeczow(userId),
    wszystkieRozmowyGrup(userId, grupy),
    wszystkieRozmowyDm(userId),
  ]);
  return polaczRozmowy(mecze, ekipy, prywatne);
}
