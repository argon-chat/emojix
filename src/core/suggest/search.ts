/** Binary search over tuples sorted by their first element in code-unit order. */

type Sorted = readonly (readonly [string, ...unknown[]])[];

/** Index of the first entry whose key is not less than `key`. */
export function lowerBound(entries: Sorted, key: string): number {
  let lo = 0;
  let hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (entries[mid]![0] < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Index of the first entry whose key equals `key`, or -1. */
export function findExact(entries: Sorted, key: string): number {
  const i = lowerBound(entries, key);
  return i < entries.length && entries[i]![0] === key ? i : -1;
}
