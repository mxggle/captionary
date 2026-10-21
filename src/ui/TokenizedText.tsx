import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
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
  /** Dictionary form, when the selection is the chunk the tutor suggested (see `PopupTarget.base`). */
  base?: string;
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
  /** Over a video Space plays and pauses, so only Enter looks a word up. */
  spaceIsPlayback?: boolean;
}

function unionRect(a: DOMRect, b: DOMRect): AnchorRect {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  return { left, top, width: Math.max(a.right, b.right) - left, height: Math.max(a.bottom, b.bottom) - top };
}

const STATUS_CLASS = { learning: 'is-learn', known: 'is-known' } as const;

/**
 * Subtitle/sentence text split into clickable words. Click a word to look it up;
 * press on one word and drag to another, or Shift+click a second word, to select a phrase.
 * From the keyboard the line is one tab stop: arrow keys move between words, Enter or Space looks one up,
 * and Shift+Enter grows the last selection to the focused word.
 * Saved words and phrases are marked by learning status (a dotted underline; see `cap-w` in components.css).
 */
export const TokenizedText = memo(function TokenizedText({
  text,
  lang,
  index,
  highlight,
  onSelect,
  className,
  freq,
  selected,
  spaceIsPlayback,
}: Props) {
  const { m } = useI18n();
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
  // The last selection in this line, which Shift+click extends. A ref outlives the look-up: the same
  // press closes it (and clears `selected`) before reaching the word.
  const lastSelection = useRef<{ text: string; range: [number, number] } | null>(null);
  useEffect(() => {
    if (selected) lastSelection.current = { text, range: selected };
  }, [text, selected?.[0], selected?.[1]]);

  const commit = (start: number, end: number) => {
    if (!onSelect) return;
    const a = Math.min(start, end);
    const b = Math.max(start, end);
    const first = spans.current.get(a);
    const last = spans.current.get(b);
    if (!first || !last) return;
    const selected = text.slice(tokens[a].index, tokens[b].index + tokens[b].text.length);
    const words = tokens.slice(a, b + 1).filter((t) => t.word).length;
    lastSelection.current = { text, range: [a, b] };
    onSelect({
      text: selected,
      words,
      rect: unionRect(first.getBoundingClientRect(), last.getBoundingClientRect()),
      range: [a, b],
    });
  };
  // Where a selection starts: the word itself, or (Shift) the far end of the last selection in this line.
  const anchorFor = (i: number, extend: boolean) => {
    const prev = extend && lastSelection.current?.text === text ? lastSelection.current.range : null;
    return prev ? (i < prev[0] ? prev[1] : prev[0]) : i;
  };

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const finish = () => {
      const d = dragRef.current;
      setDrag(null);
      if (d) commit(d.start, d.end);
    };
    window.addEventListener('pointerup', finish, { once: true });
    return () => window.removeEventListener('pointerup', finish);
  }, [dragging]);

  // The word that holds the line's one tab stop (roving tabindex).
  const [cursor, setCursor] = useState(-1);
  const wordIndexes = useMemo(() => tokens.flatMap((t, i) => (t.word ? [i] : [])), [tokens]);
  const tabStop = wordIndexes.includes(cursor) ? cursor : (wordIndexes[0] ?? -1);
  const rtl = isRtl(lang);
  const onWordKey = (e: React.KeyboardEvent, i: number) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let next = -1;
    const at = wordIndexes.indexOf(i);
    if (e.key === 'Enter' || (e.key === ' ' && !spaceIsPlayback)) {
      e.preventDefault();
      e.stopPropagation();
      commit(anchorFor(i, e.shiftKey), i);
      return;
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const forward = (e.key === 'ArrowRight') !== rtl;
      next = wordIndexes[at + (forward ? 1 : -1)] ?? -1;
    } else if (e.key === 'Home') next = wordIndexes[0];
    else if (e.key === 'End') next = wordIndexes[wordIndexes.length - 1];
    else return;
    // Arrow keys stay in the line rather than seeking the video or scrolling the page.
    e.preventDefault();
    e.stopPropagation();
    if (next < 0) return;
    setCursor(next);
    spans.current.get(next)?.focus();
  };

  const lo = drag ? Math.min(drag.start, drag.end) : (selected?.[0] ?? -1);
  const hi = drag ? Math.max(drag.start, drag.end) : (selected?.[1] ?? -1);

  return (
    <span className={className} dir={rtl ? 'rtl' : undefined} lang={lang}>
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
            title={freqCls ? (rank ? m.lookup.freqRankTitle(rank.toLocaleString()) : m.lookup.rareWordTitle) : undefined}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? (i === tabStop ? 0 : -1) : undefined}
            onFocus={onSelect ? () => setCursor(i) : undefined}
            onKeyDown={onSelect ? (e) => onWordKey(e, i) : undefined}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              // Shift+click grows the last selection in this line to take in this word (a word inside it trims it back).
              setDrag({ start: anchorFor(i, e.shiftKey), end: i });
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
