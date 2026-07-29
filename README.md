# Pinnacle CLI Engine

> **Pinnacle** is an agentic AI coding agent. Give it a natural-language task, and it scans your codebase, plans an approach, writes code, runs commands, reads output, and iterates until the job is done.

This is the **core CLI engine** — the brains of Pinnacle. It is currently in active development with a stubbed LLM backend.

## Quick Start

```bash
# Install dependencies
cd pinnacle-engine
bun install

# Run against the test project
bun run src/cli.ts --dir ./test-project "add a hello world endpoint"

# Or use the bin shim
./bin/pinnacle --dir ./test-project "fix all type errors"

# For your own project
./bin/pinnacle --dir /path/to/your/project "refactor the auth module"
```

## Architecture

```
pinnacle-engine/
├── bin/
│   └── pinnacle          # Shell shim (delegates to src/cli.ts)
├── src/
│   ├── cli.ts            # CLI entry point — arg parsing, banner, orchestration
│   ├── loop.ts           # Agentic loop controller — 5-phase execution engine
│   ├── scanner.ts        # Codebase scanner — file tree, framework detection, key files
│   ├── context.ts        # Context assembler — builds system+user prompts from scan data
│   ├── executor.ts       # Action executor — safe execution of all 5 action types
│   ├── llm.ts            # LLM client (STUB) — mock plan generation for development
│   ├── prompts.ts        # System prompts — the Pinnacle personality and output format
│   └── types.ts          # Shared TypeScript types
├── test-project/         # Minimal Express+TS project for testing
├── package.json
├── tsconfig.json
└── README.md
```

## The Agentic Loop

Pinnacle runs a 5-phase loop:

1. **Scan** — Recursively lists all files (respecting `.gitignore`), identifies the framework (React, Next.js, Express, etc.), language, dependencies, and key files.

2. **Context** — Assembles a rich system prompt that includes the full codebase summary, key file contents, dependency manifest, and file tree.

3. **Plan** — The LLM produces a step-by-step plan. Each step has an action: `read_file`, `write_file`, `run_command`, `search_code`, or `think`.

4. **Execute** — Each step runs with up to 3 retries on failure. If all retries fail, the LLM is asked for a recovery strategy. The loop stops when all steps complete or the max iteration count (20) is reached.

5. **Summary** — A final report with execution log, success/failure counts, and timing.

## Wiring Up a Real LLM

The LLM client (`src/llm.ts`) is currently **stubbed** for development. To connect a real LLM:

### 1. Set environment variables

```bash
export PINNACLE_API_KEY="your-api-key"
export PINNACLE_MODEL="claude-sonnet-4-20250514"   # default
export PINNACLE_API_URL="https://api.anthropic.com/v1/messages"  # default
```

### 2. Implement the real calls

In `src/llm.ts`, replace the three stub functions:

- **`generatePlan(task, systemPrompt, userPrompt, summary)`** — send the prompts to the LLM, parse the JSON response into a `Plan` object with steps.

- **`generateNextAction(state, observation)`** — after a step completes, optionally ask the LLM if additional actions are needed.

- **`generateRecovery(failedStep, observation)`** — when a step fails, ask the LLM for a corrected alternative action.

The stub currently produces realistic mock plans that exercise every action type, so you can develop and test the execution engine independently of an LLM.

### 3. Expected API contract

The LLM should return JSON matching this schema:

```json
{
  "reasoning": "Explanation of the overall approach",
  "steps": [
    {
      "id": "1",
      "description": "What this step does",
      "action": {
        "type": "read_file | write_file | run_command | search_code | think",
        ...
      }
    }
  ]
}
```

## Action Types

| Action | Description |
|--------|-------------|
| `read_file` | Read a file's contents. Returns the full text. |
| `write_file` | Create or overwrite a file. Creates parent directories as needed. |
| `run_command` | Execute a shell command. 60s timeout. Captures stdout and stderr. |
| `search_code` | Grep the codebase. Searches `.ts`, `.tsx`, `.js`, `.jsx`, `.json` files. |
| `think` | Reason through a problem. Logs the reasoning without side effects. |

## Testing

```bash
# Run against the included test project
bun run src/cli.ts --dir ./test-project "add a hello world endpoint"

# Run with a different task
./bin/pinnacle --dir ./test-project "implement user authentication"
```

The test project is a minimal Express + TypeScript server with two endpoints (`/` and `/health`). The stub LLM will read its files, search for patterns, and simulate code changes — demonstrating the full loop without an API key.

## CLI Options

```
Usage: pinnacle [--dir <path>] [--model <name>] "<task description>"

Options:
  --dir <path>     Working directory (default: current directory)
  --model <name>   LLM model to use (default: from PINNACLE_MODEL env)
  --help, -h       Show help
  --version, -v    Show version

Environment:
  PINNACLE_API_KEY   API key for the LLM provider
  PINNACLE_MODEL     Model name (default: claude-sonnet-4-20250514)
  PINNACLE_API_URL   Provider base URL
```

## Development

```bash
bun run check      # Type-check all source files with Bun
bun run typecheck  # Type-check with tsc --noEmit
```

Built with **Bun** + **TypeScript**. Zero runtime dependencies — everything uses Bun's built-in APIs (`Bun.file`, `Bun.write`, `Bun.spawn`).
