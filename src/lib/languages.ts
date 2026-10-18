export interface Language {
  code: string;
  name: string;
  native: string;
}

/** Languages offered in the pickers. Codes are BCP-47 primary tags (plus zh variants). */
export const LANGUAGES: Language[] = [
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'bg', name: 'Bulgarian', native: 'Български' },
  { code: 'ca', name: 'Catalan', native: 'Català' },
  { code: 'cs', name: 'Czech', native: 'Čeština' },
  { code: 'da', name: 'Danish', native: 'Dansk' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'et', name: 'Estonian', native: 'Eesti' },
  { code: 'fa', name: 'Persian', native: 'فارسی' },
  { code: 'fi', name: 'Finnish', native: 'Suomi' },
  { code: 'fil', name: 'Filipino', native: 'Filipino' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'he', name: 'Hebrew', native: 'עברית' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'hr', name: 'Croatian', native: 'Hrvatski' },
  { code: 'hu', name: 'Hungarian', native: 'Magyar' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'lt', name: 'Lithuanian', native: 'Lietuvių' },
  { code: 'lv', name: 'Latvian', native: 'Latviešu' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu' },
  { code: 'nb', name: 'Norwegian', native: 'Norsk bokmål' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'ro', name: 'Romanian', native: 'Română' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'sk', name: 'Slovak', native: 'Slovenčina' },
  { code: 'sl', name: 'Slovenian', native: 'Slovenščina' },
  { code: 'sr', name: 'Serbian', native: 'Српски' },
  { code: 'sv', name: 'Swedish', native: 'Svenska' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', native: '繁體中文' },
];

const ALIASES: Record<string, string> = {
  iw: 'he',
  in: 'id',
  no: 'nb',
  tl: 'fil',
  'zh-hans': 'zh-CN',
  'zh-hant': 'zh-TW',
  'zh-hk': 'zh-TW',
  'zh-sg': 'zh-CN',
  zh: 'zh-CN',
};

/**
 * Normalize a platform language code ("en-US", "pt-BR", "zh-Hans", "iw") to one of
 * the codes in LANGUAGES where possible. Unknown codes are returned lower-cased.
 */
export function normalizeLang(code: string | null | undefined): string {
  if (!code) return '';
  const lower = code.trim().replace('_', '-').toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];
  // "cmn" is Mandarin (Apple uses cmn-Hans / cmn-Hant); Cantonese ("yue") stays separate.
  if (lower.startsWith('zh') || lower.startsWith('cmn')) {
    if (/(tw|hk|mo|hant)/.test(lower)) return 'zh-TW';
    return 'zh-CN';
  }
  const primary = lower.split('-')[0];
  return ALIASES[primary] ?? primary;
}

/** True when two codes refer to the same language (ignoring region, except Chinese script). */
export function sameLang(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeLang(a) === normalizeLang(b);
}

const ZH_OVERRIDES: Record<string, Record<string, string>> = {
  'zh-CN': { 'zh-CN': '简体中文', 'zh-TW': '繁体中文', nb: '挪威语', fil: '菲律宾语' },
  'zh-TW': { 'zh-CN': '簡體中文', 'zh-TW': '繁體中文', nb: '挪威文', fil: '菲律賓文' },
  ja: { 'zh-CN': '中国語（簡体字）', 'zh-TW': '中国語（繁体字）', nb: 'ノルウェー語', fil: 'フィリピン語' },
};

export function languageName(code: string, uiLocale?: string): string {
  const norm = normalizeLang(code);
  const found = LANGUAGES.find((l) => l.code === norm);
  if (uiLocale && uiLocale !== 'en') {
    const override = ZH_OVERRIDES[uiLocale]?.[norm];
    if (override) return override;
    try {
      const display = new Intl.DisplayNames([uiLocale], { type: 'language' }).of(norm || code);
      if (display) return display;
    } catch {
      // fall through to English
    }
  }
  if (found) return found.name;
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The language's name in itself ("简体中文" for zh-CN), when it is one of LANGUAGES. */
export function languageAutonym(code: string): string | undefined {
  const norm = normalizeLang(code);
  return LANGUAGES.find((l) => l.code === norm)?.native;
}

/** Scripts written without spaces between words; tokenization relies on Intl.Segmenter. */
export function isSpaceless(code: string): boolean {
  const n = normalizeLang(code);
  return n === 'ja' || n.startsWith('zh') || n === 'th' || n === 'lo' || n === 'km' || n === 'my';
}

export function isRtl(code: string): boolean {
  return ['ar', 'he', 'fa', 'ur'].includes(normalizeLang(code));
}

/** Code accepted by the Wiktionary REST API / speech synthesis ("zh-CN" -> "zh"). */
export function baseLang(code: string): string {
  return normalizeLang(code).split('-')[0];
}
