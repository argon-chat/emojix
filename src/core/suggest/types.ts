/** src/data/keywords/{locale}.json, as scripts/build-keywords.ts writes it. */
export interface KeywordIndexData {
  locale: string;
  version: 1;
  /**
   * Normalised keys (labels, tags and their words), sorted by code unit. Hexcodes: those whose
   * label is the key, then a word of the label, then a tag, then a word of a tag; within each
   * group shorter labels first, then emoji order.
   */
  keys: [key: string, hexcodes: string[]][];
  /** The same keyed by their stem, sorted likewise; empty for locales without a stemmer. */
  stems: [stem: string, hexcodes: string[]][];
}

/** src/data/shortcodes.json. */
export interface ShortcodeData {
  version: 1;
  /** Sorted by code. */
  codes: [code: string, hexcode: string][];
}

/** src/data/emoticons.json. */
export interface EmoticonData {
  version: 1;
  items: [text: string, hexcode: string][];
}

export interface KeywordMatch {
  hexcode: string;
  /** The key (or, for kind "stem", the stem) that matched. */
  key: string;
  kind: 'keyword' | 'stem';
  exact: boolean;
  /** Characters of the key the query did not cover. */
  unmatched: number;
  locale: string;
}

export interface ShortcodeMatch {
  hexcode: string;
  code: string;
  exact: boolean;
  unmatched: number;
}

export interface Emoticon {
  text: string;
  hexcode: string;
  /** Replace as soon as it is typed; otherwise (it ends with a letter: ":D", "xD") only at the next boundary. */
  immediate: boolean;
}
