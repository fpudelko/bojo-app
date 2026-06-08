import Link from 'next/link';

/**
 * Community / social-proof bar shown under the hero.
 * Numbers kept honest — no fake user counts. Frames the product as early-stage
 * ("bądź wśród pierwszych") instead of claiming a crowd that isn't there yet.
 */
export default function TrustBar() {
  return (
    <section className="border-y border-slate-200/70 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-5 text-sm">
        <div className="flex items-center gap-3">
          {/* Decorative avatar stack — brand-coloured, no fake photos */}
          <div className="flex -space-x-2" aria-hidden="true">
            {['bg-primary-300', 'bg-primary-500', 'bg-primary-700', 'bg-accent-500', 'bg-primary-400'].map((c, i) => (
              <span key={i} className={`h-7 w-7 rounded-full border-2 border-white ${c}`} />
            ))}
          </div>
          <p className="text-slate-600">
            <span className="font-semibold text-ink">Bądź wśród pierwszych graczy</span>{' '}
            w Poznaniu
          </p>
        </div>

        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-600">
          <li><strong className="text-ink">Setki</strong> boisk w bazie</li>
          <li><strong className="text-ink">5</strong> dyscyplin</li>
          <li><strong className="text-ink">Poznań</strong> i okolice</li>
          <li>
            <Link href="/turniej" className="font-semibold text-primary-700 underline-offset-2 hover:underline">
              BOJO Cup
            </Link>{' '}
            — zapisy otwarte
          </li>
        </ul>
      </div>
    </section>
  );
}
