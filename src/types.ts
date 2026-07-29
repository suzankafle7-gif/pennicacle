// ============================================================
// Pinnacle Engine — Shared Types
// ============================================================

/** A task submitted to Pinnacle by the user. */
export interface Task {
  description: string;
  workingDir: string;
}

/** An individual step within a plan. */
export interface PlanStep {
  id: string;
  description: string;
  action: Action;
  status: 'pending' | 'running' | 'done' | 'failed';
}

/** All actions Pinnacle can perform. */
export type Action =
  | { type: 'read_file'; path: string }
  | { type: 'write_file'; path: string; content: string }
  | { type: 'run_command'; command: string }
  | { type: 'search_code'; query: string }
  | { type: 'think'; reasoning: string };

/** Result of executing an action. */
export interface Observation {
  success: boolean;
  output: string;
}

/** A plan produced by the LLM. */
export interface Plan {
  steps: PlanStep[];
  reasoning: string;
}

/** Full agent state machine. */
export interface AgentState {
  task: Task;
  plan?: Plan;
  history: { step: PlanStep; observation: Observation }[];
}

/** Final summary after the agentic loop completes. */
export interface AgentResult {
  success: boolean;
  task: Task;
  stepsCompleted: number;
  stepsFailed: number;
  summary: string;
}

/** Codebase structure summary produced by the scanner. */
export interface CodebaseSummary {
  framework: string;
  language: string;
  dependencies: Record<string, string>;
  fileTree: string[];
  keyFiles: KeyFile[];
  workingDir: string;
}

/** A file deemed important by the scanner. */
export interface KeyFile {
  path: string;
  reason: string;
}
