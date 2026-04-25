export async function resumeSession(
  sessionId: string,
  cwd: string,
  fork: boolean = false
): Promise<never> {
  const args = [
    "claude",
    "--resume", sessionId,
    "--dangerously-skip-permissions",
    "--allow-dangerously-skip-permissions",
  ];
  if (fork) args.push("--fork-session");

  // Reset stdin state before handing the TTY to claude. The inquirer prompts
  // in index.ts put stdin into raw + flowing mode; without this the parent's
  // runtime can buffer keystrokes that would otherwise reach the child, which
  // shows up as occasional dropped input in claude's chat.
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.removeAllListeners("data");
  process.stdin.pause();

  const proc = Bun.spawn(args, {
    stdio: ["inherit", "inherit", "inherit"],
    cwd,
  });
  const code = await proc.exited;
  process.exit(code);
}
