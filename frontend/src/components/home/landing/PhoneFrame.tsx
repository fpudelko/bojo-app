import Image from 'next/image';

/** Phone chrome around a screenshot — dark border, notch, home bar.
 *  Extracted from the (unused) FeaturesSection.tsx phone mock. */
export default function PhoneFrame({
  src,
  alt,
  priority = false,
  width = 780,
  height = 1688,
  className = '',
}: {
  src: string;
  alt: string;
  priority?: boolean;
  /** Intrinsic dimensions of `src` — must match the real file, bo bez
   *  `object-fit` w tym komponencie rozjazd proporcji rozciąga obraz zamiast
   *  go przyciąć. */
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div className={`relative w-full ${className}`}>
      <div className="rounded-[2.8rem] border-[7px] border-slate-800 shadow-[0_24px_56px_rgba(0,0,0,0.32)] overflow-hidden bg-slate-800">
        <div className="flex items-center justify-center bg-slate-800 py-2">
          <div className="w-20 h-4 bg-slate-700 rounded-full" />
        </div>
        <div className="relative overflow-hidden">
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            priority={priority}
            loading={priority ? undefined : 'lazy'}
            sizes="(min-width: 768px) 280px, 248px"
            className="w-full block"
          />
        </div>
        <div className="flex justify-center bg-white py-2.5">
          <div className="w-20 h-1 bg-slate-200 rounded-full" />
        </div>
      </div>
    </div>
  );
}
