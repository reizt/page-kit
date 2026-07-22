import { marked } from "marked";

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isSafeLink(href: string): boolean {
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

export function renderMarkdown(markdown: string): string {
  const renderer = new marked.Renderer();
  renderer.html = () => "";
  renderer.image = ({ text }) => escapeAttribute(text);
  renderer.link = function ({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    if (!isSafeLink(href)) return text;
    const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
    return `<a href="${escapeAttribute(href)}"${titleAttribute} target="_blank" rel="noopener noreferrer">${text}</a>`;
  };

  return marked.parse(markdown, {
    async: false,
    gfm: true,
    renderer,
  });
}
