import { Phone } from 'lucide-react';
import { linkTelefonu } from '@/lib/telefon';

/**
 * Numer gracza w składzie, widoczny dla organizatora meczu z włączonym
 * „Wymagaj numeru telefonu” (migracja `193`). Dotknięcie dzwoni.
 *
 * „Bez numeru” zamiast pustki: przy włączonym wymogu brak numeru coś znaczy
 * (gracz był w składzie przed włączeniem, organizator dopisał gościa ręcznie
 * albo gracz skasował numer z profilu), a pusty wiersz czytałby się jak błąd
 * ładowania.
 */
export default function TelefonUczestnika({ telefon, className = '' }: {
  telefon?: string;
  className?: string;
}) {
  if (!telefon) {
    return (
      <span className={`mt-0.5 flex items-center gap-1 text-[11px] text-slate-400 ${className}`}>
        <Phone className="h-3 w-3 shrink-0" /> bez numeru
      </span>
    );
  }
  return (
    <a
      href={linkTelefonu(telefon)}
      className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary-700 hover:underline ${className}`}
    >
      <Phone className="h-3 w-3 shrink-0" /> {telefon}
    </a>
  );
}
