import { createFileRoute } from "@tanstack/react-router";
import { runAgent } from "../../../../pinnacle-engine/src/loop-node";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";

export const Route = createFileRoute("/api/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { task?: string };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON body" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const task = body.task?.trim();
        if (!task) {
          return new Response(
            JSON.stringify({ error: "Missing 'task' field" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const runId = randomUUID();
        const workingDir = `/tmp/pinnacle-run-${runId}`;

        // Create a minimal starter project
        mkdirSync(workingDir, { recursive: true });
        writeFileSync(
          `${workingDir}/package.json`,
          JSON.stringify(
            { name: "pinnacle-playground", private: true, type: "module" },
            null,
            2,
          ),
        );
        writeFileSync(
          `${workingDir}/index.ts`,
          '// Pinnacle playground starter\nconsole.log("Ready.");\n',
        );

        // Capture engine console output for streaming
        const logQueue: string[] = [];
        let engineDone = false;
        let engineError: string | null = null;
        let engineResult: {
          success: boolean;
          stepsCompleted: number;
          stepsFailed: number;
          summary: string;
        } | null = null;

        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args: unknown[]) => {
          const line = args
            .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
            .join(" ");
          logQueue.push(line);
          originalLog(...args);
        };
        console.error = (...args: unknown[]) => {
          const line = args
            .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
            .join(" ");
          logQueue.push(`[ERROR] ${line}`);
          originalError(...args);
        };
        console.warn = (...args: unknown[]) => {
          const line = args
            .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
            .join(" ");
          logQueue.push(`[WARN] ${line}`);
          originalWarn(...args);
        };

        // Start the engine in the background
        runAgent({ description: task, workingDir })
          .then((result) => {
            engineResult = {
              success: result.success,
              stepsCompleted: result.stepsCompleted,
              stepsFailed: result.stepsFailed,
              summary: result.summary,
            };
            engineDone = true;
          })
          .catch((err) => {
            engineError = err instanceof Error ? err.message : String(err);
            engineDone = true;
          });

        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          async pull(controller) {
            // Flush any queued log lines
            while (logQueue.length > 0) {
              const text = logQueue.shift()!;
              // Strip ANSI escape codes for web display
              const clean = text.replace(/\x1b\[[0-9;]*m/g, "");
              if (clean.trim()) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "log", text: clean })}\n\n`,
                  ),
                );
              }
            }

            if (engineDone) {
              // Restore console
              console.log = originalLog;
              console.error = originalError;
              console.warn = originalWarn;

              // Clean up temp dir
              try {
                rmSync(workingDir, { recursive: true, force: true });
              } catch {
                // best effort
              }

              if (engineError) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "error", message: engineError })}\n\n`,
                  ),
                );
              } else if (engineResult) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "done", result: engineResult })}\n\n`,
                  ),
                );
              }
              controller.close();
              return;
            }

            // No data yet — wait before next pull
            await new Promise((resolve) => setTimeout(resolve, 100));
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
