import { matchesSearch } from "./gameSearch";

export type SearchableBgm = {
  title: string;
  normalized_title?: string | null;
  game_title: string;
  composer?: string | null;
};

export function normalizeBgmSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　]/g, "")
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~！？。、・「」『』【】（）［］｛｝〜ー]/g, "")
    .trim();
}

export function matchesBgmTitle(bgm: Pick<SearchableBgm, "title" | "normalized_title">, query: string) {
  const normalizedQuery = normalizeBgmSearchText(query);
  if (!normalizedQuery) return false;

  const normalizedStoredTitle = normalizeBgmSearchText(bgm.normalized_title ?? "");
  return normalizedStoredTitle.includes(normalizedQuery) || normalizeBgmSearchText(bgm.title).includes(normalizedQuery);
}

export function matchesBgmCatalog(bgm: SearchableBgm, query: string) {
  if (!query.trim()) return true;
  return matchesBgmTitle(bgm, query) || [bgm.game_title, bgm.composer ?? ""].some(value => matchesSearch(value, query));
}
