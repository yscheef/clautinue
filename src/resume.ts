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
  const proc = Bun.spawn(args, {
    stdio: ["inherit", "inherit", "inherit"],
    cwd,
  });
  const code = await proc.exited;
  process.exit(code);
}
