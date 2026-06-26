import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify/dist/purify.es.mjs";
import katex from "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.mjs";

const MANIFEST_URL = "./docs-manifest.json";
const EXTERNAL_LINK_RE = /^(https?:|mailto:|tel:)/i;
const LLM_CONFIG_KEY = "elpsy-docs.llm.config.v1";
const LLM_CHAT_KEY_PREFIX = "elpsy-docs.llm.chat.v1:";
const LLM_CHAT_STORAGE_VERSION = 2;
const CHAT_BOTTOM_THRESHOLD = 72;
const DEFAULT_LLM_CONFIG = {
  baseUrl: "https://api.deepseek.com",
  apiKey: "",
  model: "deepseek-v4-flash",
  temperature: 0.2,
  maxTokens: 1600,
};
const LEGACY_DEFAULT_BASE_URLS = new Set([
  "",
  "https://api.openai.com/v1",
  "https://api.deepseek.com/v1",
]);
const LEGACY_DEFAULT_MODELS = new Set(["", "gpt-4o-mini", "deepseek-chat"]);
const LLM_PROMPTS = {
  summary: "请对当前文档做结构化学习分析：先概括核心主题，再列出关键知识点、推导线索、适用场景和复习优先级。输出中文 Markdown。",
  mistakes: "请分析当前文档中最容易混淆、漏条件或误用的点。按“易错点 -> 为什么错 -> 正确判断方式 -> 例题触发信号”的格式输出中文 Markdown。",
  quiz: "请基于当前文档生成自测题：包含基础题、辨析题和综合题，并在每题后给出简洁答案与解析。输出中文 Markdown。",
};
const LLM_SYSTEM_PROMPT = [
  "你是一个严谨的中文学习文档分析助手，任务是帮助用户理解当前打开的文档。",
  "",
  "回答原则：",
  "1. 当前文档内容是最高优先级依据；历史对话只用于理解用户意图，不得覆盖或改写文档事实。",
  "2. 先直接回答用户问题，再给必要依据、推导线索或复习建议；不要先写泛泛而谈的开场白。",
  "3. 如果文档没有提供足够依据，明确说“当前文档无法判断”，不要编造来源、例题、定理或章节关系。",
  "4. 可以用通用知识解释文档中的概念，但必须和文档内容区分开；不要把扩展解释说成文档原文。",
  "5. 用户要求总结、易错点、出题或复习规划时，输出结构化中文 Markdown，条目要具体、可执行。",
  "6. 涉及公式、条件、适用范围或解题步骤时，优先保留文档中的限定条件，并指出容易漏掉的前提。",
  "7. 如果问题跨文档或需要未提供材料，说明当前只加载了当前文档，并基于当前文档给出有限结论。",
  "",
  "输出要求：",
  "- 直接输出中文 Markdown，不要把整段回答包在 ```markdown 代码块里。",
  "- 公式使用 LaTeX Markdown 写法：行内公式用 `$...$`，独立公式必须把开始和结束的 `$$` 单独放在一行。",
  "- 标题、分隔线、列表和公式块前后都要保留空行；不要把 `---`、`###` 或 `$$` 和正文写在同一行。",
  "- 内容要紧凑，避免重复整篇文档。",
  "- 不确定处明确标注，不做假确定。",
].join("\n");

const elements = {
  breadcrumb: document.querySelector("#breadcrumb"),
  content: document.querySelector("#content"),
  copyLink: document.querySelector("#copy-link"),
  docCount: document.querySelector("#doc-count"),
  docTitle: document.querySelector("#doc-title"),
  llmApiKey: document.querySelector("#llm-api-key"),
  llmBaseUrl: document.querySelector("#llm-base-url"),
  llmChatMessages: document.querySelector("#llm-chat-messages"),
  llmClearChat: document.querySelector("#llm-clear-chat"),
  llmClearCurrentChat: document.querySelector("#llm-clear-current-chat"),
  llmClearConfig: document.querySelector("#llm-clear-config"),
  llmClose: document.querySelector("#llm-close"),
  llmConfigForm: document.querySelector("#llm-config-form"),
  llmContextLabel: document.querySelector("#llm-context-label"),
  llmFab: document.querySelector("#llm-fab"),
  llmMaxTokens: document.querySelector("#llm-max-tokens"),
  llmMessageInput: document.querySelector("#llm-message-input"),
  llmModel: document.querySelector("#llm-model"),
  llmOpen: document.querySelector("#llm-open"),
  llmPanel: document.querySelector("#llm-panel"),
  llmPrompts: document.querySelector("#llm-prompts"),
  llmScrim: document.querySelector("#llm-scrim"),
  llmSend: document.querySelector("#llm-send"),
  llmSettingsClose: document.querySelector("#llm-settings-close"),
  llmSettingsDialog: document.querySelector("#llm-settings-dialog"),
  llmSettingsOpen: document.querySelector("#llm-settings-open"),
  llmSettingsToolbar: document.querySelector("#llm-settings-toolbar"),
  llmSettingsStatus: document.querySelector("#llm-settings-status"),
  llmStatus: document.querySelector("#llm-status"),
  llmStop: document.querySelector("#llm-stop"),
  llmTemperature: document.querySelector("#llm-temperature"),
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
  llmActiveTopicId: createId("topic"),
  llmChatMessages: [],
  llmTopics: [],
  llmAbortController: null,
  llmPendingRender: null,
  llmScrollFrame: 0,
  llmRenderFrame: 0,
  llmShouldAutoScroll: true,
  manifest: null,
  query: "",
  selectedDoc: null,
  selectedDocSource: "",
  selectedPath: "",
  tree: null,
};

marked.use({
  gfm: true,
  breaks: false,
  pedantic: false,
  extensions: [
    {
      name: "mathBlock",
      level: "block",
      start(src) {
        return src.indexOf("$$");
      },
      tokenizer(src) {
        const match = /^\$\$[ \t]*\n?([\s\S]+?)\n?[ \t]*\$\$(?:\n+|$)/.exec(src);
        if (!match) {
          return;
        }

        return {
          type: "mathBlock",
          raw: match[0],
          text: match[1].trim(),
        };
      },
      renderer(token) {
        return `<div class="math-display">${renderMath(token.text, true)}</div>`;
      },
    },
    {
      name: "mathInline",
      level: "inline",
      start(src) {
        return src.indexOf("$");
      },
      tokenizer(src) {
        const token = tokenizeInlineMath(src);
        if (token) {
          return token;
        }
      },
      renderer(token) {
        return `<span class="math-inline">${renderMath(token.text, false)}</span>`;
      },
    },
  ],
});

function tokenizeInlineMath(src) {
  if (!src.startsWith("$") || src.startsWith("$$")) {
    return null;
  }

  const closingIndex = findClosingInlineMathDelimiter(src);
  if (closingIndex < 2) {
    return null;
  }

  const text = src.slice(1, closingIndex);
  if (!text.trim() || /^\s|\s$/.test(text)) {
    return null;
  }

  return {
    type: "mathInline",
    raw: src.slice(0, closingIndex + 1),
    text,
  };
}

function findClosingInlineMathDelimiter(src) {
  for (let index = 1; index < src.length; index += 1) {
    const char = src[index];
    if (char === "\n") {
      return -1;
    }
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "$") {
      return index;
    }
  }
  return -1;
}

function renderMath(source, displayMode) {
  try {
    return katex.renderToString(source, {
      displayMode,
      output: "html",
      throwOnError: false,
    });
  } catch {
    return `<code>${escapeHtml(source)}</code>`;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

init().catch((error) => {
  showError("文档清单加载失败", error);
});

async function init() {
  bindEvents();
  loadLlmConfig();

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

  elements.llmOpen.addEventListener("click", openLlmPanel);
  elements.llmFab.addEventListener("click", openLlmPanel);
  elements.llmClose.addEventListener("click", closeLlmPanel);
  elements.llmScrim.addEventListener("click", closeLlmPanel);
  elements.llmSettingsOpen.addEventListener("click", openLlmSettings);
  elements.llmSettingsToolbar.addEventListener("click", openLlmSettings);
  elements.llmSettingsClose.addEventListener("click", closeLlmSettings);
  elements.llmConfigForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      saveLlmConfig();
      closeLlmSettings();
    } catch {
      // saveLlmConfig already reports the validation error in the panel.
    }
  });
  elements.llmClearConfig.addEventListener("click", clearLlmConfig);
  elements.llmClearCurrentChat.addEventListener("click", () => clearCurrentChat({ fromSettings: true }));
  elements.llmChatMessages.addEventListener("click", handleChatMessagesClick);
  elements.llmChatMessages.addEventListener("scroll", updateChatAutoScrollState, { passive: true });
  elements.llmSend.addEventListener("click", sendLlmMessage);
  elements.llmStop.addEventListener("click", stopLlmAnalysis);
  elements.llmClearChat.addEventListener("click", clearCurrentChat);
  elements.llmMessageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendLlmMessage();
    }
  });
  elements.llmPrompts.addEventListener("click", (event) => {
    const button = event.target.closest("[data-prompt]");
    if (!button) {
      return;
    }
    setPromptTemplate(button.dataset.prompt);
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("llm-open")) {
      closeLlmPanel();
    }
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
  const results = state.docs.filter(
    (doc) => doc.path.toLowerCase().includes(state.query) || doc.title.toLowerCase().includes(state.query),
  );

  if (!results.length) {
    elements.tree.append(emptyNode("没有匹配结果"));
    return;
  }

  const fragment = document.createDocumentFragment();
  results.forEach((doc) => {
    fragment.append(renderFileButton(doc, doc.title));
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
  state.selectedDoc = doc;
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
    state.selectedDocSource = source;
    document.title = `${doc.title} - ElPsyCongroo408 文档`;
    loadChatForCurrentDoc();
    updateLlmContextLabel();

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
  renderMarkdownInto(elements.content, source);
  addHeadingIds(elements.content);
  enhanceLinks(elements.content, doc);
}

function renderMarkdownInto(container, source) {
  const html = marked.parse(normalizeMarkdownForRendering(source));
  container.innerHTML = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
}

function normalizeMarkdownForRendering(source) {
  return splitMarkdownCodeFenceSegments(String(source))
    .map((segment) => (segment.isCode ? segment.text : normalizeMarkdownProse(segment.text)))
    .join("");
}

function splitMarkdownCodeFenceSegments(source) {
  const segments = [];
  let buffer = "";
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    const lineWithEnding = index < lines.length - 1 ? `${line}\n` : line;
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line);

    if (!inFence && fence) {
      pushMarkdownSegment(segments, buffer, false);
      buffer = lineWithEnding;
      inFence = true;
      fenceChar = fence[1][0];
      fenceLength = fence[1].length;
      return;
    }

    if (inFence) {
      buffer += lineWithEnding;
      if (fence && fence[1][0] === fenceChar && fence[1].length >= fenceLength) {
        pushMarkdownSegment(segments, buffer, true);
        buffer = "";
        inFence = false;
        fenceChar = "";
        fenceLength = 0;
      }
      return;
    }

    buffer += lineWithEnding;
  });

  pushMarkdownSegment(segments, buffer, inFence);
  return segments;
}

function pushMarkdownSegment(segments, text, isCode) {
  if (text) {
    segments.push({ text, isCode });
  }
}

function normalizeMarkdownProse(source) {
  return normalizeDisplayMathBlocks(normalizeLooseMarkdownBlocks(source));
}

function normalizeLooseMarkdownBlocks(source) {
  return source
    .replace(/([^\n])\s+---\s+(#{1,6}[ \t]+)/g, "$1\n\n---\n\n$2")
    .replace(/(^|\n)[ \t]*---[ \t]+(#{1,6}[ \t]+)/g, "$1---\n\n$2");
}

function normalizeDisplayMathBlocks(source) {
  const delimiterCount = source.match(/\$\$/g)?.length || 0;
  if (delimiterCount < 2 || delimiterCount % 2 !== 0) {
    return source;
  }

  let normalized = "";
  let inMathBlock = false;
  for (let index = 0; index < source.length; index += 1) {
    if (source.startsWith("$$", index)) {
      if (inMathBlock) {
        if (normalized && !normalized.endsWith("\n")) {
          normalized = normalized.replace(/[ \t]+$/, "");
          normalized += "\n";
        }
        normalized += "$$";
        if (source[index + 2] && source[index + 2] !== "\n") {
          normalized += "\n\n";
        }
      } else {
        if (normalized && !normalized.endsWith("\n")) {
          normalized = normalized.replace(/[ \t]+$/, "");
          normalized += "\n\n";
        }
        normalized += "$$";
        if (source[index + 2] && source[index + 2] !== "\n") {
          normalized += "\n";
        }
      }
      inMathBlock = !inMathBlock;
      index += 1;
      continue;
    }

    normalized += source[index];
  }

  return normalized;
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

function loadLlmConfig() {
  const config = readStoredLlmConfig();
  elements.llmBaseUrl.value = config.baseUrl;
  elements.llmApiKey.value = config.apiKey;
  elements.llmModel.value = config.model;
  elements.llmTemperature.value = String(config.temperature);
  elements.llmMaxTokens.value = String(config.maxTokens);
}

function readStoredLlmConfig() {
  try {
    const rawConfig = localStorage.getItem(LLM_CONFIG_KEY);
    if (!rawConfig) {
      return { ...DEFAULT_LLM_CONFIG };
    }

    const parsed = JSON.parse(rawConfig);
    const migrated = migrateLegacyDefaultConfig(parsed);
    return normalizeLlmConfig({
      ...DEFAULT_LLM_CONFIG,
      ...migrated,
    });
  } catch {
    return { ...DEFAULT_LLM_CONFIG };
  }
}

function migrateLegacyDefaultConfig(config) {
  if (config.apiKey) {
    return config;
  }

  const baseUrl = String(config.baseUrl || "").trim().replace(/\/+$/, "");
  const model = String(config.model || "").trim();
  if (LEGACY_DEFAULT_BASE_URLS.has(baseUrl) && LEGACY_DEFAULT_MODELS.has(model)) {
    return {
      ...config,
      baseUrl: DEFAULT_LLM_CONFIG.baseUrl,
      model: DEFAULT_LLM_CONFIG.model,
    };
  }

  return config;
}

function saveLlmConfig() {
  try {
    const config = getLlmConfigFromForm();
    localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));
    setSettingsStatus("配置已保存。");
    updateLlmContextLabel();
    return config;
  } catch (error) {
    setSettingsStatus(error.message, "error");
    throw error;
  }
}

function clearLlmConfig() {
  localStorage.removeItem(LLM_CONFIG_KEY);
  loadLlmConfig();
  setSettingsStatus("配置已清除。");
  updateLlmContextLabel();
}

function getLlmConfigFromForm() {
  return normalizeLlmConfig({
    baseUrl: elements.llmBaseUrl.value,
    apiKey: elements.llmApiKey.value,
    model: elements.llmModel.value,
    temperature: elements.llmTemperature.value,
    maxTokens: elements.llmMaxTokens.value,
  });
}

function normalizeLlmConfig(config) {
  const normalized = {
    baseUrl: String(config.baseUrl || "").trim().replace(/\/+$/, ""),
    apiKey: String(config.apiKey || "").trim(),
    model: String(config.model || "").trim(),
    temperature: clampNumber(config.temperature, 0, 2, DEFAULT_LLM_CONFIG.temperature),
    maxTokens: clampNumber(config.maxTokens, 128, 12000, DEFAULT_LLM_CONFIG.maxTokens),
  };

  if (!normalized.baseUrl) {
    throw new Error("请填写 API 地址。");
  }
  if (!normalized.model) {
    throw new Error("请填写模型。");
  }

  return normalized;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function openLlmPanel() {
  closeSidebar();
  elements.llmPanel.hidden = false;
  elements.llmScrim.hidden = false;
  document.body.classList.add("llm-open");
  elements.llmPanel.setAttribute("aria-hidden", "false");
  scrollChatToBottomAfterLayout();
  elements.llmMessageInput.focus();
}

function closeLlmPanel() {
  document.body.classList.remove("llm-open");
  elements.llmPanel.setAttribute("aria-hidden", "true");
  elements.llmPanel.hidden = true;
  elements.llmScrim.hidden = true;
}

function openLlmSettings() {
  elements.llmSettingsDialog.hidden = false;
  if (typeof elements.llmSettingsDialog.showModal === "function" && !elements.llmSettingsDialog.open) {
    elements.llmSettingsDialog.showModal();
  } else {
    elements.llmSettingsDialog.setAttribute("open", "");
  }
  elements.llmBaseUrl.focus();
}

function closeLlmSettings() {
  if (typeof elements.llmSettingsDialog.close === "function" && elements.llmSettingsDialog.open) {
    elements.llmSettingsDialog.close();
  }
  elements.llmSettingsDialog.removeAttribute("open");
  elements.llmSettingsDialog.hidden = true;
}

function setPromptTemplate(name, options = {}) {
  const prompt = LLM_PROMPTS[name] || LLM_PROMPTS.summary;
  elements.llmMessageInput.value = prompt;
  elements.llmPrompts.querySelectorAll("[data-prompt]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.prompt === name);
  });
  if (options.focus !== false) {
    elements.llmMessageInput.focus();
  }
}

async function sendLlmMessage() {
  if (!state.selectedDoc || !state.selectedDocSource) {
    setLlmStatus("当前文档还没有加载完成。", "error");
    return;
  }

  let config;
  try {
    config = getLlmConfigFromForm();
  } catch (error) {
    setLlmStatus(error.message, "error");
    openLlmSettings();
    return;
  }

  localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));
  const userMessage = elements.llmMessageInput.value.trim();
  if (!userMessage) {
    setLlmStatus("请输入消息。", "error");
    return;
  }

  const requestMessages = buildLlmMessages(userMessage, state.selectedDocSource);

  state.llmAbortController = new AbortController();
  setLlmBusy(true);
  setLlmStatus("正在请求。");
  appendChatMessage("user", userMessage);
  elements.llmMessageInput.value = "";
  const pendingMessage = appendChatMessage("assistant", "正在生成...");
  saveCurrentChat();

  try {
    const response = await fetch(buildChatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers: buildLlmHeaders(config),
      body: JSON.stringify({
        model: config.model,
        messages: requestMessages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: true,
        stream_options: {
          include_usage: true,
        },
      }),
      signal: state.llmAbortController.signal,
    });

    if (!response.ok) {
      const data = await readJsonResponse(response);
      throw new Error(extractApiError(data) || `${response.status} ${response.statusText}`);
    }

    const result = await streamChatCompletion(response, pendingMessage);
    saveCurrentChat();
    setLlmStatus(formatUsage(result.usage));
  } catch (error) {
    cancelScheduledChatRender();
    if (error.name === "AbortError") {
      if (hasGeneratedContent(pendingMessage)) {
        updateChatMessage(pendingMessage, pendingMessage.content);
        setLlmStatus("已停止，当前输出已保留。");
      } else {
        setLlmStatus("已停止分析。");
        removeChatMessage(pendingMessage);
      }
    } else {
      updateChatMessage(pendingMessage, `请求失败：${error.message}`);
      setLlmStatus(formatLlmError(error), "error");
    }
    saveCurrentChat();
  } finally {
    state.llmAbortController = null;
    syncChatMessageActions(pendingMessage);
    setLlmBusy(false);
  }
}

function stopLlmAnalysis() {
  state.llmAbortController?.abort();
}

async function streamChatCompletion(response, pendingMessage) {
  if (!response.body) {
    throw new Error("当前浏览器不支持流式响应。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let usage = null;

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      const result = handleStreamBlock(block, pendingMessage, content, usage);
      content = result.content;
      usage = result.usage;
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    const result = handleStreamBlock(buffer, pendingMessage, content, usage);
    content = result.content;
    usage = result.usage;
  }

  if (!content.trim()) {
    throw new Error("接口返回中没有可显示的内容。");
  }

  cancelScheduledChatRender();
  updateChatMessage(pendingMessage, content);
  return { content, usage };
}

function handleStreamBlock(block, pendingMessage, currentContent, currentUsage) {
  let content = currentContent;
  let usage = currentUsage;

  for (const payload of extractStreamPayloads(block)) {
    if (payload === "[DONE]") {
      continue;
    }

    const chunk = parseStreamPayload(payload);
    const apiError = extractApiError(chunk);
    if (apiError) {
      throw new Error(apiError);
    }

    usage = chunk.usage || usage;
    const delta = extractStreamDelta(chunk);
    if (!delta) {
      continue;
    }

    content += delta;
    scheduleChatMessageRender(pendingMessage, content);
  }

  return { content, usage };
}

function extractStreamPayloads(block) {
  const lines = block.split(/\r?\n/);
  const dataLines = lines
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length) {
    return dataLines.filter(Boolean);
  }

  const trimmed = block.trim();
  return trimmed ? [trimmed] : [];
}

function parseStreamPayload(payload) {
  try {
    return JSON.parse(payload);
  } catch {
    throw new Error("流式响应包含无法解析的 JSON。");
  }
}

function extractStreamDelta(chunk) {
  const choice = chunk?.choices?.[0];
  const delta = choice?.delta;
  const content = delta?.content ?? delta?.refusal ?? choice?.text ?? chunk?.output_text;
  return typeof content === "string" ? content : "";
}

function hasGeneratedContent(message) {
  return Boolean(message.content && message.content !== "正在生成...");
}

function buildChatCompletionsUrl(baseUrl) {
  if (/\/chat\/completions$/i.test(baseUrl)) {
    return baseUrl;
  }
  return `${baseUrl}/chat/completions`;
}

function buildLlmHeaders(config) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  return headers;
}

function buildLlmMessages(userMessage, documentText) {
  const history = getActiveTopicMessages();
  return [
    {
      role: "system",
      content: LLM_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: buildDocumentContextMessage(documentText),
    },
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    {
      role: "user",
      content: userMessage,
    },
  ];
}

function buildDocumentContextMessage(documentText) {
  return [
    `当前文件：${state.selectedPath}`,
    "文档内容：",
    "```markdown",
    documentText,
    "```",
  ].join("\n");
}

function getActiveTopicMessages() {
  return state.llmChatMessages.filter((message) => message.topicId === state.llmActiveTopicId);
}

function handleChatMessagesClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  if (button.dataset.action === "end-topic") {
    endTopicAfterMessage(button.dataset.messageId);
    return;
  }

  if (button.dataset.action === "export-topic") {
    exportTopic(button.dataset.topicId);
  }
}

function endTopicAfterMessage(messageId) {
  if (state.llmAbortController) {
    setLlmStatus("请等当前回复完成后再结束话题。", "error");
    return;
  }

  const selectedMessage = state.llmChatMessages.find((message) => message.id === messageId);
  if (!selectedMessage || selectedMessage.topicId !== state.llmActiveTopicId) {
    setLlmStatus("只能结束当前未完成话题。", "error");
    return;
  }

  const currentTopicMessages = getActiveTopicMessages();
  const endIndex = currentTopicMessages.findIndex((message) => message.id === messageId);
  if (endIndex < 0) {
    setLlmStatus("没有可结束的话题。", "error");
    return;
  }

  const closedMessages = currentTopicMessages.slice(0, endIndex + 1);
  const remainingMessages = currentTopicMessages.slice(endIndex + 1);
  const closedTopicId = state.llmActiveTopicId;
  const nextTopicId = createId("topic");
  const topic = {
    id: closedTopicId,
    title: createTopicTitle(closedMessages),
    closedAt: new Date().toISOString(),
    messageIds: closedMessages.map((message) => message.id),
  };

  remainingMessages.forEach((message) => {
    message.topicId = nextTopicId;
  });
  state.llmTopics.push(topic);
  state.llmActiveTopicId = nextTopicId;

  saveCurrentChat();
  renderChatMessages({ scroll: false });
  findTopicDivider(topic.id)?.scrollIntoView({ block: "nearest" });
  updateLlmContextLabel();
  setLlmStatus("话题已结束，后续请求只会带入新的当前话题。");
}

function findTopicDivider(topicId) {
  return Array.from(elements.llmChatMessages.querySelectorAll(".chat-topic-divider")).find(
    (divider) => divider.dataset.topicId === topicId,
  );
}

function createTopicTitle(messages) {
  const firstUserMessage = messages.find((message) => message.role === "user") || messages[0];
  const text = firstUserMessage?.content.replace(/\s+/g, " ").trim() || "已结束话题";
  return text.length > 28 ? `${text.slice(0, 28)}...` : text;
}

function exportTopic(topicId) {
  const topic = state.llmTopics.find((item) => item.id === topicId);
  if (!topic) {
    setLlmStatus("没有找到可导出的话题。", "error");
    return;
  }

  const messageById = new Map(state.llmChatMessages.map((message) => [message.id, message]));
  const messages = topic.messageIds.map((messageId) => messageById.get(messageId)).filter(Boolean);
  if (!messages.length) {
    setLlmStatus("这个话题没有可导出的消息。", "error");
    return;
  }

  const markdown = formatTopicExport(topic, messages);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(state.selectedDoc?.title || "文档")}-${safeFilename(topic.title)}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setLlmStatus("已导出话题。");
}

function formatTopicExport(topic, messages) {
  const lines = [
    `# ${topic.title}`,
    "",
    `- 当前文档：${state.selectedPath}`,
    `- 结束时间：${formatDateTime(topic.closedAt)}`,
    `- 消息数：${messages.length}`,
    "",
    "---",
    "",
  ];

  messages.forEach((message) => {
    lines.push(`## ${message.role === "user" ? "用户" : "AI"}`, "", message.content, "");
  });

  return `${lines.join("\n").trim()}\n`;
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

function safeFilename(value) {
  return String(value)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "话题";
}

function loadChatForCurrentDoc() {
  const chatState = readStoredChatState(state.selectedPath);
  state.llmChatMessages = chatState.messages;
  state.llmTopics = chatState.topics;
  state.llmActiveTopicId = chatState.activeTopicId;
  renderChatMessages();
}

function readStoredChatState(path) {
  if (!path) {
    return createEmptyChatState();
  }
  try {
    const rawState = localStorage.getItem(getChatStorageKey(path));
    const parsedState = rawState ? JSON.parse(rawState) : null;
    if (Array.isArray(parsedState)) {
      return migrateLegacyChatMessages(parsedState);
    }
    return normalizeChatState(parsedState);
  } catch {
    return createEmptyChatState();
  }
}

function createEmptyChatState() {
  return {
    messages: [],
    topics: [],
    activeTopicId: createId("topic"),
  };
}

function migrateLegacyChatMessages(messages) {
  const activeTopicId = createId("topic");
  return {
    messages: normalizeChatMessages(messages, activeTopicId),
    topics: [],
    activeTopicId,
  };
}

function normalizeChatState(chatState) {
  const activeTopicId =
    typeof chatState?.activeTopicId === "string" && chatState.activeTopicId
      ? chatState.activeTopicId
      : createId("topic");
  const messages = normalizeChatMessages(chatState?.messages, activeTopicId);
  const messageIds = new Set(messages.map((message) => message.id));
  const topics = Array.isArray(chatState?.topics)
    ? chatState.topics
        .map((topic) => normalizeTopic(topic, messageIds))
        .filter(Boolean)
    : [];
  return {
    messages,
    topics,
    activeTopicId,
  };
}

function normalizeChatMessages(messages, fallbackTopicId) {
  if (!Array.isArray(messages)) {
    return [];
  }
  return messages.filter(isValidChatMessage).map((message, index) => ({
    id: message.id || `${Date.now()}-${index}`,
    role: message.role,
    content: message.content,
    topicId:
      typeof message.topicId === "string" && message.topicId
        ? message.topicId
        : fallbackTopicId,
  }));
}

function normalizeTopic(topic, messageIds) {
  const topicMessageIds = Array.isArray(topic?.messageIds)
    ? topic.messageIds.filter((id) => typeof id === "string" && messageIds.has(id))
    : [];
  if (!topicMessageIds.length) {
    return null;
  }
  return {
    id: typeof topic.id === "string" && topic.id ? topic.id : createId("topic"),
    title: typeof topic.title === "string" && topic.title ? topic.title : "已结束话题",
    closedAt:
      typeof topic.closedAt === "string" && topic.closedAt
        ? topic.closedAt
        : new Date().toISOString(),
    messageIds: topicMessageIds,
  };
}

function isValidChatMessage(message) {
  return (
    message &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

function saveCurrentChat() {
  if (!state.selectedPath) {
    return;
  }
  localStorage.setItem(
    getChatStorageKey(state.selectedPath),
    JSON.stringify({
      version: LLM_CHAT_STORAGE_VERSION,
      activeTopicId: state.llmActiveTopicId,
      topics: state.llmTopics,
      messages: state.llmChatMessages,
    }),
  );
}

function getChatStorageKey(path) {
  return `${LLM_CHAT_KEY_PREFIX}${encodeURIComponent(path)}`;
}

function getTopicsByEndMessageId() {
  return new Map(
    state.llmTopics
      .map((topic) => [topic.messageIds.at(-1), topic])
      .filter(([messageId]) => Boolean(messageId)),
  );
}

function canEndTopicAtMessage(message) {
  return (
    !state.llmAbortController &&
    message.topicId === state.llmActiveTopicId &&
    message.content !== "正在生成..."
  );
}

function renderChatMessages(options = {}) {
  const { scroll = true } = options;
  elements.llmChatMessages.replaceChildren();
  if (!state.llmChatMessages.length) {
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    empty.textContent = "可以直接询问当前文档。";
    elements.llmChatMessages.append(empty);
    state.llmShouldAutoScroll = true;
    return;
  }

  const topicsByEndMessageId = getTopicsByEndMessageId();
  state.llmChatMessages.forEach((message) => {
    elements.llmChatMessages.append(renderChatMessage(message));
    const topic = topicsByEndMessageId.get(message.id);
    if (topic) {
      elements.llmChatMessages.append(renderTopicDivider(topic));
    }
  });
  if (scroll) {
    scrollChatToBottom();
  }
}

function appendChatMessage(role, content) {
  const message = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    topicId: state.llmActiveTopicId,
  };
  state.llmChatMessages.push(message);
  if (elements.llmChatMessages.querySelector(".chat-empty")) {
    elements.llmChatMessages.replaceChildren();
  }
  elements.llmChatMessages.append(renderChatMessage(message));
  scrollChatToBottom();
  updateLlmContextLabel();
  return message;
}

function scheduleChatMessageRender(message, content) {
  message.content = content;
  state.llmPendingRender = { message, content };
  if (state.llmRenderFrame) {
    return;
  }

  state.llmRenderFrame = requestAnimationFrame(flushScheduledChatRender);
}

function flushScheduledChatRender() {
  const pendingRender = state.llmPendingRender;
  state.llmRenderFrame = 0;
  state.llmPendingRender = null;
  if (pendingRender) {
    updateChatMessage(pendingRender.message, pendingRender.content);
  }
}

function cancelScheduledChatRender() {
  if (state.llmRenderFrame) {
    cancelAnimationFrame(state.llmRenderFrame);
  }
  state.llmRenderFrame = 0;
  state.llmPendingRender = null;
}

function updateChatMessage(message, content) {
  message.content = content;
  const bubble = elements.llmChatMessages.querySelector(`[data-message-id="${message.id}"]`);
  if (!bubble) {
    renderChatMessages();
    return;
  }
  const shouldScroll = shouldAutoScrollChat();
  const body = bubble.querySelector(".chat-message-body");
  renderMarkdownInto(body, content);
  syncChatMessageActions(message);
  if (shouldScroll) {
    scrollChatToBottom();
  }
}

function removeChatMessage(message) {
  state.llmChatMessages = state.llmChatMessages.filter((item) => item.id !== message.id);
  renderChatMessages();
  updateLlmContextLabel();
}

function renderChatMessage(message) {
  const item = document.createElement("article");
  item.className = `chat-message is-${message.role}`;
  item.dataset.messageId = message.id;
  item.dataset.topicId = message.topicId || "";

  const label = document.createElement("div");
  label.className = "chat-message-label";
  label.textContent = message.role === "user" ? "你" : "AI";

  const body = document.createElement("div");
  body.className = "chat-message-body markdown-body";
  renderMarkdownInto(body, message.content);

  item.append(label, body);
  const actions = createEndTopicActions(message);
  if (actions) {
    item.append(actions);
  }
  return item;
}

function syncChatMessageActions(message) {
  const item = elements.llmChatMessages.querySelector(`[data-message-id="${message.id}"]`);
  if (!item) {
    return;
  }

  const existingActions = item.querySelector(".chat-message-actions");
  if (!canEndTopicAtMessage(message)) {
    existingActions?.remove();
    return;
  }

  if (!existingActions) {
    item.append(createEndTopicActions(message));
  }
}

function createEndTopicActions(message) {
  if (!canEndTopicAtMessage(message)) {
    return null;
  }

  const actions = document.createElement("div");
  actions.className = "chat-message-actions";
  const endButton = document.createElement("button");
  endButton.className = "chat-inline-action";
  endButton.type = "button";
  endButton.dataset.action = "end-topic";
  endButton.dataset.messageId = message.id;
  endButton.textContent = "结束话题";
  actions.append(endButton);
  return actions;
}

function renderTopicDivider(topic) {
  const divider = document.createElement("div");
  divider.className = "chat-topic-divider";
  divider.dataset.topicId = topic.id;

  const label = document.createElement("span");
  label.textContent = `已结束话题：${topic.title}`;

  const exportButton = document.createElement("button");
  exportButton.className = "chat-inline-action";
  exportButton.type = "button";
  exportButton.dataset.action = "export-topic";
  exportButton.dataset.topicId = topic.id;
  exportButton.textContent = "导出";

  divider.append(label, exportButton);
  return divider;
}

function clearCurrentChat(options = {}) {
  if (!state.selectedPath) {
    const message = "当前没有可清除的文档对话。";
    setLlmStatus(message, "error");
    if (options.fromSettings) {
      setSettingsStatus(message, "error");
    }
    return;
  }

  state.llmChatMessages = [];
  state.llmTopics = [];
  state.llmActiveTopicId = createId("topic");
  localStorage.removeItem(getChatStorageKey(state.selectedPath));
  renderChatMessages();
  updateLlmContextLabel();

  const message = "当前文档对话已清空。";
  setLlmStatus(message);
  if (options.fromSettings) {
    setSettingsStatus(message);
  }
}

function scrollChatToBottom() {
  elements.llmChatMessages.scrollTop = elements.llmChatMessages.scrollHeight;
  state.llmShouldAutoScroll = true;
}

function scrollChatToBottomAfterLayout() {
  if (state.llmScrollFrame) {
    cancelAnimationFrame(state.llmScrollFrame);
  }

  state.llmScrollFrame = requestAnimationFrame(() => {
    scrollChatToBottom();
    state.llmScrollFrame = requestAnimationFrame(() => {
      scrollChatToBottom();
      state.llmScrollFrame = 0;
    });
  });
}

function updateChatAutoScrollState() {
  state.llmShouldAutoScroll = isChatNearBottom();
}

function shouldAutoScrollChat() {
  return state.llmShouldAutoScroll || isChatNearBottom();
}

function isChatNearBottom() {
  const distanceFromBottom =
    elements.llmChatMessages.scrollHeight -
    elements.llmChatMessages.scrollTop -
    elements.llmChatMessages.clientHeight;
  return distanceFromBottom <= CHAT_BOTTOM_THRESHOLD;
}

function updateLlmContextLabel() {
  if (!state.selectedDoc) {
    elements.llmContextLabel.textContent = "等待文档加载";
    return;
  }
  const sourceLength = state.selectedDocSource.length;
  const activeTopicCount = getActiveTopicMessages().length;
  elements.llmContextLabel.textContent = `${state.selectedDoc.title} · 文档上下文 ${sourceLength} 字 · 当前话题 ${activeTopicCount} 条`;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    if (!response.ok) {
      return { error: { message: text } };
    }
    throw new Error("接口返回的不是 JSON。");
  }
}

function extractApiError(data) {
  if (!data) {
    return "";
  }
  if (typeof data.error === "string") {
    return data.error;
  }
  return data.error?.message || data.message || "";
}

function extractCompletionContent(data) {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content ?? choice?.text ?? data?.output_text;
  if (Array.isArray(content)) {
    return content
      .map((part) => part.text || part.content || "")
      .filter(Boolean)
      .join("\n");
  }
  return typeof content === "string" ? content.trim() : "";
}

function formatLlmError(error) {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return "请求失败：请检查 API 地址、网络或接口 CORS 设置。";
  }
  return `请求失败：${error.message}`;
}

function formatUsage(usage) {
  if (!usage) {
    return "完成。";
  }
  const total = formatTokenUsagePart("总 token", usage.total_tokens);
  const cachedTokens = usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens;
  const cacheMissTokens = usage.prompt_cache_miss_tokens;
  const cached = formatTokenUsagePart("缓存命中", cachedTokens);
  const missed = formatTokenUsagePart("未命中", cacheMissTokens);
  return [total, cached, missed].filter(Boolean).join("，") || "完成。";
}

function formatTokenUsagePart(label, value) {
  return typeof value === "number" && Number.isFinite(value) ? `${label} ${value}` : "";
}

function setLlmBusy(isBusy) {
  elements.llmSend.disabled = isBusy;
  elements.llmStop.disabled = !isBusy;
}

function setLlmStatus(message, type = "") {
  elements.llmStatus.textContent = message;
  elements.llmStatus.dataset.type = type;
}

function setSettingsStatus(message, type = "") {
  elements.llmSettingsStatus.textContent = message;
  elements.llmSettingsStatus.dataset.type = type;
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
