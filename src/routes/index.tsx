import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { readFile, writeFile } from "node:fs/promises";

// ─── Server: read business name ──
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

// ── Server: waitlist submission ───
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
      {*/ ─── Hero
