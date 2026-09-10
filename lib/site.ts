export const SITE_URL = "https://my9gamemusic.com";

export function sharedSetUrl(shareId: string) {
  return `${SITE_URL}/set/${encodeURIComponent(shareId)}`;
}
