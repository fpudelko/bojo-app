'use client';

// LINK KAPITANA (181, 2026-11-22): organizator wpisał drużyny sam i rozsyła
// kapitanom linki `/k/<kod>`. Kapitan loguje się, wskazuje siebie w składzie
// (albo dopisuje się) i przejmuje drużynę. Link działa raz: przesłany dalej
// już niczego nie da. Zwykły link drużyny (`/t/<kod>`) dalej tylko dołącza.
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ShieldCheck } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { adresRejestracjiZLinku, pilnujPowrotu } from '@/lib/powrotPoLogowaniu';
import { useAdmin } from '@/lib/admin';
import { displayName } from '@/lib/profileName';
import { getTurniej } from '@/lib/turnieje';
import { useToast } from '@/lib/toast';
import { validateName } from '@/lib/validation';
import {
  getDruzynaPoKodzie, getDruzynaPoKodzieKapitana, przejmijDruzyneKapitanem, type DruzynaZLinkuKapitana,
} from '@/lib/turniejDruzyny';
import type { TurniejDruzyna } from '@/types';

const inputCls =
  'w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100';

export default function LinkKapitanaPage() {
  const { kod } = useParams<{ kod: string }>();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const jestAdmin = useAdmin();
  const [organizatorId, setOrganizatorId] = useState<string | null>(null);
  const { toast } = useToast();
  const [info, setInfo] = useState<DruzynaZLinkuKapitana | null>(null);
  const [druzyna, setDruzyna] = useState<TurniejDruzyna | null>(null);
  const [ladowanie, setLadowanie] = useState(true);
  const [imie, setImie] = useState('');
  const [wTrakcie, setWTrakcie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  useEffect(() => {
    let aktualne = true;
    getDruzynaPoKodzieKapitana(kod)
      .then(async (i) => {
        if (!aktualne) return;
        setInfo(i);
        // Skład (wolne wpisy „to ja”) z kodu dołączenia drużyny.
        if (i) {
          const [d, t] = await Promise.all([
            getDruzynaPoKodzie(i.kodDolaczenia).catch(() => null),
            getTurniej(i.turniejId).catch(() => null),
          ]);
          if (aktualne) { setDruzyna(d); setOrganizatorId(t?.organizatorId ?? null); }
        }
      })
      .catch(() => { if (aktualne) setInfo(null); })
      .finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
  }, [kod]);

  // Link z kodu QR jest celem po KAŻDYM logowaniu, nie tylko po przycisku niżej.
  useEffect(() => {
    if (!loading && info) pilnujPowrotu(`/k/${kod}`, !!user);
  }, [loading, info, user, kod]);

  const przejmij = async (opcje: { zawodnikId?: string; imie?: string }) => {
    setWTrakcie(true);
    setBlad(null);
    try {
      const w = await przejmijDruzyneKapitanem(kod, opcje);
      toast('Jesteś kapitanem drużyny');
      router.push(`/turnieje/${w.turniejId}/druzyna/${w.druzynaId}`);
    } catch (e) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się przejąć drużyny');
      setWTrakcie(false);
    }
  };

  const ramka = (tresc: React.ReactNode) => (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header showMobileWordmark />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">{tresc}</main>
    </div>
  );

  if (loading || ladowanie) return ramka(<p className="py-14 text-center text-sm text-slate-400">Ładuję…</p>);

  if (!info) {
    return ramka(
      <div className="text-center">
        <p className="font-medium text-ink">Ten link kapitana już nie działa</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Każdy link kapitana działa raz. Jeśli drużynę przejął ktoś inny albo link się zgubił, poproś organizatora turnieju o nowy.
        </p>
        <Link prefetch={false} href="/turnieje" className="mt-3 inline-block text-sm text-primary-600">Wróć do turniejów</Link>
      </div>,
    );
  }

  const naglowek = (
    <div className="mb-5 text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400">{info.turniejNazwa} · link kapitana</p>
      <h1 className="font-display text-2xl font-bold text-ink">{info.nazwa}</h1>
    </div>
  );
  const objasnienie = (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" aria-hidden />
      <p>
        Organizator zaprasza Cię na kapitana tej drużyny. Kapitan wysyła kolegom link do składu, dopisuje
        zawodników i widzi wszystkie mecze drużyny. Link działa raz, nie przesyłaj go dalej.
      </p>
    </div>
  );

  if (!user) {
    return ramka(
      <>
        {naglowek}
        {objasnienie}
        <Link prefetch={false} href={adresRejestracjiZLinku(`/k/${kod}`, 'kapitan')} className="mt-5 block">
          <Button className="w-full">Zaloguj się i przejmij drużynę</Button>
        </Link>
        <p className="mt-2 text-center text-xs text-slate-400">Konto zakładasz przy okazji: Google albo e-mail.</p>
      </>,
    );
  }

  const wolneWpisy = (druzyna?.zawodnicy ?? []).filter((z) => !z.userId);
  const mojeImie = displayName(user);
  // ZALOGOWANY OD RAZU WIDZI, KIM JEST (uwaga właściciela 2026-11-22). Strona
  // pokazywała samo pole „Imię i nazwisko”, więc nie było wiadomo, czy to
  // logowanie, czy rejestracja, ani na jakim koncie przejmuje się drużynę.
  // Teraz: „Jesteś zalogowany jako …”, przycisk z tym imieniem i „Zaloguj
  // się innym kontem”. Wpisanie innego imienia zostaje opcją.
  const zalogujInnym = async () => {
    await signOut();
    window.location.href = `/logowanie?next=${encodeURIComponent(`/k/${kod}`)}`;
  };
  // ORGANIZATOR NIE PRZEJMUJE PRZEZ POMYŁKĘ: sprawdzając link, zużyłby go
  // i sam został kapitanem cudzej drużyny.
  const toOrganizator = jestAdmin || (!!organizatorId && organizatorId === user.id);
  const dopisz = (imieDoZapisu: string) => {
    try { void przejmij({ imie: validateName(imieDoZapisu, 'Imię', 60) }); }
    catch (e) { setBlad(e instanceof Error ? e.message : 'Podaj imię'); }
  };

  return ramka(
    <>
      {naglowek}
      {objasnienie}
      {toOrganizator && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">Jesteś organizatorem tego turnieju</p>
          <p className="mt-1">
            Ten link jest dla kapitana drużyny {info.nazwa}. Jeśli go użyjesz, to Ty zostaniesz kapitanem, a link przestanie
            działać. Wyślij go kapitanowi.
          </p>
        </div>
      )}
      <div className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {blad && <p className="text-sm text-red-600">{blad}</p>}
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Jesteś zalogowany jako <span className="font-semibold text-ink">{mojeImie}</span>
          {user.email ? <span className="text-slate-500"> ({user.email})</span> : null}.
        </p>
        {wolneWpisy.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">Jesteś już na liście składu? Wybierz siebie</p>
            {wolneWpisy.map((z) => (
              <button
                key={z.id}
                onClick={() => przejmij({ zawodnikId: z.id })}
                disabled={wTrakcie}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
              >
                {z.imie}
              </button>
            ))}
          </div>
        )}
        <Button
          onClick={() => dopisz(mojeImie)}
          disabled={wTrakcie}
          variant={toOrganizator ? 'outline' : 'primary'}
          className="w-full"
        >
          {wTrakcie ? <Loader2 className="h-4 w-4 animate-spin" /> : `Przejmij drużynę jako ${mojeImie}`}
        </Button>
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-500 dark:text-slate-400">W składzie pod innym imieniem</summary>
          <div className="mt-2 flex gap-2">
            <input value={imie} onChange={(e) => setImie(e.target.value)} placeholder="Imię i nazwisko" className={inputCls} aria-label="Imię i nazwisko" />
            <Button onClick={() => dopisz(imie)} disabled={wTrakcie || imie.trim().length < 1} className="shrink-0">Przejmuję</Button>
          </div>
        </details>
        <button type="button" onClick={zalogujInnym} className="text-sm font-medium text-primary-600">
          To nie Ty? Zaloguj się innym kontem
        </button>
      </div>
    </>,
  );
}
