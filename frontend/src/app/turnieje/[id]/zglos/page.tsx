'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Copy } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { useWstecz } from '@/lib/historia';
import { getTurniej, przyjmujeZgloszenia } from '@/lib/turnieje';
import { STATUS_DRUZYNY, liczDruzynyWTurnieju } from '@/lib/turniejEtykiety';
import { getDruzyny, getMojaDruzyne, zglosDruzyne } from '@/lib/turniejDruzyny';
import type { Turniej, TurniejDruzyna } from '@/types';

const inputCls =
  'w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100';
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5';

export default function ZglosDruzynePage() {
  const { id } = useParams<{ id: string }>();
  const wstecz = useWstecz(`/turnieje/${id}`);
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [turniej, setTurniej] = useState<Turniej | null>(null);
  const [druzyny, setDruzyny] = useState<TurniejDruzyna[]>([]);
  const [ladowanie, setLadowanie] = useState(true);

  const [nazwa, setNazwa] = useState('');
  const [kontaktImie, setKontaktImie] = useState('');
  const [telefon, setTelefon] = useState('');
  const [email, setEmail] = useState('');
  const [regulaminOk, setRegulaminOk] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [zgloszona, setZgloszona] = useState<string | null>(null);
  /** Drużyna, którą ten użytkownik już zgłosił do tego turnieju. */
  const [mojaDruzyna, setMojaDruzyna] = useState<TurniejDruzyna | null>(null);

  useEffect(() => {
    let aktualne = true;
    Promise.all([getTurniej(id), getDruzyny(id)])
      .then(async ([t, d]) => {
        if (!aktualne) return;
        setTurniej(t);
        setDruzyny(d);
        if (user) {
          const moja = await getMojaDruzyne(id, user.id).catch(() => null);
          if (aktualne) setMojaDruzyna(moja);
        }
      })
      .finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
  }, [id]);

  if (!loading && !user) {
    if (typeof window !== 'undefined') window.location.href = `/logowanie?next=${encodeURIComponent(`/turnieje/${id}/zglos`)}`;
    return null;
  }

  const handleSubmit = async () => {
    if (!user || nazwa.trim().length < 2) return;
    setSubmitting(true);
    setBlad(null);
    try {
      const druzynaId = await zglosDruzyne(id, {
        nazwa,
        kontaktImie: kontaktImie || undefined,
        kontaktTelefon: telefon || undefined,
        kontaktEmail: email || undefined,
      }, user.id);
      setZgloszona(druzynaId);
    } catch (e) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się zgłosić drużyny');
      setSubmitting(false);
    }
  };

  const kopiujLinkDruzyny = async (kod: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/t/${kod}`);
      toast('Link skopiowany');
    } catch {
      toast('Nie udało się skopiować linku', 'error');
    }
  };

  if (ladowanie) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <div className="flex-1 py-24 text-center text-sm text-slate-400">Ładuję…</div>
      </div>
    );
  }

  if (!turniej) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <div className="flex-1 py-24 text-center text-sm text-slate-500">Nie znaleziono turnieju.</div>
      </div>
    );
  }

  if (zgloszona) {
    const druzyna = druzyny.find((d) => d.id === zgloszona);
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 text-center">
          <h1 className="font-display text-2xl font-bold text-ink mb-2">Zgłoszenie wysłane</h1>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            Teraz zaproś swoich do drużyny, każdy, kto wejdzie w ten link, dopisze się do składu sam.
          </p>
          {/* GŁÓWNA droga to ekran drużyny, nie kopiowanie linku.
              Do 2026-09-20 ten ekran był JEDYNYM miejscem z linkiem do
              drużyny: kto zamknął kartę, nie odzyskiwał go nigdzie — a to
              jest w tym module cała pętla wzrostu. Kopiowanie zostaje jako
              druga droga, dla kogoś, kto chce wkleić link od razu. */}
          <Link href={`/turnieje/${id}/druzyna/${zgloszona}`}>
            <Button className="w-full">Uzupełnij skład</Button>
          </Link>
          <button
            onClick={() => druzyna && kopiujLinkDruzyny(druzyna.kodDolaczenia)}
            className="mx-auto mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-ink hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Copy className="h-4 w-4" /> Kopiuj link drużyny
          </button>
          <div className="mt-6">
            <Link href={`/turnieje/${id}`} className="text-sm text-primary-600">Wróć do turnieju</Link>
          </div>
        </main>
      </div>
    );
  }

  // MASZ JUŻ ZGŁOSZENIE. Powrót na ten adres dawał czysty formularz, bez słowa
  // o tym, że drużyna już czeka — więc ta sama osoba zakładała drugą. Stan
  // istniejącego zgłoszenia jest tu jedyną sensowną odpowiedzią.
  if (mojaDruzyna && !zgloszona) {
    const status = STATUS_DRUZYNY[mojaDruzyna.status];
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Masz już drużynę w tym turnieju</h1>
          <div className="mt-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
            <p className="font-medium text-ink">{mojaDruzyna.nazwa}</p>
            <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${status.ton}`}>
              {status.label}
            </span>
          </div>
          <Link href={`/turnieje/${id}/druzyna/${mojaDruzyna.id}`} className="mt-4 block">
            <Button className="w-full">Uzupełnij skład</Button>
          </Link>
          <Link href={`/turnieje/${id}`} className="mt-4 inline-block text-sm text-primary-600">
            Wróć do turnieju
          </Link>
        </main>
      </div>
    );
  }

  if (!przyjmujeZgloszenia(turniej, liczDruzynyWTurnieju(druzyny))) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 text-center">
          <p className="font-medium text-ink">Zapisy do tego turnieju są zamknięte.</p>
          <Link href={`/turnieje/${id}`} className="mt-2 inline-block text-sm text-primary-600">Wróć do turnieju</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
        <button onClick={wstecz} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" /> Wróć
        </button>

        <h1 className="font-display text-2xl font-bold text-ink mb-1">Zgłoś drużynę</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{turniej.nazwa}</p>

        <div className="space-y-5 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <div>
            <label className={labelCls}>Nazwa drużyny *</label>
            <input value={nazwa} onChange={(e) => setNazwa(e.target.value)} placeholder="np. Dzikie Bażanty" maxLength={40} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Twoje imię</label>
            <input value={kontaktImie} onChange={(e) => setKontaktImie(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Telefon (opcjonalnie)</label>
            <input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="500 100 200" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>E-mail (opcjonalnie)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputCls} />
          </div>

          {turniej.regulamin && (
            <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={regulaminOk} onChange={(e) => setRegulaminOk(e.target.checked)} className="mt-0.5" />
              <span>Akceptuję regulamin turnieju</span>
            </label>
          )}

          <p className="text-xs text-slate-400">
            {turniej.wymagaAkceptacji
              ? 'Organizator potwierdzi zgłoszenie. Dostaniesz powiadomienie.'
              : 'Wchodzicie od razu, po zgłoszeniu uzupełnij skład.'}
          </p>

          {blad && <p className="text-sm text-red-600">{blad}</p>}

          <Button
            onClick={handleSubmit}
            disabled={nazwa.trim().length < 2 || submitting || (!!turniej.regulamin && !regulaminOk)}
            className="w-full inline-flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Zgłoś drużynę'}
          </Button>
        </div>
      </main>
    </div>
  );
}
