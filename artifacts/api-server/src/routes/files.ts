import { Router, type IRouter } from "express";
import { readdir, readFile, stat } from "fs/promises";
import { join, relative, resolve, sep } from "path";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? "/home/runner/workspace";

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".replit", "__pycache__",
  "dist", "build", ".cache", ".vite", "coverage",
  ".local", ".agents", "attached_assets",
]);

const IGNORE_FILES = new Set([
  ".env", ".env.local", ".env.production", ".env.development",
  ".DS_Store", "Thumbs.db", "package-lock.json",
]);

const MAX_FILE_SIZE = 100 * 1024; // 100 KB per file
const MAX_TOTAL_FILES = 200;

const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "json", "yaml", "yml", "toml",
  "md", "mdx", "txt", "rst",
  "html", "htm", "css", "scss", "sass", "less",
  "sh", "bash", "zsh",
  "py", "rb", "go", "rs", "java", "c", "cpp", "h",
  "sql", "graphql", "gql",
  "svg", "xml",
  "gitignore", "gitattributes", "prettierrc", "eslintrc",
  "env.example", "env.template",
]);

function isTextFile(filePath: string): boolean {
  const parts = filePath.split(".");
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : "";
  const base = filePath.split("/").pop() ?? "";
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (TEXT_EXTENSIONS.has(base)) return true;
  if (base.startsWith(".") && TEXT_EXTENSIONS.has(base.slice(1))) return true;
  return false;
}

async function walkDir(
  dir: string,
  root: string,
  results: { path: string; content: string }[],
) {
  if (results.length >= MAX_TOTAL_FILES) return;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= MAX_TOTAL_FILES) break;

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      await walkDir(fullPath, root, results);
    } else if (entry.isFile()) {
      if (IGNORE_FILES.has(entry.name)) continue;
      if (!isTextFile(entry.name)) continue;

      try {
        const info = await stat(fullPath);
        if (info.size > MAX_FILE_SIZE) continue;

        const content = await readFile(fullPath, "utf-8");
        const relPath = relative(root, fullPath);
        results.push({ path: relPath, content });
      } catch {
        // skip unreadable files
      }
    }
  }
}

router.get("/files", async (req, res) => {
  try {
    const files: { path: string; content: string }[] = [];

    const includeParam = req.query.include as string | undefined;
    const includePaths = includeParam
      ? includeParam.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

    if (includePaths.length > 0) {
      for (const rel of includePaths) {
        if (files.length >= MAX_TOTAL_FILES) break;
        const abs = resolve(WORKSPACE_ROOT, rel);
        if (abs !== WORKSPACE_ROOT && !abs.startsWith(WORKSPACE_ROOT + sep)) {
          logger.warn({ rel }, "Rejected include path outside workspace root");
          continue;
        }
        let info;
        try {
          info = await stat(abs);
        } catch {
          continue;
        }
        if (info.isDirectory()) {
          await walkDir(abs, WORKSPACE_ROOT, files);
        } else if (info.isFile()) {
          const name = abs.split("/").pop() ?? "";
          if (IGNORE_FILES.has(name) || !isTextFile(name)) continue;
          if (info.size > MAX_FILE_SIZE) continue;
          try {
            const content = await readFile(abs, "utf-8");
            const relPath = relative(WORKSPACE_ROOT, abs);
            files.push({ path: relPath, content });
          } catch {
            // skip unreadable files
          }
        }
      }
    } else {
      await walkDir(WORKSPACE_ROOT, WORKSPACE_ROOT, files);
    }

    logger.info({ count: files.length, includePaths }, "File listing complete");
    res.json({ files, total: files.length, root: WORKSPACE_ROOT });
  } catch (err) {
    logger.error({ err }, "File listing failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
