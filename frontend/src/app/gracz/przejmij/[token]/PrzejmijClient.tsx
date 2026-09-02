'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, Check, MapPin, UserCheck, Loader2, Ban, Users, Wallet } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { podejrzyjWpisGoscia, przejmijWpisGoscia, wypiszWpisGoscia, type PodgladWpisuGoscia } from '@/lib/guestClaim';
import { zapomnijWpisGoscia } from '@/lib/mojWpisGoscia';
import { usePotwierdzenie } from '@/lib/usePotwierdzenie';
import { zWielkiejLitery } from '@/lib/utils';

/**
 * „Twój zapis" — strona wpisu gościa bez konta.
 *
 * BYŁA to strona jednej akcji („potwierdź, że to Ty"). Od migracji `128` jest
 * jedynym miejscem, w którym gość bez konta ma jakikolwiek WPŁYW na swój
 * zapis, więc pokazuje też stan meczu i pozwala się wypisać.
 *
 * Skąd ta zmiana. Zapis gościa był jedynym w Bojo, którego zapisany nie mógł
 * cofnąć — usunąć go mógł wyłącznie organizator. Do tego żaden wyzwalacz
 * powiadomień gościa nie widzi (`user_id IS NOT NULL` w `070`, `114`, `116`),
 * więc o odwołaniu meczu nie dowiadywał się w ogóle. Skutki brał na siebie
 * organizator: skład kłamał w tej części, którą sam przyprowadził.
 *
 * Uprawnieniem jest sam link — model jak `join_code`. Dlatego strona działa
 * bez logowania, a token od migracji `127` nie jest już czytelny z wiersza
 * składu, więc zna go wyłącznie ten, komu go wysłano.
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
  const [wypisany, setWypisany] = useState(false);
  const { potwierdz, oknoPotwierdzenia } = usePotwierdzenie();

  useEffect(() => {
    let anulowane = false;
    podejrzyjWpisGoscia(token)
      .then((p) => { if (!anulowane) setPodglad(p); })
      .catch((e) => { if (!anulowane) setBlad(e instanceof Error ? e.message : 'Błąd'); })
      .finally(() => { if (!anulowane) setLadowanie(false); });
    return () => { anulowane = true; };
  }, [token]);

  const przejmij = useCallback(async () => {
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
  }, [user, token, router]);

  /** „Nie mogę grać" — jedyna droga, jaką gość bez konta ma do zwolnienia
   *  swojego miejsca. Bez niej „wypiszcie mnie" szło na WhatsAppa, a skład
   *  w Bojo zostawał nieaktualny do chwili, aż organizator to zauważy. */
  const wypisz = useCallback(async () => {
    if (!podglad) return;
    if (await potwierdz({
      tytul: 'Wypisać Cię z tego meczu?',
      konsekwencje: [
        'Zwolnisz swoje miejsce — dostanie je pierwsza osoba z listy rezerwowej.',
        'Organizator zobaczy zmianę w składzie.',
        'Żeby wrócić, trzeba zapisać się od nowa — a miejsca może już nie być.',
      ],
      potwierdzLabel: 'Wypisz mnie',
      anulujLabel: 'Zostaję',
      wariant: 'destrukcyjny',
    }) !== 'tak') return;

    setZajete(true);
    setBlad(null);
    try {
      await wypiszWpisGoscia(token);
      // Token przestał do czegokolwiek prowadzić — pamięć na urządzeniu też
      // musi zniknąć, inaczej strona meczu dalej twierdziłaby „jesteś zapisany".
      zapomnijWpisGoscia(podglad.eventId);
      setWypisany(true);
    } catch (e) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się wypisać.');
    } finally {
      setZajete(false);
    }
  }, [podglad, token, potwierdz]);

  // Auto-przejęcie: gdy link niesie `?auto=1` (wraca z zapisu jako gość na
  // Google/hasło z EventDetailClient), nie ma po co pytać jeszcze raz „czy to
  // Ty" — użytkownik przed chwilą sam wpisał swoje imię i e-mail w tym samym
  // oknie przeglądarki. Inne wejścia na tę stronę (np. link wysłany SMS-em
  // przez organizatora) nie mają `?auto=1` i nadal wymagają świadomego kliku.
  const autoProbowane = useRef(false);
  useEffect(() => {
    if (autoProbowane.current) return;
    if (ladowanie || authLoading) return;
    if (!podglad || podglad.juzPrzejety) return;
    if (!user) return;
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('auto') !== '1') return;
    autoProbowane.current = true;
    przejmij();
  }, [ladowanie, authLoading, podglad, user, przejmij]);

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

  if (wypisany) {
    return ramka(
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1 className="font-display text-xl font-bold text-ink">Wypisaliśmy Cię z meczu</h1>
        <p className="mt-2 text-sm text-slate-600">
          Twoje miejsce wróciło do puli. Jeśli to pomyłka, możesz zapisać się jeszcze raz —
          o ile miejsce nadal jest wolne.
        </p>
        <Link href={`/wydarzenia/${podglad.eventId}`} className="mt-5 inline-block">
          <Button variant="outline">Wróć do meczu</Button>
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
      {/* ODWOŁANIE NA SAMEJ GÓRZE. Gość bez konta nie dostaje o nim żadnego
          powiadomienia (wyzwalacz `070` pomija wiersze bez `user_id`), więc ta
          strona jest jedynym miejscem w Bojo, gdzie może się o tym dowiedzieć —
          i musi to zobaczyć, zanim przeczyta cokolwiek innego. */}
      {podglad.statusMeczu === 'cancelled' && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-700">Mecz odwołany</p>
            <p className="text-xs text-red-600">Organizator odwołał ten mecz — nie odbędzie się.</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-primary-700">
        <UserCheck className="h-5 w-5" />
        <span className="text-xs font-semibold uppercase tracking-wide">Twój zapis</span>
      </div>

      <h1 className="mt-2 font-display text-xl font-bold text-ink">
        {podglad.czekaNaAkceptacje
          ? `Czekasz na akceptację jako „${podglad.imie}"`
          : podglad.naRezerwie
            ? `Jesteś na liście rezerwowej jako „${podglad.imie}"`
            : `Masz miejsce w składzie jako „${podglad.imie}"`}
      </h1>
      {/* „Przejmij ten wpis" nikomu nic nie mówiło: „wpis" to słowo z naszej
          bazy danych, nie z języka gracza. Chodzi o jedno — potwierdzić, że ten
          ktoś w składzie to Ty. Bez podpowiedzi „bez zapisywania się drugi raz",
          bo sugerowała, że drugi zapis jest alternatywą; nie jest, zrobiłby
          w składzie dwie pozycje o tym samym imieniu. */}
      <p className="mt-1 text-sm text-slate-600">
        {podglad.moznaZmieniac
          ? 'Zachowaj ten link — stąd sprawdzisz mecz i wypiszesz się, gdyby coś wypadło.'
          : 'Ten mecz już się zaczął — składu nie da się już zmienić.'}
      </p>

      <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-ink">{podglad.tytul}</p>
        <p className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>
            {zWielkiejLitery(format(parseISO(podglad.data), 'EEEE, d MMMM', { locale: pl }))}
          </span>
          {' · '}
          {podglad.godzina?.slice(0, 5)}
        </p>
        {podglad.miejsce && (
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400" /> {podglad.miejsce}
          </p>
        )}
        {podglad.maxGraczy > 0 && (
          <p className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            {podglad.wSkladzie}/{podglad.maxGraczy} w składzie
          </p>
        )}
        {podglad.kosztGrosze > 0 && (
          <p className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-slate-400" />
            {(podglad.kosztGrosze / 100).toFixed(2).replace('.', ',')} zł od osoby
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
          To ja — potwierdzam
        </Button>
      ) : (
        <>
          {/* Po zalogowaniu wracamy dokładnie tutaj: bez tego człowiek ląduje
              na stronie głównej i musi szukać linku w wiadomościach. */}
          <Link href={`/logowanie?next=${encodeURIComponent(`/gracz/przejmij/${token}`)}`}>
            <Button className="mt-5 w-full" size="lg">Zaloguj się i potwierdź</Button>
          </Link>
          <p className="mt-2 text-center text-xs text-slate-500">
            Nie masz konta? Załóż je w tym samym kroku — wrócisz tu automatycznie.
          </p>

          {/* Po co komu konto. Poprzednia wersja obiecywała „swój udział,
              statystyki i historię gier" — a skład tego meczu widać bez
              logowania, więc pierwsza z tych rzeczy nie była żadną zachętą.
              Tu stoją rzeczy, których bez konta nie ma. */}
          <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-xs text-slate-600">
            <li className="flex gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
              Dołączysz do ekipy i dostaniesz powiadomienie o kolejnych meczach
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
              Założysz własny mecz i zbierzesz skład jednym linkiem
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
              <span>
                Przejrzysz otwarte gry w okolicy i dołączysz do nich
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  wczesny etap
                </span>
              </span>
            </li>
          </ul>
        </>
      )}

      {/* „NIE MOGĘ GRAĆ" — druga akcja tej strony i cały powód, dla którego
          gość ma tu w ogóle wracać. Stoi POD zachętą do konta, bo konto jest
          lepszym wyjściem (powiadomienia, kolejne mecze), ale nie schowana:
          człowiek, który nie może przyjść, musi to załatwić w dwa dotknięcia,
          inaczej napisze na WhatsAppie i skład w Bojo zostanie nieaktualny.

          Znika po rozpoczęciu meczu i przy wpisie przejętym — obie reguły
          liczy baza (`mozna_zmieniac` w `podejrzyj_wpis_goscia`), więc
          interfejs nie zgaduje ich drugi raz. */}
      {podglad.moznaZmieniac && (
        <button
          type="button"
          onClick={wypisz}
          disabled={zajete}
          className="mt-5 w-full border-t border-slate-100 pt-4 text-center text-sm font-semibold text-red-600 transition hover:text-red-700 disabled:opacity-50"
        >
          Nie mogę grać — wypisz mnie
        </button>
      )}

      {oknoPotwierdzenia}
    </div>,
  );
}
