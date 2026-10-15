import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { extractTranslation } from '@/lib/ai/prompts';
import type { AIJob, ChatTurn } from '@/lib/ai/types';
import { externalDictionaries, type DictionaryResult } from '@/lib/dictionary';
import { bg, streamJob, type AIStatus } from '@/lib/messaging';
import type { Settings } from '@/lib/settings';
import { canRomanize } from '@/lib/text/romanize';
import { chromeTranslatorState, translateWithChrome } from '@/lib/translate';
import { vocabKey, type VocabItem, type VocabStatus } from '@/lib/vocab';
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
  onSave: (status: VocabStatus | null, extra?: { translation?: string; notes?: string }) => void;
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
  const saved = vocab[identity.id];

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
  // Sentence breakdowns are always explicitly requested; word explanations start on their own only
  // when the learner opted in (each is a paid request).
  const autoStart = aiReady && (autoExplain ?? (!isWord || !!aiStatus?.autoExplain));
  const { start: startAI, reset: resetAI } = ai;
  useEffect(() => {
    resetAI();
    setTurns([]);
    if (autoStart) startAI(job);
  }, [job, autoStart, startAI, resetAI]);
  const explain = useCallback(() => {
    if (aiReady) startAI(job);
  }, [aiReady, startAI, job]);

  // ---- follow-up chat ----
  const [turns, setTurns] = useState<ChatEntry[]>([]);
  const chatCancel = useRef<(() => void) | null>(null);
  useEffect(() => () => chatCancel.current?.(), []);
  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const history: ChatTurn[] = [];
    if (ai.text) history.push({ role: 'assistant', content: ai.text });
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
  const aiTranslation = isWord && ai.status === 'done' ? extractTranslation(ai.text) : undefined;
  // Prefer the on-device translation; otherwise reuse the tutor's "Translation:" line.
  const translationForSave = quick ?? aiTranslation;
  const setStatus = (status: VocabStatus) => {
    if (saved?.status === status) onSave(null);
    else onSave(status, { translation: saved?.translation ?? translationForSave ?? undefined });
  };
  const saveNotes = () =>
    onSave(saved?.status ?? 'learning', { translation: saved?.translation ?? translationForSave ?? undefined, notes: ai.text });

  const firstEntry = dict?.entries[0];
  const pos = firstEntry?.partOfSpeech?.toLowerCase();
  // Wiktionary definitions are English, so they only stand in for a translation into English.
  const definition = native.startsWith('en') ? firstEntry?.senses[0]?.definition : undefined;
  const translation = isWord ? (saved?.translation ?? quick ?? aiTranslation ?? definition) : (target.translation ?? quick ?? undefined);

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
    /** The learner turned the tutor off (as opposed to never setting one up). */
    aiOff: !!aiStatus && !aiStatus.enabled,
    explain,
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
