export type Listen = {
  listened_at?: number;
  track_metadata: {
    artist_name: string;
    track_name: string;
    release_name?: string;
    additional_info?: { release_mbid?: string };
    mbid_mapping?: { caa_id?: number; caa_release_mbid?: string };
  };
};

/** 503（混雑）のときだけ、間隔をあけて1回再試行する */
const fetchJson = async (url: string) => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) return res.json();
    if (res.status !== 503 || attempt >= 1) throw new Error(String(res.status));
    await new Promise((r) => setTimeout(r, 2000));
  }
};

export const getListens = async (user: string, path: string): Promise<Listen[]> =>
  (await fetchJson(`https://api.listenbrainz.org/1/user/${user}/${path}`)).payload.listens;

const caaUrl = (releaseMbid: string, caaId: number, size: number) =>
  `https://coverartarchive.org/release/${releaseMbid}/${caaId}-${size}.jpg`;

/** Cover Art Archive のジャケット画像URL。ジャケット情報がない曲は undefined */
export const coverUrl = ({ track_metadata: m }: Listen, size: 250 | 500 = 250) => {
  const { caa_id, caa_release_mbid } = m.mbid_mapping ?? {};
  if (caa_id && caa_release_mbid) return caaUrl(caa_release_mbid, caa_id, size);
  const mbid = m.additional_info?.release_mbid;
  return mbid ? `https://coverartarchive.org/release/${mbid}/front-${size}` : undefined;
};

/** 再生中の曲。取得できない場合は undefined（直近の再生へフォールバックできるよう例外にしない） */
export const getPlayingNow = async (user: string): Promise<Listen | undefined> => {
  try {
    return (await getListens(user, "playing-now"))[0];
  } catch {
    return undefined;
  }
};

export const isSameTrack = (a: Listen, b: Listen) =>
  a.track_metadata.track_name === b.track_metadata.track_name &&
  a.track_metadata.artist_name === b.track_metadata.artist_name;

const quote = (v: string) => `"${v.replace(/(["\\])/g, "\\$1")}"`;

/** MusicBrainz の公式リリース検索URL（Worker からも使う） */
export const releaseSearchUrl = (artist: string, track: string) => {
  const q = new URLSearchParams({
    query: `recording:${quote(track)} AND artist:${quote(artist)} AND status:official`,
    fmt: "json",
    limit: "1",
  });
  return `https://musicbrainz.org/ws/2/release?${q}`;
};

const COVER_CACHE_KEY = "lb-cover-cache-v2";
const NOT_FOUND_TTL = 60 * 60 * 1000;

type CoverCache = Record<string, { cover: { release?: string; caaId?: number } | null; at: number }>;

const readCache = (): CoverCache => {
  try {
    return JSON.parse(localStorage.getItem(COVER_CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
};

const writeCache = (key: string, cover: CoverCache[string]["cover"]) => {
  try {
    localStorage.setItem(COVER_CACHE_KEY, JSON.stringify({ ...readCache(), [key]: { cover, at: Date.now() } }));
  } catch {
    // 保存できなくても動作には影響しない
  }
};

type Cover = { release?: string; caaId?: number };

/** 自サイトの Worker（/api/cover）に問い合わせる。開発サーバーなど Worker がない環境では undefined */
const lookupViaWorker = async (artist: string, track: string): Promise<Cover | undefined> => {
  try {
    return await fetchJson(`/api/cover?${new URLSearchParams({ artist, track })}`);
  } catch {
    return undefined;
  }
};

/** Worker が使えないときの代替。ブラウザから直接 MusicBrainz を検索する */
const lookupViaMusicBrainz = async (artist: string, track: string): Promise<Cover | undefined> => {
  const release = (await fetchJson(releaseSearchUrl(artist, track))).releases?.[0]?.id;
  return release ? { release } : undefined;
};

/**
 * 再生中の曲は MBID が付かないことがあるため、曲名とアーティスト名からジャケットを探す。
 * Worker（ListenBrainz の metadata lookup）→ MusicBrainz 検索の順に試し、結果は localStorage に保存する
 * （見つかった場合は保持し、見つからなかった場合は1時間だけ保持する）。取得できない場合は undefined
 */
export const lookupCoverUrl = async ({ track_metadata: m }: Listen, size: 250 | 500 = 250) => {
  const url = ({ release, caaId }: Cover) =>
    release ? (caaId ? caaUrl(release, caaId, size) : `https://coverartarchive.org/release/${release}/front-${size}`) : undefined;
  const key = `${m.artist_name}\t${m.track_name}`;
  const cached = readCache()[key];
  if (cached && (cached.cover || Date.now() - cached.at < NOT_FOUND_TTL)) return cached.cover ? url(cached.cover) : undefined;

  try {
    const cover = (await lookupViaWorker(m.artist_name, m.track_name)) ?? (await lookupViaMusicBrainz(m.artist_name, m.track_name));
    writeCache(key, cover ?? null);
    return cover && url(cover);
  } catch {
    return undefined;
  }
};
