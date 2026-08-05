/** Live HTML/CSS mock of the logged-in dashboard, framed like PhoneFrame.
 *  A static screenshot goes soft above 2x DPI, weighs ~70KB and drifts out
 *  of sync the next time the dashboard changes; this stays sharp, weighs
 *  nothing extra and follows the real dashboard's colors automatically. */
export default function PhoneMock({ className = '' }: { className?: string }) {
  return (
    <div className={`relative w-full ${className}`} aria-hidden="true">
      <div className="overflow-hidden rounded-[2.8rem] border-[7px] border-slate-800 bg-white shadow-[0_24px_56px_rgba(0,0,0,0.32)]">
        <div className="flex items-center justify-center bg-slate-800 py-2">
          <div className="h-4 w-20 rounded-full bg-slate-700" />
        </div>

        <div className="bg-canvas px-4 pb-5 pt-4 text-left">
          <div className="flex items-center justify-between">
            <span className="font-display text-sm font-bold tracking-tight text-ink">bojo</span>
            <span className="flex h-7 w-7 flex-col items-center justify-center gap-[3px] rounded-lg bg-slate-100">
              <span className="h-0.5 w-3.5 rounded-full bg-slate-400" />
              <span className="h-0.5 w-3.5 rounded-full bg-slate-400" />
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <p className="text-[15px] font-bold text-ink">
              Cześć, Jan <span aria-hidden="true">👋</span>
            </p>
            <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700">
              J
            </span>
          </div>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Zaproszenia · 1
          </p>

          <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-[13px] font-semibold text-ink">🏐 Siatkówka we czwartek</p>
            <p className="mt-0.5 text-[11px] text-slate-500">czw. 6 sie · Hala Sportowa</p>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/3 rounded-full bg-primary-500" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">4/12 graczy · 8 wolnych</span>
              <span className="text-[11px] font-semibold text-primary-700">Zaproszenie →</span>
            </div>
          </div>
        </div>

        <div className="flex justify-center bg-white py-2.5">
          <div className="h-1 w-20 rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
