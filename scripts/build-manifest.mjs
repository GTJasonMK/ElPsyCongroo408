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
    const rawTitle = toTitle(entry.name, extension);
    docs.push({
      path: relativePath,
      title: toDisplayTitle(rawTitle, segments),
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

function toDisplayTitle(title, segments) {
  const parent = segments.length > 1 ? cleanName(segments.at(-2)) : "";
  let displayTitle = cleanName(title)
    .replace(/[.。．]?精细知识点$/u, "")
    .trim();

  displayTitle = stripPrefix(displayTitle, parent);
  displayTitle = stripPrefix(displayTitle, "30讲零基础");
  displayTitle = stripPrefix(displayTitle, "基础30讲");
  displayTitle = moveTrailingIndexToFront(displayTitle);

  return displayTitle || cleanName(title);
}

function cleanName(value) {
  return String(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function stripPrefix(value, prefix) {
  const normalizedPrefix = cleanName(prefix);
  if (!normalizedPrefix || !value.startsWith(normalizedPrefix)) {
    return value;
  }
  return value.slice(normalizedPrefix.length).trim();
}

function moveTrailingIndexToFront(value) {
  const match = /^(.+?)(\d{2})$/u.exec(value);
  if (!match) {
    return value;
  }

  const [, name, index] = match;
  return `${index} ${name.trim()}`;
}
