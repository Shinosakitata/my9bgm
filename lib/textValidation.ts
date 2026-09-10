// Narrow phrase rules avoid blocking innocent words that merely contain "sex".
// Existing records are never rewritten by this validation.
export function inappropriateText(value: string) {
  const normalized = value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}\p{Cf}]+/gu, "");
  return /(?:playsexwithme|havesexwithme|fuckyou|fuckme|死ね|殺してやる)/u.test(normalized);
}

export function usernameError(value: string) {
  const name = value.normalize("NFKC").trim();
  if (name.length < 1 || name.length > 30) return "ユーザー名は1〜30文字にしてください。";
  if (/[\p{Cc}\p{Cf}]/u.test(name) || inappropriateText(name) || /https?:\/\/|www\./i.test(name)) return "このユーザー名は使用できません。";
  return "";
}

export function similarTitle(a: string, b: string) {
  const clean = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  const x = clean(a), y = clean(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) < 4 || Math.abs(x.length - y.length) > 1) return false;
  // A single insertion, omission, or substitution prompts a review, never a merge.
  let previous = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    for (let j = 1; j <= y.length; j++) row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    previous = row;
  }
  return previous[y.length] <= 1;
}
