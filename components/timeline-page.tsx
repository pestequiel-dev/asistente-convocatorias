"use client";

import { useLayoutEffect, useRef } from "react";
import type { Program } from "@/lib/types";
import { Timeline } from "./timeline";

/**
 * The timeline fills the viewport exactly: only the inner container scrolls,
 * never the page. Height is measured so it also works on mobile where the
 * sidebar wraps.
 */
export function TimelinePage({ programs }: { programs: Program[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const parent = el.parentElement;
      const padBottom = parent ? parseFloat(getComputedStyle(parent).paddingBottom) || 0 : 0;
      const h = Math.max(320, window.innerHeight - top - padBottom - 6);
      el.style.height = `${h}px`;
    };

    fit();
    const ro = new ResizeObserver(fit);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, []);

  return (
    <div ref={ref} className="timeline-shell">
      <Timeline programs={programs} fill />
    </div>
  );
}
