'use client';

import { useEffect, useState } from 'react';

const ROTATE_MS = 1500;

/** Hero eyebrow slot that cycles through a few organizer-value messages.
 *  Fixed min-height keeps the switch from shifting layout; prefers-reduced-motion
 *  stops the rotation entirely and leaves the first message showing. */
export default function RotatingBadge({ messages }: { messages: readonly string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const id = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <span
      className="inline-flex min-h-[2.25rem] items-center rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium backdrop-blur-sm"
      aria-live="off"
    >
      <span key={index} className="animate-badge-fade motion-reduce:animate-none">
        {messages[index]}
      </span>
    </span>
  );
}
