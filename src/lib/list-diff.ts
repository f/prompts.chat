/** One entry of a list-like field, e.g. a platform, tag, connector, skill or routine */
export interface DiffItem {
  /** Identity of the item across both sides, e.g. a platform id or a skill name */
  key: string;
  /** What is shown; when the key matches but the text differs the item counts as changed */
  text: string;
}

export type ListDiffEntry =
  | { type: "unchanged"; key: string; text: string }
  | { type: "added"; key: string; text: string }
  | { type: "removed"; key: string; text: string }
  | { type: "changed"; key: string; original: string; modified: string };

/**
 * Item-level diff of two lists: items are matched by key in order (longest common subsequence),
 * so an item present on both sides is never shown as removed and re-added, only items that were
 * added or removed are, and a kept item whose text changed is reported as changed.
 */
export function diffItemLists(original: readonly DiffItem[], modified: readonly DiffItem[]): ListDiffEntry[] {
  const m = original.length;
  const n = modified.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = original[i].key === modified[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const entries: ListDiffEntry[] = [];
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && original[i].key === modified[j].key) {
      const before = original[i];
      const after = modified[j];
      entries.push(
        before.text === after.text
          ? { type: "unchanged", key: after.key, text: after.text }
          : { type: "changed", key: after.key, original: before.text, modified: after.text }
      );
      i++;
      j++;
    } else if (i < m && (j === n || dp[i + 1][j] >= dp[i][j + 1])) {
      entries.push({ type: "removed", key: original[i].key, text: original[i].text });
      i++;
    } else {
      entries.push({ type: "added", key: modified[j].key, text: modified[j].text });
      j++;
    }
  }
  return entries;
}

/** Items whose key is their text, for plain string lists */
export function textItems(values: readonly string[]): DiffItem[] {
  return values.map((value) => ({ key: value, text: value }));
}
