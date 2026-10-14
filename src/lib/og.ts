import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadDefaultJapaneseParser } from "budoux";
import { Renderer } from "takumi-js/node";
import { fromHtml } from "takumi-js/helpers/html";

const parser = loadDefaultJapaneseParser();

let renderer: Promise<Renderer> | undefined;

function getRenderer() {
  renderer ??= (async () => {
    const r = new Renderer();
    const data = await readFile(join(process.cwd(), "src/assets/fonts/NotoSansJP.ttf"));
    await r.registerFont({ name: "Noto Sans JP", data });
    return r;
  })();
  return renderer;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** BudouXで分かち書きし、文節単位で折り返すHTMLにする */
const phrases = (text: string) =>
  parser
    .parse(text)
    .map((p) => `<span style="display:inline-block">${escapeHtml(p)}</span>`)
    .join("");

export async function renderOgImage(title: string): Promise<Buffer> {
  const html = `
<div style="display:flex;flex-direction:column;justify-content:space-between;width:1200px;height:630px;padding:72px;background:#fafafa;font-family:'Noto Sans JP';color:#18181b">
  <div style="display:flex;flex:1;align-items:center">
    <div style="display:block;font-size:68px;font-weight:700;line-height:1.4">${phrases(title)}</div>
  </div>
  <div style="display:flex;font-size:32px;font-weight:500;color:#52525b">何度目かのプロローグ</div>
</div>`;
  return (await getRenderer()).render(fromHtml(html).node, { width: 1200, height: 630, format: "png" });
}
