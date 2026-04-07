import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ActiveSession } from "./types.js";

const SESSIONS_DIR = join(process.env.HOME ?? "~", ".claude", "sessions");

export async function getActiveSessions(): Promise<Map<string, ActiveSession>> {
  const map = new Map<string, ActiveSession>();

  let entries: string[];
  try {
    entries = await readdir(SESSIONS_DIR);
  } catch {
    return map;
  }

  const promises = entries
    .filter((e) => e.endsWith(".json"))
    .map(async (entry) => {
      try {
        const raw = await readFile(join(SESSIONS_DIR, entry), "utf-8");
        const session = JSON.parse(raw) as ActiveSession;
        if (session.sessionId) {
          map.set(session.sessionId, session);
        }
      } catch {
        // stale or corrupt session file
      }
    });

  await Promise.all(promises);
  return map;
}
