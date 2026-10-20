import { LISTENBRAINZ_USER } from "../src/const";
import { releaseSearchUrl } from "../src/lib/listenbrainz";

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  LISTENBRAINZ_TOKEN?: string;
}

type Cover = { release?: string; caaId?: number };

const UA = "nandomeka-no-prologue/1.0 (https://github.com/minittupoyo/nandomeka-no-prologue)";

const json = (body: unknown, maxAge: number) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` },
  });

/** ListenBrainz の metadata lookup（要トークン）。ジャケット情報つきで見つかればそれを返す */
const lookupListenBrainz = async (artist: string, track: string, token: string): Promise<Cover | undefined> => {
  const q = new URLSearchParams({ artist_name: artist, recording_name: track, metadata: "true", inc: "release" });
  const res = await fetch(`https://api.listenbrainz.org/1/metadata/lookup/?${q}`, {
    headers: { authorization: `Token ${token}`, "user-agent": UA },
  });
  if (!res.ok) return undefined;
  const data: any = await res.json();
  const release = data.metadata?.release;
  if (release?.caa_id && release?.caa_release_mbid) return { release: release.caa_release_mbid, caaId: release.caa_id };
  return data.release_mbid ? { release: data.release_mbid } : undefined;
};

/** 見つからなかったときの代替。MusicBrainz の公式リリース検索 */
const searchMusicBrainz = async (artist: string, track: string): Promise<Cover | undefined> => {
  const res = await fetch(releaseSearchUrl(artist, track), { headers: { "user-agent": UA } });
  if (!res.ok) return undefined;
  const id = ((await res.json()) as any).releases?.[0]?.id;
  return id ? { release: id } : undefined;
};

const handleCover = async (request: Request, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }) => {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get("artist");
  const track = searchParams.get("track");
  if (!artist || !track) return json({ error: "artist and track are required" }, 0);

  const cache = (caches as unknown as { default: Cache }).default;
  const cached = await cache.match(request);
  if (cached) return cached;

  let cover: Cover | undefined;
  try {
    if (env.LISTENBRAINZ_TOKEN) cover = await lookupListenBrainz(artist, track, env.LISTENBRAINZ_TOKEN);
    cover ??= await searchMusicBrainz(artist, track);
  } catch {
    return json({}, 0);
  }

  // 見つかったら1週間、見つからなければ1時間キャッシュする
  const response = json(cover ?? {}, cover ? 60 * 60 * 24 * 7 : 60 * 60);
  ctx.waitUntil(cache.put(request, response.clone()));
  return response;
};

const NOW_TTL = 10;

/**
 * 再生中の曲と直近の再生を1つにまとめて返す。結果はエッジで共有キャッシュされるので、
 * 閲覧者が何人いても ListenBrainz への問い合わせは NOW_TTL 秒に1回（×2リクエスト）で済む
 */
const handleNow = async (request: Request, ctx: { waitUntil: (p: Promise<unknown>) => void }) => {
  const cache = (caches as unknown as { default: Cache }).default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const base = `https://api.listenbrainz.org/1/user/${LISTENBRAINZ_USER}`;
  const get = async (path: string): Promise<any[]> => {
    const res = await fetch(`${base}/${path}`, { headers: { "user-agent": UA } });
    if (!res.ok) throw new Error(String(res.status));
    return ((await res.json()) as any).payload.listens;
  };

  try {
    const [playing, recent] = await Promise.all([get("playing-now").catch(() => []), get("listens?count=10")]);
    const response = json({ playing: playing[0], recent }, NOW_TTL);
    ctx.waitUntil(cache.put(request, response.clone()));
    return response;
  } catch {
    // 取得できないときは短時間だけ失敗をキャッシュせず返す（フロントが直接取得にフォールバックする）
    return new Response(null, { status: 502, headers: { "cache-control": "no-store" } });
  }
};

export default {
  fetch(request: Request, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/cover") return handleCover(request, env, ctx);
    if (pathname === "/api/now") return handleNow(request, ctx);
    return env.ASSETS.fetch(request);
  },
};
