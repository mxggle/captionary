/**
 * Small offline language guesser used when Chrome's LanguageDetector API is not
 * available. Script ranges decide most non-Latin languages; Latin-script languages are
 * scored by frequent function words.
 */

const SCRIPTS: [RegExp, string][] = [
  [/[\u3040-\u30ff]/, 'ja'],
  [/[\uac00-\ud7af]/, 'ko'],
  [/[\u0e00-\u0e7f]/, 'th'],
  [/[\u0590-\u05ff]/, 'he'],
  [/[\u0900-\u097f]/, 'hi'],
  [/[\u0370-\u03ff]/, 'el'],
  [/[\u0b80-\u0bff]/, 'ta'],
];

const STOPWORDS: Record<string, string[]> = {
  en: ['the', 'and', 'is', 'you', 'that', 'it', 'of', 'to', 'in', 'what', 'this', 'with', 'have', 'are', 'was', 'not', "i'm", "don't"],
  es: [
    'el',
    'la',
    'los',
    'las',
    'que',
    'de',
    'y',
    'en',
    'es',
    'por',
    'con',
    'para',
    'una',
    'pero',
    'muy',
    'qué',
    'está',
    'mis',
    'del',
    'vamos',
  ],
  fr: [
    'le',
    'la',
    'les',
    'et',
    'est',
    'que',
    'des',
    'une',
    'pas',
    'je',
    'vous',
    'nous',
    'dans',
    'pour',
    'avec',
    'mais',
    "c'est",
    'du',
    'sur',
  ],
  de: [
    'der',
    'die',
    'das',
    'und',
    'ist',
    'nicht',
    'ich',
    'sie',
    'mit',
    'ein',
    'eine',
    'auf',
    'den',
    'zu',
    'auch',
    'wir',
    'ja',
    'was',
    'aber',
  ],
  it: ['il', 'di', 'che', 'e', 'la', 'non', 'per', 'una', 'sono', 'mi', 'con', 'questo', 'ma', 'gli', 'della', 'anche', 'come', 'cosa'],
  pt: ['o', 'a', 'que', 'de', 'não', 'é', 'um', 'uma', 'com', 'para', 'os', 'eu', 'você', 'mas', 'muito', 'isso', 'está', 'do', 'da'],
  nl: ['de', 'het', 'een', 'en', 'van', 'is', 'niet', 'dat', 'ik', 'je', 'met', 'op', 'voor', 'maar', 'zijn', 'wat', 'er'],
  sv: ['och', 'att', 'det', 'är', 'som', 'en', 'på', 'jag', 'inte', 'med', 'för', 'har', 'du', 'vi', 'den', 'av'],
  pl: ['nie', 'się', 'i', 'w', 'na', 'to', 'jest', 'że', 'z', 'do', 'jak', 'co', 'ale', 'tak', 'jestem', 'mnie'],
  tr: ['bir', 've', 'bu', 'da', 'de', 'ne', 'için', 'çok', 'ben', 'sen', 'mi', 'var', 'değil', 'ama', 'gibi'],
  id: ['yang', 'dan', 'di', 'ini', 'itu', 'tidak', 'saya', 'dengan', 'untuk', 'ada', 'ke', 'apa', 'kamu', 'akan'],
  vi: ['và', 'là', 'của', 'không', 'có', 'một', 'tôi', 'những', 'được', 'người', 'này', 'cho', 'với', 'bạn'],
};

export function guessLanguage(text: string): string | null {
  const sample = text.slice(0, 3000);
  for (const [re, lang] of SCRIPTS) if (re.test(sample)) return lang;
  if (/[\u0600-\u06ff]/.test(sample)) return /[پچژگ]/.test(sample) ? 'fa' : 'ar';
  if (/[\u0400-\u04ff]/.test(sample)) return /[іїєґ]/i.test(sample) ? 'uk' : 'ru';
  if (/[\u4e00-\u9fff]/.test(sample)) return 'zh-CN';
  const words = sample.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  if (words.length < 2) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const [lang, list] of Object.entries(STOPWORDS)) {
    const set = new Set(list);
    const score = words.filter((w) => set.has(w)).length / words.length;
    if (score > bestScore) {
      bestScore = score;
      best = lang;
    }
  }
  // Characters that settle close calls between related languages.
  if (/[ñ¿¡]/.test(sample)) return 'es';
  if (/[ãõ]/.test(sample) && (best === 'es' || best === 'pt')) return 'pt';
  if (/ß/.test(sample)) return 'de';
  return bestScore >= 0.08 ? best : null;
}
