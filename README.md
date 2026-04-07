# clautinue

Browse and resume [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions from anywhere.

Claude Code ties sessions to the directory where they started — to continue one, you have to `cd` there first. **clautinue** gives you a single searchable picker across all your projects.

![demo](https://github.com/user-attachments/assets/placeholder)

## Features

- Lists all Claude Code sessions across every project
- Active sessions highlighted at the top with a green indicator
- Stats at a glance: duration, message count, total tokens
- Type to search by project name, session name, first message, or path
- Selecting a session drops you straight into `claude --resume`
- Active session protection: prompts to fork instead of conflicting
- Fast: parses session files efficiently and caches metadata

## Install

Requires [Bun](https://bun.sh).

```bash
# Clone and link
git clone https://github.com/yscheef/clautinue.git
cd clautinue
bun install
bun link
```

`clautinue` is now available globally.

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
- Project name, session name or slug, last activity, duration, messages, tokens
- Description line shows: working directory, model, and a preview of the first message

### Active sessions

When you select an active session, clautinue warns you and offers to **fork** it — creating a new branch of the conversation without affecting the running instance.

## How it works

clautinue reads Claude Code's session data from `~/.claude/projects/` and `~/.claude/sessions/`. It parses the JSONL conversation files to extract metadata (timestamps, token usage, message counts) and caches the results at `~/.cache/clautinue/sessions.json` for fast subsequent launches.

## License

MIT
