/**
 * Skeleton pieces for the dashboard shell, used server-side in app/page.tsx
 * before we even know whether there's a real session (see lib/sessionHint.ts)
 * — zero hooks, zero client JS, safe to render on the server.
 *
 * Od likwidacji drugiego pulpitu (2026-08-23) ten szkielet ma jeszcze jedno
 * zadanie: przykrywa te ułamek sekundy, w którym `HomeSwitch` wie już, że
 * użytkownik jest zalogowany, i przekierowuje go na `/moje-gry`. Bez tego
 * przez tę klatkę mignąłby landing sprzedażowy komuś, kto ma konto.
 */

export function GreetingBarSkeleton() {
  return (
    <div className="flex items-center justify-between px-4 pt-6 pb-2" aria-hidden="true">
      <div className="h-6 w-40 animate-pulse rounded-md bg-slate-100" />
      <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
    </div>
  );
}

export function DashboardContentSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-12 pt-4" aria-hidden="true">
      {/* NextMatchCard skeleton */}
      <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />

      {/* A section header + list rows, repeated once */}
      <div className="space-y-3">
        <div className="h-5 w-32 animate-pulse rounded-md bg-slate-100" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
      </div>
      <div className="space-y-3">
        <div className="h-5 w-32 animate-pulse rounded-md bg-slate-100" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

export default function AppHomeSkeleton() {
  return (
    <div aria-hidden="true">
      <GreetingBarSkeleton />
      <DashboardContentSkeleton />
    </div>
  );
}
