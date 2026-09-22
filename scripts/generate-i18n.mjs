import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const PUBLIC = path.join(ROOT, "public");
const SUPPORTED_TARGETS = ["en", "fr", "ja", "ko", "es"];
const TARGETS = process.argv.length > 2 ? process.argv.slice(2) : SUPPORTED_TARGETS;
if (TARGETS.some(target => !SUPPORTED_TARGETS.includes(target))) {
  throw new Error(`Supported targets: ${SUPPORTED_TARGETS.join(", ")}`);
}
const VIETNAMESE = /[À-ỹĐđ]/;
const OVERRIDES = {
  en: { "Cài đặt": "Settings", "Chờ thanh toán": "Pending payment", "Tổng quan hôm nay": "Today's overview" },
  fr: { "Cài đặt": "Paramètres", "Chờ thanh toán": "Paiement en attente", "Tổng quan hôm nay": "Aperçu du jour" },
  ja: { "Cài đặt": "設定", "Chờ thanh toán": "支払い待ち", "Tổng quan hôm nay": "本日の概要" },
  ko: { "Cài đặt": "설정", "Chờ thanh toán": "결제 대기", "Tổng quan hôm nay": "오늘의 개요" },
  es: { "Cài đặt": "Configuración", "Chờ thanh toán": "Pago pendiente", "Tổng quan hôm nay": "Resumen de hoy" },
};

async function filesUnder(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(full));
    else if (/\.(?:html|js)$/.test(entry.name) && entry.name !== "i18n.js") files.push(full);
  }
  return files;
}

function clean(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]*>/g, " ")
    .replace(/\$\{[^}]+\}/g, "{{value}}")
    .replace(/\s+/g, " ")
    .trim();
}

function extract(source) {
  const found = new Set();
  const add = raw => {
    const value = clean(raw);
    if (VIETNAMESE.test(value) && value.length > 1 && value.length <= 300) found.add(value);
  };

  // Visible text, including HTML fragments inside JavaScript template strings.
  for (const match of source.matchAll(/>([^<>]+)</g)) add(match[1]);
  // User-facing attributes.
  for (const match of source.matchAll(/(?:placeholder|title|aria-label|value)\s*=\s*["']([^"']+)["']/gi)) add(match[1]);
  // Messages and labels created from JavaScript.
  for (const match of source.matchAll(/(["'`])((?:\\.|(?!\1)[\s\S]){1,300})\1/g)) add(match[2]);
  return found;
}

async function translate(text, target) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.search = new URLSearchParams({ client: "gtx", sl: "vi", tl: target, dt: "t", q: text });
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return data[0].map(part => part[0]).join("");
    }
    await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`Could not translate to ${target}: ${text}`);
}

async function translateBatch(phrases, target) {
  const separator = "\nZXQZXSEPZXQZX\n";
  const translated = await translate(phrases.join(separator), target);
  const parts = translated.split(/\s*ZXQZXSEPZXQZX\s*/);
  if (parts.length !== phrases.length) throw new Error(`Translation batch mismatch for ${target}`);
  return parts;
}

const sources = await filesUnder(PUBLIC);
const phrases = new Set();
for (const file of sources) {
  for (const phrase of extract(await readFile(file, "utf8"))) phrases.add(phrase);
}

const localeDir = path.join(PUBLIC, "locales");
await mkdir(localeDir, { recursive: true });
await writeFile(path.join(localeDir, "vi.json"), JSON.stringify(Object.fromEntries([...phrases].sort().map(x => [x, x])), null, 2) + "\n");

for (const target of TARGETS) {
  const output = {};
  const queue = [...phrases].sort();
  let cursor = 0;
  const workers = Array.from({ length: 4 }, async () => {
    while (cursor < queue.length) {
      const batch = queue.slice(cursor, cursor += 20);
      const translated = await translateBatch(batch, target);
      batch.forEach((phrase, index) => { output[phrase] = translated[index]; });
    }
  });
  await Promise.all(workers);
  Object.assign(output, OVERRIDES[target]);
  const ordered = Object.fromEntries(Object.keys(output).sort().map(key => [key, output[key]]));
  await writeFile(path.join(localeDir, `${target}.json`), JSON.stringify(ordered, null, 2) + "\n");
  console.log(`${target}: ${Object.keys(ordered).length} phrases`);
}
