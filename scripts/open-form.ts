/**
 * Opens the program's form with its persistent profile so the user can log in
 * once (Google, LinkedIn, etc.). The session stays in data/browser-profile/p<id>
 * and is reused by the question reader and the prefill.
 *
 *   npx tsx scripts/open-form.ts <programId>
 */
import path from "node:path";
import fs from "node:fs";
import { getDb } from "../lib/db";
import { launchBrowser } from "../lib/cdp";

const programId = Number(process.argv[2]);
if (!programId) {
  console.error("Falta el id del programa");
  process.exit(1);
}

const db = getDb();
const program = db
  .prepare("SELECT id, applies_url, contact_url, url FROM programs WHERE id = ?")
  .get(programId) as { id: number; applies_url: string | null; contact_url: string | null; url: string } | undefined;

const url = program?.applies_url || program?.contact_url || program?.url;
if (!program || !url) {
  console.error("No hay URL para abrir");
  process.exit(1);
}

(async () => {
  const { port } = launchBrowser(programId, url);

  fs.appendFileSync(
    path.join(process.cwd(), "data", "prefill.log"),
    `[${new Date().toISOString()}] open-form #${programId}: ${url} (cdp ${port})\n`
  );

  // El navegador queda abierto para que inicies sesión; el script termina.
  console.log(`Navegador abierto en el puerto ${port}. Iniciá sesión y dejá la ventana abierta.`);
})();
