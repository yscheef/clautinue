#!/usr/bin/env bun

import search from "@inquirer/search";
import select from "@inquirer/select";
import { scanSessionFiles } from "./scanner.js";
import { parseSessionFull } from "./parser.js";
import { loadCache, saveCache, isCacheHit } from "./cache.js";
import { getActiveSessions } from "./active.js";
import { formatSessionRow, formatSessionDescription } from "./display.js";
import { resumeSession } from "./resume.js";
import { createWorktree } from "./worktree.js";
import type { SessionMeta, CacheData } from "./types.js";

const args = process.argv.slice(2);
const noCache = args.includes("--no-cache");
const activeOnly = args.includes("--active");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? "100", 10) : 100;
const projectIdx = args.indexOf("--project");
const projectFilter = projectIdx !== -1 ? (args[projectIdx + 1] ?? "").toLowerCase() : null;

async function loadSessions(): Promise<SessionMeta[]> {
  const emptyCache: CacheData = { version: 1, sessions: {} };
  const [files, cache, activeSessions] = await Promise.all([
    scanSessionFiles(),
    noCache ? emptyCache : loadCache(),
    getActiveSessions(),
  ]);

  const sessions: SessionMeta[] = [];
  const toSave: CacheData = { ...cache, sessions: { ...cache.sessions } };

  const parsePromises = files.slice(0, 500).map(async (file) => {
    const cached = noCache ? null : isCacheHit(cache, file.filePath, file.mtime, file.size);
    let session: SessionMeta | null;

    if (cached) {
      session = { ...cached };
    } else {
      session = await parseSessionFull(file);
      if (session) {
        toSave.sessions[file.filePath] = session;
      }
    }

    if (!session) return;

    const active = activeSessions.get(session.sessionId);
    if (active) {
      session.isActive = true;
      session.name = active.name ?? session.name;
    }

    sessions.push(session);
  });

  await Promise.all(parsePromises);

  if (!noCache) {
    await saveCache(toSave);
  }

  sessions.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime();
  });

  return sessions;
}

function buildChoices(sessions: SessionMeta[], filter?: string) {
  const filtered = filter
    ? sessions.filter((s) => {
        const term = filter.toLowerCase();
        return (
          s.projectName.toLowerCase().includes(term) ||
          (s.slug?.toLowerCase().includes(term) ?? false) ||
          (s.name?.toLowerCase().includes(term) ?? false) ||
          s.firstUserMessage.toLowerCase().includes(term) ||
          s.cwd.toLowerCase().includes(term)
        );
      })
    : sessions;

  return filtered.map((s) => ({
    name: formatSessionRow(s),
    value: s.sessionId,
    description: formatSessionDescription(s),
  }));
}

async function main() {
  let sessions = await loadSessions();

  if (projectFilter) {
    sessions = sessions.filter((s) =>
      s.projectName.toLowerCase().includes(projectFilter) ||
      (s.name?.toLowerCase().includes(projectFilter) ?? false)
    );
  }

  if (activeOnly) {
    sessions = sessions.filter((s) => s.isActive);
  }

  sessions = sessions.slice(0, limit);

  if (sessions.length === 0) {
    console.log("No sessions found.");
    process.exit(0);
  }

  // Main prompt loop — restarts on terminal resize to reformat columns
  let sessionId: string | undefined;

  while (!sessionId) {
    const ac = new AbortController();
    let resized = false;

    // Abort and restart prompt on terminal resize
    const onResize = () => {
      resized = true;
      ac.abort();
    };
    process.stdout.on("resize", onResize);

    // Escape exits
    const onData = (data: Buffer) => {
      if (data.length === 1 && data[0] === 0x1b) {
        ac.abort();
      }
    };
    process.stdin.on("data", onData);

    try {
      sessionId = await search<string>({
        message: `Sessions (${sessions.length})`,
        source: (input: string | undefined) => buildChoices(sessions, input || undefined),
        pageSize: 15,
      }, { signal: ac.signal });
    } catch {
      if (resized) {
        // Clear the aborted prompt output, loop back to show fresh one
        process.stdout.write("\x1b[2K\x1b[1A\x1b[2K\r");
        continue;
      }
      process.exit(0);
    } finally {
      process.stdout.removeListener("resize", onResize);
      process.stdin.removeListener("data", onData);
    }
  }

  const selected = sessions.find((s) => s.sessionId === sessionId)!;

  if (selected.isActive) {
    const YELLOW = "\x1b[33m";
    const DIM = "\x1b[2m";
    const RESET = "\x1b[0m";
    console.log(
      `\n${YELLOW}This session is active in another terminal.${RESET}`
    );

    const selectAc = new AbortController();

    const onSelectData = (data: Buffer) => {
      const ch = data.toString();
      if (ch === "q") selectAc.abort();
      if (data.length === 1 && data[0] === 0x1b) selectAc.abort();
    };
    process.stdin.on("data", onSelectData);

    let action: string;
    try {
      action = await select({
        message: "What do you want to do?",
        choices: [
          {
            name: "Take over",
            value: "takeover",
            description: `${DIM}Resume the session here (the other terminal will lose it)${RESET}`,
          },
          {
            name: "Fork",
            value: "fork",
            description: `${DIM}Branch off a new conversation from the current state${RESET}`,
          },
          {
            name: "Fork + Worktree",
            value: "fork-worktree",
            description: `${DIM}Fork conversation + create a git worktree for isolated code${RESET}`,
          },
          {
            name: "Cancel",
            value: "cancel",
          },
        ],
      }, { signal: selectAc.signal });
    } catch {
      process.exit(0);
    } finally {
      process.stdin.removeListener("data", onSelectData);
    }

    if (action === "cancel") process.exit(0);

    if (action === "fork-worktree") {
      const worktreePath = createWorktree(selected.cwd);
      await resumeSession(sessionId, worktreePath ?? selected.cwd, true);
    } else {
      await resumeSession(sessionId, selected.cwd, action === "fork");
    }
  } else {
    await resumeSession(sessionId, selected.cwd);
  }
}

main();
