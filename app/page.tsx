import { getDb } from "@/lib/db";
import type { Program } from "@/lib/types";
import { TimelinePage } from "@/components/timeline-page";

export const dynamic = "force-dynamic";

export default async function Page() {
  const db = getDb();
  const programs = db
    .prepare(
      "SELECT * FROM programs WHERE kind IN ('convocatoria','evento','inversor') AND status IN ('ready','error') ORDER BY created_at DESC"
    )
    .all() as Program[];

  return <TimelinePage programs={programs} />;
}
