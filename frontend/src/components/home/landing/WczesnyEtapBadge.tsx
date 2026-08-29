/**
 * Plakietka „Wczesny etap" — dla funkcji, które działają, ale nie w pełnej
 * skali (mało otwartych gier, niekompletne opisy boisk).
 *
 * Osobny komponent, bo te same karty renderują się w trzech miejscach:
 * `LandingHowItWorks`, `LandingValues` i `DashboardSections` (pulpit ma własny
 * markup kroków). Źródłem prawdy, które pozycje ją dostają, jest pole
 * `wczesnyEtap` w `landing/content.ts`.
 */
export default function WczesnyEtapBadge() {
  return (
    // slate-500 na tym tle (slate-100) dawał 4.34:1 — tuż poniżej progu WCAG AA
    // 4.5:1. slate-600 (6.92:1) jest bezpieczny.
    <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
      Wczesny etap
    </span>
  );
}
