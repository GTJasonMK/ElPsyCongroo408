import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify/dist/purify.es.mjs";

const MANIFEST_URL = "./docs-manifest.json";
const EXTERNAL_LINK_RE = /^(https?:|mailto:|tel:)/i;
const LLM_CONFIG_KEY = "elpsy-docs.llm.config.v1";
const LLM_CHAT_KEY_PREFIX = "elpsy-docs.llm.chat.v1:";
const DEFAULT_LLM_CONFIG = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
  temperature: 0.2,
  maxTokens: 1600,
  maxDocChars: 24000,
  historyMessages: 12,
};
const LLM_PROMPTS = {
  summary: "请对当前文档做结构化学习分析：先概括核心主题，再列出关键知识点、推导线索、适用场景和复习优先级。输出中文 Markdown。",
  mistakes: "请分析当前文档中最容易混淆、漏条件或误用的点。按“易错点 -> 为什么错 -> 正确判断方式 -> 例题触发信号”的格式输出中文 Markdown。",
  quiz: "请基于当前文档生成自测题：包含基础题、辨析题和综合题，并在每题后给出简洁答案与解析。输出中文 Markdown。",
};
const LLM_SYSTEM_PROMPT = "你是一个严谨的中文学习文档分析助手。只根据提供的当前文档和对话上下文回答；如果文档里没有依据，直接说明无法从当前文档判断。输出清晰的 Markdown。";

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
  llmClearConfig: document.querySelector("#llm-clear-config"),
  llmClose: document.querySelector("#llm-close"),
  llmConfigForm: document.querySelector("#llm-config-form"),
  llmContextLabel: document.querySelector("#llm-context-label"),
  llmFab: document.querySelector("#llm-fab"),
  llmHistoryMessages: document.querySelector("#llm-history-messages"),
  llmMaxDocChars: document.querySelector("#llm-max-doc-chars"),
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
  llmChatMessages: [],
  llmAbortController: null,
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
});

init().catch((error) => {
  showError("文档清单加载失败", error);
});

async function init() {
  bindEvents();
  loadLlmConfig();
  setPromptTemplate("summary", { focus: false });

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
  const html = marked.parse(source);
  container.innerHTML = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
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
  elements.llmMaxDocChars.value = String(config.maxDocChars);
  elements.llmHistoryMessages.value = String(config.historyMessages);
}

function readStoredLlmConfig() {
  try {
    const rawConfig = localStorage.getItem(LLM_CONFIG_KEY);
    if (!rawConfig) {
      return { ...DEFAULT_LLM_CONFIG };
    }

    const parsed = JSON.parse(rawConfig);
    return normalizeLlmConfig({
      ...DEFAULT_LLM_CONFIG,
      ...parsed,
    });
  } catch {
    return { ...DEFAULT_LLM_CONFIG };
  }
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
    maxDocChars: elements.llmMaxDocChars.value,
    historyMessages: elements.llmHistoryMessages.value,
  });
}

function normalizeLlmConfig(config) {
  const normalized = {
    baseUrl: String(config.baseUrl || "").trim().replace(/\/+$/, ""),
    apiKey: String(config.apiKey || "").trim(),
    model: String(config.model || "").trim(),
    temperature: clampNumber(config.temperature, 0, 2, DEFAULT_LLM_CONFIG.temperature),
    maxTokens: clampNumber(config.maxTokens, 128, 12000, DEFAULT_LLM_CONFIG.maxTokens),
    maxDocChars: clampNumber(config.maxDocChars, 2000, 120000, DEFAULT_LLM_CONFIG.maxDocChars),
    historyMessages: clampNumber(config.historyMessages, 0, 40, DEFAULT_LLM_CONFIG.historyMessages),
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
  document.body.classList.add("llm-open");
  elements.llmPanel.setAttribute("aria-hidden", "false");
  elements.llmMessageInput.focus();
}

function closeLlmPanel() {
  document.body.classList.remove("llm-open");
  elements.llmPanel.setAttribute("aria-hidden", "true");
}

function openLlmSettings() {
  if (!elements.llmSettingsDialog.open) {
    elements.llmSettingsDialog.showModal();
  }
  elements.llmBaseUrl.focus();
}

function closeLlmSettings() {
  elements.llmSettingsDialog.close();
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

  const documentText = state.selectedDocSource.slice(0, config.maxDocChars);
  const isTruncated = state.selectedDocSource.length > documentText.length;
  const requestMessages = buildLlmMessages(config, userMessage, documentText, isTruncated);

  state.llmAbortController = new AbortController();
  setLlmBusy(true);
  setLlmStatus(isTruncated ? `正在请求，文档前缀 ${documentText.length} 字。` : "正在请求。");
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
        stream: false,
      }),
      signal: state.llmAbortController.signal,
    });

    const data = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(extractApiError(data) || `${response.status} ${response.statusText}`);
    }

    const content = extractCompletionContent(data);
    if (!content) {
      throw new Error("接口返回中没有可显示的内容。");
    }

    updateChatMessage(pendingMessage, content);
    saveCurrentChat();
    setLlmStatus(formatUsage(data.usage));
  } catch (error) {
    if (error.name === "AbortError") {
      setLlmStatus("已停止分析。");
      removeChatMessage(pendingMessage);
    } else {
      updateChatMessage(pendingMessage, `请求失败：${error.message}`);
      setLlmStatus(formatLlmError(error), "error");
    }
    saveCurrentChat();
  } finally {
    state.llmAbortController = null;
    setLlmBusy(false);
  }
}

function stopLlmAnalysis() {
  state.llmAbortController?.abort();
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

function buildLlmMessages(config, userMessage, documentText, isTruncated) {
  const history =
    config.historyMessages > 0 ? state.llmChatMessages.slice(-config.historyMessages) : [];
  return [
    {
      role: "system",
      content: LLM_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: buildDocumentContextMessage(documentText, isTruncated),
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

function buildDocumentContextMessage(documentText, isTruncated) {
  const truncatedNote = isTruncated ? "\n注意：以下文档内容因长度限制被截断，只分析可见部分。\n" : "";
  return [
    `当前文件：${state.selectedPath}`,
    truncatedNote,
    "文档内容：",
    "```markdown",
    documentText,
    "```",
  ].join("\n");
}

function loadChatForCurrentDoc() {
  state.llmChatMessages = readStoredChatMessages(state.selectedPath);
  renderChatMessages();
}

function readStoredChatMessages(path) {
  if (!path) {
    return [];
  }
  try {
    const rawMessages = localStorage.getItem(getChatStorageKey(path));
    const messages = rawMessages ? JSON.parse(rawMessages) : [];
    if (!Array.isArray(messages)) {
      return [];
    }
    return messages
      .filter(isValidChatMessage)
      .slice(-80)
      .map((message, index) => ({
        id: message.id || `${Date.now()}-${index}`,
        role: message.role,
        content: message.content,
      }));
  } catch {
    return [];
  }
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
  localStorage.setItem(getChatStorageKey(state.selectedPath), JSON.stringify(state.llmChatMessages.slice(-80)));
}

function getChatStorageKey(path) {
  return `${LLM_CHAT_KEY_PREFIX}${encodeURIComponent(path)}`;
}

function renderChatMessages() {
  elements.llmChatMessages.replaceChildren();
  if (!state.llmChatMessages.length) {
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    empty.textContent = "可以直接询问当前文档。";
    elements.llmChatMessages.append(empty);
    return;
  }

  state.llmChatMessages.forEach((message) => {
    elements.llmChatMessages.append(renderChatMessage(message));
  });
  scrollChatToBottom();
}

function appendChatMessage(role, content) {
  const message = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
  };
  state.llmChatMessages.push(message);
  if (elements.llmChatMessages.querySelector(".chat-empty")) {
    elements.llmChatMessages.replaceChildren();
  }
  elements.llmChatMessages.append(renderChatMessage(message));
  scrollChatToBottom();
  return message;
}

function updateChatMessage(message, content) {
  message.content = content;
  const bubble = elements.llmChatMessages.querySelector(`[data-message-id="${message.id}"]`);
  if (!bubble) {
    renderChatMessages();
    return;
  }
  const body = bubble.querySelector(".chat-message-body");
  renderMarkdownInto(body, content);
  scrollChatToBottom();
}

function removeChatMessage(message) {
  state.llmChatMessages = state.llmChatMessages.filter((item) => item.id !== message.id);
  renderChatMessages();
}

function renderChatMessage(message) {
  const item = document.createElement("article");
  item.className = `chat-message is-${message.role}`;
  item.dataset.messageId = message.id;

  const label = document.createElement("div");
  label.className = "chat-message-label";
  label.textContent = message.role === "user" ? "你" : "AI";

  const body = document.createElement("div");
  body.className = "chat-message-body markdown-body";
  renderMarkdownInto(body, message.content);

  item.append(label, body);
  return item;
}

function clearCurrentChat() {
  state.llmChatMessages = [];
  if (state.selectedPath) {
    localStorage.removeItem(getChatStorageKey(state.selectedPath));
  }
  renderChatMessages();
  setLlmStatus("当前文档对话已清空。");
}

function scrollChatToBottom() {
  elements.llmChatMessages.scrollTop = elements.llmChatMessages.scrollHeight;
}

function updateLlmContextLabel() {
  if (!state.selectedDoc) {
    elements.llmContextLabel.textContent = "等待文档加载";
    return;
  }
  const config = readStoredLlmConfig();
  const sourceLength = state.selectedDocSource.length;
  const contextLength = Math.min(sourceLength, config.maxDocChars);
  const suffix = sourceLength > contextLength ? `前 ${contextLength} 字` : `${contextLength} 字`;
  elements.llmContextLabel.textContent = `${state.selectedDoc.title} · 文档上下文 ${suffix}`;
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
  const total = usage.total_tokens ? `总 token ${usage.total_tokens}` : "";
  const cached = usage.prompt_tokens_details?.cached_tokens
    ? `缓存命中 ${usage.prompt_tokens_details.cached_tokens}`
    : "";
  return [total, cached].filter(Boolean).join("，") || "完成。";
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
