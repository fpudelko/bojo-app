/**
 * Kwota w groszach jako „20,00 zł”. Jedyny format kwoty w interfejsie
 * i w tekstach do udostępnienia (W-5, docs/faza1-przejscie-e2e-plan.md).
 *
 * Wcześniej ta sama kwota chodziła w trzech zapisach: „20.00 PLN” w panelu
 * „Podział kosztów”, „20.00 zł” w oknie zapisu i „20,00 zł” w wiadomości
 * „Wyślij rozliczenie ekipie”. Organizator porównywał panel z tym, co wysłał
 * na czat, i widział dwie różne liczby w dwóch walutach.
 *
 * Plakietka „20 zł / os.” na kartach meczu zostaje: to celowy skrót. Pola
 * formularzy (`input`) zostają liczbami.
 */
export function zl(grosze: number): string {
  return `${(grosze / 100).toFixed(2).replace('.', ',')} zł`;
}
