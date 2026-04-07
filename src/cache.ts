import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { CacheData, SessionMeta } from "./types.js";

const CACHE_VERSION = 1;
const CACHE_PATH = join(
  process.env.HOME ?? "~",
  ".cache",
  "clautinue",
  "sessions.json"
);

export async function loadCache(): Promise<CacheData> {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8");
    const data = JSON.parse(raw) as CacheData;
    if (data.version === CACHE_VERSION) return data;
  } catch {
    // no cache or corrupt
  }
  return { version: CACHE_VERSION, sessions: {} };
}

export async function saveCache(cache: CacheData): Promise<void> {
  try {
    await mkdir(dirname(CACHE_PATH), { recursive: true });
    await writeFile(CACHE_PATH, JSON.stringify(cache), "utf-8");
  } catch {
    // non-fatal
  }
}

export function isCacheHit(
  cache: CacheData,
  filePath: string,
  mtime: number,
  size: number
): SessionMeta | null {
  const entry = cache.sessions[filePath];
  if (!entry) return null;
  if (entry.mtime === mtime && entry.size === size) return entry;
  return null;
}
