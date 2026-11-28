import { isSpaceless } from '../languages';
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
 * the whole form and its stem. In languages written without spaces (pass `lang`), a chunk the
 * segmenter cut differently from the list ("本当に", "言う") is ranked by the listed pieces it is
 * made of ("本当" + "に"), so an everyday word does not count as unknown.
 */
export function frequencyRank(ranks: Map<string, number>, key: string, lang?: string): number | undefined {
  const whole = ranks.get(key);
  if (whole === undefined && lang && isSpaceless(lang)) return piecesRank(ranks, key);
  if (!key.includes("'")) return whole;
  const stem = ranks.get(key.split("'")[0]);
  if (whole === undefined) return stem;
  return stem === undefined ? whole : Math.min(whole, stem);
}

/** Longest piece tried when splitting a chunk into listed words. */
const MAX_PIECE = 8;

/**
 * The rank of a chunk made of listed pieces: the split whose rarest piece is most common, ranked
 * by that piece. Undefined when some part of it is in no listed piece.
 */
function piecesRank(ranks: Map<string, number>, key: string): number | undefined {
  const chars = [...key];
  const n = chars.length;
  if (n < 2) return undefined;
  // best[i]: the lowest "rarest piece" rank over splits of the first i characters.
  const best: number[] = [0, ...Array<number>(n).fill(Infinity)];
  for (let end = 1; end <= n; end++) {
    for (let start = Math.max(0, end - MAX_PIECE); start < end; start++) {
      if (best[start] === Infinity || (start === 0 && end === n)) continue;
      const rank = ranks.get(chars.slice(start, end).join(''));
      if (rank !== undefined) best[end] = Math.min(best[end], Math.max(best[start], rank));
    }
  }
  return best[n] === Infinity ? undefined : best[n];
}
