import { defineMdastPlugin } from "satteri";
import type { MdastPluginDefinition, MdastContent, MdastVisitorContext } from "satteri";
import type { Text, Parents } from "mdast";

export interface SatteriHardbreaksOptions {
  /**
   * Node types or predicate to skip processing.
   *
   * Note: In MDAST, `code` blocks and `inlineCode` are distinct node types and
   * are not treated as `text` nodes, so they are naturally preserved without
   * any extra configuration.
   */
  ignore?: Array<string> | ((parent: Readonly<Parents> | undefined, node: Readonly<Text>) => boolean);
}

/**
 * Satteri plugin to turn soft line breaks (newlines within phrasing content)
 * into hard breaks (`<br>`), mimicking GitHub-style Markdown behavior.
 *
 * @param options Optional configuration
 * @returns Satteri MDAST plugin definition
 *
 * @example
 * ```ts
 * import { satteri } from "@astrojs/markdown-satteri";
 * import { satteriHardbreaks } from "./src/plugins/satteri-hardbreaks";
 *
 * export default defineConfig({
 *   markdown: {
 *     processor: satteri({
 *       mdastPlugins: [satteriHardbreaks()],
 *     }),
 *   },
 * });
 * ```
 */
export function satteriHardbreaks(options: SatteriHardbreaksOptions = {}): MdastPluginDefinition {
  return defineMdastPlugin({
    name: "satteri-hardbreaks",
    text(node: Readonly<Text>, ctx: MdastVisitorContext) {
      if (!/[\r\n]/.test(node.value)) return;

      // Safeguard against accidental registration in hastPlugins
      if (
        ctx.constructor.name.toLowerCase().includes("hast") ||
        (ctx.parent(node) && "tagName" in (ctx.parent(node) as Record<string, unknown>))
      ) {
        console.warn(
          "[satteri-hardbreaks] Warning: satteri-hardbreaks is an MDAST plugin. Please register it under 'mdastPlugins' instead of 'hastPlugins'.",
        );
        return;
      }

      const parent = ctx.parent(node);

      if (options.ignore) {
        if (typeof options.ignore === "function") {
          if (options.ignore(parent, node)) return;
        } else if (Array.isArray(options.ignore)) {
          if (parent && options.ignore.includes(parent.type)) return;
        }
      }

      const lines = node.value.split(/\r?\n|\r/);
      const replacements: MdastContent[] = [];

      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          replacements.push({ type: "break" });
        }
        if (lines[i].length > 0) {
          replacements.push({ type: "text", value: lines[i] });
        }
      }

      ctx.replaceNode(node, replacements);
    },
  });
}

export default satteriHardbreaks;
