# clautinue

Browse and resume [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions from anywhere.

Claude Code ties sessions to the directory where they started — to continue one, you have to `cd` there first. **clautinue** gives you a single searchable picker across all your projects.

## Features

- Lists all Claude Code sessions across every project
- Active sessions highlighted at the top with a green indicator
- Stats at a glance: duration, message count, total tokens
- Type to search by project name, session name, first message, or path
- Selecting a session drops you straight into `claude --resume`
- Active session protection: take over, fork, or fork + git worktree
- Responsive layout adapts to terminal width
- Fast: caches parsed metadata for instant subsequent launches

## Install

### Homebrew (macOS / Linux)

```bash
brew install yscheef/tap/clautinue
```

### Download binary

Grab the latest release for your platform:

```bash
# macOS (Apple Silicon)
curl -fsSL https://github.com/yscheef/clautinue/releases/latest/download/clautinue-darwin-arm64.tar.gz | tar xz
sudo mv clautinue-darwin-arm64 /usr/local/bin/clautinue

# macOS (Intel)
curl -fsSL https://github.com/yscheef/clautinue/releases/latest/download/clautinue-darwin-x64.tar.gz | tar xz
sudo mv clautinue-darwin-x64 /usr/local/bin/clautinue

# Linux (x64)
curl -fsSL https://github.com/yscheef/clautinue/releases/latest/download/clautinue-linux-x64.tar.gz | tar xz
sudo mv clautinue-linux-x64 /usr/local/bin/clautinue

# Linux (ARM64)
curl -fsSL https://github.com/yscheef/clautinue/releases/latest/download/clautinue-linux-arm64.tar.gz | tar xz
sudo mv clautinue-linux-arm64 /usr/local/bin/clautinue
```

### From source (requires [Bun](https://bun.sh))

```bash
git clone https://github.com/yscheef/clautinue.git
cd clautinue
bun install
bun link
```

## Usage

```bash
# Interactive session picker
clautinue

# Only show active sessions
clautinue --active

# Filter by project name
clautinue --project my-app

# Limit results
clautinue --limit 20

# Force re-parse (skip cache)
clautinue --no-cache
```

### Session display

```
 ● my-saas-app            feature-auth-overhaul                2h ago   4h54m   672  msgs  59.8M  tok
   side-project           curious-spinning-hennessy            1d ago   21h45m  1560 msgs  251.1M tok
   open-source-lib        dc0c9835                             6h ago   21h49m  1914 msgs  215.5M tok
```

- Green `●` = active session (running in another terminal)
- Magenta `◆` = desktop app session
- Project name, session name or slug, last activity, duration, messages, tokens
- Description line shows: working directory, model, and a preview of the first message

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| Type | Filter sessions by name, project, path, or first message |
| `Enter` | Resume selected session |
| `Escape` | Quit |
| `q` | Quit (in action menu only) |
| `↑` `↓` | Navigate |

### Active sessions

When you select an active session, you get three options:

- **Take over** — resume here, the other terminal loses the session
- **Fork** — branch off a new conversation from the current state
- **Fork + Worktree** — fork conversation + create a git worktree for isolated code changes

## How it works

clautinue reads Claude Code's session data from `~/.claude/projects/` and `~/.claude/sessions/`. It parses the JSONL conversation files to extract metadata (timestamps, token usage, message counts) and caches the results at `~/.cache/clautinue/sessions.json` for fast subsequent launches.

Active sessions are verified by checking if their PID is still running, so stale session files are automatically filtered out.

## License

MIT
