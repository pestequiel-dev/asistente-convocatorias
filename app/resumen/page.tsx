import { getDb } from "@/lib/db";
import type { Program } from "@/lib/types";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const db = getDb();
  const programs = db.prepare("SELECT * FROM programs WHERE status != 'rejected' ORDER BY created_at DESC").all() as Program[];
  const profile = db.prepare("SELECT name FROM profile WHERE id = 1").get() as { name: string } | undefined;
  const hasKey = Boolean(
    (db.prepare("SELECT value FROM settings WHERE key = 'deepseek_api_key'").get() as { value?: string } | undefined)
      ?.value || process.env.DEEPSEEK_API_KEY
  );

  return (
    <Dashboard programs={programs} profileName={profile?.name ?? "tu startup"} hasKey={hasKey} mode="summary" />
  );
}
