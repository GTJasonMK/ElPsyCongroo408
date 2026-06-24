import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify/dist/purify.es.mjs";

const MANIFEST_URL = "./docs-manifest.json";
const EXTERNAL_LINK_RE = /^(https?:|mailto:|tel:)/i;

const elements = {
  breadcrumb: document.querySelector("#breadcrumb"),
  content: document.querySelector("#content"),
  copyLink: document.querySelector("#copy-link"),
  docCount: document.querySelector("#doc-count"),
  docTitle: document.querySelector("#doc-title"),
  menuButton: document.querySelector("#menu-button"),
  rawLink: document.querySelector("#raw-link"),
  scrim: document.querySelector("#scrim"),
  searchInput: document.querySelector("#search-input"),
  sidebar: document.querySelector("#sidebar"),
  tree: document.querySelector("#tree"),
};

const collator = new Intl.Collator("zh-Hans-CN", {
  numeric: true,
  sensitivity: "base",
});

const state = {
  docs: [],
  docsByPath: new Map(),
  expandedDirs: new Set(),
  manifest: null,
  query: "",
  selectedPath: "",
  tree: null,
};

marked.use({
  gfm: true,
  breaks: false,
  pedantic: false,
});

init().catch((error) => {
  showError("文档清单加载失败", error);
});

async function init() {
  bindEvents();

  const response = await fetch(MANIFEST_URL, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  state.manifest = await response.json();
  state.docs = [...state.manifest.docs].sort((a, b) => collator.compare(a.path, b.path));
  state.docsByPath = new Map(state.docs.map((doc) => [doc.path, doc]));
  state.tree = buildTree(state.docs);

  elements.docCount.textContent = `${state.docs.length} 个文档`;
  expandInitialDirs();
  renderTree();

  const requestedPath = getPathFromHash();
  const firstPath = state.docs[0]?.path ?? "";
  await selectDoc(state.docsByPath.has(requestedPath) ? requestedPath : firstPath, {
    replace: !state.docsByPath.has(requestedPath),
  });
}

function bindEvents() {
  window.addEventListener("hashchange", () => {
    const path = getPathFromHash();
    if (path && path !== state.selectedPath && state.docsByPath.has(path)) {
      selectDoc(path, { fromHash: true });
    }
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderTree();
  });

  elements.menuButton.addEventListener("click", () => {
    document.body.classList.add("sidebar-open");
  });

  elements.scrim.addEventListener("click", closeSidebar);

  elements.copyLink.addEventListener("click", async () => {
    const url = `${window.location.origin}${window.location.pathname}#doc=${encodeURIComponent(state.selectedPath)}`;
    await navigator.clipboard.writeText(url);
    const previousText = elements.copyLink.textContent;
    elements.copyLink.textContent = "已复制";
    window.setTimeout(() => {
      elements.copyLink.textContent = previousText;
    }, 1200);
  });
}

function buildTree(docs) {
  const root = createDirNode("", "");

  for (const doc of docs) {
    let cursor = root;
    doc.segments.forEach((segment, index) => {
      const isFile = index === doc.segments.length - 1;
      const path = doc.segments.slice(0, index + 1).join("/");

      if (isFile) {
        cursor.children.push({
          type: "file",
          name: segment,
          path: doc.path,
          title: doc.title,
          extension: doc.extension,
        });
        return;
      }

      let next = cursor.children.find((child) => child.type === "dir" && child.name === segment);
      if (!next) {
        next = createDirNode(segment, path);
        cursor.children.push(next);
      }
      cursor = next;
    });
  }

  sortNode(root);
  return root;
}

function createDirNode(name, path) {
  return {
    type: "dir",
    name,
    path,
    children: [],
  };
}

function sortNode(node) {
  node.children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "dir" ? -1 : 1;
    }
    return collator.compare(a.name, b.name);
  });

  node.children
    .filter((child) => child.type === "dir")
    .forEach((child) => sortNode(child));
}

function expandInitialDirs() {
  const firstDoc = state.docs[0];
  if (!firstDoc) {
    return;
  }
  expandDirsForPath(firstDoc.path);
}

function expandDirsForPath(path) {
  const segments = path.split("/");
  for (let index = 1; index < segments.length; index += 1) {
    state.expandedDirs.add(segments.slice(0, index).join("/"));
  }
}

function renderTree() {
  elements.tree.replaceChildren();

  if (!state.docs.length) {
    elements.tree.append(emptyNode("未找到可显示的文档"));
    return;
  }

  if (state.query) {
    renderSearchResults();
    return;
  }

  const fragment = document.createDocumentFragment();
  state.tree.children.forEach((node) => {
    fragment.append(renderTreeNode(node));
  });
  elements.tree.append(fragment);
}

function renderSearchResults() {
  const results = state.docs.filter((doc) => doc.path.toLowerCase().includes(state.query));

  if (!results.length) {
    elements.tree.append(emptyNode("没有匹配结果"));
    return;
  }

  const fragment = document.createDocumentFragment();
  results.forEach((doc) => {
    fragment.append(renderFileButton(doc, doc.path));
  });
  elements.tree.append(fragment);
}

function renderTreeNode(node) {
  if (node.type === "file") {
    return renderFileButton(node, node.title);
  }

  const group = document.createElement("div");
  group.className = "tree-group";

  const isExpanded = state.expandedDirs.has(node.path);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tree-button tree-folder";
  button.setAttribute("aria-expanded", String(isExpanded));
  button.title = node.path;
  button.innerHTML = `<span class="tree-icon" aria-hidden="true">&gt;</span><span></span>`;
  button.lastElementChild.textContent = node.name;
  button.addEventListener("click", () => {
    if (isExpanded) {
      state.expandedDirs.delete(node.path);
    } else {
      state.expandedDirs.add(node.path);
    }
    renderTree();
  });
  group.append(button);

  if (isExpanded) {
    const children = document.createElement("div");
    children.className = "tree-children";
    node.children.forEach((child) => {
      children.append(renderTreeNode(child));
    });
    group.append(children);
  }

  return group;
}

function renderFileButton(doc, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tree-button tree-file";
  button.dataset.path = doc.path;
  button.title = doc.path;
  button.innerHTML = `<span class="tree-icon" aria-hidden="true">-</span><span></span>`;
  button.lastElementChild.textContent = label;
  button.classList.toggle("is-active", doc.path === state.selectedPath);
  button.addEventListener("click", () => {
    selectDoc(doc.path);
    closeSidebar();
  });
  return button;
}

function emptyNode(message) {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.textContent = message;
  return node;
}

async function selectDoc(path, options = {}) {
  const doc = state.docsByPath.get(path);
  if (!doc) {
    return;
  }

  state.selectedPath = path;
  expandDirsForPath(path);
  updateRoute(path, options);
  updateHeader(doc);
  renderTree();
  await renderDocument(doc);
}

function updateRoute(path, { fromHash = false, replace = false } = {}) {
  if (fromHash) {
    return;
  }

  const hash = `#doc=${encodeURIComponent(path)}`;
  if (replace) {
    history.replaceState(null, "", hash);
  } else if (window.location.hash !== hash) {
    history.pushState(null, "", hash);
  }
}

function updateHeader(doc) {
  elements.docTitle.textContent = doc.title;
  elements.breadcrumb.textContent = doc.segments.slice(0, -1).join(" / ");
  elements.rawLink.href = toFetchUrl(doc.path);
}

async function renderDocument(doc) {
  elements.content.innerHTML = "<p>正在加载文档...</p>";

  try {
    const response = await fetch(toFetchUrl(doc.path), { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const source = await response.text();
    document.title = `${doc.title} - ElPsyCongroo408 文档`;

    if (doc.extension === ".txt") {
      renderPlainText(source);
    } else {
      renderMarkdown(source, doc);
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  } catch (error) {
    showError("文档读取失败", error);
  }
}

function renderMarkdown(source, doc) {
  const html = marked.parse(source);
  elements.content.innerHTML = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
  addHeadingIds(elements.content);
  enhanceLinks(elements.content, doc);
}

function renderPlainText(source) {
  elements.content.replaceChildren();
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = source;
  pre.append(code);
  elements.content.append(pre);
}

function addHeadingIds(container) {
  const usedIds = new Set();
  container.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading) => {
    const baseId = slugify(heading.textContent || "section");
    let id = baseId;
    let index = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${index}`;
      index += 1;
    }
    usedIds.add(id);
    heading.id = id;
  });
}

function enhanceLinks(container, doc) {
  container.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href) {
      return;
    }

    if (href.startsWith("#")) {
      anchor.addEventListener("click", (event) => {
        const target = container.querySelector(href);
        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      return;
    }

    if (EXTERNAL_LINK_RE.test(href)) {
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      return;
    }

    const linkedPath = resolveRelativeDocPath(href, doc.path);
    if (linkedPath && state.docsByPath.has(linkedPath)) {
      anchor.href = `#doc=${encodeURIComponent(linkedPath)}`;
      anchor.addEventListener("click", (event) => {
        event.preventDefault();
        selectDoc(linkedPath);
      });
      return;
    }

    anchor.href = toFetchUrl(resolveRelativeAssetPath(href, doc.path));
  });
}

function resolveRelativeDocPath(href, currentPath) {
  const [pathPart] = href.split("#");
  if (!pathPart || !/\.(md|markdown|txt)$/i.test(pathPart)) {
    return "";
  }
  return resolveRelativeAssetPath(pathPart, currentPath);
}

function resolveRelativeAssetPath(href, currentPath) {
  try {
    const baseDir = currentPath.includes("/") ? currentPath.slice(0, currentPath.lastIndexOf("/") + 1) : "";
    const resolved = new URL(href, `https://local.invalid/${encodeURI(baseDir)}`);
    return safeDecode(resolved.pathname.replace(/^\/+/, ""));
  } catch {
    return href;
  }
}

function getPathFromHash() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  return params.get("doc") || "";
}

function toFetchUrl(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function slugify(text) {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

function showError(title, error) {
  elements.content.innerHTML = "";
  const notice = document.createElement("div");
  notice.className = "notice";
  notice.textContent = `${title}: ${error.message}`;
  elements.content.append(notice);
}
