import "server-only";

export type SharedSetBgm = {
  id: number;
  title: string;
  game_title: string;
  image_url: string | null;
};

export type SharedSet = {
  share_id: string;
  title: string | null;
  creator_name: string | null;
  bgm_ids: number[];
  bgms: SharedSetBgm[];
};

const shareIdPattern = /^[A-Za-z0-9]{1,64}$/;

export async function getSharedSet(shareId: string): Promise<SharedSet | null> {
  if (!shareIdPattern.test(shareId)) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const setResponse = await fetch(
    `${url}/rest/v1/bgm_sets?share_id=eq.${encodeURIComponent(shareId)}&select=share_id,title,creator_name,bgm_ids&limit=1`,
    { headers, cache: "no-store", signal: AbortSignal.timeout(5000) },
  );
  if (!setResponse.ok) return null;

  const sets = await setResponse.json() as Array<Omit<SharedSet, "bgms">>;
  const set = sets[0];
  if (!set || !Array.isArray(set.bgm_ids) || set.bgm_ids.length !== 9) return null;

  const ids = set.bgm_ids.map(Number).filter(Number.isSafeInteger);
  if (ids.length !== 9) return null;
  const bgmResponse = await fetch(
    `${url}/rest/v1/bgms?id=in.(${ids.join(",")})&select=id,title,game_title,image_url`,
    { headers, cache: "no-store", signal: AbortSignal.timeout(5000) },
  );
  if (!bgmResponse.ok) return null;

  const rows = await bgmResponse.json() as SharedSetBgm[];
  const byId = new Map(rows.map(bgm => [bgm.id, bgm]));
  const bgms = ids.map(id => byId.get(id)).filter((bgm): bgm is SharedSetBgm => Boolean(bgm));
  if (bgms.length !== 9) return null;

  return { ...set, bgm_ids: ids, bgms };
}

export function sharedSetTitle(set: SharedSet | null) {
  return set?.title?.trim() || "私を彩る9つのゲーム音楽";
}
