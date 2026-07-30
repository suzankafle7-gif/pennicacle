import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";

export const Route = createFileRoute("/playground")({
  component: Playground,
});

const examples = [
  "Build a REST API with Express and TypeScript",
  "Add JWT authentication middleware",
  "Create a React login form with validation",
  "Fix TypeScript build errors",
];

interface EngineResult {
  success: boolean;
  stepsCompleted: number;
  stepsFailed: number;
  summary: string;
}

function Playground() {
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, running]);

  const handleRun = useCallback(async () => {
    const trimmed = task.trim();
    if (!trimmed || running) return;

    setRunning(true);
    setLogs([]);
    setResult(null);
    setError(null);
    setStartTime(Date.now());

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: trimmed }),
      });

      if (!response.ok) {
        setError(`Server responded with ${response.status}`);
        setRunning(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError("No response body available");
        setRunning(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (data.type === "log") {
                setLogs((prev) => [...prev, data.text]);
              } else if (data.type === "done") {
                setResult(data.result);
                setRunning(false);
              } else if (data.type === "error") {
                setError(data.message);
                setRunning(false);
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setRunning(false);
    }
  }, [task, running]);

  const elapsed = startTime
    ? ((Date.now() - startTime) / 1000).toFixed(1)
    : "0.0";

  const statusBadge = error
    ? { label: "Error", color: "bg-red-900/60 text-red-300 border-red-800" }
    : result
      ? result.success
        ? {
            label: "Success",
            color: "bg-green-900/60 text-green-300 border-green-800",
          }
        : {
            label: "Partial",
            color: "bg-yellow-900/60 text-yellow-300 border-yellow-800",
          }
      : null;

  return (
    <div className="min-h-dvh px-6 pb-24 pt-12">
      <div className="mx-auto max-w-3xl">
        {/* ─── Header ─── */}
        <div className="mb-10">
          <h1 className="mb-3 text-4xl font-bold text-white">Try Pinnacle</h1>
          <p className="text-lg text-gray-400">
            Watch an AI agent plan, code, and ship — live.
          </p>
        </div>

        {/* ─── Example tasks ─── */}
        <div className="mb-6 flex flex-wrap gap-3">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={running}
              onClick={() => setTask(ex)}
              className="cursor-pointer rounded-full border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 transition-all hover:border-violet-600 hover:bg-violet-900/30 hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* ─── Task input + Run button ─── */}
        <div className="mb-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <textarea
              rows={5}
              placeholder="Describe your coding task..."
              value={task}
              onChange={(e) => setTask(e.target.value)}
              disabled={running}
              className="min-h-[120px] flex-1 resize-y rounded-xl border border-gray-700 bg-gray-900 px-5 py-4 text-white placeholder-gray-500 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleRun}
              disabled={running || !task.trim()}
              className="cursor-pointer rounded-xl bg-violet-600 px-6 py-4 font-semibold text-white shadow-lg shadow-violet-600/30 transition-all hover:bg-violet-500 hover:shadow-violet-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:self-start"
            >
              {running ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-5 w-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Running...
                </span>
              ) : (
                "Run Pinnacle"
              )}
            </button>
          </div>
        </div>

        {/* ─── Terminal output ─── */}
        {(logs.length > 0 || running || error) && (
          <div className="mb-8 overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
            <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span className="ml-2 font-mono text-xs text-gray-500">
                pinnacle run
              </span>
            </div>
            <div
              ref={terminalRef}
              className="max-h-[400px] overflow-y-auto p-4"
            >
              {logs.map((line, i) => {
                const isError = line.startsWith("[ERROR]");
                const isWarn = line.startsWith("[WARN]");
                const textColor = isError
                  ? "text-red-400"
                  : isWarn
                    ? "text-yellow-400"
                    : "text-green-400";
                return (
                  <div key={i} className={`font-mono text-sm ${textColor}`}>
                    {line}
                  </div>
                );
              })}
              {running && (
                <span className="font-mono text-sm text-green-400">
                  ▊
                </span>
              )}
              {error && !running && (
                <div className="mt-2 font-mono text-sm text-red-400">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Result summary card ─── */}
        {result && !running && (
          <div className="rounded-2xl border border-violet-800 bg-gray-900/60 p-6">
            <h3 className="mb-4 font-mono text-sm font-medium tracking-widest text-violet-400 uppercase">
              Run Complete
            </h3>

            <div className="mb-4 flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-gray-500">Task</p>
                <p className="text-sm font-medium text-white">{task}</p>
              </div>
              {statusBadge && (
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span
                    className={`inline-block rounded-full border px-3 py-0.5 text-xs font-medium ${statusBadge.color}`}
                  >
                    {statusBadge.label}
                  </span>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Steps Completed</p>
                <p className="text-sm font-medium text-white">
                  {result.stepsCompleted}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Steps Failed</p>
                <p className="text-sm font-medium text-white">
                  {result.stepsFailed}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Time Elapsed</p>
                <p className="text-sm font-medium text-white">{elapsed}s</p>
              </div>
            </div>

            {result.summary && (
              <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
                <p className="text-xs text-gray-500">Summary</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-300">
                  {result.summary}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
