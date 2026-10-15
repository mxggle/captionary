import type { Cue } from './types';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', lrm: '', rlm: '' };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** Normalize cue text: drop markup, collapse whitespace, keep line breaks as spaces. */
export function cleanCueText(text: string): string {
  return decodeEntities(text.replace(/<[^>]*>/g, ''))
    .replace(/\{\\[^}]*\}/g, '') // ASS-style override tags sometimes found in SRT
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Sort, drop empty cues and clip overlaps so exactly one cue is active at a time. */
export function normalizeCues(cues: Cue[]): Cue[] {
  const sorted = cues
    .filter((c) => c.text && Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Cue[] = [];
  for (const cue of sorted) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.start - cue.start) < 0.01 && prev.text === cue.text) continue; // duplicate
    if (prev && prev.end > cue.start) {
      if (cue.start - prev.start < 0.05) {
        // Same start time: merge (e.g. two speakers in one cue split by the source).
        prev.text = `${prev.text} ${cue.text}`;
        prev.end = Math.max(prev.end, cue.end);
        continue;
      }
      prev.end = cue.start;
    }
    out.push({ ...cue });
  }
  return out;
}

// ---------- YouTube json3 ----------

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string }[];
  aAppend?: number;
}

export function parseYouTubeJson3(json: { events?: Json3Event[] }): Cue[] {
  const cues: Cue[] = [];
  for (const ev of json.events ?? []) {
    if (!ev.segs || ev.aAppend) continue;
    const text = cleanCueText(ev.segs.map((s) => s.utf8 ?? '').join(''));
    if (!text) continue;
    const start = (ev.tStartMs ?? 0) / 1000;
    cues.push({ start, end: start + (ev.dDurationMs ?? 2000) / 1000, text });
  }
  return normalizeCues(cues);
}

// ---------- WebVTT / SRT ----------

function parseTimestamp(ts: string): number {
  const m = ts.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/);
  if (!m) return NaN;
  const [, h = '0', min, s, ms] = m;
  return Number(h) * 3600 + Number(min) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000;
}

/** Parses both WebVTT and SRT (they share the cue layout). */
export function parseVttOrSrt(input: string): Cue[] {
  const text = input.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
  const blocks = text.split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const timingIdx = lines.findIndex((l) => l.includes('-->'));
    if (timingIdx === -1) continue;
    const [startRaw, rest] = lines[timingIdx].split('-->');
    const endRaw = rest.trim().split(/\s+/)[0];
    const start = parseTimestamp(startRaw);
    const end = parseTimestamp(endRaw);
    const body = cleanCueText(lines.slice(timingIdx + 1).join('\n'));
    if (body) cues.push({ start, end, text: body });
  }
  return normalizeCues(cues);
}

// ---------- TTML / DFXP (Netflix) ----------

function parseTtmlTime(value: string | null, tickRate: number): number {
  if (!value) return NaN;
  const v = value.trim();
  if (v.endsWith('t')) return Number(v.slice(0, -1)) / tickRate;
  if (v.endsWith('ms')) return Number(v.slice(0, -2)) / 1000;
  if (v.endsWith('s')) return Number(v.slice(0, -1));
  const m = v.match(/^(\d+):(\d{2}):(\d{2})(?:[.:](\d+))?$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + (m[4] ? Number(`0.${m[4]}`) : 0);
  return Number(v);
}

export function parseTtml(xml: string): Cue[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const root = doc.documentElement;
  const tickRate =
    Number(root.getAttribute('ttp:tickRate') ?? root.getAttributeNS('http://www.w3.org/ns/ttml#parameter', 'tickRate') ?? 10_000_000) ||
    10_000_000;
  const cues: Cue[] = [];
  for (const p of Array.from(doc.getElementsByTagName('p'))) {
    const start = parseTtmlTime(p.getAttribute('begin'), tickRate);
    const end = parseTtmlTime(p.getAttribute('end'), tickRate);
    const parts: string[] = [];
    const walk = (node: Node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 3) parts.push(child.textContent ?? '');
        else if ((child as Element).localName === 'br') parts.push('\n');
        else walk(child);
      }
    };
    walk(p);
    const text = cleanCueText(parts.join(''));
    if (text) cues.push({ start, end, text });
  }
  return normalizeCues(cues);
}

/** Detect the format of a subtitle file and parse it. */
export function parseSubtitleFile(name: string, content: string): Cue[] {
  const lower = name.toLowerCase();
  const head = content.trimStart().slice(0, 200);
  if (lower.endsWith('.json') || head.startsWith('{')) return parseYouTubeJson3(JSON.parse(content));
  if (lower.endsWith('.ttml') || lower.endsWith('.dfxp') || lower.endsWith('.xml') || head.startsWith('<')) return parseTtml(content);
  return parseVttOrSrt(content);
}

// ---------- alignment & export ----------

/**
 * Attach a second-language track to the original cues: each translation cue goes to
 * the original cue it overlaps most (cues can be split differently between tracks).
 */
export function alignTracks(original: Cue[], translation: Cue[]): string[] {
  const buckets: string[][] = original.map(() => []);
  if (!original.length) return [];
  let j = 0;
  for (const t of translation) {
    while (j < original.length - 1 && original[j].end <= t.start) j++;
    let best = -1;
    let bestOverlap = 0;
    for (let k = Math.max(0, j - 1); k < original.length && original[k].start < t.end; k++) {
      const overlap = Math.min(original[k].end, t.end) - Math.max(original[k].start, t.start);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = k;
      }
    }
    if (best >= 0) buckets[best].push(t.text);
  }
  return buckets.map((b) => b.join(' '));
}

/** Index of the cue active at time t (binary search), or -1. */
export function cueIndexAt(cues: Cue[], t: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].end <= t) lo = mid + 1;
    else if (cues[mid].start > t) hi = mid - 1;
    else return mid;
  }
  return -1;
}

/** Index of the last cue starting at or before t (for "previous"/"next" navigation in gaps). */
export function cueIndexBefore(cues: Cue[], t: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

function srtTime(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

export function toSrt(cues: Cue[], translations?: (string | undefined)[]): string {
  return cues
    .map((c, i) => {
      const lines = [c.text];
      if (translations?.[i]) lines.push(translations[i]!);
      return `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

export function toPlainText(cues: Cue[], translations?: (string | undefined)[]): string {
  return cues.map((c, i) => (translations?.[i] ? `${c.text}\n${translations[i]}` : c.text)).join('\n');
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
