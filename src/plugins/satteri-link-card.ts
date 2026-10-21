import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import ogs from "open-graph-scraper";
import { defineHastPlugin } from "satteri";
import type { HastPluginDefinition, HastVisitorContext } from "satteri";
import type { Element, Text } from "hast";

type LinkMetadata = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
};

type CacheEntry = {
  fetchedAt: number;
  metadata: LinkMetadata;
  url: string;
  version: 1;
};

const CACHE_DIRECTORY = ".cache/satteri-link-card";
const MAX_CONCURRENT_REQUESTS = 4;
const FETCH_TIMEOUT_SECONDS = 10;

function cachePath(url: URL): string {
  return join(CACHE_DIRECTORY, `${createHash("sha256").update(url.href).digest("hex")}.json`);
}

async function readCache(url: URL): Promise<LinkMetadata | undefined> {
  try {
    const entry = JSON.parse(await readFile(cachePath(url), "utf8")) as CacheEntry;
    if (entry.version === 1 && entry.metadata) return entry.metadata;
  } catch {}
}

async function writeCache(url: URL, metadata: LinkMetadata): Promise<void> {
  const entry: CacheEntry = { fetchedAt: Date.now(), metadata, url: url.href, version: 1 };
  try {
    await mkdir(CACHE_DIRECTORY, { recursive: true });
    await writeFile(cachePath(url), `${JSON.stringify(entry, null, 2)}\n`);
  } catch {}
}

function resolveUrl(value: string | undefined, base: URL): string | undefined {
  if (!value) return;
  try {
    return new URL(value, base).href;
  } catch {}
}

async function scrapeMetadata(url: URL): Promise<LinkMetadata | undefined> {
  const { error, result } = await ogs({
    url: url.href,
    timeout: FETCH_TIMEOUT_SECONDS,
    fetchOptions: { headers: { "user-agent": "Mozilla/5.0 (compatible; nandomeka-no-prologue link card)" } },
  });
  if (error || !result.success) return;

  const pageUrl = new URL(result.ogUrl ?? result.requestUrl ?? url.href);
  const image = result.ogImage?.[0]?.url ?? result.twitterImage?.[0]?.url;

  return {
    url: url.href,
    title: result.ogTitle ?? result.twitterTitle,
    description: result.ogDescription ?? result.twitterDescription,
    image: resolveUrl(image, url),
    favicon: resolveUrl(result.favicon, url) ?? new URL("/favicon.ico", pageUrl).href,
  };
}

let activeRequests = 0;
const waiting: Array<() => void> = [];

async function withConcurrencyLimit<T>(task: () => Promise<T>): Promise<T> {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  activeRequests++;
  try {
    return await task();
  } finally {
    activeRequests--;
    waiting.shift()?.();
  }
}

const inflight = new Map<string, Promise<LinkMetadata | undefined>>();

function resolveMetadata(url: URL): Promise<LinkMetadata | undefined> {
  let pending = inflight.get(url.href);
  if (!pending) {
    pending = (async () => {
      const cached = await readCache(url);
      if (cached) return cached;
      try {
        const metadata = await withConcurrencyLimit(() => scrapeMetadata(url));
        if (metadata) await writeCache(url, metadata);
        return metadata;
      } catch {}
    })();
    inflight.set(url.href, pending);
  }
  return pending;
}

function findLinkUrl(paragraph: Readonly<Element>, context: HastVisitorContext): { url: URL; fallbackTitle?: string } | undefined {
  if (context.parent(paragraph)?.type !== "root") return;

  const meaningfulChildren = paragraph.children.filter((child) => !(child.type === "text" && child.value.trim() === ""));
  if (meaningfulChildren.length !== 1) return;

  const link = meaningfulChildren[0];
  if (link.type !== "element" || link.tagName !== "a") return;

  const href = link.properties?.href;
  if (typeof href !== "string") return;

  let url: URL;
  try {
    url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
  } catch {
    return;
  }

  const position = paragraph.position;
  if (typeof position?.start.offset === "number" && typeof position.end.offset === "number") {
    const raw = context.source.slice(position.start.offset, position.end.offset).trim();
    const isBareUrl = raw === href || raw === `<${href}>`;
    const isMarkdownLink = raw.startsWith("[") && raw.endsWith(")");
    if (!isBareUrl && !isMarkdownLink) return;
  }

  const textContent = context.textContent(link).trim();
  const fallbackTitle = textContent && textContent !== href ? textContent : undefined;

  return { url, fallbackTitle };
}

function text(value: string): Text {
  return {
    type: "text",
    value,
  };
}

function element(tagName: string, properties: Record<string, unknown>, children: Array<Element | Text>): Element {
  return {
    children,
    properties,
    tagName,
    type: "element",
  };
}

function renderLinkCard(
  metadata: LinkMetadata,
  fallbackTitle: string | undefined,
  options: { thumbnail: boolean },
): Element {
  const url = new URL(metadata.url);
    const host = element("span", { className: ["satteri-link-card__host"] }, [text(url.hostname)]);

  const metaChildren: Array<Element | Text> = [];
  if (metadata.favicon) {
    metaChildren.push(
      element(
        "img",
        {
          alt: "",
          className: ["satteri-link-card__favicon"],
          decoding: "async",
          src: metadata.favicon,
        },
        [],
      ),
    );
  }
  metaChildren.push(host);

  const meta = element("span", { className: ["satteri-link-card__meta"] }, metaChildren);

  const titleText = metadata.title || fallbackTitle || url.hostname;
  const bodyChildren: Array<Element | Text> = [element("span", { className: ["satteri-link-card__title"] }, [text(titleText)])];
  if (metadata.description) {
    bodyChildren.push(element("span", { className: ["satteri-link-card__description"] }, [text(metadata.description)]));
  }
  bodyChildren.push(meta);

  const body = element("span", { className: ["satteri-link-card__body"] }, bodyChildren);

  function createLinkCard(children: Array<Element | Text>): Element {
    return element(
      "a",
      {
        className: ["satteri-link-card"],
        href: metadata.url,
        rel: ["noopener", "noreferrer"],
        target: "_blank",
      },
      [...children],
    );
  }

  function createMedia(src: string): Element {
    return element("span", { className: ["satteri-link-card__media"] }, [
      element(
        "img",
        {
          alt: "",
          className: ["satteri-link-card__image"],
          decoding: "async",
          loading: "lazy",
          src,
        },
        [],
      ),
    ]);
  }

  if (metadata.image && options.thumbnail) {
    return createLinkCard([body, createMedia(metadata.image)]);
  }

  return createLinkCard([body]);
}

function findInlineLink(anchor: Readonly<Element>, context: HastVisitorContext): URL | undefined {
  const href = anchor.properties?.href;
  if (typeof href !== "string") return;
  if (anchor.properties?.dataHoverCard !== undefined) return;

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  const parent = context.parent(anchor);
  if (parent?.type === "element" && parent.tagName === "p" && findLinkUrl(parent, context)) return;

  return url;
}

export function satteriLinkCard(): HastPluginDefinition {
  return defineHastPlugin({
    name: "satteri-link-card",
    options: { position: true },
    element: {
      filter: ["p", "a"],
      async visit(node, context) {
        if (node.tagName === "a") {
          const inlineUrl = findInlineLink(node, context);
          if (!inlineUrl) return;

          const metadata = await resolveMetadata(inlineUrl);
          if (!metadata) return;

          const { title, description, image, favicon } = metadata;
          const hoverCard = JSON.stringify({ title, description, image, favicon, host: inlineUrl.hostname });
          return { ...node, properties: { ...node.properties, dataHoverCard: hoverCard } };
        }

        const linkInfo = findLinkUrl(node, context);
        if (!linkInfo) return;

        const metadata = await resolveMetadata(linkInfo.url);
        if (!metadata) return;

        return renderLinkCard(metadata, linkInfo.fallbackTitle, { thumbnail: true });
      },
    },
  });
}

export default satteriLinkCard;
