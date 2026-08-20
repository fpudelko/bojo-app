// Treść /graj/[sport]/[miasto] — jedyne miasto dziś to Poznań (jedyne z realnym
// pokryciem katalogu i ruchem, patrz docs/wizja.md). Rozszerzenie na kolejne
// miasta to decyzja produktowa, nie cichy dopisek tutaj.
//
// Kroki zakładania meczu i zastrzeżenie "czego Bojo nie robi" są importowane
// z content/jakDziala.ts zamiast przepisywane — jedno źródło prawdy, testy
// tresciStron.test.ts pilnują obu miejsc naraz.

export interface OdmianaSportu {
  slug: string;
  /** Forma po "graj w" — biernik: "piłkę nożną", nie mianownik "piłka nożna". */
  biernik: string;
  /** Forma po "mecz"/"boiska do" — dopełniacz: "piłki nożnej". */
  dopelniacz: string;
}

export const SPORT_ODMIANA: readonly OdmianaSportu[] = [
  { slug: 'pilka-nozna', biernik: 'piłkę nożną', dopelniacz: 'piłki nożnej' },
  { slug: 'siatkowka', biernik: 'siatkówkę', dopelniacz: 'siatkówki' },
  { slug: 'siatkowka-plazowa', biernik: 'siatkówkę plażową', dopelniacz: 'siatkówki plażowej' },
  { slug: 'koszykowka', biernik: 'koszykówkę', dopelniacz: 'koszykówki' },
];

export const GRAJ_LEAD =
  'Dołącz do otwartego meczu w okolicy albo stwórz własny i zaproś graczy, ' +
  'których jeszcze nie znasz.';

/** Gdy lista otwartych meczów jest pusta — uczciwe zastrzeżenie, ten sam ton
 *  co content/dlaczego.ts#wczesny-etap, nie desperackie domalowywanie ruchu. */
export const GRAJ_BRAK_MECZY =
  'Otwartych meczów bywa tu dziś niewiele — najpewniejszy skład zbierzesz, ' +
  'zapraszając własną ekipę linkiem. Mecz publiczny to dodatkowa szansa na ' +
  'dobranie kogoś nowego, nie gwarancja kompletu.';
