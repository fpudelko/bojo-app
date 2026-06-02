import Link from 'next/link';
import Header from '@/components/layout/Header';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Regulamin',
  description: 'Zasady korzystania z serwisu Bojo.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 mb-3">{title}</h2>
      <div className="text-sm text-gray-700 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

export default function RegulaminPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">

        {/* Legal review notice */}
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <strong>Uwaga:</strong> Poniższy dokument to szablon startowy przygotowany na potrzeby
          prototypu. Przed uruchomieniem produkcyjnym powinien zostać zweryfikowany przez
          prawnika znającego polskie prawo (ustawa o świadczeniu usług drogą elektroniczną,
          kodeks cywilny, RODO).
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Regulamin serwisu Bojo</h1>
        <p className="text-sm text-gray-400 mb-8">Ostatnia aktualizacja: czerwiec 2025</p>

        <Section title="§1 Postanowienia ogólne">
          <p>
            1. Serwis internetowy <strong>Bojo</strong> (dalej: „Serwis") dostępny pod adresem
            bojo.app jest platformą umożliwiającą organizowanie wydarzeń sportowych,
            znajdowanie boisk oraz łączenie graczy w Poznaniu i okolicach.
          </p>
          <p>
            2. Operatorem Serwisu jest [nazwa podmiotu], z siedzibą w [adres].
            Kontakt: <a href="mailto:kontakt@bojo.app" className="text-primary-600 hover:underline">kontakt@bojo.app</a>.
          </p>
          <p>
            3. Korzystanie z Serwisu jest dobrowolne i bezpłatne (w zakresie podstawowym).
          </p>
        </Section>

        <Section title="§2 Rejestracja i konto">
          <p>
            1. Dostęp do pełnej funkcjonalności Serwisu wymaga zalogowania za pomocą konta Google.
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
        </Section>

        <Section title="§3 Zasady korzystania z Serwisu">
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
        </Section>

        <Section title="§4 Organizowanie wydarzeń">
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
        </Section>

        <Section title="§5 Prywatność i dane osobowe">
          <p>
            Zasady przetwarzania danych osobowych opisuje{' '}
            <Link href="/prywatnosc" className="text-primary-600 hover:underline">
              Polityka prywatności
            </Link>.
          </p>
        </Section>

        <Section title="§6 Odpowiedzialność">
          <p>
            1. Serwis świadczony jest w stanie „takim, jaki jest" (as-is). Operator nie
            gwarantuje nieprzerwanego działania i może przeprowadzać przerwy techniczne.
          </p>
          <p>
            2. Operator nie ponosi odpowiedzialności za treści publikowane przez Użytkowników
            ani za zdarzenia organizowane za pośrednictwem Serwisu.
          </p>
          <p>
            3. Całkowita odpowiedzialność Operatora wobec Użytkownika ograniczona jest do
            wartości ewentualnie uiszczonej przez Użytkownika opłaty w ciągu ostatnich
            12 miesięcy.
          </p>
        </Section>

        <Section title="§7 Własność intelektualna">
          <p>
            1. Kod źródłowy i grafiki Serwisu są własnością Operatora lub są używane
            na podstawie licencji. Zabronione jest ich kopiowanie bez zgody.
          </p>
          <p>
            2. Dane i treści dodawane przez Użytkownika (opisy wydarzeń, nazwy) pozostają
            własnością Użytkownika. Użytkownik udziela Operatorowi nieodpłatnej licencji
            na ich prezentację w ramach Serwisu.
          </p>
        </Section>

        <Section title="§8 Usunięcie konta">
          <p>
            Użytkownik może usunąć konto w dowolnym momencie w sekcji Profil → „Usuń konto".
            Po usunięciu dane osobowe zostaną zanonimizowane lub usunięte zgodnie z
            Polityką prywatności. Treści wydarzeń (opisy, wyniki) mogą zostać zachowane
            w formie anonimowej.
          </p>
        </Section>

        <Section title="§9 Zmiany Regulaminu">
          <p>
            Operator zastrzega prawo do zmiany Regulaminu. O istotnych zmianach Użytkownicy
            będą informowani z co najmniej 14-dniowym wyprzedzeniem poprzez wiadomość
            e-mail lub powiadomienie w Serwisie.
          </p>
        </Section>

        <Section title="§10 Prawo właściwe i rozstrzyganie sporów">
          <p>
            Do stosunków objętych niniejszym Regulaminem stosuje się prawo polskie.
            Wszelkie spory będą rozstrzygane przez sąd właściwy dla siedziby Operatora,
            z zastrzeżeniem przepisów o ochronie konsumentów.
          </p>
        </Section>

        <div className="mt-10 pt-6 border-t border-gray-200 text-xs text-gray-400 text-center">
          <Link href="/" className="hover:text-gray-600">← Wróć do strony głównej</Link>
          {' · '}
          <Link href="/prywatnosc" className="hover:text-gray-600">Polityka prywatności</Link>
        </div>
      </main>
    </div>
  );
}
