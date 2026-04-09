import type { SessionMeta } from "./types.js";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const MAGENTA = "\x1b[35m";

function getCols(): number {
  return process.stdout.columns || 120;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatTokens(n: number): string {
  if (n === 0) return "0";
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function duration(first: string, last: string): string {
  const diff = new Date(last).getTime() - new Date(first).getTime();
  if (diff < 60_000) return "<1m";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return remMins > 0 ? `${hours}h${remMins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

export function formatSessionRow(s: SessionMeta): string {
  const cols = getCols();
  const isDesktop = s.entrypoint === "claude-desktop";
  const indicator = s.isActive
    ? `${GREEN}●${RESET} `
    : isDesktop
      ? `${MAGENTA}◆${RESET} `
      : "  ";

  // Fixed-width parts: indicator(2) + time(9) + separators
  // Adaptive parts: project, label, duration, msgs, tokens
  const timeStr = relativeTime(s.lastTimestamp);
  const durStr = duration(s.firstTimestamp, s.lastTimestamp);
  const msgsStr = `${s.messageCount} msgs`;
  const tokStr = `${formatTokens(s.totalInputTokens + s.totalOutputTokens)} tok`;

  if (cols < 60) {
    // Narrow: just project + time
    const projectW = Math.max(cols - 15, 10);
    const project = `${BOLD}${pad(s.projectName, projectW)}${RESET}`;
    const time = `${CYAN}${pad(timeStr, 9)}${RESET}`;
    return `${indicator}${project} ${time}`;
  }

  if (cols < 100) {
    // Medium: project + label + time
    const projectW = Math.min(20, Math.floor(cols * 0.25));
    const labelW = Math.max(cols - projectW - 15, 8);
    const project = `${BOLD}${pad(s.projectName, projectW)}${RESET}`;
    const label = pad(s.name ?? s.slug ?? s.sessionId.slice(0, 8), labelW);
    const time = `${CYAN}${pad(timeStr, 9)}${RESET}`;
    return `${indicator}${project} ${label} ${time}`;
  }

  // Wide: full layout
  const statsW = 9 + 1 + 7 + 1 + msgsStr.length + 2 + tokStr.length; // time + dur + msgs + tokens
  const remaining = cols - 2 - statsW - 4; // indicator + stats + separators
  const projectW = Math.min(24, Math.floor(remaining * 0.4));
  const labelW = remaining - projectW - 1;

  const project = `${BOLD}${pad(s.projectName, projectW)}${RESET}`;
  const label = pad(s.name ?? s.slug ?? s.sessionId.slice(0, 8), labelW);
  const time = `${CYAN}${pad(timeStr, 9)}${RESET}`;
  const dur = `${DIM}${pad(durStr, 7)}${RESET}`;
  const msgs = pad(msgsStr, msgsStr.length);
  const tokens = `${YELLOW}${tokStr}${RESET}`;

  return `${indicator}${project} ${label} ${time} ${dur} ${msgs}  ${tokens}`;
}

export function formatSessionDescription(s: SessionMeta): string {
  const cols = getCols();
  const cleaned = s.firstUserMessage.replace(/[\n\r]+/g, " ").trim();
  const previewLen = Math.max(cols - 50, 30);
  const preview = cleaned
    ? `${DIM}"${cleaned.slice(0, previewLen)}${cleaned.length > previewLen ? "..." : ""}"${RESET}`
    : "";
  const desktop = s.entrypoint === "claude-desktop" ? `${MAGENTA}desktop${RESET}` : "";
  const model = s.model ? `${DIM}${s.model}${RESET}` : "";
  const cwd = `${DIM}${s.cwd}${RESET}`;

  if (cols < 80) {
    return [cwd, preview].filter(Boolean).join("  ");
  }
  return [cwd, desktop, model, preview].filter(Boolean).join("  ");
}
