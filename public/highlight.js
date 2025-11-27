(function () {
  let WORD_DATA_MAP = new Map();
  let WORDS = [];
  let observer = null;
  let attempts = 0;

  const MAX_ATTEMPTS = 10;
  const HIGHLIGHT_CLASS = "highlight-word";
  const DATA_URL = "/data.json";

  const escapeRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const qs = (sel) => document.querySelector(sel);

  function injectPopupUI() {
    if (qs("#customPopupOverlay")) return;

    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div id="customPopupOverlay" style="
        display:none; position:fixed; inset:0;
        background:rgba(0,0,0,0.4); z-index:99999;
        backdrop-filter: blur(2px);
      ">
        <div id="customPopup" style="
          position:absolute; top:50%; left:50%;
          transform:translate(-50%, -50%);
          background:white; padding:20px; width:300px;
          border-radius:8px;
          box-shadow:0 4px 20px rgba(0,0,0,0.25);
          font-family:Arial, sans-serif; text-align:center;
        ">
          <div id="popupContent" style="margin-bottom:15px; font-size:15px;"></div>
          <button id="popupCloseBtn" style="
            padding:6px 14px; border:none;
            background:#333; color:white;
            border-radius:4px; cursor:pointer;
          ">Close</button>
        </div>
      </div>
      `
    );

    const overlay = qs("#customPopupOverlay");

    qs("#popupCloseBtn").onclick = hidePopup;
    overlay.onclick = (e) => e.target === overlay && hidePopup();
  }

  function showPopup(message) {
    const overlay = qs("#customPopupOverlay");
    const content = qs("#popupContent");

    if (!overlay || !content) {
      injectPopupUI();
      return showPopup(message);
    }

    content.textContent = message;
    overlay.style.display = "block";
  }

  function hidePopup() {
    const overlay = qs("#customPopupOverlay");
    if (overlay) overlay.style.display = "none";
  }

  // Expose popup handler
  window.openWordPopup = (word) => {
    const desc = WORD_DATA_MAP.get(word.toLowerCase());
    showPopup(desc || "No description found");
  };

  // Highlight Logic
  function highlight(container) {
    if (!WORDS.length) return 0;

    const escapedWords = WORDS.map(escapeRegex);
    const regex = new RegExp(`\\b(${escapedWords.join("|")})\\b`, "gi");
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

    const nodes = [];
    let node;

    while ((node = walker.nextNode())) {
      const txt = node.nodeValue;

      if (!regex.test(txt)) continue;
      if (
        node.parentElement.closest(
          `.${HIGHLIGHT_CLASS}, script, style, noscript`
        )
      )
        continue;

      nodes.push(node);
    }

    if (nodes.length === 0) return 0;

    nodes.forEach((textNode) => {
      const text = textNode.nodeValue;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      text.replace(regex, (match, _p, index) => {
        if (index > lastIndex) {
          fragment.appendChild(
            document.createTextNode(text.slice(lastIndex, index))
          );
        }

        const span = document.createElement("span");
        span.className = HIGHLIGHT_CLASS;
        span.style.cursor = "pointer";
        span.onclick = () => openWordPopup(match);

        const mark = document.createElement("mark");
        mark.textContent = match;
        mark.style.cssText = `
          background:#f54562;
          font-weight:600;
          position:relative;
          padding:2px;
          box-shadow:0px 2px 8px rgba(245,69,98,0.7);
        `;

        span.appendChild(mark);
        fragment.appendChild(span);
        lastIndex = index + match.length;
      });

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    });

    return nodes.length;
  }

  // Highlight Retry / Observer
  function tryHighlight() {
    const container = qs("main") || document.body;
    if (!container) return;

    const count = highlight(container);
    attempts++;

    if (count > 0 || attempts >= MAX_ATTEMPTS) {
      enableObserver(container);
    } else {
      setTimeout(tryHighlight, 200);
    }
  }

  function enableObserver(container) {
    if (observer) return;

    observer = new MutationObserver(() => highlight(container));

    observer.observe(container, {
      childList: true,
      subtree: true,
    });
  }

  // Init
  fetch(DATA_URL)
    .then((res) => res.json())
    .then((json) => {
      json.forEach((item) =>
        WORD_DATA_MAP.set(item.name.toLowerCase(), item.description)
      );
      WORDS = [...WORD_DATA_MAP.keys()];
      tryHighlight();
    })
    .catch((err) => console.error("Failed to load data.json", err));

  injectPopupUI();

  if (document.readyState !== "loading") {
    setTimeout(tryHighlight, 300);
  } else {
    document.addEventListener("DOMContentLoaded", () =>
      setTimeout(tryHighlight, 300)
    );
  }

  window.addEventListener("load", () => setTimeout(tryHighlight, 500));
})();
