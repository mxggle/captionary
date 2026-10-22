import { describe, expect, it } from 'vitest';
import { selectionKind } from './selection-kind';

describe('selectionKind', () => {
  it('keeps words and short phrases as words', () => {
    expect(selectionKind('serendipity', 'en')).toBe('word');
    expect(selectionKind('give up on', 'en')).toBe('word');
    expect(selectionKind('Wow!', 'en')).toBe('word');
  });

  it('treats longer selections as sentences', () => {
    expect(selectionKind('I gave up on it last year', 'en')).toBe('sentence');
    expect(selectionKind('Stop it!', 'en')).toBe('sentence');
  });

  it('counts words in languages written without spaces', () => {
    expect(selectionKind('我们明天去北京', 'zh-CN')).toBe('sentence');
    expect(selectionKind('今日はいい天気ですね', 'ja')).toBe('sentence');
    expect(selectionKind('我想吃饭。', 'zh-CN')).toBe('sentence');
    expect(selectionKind('一石二鸟', 'zh-CN')).toBe('word');
    expect(selectionKind('日本語能力試験', 'ja')).toBe('word');
  });

  it('keeps an inflected Japanese verb as one word', () => {
    expect(selectionKind('食べさせられなかった', 'ja')).toBe('word');
    expect(selectionKind('お願いします', 'ja')).toBe('word');
  });
});
