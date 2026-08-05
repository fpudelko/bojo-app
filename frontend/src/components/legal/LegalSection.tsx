import { LEGAL } from '@/lib/legal';

// Wspólny blok sekcji dla /prywatnosc i /regulamin — dawniej zduplikowany
// 1:1 w obu plikach.
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">{title}</h2>
      <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

export function ContactMail() {
  return (
    <a href={`mailto:${LEGAL.contactEmail}`} className="text-primary-600 hover:underline">
      {LEGAL.contactEmail}
    </a>
  );
}
