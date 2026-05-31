"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Hero image slot — probes for the committed `/landing/hero-phone.jpg`
 * (or `.png`) and renders it when present, otherwise falls back to the
 * animated chat mockup. Lets us ship the design and swap in real
 * renders without touching code.
 */
export function HeroImageSlot({ fallback }: { fallback: React.ReactNode }) {
  const [src, setSrc] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const candidate of ["/landing/hero-phone.jpg", "/landing/hero-phone.png"]) {
        try {
          const res = await fetch(candidate, { method: "HEAD" });
          if (cancelled) return;
          if (res.ok) {
            setSrc(candidate);
            setDone(true);
            return;
          }
        } catch {
          /* try next */
        }
      }
      if (!cancelled) setDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (src) {
    return (
      <div className="relative mx-auto aspect-[16/10] w-full max-w-3xl md:max-w-4xl">
        <Image
          src={src}
          alt="Le bot WhatsApp DentalCare répondant à un patient depuis un iPhone"
          fill
          priority
          sizes="(min-width: 1024px) 900px, 90vw"
          className="object-contain"
        />
      </div>
    );
  }

  // While probing OR if no candidate is present, render the animated mockup.
  if (!done) return <>{fallback}</>;
  return <>{fallback}</>;
}
