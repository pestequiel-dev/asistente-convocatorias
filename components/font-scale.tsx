"use client";

import { useEffect, useState } from "react";

const OPTIONS = [
  { value: "1.1", label: "A", aria: "Texto normal" },
  { value: "1.25", label: "A+", aria: "Texto grande" },
  { value: "1.45", label: "A++", aria: "Texto muy grande" },
];

/** Global text size: sets --fs on <html>, persisted in localStorage. */
export function FontScale() {
  const [value, setValue] = useState("1.25");

  useEffect(() => {
    const saved = localStorage.getItem("fs");
    if (saved && OPTIONS.some((o) => o.value === saved)) {
      setValue(saved);
      document.documentElement.style.setProperty("--fs", saved);
    }
  }, []);

  function apply(v: string) {
    document.documentElement.style.setProperty("--fs", v);
    try {
      localStorage.setItem("fs", v);
    } catch {
      /* ignore */
    }
    setValue(v);
  }

  return (
    <div className="font-scale">
      <span className="font-scale-label">Tamaño</span>
      <div className="font-scale-row" role="group" aria-label="Tamaño del texto">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`fs-btn${value === o.value ? " active" : ""}`}
            aria-pressed={value === o.value}
            aria-label={o.aria}
            onClick={() => apply(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
