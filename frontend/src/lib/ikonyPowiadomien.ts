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
// listy z tym, co realnie wstawiają `supabase/migrations/*.sql` ORAZ funkcje
// brzegowe w `supabase/functions/`, i pada, gdy się rozjadą. Te drugie doszły
// 2026-09-14: `game_alert` wstawia funkcja, nie migracja, i przez to wymykał
// się strażnikowi — lądował pod szarym dzwonkiem i nie dało się go wyłączyć.
import {
  Bell, BellRing, CalendarCheck, CalendarClock, CalendarPlus, CalendarX, Check, CheckCircle,
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
  // Wstawiany przez funkcję brzegową `notify-game-alert`, nie przez migrację —
  // i dlatego przez rok nie miał ani ikony, ani wiersza w ustawieniach:
  // strażnik `typyPowiadomien.test.ts` czytał wyłącznie migracje. Dziś czyta
  // też `supabase/functions`.
  //
  // Pomarańczowy zgodnie z konwencją z AGENTS.md: „nowość, o której jeszcze
  // nie wiesz" — bez konkretnej wiadomości do przeczytania i bez decyzji do
  // podjęcia. Dokładnie to znaczy alert o nowym meczu w okolicy.
  game_alert:                  { Ikona: BellRing,      klasa: 'bg-orange-50 text-orange-600',   rodzaj: 'Nowy mecz w okolicy' },
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
  // Turniej (migracja 145). Zgłoszenie prosi ORGANIZATORA o decyzję —
  // niebieski, jak każde „wymaga akceptacji uczestnictwa" w AGENTS.md.
  // Decyzja organizatora i przejęcie drużyny są neutralne (nie awaria).
  turniej_zgloszenie_druzyny:  { Ikona: UserPlus,      klasa: 'bg-blue-50 text-blue-600',       rodzaj: 'Zgłoszenie' },
  turniej_druzyna_przyjeta:    { Ikona: CheckCircle,   klasa: 'bg-primary-50 text-primary-700', rodzaj: 'Przyjęci' },
  turniej_druzyna_odrzucona:   { Ikona: X,             klasa: 'bg-slate-100 text-slate-600',    rodzaj: 'Decyzja' },
  turniej_kapitan_przejal:     { Ikona: UserCog,       klasa: 'bg-slate-100 text-slate-600',    rodzaj: 'Kapitan' },
  // Zaproszenie do drużyny (migracja 154). NEUTRALNE, nie niebieskie: niebieski
  // jest w AGENTS.md zarezerwowany dla „wymaga akceptacji uczestnictwa", czyli
  // dla decyzji, na którą ktoś inny CZEKA i która go blokuje. Zaproszenie
  // niczego nie blokuje — dokładnie jak `zaproszenie_na_mecz`.
  turniej_zaproszenie_do_druzyny: { Ikona: UserPlus,     klasa: 'bg-slate-100 text-slate-600',    rodzaj: 'Zaproszenie' },
  // Terminarz (migracja 146) — neutralne: to informacja o planie, nie decyzja
  // do podjęcia ani awaria.
  turniej_terminarz_gotowy:   { Ikona: CalendarPlus,  klasa: 'bg-primary-50 text-primary-700', rodzaj: 'Terminarz' },
  turniej_zmiana_terminu:     { Ikona: CalendarClock, klasa: 'bg-slate-100 text-slate-600',    rodzaj: 'Nowy termin' },
  // Ogłoszenie organizatora (migracja 150) — różowy, bo to wiadomość, tak
  // samo jak `ogloszenie_w_grupie`. Jedyny różowy typ w tym module.
  turniej_ogloszenie:         { Ikona: MessageCircle, klasa: 'bg-pink-50 text-pink-600',       rodzaj: 'Ogłoszenie' },
};

export const IKONA_DOMYSLNA: IkonaPowiadomienia = { Ikona: Bell, klasa: 'bg-slate-100 text-slate-500', rodzaj: 'Powiadomienie' };
