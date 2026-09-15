import type { Metadata } from 'next';
import Link from 'next/link';
import WylaczAlertClient from './WylaczAlertClient';

/**
 * „Nie chcę więcej takich wiadomości" — wyłącznik alertu z samego maila.
 *
 * ISTNIEJE PO TO, ŻEBY ALERT BEZTERMINOWY BYŁ UCZCIWY. Od 2026-09-14 alert
 * o nowych meczach domyślnie nie wygasa (decyzja właściciela), a jedyna droga
 * wyłączenia prowadziła dotąd przez zalogowanie się i znalezienie okna alertu.
 * Mail czyta się w skrzynce, często na innym urządzeniu i pół roku po
 * założeniu alertu — „wejdź do aplikacji i poszukaj" nie jest wtedy żadnym
 * wyjściem, tylko wyjaśnieniem, dlaczego ktoś oznaczy to jako spam.
 *
 * DZIAŁA BEZ LOGOWANIA, bo taki jest cały sens: link przychodzi do skrzynki,
 * która JEST dowodem tożsamości. Token jest jednorazowo wygenerowanym uuid
 * (`game_alerts.wylacz_token`, migracja `149`) i nie daje nic poza tą jedną
 * operacją — wyłączenie leci przez funkcję `wylacz_alert_tokenem()`
 * (`SECURITY DEFINER`), która umie wyłącznie ustawić `is_active = false`.
 * Asercje w `supabase/test/rls.sql` pilnują, że tokenem nie da się ani
 * przeczytać cudzego alertu, ani nic w nim nadpisać.
 *
 * `noindex`: adres z sekretem nie ma prawa trafić do wyszukiwarki.
 */
export const metadata: Metadata = {
  title: 'Wyłącz powiadomienia o nowych meczach — Bojo',
  robots: { index: false, follow: false },
};

export default function WylaczAlertPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <WylaczAlertClient />
      <Link
        href="/wydarzenia"
        className="mt-6 text-center text-sm font-semibold text-primary-700 hover:text-primary-800"
      >
        Zobacz mecze w Bojo
      </Link>
    </main>
  );
}
