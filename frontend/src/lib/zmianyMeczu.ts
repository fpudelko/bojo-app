// Co się właśnie zmieniło w meczu i kto się o tym dowie.
//
// PO CO TO POWSTAŁO. Odwołanie meczu ma w Bojo wzorcowe okno: mówi, kto
// dostanie powiadomienie, ile osób bez konta go NIE dostanie i czy decyzja
// jest odwracalna. Edycja meczu — która wysyła DWA rodzaje powiadomień
// (`065` termin, `114` miejsce i koszt) plus maile do gości (`133`) —
// kończyła się przyciskiem „Zapisz zmiany" i przekierowaniem. Organizator nie
// wiedział ani co realnie zmienił, ani że ekipa właśnie dostała wiadomość.
//
// Skutek był podwójny i oba warianty są złe: raz pisze to samo drugi raz na
// WhatsAppie, kiedy indziej nie pisze wcale — bo zakłada, że Bojo zrobiło coś,
// czego nie zrobiło (gość bez adresu nie dostaje niczego).
//
// LOGIKA SIEDZI TUTAJ, NIE W KOMPONENCIE, z tego samego powodu co
// `eventSummary.ts`: da się ją przetestować bez renderowania, a strona edycji
// jest regresyjnie wrażliwa i ma dostać JEDNO wywołanie, nie dziesięć nowych
// warunków.
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { withCount } from './plural';
import type { EventParticipant, PaymentMethod, SportsCardProvider, Visibility } from '@/types';

/**
 * Pola meczu, które porównujemy. Węższe niż `EventItem` i niż `EventCreate` —
 * bierzemy dokładnie to, co da się pokazać człowiekowi wierszem „było → jest".
 *
 * ⚠️ **TO NIE JEST LISTA KOMPLETNA I NIE WOLNO JEJ UŻYWAĆ JAKO STRAŻNIKA
 * ZAPISU.** Payload edycji ma około trzydziestu pól; tutaj jest ich czternaście.
 * Poza porównaniem zostają m.in. czas gry, próg minimum, tryb miejsc dla
 * bramkarzy, czas na decyzję z rezerwy, numer BLIK, zniżki kartowe, tryb drużyn
 * i widoczność statusu płatności. Gdyby `policzZmiany()` decydowało o tym, czy
 * w ogóle zapisywać, zmiana samego czasu gry z 90 na 120 minut kończyłaby się
 * cichym „nic się nie zmieniło" i NIE ZAPISAŁABY SIĘ.
 *
 * O pominięciu zapisu decyduje porównanie CAŁEGO payloadu — patrz
 * `payloadWyjsciowy` w `app/wydarzenia/[id]/edytuj/page.tsx`.
 */
export interface DaneDoPorownania {
  date: string;
  time: string;
  /** Nazwa miejsca — już rozstrzygnięta przez wywołującego (obiekt z katalogu
   *  albo nazwa własna pinezki), tak samo jak w `eventSummary.ts`. */
  miejsceNazwa: string;
  /** Identyfikator obiektu z katalogu; `undefined` dla pinezki. Trzymamy go
   *  osobno, bo dwa różne boiska potrafią nazywać się tak samo („Orlik"). */
  fieldId?: string;
  costGrosze: number;
  maxPlayers: number;
  visibility: Visibility;
  requireApproval: boolean;
  reserveEnabled: boolean;
  goalkeepersEnabled: boolean;
  title: string;
  description: string;
  acceptedPaymentMethods: PaymentMethod[];
  acceptedSportsCards: SportsCardProvider[];
}

export type KluczZmiany =
  | 'termin' | 'miejsce' | 'koszt' | 'miejsca' | 'widocznosc'
  | 'akceptacja' | 'rezerwa' | 'bramkarze' | 'tytul' | 'opis' | 'platnosci';

export interface ZmianaPola {
  klucz: KluczZmiany;
  etykieta: string;
  przed: string;
  po: string;
  /** Czy ta zmiana WYSYŁA powiadomienie uczestnikom.
   *
   *  TO JEST LUSTRO WYZWALACZY, NIE OSOBNY SĄD. Powiadomienia wysyła baza:
   *  `065` przy zmianie `event_date`/`event_time`, `114` przy zmianie miejsca
   *  (`field_id`, `field_name`, `custom_*`, `lat`, `lng`) albo `cost_grosz`.
   *  Nic innego nie wysyła nic. Gdyby kiedyś doszedł trzeci wyzwalacz, tę
   *  flagę trzeba zmienić RAZEM z nim — pilnuje tego test
   *  `zmianyMeczu.test.ts`, który sprawdza dokładny zbiór kluczy. */
  powiadamia: boolean;
}

/** Ilu ludzi i jakim kanałem da się powiadomić o zmianie. */
export interface KomuDojdzie {
  /** Uczestnicy z kontem, bez organizatora — dzwonek plus push, jeśli włączyli. */
  zKontem: number;
  /** Goście bez konta, którzy podali adres — poczta (`133`). */
  gosciezAdresem: number;
  /** Goście bez konta bez adresu — dla nich czat organizatora to jedyny kanał. */
  gosciebezAdresu: number;
}

// ---------------------------------------------------------------------------
// Formatowanie wartości
// ---------------------------------------------------------------------------

function hhmm(t: string): string {
  return (t ?? '').slice(0, 5);
}

/** „środa, 12 sierpnia, 18:00" — pełne, nie skrócone. Organizator ma to
 *  porównać z tym, co ma zapisane w telefonie, a nie rozpoznać na liście. */
function terminTekst(date: string, time: string): string {
  let kiedy: string;
  try {
    kiedy = format(parseISO(date), 'EEEE, d MMMM', { locale: pl });
  } catch {
    kiedy = date;
  }
  return `${kiedy}, ${hhmm(time)}`;
}

function kosztTekst(grosze: number): string {
  if (!grosze) return 'za darmo';
  return `${(grosze / 100).toFixed(2)} zł od osoby`;
}

function widocznoscTekst(v: Visibility): string {
  return v === 'public' ? 'publiczny' : 'prywatny';
}

function wlaczone(v: boolean): string {
  return v ? 'włączone' : 'wyłączone';
}

function listaTekst(xs: string[]): string {
  return xs.length ? xs.join(', ') : 'brak';
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

/**
 * Różnica między meczem wczytanym a formularzem — wyłącznie pola, które
 * naprawdę się zmieniły, w kolejności od najważniejszego dla uczestnika.
 *
 * Kolejność jest treścią: termin i miejsce to rzeczy, przez które ktoś może
 * pojechać nie tam i nie wtedy; tytuł i opis nie zmieniają niczyich planów.
 */
export function policzZmiany(przed: DaneDoPorownania, po: DaneDoPorownania): ZmianaPola[] {
  const zmiany: ZmianaPola[] = [];

  if (przed.date !== po.date || hhmm(przed.time) !== hhmm(po.time)) {
    zmiany.push({
      klucz: 'termin',
      etykieta: 'Termin',
      przed: terminTekst(przed.date, przed.time),
      po: terminTekst(po.date, po.time),
      powiadamia: true,
    });
  }

  // Nazwa ALBO identyfikator obiektu: dwa różne boiska bywają tak samo
  // nazwane, a to samo boisko potrafi zmienić nazwę w katalogu.
  if (przed.miejsceNazwa !== po.miejsceNazwa || przed.fieldId !== po.fieldId) {
    zmiany.push({
      klucz: 'miejsce',
      etykieta: 'Miejsce',
      przed: przed.miejsceNazwa || 'nie wybrano',
      po: po.miejsceNazwa || 'nie wybrano',
      powiadamia: true,
    });
  }

  if (przed.costGrosze !== po.costGrosze) {
    zmiany.push({
      klucz: 'koszt',
      etykieta: 'Koszt',
      przed: kosztTekst(przed.costGrosze),
      po: kosztTekst(po.costGrosze),
      powiadamia: true,
    });
  }

  if (przed.maxPlayers !== po.maxPlayers) {
    zmiany.push({
      klucz: 'miejsca',
      etykieta: 'Liczba miejsc',
      przed: String(przed.maxPlayers),
      po: String(po.maxPlayers),
      powiadamia: false,
    });
  }

  if (przed.visibility !== po.visibility) {
    zmiany.push({
      klucz: 'widocznosc',
      etykieta: 'Widoczność',
      przed: widocznoscTekst(przed.visibility),
      po: widocznoscTekst(po.visibility),
      powiadamia: false,
    });
  }

  if (przed.requireApproval !== po.requireApproval) {
    zmiany.push({
      klucz: 'akceptacja',
      etykieta: 'Akceptacja zapisów',
      przed: wlaczone(przed.requireApproval),
      po: wlaczone(po.requireApproval),
      powiadamia: false,
    });
  }

  if (przed.reserveEnabled !== po.reserveEnabled) {
    zmiany.push({
      klucz: 'rezerwa',
      etykieta: 'Lista rezerwowa',
      przed: wlaczone(przed.reserveEnabled),
      po: wlaczone(po.reserveEnabled),
      powiadamia: false,
    });
  }

  if (przed.goalkeepersEnabled !== po.goalkeepersEnabled) {
    zmiany.push({
      klucz: 'bramkarze',
      etykieta: 'Bramkarze osobno',
      przed: wlaczone(przed.goalkeepersEnabled),
      po: wlaczone(po.goalkeepersEnabled),
      powiadamia: false,
    });
  }

  if ((przed.title || '') !== (po.title || '')) {
    zmiany.push({
      klucz: 'tytul',
      etykieta: 'Tytuł',
      przed: przed.title || 'domyślny',
      po: po.title || 'domyślny',
      powiadamia: false,
    });
  }

  if ((przed.description || '') !== (po.description || '')) {
    zmiany.push({
      klucz: 'opis',
      etykieta: 'Opis',
      przed: przed.description ? 'był' : 'brak',
      po: po.description ? 'jest' : 'usunięty',
      powiadamia: false,
    });
  }

  const metodyPrzed = [...przed.acceptedPaymentMethods].sort().join('|');
  const metodyPo = [...po.acceptedPaymentMethods].sort().join('|');
  const kartyPrzed = [...przed.acceptedSportsCards].sort().join('|');
  const kartyPo = [...po.acceptedSportsCards].sort().join('|');
  if (metodyPrzed !== metodyPo || kartyPrzed !== kartyPo) {
    zmiany.push({
      klucz: 'platnosci',
      etykieta: 'Sposoby płatności',
      przed: listaTekst([...przed.acceptedPaymentMethods, ...przed.acceptedSportsCards]),
      po: listaTekst([...po.acceptedPaymentMethods, ...po.acceptedSportsCards]),
      powiadamia: false,
    });
  }

  return zmiany;
}

/** Czy którakolwiek ze zmian uruchomi wyzwalacz powiadomień. */
export function czyPowiadamia(zmiany: ZmianaPola[]): boolean {
  return zmiany.some((z) => z.powiadamia);
}

// ---------------------------------------------------------------------------
// Kto co dostanie
// ---------------------------------------------------------------------------

/**
 * Rozbicie składu na kanały doręczenia.
 *
 * Liczymy WSZYSTKICH związanych z meczem — także rezerwowych i obserwujących —
 * bo wyzwalacze `065` i `114` nie zawężają odbiorców do grających: zmiana
 * terminu unieważnia plany tak samo osobie z kolejki.
 */
export function komuDojdzie(uczestnicy: EventParticipant[], organizerId: string): KomuDojdzie {
  let zKontem = 0;
  let gosciezAdresem = 0;
  let gosciebezAdresu = 0;

  for (const p of uczestnicy) {
    if (p.userId) {
      if (p.userId !== organizerId) zKontem += 1;
      continue;
    }
    // Gość bez konta. Sam adres jest od migracji `127` nieczytelny przez API,
    // więc pytamy o kolumnę pochodną z `137` — ona niesie sam FAKT „da się
    // do niego napisać", bez treści.
    if (p.maGuestEmail) gosciezAdresem += 1;
    else gosciebezAdresu += 1;
  }

  return { zKontem, gosciezAdresem, gosciebezAdresu };
}

// ---------------------------------------------------------------------------
// Zdania do okna potwierdzenia
// ---------------------------------------------------------------------------

/**
 * Lista konsekwencji — dokładnie w kształcie, którego oczekuje
 * `usePotwierdzenie` (jedna myśl na wiersz).
 *
 * `nadLimitem` opisuje osobny przypadek: zmniejszenie liczby miejsc poniżej
 * obsadzonego składu. Baza nikogo nie usuwa, więc to nie jest ostrzeżenie
 * o utracie danych — tylko o tym, że licznik zacznie pokazywać 12/10.
 */
export function konsekwencjeZapisu(
  zmiany: ZmianaPola[],
  komu: KomuDojdzie,
  nadLimitem?: { zapisanych: number; miejsc: number },
): string[] {
  const zdania: string[] = [];
  const powiadamia = czyPowiadamia(zmiany);

  if (powiadamia) {
    const co = zmiany.filter((z) => z.powiadamia).map((z) => z.etykieta.toLowerCase());
    const opisCo = co.length === 1 ? `zmianie: ${co[0]}` : `zmianach: ${co.join(', ')}`;

    zdania.push(komu.zKontem > 0
      ? `${withCount(komu.zKontem, 'osoba', 'osoby', 'osób')} z kontem dostanie powiadomienie o ${opisCo}.`
      : 'Nikt w składzie nie ma konta, więc powiadomienie w Bojo nie ma do kogo pójść.');

    if (komu.gosciezAdresem > 0) {
      zdania.push(`${withCount(komu.gosciezAdresem, 'gość', 'gości', 'gości')} bez konta dostanie e-mail.`);
    }
    if (komu.gosciebezAdresu > 0) {
      zdania.push(`${withCount(komu.gosciebezAdresu, 'osoba', 'osoby', 'osób')} bez konta nie podała adresu — powiadom ją sam.`);
    }
  } else if (zmiany.length > 0) {
    // Cisza też jest informacją, i to potrzebną: bez tego zdania organizator
    // zakłada, że skoro coś zmienił, to ekipa o tym wie.
    zdania.push('Te zmiany nie wysyłają nikomu powiadomienia — jeśli mają o nich wiedzieć, napisz im.');
  }

  if (nadLimitem && nadLimitem.zapisanych > nadLimitem.miejsc) {
    const nadwyzka = nadLimitem.zapisanych - nadLimitem.miejsc;
    zdania.push(
      `Zmniejszasz skład do ${nadLimitem.miejsc}, a zapisanych jest ${nadLimitem.zapisanych}. `
      + `Nikt nie zostanie usunięty — ${withCount(nadwyzka, 'osoba będzie', 'osoby będą', 'osób będzie')} nad limitem.`,
    );
  }

  return zdania;
}

/**
 * Konsekwencje odwołania meczu — ten sam podział na kanały co
 * `konsekwencjeZapisu()`, bo odwołanie kosztuje ludzi wyjazd na boisko i nie
 * może wiedzieć MNIEJ niż zmiana godziny o kwadrans.
 *
 * PO CO OSOBNA FUNKCJA, NIE `konsekwencjeZapisu()` Z INNYMI ARGUMENTAMI.
 * Odwołanie zawsze powiadamia (nie ma stanu „cisza" jak przy zapisie bez
 * zmian) i nie zna `nadLimitem` — to dwie różne rzeczy, których mieszanie
 * jednym parametrem `powiadamia: boolean` byłoby czytelniejsze jako dwie
 * funkcje niż jedna z dodatkowym przełącznikiem.
 *
 * DLACZEGO TO ZASTĘPUJE RĘCZNE LICZENIE W `EventDetailClient.tsx`. Okno
 * odwołania liczyło odbiorców po swojemu — `[...regulars, ...reserves]`
 * (pomija obserwujących i czekających na akceptację, których wyzwalacz `070`
 * i tak powiadamia) i mówiło „dostanie e-mail, JEŚLI podała adres", choć
 * `ma_guest_email` (migracja `137`) niesie dokładną odpowiedź. Audyt
 * 2026-09-12, ustalenie `S-4`.
 */
export function konsekwencjeOdwolania(komu: KomuDojdzie): string[] {
  const zdania: string[] = [];

  zdania.push(komu.zKontem > 0
    ? `${withCount(komu.zKontem, 'osoba', 'osoby', 'osób')} z kontem dostanie powiadomienie w Bojo (i na telefon, jeśli je włączyła).`
    : 'Nikt w składzie nie ma konta, więc powiadomienie w Bojo nie ma do kogo pójść.');

  if (komu.gosciezAdresem > 0) {
    zdania.push(`${withCount(komu.gosciezAdresem, 'gość', 'gości', 'gości')} bez konta dostanie e-mail.`);
  }
  if (komu.gosciebezAdresu > 0) {
    zdania.push(`${withCount(komu.gosciebezAdresu, 'osoba', 'osoby', 'osób')} bez konta nie podała adresu — powiadom ją sam.`);
  }

  return zdania;
}
