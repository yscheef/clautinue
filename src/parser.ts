import type { SessionMeta, ScannedFile } from "./types.js";

const HEAD_BYTES = 16384;
const TAIL_BYTES = 16384;

function tryParseJsonLines(text: string): unknown[] {
  const results: unknown[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      results.push(JSON.parse(trimmed));
    } catch {
      // partial line at chunk boundary — skip
    }
  }
  return results;
}

function extractFromHead(records: unknown[]): {
  sessionId: string | null;
  cwd: string | null;
  slug: string | null;
  entrypoint: string | null;
  firstTimestamp: string | null;
  firstUserMessage: string;
} {
  let sessionId: string | null = null;
  let cwd: string | null = null;
  let slug: string | null = null;
  let entrypoint: string | null = null;
  let firstTimestamp: string | null = null;
  let firstUserMessage = "";

  for (const rec of records) {
    const r = rec as Record<string, unknown>;

    if (!sessionId && r.sessionId) {
      sessionId = r.sessionId as string;
    }

    if (r.type === "user") {
      if (!cwd && r.cwd) cwd = r.cwd as string;
      if (!slug && r.slug) slug = r.slug as string;
      if (!entrypoint && r.entrypoint) entrypoint = r.entrypoint as string;
      if (!firstTimestamp && r.timestamp) firstTimestamp = r.timestamp as string;

      if (!firstUserMessage) {
        const msg = r.message as Record<string, unknown> | undefined;
        if (msg?.content) {
          const content = msg.content;
          if (typeof content === "string") {
            firstUserMessage = content.slice(0, 120);
          } else if (Array.isArray(content)) {
            const textBlock = content.find(
              (b: unknown) => (b as Record<string, unknown>).type === "text"
            ) as Record<string, unknown> | undefined;
            if (textBlock?.text) {
              firstUserMessage = (textBlock.text as string).slice(0, 120);
            }
          }
        }
      }

      // Got everything we need from head
      if (sessionId && cwd && firstTimestamp && firstUserMessage) break;
    }
  }

  return { sessionId, cwd, slug, entrypoint, firstTimestamp, firstUserMessage };
}

function extractFromTail(records: unknown[]): {
  lastTimestamp: string | null;
  model: string | null;
} {
  let lastTimestamp: string | null = null;
  let model: string | null = null;

  // Walk backwards to find the most recent data
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i] as Record<string, unknown>;

    if (!lastTimestamp && r.timestamp) {
      lastTimestamp = r.timestamp as string;
    }

    if (!model && r.type === "assistant") {
      const msg = r.message as Record<string, unknown> | undefined;
      if (msg?.model) {
        model = msg.model as string;
      }
    }

    if (lastTimestamp && model) break;
  }

  return { lastTimestamp, model };
}

export async function parseSessionQuick(
  file: ScannedFile
): Promise<SessionMeta | null> {
  const bunFile = Bun.file(file.filePath);
  const fileSize = bunFile.size;

  // Read head
  const headSlice = bunFile.slice(0, Math.min(HEAD_BYTES, fileSize));
  const headText = await headSlice.text();
  const headRecords = tryParseJsonLines(headText);

  const head = extractFromHead(headRecords);
  if (!head.sessionId || !head.firstTimestamp) return null;

  // Read tail (may overlap with head for small files)
  let tailRecords: unknown[];
  if (fileSize <= HEAD_BYTES) {
    tailRecords = headRecords;
  } else {
    const tailSlice = bunFile.slice(Math.max(0, fileSize - TAIL_BYTES));
    const tailText = await tailSlice.text();
    tailRecords = tryParseJsonLines(tailText);
  }

  const tail = extractFromTail(tailRecords);

  const cwd = head.cwd ?? "";
  const projectName = cwd ? cwd.split("/").filter(Boolean).pop() ?? "" : "";

  return {
    sessionId: head.sessionId,
    filePath: file.filePath,
    cwd,
    projectName,
    slug: head.slug,
    name: null,
    firstTimestamp: head.firstTimestamp,
    lastTimestamp: tail.lastTimestamp ?? head.firstTimestamp,
    firstUserMessage: head.firstUserMessage,
    model: tail.model,
    entrypoint: head.entrypoint,
    messageCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    isActive: false,
    mtime: file.mtime,
    size: file.size,
  };
}

export async function parseSessionFull(
  file: ScannedFile
): Promise<SessionMeta | null> {
  const bunFile = Bun.file(file.filePath);
  const text = await bunFile.text();
  const records = tryParseJsonLines(text);

  const head = extractFromHead(records);
  if (!head.sessionId || !head.firstTimestamp) return null;

  const tail = extractFromTail(records);

  let messageCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const rec of records) {
    const r = rec as Record<string, unknown>;
    if (r.type === "user" || r.type === "assistant") {
      messageCount++;
    }
    if (r.type === "assistant") {
      const msg = r.message as Record<string, unknown> | undefined;
      const usage = msg?.usage as Record<string, number> | undefined;
      if (usage) {
        totalInputTokens +=
          (usage.input_tokens ?? 0) +
          (usage.cache_creation_input_tokens ?? 0) +
          (usage.cache_read_input_tokens ?? 0);
        totalOutputTokens += usage.output_tokens ?? 0;
      }
    }
  }

  const cwd = head.cwd ?? "";
  const projectName = cwd ? cwd.split("/").filter(Boolean).pop() ?? "" : "";

  return {
    sessionId: head.sessionId,
    filePath: file.filePath,
    cwd,
    projectName,
    slug: head.slug,
    name: null,
    firstTimestamp: head.firstTimestamp,
    lastTimestamp: tail.lastTimestamp ?? head.firstTimestamp,
    firstUserMessage: head.firstUserMessage,
    model: tail.model,
    entrypoint: head.entrypoint,
    messageCount,
    totalInputTokens,
    totalOutputTokens,
    isActive: false,
    mtime: file.mtime,
    size: file.size,
  };
}
