'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Loader2, MapPin, Users } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { adresRejestracjiZLinku, pilnujPowrotu } from '@/lib/powrotPoLogowaniu';
import { useToast } from '@/lib/toast';
import { validateName } from '@/lib/validation';
import { displayName } from '@/lib/profileName';
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
  const { user, loading, signOut } = useAuth();
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

  // Link drużyny jest celem po KAŻDYM logowaniu, nie tylko po przycisku niżej.
  useEffect(() => {
    if (!loading && druzyna) pilnujPowrotu(`/t/${kod}`, !!user);
  }, [loading, druzyna, user, kod]);

  const wykonaj = async (opcje: Parameters<typeof dolaczDoDruzyny>[1]) => {
    setWTrakcie(true);
    setBlad(null);
    try {
      const wynik = await dolaczDoDruzyny(kod, opcje);
      router.push(`/turnieje/${wynik.turniejId}/druzyna/${wynik.druzynaId}`);
      toast('Jesteś w składzie!');
    } catch (e) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się dołączyć');
      setWTrakcie(false);
    }
  };

  if (loading || ladowanie) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header showMobileWordmark />
        <div className="flex-1 py-24 text-center text-sm text-slate-400">Ładuję…</div>
      </div>
    );
  }

  if (!druzyna) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header showMobileWordmark />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16 text-center">
          <p className="font-medium text-ink">Nie znaleziono drużyny o tym kodzie.</p>
          <Link prefetch={false} href="/turnieje" className="mt-2 inline-block text-sm text-primary-600">Wróć do turniejów</Link>
        </main>
      </div>
    );
  }

  const wolneWpisy = (druzyna.zawodnicy ?? []).filter((z) => !z.userId);
  const mojeImie = user ? displayName(user) : '';
  const dopisz = (doZapisu: string) => {
    try { void wykonaj({ imie: validateName(doZapisu, 'Imię', 60) }); }
    catch (e) { setBlad(e instanceof Error ? e.message : 'Podaj imię'); }
  };
  const zalogujInnym = async () => {
    await signOut();
    window.location.href = `/logowanie?next=${encodeURIComponent(`/t/${kod}`)}`;
  };
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
        <Header showMobileWordmark />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">Zaproszenie do drużyny</p>
          <h1 className="mb-5 font-display text-2xl font-bold text-ink">{druzyna.nazwa}</h1>
          {wizytowka}
          <div className="mt-5">
            <Link prefetch={false} href={adresRejestracjiZLinku(`/t/${kod}`, 'druzyna')}>
              <Button className="w-full">Dołącz do drużyny</Button>
            </Link>
            <p className="mt-2 text-xs text-slate-400">
              Konto zakładasz przy okazji: Google albo e-mail, bez instalowania niczego.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // POWRÓT Z TEGO SAMEGO LINKU (audyt 7, 2026-11-11). Zawodnik, który już
  // jest w składzie, otwiera link drugi raz z tej samej wiadomości na
  // WhatsAppie. Dostawał znowu „Wybierz swoje imię" z cudzymi imionami, czyli
  // formularz, który nic dla niego nie robi. Tu link jest skrótem do drużyny.
  const juzWSkladzie = (druzyna.zawodnicy ?? []).some((z) => z.userId === user.id);
  if (juzWSkladzie) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header showMobileWordmark />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">{turniej ? turniej.nazwa : 'Turniej Bojo'}</p>
          <h1 className="mb-5 font-display text-2xl font-bold text-ink">Jesteś w drużynie {druzyna.nazwa}</h1>
          {wizytowka}
          <Link prefetch={false} href={`/turnieje/${druzyna.turniejId}/druzyna/${druzyna.id}`} className="mt-5 block">
            <Button className="w-full">Przejdź do swojej drużyny</Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header showMobileWordmark />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <h1 className="font-display text-2xl font-bold text-ink text-center mb-1">{druzyna.nazwa}</h1>
        <p className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400">
          {turniej ? turniej.nazwa : 'Turniej Bojo'}
        </p>

        <div className="mb-4">{wizytowka}</div>

        <div className="space-y-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          {blad && <p className="text-sm text-red-600">{blad}</p>}

          {/* Link do drużyny tylko DOŁĄCZA (migracja `172`). Do 2026-11-08
              pierwsza osoba, która otworzyła link drużyny bez kapitana,
              dostawała „Zostań kapitanem tej drużyny" jako główny przycisk,
              czyli kapitanem drużyny wpisanej przez organizatora zostawał
              ktokolwiek, komu link przesłano dalej. Kapitana wskazuje dziś
              organizator na ekranie drużyny. */}
          {/* ZALOGOWANY WIDZI, KIM JEST (2026-11-25, jak na linku kapitana).
              Ekran pokazywał samo „Wybierz swoje imię” z cudzymi imionami:
              nie było wiadomo, na jakim koncie się dołącza ani że wystarczy
              jeden przycisk. Lista wolnych wpisów zostaje dla tych, których
              kapitan już wpisał bez konta. */}
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Jesteś zalogowany jako <span className="font-semibold text-ink">{mojeImie}</span>
            {user.email ? <span className="text-slate-500"> ({user.email})</span> : null}.
          </p>
          {wolneWpisy.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Kapitan już Cię wpisał? Wybierz siebie</p>
              {wolneWpisy.map((z) => (
                <button
                  key={z.id}
                  onClick={() => wykonaj({ zawodnikId: z.id })}
                  disabled={wTrakcie}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  To ja: {z.imie}
                </button>
              ))}
            </div>
          )}
          <Button
            onClick={() => dopisz(mojeImie)}
            disabled={wTrakcie}
            variant={wolneWpisy.length > 0 ? 'outline' : 'primary'}
            className="w-full inline-flex items-center justify-center gap-2"
          >
            {wTrakcie ? <Loader2 className="w-4 h-4 animate-spin" /> : wolneWpisy.length > 0 ? `Nie ma mnie na liście, dołącz jako ${mojeImie}` : `Dołącz jako ${mojeImie}`}
          </Button>
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500 dark:text-slate-400">Dołącz pod innym imieniem</summary>
            <div className="mt-2 flex gap-2">
              <input value={imie} onChange={(e) => setImie(e.target.value)} placeholder="Imię i nazwisko" aria-label="Imię i nazwisko" className={inputCls} />
              <Button size="sm" onClick={() => dopisz(imie)} disabled={wTrakcie || imie.trim().length < 1} className="shrink-0">Dołącz</Button>
            </div>
          </details>
          <button type="button" onClick={zalogujInnym} className="text-sm font-medium text-primary-600">
            To nie Ty? Zaloguj się innym kontem
          </button>
        </div>
      </main>
    </div>
  );
}
