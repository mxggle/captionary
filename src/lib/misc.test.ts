import { describe, expect, it } from 'vitest';
import { htmlToText, parseWiktionary } from './dictionary';
import { normalizeLang, sameLang } from './languages';
import { guessLanguage } from './text/detect';
import { DEFAULT_SETTINGS, mergeDefaults } from './settings';
import { sourceUrl, toAnkiTsv, toCsv, vocabKey, type VocabItem } from './vocab';

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
  it('keys phrases by their words only', () => {
    expect(vocabKey('Well, then!', 'en')).toMatchObject({ kind: 'phrase', key: 'well then', id: 'en|well then' });
    expect(vocabKey('Gato', 'es')).toMatchObject({ kind: 'word', key: 'gato' });
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
