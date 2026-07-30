import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        name: "description",
        content:
          "Pinnacle — the AI coding agent that plans, writes code across your entire project, runs commands, debugs, and iterates until it works. Autonomous task execution, not just autocomplete.",
      },
      { title: "Pinnacle — AI Coding Agent" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => <div>Page not found</div>,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <HeadContent />
      </head>
      <body className="bg-gray-950 text-gray-100 antialiased">
        <nav className="border-b border-gray-800 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <a
              href="/"
              className="font-mono text-sm font-medium tracking-widest text-violet-400 uppercase"
            >
              Pinnacle
            </a>
            <div className="flex gap-6">
              <a
                href="/"
                className="text-sm text-gray-400 hover:text-white transition"
              >
                Home
              </a>
              <a
                href="/playground"
                className="text-sm text-gray-400 hover:text-white transition"
              >
                Playground
              </a>
            </div>
          </div>
        </nav>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
