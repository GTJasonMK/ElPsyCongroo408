import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT = "docs-manifest.json";
const INCLUDED_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);
const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".github",
  "assets",
  "node_modules",
  "scripts",
]);
const EXCLUDED_FILES = new Set(["AGENTS.md", OUTPUT]);

const collator = new Intl.Collator("zh-Hans-CN", {
  numeric: true,
  sensitivity: "base",
});

const docs = [];
await walk(ROOT, "");

docs.sort((a, b) => collator.compare(a.path, b.path));

await writeFile(
  path.join(ROOT, OUTPUT),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      rootTitle: "ElPsyCongroo408 文档",
      docs,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Generated ${OUTPUT} with ${docs.length} documents.`);

async function walk(directory, relativeDirectory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => collator.compare(a.name, b.name));

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      if (!entry.isDirectory()) {
        continue;
      }
    }

    const absolutePath = path.join(directory, entry.name);
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      await walk(absolutePath, relativePath);
      continue;
    }

    if (!entry.isFile() || EXCLUDED_FILES.has(entry.name)) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!INCLUDED_EXTENSIONS.has(extension)) {
      continue;
    }

    const fileStat = await stat(absolutePath);
    const segments = relativePath.split("/");
    docs.push({
      path: relativePath,
      title: toTitle(entry.name, extension),
      extension,
      size: fileStat.size,
      modifiedAt: fileStat.mtime.toISOString(),
      segments,
    });
  }
}

function toTitle(filename, extension) {
  return filename.slice(0, -extension.length).trim() || filename;
}
