import { describe, expect, it } from 'vitest';
import { htmlToText, parseWiktionary } from './dictionary';
import { formatAIError, getMessages, resolveUILocale } from './i18n';
import { languageName, normalizeLang, sameLang } from './languages';
import { keyLabel } from '@/ui/controls';
import { guessLanguage } from './text/detect';
import { DEFAULT_SETTINGS, mergeDefaults } from './settings';
import { buildVocabIndex } from '@/ui/vocab-index';
import { findPhrases, tokenize } from './text/tokenize';
import { findVocab, saveVocab, sourceUrl, toAnkiTsv, toCsv, vocabKey, type VocabItem } from './vocab';

const item: VocabItem = {
  id: 'es|gato',
  lang: 'es',
  text: 'gato',
  key: 'gato',
  kind: 'word',
  status: 'learning',
  translation: 'cat, "kitty"',
  notes: 'masc.\nnoun',
  context: {
    sentence: 'El gato duerme.',
    translation: 'The cat sleeps.',
    title: 'Cats',
    url: 'https://www.youtube.com/watch?v=abc',
    time: 83.4,
    site: 'youtube',
  },
  createdAt: 0,
  updatedAt: 0,
};

describe('vocab export', () => {
  it('escapes CSV cells', () => {
    const csv = toCsv([item]);
    expect(csv.split('\r\n')[1]).toContain('"cat, ""kitty"""');
    expect(csv).toContain('"masc.\nnoun"');
  });
  it('builds Anki rows with the word highlighted in context', () => {
    const tsv = toAnkiTsv([item]);
    const row = tsv.split('\n')[3].split('\t');
    expect(row[0]).toContain('El <b>gato</b> duerme.');
    expect(row[1]).toContain('masc.<br>noun');
    expect(row[2]).toBe('captionary es learning');
  });
  it('links back to the moment in the video', () => {
    expect(sourceUrl(item)).toBe('https://www.youtube.com/watch?v=abc&t=83s');
  });
  it('highlights another form of the entry in its context', () => {
    const held = { ...item, text: 'hold up', forms: ['holds up'], context: { sentence: 'I hope it holds up.' } };
    expect(toAnkiTsv([held]).split('\n')[3]).toContain('I hope it <b>holds up</b>.');
  });
  it('keys phrases by their words only', () => {
    expect(vocabKey('Well, then!', 'en')).toMatchObject({ kind: 'phrase', key: 'well then', id: 'en|well then' });
    expect(vocabKey('Gato', 'es')).toMatchObject({ kind: 'word', key: 'gato' });
  });
});

describe('vocab forms', () => {
  it('saves a phrase under its dictionary form and keeps the form met in text', async () => {
    const saved = await saveVocab({ lang: 'en', text: 'hold up', form: 'holds up', status: 'learning' });
    expect(saved).toMatchObject({ id: 'en|hold up', text: 'hold up', kind: 'phrase', forms: ['holds up'] });
    const again = await saveVocab({ lang: 'en', text: 'hold up', form: 'Holds up', status: 'known' });
    expect(again.forms).toEqual(['holds up']);
    const plain = await saveVocab({ lang: 'en', text: 'give up', form: 'give up' });
    expect(plain.forms).toBeUndefined();

    const vocab = { [saved.id]: again };
    expect(findVocab(vocab, 'hold up', 'en')?.id).toBe('en|hold up');
    expect(findVocab(vocab, 'holds  UP', 'en')?.id).toBe('en|hold up');
    expect(findVocab(vocab, 'held up', 'en')).toBeUndefined();

    const index = buildVocabIndex(vocab, 'en');
    const tokens = tokenize('I hope the weather holds up.', 'en');
    expect(findPhrases(tokens, 'en', index.phrases).map((m) => m.key)).toEqual(['holds up']);
    expect(index.phraseStatus.get('holds up')).toBe('known');
  });
});

describe('dictionary', () => {
  it('converts Wiktionary HTML to text', () => {
    expect(htmlToText('<a href="x">cat</a> &amp; <i>kitten</i>&#39;s')).toBe("cat & kitten's");
    expect(htmlToText('<style>.mw-parser-output .defdate{font-size:smaller}</style>truth')).toBe('truth');
  });
  it('picks the requested language', () => {
    const entries = parseWiktionary(
      {
        es: [
          {
            partOfSpeech: 'Noun',
            language: 'Spanish',
            definitions: [{ definition: '<b>cat</b>', examples: ['<i>el gato</i>'] }, { definition: '' }],
          },
        ],
        en: [{ partOfSpeech: 'Noun', language: 'English', definitions: [{ definition: 'other' }] }],
      },
      'es',
    );
    expect(entries).toEqual([{ partOfSpeech: 'Noun', senses: [{ definition: 'cat', examples: ['el gato'] }] }]);
  });
});

describe('languages', () => {
  it('normalizes platform codes', () => {
    expect(normalizeLang('en-US')).toBe('en');
    expect(normalizeLang('zh-Hant')).toBe('zh-TW');
    expect(normalizeLang('zh')).toBe('zh-CN');
    expect(normalizeLang('iw')).toBe('he');
    expect(sameLang('pt-BR', 'pt')).toBe(true);
    expect(sameLang('zh-CN', 'zh-TW')).toBe(false);
  });
  it('returns English language names by default and localized names when uiLocale is given', () => {
    expect(languageName('es')).toBe('Spanish');
    expect(languageName('es', 'en')).toBe('Spanish');
    expect(languageName('es', 'zh-CN')).toBe('西班牙语');
    expect(languageName('es', 'zh-TW')).toBe('西班牙文');
    expect(languageName('es', 'ja')).toBe('スペイン語');
  });
});

describe('i18n', () => {
  it('resolves UI locale from explicit setting, nativeLanguage, or fallback', () => {
    expect(resolveUILocale({ uiLanguage: 'ja', nativeLanguage: 'en' })).toBe('ja');
    expect(resolveUILocale({ uiLanguage: 'auto', nativeLanguage: 'zh-CN' })).toBe('zh-CN');
    expect(resolveUILocale({ uiLanguage: 'auto', nativeLanguage: 'zh-Hant-HK' })).toBe('zh-TW');
    expect(resolveUILocale({ uiLanguage: 'auto', nativeLanguage: 'ja-JP' })).toBe('ja');
    expect(resolveUILocale({ uiLanguage: 'auto', nativeLanguage: 'es' })).toBe('en');
  });

  it('normalizes script and region variants in uiLanguage settings', () => {
    expect(resolveUILocale({ uiLanguage: 'zh-Hans' as any })).toBe('zh-CN');
    expect(resolveUILocale({ uiLanguage: 'zh-Hant' as any })).toBe('zh-TW');
    expect(resolveUILocale({ uiLanguage: 'zh-HK' as any })).toBe('zh-TW');
    expect(resolveUILocale({ uiLanguage: 'ja-JP' as any })).toBe('ja');
    expect(resolveUILocale({ uiLanguage: 'en-US' as any })).toBe('en');
  });

  it('provides complete and structural matched message catalogs across en, zh-CN, zh-TW, ja', () => {
    const enCat = getMessages('en');
    const zhCNCat = getMessages('zh-CN');
    const zhTWCat = getMessages('zh-TW');
    const jaCat = getMessages('ja');

    function checkCatalogStructure(base: Record<string, any>, target: Record<string, any>, path = '') {
      for (const key of Object.keys(base)) {
        const fullPath = path ? `${path}.${key}` : key;
        expect(target, `Missing key ${fullPath}`).toHaveProperty(key);
        const baseVal = base[key];
        const targetVal = target[key];
        if (typeof baseVal === 'function') {
          expect(typeof targetVal, `${fullPath} should be a function`).toBe('function');
          expect(targetVal.length, `${fullPath} function arity should match`).toBe(baseVal.length);
        } else if (typeof baseVal === 'object' && baseVal !== null) {
          expect(typeof targetVal, `${fullPath} should be an object`).toBe('object');
          checkCatalogStructure(baseVal, targetVal, fullPath);
        } else {
          expect(typeof targetVal, `${fullPath} should be a string`).toBe('string');
        }
      }
    }

    checkCatalogStructure(enCat, zhCNCat, 'zh-CN');
    checkCatalogStructure(enCat, zhTWCat, 'zh-TW');
    checkCatalogStructure(enCat, jaCat, 'ja');
  });

  it('formats AI errors into localized primary messages and diagnostics', () => {
    const mZh = getMessages('zh-CN');
    const mTw = getMessages('zh-TW');
    const mJa = getMessages('ja');

    expect(formatAIError({ code: 'quota' }, mZh).primary).toBe(mZh.runtime.ai.outOfQuota);
    expect(formatAIError({ code: 'rate_limit' }, mTw).primary).toBe(mTw.runtime.ai.rateLimited);
    expect(formatAIError({ code: 'timeout' }, mJa).primary).toBe(mJa.runtime.ai.providerTimeout);

    const badReq = formatAIError({ code: 'bad_request', status: 400, message: 'Invalid model parameter' }, mZh);
    expect(badReq.primary).toBe(mZh.runtime.ai.clientError(400));
    expect(badReq.detail).toBe('Invalid model parameter');

    const unavailable = formatAIError({ code: 'unavailable', status: 503 }, mJa);
    expect(unavailable.primary).toBe(mJa.runtime.ai.providerProblems(503));
  });

  it('renders localized key labels with custom space labels', () => {
    expect(keyLabel(' ')).toBe('Space');
    expect(keyLabel(' ', getMessages('zh-CN').common.space)).toBe('空格');
    expect(keyLabel(' ', getMessages('zh-TW').common.space)).toBe('空白鍵');
    expect(keyLabel(' ', getMessages('ja').common.space)).toBe('スペース');
    expect(keyLabel('a')).toBe('A');
  });
});

describe('mergeDefaults', () => {
  it('fills in fields added after the settings were saved', () => {
    const stored = { enabled: false, subtitles: { fontSize: 30 } };
    const merged = mergeDefaults(DEFAULT_SETTINGS, stored);
    expect(merged.enabled).toBe(false);
    expect(merged.subtitles.fontSize).toBe(30);
    expect(merged.subtitles.showTranslation).toBe(DEFAULT_SETTINGS.subtitles.showTranslation);
    expect(merged.shortcuts.prevLine).toBe('a');
  });
});

describe('guessLanguage', () => {
  it('recognizes scripts and common Latin-script languages', () => {
    expect(guessLanguage('El gato duerme en el sofá. Mañana vamos a la playa con mis amigos.')).toBe('es');
    expect(guessLanguage('The cat is sleeping on the sofa and it is happy.')).toBe('en');
    expect(guessLanguage("Je pense que c'est une bonne idée pour nous.")).toBe('fr');
    expect(guessLanguage('Ich weiß nicht, was das ist.')).toBe('de');
    expect(guessLanguage('私は学生です')).toBe('ja');
    expect(guessLanguage('저는 학생입니다')).toBe('ko');
    expect(guessLanguage('Я не знаю')).toBe('ru');
    expect(guessLanguage('我们一起去')).toBe('zh-CN');
    expect(guessLanguage('xyz')).toBeNull();
  });
});
