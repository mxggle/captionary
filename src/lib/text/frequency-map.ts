import { normalizeWord } from './tokenize';

export const FREQUENCY_BANDS = [
  { max: 2000, cls: '', label: 'Top 2,000 (very common)' },
  { max: 8000, cls: 'f-mid', label: '2,000–8,000' },
  { max: 20000, cls: 'f-rare', label: '8,000–20,000' },
  { max: Infinity, cls: 'f-vrare', label: 'Rarer than 20,000' },
] as const;

export function frequencyClass(rank: number | undefined): string {
  if (rank === undefined) return 'f-vrare';
  return FREQUENCY_BANDS.find((b) => rank <= b.max)!.cls;
}

/** Word list in rank order → normalized word → rank (1 = most frequent). */
export function buildRankMap(words: string[], lang: string): Map<string, number> {
  const ranks = new Map<string, number>();
  words.forEach((w, i) => {
    const key = normalizeWord(w, lang);
    if (key && !ranks.has(key)) ranks.set(key, i + 1);
  });
  return ranks;
}

/**
 * Rank of a normalized word. Subtitle corpora usually split contractions ("that's" →
 * "that" + "s") and only keep rare variants whole, so contractions take the better of
 * the whole form and its stem.
 */
export function frequencyRank(ranks: Map<string, number>, key: string): number | undefined {
  const whole = ranks.get(key);
  if (!key.includes("'")) return whole;
  const stem = ranks.get(key.split("'")[0]);
  if (whole === undefined) return stem;
  return stem === undefined ? whole : Math.min(whole, stem);
}
