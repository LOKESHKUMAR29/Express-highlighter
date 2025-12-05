(function () {
  "use strict";

  let WORD_DATA_MAP = new Map(),
    TRIE_ROOT = null,
    observer = null,
    observerScheduled = null,
    attempts = 0,
    processedNodes = new WeakSet();

  const CONFIG = {
    MAX_ATTEMPTS: 10,
    HIGHLIGHT_CLASS: "highlight-word",
    DATA_PATH: "/skills-output.json",
    BATCH_SIZE: 100,
    DEBOUNCE_MS: 150,
    EXCLUDED_TAGS: new Set([
      "SCRIPT",
      "STYLE",
      "INPUT",
      "A",
      "BUTTON",
      "SELECT",
      "OPTION",
      "CODE",
      "EM",
    ]),
    OBSERVE_OPTIONS: { childList: true, subtree: true },
  };

  const qs = (sel) => document.querySelector(sel);
  const isWordChar = (ch) => /\p{L}|\p{N}/u.test(ch);

  class TrieNode {
    constructor() {
      this.children = new Map();
      this.isWord = false;
      this.word = null;
    }
  }

  const buildTrie = (words) => {
    const root = new TrieNode();
    words.forEach((word) => {
      let node = root;
      for (const char of word.toLowerCase()) {
        if (!node.children.has(char)) node.children.set(char, new TrieNode());
        node = node.children.get(char);
      }
      node.isWord = true;
      node.word = word.toLowerCase();
    });
    return root;
  };

  const findWordsInText = (text, trie) => {
    const matches = [];
    const lowerText = text.toLowerCase();
    const len = lowerText.length;

    for (let i = 0; i < len; i++) {
      if (i > 0 && isWordChar(lowerText[i - 1])) continue;
      let node = trie;
      let j = i;
      while (j < len && node.children.has(lowerText[j])) {
        node = node.children.get(lowerText[j++]);
        if (node.isWord && (j >= len || !isWordChar(lowerText[j]))) {
          matches.push({
            word: text.substring(i, j),
            start: i,
            end: j,
            key: node.word,
          });
        }
      }
    }
    return matches;
  };

  const injectStylesAndPopup = () => {
    if (!qs("#highlightStyles")) {
      document.head.insertAdjacentHTML(
        "beforeend",
        `<style id="highlightStyles">.${CONFIG.HIGHLIGHT_CLASS}{cursor:pointer;display:inline;background:#f54562;color:white;font-weight:600;padding:2px 3px;border-radius:3px;box-shadow:0px 2px 8px rgba(245,69,98,0.7);}</style>`
      );
    }

    if (!qs("#customPopupOverlay")) {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<div id="customPopupOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;backdrop-filter:blur(2px);"><div id="customPopup" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;width:350px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.25);font-family:Arial,sans-serif;text-align:left;"><div id="popupContent" style="margin-bottom:15px;font-size:15px;"></div><button id="popupCloseBtn" style="padding:6px 14px;border:none;background:#333;color:white;border-radius:4px;cursor:pointer;">Close</button></div></div>`
      );
      const overlay = qs("#customPopupOverlay");
      const closeBtn = qs("#popupCloseBtn");
      if (closeBtn) closeBtn.onclick = hidePopup;
      if (overlay) overlay.onclick = (e) => e.target === overlay && hidePopup();
    }
  };

  const hidePopup = () => {
    const overlay = qs("#customPopupOverlay");
    if (overlay) overlay.style.display = "none";
  };

  const showPopupHTML = (html) => {
    let overlay = qs("#customPopupOverlay");
    let content = qs("#popupContent");
    if (!overlay || !content) {
      injectStylesAndPopup();
      overlay = qs("#customPopupOverlay");
      content = qs("#popupContent");
    }
    if (!overlay || !content) {
      console.error("Failed to create popup elements");
      return;
    }
    content.innerHTML = html;
    overlay.style.display = "block";
  };

  const showWordPopup = (word) => {
    const data = WORD_DATA_MAP.get(word.toLowerCase());
    if (!data) {
      showPopupHTML("<strong>No data found.</strong>");
      return;
    }
    showPopupHTML(
      `<h3 style="margin:0 0 10px;">${data.name}</h3><p><strong>Type:</strong> ${data.skillType}</p><p><strong>Description:</strong><br>${data.description}</p>`
    );
  };

  window.showWordPopup = showWordPopup;

  const isInExcluded = (node) => {
    let el = node.parentElement;
    while (el) {
      if (
        el.id === "customPopup" ||
        el.id === "customPopupOverlay" ||
        el.classList?.contains(CONFIG.HIGHLIGHT_CLASS) ||
        CONFIG.EXCLUDED_TAGS.has(el.tagName) ||
        el.isContentEditable
      )
        return true;
      el = el.parentElement;
    }
    return false;
  };

  const processMatches = (matches, text) => {
    matches.sort((a, b) => b.start - a.start);
    const uniqueMatches = [];
    let lastEnd = text.length;
    for (const match of matches) {
      if (match.end <= lastEnd) {
        uniqueMatches.push(match);
        lastEnd = match.start;
      }
    }
    uniqueMatches.reverse();

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    uniqueMatches.forEach((match) => {
      if (match.start > lastIndex)
        fragment.appendChild(
          document.createTextNode(text.slice(lastIndex, match.start))
        );
      const span = document.createElement("span");
      span.className = CONFIG.HIGHLIGHT_CLASS;
      span.textContent = match.word;
      fragment.appendChild(span);
      lastIndex = match.end;
    });
    if (lastIndex < text.length)
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    return fragment;
  };

  const highlightWordsInContainer = async (container) => {
    if (!TRIE_ROOT) return 0;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        processedNodes.has(node) ||
        !node.nodeValue?.trim() ||
        isInExcluded(node)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });

    const nodesToProcess = [];
    let node;
    while ((node = walker.nextNode())) nodesToProcess.push(node);
    if (nodesToProcess.length === 0) return 0;

    const wasObserving = !!observer;
    if (wasObserving) observer.disconnect();

    let processedCount = 0;
    for (let i = 0; i < nodesToProcess.length; i += CONFIG.BATCH_SIZE) {
      nodesToProcess.slice(i, i + CONFIG.BATCH_SIZE).forEach((textNode) => {
        const text = textNode.nodeValue;
        const matches = findWordsInText(text, TRIE_ROOT);
        if (matches.length === 0) {
          processedNodes.add(textNode);
          return;
        }
        const fragment = processMatches(matches, text);
        if (textNode.parentNode) {
          textNode.parentNode.replaceChild(fragment, textNode);
          processedCount++;
        }
      });
      if (i + CONFIG.BATCH_SIZE < nodesToProcess.length)
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (wasObserving) observer.observe(container, CONFIG.OBSERVE_OPTIONS);
    return processedCount;
  };

  const enableObserver = (container) => {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (observerScheduled) return;
      observerScheduled = setTimeout(() => {
        observerScheduled = null;
        highlightWordsInContainer(container);
      }, CONFIG.DEBOUNCE_MS);
    });
    observer.observe(container, CONFIG.OBSERVE_OPTIONS);
  };

  const tryHighlight = async () => {
    const container = qs("main") || document.body;
    if (!container) return;
    const count = await highlightWordsInContainer(container);
    attempts++;
    if (count > 0 || attempts >= CONFIG.MAX_ATTEMPTS) enableObserver(container);
    else setTimeout(tryHighlight, 200);
  };

  injectStylesAndPopup();

  fetch(CONFIG.DATA_PATH)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((json) => {
      json.forEach((item) => {
        if (item.name) WORD_DATA_MAP.set(item.name.toLowerCase(), item);
      });
      TRIE_ROOT = buildTrie([...WORD_DATA_MAP.keys()]);
      console.log(`Loaded ${WORD_DATA_MAP.size} skills for highlighting.`);
      tryHighlight();
    })
    .catch((err) => console.error("Failed to load skills data:", err));

  document.addEventListener("click", (e) => {
    const el = e.target.closest?.(`.${CONFIG.HIGHLIGHT_CLASS}`);
    if (el) {
      const word = el.textContent?.trim();
      if (word) showWordPopup(word);
    }
  });

  const init = () => setTimeout(tryHighlight, 300);
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", () => setTimeout(tryHighlight, 500));
})();
