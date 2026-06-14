import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const GITHUB_API = "https://api.github.com";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ghFetch(token: string, path: string, options: RequestInit = {}): Promise<any> {
  const url = path.startsWith("https://") ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return res.json();
}

function encodeBase64(content: string): string {
  return Buffer.from(content, "utf-8").toString("base64");
}

interface PackageMeta {
  name?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: { node?: string };
}

function extractPackageMeta(files: { path: string; content: string }[]): PackageMeta {
  const pkgFile = files.find((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
  if (!pkgFile) return {};
  try {
    return JSON.parse(pkgFile.content) as PackageMeta;
  } catch {
    return {};
  }
}

function detectTechStack(meta: PackageMeta): string[] {
  const allDeps = { ...meta.dependencies, ...meta.devDependencies };
  const stack: string[] = ["Node.js"];

  if ("typescript" in allDeps || "@types/node" in allDeps) stack.push("TypeScript");
  if ("react" in allDeps) stack.push("React");
  if ("next" in allDeps) stack.push("Next.js");
  if ("vue" in allDeps) stack.push("Vue");
  if ("svelte" in allDeps) stack.push("Svelte");
  if ("express" in allDeps) stack.push("Express");
  if ("fastify" in allDeps) stack.push("Fastify");
  if ("hono" in allDeps) stack.push("Hono");
  if ("vite" in allDeps || "@vitejs/plugin-react" in allDeps) stack.push("Vite");
  if ("tailwindcss" in allDeps) stack.push("Tailwind CSS");
  if ("drizzle-orm" in allDeps) stack.push("Drizzle ORM");
  if ("prisma" in allDeps || "@prisma/client" in allDeps) stack.push("Prisma");
  if ("@tanstack/react-query" in allDeps) stack.push("TanStack Query");

  return stack;
}

function generateReadme(repoName: string, meta: PackageMeta, repoDescription: string): string {
  const projectName = meta.name ?? repoName;
  const description = meta.description || repoDescription || "A project exported from Replit and hosted on GitHub.";
  const stack = detectTechStack(meta);
  const scripts = meta.scripts ?? {};

  const scriptLines = Object.entries(scripts)
    .filter(([key]) => ["dev", "start", "build", "test", "lint", "typecheck", "preview"].includes(key))
    .map(([key, cmd]) => `# ${key}\nnpm run ${key}  # ${cmd}`);

  const gettingStarted = scriptLines.length > 0
    ? scriptLines.join("\n\n")
    : "# Install dependencies\nnpm install\n\n# Run in development mode\nnpm run dev";

  const stackSection = stack.map((s) => `- ${s}`).join("\n");

  return `# ${projectName}

${description}

## Getting Started

\`\`\`bash
# Install dependencies
npm install

${gettingStarted}
\`\`\`

## Stack

${stackSection}

## CI

This project uses GitHub Actions for continuous integration. See \`.github/workflows/ci.yml\`.

## License

MIT
`;
}

function generateCiWorkflow(meta: PackageMeta): string {
  const scripts = meta.scripts ?? {};
  const nodeVersion = meta.engines?.node
    ? meta.engines.node.replace(/[^0-9.]/g, "").split(".")[0] || "20"
    : "20";

  const hasTest = "test" in scripts;
  const hasLint = "lint" in scripts;
  const hasBuild = "build" in scripts;
  const hasTypecheck = "typecheck" in scripts || "type-check" in scripts;

  const steps = [
    `      - uses: actions/checkout@v4`,
    `      - uses: actions/setup-node@v4\n        with:\n          node-version: '${nodeVersion}'\n          cache: 'npm'`,
    `      - name: Install dependencies\n        run: npm ci || npm install`,
  ];

  if (hasLint) steps.push(`      - name: Lint\n        run: npm run lint`);
  if (hasTypecheck) {
    const tcScript = "typecheck" in scripts ? "typecheck" : "type-check";
    steps.push(`      - name: Type check\n        run: npm run ${tcScript}`);
  } else if (!hasTypecheck && ("typescript" in (meta.dependencies ?? {}) || "typescript" in (meta.devDependencies ?? {}))) {
    steps.push(`      - name: Type check\n        run: npm run typecheck --if-present`);
  }
  if (hasBuild) steps.push(`      - name: Build\n        run: npm run build`);
  if (hasTest) steps.push(`      - name: Test\n        run: npm test`);

  return `name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
${steps.join("\n")}
`;
}

async function getOrCreateRepo(token: string, repoName: string, description: string, isPrivate: boolean) {
  try {
    const existing = await ghFetch(token, `/user`);
    const owner = existing.login as string;
    try {
      await ghFetch(token, `/repos/${owner}/${repoName}`);
      return { owner, repoUrl: `https://github.com/${owner}/${repoName}`, created: false };
    } catch {
      const created = await ghFetch(token, `/user/repos`, {
        method: "POST",
        body: JSON.stringify({
          name: repoName,
          description,
          private: isPrivate ?? false,
          auto_init: false,
        }),
      });
      return { owner, repoUrl: created.html_url as string, created: true };
    }
  } catch (err) {
    throw new Error(`Failed to get/create repo: ${(err as Error).message}`);
  }
}

async function upsertFile(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  content: string,
  message: string
): Promise<{ added: boolean }> {
  let sha: string | undefined;
  try {
    const existing = await ghFetch(token, `/repos/${owner}/${repo}/contents/${filePath}`);
    sha = existing.sha as string;
  } catch {
    sha = undefined;
  }

  await ghFetch(token, `/repos/${owner}/${repo}/contents/${filePath}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: encodeBase64(content),
      ...(sha ? { sha } : {}),
    }),
  });

  return { added: sha === undefined };
}

router.post("/github/push", async (req, res) => {
  try {
    const {
      token,
      repoName,
      description = "",
      private: isPrivate = false,
      files = [],
      generateReadme: genReadme = true,
      generateCi: genCi = true,
      commitMessage = "Initial commit from Replit",
    } = req.body;

    if (!token || !repoName) {
      res.status(400).json({ error: "token and repoName are required" });
      return;
    }

    const { owner, repoUrl, created: isNewRepo } = await getOrCreateRepo(token, repoName, description, isPrivate);

    const typedFiles = files as { path: string; content: string }[];
    const pkgMeta = extractPackageMeta(typedFiles);

    let filesAdded = 0;
    let filesChanged = 0;

    for (const file of typedFiles) {
      const { added } = await upsertFile(token, owner, repoName, file.path, file.content, commitMessage);
      if (added) filesAdded++; else filesChanged++;
    }

    if (genReadme) {
      const readmeContent = generateReadme(repoName, pkgMeta, description);
      const { added } = await upsertFile(token, owner, repoName, "README.md", readmeContent, "Add README");
      if (added) filesAdded++; else filesChanged++;
    }

    if (genCi) {
      const ciContent = generateCiWorkflow(pkgMeta);
      const { added } = await upsertFile(token, owner, repoName, ".github/workflows/ci.yml", ciContent, "Add GitHub Actions CI workflow");
      if (added) filesAdded++; else filesChanged++;
    }

    const committed = filesAdded + filesChanged;

    let commitSha: string | undefined;
    try {
      const commits = await ghFetch(token, `/repos/${owner}/${repoName}/commits?per_page=1`);
      const sha = (commits as { sha: string }[])[0]?.sha;
      if (sha) commitSha = sha.slice(0, 7);
    } catch {
      // non-fatal — commit SHA is optional
    }

    logger.info({ repoUrl, committed, commitSha, isNewRepo, filesAdded, filesChanged }, "GitHub push complete");
    res.json({
      success: true,
      repoUrl,
      filesCommitted: committed,
      commitSha,
      isNewRepo,
      filesAdded,
      filesChanged,
      message: `Pushed ${committed} files to ${repoUrl}`,
    });
  } catch (err) {
    logger.error({ err }, "GitHub push failed");
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/github/repos", async (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      res.status(401).json({ error: "token is required" });
      return;
    }
    const repos = await ghFetch(token, `/user/repos?sort=updated&per_page=50`);
    const mapped = (repos as Record<string, unknown>[]).map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      private: r.private,
      htmlUrl: r.html_url,
      description: r.description ?? null,
      updatedAt: r.updated_at,
    }));
    res.json(mapped);
  } catch (err) {
    logger.error({ err }, "List repos failed");
    res.status(401).json({ error: (err as Error).message });
  }
});

router.post("/github/deploy", async (req, res) => {
  try {
    const { token, owner, repo, target, vercelWebhookUrl } = req.body;

    if (!token || !owner || !repo || !target) {
      res.status(400).json({ error: "token, owner, repo, and target are required" });
      return;
    }

    if (target === "github-pages") {
      try {
        await ghFetch(token, `/repos/${owner}/${repo}/pages`, {
          method: "POST",
          body: JSON.stringify({ source: { branch: "main", path: "/" } }),
        });
      } catch {
        await ghFetch(token, `/repos/${owner}/${repo}/pages`, {
          method: "PUT",
          body: JSON.stringify({ source: { branch: "main", path: "/" } }),
        });
      }
      const pagesUrl = `https://${owner}.github.io/${repo}`;
      res.json({ success: true, message: "GitHub Pages deployment triggered", deployUrl: pagesUrl });
    } else if (target === "vercel") {
      if (!vercelWebhookUrl) {
        res.status(400).json({ error: "vercelWebhookUrl is required for Vercel deployments" });
        return;
      }
      // SSRF protection: only allow official Vercel deploy hook URLs
      const allowedVercelPattern = /^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\//;
      if (!allowedVercelPattern.test(vercelWebhookUrl as string)) {
        res.status(400).json({ error: "vercelWebhookUrl must be a valid Vercel deploy hook URL (https://api.vercel.com/v1/integrations/deploy/...)" });
        return;
      }
      const webhookRes = await fetch(vercelWebhookUrl as string, { method: "POST" });
      if (!webhookRes.ok) {
        throw new Error(`Vercel webhook returned ${webhookRes.status}`);
      }
      res.json({ success: true, message: "Vercel deployment triggered via webhook", deployUrl: null });
    } else {
      res.status(400).json({ error: `Unknown deploy target: ${target}` });
    }
  } catch (err) {
    logger.error({ err }, "Deploy failed");
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/github/deploy/status", async (req, res) => {
  try {
    const { token, owner, repo } = req.query as Record<string, string>;
    if (!token || !owner || !repo) {
      res.status(400).json({ error: "token, owner, and repo are required" });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pagesStatus: Record<string, any> = {};
    try {
      pagesStatus = await ghFetch(token, `/repos/${owner}/${repo}/pages`);
    } catch {
      res.json({ status: "unknown", deployUrl: null, updatedAt: null, message: "GitHub Pages not configured" });
      return;
    }

    const statusMap: Record<string, string> = {
      built: "success",
      building: "in_progress",
      errored: "failure",
      null: "pending",
    };

    const rawStatus = (pagesStatus.status as string | null) ?? "null";
    const status = statusMap[rawStatus] ?? "unknown";
    const deployUrl = (pagesStatus.html_url as string | null) ?? null;

    res.json({ status, deployUrl, updatedAt: null, message: `GitHub Pages status: ${rawStatus}` });
  } catch (err) {
    logger.error({ err }, "Deploy status failed");
    res.json({ status: "unknown", deployUrl: null, updatedAt: null, message: (err as Error).message });
  }
});

export default router;
