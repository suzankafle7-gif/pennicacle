// ============================================================
// Pinnacle Engine — Codebase Scanner
// ============================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CodebaseSummary, KeyFile } from './types';

/**
 * Scan a working directory and produce a CodebaseSummary.
 * Respects .gitignore when present.
 */
export async function scanCodebase(workingDir: string): Promise<CodebaseSummary> {
  const absDir = path.resolve(workingDir);

  if (!fs.existsSync(absDir)) {
    throw new Error(`Directory not found: ${absDir}`);
  }

  const gitignorePatterns = loadGitignore(absDir);
  const fileTree = walkDirectory(absDir, absDir, gitignorePatterns);

  const keyFiles = identifyKeyFiles(absDir, fileTree);
  const dependencies = extractDependencies(absDir);
  const framework = detectFramework(absDir, dependencies);
  const language = detectLanguage(fileTree);

  return {
    framework,
    language,
    dependencies,
    fileTree: fileTree.map((f) => path.relative(absDir, f)),
    keyFiles,
    workingDir: absDir,
  };
}

// ---- internals ----

function loadGitignore(root: string): string[] {
  const gitignorePath = path.join(root, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return [];
  try {
    return fs
      .readFileSync(gitignorePath, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}

function walkDirectory(
  root: string,
  current: string,
  ignorePatterns: string[]
): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(current, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    const relativePath = path.relative(root, fullPath);

    // Skip common directories and ignored paths
    if (shouldSkip(relativePath, entry.isDirectory(), ignorePatterns)) continue;

    if (entry.isDirectory()) {
      results.push(...walkDirectory(root, fullPath, ignorePatterns));
    } else {
      results.push(fullPath);
    }
  }

  return results.sort();
}

function shouldSkip(
  relativePath: string,
  isDir: boolean,
  patterns: string[]
): boolean {
  const parts = relativePath.split(path.sep);
  const skipDirs = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.turbo',
    'coverage',
    '__pycache__',
    '.venv',
    'venv',
    '.cache',
  ];

  if (isDir && skipDirs.includes(parts[parts.length - 1])) return true;

  // Simple gitignore matching
  for (const pattern of patterns) {
    if (pattern.endsWith('/') && isDir && relativePath.startsWith(pattern.slice(0, -1)))
      return true;
    if (relativePath === pattern || relativePath.endsWith('/' + pattern)) return true;
  }

  return false;
}

function identifyKeyFiles(root: string, files: string[]): KeyFile[] {
  const keyFiles: KeyFile[] = [];
  const relFiles = files.map((f) => path.relative(root, f));
  const rules: { pattern: RegExp; reason: string }[] = [
    { pattern: /(^|\/)package\.json$/, reason: 'Dependency manifest' },
    { pattern: /(^|\/)tsconfig\.json$/, reason: 'TypeScript configuration' },
    { pattern: /(^|\/)vite\.config\./, reason: 'Vite build configuration' },
    { pattern: /(^|\/)next\.config\./, reason: 'Next.js configuration' },
    { pattern: /(^|\/)src\/index\.tsx?$/, reason: 'Main entry point' },
    { pattern: /(^|\/)src\/main\.tsx?$/, reason: 'Main entry point' },
    { pattern: /(^|\/)src\/app\.tsx?$/, reason: 'Application root' },
    { pattern: /(^|\/)src\/cli\.tsx?$/, reason: 'CLI entry point' },
    { pattern: /(^|\/)index\.tsx?$/, reason: 'Package entry point' },
    { pattern: /(^|\/)tailwind\.config\./, reason: 'Tailwind CSS configuration' },
    { pattern: /(^|\/)\.eslintrc/, reason: 'ESLint configuration' },
    { pattern: /(^|\/)\.prettierrc/, reason: 'Prettier configuration' },
  ];

  for (const relFile of relFiles) {
    for (const rule of rules) {
      if (rule.pattern.test(relFile)) {
        keyFiles.push({ path: relFile, reason: rule.reason });
        break;
      }
    }
  }

  // If no clear entry point found, try to guess from the first .ts/.tsx in src/
  if (!keyFiles.some((k) => k.reason.includes('entry point'))) {
    const tsFiles = relFiles.filter(
      (f) =>
        (f.endsWith('.ts') || f.endsWith('.tsx')) &&
        (f.startsWith('src/') || f === 'index.ts' || f === 'main.ts')
    );
    if (tsFiles.length > 0) {
      keyFiles.push({ path: tsFiles[0], reason: 'Likely entry point' });
    }
  }

  // Grab a few more interesting files beyond the key rules
  const interestingExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml', '.toml'];
  const additionalFiles = relFiles
    .filter((f) => {
      const ext = path.extname(f);
      return interestingExts.includes(ext);
    })
    .slice(0, 10);

  for (const f of additionalFiles) {
    if (!keyFiles.some((k) => k.path === f)) {
      keyFiles.push({ path: f, reason: 'Project source file' });
    }
  }

  return keyFiles.slice(0, 20); // Keep it manageable
}

function extractDependencies(root: string): Record<string, string> {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return {};
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  } catch {
    return {};
  }
}

function detectFramework(
  root: string,
  deps: Record<string, string>
): string {
  const depNames = Object.keys(deps);
  if (depNames.includes('next')) return 'Next.js';
  if (depNames.includes('@tanstack/react-start') || depNames.includes('@tanstack/start'))
    return 'TanStack Start';
  if (depNames.includes('vite')) return 'Vite';
  if (depNames.includes('react')) return 'React';
  if (depNames.includes('express')) return 'Express';
  if (depNames.includes('fastify')) return 'Fastify';
  if (depNames.includes('hono')) return 'Hono';
  if (depNames.includes('elysia')) return 'Elysia';
  // Check for file-based indicators
  if (fs.existsSync(path.join(root, 'next.config.js')) || fs.existsSync(path.join(root, 'next.config.ts')))
    return 'Next.js';
  if (fs.existsSync(path.join(root, 'vite.config.ts')) || fs.existsSync(path.join(root, 'vite.config.js')))
    return 'Vite';
  return 'Unknown';
}

function detectLanguage(files: string[]): string {
  const exts = files.map((f) => path.extname(f).toLowerCase());
  if (exts.some((e) => ['.ts', '.tsx'].includes(e))) return 'TypeScript';
  if (exts.some((e) => ['.js', '.jsx'].includes(e))) return 'JavaScript';
  if (exts.some((e) => e === '.py')) return 'Python';
  if (exts.some((e) => e === '.go')) return 'Go';
  if (exts.some((e) => e === '.rs')) return 'Rust';
  return 'Unknown';
}
