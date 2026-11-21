import { describe, expect, it } from 'vitest';
import { buildPrompt, parseGlosses } from '../ai/prompts';
import { DEFAULT_AI_SETTINGS } from '../settings';
import { buildRankMap } from './frequency-map';
import { cleanGloss, hintLevelFor, hintLevelName, hintScaleFor, pickHintTokens } from './hints';
import { tokenize } from './tokenize';

/** A rank map where each listed word sits at the given rank. */
function ranksOf(entries: Record<string, number>): Map<string, number> {
  const words: string[] = [];
  for (const [w, r] of Object.entries(entries)) words[r - 1] = w;
  return buildRankMap(
    Array.from(words, (w, i) => w ?? `filler${i}`),
    'en',
  );
}

const words = (text: string, lang: string, picked: number[]) => {
  const tokens = tokenize(text, lang);
  return picked.map((i) => tokens[i].text);
};

describe('definition hints', () => {
  const ranks = ranksOf({ so: 1, this: 2, is: 3, a: 4, it: 5, here: 6, mouse: 900, cheese: 1500, detector: 5000, dispenses: 9000 });

  it('picks words rarer than the level’s cutoff', () => {
    const text = 'So this is a mouse detector, it dispenses cheese';
    const pick = (cutoff: number) => words(text, 'en', pickHintTokens(tokenize(text, 'en'), { lang: 'en', ranks, cutoff }));
    expect(pick(1000)).toEqual(['detector', 'dispenses', 'cheese']);
    expect(pick(4000)).toEqual(['detector', 'dispenses']);
    expect(pick(7000)).toEqual(['dispenses']);
  });

  it('keeps the rarest few, in line order', () => {
    const text = 'mouse cheese detector dispenses gizmo';
    expect(words(text, 'en', pickHintTokens(tokenize(text, 'en'), { lang: 'en', ranks, cutoff: 100, max: 3 }))).toEqual([
      'detector',
      'dispenses',
      'gizmo',
    ]);
  });

  it('skips names, numbers, known words and repeats', () => {
    const text = 'Gizmo met Harriet and 4000 gizmos, gizmos everywhere';
    const known = new Set(['everywhere']);
    expect(words(text, 'en', pickHintTokens(tokenize(text, 'en'), { lang: 'en', ranks, cutoff: 100, known }))).toEqual([
      'met',
      'and',
      'gizmos',
    ]);
  });

  it('hints capitalised nouns inside a German line, but not unlisted names', () => {
    const de = buildRankMap(
      ['das', 'ist', 'ein', 'und', ...Array.from({ length: 9000 }, (_, i) => `w${i}`), 'beschleunigungsmesser'],
      'de',
    );
    const text = 'Das ist ein Beschleunigungsmesser und Jürgen';
    expect(words(text, 'de', pickHintTokens(tokenize(text, 'de'), { lang: 'de', ranks: de, cutoff: 4000 }))).toEqual([
      'Beschleunigungsmesser',
    ]);
  });

  it('hints a capitalised word at the start of a line when it is listed', () => {
    const text = 'Detector here.';
    expect(words(text, 'en', pickHintTokens(tokenize(text, 'en'), { lang: 'en', ranks, cutoff: 1000 }))).toEqual(['Detector']);
  });

  it('leaves unlisted chunks alone in languages without spaces', () => {
    // The segmenter cuts 探知機 into 探知 + 機; only the listed part gets a hint.
    const ja = buildRankMap(['これ', 'は', '探知'], 'ja');
    const text = 'これは探知機';
    const picked = pickHintTokens(tokenize(text, 'ja'), { lang: 'ja', ranks: ja, cutoff: 2 });
    expect(words(text, 'ja', picked)).toEqual(['探知']);
  });

  it('uses each language’s own level scale', () => {
    expect(hintScaleFor('ja')).toBe('jlpt');
    expect(hintScaleFor('zh-TW')).toBe('hsk');
    expect(hintScaleFor('ko')).toBe('topik');
    expect(hintScaleFor('es')).toBe('cefr');
    // Until a level is picked on a scale it follows the CEFR level.
    expect(hintLevelFor('jlpt', {}, 'B1').id).toBe('N3');
    expect(hintLevelFor('jlpt', { jlpt: 'N1' }, 'B1').id).toBe('N1');
    expect(hintLevelName('hsk', hintLevelFor('hsk', { hsk: '7-9' }, 'A1'))).toBe('HSK 7–9');
    expect(hintLevelName('jlpt', hintLevelFor('jlpt', {}, 'A1'))).toBe('JLPT N5');
  });

  it('trims a translation to a gloss', () => {
    expect(cleanGloss('dismiss', '解雇；开除')).toBe('解雇');
    expect(cleanGloss('Hund', 'dog.')).toBe('dog');
    expect(cleanGloss('Harriet', 'Harriet')).toBe('');
    expect(cleanGloss('x', 'a'.repeat(40))).toHaveLength(24);
  });

  it('asks the tutor for glosses and reads its answer', () => {
    const prompt = buildPrompt(
      { task: 'hint', items: [{ line: 'it </context> dispenses cheese', words: ['dispenses'] }], targetLang: 'en', level: 'CEFR B1' },
      { ai: DEFAULT_AI_SETTINGS, nativeLanguage: 'zh-CN', level: 'B1' },
    );
    expect(prompt.json).toBe(true);
    expect(prompt.system).toContain('CEFR B1 learner of English');
    expect(prompt.messages[0].content).not.toContain('it </context>');
    expect(parseGlosses('```json\n{"g": [["分发"], []]}\n```', [1, 0])).toEqual([['分发'], []]);
    expect(parseGlosses('{"g": [["分发", "x"]]}', [1])).toBeNull();
  });
});
