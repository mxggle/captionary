import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { isRtl } from '@/lib/languages';
import type { WordStatusHighlight } from '@/lib/settings';
import { frequencyClass, frequencyRank } from '@/lib/text/frequency-map';
import { findPhrases, normalizeWord, tokenize } from '@/lib/text/tokenize';
import type { VocabStatus } from '@/lib/vocab';
import type { AnchorRect } from '@/content/store';
import type { VocabIndex } from './vocab-index';

export interface WordSelection {
  text: string;
  /** Number of word tokens selected. */
  words: number;
  rect: AnchorRect;
  /** First and last token index of the selection, to keep it marked while its look-up is open. */
  range: [number, number];
}

interface Props {
  text: string;
  lang: string;
  index: VocabIndex;
  highlight: WordStatusHighlight;
  onSelect?: (sel: WordSelection) => void;
  className?: string;
  /** Frequency ranks; when set, rarer words are underlined by band. */
  freq?: Map<string, number> | null;
  /** Token range whose look-up is open. */
  selected?: [number, number] | null;
}

function unionRect(a: DOMRect, b: DOMRect): AnchorRect {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  return { left, top, width: Math.max(a.right, b.right) - left, height: Math.max(a.bottom, b.bottom) - top };
}

const STATUS_CLASS = { learning: 'is-learn', known: 'is-known' } as const;

/**
 * Subtitle/sentence text split into clickable words. Click a word to look it up;
 * press on one word and drag to another to select a phrase. Saved words and phrases
 * are marked by learning status (a dotted underline; see `cap-w` in components.css).
 */
export const TokenizedText = memo(function TokenizedText({ text, lang, index, highlight, onSelect, className, freq, selected }: Props) {
  const tokens = useMemo(() => tokenize(text, lang), [text, lang]);
  const phraseOf = useMemo(() => {
    const map = new Map<number, VocabStatus>();
    if (highlight === 'none') return map;
    for (const m of findPhrases(tokens, lang, index.phrases)) {
      const status = index.phraseStatus.get(m.key);
      if (!status || (highlight === 'learning' && status !== 'learning')) continue;
      for (let i = m.start; i <= m.end; i++) map.set(i, status);
    }
    return map;
  }, [tokens, lang, index, highlight]);

  const [drag, setDrag] = useState<{ start: number; end: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const spans = useRef(new Map<number, HTMLSpanElement>());

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const finish = () => {
      const d = dragRef.current;
      setDrag(null);
      if (!d || !onSelect) return;
      const a = Math.min(d.start, d.end);
      const b = Math.max(d.start, d.end);
      const first = spans.current.get(a);
      const last = spans.current.get(b);
      if (!first || !last) return;
      const selected = text.slice(tokens[a].index, tokens[b].index + tokens[b].text.length);
      const words = tokens.slice(a, b + 1).filter((t) => t.word).length;
      onSelect({
        text: selected,
        words,
        rect: unionRect(first.getBoundingClientRect(), last.getBoundingClientRect()),
        range: [a, b],
      });
    };
    window.addEventListener('pointerup', finish, { once: true });
    return () => window.removeEventListener('pointerup', finish);
  }, [dragging]);

  const lo = drag ? Math.min(drag.start, drag.end) : (selected?.[0] ?? -1);
  const hi = drag ? Math.max(drag.start, drag.end) : (selected?.[1] ?? -1);

  return (
    <span className={className} dir={isRtl(lang) ? 'rtl' : undefined} lang={lang}>
      {tokens.map((t, i) => {
        const inPhrase = phraseOf.get(i);
        if (!t.word) {
          const between = inPhrase && phraseOf.get(i - 1) && phraseOf.get(i + 1);
          const gapCls = [between ? `cap-gap ${STATUS_CLASS[inPhrase]}` : '', i > lo && i < hi ? 'cap-gap is-selected' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <span key={i} className={gapCls || undefined}>
              {t.text}
            </span>
          );
        }
        const key = normalizeWord(t.text, lang);
        const wordStatus = index.words.get(key);
        const status =
          inPhrase ?? (highlight === 'none' ? undefined : highlight === 'learning' && wordStatus !== 'learning' ? undefined : wordStatus);
        // Rarity underline, unless the learner already tracks this word.
        const flaggable = !!freq && !wordStatus && !inPhrase && !/^\p{N}+$/u.test(key);
        const rank = flaggable ? frequencyRank(freq, key) : undefined;
        const freqCls = flaggable ? frequencyClass(rank) : '';
        const cls = ['cap-w', status ? STATUS_CLASS[status] : freqCls, i >= lo && i <= hi ? 'is-selected' : ''].filter(Boolean).join(' ');
        return (
          <span
            key={i}
            ref={(el) => {
              if (el) spans.current.set(i, el);
              else spans.current.delete(i);
            }}
            className={cls}
            title={freqCls ? (rank ? `Frequency rank #${rank.toLocaleString()}` : 'Rare word') : undefined}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              setDrag({ start: i, end: i });
            }}
            onPointerEnter={() => {
              if (dragRef.current) setDrag({ ...dragRef.current, end: i });
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {t.text}
          </span>
        );
      })}
    </span>
  );
});
