import { defineHastPlugin } from "satteri";
import type { HastPluginDefinition } from "satteri";
import type { Element, ElementContent } from "hast";

const CALLOUT_TITLES = {
  note: "ノート",
  tip: "ヒント",
  important: "重要",
  warning: "警告",
  caution: "注意",
} as const;

type CalloutType = keyof typeof CALLOUT_TITLES;

/** Tabler Icons (outline) のパス */
const CALLOUT_ICONS: Record<CalloutType, string[]> = {
  note: ["M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0", "M12 9h.01", "M11 12h1v4h1"],
  tip: [
    "M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7",
    "M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3",
    "M9.7 17l4.6 0",
  ],
  important: ["M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12", "M12 8v3", "M12 14v.01"],
  warning: [
    "M12 9v4",
    "M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0",
    "M12 16h.01",
  ],
  caution: [
    "M12.802 2.165l5.575 2.389c.48 .206 .863 .589 1.07 1.07l2.388 5.574c.22 .512 .22 1.092 0 1.604l-2.389 5.575c-.206 .48 -.589 .863 -1.07 1.07l-5.574 2.388c-.512 .22 -1.092 .22 -1.604 0l-5.575 -2.389a2.036 2.036 0 0 1 -1.07 -1.07l-2.388 -5.574a2.036 2.036 0 0 1 0 -1.604l2.389 -5.575c.206 -.48 .589 -.863 1.07 -1.07l5.574 -2.388a2.036 2.036 0 0 1 1.604 0",
    "M12 8v4",
    "M12 16h.01",
  ],
};

function icon(type: CalloutType): Element {
  return {
    type: "element",
    tagName: "svg",
    properties: {
      className: ["callout__icon"],
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ariaHidden: "true",
    },
    children: CALLOUT_ICONS[type].map((d): Element => ({ type: "element", tagName: "path", properties: { d }, children: [] })),
  };
}

const MARKER = /^\[!(note|tip|important|warning|caution)\][ \t]*/i;

function isBlank(node: ElementContent): boolean {
  return node.type === "text" && node.value.trim() === "";
}

function isBreak(node: ElementContent): boolean {
  return node.type === "element" && node.tagName === "br";
}

/** 先頭の段落から `[!NOTE]` を取り除いた子要素を返す。コールアウトでなければ undefined */
function parseMarker(paragraph: Readonly<Element>): { type: CalloutType; children: ElementContent[] } | undefined {
  const [first, ...rest] = paragraph.children;
  if (first?.type !== "text") return;

  const match = MARKER.exec(first.value);
  if (!match) return;

  const remainder = first.value.slice(match[0].length).replace(/^\r?\n/, "");
  const children: ElementContent[] = remainder ? [{ type: "text", value: remainder }, ...rest] : [...rest];

  // マーカー直後の改行（hardbreaksによる<br>や空白）は本文に含めない
  while (children.length > 0 && (isBlank(children[0]) || isBreak(children[0]))) children.shift();

  return { type: match[1].toLowerCase() as CalloutType, children };
}

export function satteriCallout(): HastPluginDefinition {
  return defineHastPlugin({
    name: "satteri-callout",
    element: {
      filter: ["blockquote"],
      visit(node) {
        const contents = node.children.filter((child) => !isBlank(child));
        const paragraph = contents[0];
        if (paragraph?.type !== "element" || paragraph.tagName !== "p") return;

        const parsed = parseMarker(paragraph);
        if (!parsed) return;

        const body: ElementContent[] = [
          ...(parsed.children.length > 0 ? [{ type: "element", tagName: "p", properties: {}, children: parsed.children } as Element] : []),
          ...contents.slice(1),
        ];

        return {
          type: "element",
          tagName: "div",
          properties: { className: ["callout", `callout-${parsed.type}`] },
          children: [
            { type: "element", tagName: "p", properties: { className: ["callout__title"] }, children: [icon(parsed.type), { type: "text", value: CALLOUT_TITLES[parsed.type] }] },
            { type: "element", tagName: "div", properties: { className: ["callout__body"] }, children: body },
          ],
        };
      },
    },
  });
}

export default satteriCallout;
