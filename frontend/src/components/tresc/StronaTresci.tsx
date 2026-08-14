import Header from '@/components/layout/Header';
import SiteFooter from '@/components/layout/SiteFooter';
import { breadcrumbsJsonLd } from '@/lib/structuredData';

/**
 * Powłoka wspólna dla stron treści (`/jak-dziala-bojo`, `/dlaczego-bojo`,
 * `/faq`). Mobile-first: `max-w-3xl` i padding rosnący dopiero od
 * `sm:` — bazowe style są dla najmniejszego telefonu.
 *
 * Świadomie BEZ własnego układu dwukolumnowego (spis treści + treść obok
 * siebie na desktopie) — jedna kolumna na każdej szerokości, spis jako
 * `<details>` nad treścią (patrz `SpisTresci.tsx`). Pływający sidebar to
 * osobna klasa błędów nakładania warstw, których w tym repo już się
 * naszukaliśmy (patrz `docs/funkcje.md`, rozdział o warstwach).
 */
export default function StronaTresci({
  nadtytul,
  h1,
  lead,
  children,
  tytulDlaOkruszkow,
}: {
  nadtytul: string;
  h1: string;
  lead: string;
  children: React.ReactNode;
  /** Krótsza wersja h1 do okruszków (BreadcrumbList) — dla `/jak-dziala-bojo`
   *  pełny h1 jest zdaniem, a okruszek ma być frazą. */
  tytulDlaOkruszkow: string;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header />
      <main id="main" className="flex-1 w-full">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">
            {nadtytul}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {h1}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-400">
            {lead}
          </p>

          <div className="mt-8 space-y-10 sm:mt-10 sm:space-y-12">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbsJsonLd([
            { name: 'Bojo', path: '/' },
            { name: tytulDlaOkruszkow },
          ])),
        }}
      />
    </div>
  );
}
