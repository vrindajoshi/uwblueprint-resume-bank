// Deterministic seeded shuffle: same seed + same item key always produces the
// same order. Used to give each sponsor a randomized-but-stable resume order
// for their whole session (PRD: shuffled once at login, no reshuffling on
// reload) without having to persist the full ordering anywhere.

function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashKey(seed: number, key: string): number {
  let h = seed | 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 2654435761);
  }
  return mulberry32(h)();
}

export function seededShuffle<T>(items: T[], seed: number, keyOf: (item: T) => string): T[] {
  return items
    .map((item) => ({ item, sortKey: hashKey(seed, keyOf(item)) }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((entry) => entry.item);
}
