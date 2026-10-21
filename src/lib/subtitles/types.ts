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
  /** Captions for the deaf and hard of hearing (sounds described as well as speech). */
  cc?: boolean;
  /** The host's label is only the language's name, in the host's language: menus name it in Captionary's. */
  namedByLang?: boolean;
}

export type TranslationSource =
  | { type: 'none' }
  | { type: 'track'; trackId: string }
  | { type: 'platform-mt'; lang: string }
  | { type: 'chrome'; lang: string }
  | { type: 'ai'; lang: string };
