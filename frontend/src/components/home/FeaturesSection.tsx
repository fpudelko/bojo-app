'use client';

import Image from 'next/image';
import { useInView } from '@/lib/useInView';

const FEATURES = [
  {
    img: '/mockups/mockup-1-lista-gier.png',
    kicker: 'Znajdź grę',
    title: 'Wszystkie otwarte mecze w jednym miejscu',
    body: 'Filtruj po sporcie, dzielnicy i terminie. Karty z zapełnieniem, statusem i jednym tapnięciem do dołączenia.',
    dark: false,
  },
  {
    img: '/mockups/mockup-2-szczegoly-meczu.png',
    kicker: 'Dołącz',
    title: 'Zobacz, kto gra — zanim się zapiszesz',
    body: 'Lista zapisanych z avatarami, info o boisku, opłata i nawigacja. Żadnych niespodzianek po przyjściu na miejsce.',
    dark: true,
  },
  {
    img: '/mockups/mockup-3-mapa-boisk.png',
    kicker: 'Eksploruj',
    title: 'Mapa boisk z aktywnymi grami',
    body: 'Zobacz, gdzie dziś coś się dzieje. Filtruj po sporcie i terminie, znajdź boisko najbliżej Ciebie.',
    dark: true,
  },
  {
    img: '/mockups/mockup-4-profil-gracza.png',
    kicker: 'Wracaj',
    title: 'Twój profil i historia gier',
    body: 'Mecze, w których grałeś, ulubione sporty i dzielnice. Buduj swoją ekipę i wracaj do sprawdzonych boisk.',
    dark: true,
  },
];

export default function FeaturesSection() {
  return (
    <div>
      {/* Section header — always on canvas */}
      <div className="bg-canvas px-4 pt-20 pb-12 sm:pt-24 sm:pb-14 text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">
          Jak to wygląda
        </span>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-4xl">
          Cztery ekrany, jedna prosta obietnica
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
          Znajdź grę, dołącz, zagraj, wróć. Bez tarcia, bez gadania po grupach,
          bez listy obecności w notatniku.
        </p>
      </div>

      {/* Feature rows — alternating light / dark to match each mockup background */}
      {FEATURES.map((f, i) => (
        <FeatureRow key={f.title} feature={f} reverse={i % 2 === 1} />
      ))}
    </div>
  );
}

function FeatureRow({
  feature,
  reverse,
}: {
  feature: (typeof FEATURES)[number];
  reverse: boolean;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  const bg = feature.dark ? 'bg-[#0C1E13]' : 'bg-canvas';
  const kickerCls = feature.dark ? 'text-primary-400' : 'text-primary-700';
  const titleCls = feature.dark ? 'text-white' : 'text-ink';
  const bodyCls = feature.dark ? 'text-white/65' : 'text-slate-600';
  const shadowCls = feature.dark
    ? 'drop-shadow-[0_32px_64px_rgba(0,0,0,0.5)]'
    : 'drop-shadow-[0_24px_48px_rgba(11,52,32,0.22)]';

  return (
    <section className={`${bg} px-4 py-16 sm:py-24`}>
      <div
        ref={ref}
        className={[
          'mx-auto max-w-5xl grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16 transition-all duration-700 ease-out',
          inView ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
          reverse ? 'lg:[&>div:first-child]:order-2' : '',
        ].join(' ')}
      >
        <div className="relative mx-auto w-full max-w-xs sm:max-w-sm">
          <Image
            src={feature.img}
            alt={feature.title}
            width={1024}
            height={1536}
            loading="lazy"
            sizes="(max-width: 640px) 80vw, 384px"
            className={`w-full select-none ${shadowCls}`}
          />
        </div>
        <div className="max-w-lg">
          <span className={`text-xs font-semibold uppercase tracking-wider ${kickerCls}`}>
            {feature.kicker}
          </span>
          <h3 className={`mt-2 font-display text-xl font-bold tracking-tight sm:text-2xl ${titleCls}`}>
            {feature.title}
          </h3>
          <p className={`mt-3 leading-relaxed ${bodyCls}`}>{feature.body}</p>
        </div>
      </div>
    </section>
  );
}
