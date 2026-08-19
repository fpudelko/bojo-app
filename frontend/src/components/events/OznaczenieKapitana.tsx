/**
 * Oznaczenie kapitana drużyny: litera „c" w okręgu.
 *
 * DLACZEGO TAK, A NIE GWIAZDKA: gwiazdka nie mówi, co znaczy — trzeba wiedzieć
 * z góry albo trafić w podpowiedź, której na telefonie nie ma. Opaska kapitana
 * z „c" to oznaczenie z koszulki: czyta się bez tłumaczenia i w piłce, i w hali.
 *
 * DLACZEGO OKRĄG, A NIE `(c)`: w tej skali nawiasy zlewają się z resztą wiersza
 * (nazwisko, 🧤, liczba goli) i giną. Okrąg jest kształtem, więc widać go
 * kątem oka — a jednocześnie zajmuje mniej miejsca niż napis „kpt".
 *
 * Jedno miejsce dla całej aplikacji, żeby to samo nie wyglądało inaczej na
 * liście składów niż na liście uczestników — tak właśnie było, zanim to
 * powstało.
 */
export default function OznaczenieKapitana() {
  return (
    <span
      title="Kapitan"
      aria-label="Kapitan"
      className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border border-amber-400 bg-amber-50 text-[9px] font-bold leading-none text-amber-700"
    >
      c
    </span>
  );
}
