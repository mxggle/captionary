import { describe, expect, it } from 'vitest';
import { canRomanize, romanizeCyrillic, romanizeGreek, romanizeKana, romanizeKorean, romanizeLine } from './romanize';
import { romanizeChinese } from './romanize-zh';

describe('Korean', () => {
  it('applies liaison and nasal assimilation', () => {
    expect(romanizeKorean('안녕하세요')).toBe('annyeonghaseyo');
    expect(romanizeKorean('한국어')).toBe('hangugeo');
    expect(romanizeKorean('감사합니다')).toBe('gamsahamnida');
    expect(romanizeKorean('신라')).toBe('silla');
    expect(romanizeKorean('사랑해요!')).toBe('saranghaeyo!');
  });
});

describe('Japanese kana', () => {
  it('handles digraphs, small tsu, long vowels and n', () => {
    expect(romanizeKana('きょうと')).toBe('kyouto');
    expect(romanizeKana('ちょっと')).toBe('chotto');
    expect(romanizeKana('がっこう')).toBe('gakkou');
    expect(romanizeKana('コーヒー')).toBe('kōhī');
    expect(romanizeKana('しんいち')).toBe("shin'ichi");
    expect(romanizeKana('ファイル')).toBe('fairu');
  });
  it('keeps kanji and spaces words in a line', () => {
    expect(romanizeLine('ありがとうございます', 'ja')).toBe('arigatougozaimasu');
    expect(romanizeLine('私は学生です。', 'ja')).toBe('私 ha 学生 desu.');
    expect(romanizeLine('この番組はスタンフォード大学', 'ja')).toBe('kono 番組 ha sutanfōdo 大学');
    expect(romanizeLine('漢字', 'ja')).toBe('');
  });
});

describe('Cyrillic and Greek', () => {
  it('romanizes Russian with case', () => {
    expect(romanizeCyrillic('Привет, как дела?', 'ru')).toBe('Privet, kak dela?');
    expect(romanizeCyrillic('Щука', 'ru')).toBe('Shchuka');
  });
  it('uses language-specific letters', () => {
    expect(romanizeCyrillic('Київ', 'uk')).toBe('Kyyiv');
    expect(romanizeCyrillic('Здравей', 'bg')).toBe('Zdravey');
  });
  it('romanizes Greek with digraphs and accents', () => {
    expect(romanizeGreek('Καλημέρα')).toBe('Kalimera');
    expect(romanizeGreek('Ευχαριστώ πολύ')).toBe('Evcharisto poly');
  });
});

describe('Chinese', () => {
  it('reads polyphones in context and groups words', () => {
    expect(romanizeChinese('我们去银行吧。')).toBe('wǒmen qù yínháng ba.');
    expect(romanizeChinese('他长大了')).toContain('zhǎngdà');
    expect(romanizeChinese('Hello')).toBe('');
  });
});

describe('support', () => {
  it('knows which languages can be romanized', () => {
    expect(canRomanize('zh-TW')).toBe(true);
    expect(canRomanize('ko')).toBe(true);
    expect(canRomanize('es')).toBe(false);
    expect(romanizeLine('Hola', 'es')).toBe('');
  });
});
