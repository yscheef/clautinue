import { basename } from "node:path";

const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

function isGitRepo(cwd: string): boolean {
  const result = Bun.spawnSync(["git", "rev-parse", "--is-inside-work-tree"], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return result.exitCode === 0;
}

function getCurrentBranch(cwd: string): string | null {
  const result = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.exitCode !== 0) return null;
  return result.stdout.toString().trim();
}

export function createWorktree(cwd: string): string | null {
  if (!isGitRepo(cwd)) return null;

  const branch = getCurrentBranch(cwd);
  const project = basename(cwd);
  const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
  const worktreeBranch = `fork/${project}-${timestamp}`;
  const worktreePath = `${cwd}-fork-${timestamp}`;

  // Create a new branch from current HEAD and set up worktree
  const result = Bun.spawnSync(
    ["git", "worktree", "add", "-b", worktreeBranch, worktreePath],
    {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    }
  );

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    console.error(`${DIM}Failed to create worktree: ${stderr}${RESET}`);
    return null;
  }

  console.log(
    `${GREEN}Worktree created:${RESET} ${worktreePath}`
  );
  console.log(
    `${DIM}Branch: ${worktreeBranch} (from ${branch ?? "HEAD"})${RESET}\n`
  );

  return worktreePath;
}
