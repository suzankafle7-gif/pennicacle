import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { readFile, writeFile } from "node:fs/promises";

// ─── Server: read business name ───
const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "";
  } catch {
    return "";
  }
});

// ─── Server: waitlist submission ───
const WAITLIST_PATH = "/home/team/shared/waitlist.json";

interface WaitlistEntry {
  email: string;
  timestamp: string;
}

const submitWaitlist = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const obj = data as { email?: string };
    const email = obj.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please provide a valid email address.");
    }
    return { email };
  })
  .handler(async ({ data }) => {
    const { email } = data;

    let entries: WaitlistEntry[] = [];
    try {
      const raw = await readFile(WAITLIST_PATH, "utf8");
      entries = JSON.parse(raw);
      if (!Array.isArray(entries)) entries = [];
    } catch {
      entries = [];
    }

    const existing = entries.find((e) => e.email === email);
    if (existing) {
      return {
        success: false,
        duplicate: true,
        message:
          "You're already on the list! We'll let you know when it's your turn.",
      };
    }

    entries.push({ email, timestamp: new Date().toISOString() });
    await writeFile(WAITLIST_PATH, JSON.stringify(entries, null, 2), "utf8");

    return {
      success: true,
      duplicate: false,
      message: "You're on the list! We'll let you know when it's your turn.",
    };
  });

// ─── Feature cards ───
const features = [
  {
    title: "Autonomous Task Execution",
    description:
      "Pinnacle doesn't just suggest code. It plans the approach, writes code across your entire project, runs the build, and iterates until it works — handling multi-file changes, dependency installs, and configuration so you don't have to.",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
        />
      </svg>
    ),
  },
  {
    title: "End-to-End Debugging",
    description:
      "When something breaks, Pinnacle reads the error output, traces the root cause across files, and fixes it — not just the symptom. It runs your tests, catches edge cases, and doesn't stop until the suite is green.",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
        />
      </svg>
    ),
  },
  {
    title: "Deep Codebase Intelligence",
    description:
      "Pinnacle builds a rich semantic model of your entire project, understanding architecture, dependencies, and conventions. Every change it makes respects your codebase's patterns — not just the file it's editing, but the entire system.",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
        />
      </svg>
    ),
  },
  {
    title: "Ships Production Code",
    description:
      "Pinnacle delivers complete, tested pull requests — not isolated snippets. It runs your test suite, handles edge cases, and produces code that's ready to merge. What would take you an afternoon, Pinnacle ships in minutes.",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
        />
      </svg>
    ),
  },
];

// ─── Route ───
export const Route = createFileRoute("/")({
  loader: () => getBusinessName(),
  component: Home,
});

function Home() {
  const businessName = Route.useLoaderData();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error" | "duplicate"
  >("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setMessage("");

    try {
      const result = await submitWaitlist({ data: { email: email.trim() } });

      if (result.duplicate) {
        setStatus("duplicate");
      } else {
        setStatus("success");
        setEmail("");
      }
      setMessage(result.message);
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  };

  return (
    <div className="min-h-dvh">
      {/* ─── Hero ─── */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center px-6 pb-24 pt-32 text-center">
        {/* Subtle gradient glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent" />

        <div className="relative z-10 max-w-4xl">
          <p className="mb-4 font-mono text-sm font-medium tracking-widest text-violet-400 uppercase">
            {businessName || "Pinnacle"}
          </p>
          <h1 className="mb-6 text-5xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl">
            <span className="bg-gradient-to-br from-violet-400 via-violet-300 to-fuchsia-400 bg-clip-text text-transparent">
              {businessName || "Pinnacle"}
            </span>
          </h1>
          <p className="mb-4 text-2xl font-semibold text-white sm:text-3xl lg:text-4xl">
            The AI that does the coding for you.
          </p>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-400">
            Pinnacle is an agentic AI that plans, writes code across your entire
            project, runs commands, debugs, and iterates — autonomously. It
            doesn't just suggest snippets; it ships complete, tested pull
            requests while you focus on the bigger picture.
          </p>
          <button
            onClick={() =>
              document
                .getElementById("waitlist")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="cursor-pointer rounded-xl bg-violet-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-violet-600/30 transition-all hover:bg-violet-500 hover:shadow-violet-500/40 active:scale-[0.98]"
          >
            Join the waitlist
          </button>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="px-6 pb-32">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-center font-mono text-sm font-medium tracking-widest text-violet-400 uppercase">
            Why Pinnacle
          </p>
          <h2 className="mb-16 text-center text-3xl font-bold text-white sm:text-4xl">
            Built different,{" "}
            <span className="text-gray-400">from the ground up</span>
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-gray-800 bg-gray-900/60 p-6 transition-all hover:border-violet-800 hover:bg-gray-900"
              >
                <div className="mb-4 inline-flex rounded-xl bg-violet-600/10 p-3 text-violet-400 ring-1 ring-violet-600/20">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Waitlist ─── */}
      <section id="waitlist" className="px-6 pb-32">
        <div className="mx-auto max-w-xl">
          <p className="mb-3 text-center font-mono text-sm font-medium tracking-widest text-violet-400 uppercase">
            Early Access
          </p>
          <h2 className="mb-4 text-center text-3xl font-bold text-white sm:text-4xl">
            Be the first to try Pinnacle
          </h2>
          <p className="mb-10 text-center text-gray-400">
            Pinnacle is in early access. Drop your email and you'll be among the
            first to try an AI that actually ships code — not just another
            autocomplete widget.
          </p>

          {status === "success" || status === "duplicate" ? (
            <div className="rounded-2xl border border-green-800 bg-green-900/30 p-6 text-center">
              <svg
                className="mx-auto mb-3 h-10 w-10 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-lg font-semibold text-green-300">{message}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "loading"}
                className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-gray-900 px-5 py-4 text-white placeholder-gray-500 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === "loading" || !email.trim()}
                className="cursor-pointer rounded-xl bg-violet-600 px-6 py-4 font-semibold text-white shadow-lg shadow-violet-600/30 transition-all hover:bg-violet-500 hover:shadow-violet-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {status === "loading" ? (
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
                ) : (
                  "Get early access"
                )}
              </button>
            </form>
          )}

          {status === "error" && (
            <p className="mt-3 text-center text-sm text-red-400">{message}</p>
          )}

          <p className="mt-4 text-center text-xs text-gray-600">
            No spam, ever. We'll only email you when Pinnacle is ready for you.
          </p>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gray-800 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-gray-600 sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {businessName || "Pinnacle"}.
          </p>
          <p>
            Built with{" "}
            <a
              href="https://cto.new"
              className="underline hover:text-gray-400"
            >
              cto.new
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
