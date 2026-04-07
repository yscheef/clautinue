import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ScannedFile } from "./types.js";

const CLAUDE_DIR = join(process.env.HOME ?? "~", ".claude");
const PROJECTS_DIR = join(CLAUDE_DIR, "projects");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/;

export async function scanSessionFiles(): Promise<ScannedFile[]> {
  const results: ScannedFile[] = [];

  let projectDirs: string[];
  try {
    projectDirs = await readdir(PROJECTS_DIR);
  } catch {
    return results;
  }

  const scanPromises = projectDirs.map(async (projectDir) => {
    const dirPath = join(PROJECTS_DIR, projectDir);
    let entries: string[];
    try {
      entries = await readdir(dirPath);
    } catch {
      return;
    }

    const filePromises = entries
      .filter((e) => UUID_RE.test(e))
      .map(async (entry) => {
        const filePath = join(dirPath, entry);
        try {
          const s = await stat(filePath);
          if (s.isFile() && s.size > 0) {
            results.push({
              filePath,
              projectDir,
              mtime: s.mtimeMs,
              size: s.size,
            });
          }
        } catch {
          // skip unreadable files
        }
      });

    await Promise.all(filePromises);
  });

  await Promise.all(scanPromises);

  results.sort((a, b) => b.mtime - a.mtime);
  return results;
}
