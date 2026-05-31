"use client";

import { useEffect, useState } from "react";

/**
 * Generic "does this image exist?" probe used by section backgrounds
 * that should only render when the asset is actually present. Same
 * pattern as `HeroImageSlot` but factored out so any section can call it.
 *
 *   const present = useImageProbe("/landing/cabinet-interior.jpg");
 *   {present ? <img src="..." /> : null}
 */
export function useImageProbe(src: string): boolean {
  const [present, setPresent] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(src, { method: "HEAD" })
      .then((res) => {
        if (!cancelled && res.ok) setPresent(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [src]);
  return present;
}
