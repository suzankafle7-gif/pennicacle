// ============================================================
// Pinnacle Engine — Agentic Loop Controller
// ============================================================

import type { Task, AgentResult, PlanStep, Observation, AgentState } from './types';
import { scanCodebase } from './scanner';
import { buildSystemPrompt, buildUserPrompt } from './context';
import { executeAction } from './executor';
import { generatePlan, generateNextAction, generateRecovery } from './llm';

// ANSI color helpers
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  magenta: '\x1b[35m',
};

const MAX_ITERATIONS = 20;
const MAX_RETRIES = 3;

/**
 * The core agentic loop. Give it a task and it plans, executes, and iterates.
 */
export async function runAgent(task: Task): Promise<AgentResult> {
  const state: AgentState = {
    task,
    history: [],
  };

  let stepsCompleted = 0;
  let stepsFailed = 0;

  // ---- Phase 1: Scan ----
  printHeader('PHASE 1: Scanning Codebase');
  const summary = await scanCodebase(task.workingDir);
  printScanResults(summary);

  // ---- Phase 2: Context ----
  printHeader('PHASE 2: Building Context');
  const systemPrompt = buildSystemPrompt(summary);
  const userPrompt = buildUserPrompt(task);
  printDim(`System prompt: ${systemPrompt.length} chars, User prompt: ${userPrompt.length} chars`);

  // ---- Phase 3: Plan ----
  printHeader('PHASE 3: Generating Plan');
  printYellow('Asking LLM to create a step-by-step plan...');
  const plan = await generatePlan(task, systemPrompt, userPrompt, summary);
  state.plan = plan;

  printCyan(`\nReasoning: ${plan.reasoning}`);
  printBold(`\nPlan: ${plan.steps.length} steps`);
  for (const step of plan.steps) {
    const actionDesc = describeAction(step);
    printDim(`  [${step.id}] ${step.description}  →  ${actionDesc}`);
  }

  // ---- Phase 4: Execute Loop ----
  printHeader('PHASE 4: Executing Plan');

  let iteration = 0;
  for (const step of plan.steps) {
    iteration++;
    if (iteration > MAX_ITERATIONS) {
      printRed(`\n⚠ Max iterations (${MAX_ITERATIONS}) reached. Stopping.`);
      break;
    }

    printBold(`\n── Step ${step.id}/${plan.steps.length}: ${step.description}`);
    printDim(`   Action: ${describeAction(step)}`);

    // Execute with retries
    let observation: Observation = { success: false, output: 'Not executed' };
    let succeeded = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 1) {
        printYellow(`   Retry ${attempt}/${MAX_RETRIES}...`);
      }

      step.status = 'running';
      observation = await executeAction(step.action, task.workingDir);

      if (observation.success) {
        step.status = 'done';
        succeeded = true;
        stepsCompleted++;
        printGreen(`   ✓ Success (${formatOutputPreview(observation.output)})`);
        break;
      } else {
        printRed(`   ✗ Failed (attempt ${attempt}/${MAX_RETRIES}): ${formatOutputPreview(observation.output)}`);
      }
    }

    // If all retries failed, try recovery
    if (!succeeded) {
      step.status = 'failed';
      stepsFailed++;

      printYellow('   ⟳ Asking LLM for recovery strategy...');
      const recoverySteps = await generateRecovery(state, step, observation);

      for (const recoveryStep of recoverySteps) {
        recoveryStep.status = 'running';
        printDim(`   Recovery: ${recoveryStep.description}`);

        const recoveryObs = await executeAction(
          recoveryStep.action,
          task.workingDir
        );
        if (recoveryObs.success) {
          recoveryStep.status = 'done';
          stepsCompleted++;
          printGreen(
            `   ✓ Recovery succeeded: ${formatOutputPreview(recoveryObs.output)}`
          );
        } else {
          recoveryStep.status = 'failed';
          stepsFailed++;
          printRed(
            `   ✗ Recovery failed: ${formatOutputPreview(recoveryObs.output)}`
          );
        }

        state.history.push({ step: recoveryStep, observation: recoveryObs });
      }
    }

    state.history.push({ step, observation });

    // Check for LLM-directed next action
    const nextAction = await generateNextAction(state, observation);
    if (nextAction) {
      printYellow('   → LLM suggests additional action...');
      const nextObs = await executeAction(nextAction.action, task.workingDir);
      if (nextObs.success) {
        stepsCompleted++;
        printGreen(`   ✓ Extra action succeeded: ${formatOutputPreview(nextObs.output)}`);
      } else {
        stepsFailed++;
        printRed(`   ✗ Extra action failed: ${formatOutputPreview(nextObs.output)}`);
      }
      state.history.push({ step: nextAction, observation: nextObs });
    }
  }

  // ---- Phase 5: Summary ----
  printHeader('PHASE 5: Complete');
  printBold(`\n  Steps completed: ${stepsCompleted}`);
  if (stepsFailed > 0) {
    printRed(`  Steps failed:     ${stepsFailed}`);
  } else {
    printGreen(`  Steps failed:     0`);
  }
  printDim(`  Total history entries: ${state.history.length}`);

  return {
    success: stepsFailed === 0,
    task,
    stepsCompleted,
    stepsFailed,
    summary: buildSummary(state, stepsCompleted, stepsFailed),
  };
}

// ---- Output helpers ----

function printHeader(text: string): void {
  console.log(`\n${C.bold}${C.white}${'═'.repeat(60)}${C.reset}`);
  console.log(`${C.bold}${C.white}  ${text}${C.reset}`);
  console.log(`${C.bold}${C.white}${'═'.repeat(60)}${C.reset}\n`);
}

function printCyan(text: string): void {
  console.log(`${C.cyan}${text}${C.reset}`);
}

function printYellow(text: string): void {
  console.log(`${C.yellow}${text}${C.reset}`);
}

function printGreen(text: string): void {
  console.log(`${C.green}${text}${C.reset}`);
}

function printRed(text: string): void {
  console.log(`${C.red}${text}${C.reset}`);
}

function printBold(text: string): void {
  console.log(`${C.bold}${text}${C.reset}`);
}

function printDim(text: string): void {
  console.log(`${C.dim}${text}${C.reset}`);
}

function printScanResults(summary: {
  framework: string;
  language: string;
  fileTree: string[];
  keyFiles: { path: string; reason: string }[];
}): void {
  printCyan(`  Framework:   ${summary.framework}`);
  printCyan(`  Language:    ${summary.language}`);
  printCyan(`  Files found: ${summary.fileTree.length}`);
  printCyan(`  Key files:   ${summary.keyFiles.length}`);
  for (const kf of summary.keyFiles.slice(0, 8)) {
    printDim(`    • ${kf.path}  (${kf.reason})`);
  }
  if (summary.keyFiles.length > 8) {
    printDim(`    ... and ${summary.keyFiles.length - 8} more`);
  }
}

function describeAction(step: PlanStep): string {
  switch (step.action.type) {
    case 'read_file':
      return `read_file(${step.action.path})`;
    case 'write_file':
      return `write_file(${step.action.path})`;
    case 'run_command':
      return `run_command(${step.action.command.slice(0, 50)}${step.action.command.length > 50 ? '...' : ''})`;
    case 'search_code':
      return `search_code(${step.action.query})`;
    case 'think':
      return `think(${step.action.reasoning.slice(0, 40)}...)`;
  }
}

function formatOutputPreview(output: string): string {
  const firstLine = output.split('\n')[0].slice(0, 80);
  return firstLine + (output.length > 80 ? '...' : '');
}

function buildSummary(
  state: AgentState,
  completed: number,
  failed: number
): string {
  const lines: string[] = [];
  lines.push(`Task: ${state.task.description}`);
  lines.push(`Directory: ${state.task.workingDir}`);
  lines.push(`Steps executed: ${state.history.length}`);
  lines.push(`Succeeded: ${completed}, Failed: ${failed}`);

  lines.push('\nExecution log:');
  for (const { step } of state.history) {
    const statusIcon = step.status === 'done' ? '✓' : step.status === 'failed' ? '✗' : '○';
    lines.push(`  ${statusIcon} [${step.id}] ${step.description}`);
  }

  return lines.join('\n');
}
