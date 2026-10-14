import {
  createFileSystemImageCacheStore as createDefaultFileSystemImageCacheStore,
  createLinkPreviewResolvers,
  type FetchConcurrencyOptions,
  type ImageCacheStore,
  type LinkMetadata,
} from "@itoshinji/link-preview";
import { defineHastPlugin } from "satteri";
import type { HastPluginDefinition, HastVisitorContext } from "satteri";
import type { Element, Text } from "hast";

export type MetadataCacheOptions = {
  directory?: string;
  maxAge?: number | false;
};

export type ThumbnailOptions = {
  position?: "left" | "right";
};

export type MetadataTransformer = (metadata: Readonly<LinkMetadata>, url: URL) => LinkMetadata | Promise<LinkMetadata>;

export type ImageCacheOptions = {
  store?: ImageCacheStore;
  maxImageBytes?: number;
};

export type SatteriLinkCardOptions = FetchConcurrencyOptions & {
  /** Fetch implementation for metadata and image-cache downloads. Defaults to globalThis.fetch. */
  fetch?: typeof globalThis.fetch;
  metadataCache?: MetadataCacheOptions | false;
  shortenUrl?: boolean;
  thumbnail?: false | ThumbnailOptions;
  favicon?: false;
  ignoreExtensions?: string[];
  transformMetadata?: MetadataTransformer;
  imageCache?: boolean | ImageCacheOptions;
  openInNewTab?: boolean;
};

export type FileSystemImageCacheOptions = {
  directory?: string;
  publicPath?: string;
};

const DEFAULT_DIRECTORY = "public/satteri-link-card";
const DEFAULT_PUBLIC_PATH = "/satteri-link-card";
const DEFAULT_METADATA_CACHE_DIRECTORY = ".cache/satteri-link-card";

export function createFileSystemImageCacheStore(options: FileSystemImageCacheOptions = {}): ImageCacheStore {
  return createDefaultFileSystemImageCacheStore({
    directory: options.directory ?? DEFAULT_DIRECTORY,
    publicPath: options.publicPath ?? DEFAULT_PUBLIC_PATH,
  });
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
  options: {
    shortenUrl: boolean;
    thumbnail: false | ThumbnailOptions;
    favicon: boolean;
    openInNewTab: boolean;
  },
): Element {
  const url = new URL(metadata.url);
  const thumbnailPosition = options.thumbnail === false ? undefined : (options.thumbnail.position ?? "right");

  const host = element("span", { className: ["satteri-link-card__host"] }, [text(options.shortenUrl ? url.hostname : url.href)]);

  const metaChildren: Array<Element | Text> = [];
  if (options.favicon && metadata.favicon) {
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
        ...(options.openInNewTab
          ? {
              rel: ["noopener", "noreferrer"],
              target: "_blank",
            }
          : {}),
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

  if (metadata.image !== undefined && thumbnailPosition !== undefined) {
    return createLinkCard(thumbnailPosition === "right" ? [body, createMedia(metadata.image)] : [createMedia(metadata.image), body]);
  }

  return createLinkCard([body]);
}

function hasIgnoredExtension(url: URL, extensions: string[]): boolean {
  const pathname = url.pathname.toLowerCase();
  for (const extension of extensions) {
    if (pathname.endsWith(extension.toLowerCase())) return true;
  }
  return false;
}

function resolveOptions(options: SatteriLinkCardOptions) {
  const metadataCache = options.metadataCache ?? {};
  const imageCache = options.imageCache ?? false;
  const imageCacheOptions = imageCache === true ? {} : imageCache;

  return {
    metadataCache:
      metadataCache === false
        ? false
        : {
            directory: metadataCache.directory ?? DEFAULT_METADATA_CACHE_DIRECTORY,
            maxAge: metadataCache.maxAge,
          },
    shortenUrl: options.shortenUrl ?? true,
    thumbnail: options.thumbnail ?? { position: "right" as const },
    favicon: options.favicon !== false,
    ignoreExtensions: options.ignoreExtensions ?? [],
    transformMetadata: options.transformMetadata,
    imageCache:
      imageCacheOptions === false
        ? false
        : {
            maxImageBytes: imageCacheOptions.maxImageBytes,
            store: imageCacheOptions.store ?? createFileSystemImageCacheStore(),
          },
    openInNewTab: options.openInNewTab ?? true,
  };
}

export function satteriLinkCard(options: SatteriLinkCardOptions = {}): HastPluginDefinition {
  const resolvedOptions = resolveOptions(options);
  const { resolveMetadata, resolveImage } = createLinkPreviewResolvers({
    cache: resolvedOptions.metadataCache,
    fetch: options.fetch,
    maxConcurrentRequests: options.maxConcurrentRequests,
    maxConcurrentRequestsPerHost: options.maxConcurrentRequestsPerHost,
    image:
      resolvedOptions.imageCache === false
        ? undefined
        : {
            maxBytes: resolvedOptions.imageCache.maxImageBytes,
            store: resolvedOptions.imageCache.store,
          },
  });

  async function resolveAsset(source?: string) {
    if (!source || !resolveImage) return source;
    return resolveImage(source);
  }

  async function resolveAssets(metadata: LinkMetadata): Promise<LinkMetadata> {
    const [image, favicon] = await Promise.all([
      resolvedOptions.thumbnail === false ? undefined : resolveAsset(metadata.image),
      resolvedOptions.favicon ? resolveAsset(metadata.favicon) : undefined,
    ]);

    return {
      ...metadata,
      image: metadata.image ? image : undefined,
      favicon: metadata.favicon ? favicon : undefined,
    };
  }

  return defineHastPlugin({
    name: "satteri-link-card",
    options: { position: true },
    element: {
      filter: ["p"],
      async visit(node, context) {
        const linkInfo = findLinkUrl(node, context);
        if (!linkInfo) return;
        const { url, fallbackTitle } = linkInfo;

        if (hasIgnoredExtension(url, resolvedOptions.ignoreExtensions)) return;

        const metadata = await resolveMetadata(url);
        if (!metadata) return;

        let renderMetadata = metadata;
        if (resolvedOptions.transformMetadata) {
          try {
            renderMetadata = {
              ...(await resolvedOptions.transformMetadata(metadata, url)),
              url: metadata.url,
            };
          } catch {}
        }

        const assetsResolved = await resolveAssets(renderMetadata);

        return renderLinkCard(assetsResolved, fallbackTitle, {
          shortenUrl: resolvedOptions.shortenUrl,
          thumbnail: resolvedOptions.thumbnail,
          favicon: resolvedOptions.favicon,
          openInNewTab: resolvedOptions.openInNewTab,
        });
      },
    },
  });
}

export default satteriLinkCard;
