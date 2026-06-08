'use client';

import Image from 'next/image';
import { useInView } from '@/lib/useInView';

const FEATURES = [
  {
    img: '/mockups/screen-1-mecze.png',
    kicker: 'Znajdź grę',
    title: 'Wszystkie otwarte mecze w jednym miejscu',
    body: 'Filtruj po sporcie, dzielnicy i terminie. Jeden tap — dołącz.',
  },
  {
    img: '/mockups/screen-3-mapa.png',
    kicker: 'Eksploruj',
    title: 'Mapa boisk z aktywnymi grami',
    body: 'Setki boisk w Poznaniu i okolicach. Znajdź co dziś i gdzie.',
  },
];

export default function FeaturesSection() {
  return (
    <section className="bg-canvas px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center mb-14 sm:mb-18">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">
            Jak to działa
          </span>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Prosto i szybko
          </h2>
        </div>

        {/* Two-column phone grid */}
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 sm:gap-10">
          {FEATURES.map((f, i) => (
            <PhoneFeature key={f.title} feature={f} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PhoneFeature({
  feature,
  delay,
}: {
  feature: (typeof FEATURES)[number];
  delay: number;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className="flex flex-col items-center gap-6 transition-all duration-700 ease-out"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(24px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {/* Phone chrome — dark border, rounded, notch, home bar */}
      <div className="relative w-full max-w-[220px] sm:max-w-[240px]">
        <div className="rounded-[2.8rem] border-[7px] border-slate-800 shadow-[0_24px_56px_rgba(0,0,0,0.32)] overflow-hidden bg-slate-800">
          {/* Notch bar */}
          <div className="flex items-center justify-center bg-slate-800 py-2">
            <div className="w-20 h-4 bg-slate-700 rounded-full" />
          </div>
          {/* Screen content */}
          <div className="relative overflow-hidden">
            <Image
              src={feature.img}
              alt={feature.title}
              width={780}
              height={1688}
              loading="lazy"
              sizes="240px"
              className="w-full block"
            />
          </div>
          {/* Home indicator */}
          <div className="flex justify-center bg-white py-2.5">
            <div className="w-20 h-1 bg-slate-200 rounded-full" />
          </div>
        </div>
      </div>

      {/* Caption */}
      <div className="text-center max-w-xs">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">
          {feature.kicker}
        </span>
        <h3 className="mt-1.5 font-display text-lg font-bold tracking-tight text-ink">
          {feature.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{feature.body}</p>
      </div>
    </div>
  );
}
