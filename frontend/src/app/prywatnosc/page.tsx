import Link from 'next/link';
import Header from '@/components/layout/Header';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Polityka prywatności',
  description: 'Jak Bojo przetwarza dane osobowe użytkowników.',
  alternates: { canonical: '/prywatnosc' },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-slate-900 mb-3">{title}</h2>
      <div className="text-sm text-slate-700 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrywatnosePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">

        {/* Legal review notice */}
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <strong>Uwaga:</strong> Poniższy dokument to szablon startowy przygotowany na potrzeby
          prototypu. Przed uruchomieniem produkcyjnym powinien zostać zweryfikowany przez
          prawnika znającego RODO i polskie prawo ochrony danych.
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">Polityka prywatności</h1>
        <p className="text-sm text-slate-400 mb-8">Ostatnia aktualizacja: czerwiec 2025</p>

        <Section title="1. Administrator danych">
          <p>
            Administratorem danych osobowych jest operator serwisu <strong>Bojo</strong>
            (dalej: „Serwis"). Kontakt: <a href="mailto:kontakt@bojo.app" className="text-primary-600 hover:underline">kontakt@bojo.app</a>.
          </p>
        </Section>

        <Section title="2. Jakie dane zbieramy">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Adres e-mail</strong> — pobierany od Google podczas logowania przez OAuth 2.0.</li>
            <li><strong>Imię / pseudonim</strong> — podawany przez użytkownika jako wyświetlana nazwa.</li>
            <li><strong>Zdjęcie profilowe</strong> — opcjonalne, wgrywane przez użytkownika.</li>
            <li>
              <strong>Numer telefonu</strong> — opcjonalny, podawany wyłącznie za wyraźną
              zgodą, wykorzystywany do powiadomień SMS o wydarzeniach.
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
        </Section>

        <Section title="3. Cel przetwarzania danych">
          <ul className="list-disc pl-5 space-y-1">
            <li>Umożliwienie logowania i identyfikacji użytkownika w Serwisie.</li>
            <li>Organizowanie i zarządzanie wydarzeniami sportowymi.</li>
            <li>Wysyłka powiadomień o wydarzeniach (SMS, e-mail) — wyłącznie za zgodą.</li>
            <li>Prowadzenie statystyk aktywności gracza.</li>
            <li>Zapewnienie bezpieczeństwa Serwisu (rate limiting, logi).</li>
          </ul>
        </Section>

        <Section title="4. Podstawa prawna">
          <ul className="list-disc pl-5 space-y-1">
            <li>Art. 6 ust. 1 lit. b RODO — wykonanie umowy (korzystanie z Serwisu).</li>
            <li>Art. 6 ust. 1 lit. a RODO — zgoda (numer telefonu, powiadomienia).</li>
            <li>Art. 6 ust. 1 lit. f RODO — prawnie uzasadniony interes (bezpieczeństwo).</li>
          </ul>
        </Section>

        <Section title="5. Jak długo przechowujemy dane">
          <ul className="list-disc pl-5 space-y-1">
            <li>Dane konta: przez czas istnienia konta + 30 dni po usunięciu konta.</li>
            <li>Dane uczestnictwa (anonimizowane): po usunięciu konta imię zastępowane jest
              ciągiem „Usunięty użytkownik", a identyfikator użytkownika jest usuwany.</li>
            <li>Logi techniczne: zgodnie z polityką Supabase (zazwyczaj 30–90 dni).</li>
          </ul>
        </Section>

        <Section title="6. Komu udostępniamy dane">
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
              <strong>Dostawcy SMS</strong> (SMSAPI / Twilio) — wyłącznie gdy użytkownik
              wyrazi zgodę na powiadomienia SMS i poda numer telefonu.
            </li>
            <li>Nie sprzedajemy danych osobowych żadnym podmiotom trzecim.</li>
          </ul>
        </Section>

        <Section title="7. Prawa użytkownika">
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
              <strong>Cofnięcie zgody</strong> — możliwość cofnięcia zgody na przetwarzanie
              numeru telefonu lub powiadomień w dowolnym momencie (Profil → ustawienia).
            </li>
            <li><strong>Przeniesienie</strong> — prawo do otrzymania danych w formacie
              nadającym się do odczytu maszynowego (na żądanie).</li>
            <li><strong>Sprzeciw</strong> — prawo do sprzeciwu wobec przetwarzania na
              podstawie prawnie uzasadnionego interesu.</li>
          </ul>
          <p className="mt-3">
            Aby skorzystać z praw, skontaktuj się pod adresem{' '}
            <a href="mailto:kontakt@bojo.app" className="text-primary-600 hover:underline">kontakt@bojo.app</a>.
            Masz również prawo złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych (UODO).
          </p>
        </Section>

        <Section title="8. Pliki cookie">
          <p>
            Serwis używa wyłącznie niezbędnych plików cookie do zarządzania sesją logowania
            (dostarczanych przez Supabase Auth). Nie używamy plików cookie do śledzenia
            aktywności ani celów reklamowych.
          </p>
          <p className="mt-2">
            Przyszłe funkcje analityczne (o ile zostaną wprowadzone) będą wymagały odrębnej
            zgody i zostaną opisane w aktualizacji niniejszej polityki.
          </p>
        </Section>

        <Section title="9. Bezpieczeństwo">
          <p>
            Dane przechowywane są na infrastrukturze Supabase z włączonymi regułami
            Row Level Security (RLS), zapewniającymi, że każdy użytkownik ma dostęp
            wyłącznie do swoich danych. Komunikacja odbywa się przez szyfrowane połączenie HTTPS.
          </p>
        </Section>

        <div className="mt-10 pt-6 border-t border-slate-200 text-xs text-slate-400 text-center">
          <Link href="/" className="hover:text-slate-600">← Wróć do strony głównej</Link>
          {' · '}
          <Link href="/regulamin" className="hover:text-slate-600">Regulamin</Link>
        </div>
      </main>
    </div>
  );
}
