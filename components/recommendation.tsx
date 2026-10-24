"use client";

import { AlertTriangle, CheckCircle2, HelpCircle, MinusCircle } from "lucide-react";
import type { Recommendation } from "@/lib/recommend";

const ICON = {
  green: CheckCircle2,
  amber: HelpCircle,
  red: AlertTriangle,
  gray: MinusCircle,
};

const KICKER = {
  green: "Recomendación",
  amber: "Recomendación",
  red: "Recomendación",
  gray: "Recomendación",
};

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const Icon = ICON[rec.tone];

  return (
    <section className={`card rec rec-${rec.tone}`} aria-labelledby="rec-title">
      <div className="panel-body">
        <div className="rec-kicker">
          <Icon size={16} aria-hidden="true" />
          {KICKER[rec.tone]}
        </div>

        <h2 id="rec-title" className="rec-title">
          {rec.title}
        </h2>

        <p className="rec-body">{rec.body}</p>

        {rec.points.length > 0 && (
          <ul className="rec-points">
            {rec.points.map((pt, i) => (
              <li key={i} className={`rec-point is-${pt.kind}`}>
                <span className="rec-point-mark" aria-hidden="true" />
                <div>
                  <div className="rec-point-text">{pt.text}</div>
                  {pt.reason && <div className="rec-point-reason">{pt.reason}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
