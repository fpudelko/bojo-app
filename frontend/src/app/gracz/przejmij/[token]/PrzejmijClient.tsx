'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, MapPin, UserCheck, Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { podejrzyjWpisGoscia, przejmijWpisGoscia, type PodgladWpisuGoscia } from '@/lib/guestClaim';

/**
 * „To ja" — osoba dopisana ręcznie jako gość wiąże swój wpis z kontem.
 *
 * Podgląd ładuje się PRZED logowaniem, celowo: człowiek musi zobaczyć, o który
 * mecz i o czyje imię chodzi, zanim zdecyduje, czy zakładać konto. Odwrotna
 * kolejność (najpierw zaloguj się, potem zobacz) to prośba o zaufanie w ciemno.
 */
export default function PrzejmijClient({ token }: { token: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [podglad, setPodglad] = useState<PodgladWpisuGoscia | null>(null);
  const [ladowanie, setLadowanie] = useState(true);
  const [blad, setBlad] = useState<string | null>(null);
  const [zajete, setZajete] = useState(false);

  useEffect(() => {
    let anulowane = false;
    podejrzyjWpisGoscia(token)
      .then((p) => { if (!anulowane) setPodglad(p); })
      .catch((e) => { if (!anulowane) setBlad(e instanceof Error ? e.message : 'Błąd'); })
      .finally(() => { if (!anulowane) setLadowanie(false); });
    return () => { anulowane = true; };
  }, [token]);

  const przejmij = async () => {
    if (!user) return;
    setZajete(true);
    setBlad(null);
    try {
      const eventId = await przejmijWpisGoscia(token, displayName(user));
      router.push(`/wydarzenia/${eventId}`);
    } catch (e) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się przejąć wpisu.');
      setZajete(false);
    }
  };

  const ramka = (tresc: React.ReactNode) => (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header />
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-10">{tresc}</main>
    </div>
  );

  if (ladowanie || authLoading) {
    return ramka(
      <div className="flex justify-center py-16 text-slate-300">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>,
    );
  }

  if (!podglad) {
    return ramka(
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1 className="font-display text-xl font-bold text-ink">Link nieaktualny</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ten link nie prowadzi do żadnego wpisu. Mógł zostać już użyty albo organizator usunął
          gracza ze składu.
        </p>
        <Link href="/wydarzenia" className="mt-5 inline-block">
          <Button variant="outline">Zobacz otwarte mecze</Button>
        </Link>
      </div>,
    );
  }

  if (podglad.juzPrzejety) {
    return ramka(
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1 className="font-display text-xl font-bold text-ink">Ten wpis ma już właściciela</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ktoś przejął go wcześniej. Jeśli to pomyłka, napisz do organizatora meczu.
        </p>
        <Link href={`/wydarzenia/${podglad.eventId}`} className="mt-5 inline-block">
          <Button variant="outline">Zobacz mecz</Button>
        </Link>
      </div>,
    );
  }

  return ramka(
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 text-primary-700">
        <UserCheck className="h-5 w-5" />
        <span className="text-xs font-semibold uppercase tracking-wide">Twoje miejsce w składzie</span>
      </div>

      <h1 className="mt-2 font-display text-xl font-bold text-ink">
        Organizator dopisał Cię jako „{podglad.imie}"
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Przejmij ten wpis, a mecz trafi do Twoich gier — bez zapisywania się drugi raz.
      </p>

      <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-ink">{podglad.tytul}</p>
        <p className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span className="capitalize">
            {format(parseISO(podglad.data), 'EEEE, d MMMM', { locale: pl })}
          </span>
          {' · '}
          {podglad.godzina?.slice(0, 5)}
        </p>
        {podglad.miejsce && (
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400" /> {podglad.miejsce}
          </p>
        )}
      </div>

      {blad && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {blad}
        </p>
      )}

      {user ? (
        <Button onClick={przejmij} isLoading={zajete} className="mt-5 w-full" size="lg">
          To ja — przejmij wpis
        </Button>
      ) : (
        <>
          {/* Po zalogowaniu wracamy dokładnie tutaj: bez tego człowiek ląduje
              na stronie głównej i musi szukać linku w wiadomościach. */}
          <Link href={`/logowanie?next=${encodeURIComponent(`/gracz/przejmij/${token}`)}`}>
            <Button className="mt-5 w-full" size="lg">Zaloguj się i przejmij wpis</Button>
          </Link>
          <p className="mt-2 text-center text-xs text-slate-500">
            Nie masz konta? Załóż je w tym samym kroku — wrócisz tu automatycznie.
          </p>
        </>
      )}
    </div>,
  );
}
