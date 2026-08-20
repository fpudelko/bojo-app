// Podsumowanie meczu tuż przed publikacją — „tak zobaczą to gracze".
//
// Powód istnienia: kreator ma trzy kroki, a przycisk „Opublikuj mecz" stoi na
// trzecim. Data, godzina, miejsce, liczba miejsc i cena były ustawiane na
// krokach 1 i 2 i w momencie publikacji organizator ich NIE WIDZIAŁ. Publikował
// na pamięć, a zła data to najczęstsza pomyłka przy organizacji gry.
//
// Logika siedzi tutaj, a nie w komponencie, bo jest testowalna i bo tak stanowi
// zasada „komponenty nie omijają lib/" (docs/domena.md).
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { defaultEventTitle } from './eventTitle';
import { withCount } from './plural';
import { PAYMENT_METHOD_LABELS, SPORTS_CARD_LABELS } from './payments';
import type { PaymentMethod, SportsCardProvider, Visibility } from '@/types';

export interface WierszPodsumowania {
  klucz: 'co' | 'kiedy' | 'gdzie' | 'sklad' | 'koszt' | 'widocznosc';
  etykieta: string;
  wartosc: string;
  /** Krok kreatora, na który skacze „Zmień" przy tym wierszu. */
  krok: 1 | 2 | 3;
  /** Bursztynowa linia pod wartością. NIE blokuje publikacji — krok 3 celowo
   *  nie ma pól wymaganych (`validateStep3` zwraca `{}`), a to ma ostrzegać,
   *  nie zatrzymywać. */
  ostrzezenie?: string;
}

export interface DanePodsumowania {
  sport: string;
  title: string;
  /** Nazwa i adres miejsca, już rozstrzygnięte przez wywołującego — moduł nie
   *  wie nic o kształcie pickera lokalizacji. */
  miejsceNazwa: string | null;
  miejsceAdres: string | null;
  date: string;
  time: string;
  durationMin: number;
  maxPlayers: number;
  /** Próg „gra się odbędzie" (migracja 097). `null`/`undefined` = nie ustawiono. */
  minPlayers?: number | null;
  goalkeepersEnabled: boolean;
  maxGoalkeepers: number;
  organizerParticipates: boolean;
  costPln: string;
  acceptedPaymentMethods: PaymentMethod[];
  cardDiscountEnabled: boolean;
  cardDiscountPln: string;
  acceptedSportsCards: SportsCardProvider[];
  visibility: Visibility;
  requireApproval: boolean;
}

/** „18:00" + 90 → „19:30"; null, gdy przekroczyłoby północ (tak samo jak
 *  `addMinutes` w kreatorze — mecz przez północ nie ma godziny końca). */
function godzinaKonca(time: string, minutes: number): string | null {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const total = h * 60 + m + minutes;
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Czy data (YYYY-MM-DD) wypada dzisiaj — liczone lokalnie, jak wszędzie w kreatorze. */
function czyDzisiaj(date: string): boolean {
  const teraz = new Date();
  const dzis = `${teraz.getFullYear()}-${String(teraz.getMonth() + 1).padStart(2, '0')}-${String(teraz.getDate()).padStart(2, '0')}`;
  return date === dzis;
}

/** Adres, który jest tak naprawdę parą współrzędnych („52.40123, 16.91234").
 *  Reverse geocoding bywa niedostępny i wtedy to jedyne, co mamy. */
function wygladaJakWspolrzedne(s: string): boolean {
  return /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(s.trim());
}

export function zbudujPodsumowanie(v: DanePodsumowania): WierszPodsumowania[] {
  const wiersze: WierszPodsumowania[] = [];

  // ── Co ────────────────────────────────────────────────────────────────────
  wiersze.push({
    klucz: 'co',
    etykieta: 'Co',
    wartosc: v.title.trim() || defaultEventTitle(v.sport, v.maxPlayers),
    krok: 3,
  });

  // ── Kiedy ─────────────────────────────────────────────────────────────────
  let dzien: string;
  try {
    dzien = format(parseISO(v.date), 'EEEE, d MMMM', { locale: pl });
  } catch {
    dzien = v.date;
  }
  const koniec = godzinaKonca(v.time, v.durationMin);
  wiersze.push({
    klucz: 'kiedy',
    etykieta: 'Kiedy',
    wartosc: `${dzien} · ${koniec ? `${v.time}–${koniec}` : v.time}`,
    krok: 2,
    ostrzezenie: czyDzisiaj(v.date)
      ? 'Mecz jest dziś — zostaje mało czasu na zebranie składu.'
      : undefined,
  });

  // ── Gdzie ─────────────────────────────────────────────────────────────────
  const nazwa = v.miejsceNazwa?.trim() || null;
  const adres = v.miejsceAdres?.trim() || null;
  const gdzie = nazwa && adres && adres !== nazwa
    ? `${nazwa}, ${adres}`
    : (nazwa || adres || 'Nie wskazano miejsca');
  wiersze.push({
    klucz: 'gdzie',
    etykieta: 'Gdzie',
    wartosc: gdzie,
    krok: 1,
    ostrzezenie: !nazwa && adres && wygladaJakWspolrzedne(adres)
      ? 'Miejsce nie ma nazwy — gracze zobaczą same współrzędne.'
      : undefined,
  });

  // ── Skład ─────────────────────────────────────────────────────────────────
  const czesciSkladu = [withCount(v.maxPlayers, 'miejsce', 'miejsca', 'miejsc')];
  if (v.minPlayers) {
    czesciSkladu.push(`min. ${v.minPlayers}`);
  }
  if (v.goalkeepersEnabled) {
    czesciSkladu.push(`w tym ${withCount(v.maxGoalkeepers, 'bramkarz', 'bramkarzy', 'bramkarzy')}`);
  }
  czesciSkladu.push(v.organizerParticipates ? 'grasz' : 'nie grasz');
  wiersze.push({
    klucz: 'sklad',
    etykieta: 'Skład',
    wartosc: czesciSkladu.join(' · '),
    krok: 2,
  });

  // ── Koszt ─────────────────────────────────────────────────────────────────
  const koszt = parseFloat(v.costPln || '0');
  let wartoscKosztu: string;
  let ostrzezenieKosztu: string | undefined;
  if (!(koszt > 0)) {
    wartoscKosztu = 'Za darmo';
  } else {
    const czesci = [`${koszt.toFixed(2).replace('.', ',')} zł od osoby`];
    if (v.acceptedPaymentMethods.length > 0) {
      czesci.push(v.acceptedPaymentMethods.map((m) => PAYMENT_METHOD_LABELS[m]).join(', '));
    } else {
      ostrzezenieKosztu = 'Nie wybrałeś metody płatności — gracze zobaczą cenę, ale nie dowiedzą się, jak zapłacić.';
    }
    if (v.cardDiscountEnabled) {
      const karty = v.acceptedSportsCards.length > 0
        ? v.acceptedSportsCards.map((c) => SPORTS_CARD_LABELS[c]).join(', ')
        : 'karta sportowa';
      // Pusta kwota znaczy „zniżka jest, ale zapytaj organizatora" — to
      // świadoma semantyka `sports_card_discount_grosz = null` (docs/domena.md),
      // nie brak danych do uzupełnienia.
      const kwota = parseFloat(v.cardDiscountPln || '0');
      czesci.push(kwota > 0
        ? `zniżka ${kwota.toFixed(2).replace('.', ',')} zł (${karty})`
        : `zniżka z kartą — do ustalenia (${karty})`);
    }
    wartoscKosztu = czesci.join(' · ');
  }
  wiersze.push({
    klucz: 'koszt',
    etykieta: 'Koszt',
    wartosc: wartoscKosztu,
    krok: 2,
    ostrzezenie: ostrzezenieKosztu,
  });

  // ── Kto widzi ─────────────────────────────────────────────────────────────
  const widocznosc = v.visibility === 'public'
    ? 'Publiczny — trafi na listę otwartych gier'
    : 'Prywatny — wejdą tylko osoby z linkiem';
  wiersze.push({
    klucz: 'widocznosc',
    etykieta: 'Kto widzi',
    wartosc: v.requireApproval ? `${widocznosc} · zatwierdzasz każdy zapis` : widocznosc,
    krok: 3,
  });

  return wiersze;
}
