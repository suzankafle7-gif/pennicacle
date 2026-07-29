#!/usr/bin/env bun
// ============================================================
// Pinnacle CLI — Entry Point
// ============================================================

import { runAgent } from './loop';
import type { Task } from './types';

// ANSI
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

function printBanner(): void {
  console.log(`
${C.cyan}${C.bold}  ╔══════════════════════════════════════════════╗
  ║  ██████╗ ██╗███╗   ██╗███╗   ██╗ █████╗  ██████╗██╗     ███████╗  ║
  ║  ██╔══██╗██║████╗  ██║████╗  ██║██╔══██╗██╔════╝██║     ██╔════╝  ║
  ║  ██████╔╝██║██╔██╗ ██║██╔██╗ ██║███████║██║     ██║     █████╗    ║
  ║  ██╔═══╝ ██║██║╚██╗██║██║╚██╗██║██╔══██║██║     ██║     ██╔══╝    ║
  ║  ██║     ██║██║ ╚████║██║ ╚████║██║  ██║╚██████╗███████╗███████╗  ║
  ║  ╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚══════╝  ║
  ║                                                          v0.1.0    ║
  ╚════════════════════════════════════════════════════════════════════╝${C.reset}
`);
}

function printUsage(): void {
  console.log(`${C.bold}Usage:${C.reset} pinnacle [--dir <path>] [--model <name>] "<task description>"`);
  console.log();
  console.log(`${C.bold}Options:${C.reset}`);
  console.log(`  --dir <path>     Working directory (default: current directory)`);
  console.log(`  --model <name>   LLM model to use (default: from PINNACLE_MODEL env)`);
  console.log(`  --help, -h       Show this help message`);
  console.log(`  --version, -v    Show version`);
  console.log();
  console.log(`${C.bold}Examples:${C.reset}`);
  console.log(`  pinnacle "add a hello world endpoint"`);
  console.log(`  pinnacle --dir ./my-project "refactor the auth module"`);
  console.log(`  pinnacle --model gpt-4 "fix all type errors"`);
  console.log();
  console.log(`${C.bold}Environment:${C.reset}`);
  console.log(`  PINNACLE_API_KEY   Groq API key (required for real LLM plans)`);
  console.log(`  PINNACLE_MODEL     Model name (default: llama-3.3-70b-versatile)`);
  console.log();
  console.log(`${C.dim}Note: Without PINNACLE_API_KEY, Pinnacle uses fallback plans.${C.reset}`);
}

function parseArgs(args: string[]): { dir?: string; model?: string; task?: string } {
  const result: { dir?: string; model?: string; task?: string } = {};
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--dir' || arg === '-d') {
      result.dir = args[++i];
    } else if (arg === '--model' || arg === '-m') {
      result.model = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      printBanner();
      printUsage();
      process.exit(0);
    } else if (arg === '--version' || arg === '-v') {
      console.log('pinnacle v0.1.0');
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      result.task = arg;
    }
    i++;
  }
  return result;
}

// ---- Main ----

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  if (!parsed.task) {
    printBanner();
    printUsage();
    console.log(`\n${C.red}Error: A task description is required.${C.reset}`);
    process.exit(1);
  }

  printBanner();

  const workingDir = parsed.dir ? parsed.dir : process.cwd();
  const task: Task = {
    description: parsed.task,
    workingDir,
  };

  console.log(`${C.bold}Task:${C.reset}        ${C.cyan}${task.description}${C.reset}`);
  console.log(`${C.bold}Working dir:${C.reset}  ${C.dim}${task.workingDir}${C.reset}`);

  if (parsed.model) {
    console.log(`${C.bold}Model:${C.reset}       ${C.yellow}${parsed.model}${C.reset}`);
  }

  const apiKey = process.env.PINNACLE_API_KEY;
  if (!apiKey) {
    console.log('');
    console.log(`${C.red}${C.bold}╔══════════════════════════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.red}${C.bold}║  ⚠️  WARNING: PINNACLE_API_KEY is not set                      ║${C.reset}`);
    console.log(`${C.red}${C.bold}║                                                                ║${C.reset}`);
    console.log(`${C.red}${C.bold}║  Pinnacle will use FALLBACK plans instead of a real LLM.       ║${C.reset}`);
    console.log(`${C.red}${C.bold}║  Set PINNACLE_API_KEY to enable AI-powered plan generation.    ║${C.reset}`);
    console.log(`${C.red}${C.bold}║                                                                ║${C.reset}`);
    console.log(`${C.red}${C.bold}║  Get a key at: https://console.groq.com/keys                   ║${C.reset}`);
    console.log(`${C.red}${C.bold}║  Then: export PINNACLE_API_KEY="gsk_..."                       ║${C.reset}`);
    console.log(`${C.red}${C.bold}╚══════════════════════════════════════════════════════════════════╝${C.reset}`);
    console.log('');
  }

  const startTime = Date.now();
  const result = await runAgent(task);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Final summary
  console.log(`\n${C.bold}${C.white}${'═'.repeat(60)}${C.reset}`);
  console.log(`${C.bold}${C.white}  PINNACLE RUN COMPLETE${C.reset}`);
  console.log(`${C.bold}${C.white}${'═'.repeat(60)}${C.reset}`);

  console.log(`\n${C.bold}Result:${C.reset}  ${result.success ? C.green + 'SUCCESS' : C.red + 'PARTIAL FAILURE'}${C.reset}`);
  console.log(`${C.bold}Time:${C.reset}    ${elapsed}s`);
  console.log(`${C.bold}Steps:${C.reset}   ${result.stepsCompleted} succeeded, ${result.stepsFailed} failed`);

  console.log(`\n${C.dim}${result.summary}${C.reset}\n`);

  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error(`${C.red}Fatal error:${C.reset}`, err);
  process.exit(2);
});
