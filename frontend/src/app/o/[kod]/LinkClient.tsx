'use client';

// ZAPROSZENIE DO PROWADZENIA TURNIEJU (189, 2026-11-27): organizator wysłał
// link `/o/<kod>` komuś, kto może nie mieć jeszcze konta w Bojo. Strona mówi,
// kto zaprasza, do czego i jako kto; niezalogowany idzie przez logowanie albo
// rejestrację i wraca tutaj (`?next=`). Link działa raz.
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ShieldCheck } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { displayName } from '@/lib/profileName';
import { useToast } from '@/lib/toast';
import { getZaproszenieOsoby, przyjmijZaproszenieOsoby, type ZaproszenieOsoby } from '@/lib/turnieje';

const OPIS_ROLI = {
  prowadzacy: { nazwa: 'Prowadzący mecze', co: 'Startujesz mecze, prowadzisz zegar, wpisujesz gole, kartki i wynik.' },
  wspolorganizator: { nazwa: 'Współorganizator', co: 'Możesz wszystko co organizator, poza usunięciem turnieju.' },
} as const;

export default function ZaproszenieOsobyPage() {
  const { kod } = useParams<{ kod: string }>();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [info, setInfo] = useState<ZaproszenieOsoby | null>(null);
  const [ladowanie, setLadowanie] = useState(true);
  const [wTrakcie, setWTrakcie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  useEffect(() => {
    let aktualne = true;
    getZaproszenieOsoby(kod)
      .then((i) => { if (aktualne) setInfo(i); })
      .catch((e) => { if (aktualne) setBlad(e instanceof Error ? e.message : 'Nie udało się wczytać zaproszenia'); })
      .finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
  }, [kod]);

  const ramka = (tresc: React.ReactNode) => (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header showMobileWordmark />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">{tresc}</main>
    </div>
  );

  if (ladowanie || loading) {
    return ramka(<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>);
  }

  if (!info) {
    return ramka(
      <div className="text-center">
        <p className="font-medium text-ink">{blad ?? 'Ten link już nie działa'}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Zaproszenie zostało już przyjęte albo link jest niepełny. Poproś organizatora o nowy.
        </p>
        <Link prefetch={false} href="/turnieje" className="mt-4 inline-block text-sm font-medium text-primary-600">Turnieje w Bojo</Link>
      </div>,
    );
  }

  const rola = OPIS_ROLI[info.rola];
  const przyjmij = async () => {
    setWTrakcie(true);
    setBlad(null);
    try {
      const turniejId = await przyjmijZaproszenieOsoby(kod);
      toast(`Jesteś w turnieju jako: ${rola.nazwa}`);
      router.push(`/turnieje/${turniejId}/panel`);
    } catch (e) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się przyjąć zaproszenia');
      setWTrakcie(false);
    }
  };
  const powrot = `/logowanie?next=${encodeURIComponent(`/o/${kod}`)}`;

  return ramka(
    <div className="space-y-4">
      <div className="text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-primary-600" aria-hidden />
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{info.zapraszajacy} zaprasza Cię do turnieju</p>
        <h1 className="font-display text-2xl font-bold text-ink">{info.turniejNazwa}</h1>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm font-semibold text-ink">Twoja rola: {rola.nazwa}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{rola.co}</p>
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {blad && <p className="text-sm text-red-600">{blad}</p>}
        {user ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Jesteś zalogowany jako <span className="font-semibold text-ink">{displayName(user)}</span>
              {user.email ? <span className="text-slate-500"> ({user.email})</span> : null}.
            </p>
            <Button onClick={przyjmij} disabled={wTrakcie} className="w-full">
              {wTrakcie ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Przyjmij zaproszenie'}
            </Button>
            <button
              type="button"
              onClick={async () => { await signOut(); window.location.href = powrot; }}
              className="text-sm font-medium text-primary-600"
            >
              To nie Ty? Zaloguj się innym kontem
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Zaloguj się albo załóż konto w Bojo. Po zalogowaniu wrócisz tutaj i przyjmiesz zaproszenie.
            </p>
            <Link prefetch={false} href={powrot} className="block">
              <Button className="w-full">Zaloguj się albo załóż konto</Button>
            </Link>
          </>
        )}
        <p className="text-xs text-slate-400">Link działa raz. Po przyjęciu przestaje działać.</p>
      </div>
    </div>,
  );
}
