import { baseLang } from '../languages';

/**
 * Romanization for scripts learners often can't read yet. Chinese (pinyin) is handled
 * in the background worker with pinyin-pro; the rest is rule-based and runs anywhere.
 * Japanese is limited to kana: kanji readings need a dictionary, so kanji stay as-is.
 */
export const ROMANIZABLE = ['zh', 'ja', 'ko', 'ru', 'uk', 'bg', 'sr', 'mk', 'be', 'kk', 'el'];

export function canRomanize(lang: string): boolean {
  return ROMANIZABLE.includes(baseLang(lang));
}

// ---------- Korean (Revised Romanization, with liaison and nasal assimilation) ----------

const KO_INITIAL = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const KO_VOWEL = [
  'a',
  'ae',
  'ya',
  'yae',
  'eo',
  'e',
  'yeo',
  'ye',
  'o',
  'wa',
  'wae',
  'oe',
  'yo',
  'u',
  'wo',
  'we',
  'wi',
  'yu',
  'eu',
  'ui',
  'i',
];
// Final consonant: [sound at end of syllable, sound when carried onto a following vowel]
const KO_FINAL: [string, string][] = [
  ['', ''],
  ['k', 'g'],
  ['k', 'kk'],
  ['k', 'ks'],
  ['n', 'n'],
  ['n', 'nj'],
  ['n', 'n'],
  ['t', 'd'],
  ['l', 'r'],
  ['k', 'lg'],
  ['m', 'lm'],
  ['l', 'lb'],
  ['l', 'ls'],
  ['l', 'lt'],
  ['p', 'lp'],
  ['l', 'r'],
  ['m', 'm'],
  ['p', 'b'],
  ['p', 'ps'],
  ['t', 's'],
  ['t', 'ss'],
  ['ng', 'ng'],
  ['t', 'j'],
  ['t', 'ch'],
  ['k', 'k'],
  ['t', 't'],
  ['p', 'p'],
  ['t', ''],
];

function decomposeHangul(ch: string): [number, number, number] | null {
  const code = ch.codePointAt(0)! - 0xac00;
  if (code < 0 || code > 11171) return null;
  return [Math.floor(code / 588), Math.floor((code % 588) / 28), code % 28];
}

export function romanizeKorean(text: string): string {
  const chars = [...text];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const cur = decomposeHangul(chars[i]);
    if (!cur) {
      out += chars[i];
      continue;
    }
    const [ini, vow, fin] = cur;
    const next = decomposeHangul(chars[i + 1] ?? '');
    const prev = decomposeHangul(chars[i - 1] ?? '');
    // Initial: silent when it received the previous syllable's final (handled there).
    let initial = KO_INITIAL[ini];
    if (prev && prev[2] !== 0 && prev[2] !== 21 && ini === 11) initial = '';
    if (prev && ini === 5 && (prev[2] === 8 || prev[2] === 4)) initial = 'l'; // ㄹ after ㄹ/ㄴ → l
    out += initial + KO_VOWEL[vow];
    if (!fin) continue;
    let final = KO_FINAL[fin][0];
    if (next) {
      const nIni = next[0];
      if (nIni === 11 && fin !== 21)
        final = KO_FINAL[fin][1]; // liaison onto a vowel
      else if (nIni === 2 || nIni === 6) {
        // nasal assimilation before ㄴ/ㅁ
        if (final === 'k') final = 'ng';
        else if (final === 'p') final = 'm';
        else if (final === 't') final = 'n';
      } else if (nIni === 5 && final === 'n') final = 'l';
    }
    out += final;
  }
  return out;
}

// ---------- Japanese kana (Hepburn) ----------

const KANA: Record<string, string> = {
  あ: 'a',
  い: 'i',
  う: 'u',
  え: 'e',
  お: 'o',
  か: 'ka',
  き: 'ki',
  く: 'ku',
  け: 'ke',
  こ: 'ko',
  が: 'ga',
  ぎ: 'gi',
  ぐ: 'gu',
  げ: 'ge',
  ご: 'go',
  さ: 'sa',
  し: 'shi',
  す: 'su',
  せ: 'se',
  そ: 'so',
  ざ: 'za',
  じ: 'ji',
  ず: 'zu',
  ぜ: 'ze',
  ぞ: 'zo',
  た: 'ta',
  ち: 'chi',
  つ: 'tsu',
  て: 'te',
  と: 'to',
  だ: 'da',
  ぢ: 'ji',
  づ: 'zu',
  で: 'de',
  ど: 'do',
  な: 'na',
  に: 'ni',
  ぬ: 'nu',
  ね: 'ne',
  の: 'no',
  は: 'ha',
  ひ: 'hi',
  ふ: 'fu',
  へ: 'he',
  ほ: 'ho',
  ば: 'ba',
  び: 'bi',
  ぶ: 'bu',
  べ: 'be',
  ぼ: 'bo',
  ぱ: 'pa',
  ぴ: 'pi',
  ぷ: 'pu',
  ぺ: 'pe',
  ぽ: 'po',
  ま: 'ma',
  み: 'mi',
  む: 'mu',
  め: 'me',
  も: 'mo',
  や: 'ya',
  ゆ: 'yu',
  よ: 'yo',
  ら: 'ra',
  り: 'ri',
  る: 'ru',
  れ: 're',
  ろ: 'ro',
  わ: 'wa',
  ゐ: 'i',
  ゑ: 'e',
  を: 'o',
  ん: 'n',
  ゔ: 'vu',
  ぁ: 'a',
  ぃ: 'i',
  ぅ: 'u',
  ぇ: 'e',
  ぉ: 'o',
};
const SMALL_Y: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' };
const SMALL_VOWEL: Record<string, string> = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' };
const MACRON: Record<string, string> = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };

function toHiragana(ch: string): string {
  const c = ch.codePointAt(0)!;
  return c >= 0x30a1 && c <= 0x30f6 ? String.fromCodePoint(c - 0x60) : ch;
}

export function romanizeKana(text: string): string {
  const chars = [...text].map(toHiragana);
  let out = '';
  let geminate = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === 'っ') {
      geminate = true;
      continue;
    }
    if (ch === 'ー') {
      const last = out.slice(-1);
      if (MACRON[last]) out = out.slice(0, -1) + MACRON[last];
      continue;
    }
    let syl = KANA[ch];
    if (syl === undefined) {
      out += ch;
      geminate = false;
      continue;
    }
    const next = chars[i + 1];
    if (next && SMALL_Y[next] && syl.endsWith('i') && syl.length > 1) {
      // きゃ → kya, しゃ → sha, ちゃ → cha, じゃ → ja
      const stem = syl.slice(0, -1);
      syl = (/(sh|ch|j)$/.test(stem) ? stem : `${stem}y`) + SMALL_Y[next];
      i++;
    } else if (next && SMALL_VOWEL[next] && /[^aiueo]$/.test(syl.slice(0, -1) || 'x')) {
      // ファ → fa, ティ → ti
      syl = syl.slice(0, -1) + SMALL_VOWEL[next];
      i++;
    }
    if (geminate) {
      syl = (syl.startsWith('ch') ? 't' : syl[0]) + syl;
      geminate = false;
    }
    if (ch === 'ん' && next && /^[aiueoy]/.test(KANA[next] ?? '')) syl = "n'";
    out += syl;
  }
  return out;
}

// ---------- Cyrillic & Greek ----------

const CYRILLIC_BASE: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ѓ: 'gj',
  ѕ: 'dz',
  ј: 'j',
  љ: 'lj',
  њ: 'nj',
  ќ: 'kj',
  џ: 'dž',
  ђ: 'đ',
  ћ: 'ć',
  ў: 'ŭ',
  қ: 'q',
  ғ: 'gh',
  ң: 'ng',
  ү: 'ü',
  ұ: 'u',
  һ: 'h',
  ә: 'ä',
  ө: 'ö',
  і: 'i',
};
const CYRILLIC_LANG: Record<string, Record<string, string>> = {
  uk: { г: 'h', ґ: 'g', е: 'e', є: 'ye', и: 'y', і: 'i', ї: 'yi', ь: '' },
  bg: { щ: 'sht', ъ: 'a', ю: 'yu', я: 'ya' },
  sr: { х: 'h', ц: 'c', ч: 'č', ш: 'š', ж: 'ž' },
  mk: { х: 'h', ц: 'c', ч: 'č', ш: 'š', ж: 'ž' },
  be: { г: 'h', і: 'i', ў: 'ŭ', и: 'i' },
};

function mapCase(src: string, out: string): string {
  if (!out || src === src.toLowerCase()) return out;
  return out[0].toUpperCase() + out.slice(1);
}

export function romanizeCyrillic(text: string, lang: string): string {
  const table = { ...CYRILLIC_BASE, ...(CYRILLIC_LANG[baseLang(lang)] ?? {}) };
  return [...text]
    .map((ch) => {
      const lower = ch.toLowerCase();
      return lower in table ? mapCase(ch, table[lower]) : ch;
    })
    .join('');
}

const GREEK: Record<string, string> = {
  α: 'a',
  β: 'v',
  γ: 'g',
  δ: 'd',
  ε: 'e',
  ζ: 'z',
  η: 'i',
  θ: 'th',
  ι: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',
  ς: 's',
  τ: 't',
  υ: 'y',
  φ: 'f',
  χ: 'ch',
  ψ: 'ps',
  ω: 'o',
};
const GREEK_PAIRS: Record<string, string> = {
  ου: 'ou',
  αι: 'ai',
  ει: 'ei',
  οι: 'oi',
  αυ: 'av',
  ευ: 'ev',
  γγ: 'ng',
  γκ: 'gk',
  μπ: 'b',
  ντ: 'nt',
};

export function romanizeGreek(text: string): string {
  const plain = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  let out = '';
  for (let i = 0; i < plain.length; i++) {
    const pair = plain.slice(i, i + 2).toLowerCase();
    if (GREEK_PAIRS[pair]) {
      out += mapCase(plain[i], GREEK_PAIRS[pair]);
      i++;
      continue;
    }
    const lower = plain[i].toLowerCase();
    out += lower in GREEK ? mapCase(plain[i], GREEK[lower]) : plain[i];
  }
  return out;
}

/**
 * Romanize one line for every supported language except Chinese (see the background).
 * Returns '' when the line has nothing to romanize.
 */
export function romanizeLine(text: string, lang: string): string {
  const base = baseLang(lang);
  let out: string;
  if (base === 'ko') {
    if (!/[가-힣]/.test(text)) return '';
    out = romanizeKorean(text);
  } else if (base === 'ja') {
    if (!/[぀-ヿ]/.test(text)) return '';
    // Romanize kana runs; kanji stay as written. Without a morphological dictionary word
    // boundaries inside kana are unreliable, so spaces go only where the script changes
    // (kanji, hiragana, katakana).
    out = text
      .split(/([\u3040-\u309f]+|[\u30a0-\u30ff]+)/)
      .map((run) => (/[\u3040-\u30ff]/.test(run) ? romanizeKana(run) : run.trim()))
      .filter(Boolean)
      .join(' ')
      .replace(/ ?([、。！？])/g, (_, p: string) => ({ '、': ',', '。': '.', '！': '!', '？': '?' })[p] ?? p);
  } else if (base === 'el') {
    if (!/[Ͱ-Ͽἀ-῿]/.test(text)) return '';
    out = romanizeGreek(text);
  } else if (['ru', 'uk', 'bg', 'sr', 'mk', 'be', 'kk'].includes(base)) {
    if (!/[Ѐ-ӿ]/.test(text)) return '';
    out = romanizeCyrillic(text, lang);
  } else {
    return '';
  }
  return out === text ? '' : out;
}
