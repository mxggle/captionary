import { baseLang, isSpaceless } from './languages';
import { formatTime } from './subtitles/parse';
import type { Cue } from './subtitles/types';
import { normalizeWord } from './text/tokenize';

/** At most this many mentions go with an "In the show" request: the first ones, and the most recent. */
const MAX_MENTIONS = 40;
/** Share of them taken from the start, where a name is introduced; the rest show what is going on now. */
const FIRST_SHARE = 0.3;
/** And at most this much text, lines around the mentions included (about 1.5–2k tokens). */
const MAX_EXCERPT_CHARS = 5000;

const WORD_CHAR = /[\p{L}\p{N}\p{M}]/u;

/**
 * Indexes of the cues up to `upTo` (inclusive) that mention `text`: as a whole word in languages
 * written with spaces ("Mike" in "Mike's", not in "Mikey"), anywhere in the line otherwise ("田中" in
 * "田中さん").
 */
export function findMentions(cues: Cue[], upTo: number, text: string, lang: string): number[] {
  let name = normalizeWord(text, lang);
  if (baseLang(lang) === 'en') name = name.replace(/'s$/, '');
  if (!name) return [];
  const spaceless = isSpaceless(lang);
  const out: number[] = [];
  for (let i = 0; i <= Math.min(upTo, cues.length - 1); i++) {
    const line = normalizeWord(cues[i].text, lang);
    for (let at = line.indexOf(name); at >= 0; at = line.indexOf(name, at + 1)) {
      if (spaceless || (!WORD_CHAR.test(line[at - 1] ?? '') && !WORD_CHAR.test(line[at + name.length] ?? ''))) {
        out.push(i);
        break;
      }
    }
  }
  return out;
}

/** `n` of the mentions: some from the start and the rest from the end. */
function sample(mentions: number[], n: number): number[] {
  if (mentions.length <= n) return mentions;
  const first = Math.ceil(n * FIRST_SHARE);
  return [...mentions.slice(0, first), ...mentions.slice(mentions.length - (n - first))];
}

function excerptLines(cues: Cue[], mentions: number[], upTo: number, neighbors: boolean): string[] {
  const keep = new Set<number>();
  for (const i of mentions) {
    for (const j of neighbors ? [i - 1, i, i + 1] : [i]) if (j >= 0 && j <= upTo && j < cues.length) keep.add(j);
  }
  const out: string[] = [];
  let prev = -2;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (out.length && i > prev + 1) out.push('…');
    out.push(`[${formatTime(cues[i].start)}] ${cues[i].text.replace(/\s+/g, ' ').trim()}`);
    prev = i;
  }
  return out;
}

const size = (lines: string[]) => lines.reduce((n, l) => n + l.length + 1, 0);

/**
 * The lines sent with an "In the show" request, as "[m:ss] line" with "…" between passages that do
 * not touch: each mention with the line before and after it, no later than `upTo`. Over the budget,
 * the lines around the mentions go first, then mentions from the middle of the episode.
 */
export function storyExcerpts(cues: Cue[], mentions: number[], upTo: number): string[] {
  let picked = sample(mentions, MAX_MENTIONS);
  let lines = excerptLines(cues, picked, upTo, true);
  if (size(lines) <= MAX_EXCERPT_CHARS) return lines;
  lines = excerptLines(cues, picked, upTo, false);
  while (size(lines) > MAX_EXCERPT_CHARS && picked.length > 1) {
    picked = sample(picked, Math.floor(picked.length * 0.75));
    lines = excerptLines(cues, picked, upTo, false);
  }
  return lines;
}
