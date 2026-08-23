'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, Flag, Loader2, MoreVertical, Send, ShieldOff, Trash2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { getPublicPlayer } from '@/lib/players';
import { etykietaDniaCzatu, koniecGrupyWiadomosci, taSamaGrupaWiadomosci } from '@/lib/czat';
import {
  pobierzDm, wyslijDm, usunDm, zablokuj, odblokuj, czyZablokowalem, zglos,
  kluczDmWidziano, type DmWiadomosc,
} from '@/lib/dm';

/**
 * `/rozmowy/[id]` — rozmowa prywatna z graczem o podanym id (migracja `125`).
 *
 * Wygląd celowo identyczny z rozmową meczu i tablicą ekipy — wspólne reguły
 * siedzą w `lib/czat.ts`, więc trzy ekrany nie rozjeżdżają się w detalach,
 * które użytkownik zna z komunikatorów.
 *
 * BLOKOWANIE I ZGŁOSZENIE SĄ TUTAJ, nie w ustawieniach konta. Człowiek, który
 * właśnie dostał nieprzyjemną wiadomość, nie ma szukać wyjścia w menu — ma je
 * mieć pod ręką, na ekranie, na którym jest problem.
 */
export default function DmRozmowaClient() {
  const { id: drugiId } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [drugaNazwa, setDrugaNazwa] = useState<string | null>(null);
  const [wiadomosci, setWiadomosci] = useState<DmWiadomosc[]>([]);
  const [ladowanie, setLadowanie] = useState(true);
  const [tekst, setTekst] = useState('');
  const [wysylanie, setWysylanie] = useState(false);
  const [zablokowany, setZablokowany] = useState(false);
  const [menuOtwarte, setMenuOtwarte] = useState(false);
  const dolRef = useRef<HTMLDivElement>(null);
  const polemRef = useRef<HTMLTextAreaElement>(null);

  const zaladuj = useCallback(async (mojId: string) => {
    const [lista, blok] = await Promise.all([
      pobierzDm(mojId, drugiId),
      czyZablokowalem(mojId, drugiId),
    ]);
    setWiadomosci(lista);
    setZablokowany(blok);
  }, [drugiId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLadowanie(false); return; }
    let aktualne = true;
    getPublicPlayer(drugiId)
      .then((p) => { if (aktualne) setDrugaNazwa(p?.displayName ?? 'Gracz'); })
      .catch(() => {});
    zaladuj(user.id)
      .catch((e) => { console.warn('[Dm]', e); if (aktualne) toast('Nie udało się wczytać rozmowy.', 'error'); })
      .finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, drugiId, zaladuj]);

  // Wejście w rozmowę zaznacza wszystko jako widziane — jak rozmowa meczu.
  useEffect(() => {
    if (!user || ladowanie || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(kluczDmWidziano(user.id, drugiId), new Date().toISOString());
    } catch { /* prywatne okno */ }
  }, [user, drugiId, ladowanie, wiadomosci.length]);

  // Komunikator otwiera się na najnowszej wiadomości, nie na początku historii.
  useEffect(() => {
    if (ladowanie || wiadomosci.length === 0) return;
    requestAnimationFrame(() => dolRef.current?.scrollIntoView({ block: 'end' }));
  }, [ladowanie, wiadomosci.length]);

  useEffect(() => {
    const el = polemRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
  }, [tekst]);

  const wyslij = async () => {
    if (!user || !tekst.trim() || wysylanie) return;
    setWysylanie(true);
    try {
      await wyslijDm(user.id, displayName(user), drugiId, tekst);
      setTekst('');
      await zaladuj(user.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wysłać wiadomości.', 'error');
    } finally {
      setWysylanie(false);
    }
  };

  const przelaczBlokade = async () => {
    if (!user) return;
    setMenuOtwarte(false);
    try {
      if (zablokowany) {
        await odblokuj(user.id, drugiId);
        setZablokowany(false);
        toast('Odblokowano — możecie znów pisać.');
      } else {
        await zablokuj(user.id, drugiId);
        setZablokowany(true);
        toast('Zablokowano. Ta osoba nie napisze do Ciebie.');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zmienić blokady.', 'error');
    }
  };

  const zglosOsobe = async () => {
    if (!user) return;
    setMenuOtwarte(false);
    const powod = window.prompt('Co jest nie tak? Opisz krótko — zgłoszenie trafia do nas, nie do tej osoby.');
    if (!powod?.trim()) return;
    try {
      await zglos(user.id, drugiId, powod);
      toast('Dziękujemy — zgłoszenie przyjęte.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wysłać zgłoszenia.', 'error');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Na mobile dla zalogowanego znika CAŁY pasek Header — wiersz niżej
          (strzałka wstecz + imię + menu) jest wtedy jedynym nagłówkiem tego
          ekranu, dokładnie jak w prawdziwym komunikatorze: „jesteś w
          rozmowie", nie „jesteś na stronie z czatem wstawionym pod paskiem
          serwisu". Desktop bez zmian (Header tam nikt nie prosił chować). */}
      <Header hideMobileBarForUser />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-4">
        <div className="flex items-center gap-1">
          <Link
            href="/rozmowy"
            aria-label="Wróć do listy rozmów"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          {/* Nazwa prowadzi do profilu — w rozmowie z kimś znanym tylko
              z boiska „kto to właściwie jest" to pierwsze pytanie. */}
          <Link href={`/gracz/${drugiId}`} className="min-w-0 flex-1 truncate text-base font-bold text-ink hover:underline">
            {drugaNazwa ?? '…'}
          </Link>
          {user && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenuOtwarte((v) => !v)}
                aria-label="Więcej"
                aria-expanded={menuOtwarte}
                className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
              {menuOtwarte && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOtwarte(false)} aria-hidden="true" />
                  <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={przelaczBlokade}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-ink hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <ShieldOff className="h-4 w-4 shrink-0 text-slate-400" />
                      {zablokowany ? 'Odblokuj' : 'Zablokuj'}
                    </button>
                    <button
                      type="button"
                      onClick={zglosOsobe}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <Flag className="h-4 w-4 shrink-0" />
                      Zgłoś
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex-1 pb-4">
          {authLoading || ladowanie ? (
            <div className="flex justify-center py-16 text-slate-300 dark:text-slate-600">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !user ? (
            <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
              <Link href="/logowanie" className="font-medium text-primary-700 hover:underline">Zaloguj się</Link>, żeby przeczytać rozmowę.
            </p>
          ) : wiadomosci.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-3xl" aria-hidden="true">👋</p>
              <p className="mt-2 text-sm font-semibold text-ink">To początek rozmowy</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                Napisz pierwszą wiadomość — widzi ją tylko {drugaNazwa ?? 'ta osoba'}.
              </p>
            </div>
          ) : (
            wiadomosci.map((w, i) => {
              const poprzednia = wiadomosci[i - 1];
              const nastepna = wiadomosci[i + 1];
              // `lib/czat.ts` mówi w kategoriach `userId` — tu pole nazywa się
              // `nadawcaId`, więc mapujemy zamiast dublować regułę grupowania.
              const jako = (x: DmWiadomosc) => ({ userId: x.nadawcaId, createdAt: x.createdAt });
              const nowyDzien = !poprzednia
                || etykietaDniaCzatu(w.createdAt) !== etykietaDniaCzatu(poprzednia.createdAt);
              const tenSamNadawca = !nowyDzien && !!poprzednia
                && taSamaGrupaWiadomosci(jako(poprzednia), jako(w));
              const koniecGrupy = koniecGrupyWiadomosci(jako(w), nastepna ? jako(nastepna) : undefined);
              const wlasny = user.id === w.nadawcaId;

              return (
                <div key={w.id}>
                  {nowyDzien && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                        {etykietaDniaCzatu(w.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`flex items-end ${wlasny ? 'justify-end' : 'justify-start'} ${tenSamNadawca ? 'mt-0.5' : 'mt-2.5'}`}>
                    {!wlasny && (koniecGrupy ? (
                      <span className="mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700 dark:bg-primary-950 dark:text-primary-300" aria-hidden="true">
                        {w.nadawcaNazwa.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <span className="mr-1.5 w-7 shrink-0" aria-hidden="true" />
                    ))}
                    <div className="group relative max-w-[78%]">
                      <div className={[
                        'relative rounded-2xl py-1.5 pl-3 pr-12 text-sm',
                        wlasny ? 'rounded-br-sm bg-primary-700 text-white' : 'rounded-bl-sm bg-white text-ink shadow-sm dark:bg-slate-800',
                      ].join(' ')}>
                        <p className="whitespace-pre-line py-0.5 break-words">{w.tresc}</p>
                        <span className={`pointer-events-none absolute bottom-1 right-2.5 text-[10px] ${wlasny ? 'text-primary-200' : 'text-slate-400'}`}>
                          {format(parseISO(w.createdAt), 'HH:mm')}
                        </span>
                      </div>
                      {wlasny && (
                        <button
                          type="button"
                          onClick={() => usunDm(w.id).then(() => setWiadomosci((l) => l.filter((x) => x.id !== w.id)))
                            .catch((e) => toast(e instanceof Error ? e.message : 'Błąd', 'error'))}
                          aria-label="Usuń wiadomość"
                          className="absolute -left-6 top-0.5 rounded p-0.5 text-slate-300 opacity-60 hover:text-red-500 hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={dolRef} />
        </div>

        {user && (zablokowany ? (
          /* Zablokowanemu NIE chowamy pola po cichu — cisza wyglądałaby jak
             awaria. Zdanie mówi, co się stało, i daje drogę powrotną. */
          <div className="sticky bottom-16 -mx-4 border-t border-slate-200/70 bg-canvas/95 px-4 py-3 text-center backdrop-blur-sm md:bottom-0 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ta osoba jest zablokowana.{' '}
              <button type="button" onClick={przelaczBlokade} className="font-semibold text-primary-700 hover:underline">
                Odblokuj
              </button>
            </p>
          </div>
        ) : (
          /* Kompozytor przyklejony NAD dolnym paskiem nawigacji — inaczej pole
             pisania ucieka pod koniec długiej rozmowy. */
          <div className="sticky bottom-16 -mx-4 border-t border-slate-200/70 bg-canvas/95 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-sm md:bottom-0 dark:border-slate-700">
            <div className="flex items-end gap-2">
              <textarea
                ref={polemRef}
                value={tekst}
                onChange={(e) => setTekst(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); wyslij(); } }}
                placeholder={drugaNazwa ? `Napisz do: ${drugaNazwa}` : 'Napisz wiadomość…'}
                rows={1}
                maxLength={1000}
                className="max-h-[110px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none placeholder:text-slate-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:border-slate-600 dark:bg-slate-800 dark:focus:ring-primary-900"
              />
              <button
                type="button"
                onClick={wyslij}
                disabled={!tekst.trim() || wysylanie}
                aria-label="Wyślij wiadomość"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white shadow-sm transition hover:bg-primary-800 disabled:opacity-40"
              >
                {wysylanie ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
