// ============================================================
// Pinnacle Engine — Action Executor
// ============================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Action, Observation } from './types';

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_LENGTH = 50_000;

/**
 * Execute a single action and return an Observation.
 * All errors are caught and returned as failed observations — this never throws.
 */
export async function executeAction(
  action: Action,
  workingDir: string
): Promise<Observation> {
  try {
    switch (action.type) {
      case 'read_file':
        return readFile(path.resolve(workingDir, action.path));
      case 'write_file':
        return writeFile(path.resolve(workingDir, action.path), action.content);
      case 'run_command':
        return runCommand(action.command, workingDir);
      case 'search_code':
        return searchCode(action.query, workingDir);
      case 'think':
        return think(action.reasoning);
      default:
        return { success: false, output: `Unknown action type: ${(action as Action).type}` };
    }
  } catch (err) {
    return {
      success: false,
      output: `Unexpected error executing ${action.type}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---- individual executors ----

async function readFile(filePath: string): Promise<Observation> {
  if (!fs.existsSync(filePath)) {
    return { success: false, output: `File not found: ${filePath}` };
  }
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      return { success: false, output: `Path is a directory, not a file: ${filePath}` };
    }
    if (stat.size > 1_000_000) {
      return { success: false, output: `File too large (${stat.size} bytes): ${filePath}` };
    }
    const file = Bun.file(filePath);
    const content = await file.text();
    return { success: true, output: content };
  } catch (err) {
    return { success: false, output: `Failed to read ${filePath}: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function writeFile(filePath: string, content: string): Observation {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    Bun.write(filePath, content);
    return { success: true, output: `Successfully wrote ${filePath} (${content.length} bytes)` };
  } catch (err) {
    return {
      success: false,
      output: `Failed to write ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function runCommand(command: string, cwd: string): Promise<Observation> {
  const startTime = Date.now();
  try {
    const proc = Bun.spawn(['sh', '-c', command], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env },
    });

    const [stdout, stderr] = await Promise.all([
      readStream(proc.stdout),
      readStream(proc.stderr),
    ]);

    const timeout = setTimeout(() => {
      proc.kill();
    }, DEFAULT_TIMEOUT_MS);

    const exitCode = await proc.exited;
    clearTimeout(timeout);

    const elapsed = Date.now() - startTime;
    const combined = [stdout, stderr].filter(Boolean).join('\n').trim() || '(no output)';
    const truncated =
      combined.length > MAX_OUTPUT_LENGTH
        ? combined.slice(0, MAX_OUTPUT_LENGTH) + `\n... (truncated, ${combined.length} total chars)`
        : combined;

    if (exitCode === 0) {
      return { success: true, output: `[exit 0, ${elapsed}ms]\n${truncated}` };
    } else {
      return { success: false, output: `[exit ${exitCode}, ${elapsed}ms]\n${truncated}` };
    }
  } catch (err) {
    return {
      success: false,
      output: `Command failed to spawn: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function readStream(
  stream: ReadableStream<Uint8Array> | null
): Promise<string> {
  if (!stream) return '';
  const reader = stream.getReader();
  let result = '';
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode(); // flush
  return result;
}

async function searchCode(query: string, cwd: string): Promise<Observation> {
  try {
    const proc = Bun.spawn(
      ['grep', '-rn', '--include=*.ts', '--include=*.tsx', '--include=*.js', '--include=*.jsx', '--include=*.json', query, '.'],
      {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );

    const [stdout] = await Promise.all([
      readStream(proc.stdout),
      readStream(proc.stderr),
    ]);

    await proc.exited;

    const output = stdout.trim();
    if (!output) {
      return { success: true, output: `No matches found for: ${query}` };
    }

    const lines = output.split('\n');
    const truncated =
      lines.length > 100
        ? lines.slice(0, 100).join('\n') + `\n... (${lines.length - 100} more matches)`
        : output;

    return { success: true, output: truncated };
  } catch (err) {
    return {
      success: false,
      output: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function think(reasoning: string): Observation {
  return {
    success: true,
    output: `Thought: ${reasoning}`,
  };
}
