export interface SessionMeta {
  sessionId: string;
  filePath: string;
  cwd: string;
  projectName: string;
  slug: string | null;
  name: string | null;
  firstTimestamp: string;
  lastTimestamp: string;
  firstUserMessage: string;
  model: string | null;
  entrypoint: string | null;
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  isActive: boolean;
  mtime: number;
  size: number;
}

export interface ScannedFile {
  filePath: string;
  projectDir: string;
  mtime: number;
  size: number;
}

export interface ActiveSession {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  name?: string;
  kind: string;
  entrypoint: string;
}

export interface CacheData {
  version: number;
  sessions: Record<string, SessionMeta>;
}
