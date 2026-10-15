export interface Cue {
  /** Seconds. */
  start: number;
  /** Seconds. */
  end: number;
  text: string;
}

/** A subtitle track offered by the current site. */
export interface TrackInfo {
  id: string;
  lang: string;
  label: string;
  /** Automatic (speech-recognition) captions. */
  auto?: boolean;
  /** Netflix forced-narrative tracks only cover foreign-language parts. */
  forced?: boolean;
}

export type TranslationSource =
  | { type: 'none' }
  | { type: 'track'; trackId: string }
  | { type: 'platform-mt'; lang: string }
  | { type: 'chrome'; lang: string }
  | { type: 'ai'; lang: string };
