// Rozliczenie do wysłania na czat.
//
// Panel „Podział kosztów" liczy wszystko poprawnie, ale kończył się na ekranie
// organizatora: żeby powiedzieć ekipie „jeszcze nie oddali: Marek, Kuba", trzeba
// było przepisać to ręcznie. Ten sam błąd, który naprawiono już w `O-18`
// (udostępnianie meczu) i `O-27` (zaproszenie gościa) — tu po prostu nie dotarł.
//
// Goście bez konta też są w składzie i też są winni pieniądze, a w Bojo nie
// zobaczą niczego. Wiadomość na czacie jest dla nich jedynym kanałem.
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { eventDisplayTitle } from './eventTitle';
import { priceForParticipant } from './payments';
import { withCount } from './plural';
import type { EventItem, EventParticipant } from '@/types';

export type DaneDoRozliczenia = Pick<
  EventItem,
  'sport' | 'title' | 'maxPlayers' | 'date' | 'costGrosze' | 'sportsCardDiscountGrosze'
> & Partial<Pick<EventItem, 'blikPhone' | 'acceptedPaymentMethods'>>;

const zl = (grosze: number) => `${(grosze / 100).toFixed(2).replace('.', ',')} zł`;

/**
 * Tekst rozliczenia: ile kosztuje, kto jeszcze nie oddał, gdzie wysłać BLIK.
 *
 * Bierze wyłącznie skład (`regulars`) — rezerwowy nie ma za co płacić, dopóki
 * nie wejdzie do gry, dokładnie jak w karcie „Twoja płatność".
 */
export function tekstRozliczenia(
  e: DaneDoRozliczenia,
  sklad: EventParticipant[],
  nieobecni: Set<string> = new Set(),
): string {
  const kwota = (p: EventParticipant) =>
    priceForParticipant(e.costGrosze, e.sportsCardDiscountGrosze, p.hasSportsCard);

  let kiedy: string;
  try {
    kiedy = format(parseISO(e.date), 'EEEE, d MMMM', { locale: pl });
  } catch {
    kiedy = e.date;
  }

  const zaleglosci = sklad.filter((p) => !p.hasPaid);
  const zebrano = sklad.filter((p) => p.hasPaid).reduce((s, p) => s + kwota(p).priceGrosze, 0);
  const oczekiwane = sklad.reduce((s, p) => s + kwota(p).priceGrosze, 0);

  const linie: string[] = [
    `Rozliczenie — ${eventDisplayTitle({ title: e.title, sport: e.sport, maxPlayers: e.maxPlayers })}`,
    kiedy,
    `${zl(e.costGrosze)} od osoby · zebrane ${zl(zebrano)} z ${zl(oczekiwane)}`,
  ];

  if (zaleglosci.length === 0) {
    linie.push('Wszyscy oddali — dzięki!');
  } else {
    linie.push('');
    linie.push(`Zaległości (${withCount(zaleglosci.length, 'osoba', 'osoby', 'osób')}):`);
    // Kwota przy nazwisku, bo przy zniżkach kartowych nie każdy jest winien tyle
    // samo, a to jest najczęstsze źródło „a ja miałem mniej".
    for (const p of zaleglosci) {
      const k = kwota(p);
      const adnotacja = nieobecni.has(p.id) ? ' (nie przyszedł/-a)' : '';
      linie.push(`· ${p.name} — ${k.discountUnspecified ? 'zniżka z karty, dogadajmy kwotę' : zl(k.priceGrosze)}${adnotacja}`);
    }
  }

  // Numer BLIK dokładamy tylko wtedy, gdy organizator sam wskazał BLIK jako
  // sposób płatności — to jego prywatny numer i on decyduje, czy krąży po
  // czacie. `canSeeBlikPhone()` i tak pokazuje mu go zawsze, więc nie odsłania
  // to niczego, czego nie widzi na ekranie.
  if (e.blikPhone && (e.acceptedPaymentMethods ?? []).includes('blik')) {
    linie.push('');
    linie.push(`BLIK: ${e.blikPhone}`);
  }

  return linie.join('\n');
}
