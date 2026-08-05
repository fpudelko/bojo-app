import Link from 'next/link';
import Header from '@/components/layout/Header';
import { LegalSection, ContactMail } from '@/components/legal/LegalSection';
import { LEGAL } from '@/lib/legal';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Regulamin',
  description: 'Zasady korzystania z serwisu Bojo.',
  alternates: { canonical: '/regulamin' },
};

export default function RegulaminPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">

        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Regulamin serwisu Bojo</h1>
        <p className="text-sm text-slate-400 mb-8">Ostatnia aktualizacja: {LEGAL.lastUpdated}</p>

        <LegalSection title="§1 Postanowienia ogólne">
          <p>
            1. Serwis internetowy <strong>{LEGAL.siteName}</strong> (dalej: „Serwis") dostępny
            pod adresem {LEGAL.siteDomain} jest platformą umożliwiającą organizowanie
            wydarzeń sportowych, znajdowanie boisk oraz łączenie graczy w całej Polsce.
          </p>
          <p>
            2. Operatorem Serwisu jest {LEGAL.operator}. Kontakt: <ContactMail />.
          </p>
          <p>
            3. Korzystanie z Serwisu jest dobrowolne i bezpłatne (w zakresie podstawowym).
          </p>
        </LegalSection>

        <LegalSection title="§2 Rejestracja i konto">
          <p>
            1. Dostęp do pełnej funkcjonalności Serwisu wymaga zalogowania za pomocą konta
            Google lub adresu e-mail.
          </p>
          <p>
            2. Użytkownik może posiadać tylko jedno konto.
          </p>
          <p>
            3. Użytkownik zobowiązuje się do podawania prawdziwych danych i nieudostępniania
            danych logowania osobom trzecim.
          </p>
          <p>
            4. Operator zastrzega prawo do zawieszenia lub usunięcia konta naruszającego Regulamin,
            bez wcześniejszego powiadomienia.
          </p>
        </LegalSection>

        <LegalSection title="§3 Zasady korzystania z Serwisu">
          <p>Użytkownik zobowiązuje się do:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Korzystania z Serwisu zgodnie z prawem polskim i unijnym.</li>
            <li>
              Niepublikowania treści obraźliwych, wulgarnych, naruszających prawa osób
              trzecich lub przepisy prawa.
            </li>
            <li>
              Nieorganizowania wydarzeń służących celom niezgodnym z prawem
              lub dobrymi obyczajami.
            </li>
            <li>Niepodejmowania działań mogących zakłócić działanie Serwisu (spam, ataki).</li>
            <li>
              Rzetelnego informowania o wydarzeniach, w tym o rzeczywistej dacie, miejscu
              i charakterze zajęć.
            </li>
          </ul>
        </LegalSection>

        <LegalSection title="§4 Organizowanie wydarzeń">
          <p>
            1. Użytkownik tworzący wydarzenie (dalej: „Organizator") jest odpowiedzialny za
            jego treść, poinformowanie uczestników o warunkach i ewentualne odwołanie.
          </p>
          <p>
            2. Organizator nie może pobierać opłat od uczestników bez ich wyraźnej zgody.
            Funkcja śledzenia płatności służy wyłącznie do organizacji kosztów wspólnych
            (np. wynajmu boiska).
          </p>
          <p>
            3. Serwis nie jest stroną umów pomiędzy Organizatorem a uczestnikami
            i nie ponosi odpowiedzialności za wypadki, szkody lub konflikty powstałe
            w trakcie wydarzeń.
          </p>
        </LegalSection>

        <LegalSection title="§5 Prywatność i dane osobowe">
          <p>
            Zasady przetwarzania danych osobowych opisuje{' '}
            <Link href="/prywatnosc" className="text-primary-600 hover:underline">
              Polityka prywatności
            </Link>.
          </p>
        </LegalSection>

        <LegalSection title="§6 Odpowiedzialność">
          <p>
            1. Serwis świadczony jest w stanie „takim, jaki jest" (as-is). Operator nie
            gwarantuje nieprzerwanego działania i może przeprowadzać przerwy techniczne.
          </p>
          <p>
            2. Operator nie ponosi odpowiedzialności za treści publikowane przez Użytkowników
            ani za zdarzenia organizowane za pośrednictwem Serwisu.
          </p>
          <p>
            3. Serwis jest bezpłatny. Operator odpowiada wyłącznie za szkody wyrządzone
            umyślnie; w pozostałym zakresie odpowiedzialność jest wyłączona w granicach
            dopuszczalnych prawem, przy czym wyłączenie to nie dotyczy konsumentów w
            zakresie, w jakim przepisy bezwzględnie obowiązujące na to nie pozwalają.
          </p>
        </LegalSection>

        <LegalSection title="§7 Własność intelektualna">
          <p>
            1. Kod źródłowy i grafiki Serwisu są własnością Operatora lub są używane
            na podstawie licencji. Zabronione jest ich kopiowanie bez zgody.
          </p>
          <p>
            2. Dane i treści dodawane przez Użytkownika (opisy wydarzeń, nazwy) pozostają
            własnością Użytkownika. Użytkownik udziela Operatorowi nieodpłatnej licencji
            na ich prezentację w ramach Serwisu.
          </p>
        </LegalSection>

        <LegalSection title="§8 Usunięcie konta">
          <p>
            Użytkownik może usunąć konto w dowolnym momencie w sekcji Profil → „Usuń konto".
            Po usunięciu dane osobowe zostaną zanonimizowane lub usunięte zgodnie z
            Polityką prywatności. Treści wydarzeń (opisy, wyniki) mogą zostać zachowane
            w formie anonimowej.
          </p>
        </LegalSection>

        <LegalSection title="§9 Reklamacje">
          <p>
            1. Reklamacje dotyczące działania Serwisu można zgłaszać na adres <ContactMail />,
            podając opis problemu oraz adres e-mail powiązany z kontem.
          </p>
          <p>
            2. Operator rozpatruje reklamację w terminie 14 dni kalendarzowych od jej
            otrzymania i przesyła odpowiedź na adres e-mail, z którego zgłoszenie wpłynęło.
          </p>
        </LegalSection>

        <LegalSection title="§10 Odstąpienie od umowy">
          <p>
            Usługa jest bezpłatna i świadczona bezterminowo. Użytkownik może w każdej
            chwili zakończyć korzystanie z Serwisu, usuwając konto (Profil → „Usuń konto"),
            bez podania przyczyny i bez żadnych kosztów — co jest równoważne z odstąpieniem
            od umowy.
          </p>
        </LegalSection>

        <LegalSection title="§11 Zmiany Regulaminu">
          <p>
            Operator zastrzega prawo do zmiany Regulaminu. O istotnych zmianach Użytkownicy
            będą informowani z co najmniej 14-dniowym wyprzedzeniem poprzez wiadomość
            e-mail lub powiadomienie w Serwisie.
          </p>
        </LegalSection>

        <LegalSection title="§12 Prawo właściwe i rozstrzyganie sporów">
          <p>
            1. Do stosunków objętych niniejszym Regulaminem stosuje się prawo polskie.
            Wszelkie spory będą rozstrzygane przez sąd właściwy według przepisów kodeksu
            postępowania cywilnego.
          </p>
          <p>
            2. Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji
            i dochodzenia roszczeń, w tym z platformy ODR Komisji Europejskiej:{' '}
            <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              ec.europa.eu/consumers/odr
            </a>.
          </p>
        </LegalSection>

        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400 text-center">
          <Link href="/" className="hover:text-slate-600 dark:hover:text-slate-300">← Wróć do strony głównej</Link>
          {' · '}
          <Link href="/prywatnosc" className="hover:text-slate-600 dark:hover:text-slate-300">Polityka prywatności</Link>
        </div>
      </main>
    </div>
  );
}
