import Link from 'next/link';
import { SHOW_RECURRING } from '@/lib/features';

export default function SiteFooter() {
  return (
    <footer className="bg-slate-900 px-4 py-10 text-slate-400">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 md:flex-row">
        <p className="text-sm font-semibold text-white">Bojo · Poznań i okolice</p>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
          <Link href="/wydarzenia" className="transition-colors hover:text-white">Znajdź mecz</Link>
          <Link href="/wydarzenia/nowe" className="transition-colors hover:text-white">Zorganizuj mecz</Link>
          <Link href="/mapa" className="transition-colors hover:text-white">Mapa boisk</Link>
          <Link href="/grupy" className="transition-colors hover:text-white">Grupy</Link>
          {SHOW_RECURRING && (
            <Link href="/cykliczne" className="transition-colors hover:text-white">Stałe gierki</Link>
          )}
          <span className="hidden text-slate-600 md:inline">·</span>
          <Link href="/prywatnosc" className="text-slate-500 transition-colors hover:text-white">Prywatność</Link>
          <Link href="/regulamin" className="text-slate-500 transition-colors hover:text-white">Regulamin</Link>
        </div>
      </div>
    </footer>
  );
}
