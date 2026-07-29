// ============================================================
// Pinnacle Engine — Context Assembler
// ============================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CodebaseSummary, Task } from './types';
import { PINNACLE_SYSTEM_PROMPT } from './prompts';

/**
 * Build a rich system prompt that includes full codebase context.
 */
export function buildSystemPrompt(summary: CodebaseSummary): string {
  const lines: string[] = [];

  lines.push(PINNACLE_SYSTEM_PROMPT);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Codebase Context');
  lines.push('');
  lines.push(`**Project type:** ${summary.framework}`);
  lines.push(`**Language:** ${summary.language}`);
  lines.push(`**Working directory:** ${summary.workingDir}`);
  lines.push('');

  // Dependencies
  const depEntries = Object.entries(summary.dependencies);
  if (depEntries.length > 0) {
    lines.push('### Dependencies');
    for (const [name, version] of depEntries.slice(0, 30)) {
      lines.push(`- \`${name}\`: ${version}`);
    }
    if (depEntries.length > 30) {
      lines.push(`- ... and ${depEntries.length - 30} more`);
    }
    lines.push('');
  }

  // Key files with contents
  lines.push('### Key Files');
  for (const kf of summary.keyFiles) {
    const absPath = path.join(summary.workingDir, kf.path);
    lines.push(`\n**${kf.path}** (${kf.reason})`);
    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      // Truncate very large files
      const truncated = content.length > 4000 ? content.slice(0, 4000) + '\n// ... truncated' : content;
      lines.push('```');
      lines.push(truncated);
      lines.push('```');
    } catch {
      lines.push('_(unable to read)_');
    }
  }

  // Full file tree (abbreviated if large)
  lines.push('');
  lines.push('### File Tree');
  lines.push('```');
  if (summary.fileTree.length > 100) {
    lines.push(...summary.fileTree.slice(0, 100));
    lines.push(`... and ${summary.fileTree.length - 100} more files`);
  } else {
    lines.push(...summary.fileTree);
  }
  lines.push('```');

  return lines.join('\n');
}

/**
 * Build the user-facing task prompt.
 */
export function buildUserPrompt(task: Task): string {
  return `## Task

${task.description}

Please analyze the codebase context above and produce a step-by-step plan to complete this task. Respond with a JSON object:

{
  "reasoning": "Your thinking about the approach...",
  "steps": [
    { "id": "1", "description": "What this step does", "action": { "type": "read_file", "path": "..." } },
    { "id": "2", "description": "What this step does", "action": { "type": "write_file", "path": "...", "content": "..." } },
    ...
  ]
}

Respond with ONLY valid JSON, no markdown fences, no explanation outside the JSON.`;
}
