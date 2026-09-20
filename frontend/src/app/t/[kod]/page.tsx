'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Loader2, MapPin, Users } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { validateName } from '@/lib/validation';
import { getDruzynaPoKodzie, dolaczDoDruzyny } from '@/lib/turniejDruzyny';
import { getTurniej } from '@/lib/turnieje';
import { etykietaTerminu } from '@/lib/turniejEtykiety';
import { sportEmoji } from '@/lib/sports';
import type { Turniej, TurniejDruzyna } from '@/types';

const inputCls =
  'w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100';

export default function DolaczDoDruzynyPage() {
  const { kod } = useParams<{ kod: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [druzyna, setDruzyna] = useState<TurniejDruzyna | null>(null);
  const [turniej, setTurniej] = useState<Turniej | null>(null);
  const [ladowanie, setLadowanie] = useState(true);
  const [imie, setImie] = useState('');
  const [wTrakcie, setWTrakcie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  useEffect(() => {
    let aktualne = true;
    getDruzynaPoKodzie(kod)
      .then(async (d) => {
        if (!aktualne) return;
        setDruzyna(d);
        // Turniej osobnym zapytaniem: bez niego ten ekran prosi kogoś, kto
        // nie zna Bojo, o założenie konta w zamian za nic.
        if (d) {
          const t = await getTurniej(d.turniejId).catch(() => null);
          if (aktualne) setTurniej(t);
        }
      })
      .finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
  }, [kod]);

  const wykonaj = async (opcje: Parameters<typeof dolaczDoDruzyny>[1]) => {
    setWTrakcie(true);
    setBlad(null);
    try {
      const wynik = await dolaczDoDruzyny(kod, opcje);
      router.push(`/turnieje/${wynik.turniejId}?tab=druzyny`);
      toast(wynik.zostalKapitanem ? 'Jesteś kapitanem tej drużyny!' : 'Dołączyłeś do drużyny!');
    } catch (e) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się dołączyć');
      setWTrakcie(false);
    }
  };

  if (loading || ladowanie) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <div className="flex-1 py-24 text-center text-sm text-slate-400">Ładuję…</div>
      </div>
    );
  }

  if (!druzyna) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16 text-center">
          <p className="font-medium text-ink">Nie znaleziono drużyny o tym kodzie.</p>
          <Link href="/turnieje" className="mt-2 inline-block text-sm text-primary-600">Wróć do turniejów</Link>
        </main>
      </div>
    );
  }

  const wolneWpisy = (druzyna.zawodnicy ?? []).filter((z) => !z.userId);
  const wSkladzie = (druzyna.zawodnicy ?? []).filter((z) => z.userId);

  /**
   * Do czego właściwie człowiek dołącza.
   *
   * Ten ekran jest dla większości zawodników PIERWSZYM kontaktem z Bojo:
   * dostali odnośnik na WhatsAppie od kolegi. Do 2026-09-20 widzieli kłódkę,
   * nazwę drużyny i prośbę o zalogowanie — czyli prośbę o założenie konta
   * w nieznanym serwisie w zamian za nic. Ta sama zasada, która w
   * `docs/przeplyw-organizatora.md` każe bramie logowania przed kreatorem być
   * stroną sprzedażową, a nie przekierowaniem.
   */
  const wizytowka = (
    <div className="space-y-3 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 text-left shadow-sm">
      {turniej && (
        <div>
          <p className="font-medium text-ink">{sportEmoji(turniej.sport)} {turniej.nazwa}</p>
          <div className="mt-1 space-y-0.5 text-sm text-slate-600 dark:text-slate-300">
            <p className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {etykietaTerminu(turniej.dataStartu, turniej.godzinaStartu)}
            </p>
            {turniej.miejsceNazwa && (
              <p className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0">{turniej.miejsceNazwa}</span>
              </p>
            )}
          </div>
        </div>
      )}
      {wSkladzie.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
          <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
            <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            W składzie już {wSkladzie.length === 1 ? 'jest' : 'są'}:{' '}
            {wSkladzie.slice(0, 3).map((z) => z.imie).join(' · ')}
            {wSkladzie.length > 3 && ` i ${wSkladzie.length - 3} inne osoby`}
          </p>
        </div>
      )}
    </div>
  );

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">Zaproszenie do drużyny</p>
          <h1 className="mb-5 font-display text-2xl font-bold text-ink">{druzyna.nazwa}</h1>
          {wizytowka}
          <div className="mt-5">
            <Link href={`/logowanie?next=${encodeURIComponent(`/t/${kod}`)}`}>
              <Button className="w-full">Dołącz do drużyny</Button>
            </Link>
            <p className="mt-2 text-xs text-slate-400">
              Konto zakładasz przy okazji — Google albo e-mail, bez instalowania niczego.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <h1 className="font-display text-2xl font-bold text-ink text-center mb-1">{druzyna.nazwa}</h1>
        <p className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400">
          {turniej ? turniej.nazwa : 'Turniej Bojo'}
        </p>

        <div className="mb-4">{wizytowka}</div>

        <div className="space-y-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          {blad && <p className="text-sm text-red-600">{blad}</p>}

          {!druzyna.kapitanId ? (
            <div className="space-y-2">
              <Button onClick={() => wykonaj({ jakoKapitan: true })} disabled={wTrakcie} className="w-full inline-flex items-center justify-center gap-2">
                {wTrakcie ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Zostań kapitanem tej drużyny'}
              </Button>
              <Button variant="outline" onClick={() => wykonaj({})} disabled={wTrakcie} className="w-full">
                Dołącz jako zawodnik
              </Button>
            </div>
          ) : wolneWpisy.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Jesteś na tej liście?</p>
              {wolneWpisy.map((z) => (
                <button
                  key={z.id}
                  onClick={() => wykonaj({ zawodnikId: z.id })}
                  disabled={wTrakcie}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {z.imie}
                </button>
              ))}
              <details className="pt-2">
                <summary className="cursor-pointer text-sm text-primary-600">Nie ma mnie na liście</summary>
                <div className="mt-2 flex gap-2">
                  <input value={imie} onChange={(e) => setImie(e.target.value)} placeholder="Imię i nazwisko" className={inputCls} />
                  <Button
                    size="sm"
                    onClick={() => { try { wykonaj({ imie: validateName(imie, 'Imię', 60) }); } catch (e) { setBlad(e instanceof Error ? e.message : 'Podaj imię'); } }}
                    disabled={wTrakcie || imie.trim().length < 1}
                    className="shrink-0"
                  >
                    Dołącz
                  </Button>
                </div>
              </details>
            </div>
          ) : (
            <div className="space-y-2">
              <input value={imie} onChange={(e) => setImie(e.target.value)} placeholder="Imię i nazwisko" className={inputCls} />
              <Button
                onClick={() => { try { wykonaj({ imie: validateName(imie, 'Imię', 60) }); } catch (e) { setBlad(e instanceof Error ? e.message : 'Podaj imię'); } }}
                disabled={wTrakcie || imie.trim().length < 1}
                className="w-full inline-flex items-center justify-center gap-2"
              >
                {wTrakcie ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Dołącz do drużyny'}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
