/** Spis treści jako natywny `<details>` — zero JS, jeden układ na każdej
 *  szerokości, mieści się na 320 px. Domyślnie zwinięty na telefonie
 *  (`open` tylko od `sm:` przez CSS byłoby złudne — `<details>` nie ma
 *  wariantu responsywnego dla `open`, więc zostaje zwinięty wszędzie i to
 *  jest w porządku: to nawigacja pomocnicza, nie treść). */
export default function SpisTresci({ pozycje }: { pozycje: { id: string; label: string }[] }) {
  return (
    <details className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 dark:border-slate-700/80 dark:bg-slate-800">
      <summary className="cursor-pointer text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        Spis treści
      </summary>
      <nav aria-label="Spis treści" className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-700">
        {pozycje.map((p) => (
          <a
            key={p.id}
            href={`#${p.id}`}
            className="block text-sm text-primary-700 hover:underline"
          >
            {p.label}
          </a>
        ))}
      </nav>
    </details>
  );
}
