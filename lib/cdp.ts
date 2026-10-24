/**
 * A browser launched as a plain process (no Playwright) is not flagged as
 * automated, so Google lets you sign in. We then attach over CDP to reuse that
 * session for reading the form and pre-filling it.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function cdpPort(programId: number) {
  return 9300 + (programId % 500);
}

export function profileDirFor(programId: number) {
  return path.join(process.cwd(), "data", "browser-profile", `p${programId}`);
}

function browserBinary(): string | null {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].filter(Boolean) as string[];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

export async function isCdpUp(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(800) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Opens a normal browser window with remote debugging enabled. */
export function launchBrowser(programId: number, url: string) {
  const exe = browserBinary();
  if (!exe) throw new Error("No encontré Chrome ni Brave instalado");

  const port = cdpPort(programId);
  const dir = profileDirFor(programId);
  fs.mkdirSync(dir, { recursive: true });

  // Remove a lock left by a crashed instance.
  try {
    const target = fs.readlinkSync(path.join(dir, "SingletonLock"));
    const pid = Number(String(target).split("-").pop());
    let alive = false;
    if (pid) {
      try {
        process.kill(pid, 0);
        alive = true;
      } catch {
        alive = false;
      }
    }
    if (!alive) {
      for (const f of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
        fs.rmSync(path.join(dir, f), { force: true });
      }
    }
  } catch {
    /* sin lock */
  }

  const child = spawn(
    exe,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${dir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      "--disable-breakpad",
      "--disable-crash-reporter",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      url,
    ],
    { detached: true, stdio: "ignore" }
  );
  child.unref();
  return { port, dir };
}
