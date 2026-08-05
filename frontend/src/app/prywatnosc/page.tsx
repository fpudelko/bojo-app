import Link from 'next/link';
import Header from '@/components/layout/Header';
import { LegalSection, ContactMail } from '@/components/legal/LegalSection';
import { LEGAL } from '@/lib/legal';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Polityka prywatności',
  description: 'Jak Bojo przetwarza dane osobowe użytkowników.',
  alternates: { canonical: '/prywatnosc' },
};

export default function PrywatnosePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">

        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Polityka prywatności</h1>
        <p className="text-sm text-slate-400 mb-8">Ostatnia aktualizacja: {LEGAL.lastUpdated}</p>

        <LegalSection title="1. Administrator danych">
          <p>
            Administratorem danych osobowych jest <strong>{LEGAL.operator}</strong>, operator
            serwisu {LEGAL.siteDomain} (dalej: „Serwis"). Kontakt we wszystkich sprawach
            dotyczących danych osobowych: <ContactMail />. Nie wyznaczyliśmy inspektora
            ochrony danych — zgłoszenia trafiają na powyższy adres.
          </p>
        </LegalSection>

        <LegalSection title="2. Jakie dane zbieramy">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Adres e-mail</strong> — pobierany od Google podczas logowania przez OAuth 2.0 albo podawany bezpośrednio przy logowaniu e-mailem.</li>
            <li><strong>Imię / pseudonim</strong> — podawany przez użytkownika jako wyświetlana nazwa.</li>
            <li><strong>Zdjęcie profilowe</strong> — opcjonalne, wgrywane przez użytkownika.</li>
            <li>
              <strong>Numer telefonu</strong> — opcjonalny, podawany wyłącznie za wyraźną
              zgodą. Wysyłka SMS nie jest jeszcze uruchomiona — numer jest wyłącznie
              przechowywany na potrzeby przyszłych powiadomień i możesz go w każdej
              chwili usunąć w Profilu.
            </li>
            <li>
              <strong>Lokalizacje wydarzeń</strong> — współrzędne lub adresy boisk i miejsc
              dodawanych przez organizatorów wydarzeń.
            </li>
            <li>
              <strong>Dane o uczestnictwie</strong> — informacje o zapisaniu się na mecze,
              statusie płatności, wynikach, statystykach gier.
            </li>
            <li>
              <strong>Dane techniczne</strong> — logi zapytań, adres IP (przechowywany przez
              dostawcę infrastruktury, Supabase).
            </li>
          </ul>
        </LegalSection>

        <LegalSection title="3. Dobrowolność podania danych">
          <p>
            Adres e-mail jest niezbędny do założenia konta — bez niego korzystanie z
            Serwisu nie jest możliwe. Imię, zdjęcie profilowe i numer telefonu są
            całkowicie dobrowolne i nie wpływają na dostęp do podstawowych funkcji
            Serwisu.
          </p>
        </LegalSection>

        <LegalSection title="4. Cel przetwarzania danych">
          <ul className="list-disc pl-5 space-y-1">
            <li>Umożliwienie logowania i identyfikacji użytkownika w Serwisie.</li>
            <li>Organizowanie i zarządzanie wydarzeniami sportowymi.</li>
            <li>Wysyłka powiadomień o wydarzeniach (SMS, e-mail) — wyłącznie za zgodą.</li>
            <li>Prowadzenie statystyk aktywności gracza.</li>
            <li>Zapewnienie bezpieczeństwa Serwisu (rate limiting, logi).</li>
          </ul>
        </LegalSection>

        <LegalSection title="5. Podstawa prawna">
          <ul className="list-disc pl-5 space-y-1">
            <li>Art. 6 ust. 1 lit. b RODO — wykonanie umowy (korzystanie z Serwisu).</li>
            <li>Art. 6 ust. 1 lit. a RODO — zgoda (numer telefonu, powiadomienia).</li>
            <li>Art. 6 ust. 1 lit. f RODO — prawnie uzasadniony interes (bezpieczeństwo).</li>
          </ul>
        </LegalSection>

        <LegalSection title="6. Jak długo przechowujemy dane">
          <ul className="list-disc pl-5 space-y-1">
            <li>Dane konta: przez czas istnienia konta + 30 dni po usunięciu konta.</li>
            <li>Dane uczestnictwa (anonimizowane): po usunięciu konta imię zastępowane jest
              ciągiem „Usunięty użytkownik", a identyfikator użytkownika jest usuwany.</li>
            <li>Logi techniczne: zgodnie z polityką Supabase (zazwyczaj 30–90 dni).</li>
          </ul>
        </LegalSection>

        <LegalSection title="7. Komu udostępniamy dane">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Supabase Inc.</strong> — dostawca infrastruktury bazy danych
              i uwierzytelniania. Dane przechowywane na serwerach w UE (region
              eu-central-1, Frankfurt). Supabase jest przetwarzającym dane w rozumieniu
              RODO.
            </li>
            <li>
              <strong>Google LLC</strong> — jako dostawca uwierzytelniania OAuth 2.0.
              Google może przetwarzać dane zgodnie z własną polityką prywatności.
            </li>
            <li>
              <strong>Dostawca bramki SMS</strong> — dopiero gdy funkcja powiadomień SMS
              zostanie uruchomiona i wyłącznie dla użytkowników, którzy wyrażą na to
              zgodę. Jego nazwa zostanie podana w tej polityce przed pierwszą wysyłką.
            </li>
            <li>Nie sprzedajemy danych osobowych żadnym podmiotom trzecim.</li>
          </ul>
        </LegalSection>

        <LegalSection title="8. Przekazywanie danych poza EOG">
          <p>
            Dane przechowywane u Supabase nie opuszczają Europejskiego Obszaru
            Gospodarczego (serwery w Frankfurcie). Logowanie przez Google może wiązać
            się z przetwarzaniem danych przez Google LLC w USA — podstawą takiego
            transferu są standardowe klauzule umowne oraz przynależność Google do
            programu Data Privacy Framework UE–USA.
          </p>
        </LegalSection>

        <LegalSection title="9. Prawa użytkownika">
          <p>Na podstawie RODO przysługują Ci następujące prawa:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Dostęp</strong> — prawo uzyskania kopii swoich danych osobowych.</li>
            <li><strong>Sprostowanie</strong> — możliwość poprawienia błędnych danych w ustawieniach profilu.</li>
            <li>
              <strong>Usunięcie</strong> (prawo do bycia zapomnianym) — możliwość usunięcia
              konta i danych w sekcji Profil → „Usuń konto". Skutkuje anonimizacją zapisów
              uczestnictwa i usunięciem konta.
            </li>
            <li>
              <strong>Ograniczenie przetwarzania</strong> — prawo żądania czasowego
              ograniczenia przetwarzania danych w przypadkach przewidzianych RODO.
            </li>
            <li>
              <strong>Cofnięcie zgody</strong> — możliwość cofnięcia zgody na przetwarzanie
              numeru telefonu lub powiadomień w dowolnym momencie (Profil → ustawienia).
            </li>
            <li><strong>Przeniesienie</strong> — prawo do otrzymania danych w formacie
              nadającym się do odczytu maszynowego (na żądanie).</li>
            <li><strong>Sprzeciw</strong> — prawo do sprzeciwu wobec przetwarzania na
              podstawie prawnie uzasadnionego interesu.</li>
          </ul>
          <p className="mt-3">
            Aby skorzystać z praw, skontaktuj się pod adresem <ContactMail />.
            Masz również prawo złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych (UODO).
          </p>
        </LegalSection>

        <LegalSection title="10. Brak profilowania">
          <p>
            Bojo nie profiluje użytkowników i nie podejmuje wobec nich decyzji w sposób
            wyłącznie zautomatyzowany (art. 22 RODO).
          </p>
        </LegalSection>

        <LegalSection title="11. Pliki cookie">
          <p>
            Serwis używa wyłącznie niezbędnych plików cookie i danych lokalnych:
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-1.5 pr-3 font-semibold">Nazwa</th>
                  <th className="py-1.5 pr-3 font-semibold">Cel</th>
                  <th className="py-1.5 font-semibold">Czas życia</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1.5 pr-3 font-mono">sb-*-auth-token</td>
                  <td className="py-1.5 pr-3">Sesja logowania (Supabase Auth)</td>
                  <td className="py-1.5">do wylogowania / ok. 1 roku</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 font-mono">bojo_cookie_consent_v1</td>
                  <td className="py-1.5 pr-3">Zapamiętanie zamknięcia baneru cookies (localStorage)</td>
                  <td className="py-1.5">bezterminowo</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            Nie używamy plików cookie do śledzenia aktywności ani celów reklamowych.
            Przyszłe funkcje analityczne (o ile zostaną wprowadzone) będą wymagały
            odrębnej zgody i zostaną opisane w aktualizacji niniejszej polityki.
          </p>
        </LegalSection>

        <LegalSection title="12. Bezpieczeństwo">
          <p>
            Dane przechowywane są na infrastrukturze Supabase z włączonymi regułami
            Row Level Security (RLS), zapewniającymi, że każdy użytkownik ma dostęp
            wyłącznie do swoich danych. Komunikacja odbywa się przez szyfrowane połączenie HTTPS.
          </p>
        </LegalSection>

        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400 text-center">
          <Link href="/" className="hover:text-slate-600 dark:hover:text-slate-300">← Wróć do strony głównej</Link>
          {' · '}
          <Link href="/regulamin" className="hover:text-slate-600 dark:hover:text-slate-300">Regulamin</Link>
        </div>
      </main>
    </div>
  );
}
