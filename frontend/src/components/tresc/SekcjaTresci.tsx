/** Jedna sekcja strony treści: kotwica + nagłówek + treść. `scroll-mt-20`
 *  kompensuje `Header` przyklejony do góry (`sticky`, ~64px) — bez tego link
 *  ze spisu treści chowałby nagłówek sekcji pod paskiem nawigacji. */
export default function SekcjaTresci({
  id,
  tytul,
  children,
}: {
  id: string;
  tytul: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
        {tytul}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300 sm:text-[15px]">
        {children}
      </div>
    </section>
  );
}
