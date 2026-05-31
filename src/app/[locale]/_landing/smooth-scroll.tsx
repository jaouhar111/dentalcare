"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis-driven smooth scroll. We pipe Lenis' raf into GSAP's ticker so
 * ScrollTrigger updates on the same heartbeat — without this, pinned
 * sections jitter as Lenis and GSAP fight over the scrollTop.
 *
 * Mounted once at the top of the landing page; unmounts cleanly on
 * route change (e.g. user clicks "Mon dashboard").
 */
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      // 1.0 ≈ default native feel, > 1 = silkier momentum. Studio-grade
      // sites usually hover around 1.1-1.3.
      lerp: 0.1,
      smoothWheel: true,
    });

    function onRaf(time: number) {
      lenis.raf(time * 1000);
    }
    gsap.ticker.add(onRaf);
    gsap.ticker.lagSmoothing(0);

    // Refresh ScrollTrigger after the first frame so any pinned sections
    // re-measure once Lenis takes over the scroll dimension.
    requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      gsap.ticker.remove(onRaf);
      lenis.destroy();
    };
  }, []);

  return null;
}
