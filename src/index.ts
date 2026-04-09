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

  const choices = sessions.map((s) => ({
    name: formatSessionRow(s),
    value: s.sessionId,
    description: formatSessionDescription(s),
  }));

  // Escape / q exits cleanly from the select prompt (not search, where q is a valid keystroke)
  const ac = new AbortController();

  try {
    const sessionId = await search<string>({
      message: `Sessions (${sessions.length})`,
      source: (input: string | undefined) => {
        if (!input) return choices;
        const term = input.toLowerCase();
        return choices.filter((c) => {
          const s = sessions.find((s) => s.sessionId === c.value)!;
          return (
            s.projectName.toLowerCase().includes(term) ||
            (s.slug?.toLowerCase().includes(term) ?? false) ||
            (s.name?.toLowerCase().includes(term) ?? false) ||
            s.firstUserMessage.toLowerCase().includes(term) ||
            s.cwd.toLowerCase().includes(term)
          );
        });
      },
      pageSize: 15,
    });

    const selected = sessions.find((s) => s.sessionId === sessionId)!;

    if (selected.isActive) {
      const YELLOW = "\x1b[33m";
      const DIM = "\x1b[2m";
      const RESET = "\x1b[0m";
      console.log(
        `\n${YELLOW}This session is active in another terminal.${RESET}`
      );

      // Enable escape/q to quit on the select prompt
      const onKeypress = (_ch: string, key: { name?: string; sequence?: string }) => {
        if (key?.name === "escape" || key?.name === "q") {
          ac.abort();
        }
      };
      process.stdin.on("keypress", onKeypress);

      const action = await select({
        message: "What do you want to do?",
        choices: [
          {
            name: "Take over",
            value: "takeover" as const,
            description: `${DIM}Resume the session here (the other terminal will lose it)${RESET}`,
          },
          {
            name: "Fork",
            value: "fork" as const,
            description: `${DIM}Branch off a new conversation from the current state${RESET}`,
          },
          {
            name: "Fork + Worktree",
            value: "fork-worktree" as const,
            description: `${DIM}Fork conversation + create a git worktree for isolated code${RESET}`,
          },
          {
            name: "Cancel",
            value: "cancel" as const,
          },
        ],
      }, { signal: ac.signal });

      process.stdin.removeListener("keypress", onKeypress);

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
  } catch {
    process.exit(0);
  }
}

main();
