import type { SessionMeta } from "./types.js";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const MAGENTA = "\x1b[35m";

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
  const isDesktop = s.entrypoint === "claude-desktop";
  const indicator = s.isActive
    ? `${GREEN}●${RESET} `
    : isDesktop
      ? `${MAGENTA}◆${RESET} `
      : "  ";
  const project = `${BOLD}${pad(s.projectName, 24)}${RESET}`;
  const label = pad(s.name ?? s.slug ?? s.sessionId.slice(0, 8), 36);
  const time = `${CYAN}${pad(relativeTime(s.lastTimestamp), 9)}${RESET}`;
  const dur = `${DIM}${pad(duration(s.firstTimestamp, s.lastTimestamp), 7)}${RESET}`;
  const msgs = `${pad(String(s.messageCount), 4)} msgs`;
  const tokens = `${YELLOW}${pad(formatTokens(s.totalInputTokens + s.totalOutputTokens), 6)}${RESET} tok`;

  return `${indicator}${project} ${label} ${time} ${dur} ${msgs}  ${tokens}`;
}

export function formatSessionDescription(s: SessionMeta): string {
  const cleaned = s.firstUserMessage.replace(/[\n\r]+/g, " ").trim();
  const preview = cleaned
    ? `${DIM}"${cleaned.slice(0, 80)}${cleaned.length > 80 ? "..." : ""}"${RESET}`
    : "";
  const desktop = s.entrypoint === "claude-desktop" ? `${MAGENTA}desktop${RESET}` : "";
  const model = s.model ? `${DIM}${s.model}${RESET}` : "";
  const cwd = `${DIM}${s.cwd}${RESET}`;
  return [cwd, desktop, model, preview].filter(Boolean).join("  ");
}
