// Ikona i podpis rodzaju dla dzwonka powiadomień — jedno spojrzenie zamiast
// czytania treści. Wydzielone z `NotificationBell.tsx` (audyt 2026-09-12,
// ustalenie `S-7`), żeby dało się to sprawdzić testem BEZ renderowania
// komponentu klienckiego — patrz `__tests__/typyPowiadomien.test.ts`.
//
// Panel wyglądał kiedyś jak lista identycznych szarych akapitów: cztery
// pozycje „Nowy mecz w grupie" pod rząd różniły się wyłącznie treścią drobnym
// drukiem (zgłoszone wprost — „te powiadomienia jakoś mi się nie podobają").
// Ikona niesie rodzaj, więc oko odróżnia „odwołany" od „nowy" bez czytania,
// a kolor trzyma się konwencji z AGENTS.md: niebieski = wymaga akceptacji
// uczestnictwa, różowy = wiadomość, czerwony = coś poszło źle, reszta
// neutralnie (zielono dla stanu składu/meczu, szaro dla reszty).
//
// DOPISUJĄC TYP POWIADOMIENIA W MIGRACJI, DOPISZ GO TUTAJ I W
// `lib/ustawieniaPowiadomien.ts`. Trzy listy — typy wstawiane przez bazę, ta
// mapa, i `RODZAJE_POWIADOMIEN` — rozjeżdżały się już trzy razy (`R-9`
// w piątej rundzie audytu naprawiło sześć typów naraz; wróciło z jedenastoma
// kolejnymi). `__tests__/typyPowiadomien.test.ts` porównuje wszystkie trzy
// listy z tym, co realnie wstawiają `supabase/migrations/*.sql`, i pada, gdy
// się rozjadą.
import {
  Bell, CalendarCheck, CalendarClock, CalendarPlus, CalendarX, Check, CheckCircle,
  Clock, ClipboardCheck, ListChecks, MapPin, MessageCircle, Repeat, TicketCheck,
  Trash2, UserCog, UserMinus, UserPlus, Users, X, AlertTriangle, type LucideIcon,
} from 'lucide-react';

export interface IkonaPowiadomienia {
  Ikona: LucideIcon;
  klasa: string;
  rodzaj: string;
}

export const IKONY: Record<string, IkonaPowiadomienia> = {
  nowy_mecz_w_grupie:          { Ikona: CalendarPlus,  klasa: 'bg-primary-50 text-primary-700', rodzaj: 'Nowy mecz' },
  mecz_odwolany:               { Ikona: CalendarX,     klasa: 'bg-red-50 text-red-600',         rodzaj: 'Odwołany' },
  // Para do powyższego (migracja `139`). ZIELONO, nie czerwono: czerwień
  // w tej aplikacji znaczy „coś poszło źle", a sprostowanie odwołania jest
  // dokładnie odwrotną wiadomością — i przychodzi zaraz pod czerwonym
  // wierszem, który prostuje. Dwa czerwone wiersze obok siebie czytałyby się
  // jak dwie awarie.
  mecz_przywrocony:            { Ikona: CalendarCheck, klasa: 'bg-primary-50 text-primary-700', rodzaj: 'Jednak gramy' },
  // Dwa typy z `065` i `114`, które realnie przychodzą, a mapa ich nie miała —
  // lądowały pod szarym dzwonkiem z podpisem „Powiadomienie". Neutralnie,
  // nie na czerwono: zmiana terminu to nie awaria, tylko nowa informacja.
  zmiana_terminu:              { Ikona: CalendarClock, klasa: 'bg-slate-100 text-slate-600',      rodzaj: 'Nowy termin' },
  zmiana_warunkow_meczu:       { Ikona: MapPin,        klasa: 'bg-slate-100 text-slate-600',      rodzaj: 'Zmiana' },
  prosba_o_dolaczenie:         { Ikona: UserPlus,      klasa: 'bg-blue-50 text-blue-600',       rodzaj: 'Prośba' },
  pytanie_o_udzial:            { Ikona: Check,         klasa: 'bg-blue-50 text-blue-600',       rodzaj: 'Grasz?' },
  zaproszenie_na_mecz:         { Ikona: Check,         klasa: 'bg-blue-50 text-blue-600',       rodzaj: 'Zaproszenie' },
  reserve_claim_offered:       { Ikona: TicketCheck,   klasa: 'bg-blue-50 text-blue-600',       rodzaj: 'Wolne miejsce' },
  ogloszenie_w_grupie:         { Ikona: MessageCircle, klasa: 'bg-pink-50 text-pink-600',       rodzaj: 'Ogłoszenie' },
  niepotwierdzony_wpis_goscia: { Ikona: UserPlus,      klasa: 'bg-blue-50 text-blue-600',       rodzaj: 'Potwierdź' },
  wiadomosc_w_meczu:           { Ikona: MessageCircle, klasa: 'bg-pink-50 text-pink-600',       rodzaj: 'Wiadomość' },
  wiadomosc_w_grupie:          { Ikona: MessageCircle, klasa: 'bg-pink-50 text-pink-600',       rodzaj: 'Wiadomość' },
  // Sześć typów, które realnie przychodzą (migracje `076`, `079`, `113`, `129`,
  // `135`), a mapy nie miały — wszystkie lądowały pod szarym dzwonkiem
  // z podpisem „Powiadomienie", czyli dokładnie tam, gdzie ikona przestaje
  // cokolwiek nieść. Kolory wg konwencji z AGENTS.md: niebieski wyłącznie tam,
  // gdzie trzeba podjąć decyzję; stan składu i przypomnienie są neutralne.
  zapis_zaakceptowany:         { Ikona: Check,         klasa: 'bg-primary-50 text-primary-700', rodzaj: 'Zapis przyjęty' },
  prosba_odrzucona:            { Ikona: X,             klasa: 'bg-slate-100 text-slate-500',    rodzaj: 'Prośba odrzucona' },
  usuniety_ze_skladu:          { Ikona: UserMinus,     klasa: 'bg-slate-100 text-slate-500',    rodzaj: 'Poza składem' },
  komplet_skladu:              { Ikona: Users,         klasa: 'bg-primary-50 text-primary-700', rodzaj: 'Komplet' },
  zwolnilo_sie_miejsce:        { Ikona: Users,         klasa: 'bg-primary-50 text-primary-700', rodzaj: 'Wolne miejsce' },
  przypomnienie_o_meczu:       { Ikona: Clock,         klasa: 'bg-primary-50 text-primary-700', rodzaj: 'Przypomnienie' },
  oferta_wygasla:              { Ikona: Clock,         klasa: 'bg-slate-100 text-slate-500',    rodzaj: 'Czas minął' },
  // Siedem typów znalezionych w szóstej rundzie audytu (2026-09-12,
  // ustalenie `S-7`) — realnie wstawiane przez bazę, bez wiersza tutaj.
  po_meczu_do_domkniecia:      { Ikona: ClipboardCheck, klasa: 'bg-slate-100 text-slate-600',    rodzaj: 'Do domknięcia' },
  sklady_opublikowane:         { Ikona: ListChecks,    klasa: 'bg-primary-50 text-primary-700', rodzaj: 'Składy gotowe' },
  // Trwałe usunięcie meczu (nie odwołanie) — czerwono, tak jak `mecz_odwolany`,
  // ale własna ikona: „zniknął z listy" to inna wiadomość niż „nie odbędzie się".
  mecz_usuniety:               { Ikona: Trash2,        klasa: 'bg-red-50 text-red-600',         rodzaj: 'Mecz usunięty' },
  // Nudge o profilu, nie o uczestnictwie w meczu — nie niebieski (`blue-*` jest
  // zarezerwowany dla akceptacji uczestnictwa, patrz AGENTS.md).
  uzupelnij_profil:            { Ikona: UserCog,       klasa: 'bg-slate-100 text-slate-600',    rodzaj: 'Profil' },
  // Serie cykliczne (`SHOW_RECURRING`) — flaga dziś wyłączona, ale istniejące
  // serie i ich powiadomienia zostają w kodzie nietknięte (patrz AGENTS.md).
  nowy_termin_serii:           { Ikona: Repeat,        klasa: 'bg-primary-50 text-primary-700', rodzaj: 'Nowy termin serii' },
  // Próg „gra się odbędzie" (`SHOW_MIN_PLAYERS_THRESHOLD`) — flaga dziś
  // wyłączona, ale mecze założone przed jej wyłączeniem mogą mieć próg
  // ustawiony, więc te dwa typy wciąż realnie wychodzą.
  gra_potwierdzona:            { Ikona: CheckCircle,   klasa: 'bg-primary-50 text-primary-700', rodzaj: 'Gramy' },
  // Bursztyn, nie czerwień: „brakuje graczy" jest ostrzeżeniem, o które
  // jeszcze można zadbać, nie awarią — ta sama para znaczeń co bursztynowy
  // baner „Obserwujesz" w `EventDetailClient.tsx`.
  gra_zagrozona:                { Ikona: AlertTriangle, klasa: 'bg-amber-50 text-amber-700',    rodzaj: 'Gra zagrożona' },
};

export const IKONA_DOMYSLNA: IkonaPowiadomienia = { Ikona: Bell, klasa: 'bg-slate-100 text-slate-500', rodzaj: 'Powiadomienie' };
