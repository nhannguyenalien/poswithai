(function () {
  "use strict";

  const STORAGE_KEY = "pos-language";
  const DEFAULT_LANGUAGE = "vi";
  const languages = {
    vi: { label: "Tiếng Việt", flag: "🇻🇳" },
    en: { label: "English", flag: "🇬🇧" },
    fr: { label: "Français", flag: "🇫🇷" },
    ja: { label: "日本語", flag: "🇯🇵" },
    ko: { label: "한국어", flag: "🇰🇷" },
    es: { label: "Español", flag: "🇪🇸" },
  };

  let language = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE;
  if (!languages[language]) language = DEFAULT_LANGUAGE;
  let messages = {};
  let messagePatterns = [];
  let originalTitle = document.title;
  const originals = new WeakMap();
  const translatedNodes = new WeakSet();
  const translatedAttributes = new WeakMap();

  function normalized(value) {
    return String(value).replace(/\s+/g, " ").trim();
  }

  function translate(value) {
    if (language === DEFAULT_LANGUAGE || value == null) return value;
    const source = normalized(value);
    if (!source) return value;
    const direct = messages[source];
    if (direct) return String(value).replace(source, direct);
    for (const pattern of messagePatterns) {
      const match = source.match(pattern.regex);
      if (!match) continue;
      let result = pattern.translation;
      match.slice(1).forEach(captured => { result = result.replace("{{value}}", captured); });
      return String(value).replace(source, result);
    }
    return value;
  }

  function translateTextNode(node) {
    if (!node.nodeValue || !normalized(node.nodeValue)) return;
    if (!originals.has(node) || !translatedNodes.has(node)) originals.set(node, node.nodeValue);
    const source = originals.get(node);
    node.nodeValue = language === DEFAULT_LANGUAGE ? source : translate(source);
    translatedNodes.add(node);
  }

  const attributes = ["placeholder", "title", "aria-label", "value"];
  function translateElement(element) {
    if (element.matches("script, style, code, pre, [data-no-i18n]")) return;
    let saved = translatedAttributes.get(element);
    if (!saved) {
      saved = {};
      translatedAttributes.set(element, saved);
    }
    for (const name of attributes) {
      if (!element.hasAttribute(name)) continue;
      const current = element.getAttribute(name);
      if (!(name in saved) || current !== translate(saved[name])) saved[name] = current;
      element.setAttribute(name, language === DEFAULT_LANGUAGE ? saved[name] : translate(saved[name]));
    }
  }

  function translateTree(root = document.body) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) return translateTextNode(root);
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    translateElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        return parent?.closest("script, style, code, pre, [data-no-i18n]")
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      node.nodeType === Node.TEXT_NODE ? translateTextNode(node) : translateElement(node);
    }
  }

  async function load(nextLanguage) {
    language = languages[nextLanguage] ? nextLanguage : DEFAULT_LANGUAGE;
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
    messages = language === DEFAULT_LANGUAGE
      ? {}
      : await fetch(`/locales/${language}.json`).then(response => {
          if (!response.ok) throw new Error(`Unable to load language: ${language}`);
          return response.json();
        });
    messagePatterns = Object.entries(messages)
      .filter(([key]) => key.includes("{{value}}"))
      .map(([key, translation]) => ({
        regex: new RegExp(`^${key.split("{{value}}").map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.+?)")}$`),
        translation,
      }));
    document.title = language === DEFAULT_LANGUAGE ? originalTitle : translate(originalTitle);
    translateTree();
    renderSelector();
    document.dispatchEvent(new CustomEvent("languagechange", { detail: { language } }));
  }

  function renderSelector() {
    let wrap = document.getElementById("pos-language-switcher");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "pos-language-switcher";
      wrap.setAttribute("data-no-i18n", "");
      wrap.innerHTML = `<label for="pos-language-select">🌐</label><select id="pos-language-select" aria-label="Language"></select>`;
      document.body.appendChild(wrap);
    }
    const sidebarSlot = document.getElementById("sidebar-language-slot");
    const navbarSlot = document.getElementById("navbar-language-slot");
    const target = sidebarSlot || navbarSlot || document.body;
    if (wrap.parentElement !== target) target.appendChild(wrap);
    wrap.classList.toggle("is-sidebar", Boolean(sidebarSlot));
    wrap.classList.toggle("is-navbar", Boolean(navbarSlot && !sidebarSlot));
    const select = wrap.querySelector("select");
    if (!select.dataset.i18nBound) {
      select.addEventListener("change", event => load(event.target.value));
      select.dataset.i18nBound = "true";
    }
    select.innerHTML = Object.entries(languages)
      .map(([code, item]) => `<option value="${code}" ${code === language ? "selected" : ""}>${item.flag} ${item.label}</option>`)
      .join("");
  }

  const style = document.createElement("style");
  style.textContent = `
    #pos-language-switcher{position:fixed;right:16px;bottom:16px;z-index:1090;display:flex;align-items:center;gap:7px;padding:7px 10px;background:var(--tblr-bg-surface,#fff);border:1px solid var(--tblr-border-color,#dce1e7);border-radius:8px;box-shadow:0 3px 14px rgba(0,0,0,.15)}
    #pos-language-switcher select{border:0;background:transparent;color:inherit;font:inherit;outline:none;cursor:pointer;max-width:145px}
    #pos-language-switcher.is-sidebar{position:static;width:100%;padding:8px 10px;background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.16);box-shadow:none;color:inherit}
    #pos-language-switcher.is-sidebar select{width:100%;max-width:none;color:inherit}
    #pos-language-switcher.is-sidebar select option{color:#182433;background:#fff}
    #pos-language-switcher.is-navbar{position:static;padding:7px 9px;box-shadow:none;background:#fff}
    #pos-language-switcher.is-navbar select{max-width:125px}
    @media print{#pos-language-switcher{display:none!important}}
    @media(max-width:576px){#pos-language-switcher{right:8px;bottom:8px}#pos-language-switcher select{max-width:112px}}
  `;
  document.head.appendChild(style);

  const originalAlert = window.alert.bind(window);
  const originalConfirm = window.confirm.bind(window);
  const originalPrompt = window.prompt.bind(window);
  window.alert = message => originalAlert(translate(message));
  window.confirm = message => originalConfirm(translate(message));
  window.prompt = (message, value) => originalPrompt(translate(message), value);
  window.i18n = { t: translate, setLanguage: load, getLanguage: () => language, languages, mountSelector: renderSelector };

  document.addEventListener("DOMContentLoaded", async () => {
    renderSelector();
    try { await load(language); } catch (error) { console.error(error); }
    new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) translateTree(node);
        if (record.type === "characterData") {
          const source = originals.get(record.target);
          const expected = source == null ? null : (language === DEFAULT_LANGUAGE ? source : translate(source));
          if (source == null || record.target.nodeValue !== expected) {
            originals.set(record.target, record.target.nodeValue);
            translatedNodes.delete(record.target);
            translateTextNode(record.target);
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
