'use client';

/**
 * „Grasz w turnieju? Znajdź swoją drużynę” (migracja `198`, 2026-11-28).
 *
 * Wejście z paska „trwa turniej” na stronie głównej. Do tej pory drużynę
 * znajdował wyłącznie ktoś z linkiem `/t/…` albo `/k/…`; reszta zawodników
 * dopisanych przez organizatora z kartki nie miała jak przypiąć się do konta.
 *
 * Trzy kroki: drużyna (lista publiczna) → logowanie (skład widzi tylko
 * zalogowany, RLS z `145`) → siebie ze składu. „To ja” działa OD RAZU
 * (`przejmij_wpis_zawodnika()`), bez czekania na kapitana — decyzja
 * właściciela; prowadzenie składu (kapitanat) i dopisanie się do składu,
 * w którym kogoś nie ma, dalej idą przez prośbę, żeby nikt nie namieszał.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ChevronRight, Loader2, Search, Shield, UserPlus } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { usePotwierdzenie } from '@/lib/usePotwierdzenie';
import { useAdres, useAdresWPasku } from '@/lib/useAdres';
import { getTurniej } from '@/lib/turnieje';
import { getDruzyny, getDruzynyZeSkladem, getMojaDruzyne } from '@/lib/turniejDruzyny';
import { przejmijWpis, zlozProsbe } from '@/lib/turniejProsby';
import { zapamietajPowrot } from '@/lib/powrotPoLogowaniu';
import { sportEmoji } from '@/lib/sports';
import type { Turniej, TurniejDruzyna } from '@/types';

export default function JestemClient() {
  const { id } = useParams<{ id: string }>();
  useAdresWPasku({ [id]: useAdres('turniej', id) });
  const router = useRouter();
  const { user, loading: ladujeSesje } = useAuth();
  const { toast } = useToast();
  const { potwierdz, oknoPotwierdzenia } = usePotwierdzenie();

  const [turniej, setTurniej] = useState<Turniej | null | undefined>(undefined);
  const [druzyny, setDruzyny] = useState<TurniejDruzyna[]>([]);
  const [moja, setMoja] = useState<TurniejDruzyna | null>(null);
  const [wybrana, setWybrana] = useState<string | null>(null);
  const [szukaj, setSzukaj] = useState('');
  const [wTrakcie, setWTrakcie] = useState(false);

  // `?druzyna=` po powrocie z logowania. Z `window`, nie `useSearchParams()`
  // (ten hook wywraca build produkcyjny, AGENTS.md).
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get('druzyna');
    if (d) setWybrana(d);
  }, []);

  useEffect(() => {
    if (ladujeSesje) return;
    let aktualne = true;
    (async () => {
      const t = await getTurniej(id).catch(() => null);
      // Skład przychodzi tylko zalogowanemu (RLS); niezalogowany dostaje nazwy.
      const d = await (user ? getDruzynyZeSkladem(id) : getDruzyny(id)).catch(() => []);
      const m = user ? await getMojaDruzyne(id, user.id).catch(() => null) : null;
      if (!aktualne) return;
      setTurniej(t);
      setDruzyny(d.filter((x) => x.status !== 'odrzucona' && x.status !== 'wycofana'));
      setMoja(m);
    })();
    return () => { aktualne = false; };
  }, [id, user, ladujeSesje]);

  const widoczne = useMemo(() => {
    const q = szukaj.trim().toLowerCase();
    return q ? druzyny.filter((d) => d.nazwa.toLowerCase().includes(q)) : druzyny;
  }, [druzyny, szukaj]);
  const druzyna = druzyny.find((d) => d.id === wybrana) ?? null;
  const zamkniety = turniej?.status === 'zakonczony' || turniej?.status === 'odwolany';

  const wybierz = (druzynaId: string | null) => {
    setWybrana(druzynaId);
    // Adres niesie wybór, żeby „wstecz” i powrót z logowania trafiały tu samo.
    const url = druzynaId ? `?druzyna=${druzynaId}` : window.location.pathname;
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0 });
  };

  const zaloguj = () => {
    const cel = `/turnieje/${id}/jestem${wybrana ? `?druzyna=${wybrana}` : ''}`;
    zapamietajPowrot(cel);
    window.location.href = `/logowanie?next=${encodeURIComponent(cel)}`;
  };

  const toJa = async (zawodnikId: string, imie: string) => {
    if (!druzyna) return;
    const wynik = await potwierdz({
      tytul: `To Ty: ${imie}?`,
      konsekwencje: [
        `Wpis „${imie}” w drużynie ${druzyna.nazwa} zostanie przypięty do Twojego konta`,
        'Gole i kartki z tego turnieju trafią do Twojego profilu',
        'Kapitan dostanie o tym informację i może to cofnąć',
      ],
      potwierdzLabel: 'Tak, to ja',
    });
    if (wynik !== 'tak') return;
    setWTrakcie(true);
    try {
      const druzynaId = await przejmijWpis(zawodnikId);
      toast(`Jesteś w składzie drużyny ${druzyna.nazwa}`);
      router.push(`/turnieje/${id}/druzyna/${druzynaId ?? druzyna.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się przypisać', 'error');
      setWTrakcie(false);
    }
  };

  const prosba = async (typ: 'dolaczenie' | 'kapitan') => {
    if (!druzyna) return;
    const wynik = await potwierdz(typ === 'kapitan'
      ? {
        tytul: `Zostać kapitanem drużyny ${druzyna.nazwa}?`,
        konsekwencje: ['Organizator dostanie prośbę i zdecyduje', 'Kapitan prowadzi skład i dostaje powiadomienia drużyny'],
        potwierdzLabel: 'Wyślij prośbę',
      }
      : {
        tytul: `Dołączyć do drużyny ${druzyna.nazwa}?`,
        konsekwencje: [druzyna.kapitanId ? 'Kapitan dostanie prośbę i zdecyduje' : 'Organizator dostanie prośbę i zdecyduje', 'Dostaniesz powiadomienie o decyzji'],
        potwierdzLabel: 'Wyślij prośbę',
      });
    if (wynik !== 'tak') return;
    setWTrakcie(true);
    try {
      await zlozProsbe(druzyna.id, typ);
      toast('Prośba wysłana. Dostaniesz powiadomienie o decyzji');
      router.push(`/turnieje/${id}/druzyna/${druzyna.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wysłać prośby', 'error');
      setWTrakcie(false);
    }
  };

  const ramka = (tresc: React.ReactNode) => (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header showMobileWordmark />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">{tresc}</main>
      {oknoPotwierdzenia}
    </div>
  );

  if (turniej === undefined) {
    return ramka(<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>);
  }
  if (!turniej) {
    return ramka(
      <div className="py-16 text-center">
        <p className="text-sm text-slate-500">Nie znaleziono turnieju.</p>
        <Link prefetch={false} href="/" className="mt-3 inline-block text-sm font-semibold text-primary-700">Wróć na stronę główną</Link>
      </div>,
    );
  }

  const naglowek = (
    <div className="mb-5">
      <Link prefetch={false} href={`/turnieje/${id}`} className="text-xs font-medium text-slate-500 hover:text-primary-700">
        {sportEmoji(turniej.sport)} {turniej.nazwa}{turniej.miasto ? ` · ${turniej.miasto}` : ''}
      </Link>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink">
        {druzyna ? druzyna.nazwa : 'Znajdź swoją drużynę'}
      </h1>
      {!druzyna && (
        <p className="mt-1 text-sm text-slate-500">
          Wybierz drużynę, a potem siebie ze składu. Twoje gole i mecze trafią do Twojego profilu.
        </p>
      )}
    </div>
  );

  // Już grasz: nie ma czego szukać.
  if (moja) {
    return ramka(
      <>
        {naglowek}
        <div className="rounded-2xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-500/30 dark:bg-primary-500/10">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Check className="h-4 w-4 text-primary-700" /> Grasz w drużynie {moja.nazwa}
          </p>
          <Link prefetch={false} href={`/turnieje/${id}/druzyna/${moja.id}`} className="mt-3 block">
            <Button className="w-full">Przejdź do drużyny</Button>
          </Link>
        </div>
      </>,
    );
  }

  if (zamkniety) {
    return ramka(
      <>
        {naglowek}
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Ten turniej jest już zamknięty, nie da się przypisać do drużyny.
        </p>
      </>,
    );
  }

  // Krok 1: lista drużyn.
  if (!druzyna) {
    return ramka(
      <>
        {naglowek}
        {druzyny.length > 8 && (
          <label className="relative mb-3 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={szukaj}
              onChange={(e) => setSzukaj(e.target.value)}
              placeholder="Szukaj drużyny"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
        )}
        {druzyny.length === 0 ? (
          <p className="text-sm text-slate-500">Ten turniej nie ma jeszcze drużyn.</p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
            {widoczne.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => wybierz(d.id)}
                  className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <span className="min-w-0 truncate text-sm font-semibold text-ink">{d.nazwa}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </>,
    );
  }

  // Krok 2: logowanie (skład widzi tylko zalogowany).
  if (!user) {
    return ramka(
      <>
        {naglowek}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm font-semibold text-ink">Zaloguj się, żeby wybrać siebie ze składu</p>
          <p className="mt-1 text-xs text-slate-500">
            Konto zakładasz w kilka sekund, także przez Google. Po zalogowaniu wrócisz tutaj.
          </p>
          <Button onClick={zaloguj} className="mt-4 w-full">Zaloguj się</Button>
        </div>
        <button type="button" onClick={() => wybierz(null)} className="mt-4 text-sm font-medium text-slate-500 hover:text-primary-700">
          Inna drużyna
        </button>
      </>,
    );
  }

  // Krok 3: siebie ze składu.
  const sklad = druzyna.zawodnicy ?? [];
  const wolne = sklad.filter((z) => !z.userId);
  const zajete = sklad.filter((z) => z.userId);
  return ramka(
    <>
      {naglowek}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Który to Ty?</p>
      {wolne.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">W składzie nie ma wolnych miejsc bez konta.</p>
      ) : (
        <ul className="mb-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
          {wolne.map((z) => (
            <li key={z.id} className="flex min-h-[52px] items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {z.numer !== undefined && <span className="mr-2 font-mono text-xs text-slate-400">{z.numer}</span>}
                {z.imie}
              </span>
              <Button size="sm" onClick={() => toJa(z.id, z.imie)} disabled={wTrakcie}>To ja</Button>
            </li>
          ))}
        </ul>
      )}
      {zajete.length > 0 && (
        <p className="mb-4 text-xs text-slate-500">
          Mają już konto: {zajete.map((z) => z.imie).join(', ')}.
        </p>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => prosba('dolaczenie')}
          disabled={wTrakcie}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-primary-200 dark:border-slate-700 dark:bg-slate-800"
        >
          <UserPlus className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Nie ma mnie na liście</span>
            <span className="block text-xs text-slate-500">Poproś o dopisanie do składu, zdecyduje {druzyna.kapitanId ? 'kapitan' : 'organizator'}</span>
          </span>
        </button>
        {!druzyna.kapitanId && (
          <button
            type="button"
            onClick={() => prosba('kapitan')}
            disabled={wTrakcie}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-primary-200 dark:border-slate-700 dark:bg-slate-800"
          >
            <Shield className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">Jestem kapitanem tej drużyny</span>
              <span className="block text-xs text-slate-500">Prowadzenie składu po zatwierdzeniu przez organizatora</span>
            </span>
          </button>
        )}
      </div>

      <button type="button" onClick={() => wybierz(null)} className="mt-5 text-sm font-medium text-slate-500 hover:text-primary-700">
        Inna drużyna
      </button>
    </>,
  );
}
