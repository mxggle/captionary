import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { extractTranslation, parseWordExplanation, wordExplanationMarkdown, type WordChunk } from '@/lib/ai/prompts';
import type { AIJob, ChatTurn } from '@/lib/ai/types';
import { externalDictionaries, type DictionaryResult } from '@/lib/dictionary';
import { bg, streamJob, type AIStatus } from '@/lib/messaging';
import type { Settings } from '@/lib/settings';
import { canRomanize } from '@/lib/text/romanize';
import { locateChunk, tokenize } from '@/lib/text/tokenize';
import { chromeTranslatorState, translateWithChrome } from '@/lib/translate';
import { findVocab, vocabKey, type VocabItem, type VocabStatus } from '@/lib/vocab';
import type { PopupTarget } from '@/content/store';
import { useAIStream } from './useAIStream';

export interface ChatEntry {
  q: string;
  a: string;
  status: 'streaming' | 'done' | 'error';
  error?: string;
}

export interface LookupInput {
  target: PopupTarget;
  settings: Settings;
  aiStatus: AIStatus | null;
  vocab: Record<string, VocabItem>;
  mediaTitle?: string;
  /** Frequency rank of the word, when known. */
  rank?: number;
  /** Start the tutor without waiting for Explain; defaults to sentences, and to words with "Explain words automatically". */
  autoExplain?: boolean;
  /** Save the entry with this status, or remove it (null). */
  onSave: (status: VocabStatus | null, entry: SaveEntry) => void;
}

/** What a look-up saves or removes. */
export interface SaveEntry {
  /** The entry: the saved item's own text, else the dictionary form the tutor gave, else the selection. */
  text: string;
  /** The selection as written, kept as another form of the entry when they differ. */
  form: string;
  translation?: string;
  notes?: string;
}

/** A larger chunk of the line, named by the tutor, to look up instead of the selection. */
export interface ChunkSuggestion {
  /** The chunk as written in the line. */
  text: string;
  /** Its dictionary form, which saving files it under. */
  base: string;
  /** What it means, in the explanation language. */
  meaning: string;
  /** Its first and last token in the line. */
  range: [number, number];
  words: number;
}

/** The tutor's chunk as a selection in the target's line, when it is there and larger than the selection. */
export function chunkSuggestion(target: PopupTarget, chunk: WordChunk): ChunkSuggestion | null {
  const { sentence, lang } = target;
  if (!sentence) return null;
  const tokens = tokenize(sentence, lang);
  const slice = ([a, b]: [number, number]) =>
    tokens[a] && tokens[b] ? sentence.slice(tokens[a].index, tokens[b].index + tokens[b].text.length) : '';
  const own = target.tokenRange && slice(target.tokenRange) === target.text ? target.tokenRange : locateChunk(tokens, target.text, lang);
  const range = own && locateChunk(tokens, chunk.text, lang, own);
  if (!range) return null;
  const text = slice(range);
  const words = tokens.slice(range[0], range[1] + 1).filter((t) => t.word).length;
  return { text, base: chunk.base ?? text, meaning: chunk.meaning, range, words };
}

/**
 * Whether the tutor starts without waiting for Explain: for sentences, for words with "Explain words
 * automatically", and for a chunk the learner followed from an explanation.
 */
export function explainsAtOnce(target: PopupTarget, aiStatus: AIStatus | null): boolean {
  return target.kind !== 'word' || !!aiStatus?.autoExplain || target.base !== undefined;
}

/** Rarity of a word as the legend names it; undefined for the 2,000 most common words. */
export function rankBand(rank: number | undefined, known: boolean): string | undefined {
  if (!known) return undefined;
  if (rank === undefined) return 'rarer';
  if (rank <= 2000) return undefined;
  if (rank <= 8000) return '2k–8k';
  if (rank <= 20000) return '8k–20k';
  return 'rarer';
}

/**
 * Everything a look-up card needs, independent of how it is drawn: on-device translation,
 * romanization, the dictionary entry, the tutor's answer and follow-up chat, and saving.
 */
export function useLookup({ target, settings, aiStatus, vocab, mediaTitle, autoExplain, onSave }: LookupInput) {
  const isWord = target.kind === 'word';
  const native = settings.nativeLanguage;
  const identity = useMemo(() => vocabKey(target.text, target.lang), [target.text, target.lang]);
  // Saved under the dictionary form the tutor gave, or under the selection or with it as another form.
  const saved = useMemo(
    () => (target.base !== undefined && findVocab(vocab, target.base, target.lang)) || findVocab(vocab, target.text, target.lang),
    [vocab, target.base, target.text, target.lang],
  );

  // ---- quick on-device translation ----
  const [quick, setQuick] = useState<string | null>(null);
  useEffect(() => {
    setQuick(null);
    if (!settings.dictionary.quickTranslate || !target.lang || target.lang === native) return;
    let alive = true;
    void (async () => {
      const state = await chromeTranslatorState(target.lang, native);
      if (state === 'unsupported' || state === 'unavailable') return;
      try {
        const out = await translateWithChrome(target.text, target.lang, native);
        if (alive) setQuick(out);
      } catch {
        // on-device translation is optional
      }
    })();
    return () => {
      alive = false;
    };
  }, [target.text, target.lang, native, settings.dictionary.quickTranslate]);

  // ---- romanization (pinyin, romaji…) ----
  const [romanized, setRomanized] = useState('');
  useEffect(() => {
    setRomanized('');
    if (!settings.subtitles.showRomanization || !canRomanize(target.lang)) return;
    let alive = true;
    bg({ type: 'text.romanize', lang: target.lang, lines: [target.text] })
      .then(([r]) => alive && setRomanized(r ?? ''))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [target.text, target.lang, settings.subtitles.showRomanization]);

  // ---- dictionary ----
  const [dict, setDict] = useState<DictionaryResult | null>(null);
  const [dictState, setDictState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  useEffect(() => {
    setDict(null);
    setDictState('idle');
    if (!isWord || !settings.dictionary.wiktionary) return;
    let alive = true;
    setDictState('loading');
    bg({ type: 'dict.lookup', word: target.text, lang: target.lang })
      .then((d) => alive && (setDict(d), setDictState('done')))
      .catch(() => alive && setDictState('error'));
    return () => {
      alive = false;
    };
  }, [isWord, target.text, target.lang, settings.dictionary.wiktionary]);

  // ---- the tutor ----
  const ai = useAIStream();
  const job = useMemo<AIJob>(
    () =>
      isWord
        ? {
            task: 'word',
            text: target.text,
            sentence: target.sentence,
            before: target.before,
            after: target.after,
            sentenceTranslation: target.translation,
            targetLang: target.lang,
            mediaTitle,
          }
        : {
            task: 'sentence',
            sentence: target.text,
            before: target.before,
            after: target.after,
            sentenceTranslation: target.translation,
            targetLang: target.lang,
            mediaTitle,
          },
    [isWord, target, mediaTitle],
  );
  const aiReady = !!aiStatus?.enabled && !!aiStatus.configured;
  // Word explanations start on their own only when the learner opted in (each is a paid request).
  const autoStart = aiReady && (autoExplain ?? explainsAtOnce(target, aiStatus));
  const { start: startAI, reset: resetAI } = ai;
  useEffect(() => {
    resetAI();
    setTurns([]);
    if (autoStart) startAI(job);
  }, [job, autoStart, startAI, resetAI]);
  const explain = useCallback(() => {
    if (aiReady) startAI(job);
  }, [aiReady, startAI, job]);

  // ---- the tutor's answer, split into its sections ----
  const answering = ai.status === 'streaming' || ai.status === 'done';
  const explanation = useMemo(
    () => (isWord && answering ? parseWordExplanation(ai.text, ai.status === 'streaming') : null),
    [isWord, answering, ai.text, ai.status],
  );
  // The equivalent of the sense used here, as soon as its line has arrived; answers from a custom
  // prompt without the section markers still have their "Translation:" line read once complete.
  const aiTranslation = explanation?.gloss ?? (isWord && ai.status === 'done' && !explanation ? extractTranslation(ai.text) : undefined);
  /** The answer as Markdown, without the section markers. */
  const answerText = explanation ? wordExplanationMarkdown(explanation, true) : ai.text;
  const chunk = explanation?.chunk;
  const suggestion = useMemo(
    () => (isWord && chunk ? chunkSuggestion(target, chunk) : null),
    // The answer is parsed again with each streamed piece; the chunk's fields are what matter.
    [isWord, target, chunk?.text, chunk?.base, chunk?.meaning],
  );

  // ---- follow-up chat ----
  const [turns, setTurns] = useState<ChatEntry[]>([]);
  const chatCancel = useRef<(() => void) | null>(null);
  useEffect(() => () => chatCancel.current?.(), []);
  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const history: ChatTurn[] = [];
    if (ai.text) history.push({ role: 'assistant', content: answerText });
    for (const t of turns) {
      if (t.status !== 'done') continue;
      history.push({ role: 'user', content: t.q }, { role: 'assistant', content: t.a });
    }
    const idx = turns.length;
    setTurns((ts) => [...ts, { q, a: '', status: 'streaming' }]);
    const update = (fn: (t: ChatEntry) => ChatEntry) => setTurns((ts) => ts.map((t, i) => (i === idx ? fn(t) : t)));
    chatCancel.current = streamJob(
      { task: 'chat', subject: target.text, sentence: target.sentence, targetLang: target.lang, history, question: q },
      {
        onDelta: (d) => update((t) => ({ ...t, a: t.a + d })),
        onDone: (r) => update((t) => ({ ...t, a: r.text, status: 'done' })),
        onError: (err) => update((t) => ({ ...t, status: 'error', error: err.message })),
      },
    );
  };

  // ---- saving ----
  // Prefer the tutor's equivalent for the sense in this sentence; otherwise the on-device translation.
  const translationForSave = aiTranslation ?? quick;
  const entry = (extra?: Pick<SaveEntry, 'translation' | 'notes'>): SaveEntry => ({
    text: saved?.text ?? target.base ?? target.text,
    form: target.text,
    ...extra,
  });
  const setStatus = (status: VocabStatus) => {
    if (saved?.status === status) onSave(null, entry());
    else onSave(status, entry({ translation: saved?.translation ?? translationForSave ?? undefined }));
  };
  const saveNotes = () =>
    onSave(
      saved?.status ?? 'learning',
      entry({
        translation: saved?.translation ?? translationForSave ?? undefined,
        notes: explanation ? wordExplanationMarkdown(explanation, false) : ai.text,
      }),
    );

  const firstEntry = dict?.entries[0];
  const pos = firstEntry?.partOfSpeech?.toLowerCase();
  // Wiktionary definitions are English, so they only stand in for a translation into English.
  const definition = native.startsWith('en') ? firstEntry?.senses[0]?.definition : undefined;
  // The tutor's equivalent fits this sentence's sense, so it leads once the learner asks for it.
  const translation = isWord
    ? (explanation?.gloss ?? saved?.translation ?? quick ?? aiTranslation ?? definition)
    : (target.translation ?? quick ?? undefined);

  return {
    isWord,
    native,
    identity,
    saved,
    quick,
    romanized,
    dict,
    dictState,
    ai,
    job,
    aiReady,
    /** The tutor's answer is on its way or shown: the card's content will keep growing. */
    answerShown: aiReady && (ai.status === 'loading' || ai.status === 'streaming' || ai.status === 'done'),
    /** The learner turned the tutor off (as opposed to never setting one up). */
    aiOff: !!aiStatus && !aiStatus.enabled,
    explain,
    /** The word explanation split into meaning, context and examples; null for other answers. */
    explanation,
    /** The tutor's chunk, when it is a larger part of the line than the selection. */
    suggestion,
    answerText,
    turns,
    ask,
    setStatus,
    saveNotes,
    translation,
    pos,
    links: isWord ? externalDictionaries(target.text, target.lang, native) : [],
    copy: (text: string) => void navigator.clipboard?.writeText(text).catch(() => undefined),
  };
}

export type Lookup = ReturnType<typeof useLookup>;
