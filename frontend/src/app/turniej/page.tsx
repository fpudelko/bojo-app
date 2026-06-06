'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Trophy, Users, CalendarDays, MapPin, ChevronRight, ChevronDown,
  ShieldCheck, Flame, Star, Sparkles, Clock, CheckCircle2, ArrowRight,
  Handshake, Camera, Medal, Goal,
} from 'lucide-react';
import { clsx } from 'clsx';
import Header from '@/components/layout/Header';
import Countdown from '@/components/tournament/Countdown';
import { useAuth } from '@/lib/auth';
import { getActiveTournament, getTeams, getVenues, getTeamCount } from '@/lib/tournaments';
import { STATUS_LABELS } from '@/lib/tournamentLabels';
import type { Tournament, TournamentTeam, TournamentVenue } from '@/types';

// ---------------------------------------------------------------------------
// Marketing defaults — landing wygląda dobrze nawet zanim powstanie edycja w DB
// ---------------------------------------------------------------------------

const DEFAULTS = {
  name: 'BOJO Community Cup',
  tagline: 'Pierwszy amatorski puchar Poznania. Zbierz ekipę, wejdź do gry.',
  city: 'Poznań',
  maxTeams: 32,
  groupSize: 3,
  advancePerGroup: 2,
  minSquad: 5,
  maxSquad: 10,
  // ~3 tygodnie od „dziś" jako placeholder deadline'u rejestracji
  registrationDeadline: new Date(Date.now() + 21 * 86_400_000).toISOString(),
};

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Ile osób musi liczyć drużyna?',
    a: 'Minimum 5 zawodników (gramy na orlikach 5v5), maksymalnie 10 na liście — 5 w podstawie plus rezerwowi. Skład zamykasz przed pierwszym meczem fazy grupowej.',
  },
  {
    q: 'Ile meczów zagramy?',
    a: 'Każda drużyna ma gwarantowane minimum mecze w fazie grupowej — nikt nie odpada po jednym spotkaniu. Z grupy awansują dwie najlepsze ekipy do fazy pucharowej.',
  },
  {
    q: 'Kto rezerwuje boisko?',
    a: 'Gramy na orlikach partnerskich w Poznaniu. Część obiektów udostępnia gotowe terminy do rezerwacji w aplikacji — wybieracie slot, który pasuje obu drużynom.',
  },
  {
    q: 'Jak umawiamy mecze?',
    a: 'Aplikacja podpowiada terminy, w których obie drużyny zaznaczyły dostępność. Kapitan proponuje dzień i godzinę, rywal akceptuje. Macie cały tydzień na rozegranie kolejki.',
  },
  {
    q: 'Co jeśli rywal się nie stawi?',
    a: 'Wynik zgłasza jedna drużyna, druga potwierdza. Brak kontaktu lub niestawienie się w terminie kolejki kończy się walkowerem. Sporne sytuacje rozstrzyga organizator.',
  },
  {
    q: 'Czy są sędziowie?',
    a: 'We wczesnych rundach drużyny grają fair-play same (opcjonalne nagranie jako dowód przy sporze). Sędziowie pojawiają się od najważniejszych meczów i na Finals Day.',
  },
];

const RULES: { title: string; body: string }[] = [
  { title: 'Format', body: 'Faza grupowa (grupy po 3 drużyny, awansuje 2) → drabinka pucharowa → Finals Day. Format skaluje się od 16 do 64 drużyn.' },
  { title: 'Skład', body: 'Od 5 do 10 zawodników z przypisanymi pozycjami. Rezerwowych można zmieniać do końca fazy grupowej.' },
  { title: 'Terminy', body: 'Każda kolejka trwa tydzień. Drużyny umawiają mecz między sobą w tym oknie. Po deadline — walkower.' },
  { title: 'Wyniki', body: 'Kapitan zgłasza wynik, rywal potwierdza w 12h. Brak potwierdzenia = wynik zatwierdzony automatycznie.' },
  { title: 'Spory', body: 'Rozstrzyga organizator na podstawie zgłoszeń i ewentualnego nagrania. Decyzja jest ostateczna.' },
];

// ---------------------------------------------------------------------------

function Section({
  id, eyebrow, title, children, className,
}: {
  id?: string; eyebrow?: string; title?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section id={id} className={clsx('mx-auto max-w-6xl px-4 py-14 sm:py-20', className)}>
      {eyebrow && (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent-600">{eyebrow}</p>
      )}
      {title && (
        <h2 className="mb-8 font-display text-3xl font-extrabold text-ink sm:text-4xl">{title}</h2>
      )}
      {children}
    </section>
  );
}

function Accordion({ items }: { items: { q?: string; title?: string; a?: string; body?: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {items.map((it, i) => {
        const head = it.q ?? it.title ?? '';
        const body = it.a ?? it.body ?? '';
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
              aria-expanded={isOpen}
            >
              <span className="font-semibold text-ink">{head}</span>
              <ChevronDown className={clsx('h-5 w-5 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen && <p className="px-5 pb-5 -mt-1 text-sm leading-relaxed text-slate-600">{body}</p>}
          </div>
        );
      })}
    </div>
  );
}

export default function TournamentLandingPage() {
  const { user } = useAuth();
  const [t, setT] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [venues, setVenues] = useState<TournamentVenue[]>([]);
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getActiveTournament().then(async (tour) => {
      setT(tour);
      if (tour) {
        const [tm, vn, c] = await Promise.all([
          getTeams(tour.id),
          getVenues(tour.id),
          getTeamCount(tour.id),
        ]);
        setTeams(tm);
        setVenues(vn);
        setCount(c);
      }
      setLoaded(true);
    });
  }, []);

  const name = t?.name ?? DEFAULTS.name;
  const tagline = t?.tagline ?? DEFAULTS.tagline;
  const city = t?.city ?? DEFAULTS.city;
  const maxTeams = t?.maxTeams ?? DEFAULTS.maxTeams;
  const groupSize = t?.groupSize ?? DEFAULTS.groupSize;
  const advance = t?.advancePerGroup ?? DEFAULTS.advancePerGroup;
  const minSquad = t?.minSquad ?? DEFAULTS.minSquad;
  const maxSquad = t?.maxSquad ?? DEFAULTS.maxSquad;
  const deadline = t?.registrationDeadline ?? DEFAULTS.registrationDeadline;
  const spotsLeft = Math.max(0, maxTeams - count);
  const pct = Math.min(100, Math.round((count / maxTeams) * 100));
  const isOpen = !t || t.status === 'draft' || t.status === 'registration';

  return (
    <div className="min-h-screen">
      <Header />

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <div className="hero-surface relative overflow-hidden">
        <div className="hero-dots absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/90 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-accent-400" />
            {t ? STATUS_LABELS[t.status] : 'Pierwsza edycja'} · {city}
          </div>

          <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] text-white sm:text-6xl">
            {name}
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/80">{tagline}</p>

          {/* Countdown */}
          {isOpen && (
            <div className="mt-8">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                Do końca rejestracji
              </p>
              <Countdown target={deadline} />
            </div>
          )}

          {/* CTAs */}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={user ? '/turniej/rejestracja' : '/logowanie?next=/turniej/rejestracja'}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-500 px-7 py-4 text-base font-bold text-primary-950 shadow-glow-accent transition-transform hover:bg-accent-400 active:scale-[0.97]"
            >
              <Trophy className="h-5 w-5" /> Zgłoś drużynę
            </Link>
            <Link
              href="/turniej/drabinka"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-7 py-4 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              Zobacz drabinkę <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Live stats */}
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {[
              { icon: Users, value: loaded ? `${count}/${maxTeams}` : `—/${maxTeams}`, label: 'drużyn' },
              { icon: Goal, value: `${minSquad}–${maxSquad}`, label: 'zawodników' },
              { icon: Flame, value: `${groupSize}→${advance}`, label: 'awans z grupy' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="rounded-2xl bg-white/5 px-4 py-3.5 backdrop-blur ring-1 ring-white/10">
                <Icon className="h-5 w-5 text-accent-400" />
                <p className="mt-2 font-display text-2xl font-bold text-white tabular-nums">{value}</p>
                <p className="text-xs text-white/60">{label}</p>
              </div>
            ))}
          </div>

          {/* Fill bar */}
          <div className="mt-6 max-w-lg">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-accent-500 transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-white/60">
              {spotsLeft > 0 ? `Zostało ${spotsLeft} miejsc` : 'Komplet drużyn — dołącz do listy rezerwowej'}
            </p>
          </div>
        </div>
      </div>

      {/* ── JAK TO DZIAŁA ──────────────────────────────────────────────── */}
      <Section eyebrow="Jak to działa" title="Trzy kroki do gry">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { n: '01', icon: Users, title: 'Zbierz ekipę i zgłoś drużynę', desc: `Podaj nazwę, skład z pozycjami (${minSquad}–${maxSquad} osób) i dostępność tygodniową. 5 minut na telefonie.` },
            { n: '02', icon: CalendarDays, title: 'Faza grupowa — grasz, nie odpadasz', desc: `Grupy po ${groupSize} drużyny, awansują ${advance}. Umawiacie mecze sami, kiedy pasuje obu ekipom.` },
            { n: '03', icon: Trophy, title: 'Drabinka i Finals Day', desc: 'Najlepsi wchodzą do fazy pucharowej. Wielki finał na jednym obiekcie — jak prawdziwe wydarzenie.' },
          ].map(({ n, icon: Icon, title, desc }) => (
            <div key={n} className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover">
              <span className="absolute right-5 top-5 font-display text-4xl font-extrabold text-slate-100">{n}</span>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50">
                <Icon className="h-6 w-6 text-primary-700" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── DLACZEGO WARTO ─────────────────────────────────────────────── */}
      <div className="bg-[#F0EEE9]">
        <Section eyebrow="Dlaczego warto" title="Turniej zrobiony po ludzku">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: ShieldCheck, title: 'Nikt nie odpada po 1 meczu', desc: 'Faza grupowa daje każdej drużynie kilka spotkań na start.' },
              { icon: Clock, title: 'Gracie, kiedy pasuje', desc: 'Sami umawiacie terminy w obrębie tygodnia. Zero sztywnych godzin.' },
              { icon: MapPin, title: 'Orliki w Twojej okolicy', desc: 'Partnerskie boiska w Poznaniu z gotowymi terminami do rezerwacji.' },
              { icon: Medal, title: 'Prawdziwy finał', desc: 'Finals Day z sędziami, zdjęciami i ceremonią nagród.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl bg-white p-5 shadow-card">
                <Icon className="h-7 w-7 text-accent-600" />
                <h3 className="mt-3 font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── ZAREJESTROWANE DRUŻYNY ─────────────────────────────────────── */}
      <Section id="druzyny" eyebrow="Stawka" title={`Zgłoszone drużyny${loaded ? ` (${count})` : ''}`}>
        {teams.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Trophy className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-semibold text-ink">Bądź pierwszą drużyną na liście</p>
            <p className="mt-1 text-sm text-slate-500">Rejestracja właśnie ruszyła — wpiszcie się do historii pierwszej edycji.</p>
            <Link
              href={user ? '/turniej/rejestracja' : '/logowanie?next=/turniej/rejestracja'}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800"
            >
              Zgłoś drużynę <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((tm) => (
              <div key={tm.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-700 font-display text-lg font-bold text-white">
                  {tm.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{tm.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {tm.district || city} · {tm.members?.length ?? 0} zawodników
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── ORLIKI PARTNERSKIE ─────────────────────────────────────────── */}
      {venues.length > 0 && (
        <div className="bg-[#F0EEE9]">
          <Section eyebrow="Gdzie gramy" title="Orliki partnerskie">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {venues.map((v) => {
                const free = v.slots?.filter((s) => s.status === 'free').length ?? 0;
                return (
                  <div key={v.id} className="rounded-2xl bg-white p-5 shadow-card">
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{v.name}</p>
                        {v.address && <p className="truncate text-xs text-slate-500">{v.address}</p>}
                      </div>
                    </div>
                    {free > 0 && (
                      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {free} wolnych terminów
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      )}

      {/* ── FINALS DAY ─────────────────────────────────────────────────── */}
      <Section eyebrow="Wielki finał" title="BOJO Finals Day">
        <div className="overflow-hidden rounded-3xl bg-primary-900 text-white">
          <div className="grid md:grid-cols-2">
            <div className="p-8 sm:p-10">
              <h3 className="font-display text-2xl font-bold">Jeden dzień, jeden mistrz</h3>
              <p className="mt-3 text-white/80">
                Najlepsze cztery drużyny spotykają się na jednym obiekcie. Półfinały, mecz o trzecie
                miejsce i finał — z sędziami, fotografem i ceremonią nagród.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  { icon: Medal, t: 'Puchar i nagrody dla podium' },
                  { icon: Camera, t: 'Profesjonalne zdjęcia z meczów' },
                  { icon: Star, t: 'Nagrody indywidualne: MVP i król strzelców' },
                ].map(({ icon: Icon, t }) => (
                  <li key={t} className="flex items-center gap-3 text-sm">
                    <Icon className="h-5 w-5 text-accent-400" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative hidden items-center justify-center bg-gradient-to-br from-primary-800 to-primary-950 md:flex">
              <Trophy className="h-40 w-40 text-accent-500/30" />
              <Trophy className="absolute h-24 w-24 text-accent-400" />
            </div>
          </div>
        </div>
      </Section>

      {/* ── ZASADY + FAQ ───────────────────────────────────────────────── */}
      <div className="bg-[#F0EEE9]">
        <Section eyebrow="Zanim zagrasz" title="Zasady">
          <Accordion items={RULES} />
        </Section>
      </div>

      <Section eyebrow="Pytania" title="Najczęstsze pytania">
        <Accordion items={FAQ} />
      </Section>

      {/* ── SPONSORZY ──────────────────────────────────────────────────── */}
      <div className="bg-[#F0EEE9]">
        <Section eyebrow="Partnerzy" title="Razem tworzymy lokalny sport">
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Handshake className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-semibold text-ink">Zostań partnerem pierwszej edycji</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Obiekty sportowe, sklepy i lokalne firmy — dotrzyjcie do setek aktywnych graczy
              w Poznaniu przez kilka tygodni turnieju.
            </p>
            <a
              href="mailto:kontakt@bojo.app?subject=Partnerstwo%20BOJO%20Community%20Cup"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50"
            >
              Napisz do nas <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </Section>
      </div>

      {/* ── FINAL CTA ──────────────────────────────────────────────────── */}
      <div className="hero-surface relative overflow-hidden">
        <div className="hero-dots absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center">
          <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
            Gotowi na pierwszy gwizdek?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-white/80">
            Zbierzcie ekipę i wpiszcie się do historii pierwszego BOJO Community Cup.
          </p>
          <Link
            href={user ? '/turniej/rejestracja' : '/logowanie?next=/turniej/rejestracja'}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-500 px-8 py-4 text-base font-bold text-primary-950 shadow-glow-accent transition-transform hover:bg-accent-400 active:scale-[0.97]"
          >
            <Trophy className="h-5 w-5" /> Zgłoś drużynę
          </Link>
        </div>
      </div>

      <footer className="bg-primary-950 py-8 text-center text-sm text-white/50">
        BOJO Community Cup · {city} · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
