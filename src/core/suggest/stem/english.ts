/**
 * The Snowball English (Porter2) stemmer, ported from algorithms/english.sbl of
 * https://github.com/snowballstem/snowball (https://snowballstem.org/algorithms/english/stemmer.html).
 * BSD-3-Clause, see LICENSE-snowball.txt. Expects a lower-case word.
 */

const in_ = (group: string, c: string | undefined): boolean => c !== undefined && c.length === 1 && group.includes(c);
const isV = (c: string | undefined): boolean => in_('aeiouy', c);

const EXCEPTIONS = new Map([
  ['skis', 'ski'],
  ['skies', 'sky'],
  ['idly', 'idl'],
  ['gently', 'gentl'],
  ['ugly', 'ugli'],
  ['early', 'earli'],
  ['only', 'onli'],
  ['singly', 'singl'],
  ['sky', 'sky'],
  ['news', 'news'],
  ['howe', 'howe'],
  ['atlas', 'atlas'],
  ['cosmos', 'cosmos'],
  ['bias', 'bias'],
  ['andes', 'andes'],
]);

const REGION_PREFIXES = ['gener', 'commun', 'arsen', 'past', 'univers', 'later', 'emerg', 'organ', 'inter'];
const EED_INVARIANT = new Set(['proc', 'exc', 'succ']);
const ING_INVARIANT = new Set(['inn', 'out', 'cann', 'herr', 'earr', 'even']);
const DOUBLES = ['bb', 'dd', 'ff', 'gg', 'mm', 'nn', 'pp', 'rr', 'tt'];

/** Suffix → replacement, longest first (Snowball's `among` takes the longest match). */
const table = (entries: Record<string, string>): [string, string][] =>
  Object.entries(entries).sort((a, b) => b[0].length - a[0].length);

const STEP1B = table({ eedly: '', ingly: '', edly: '', eed: '', ing: '', ed: '' });
// ogi, li and ative carry an extra condition, checked in the step.
const STEP2 = table({
  tional: 'tion', enci: 'ence', anci: 'ance', abli: 'able', entli: 'ent', izer: 'ize', ization: 'ize',
  ational: 'ate', ation: 'ate', ator: 'ate', alism: 'al', aliti: 'al', alli: 'al', fulness: 'ful',
  ousli: 'ous', ousness: 'ous', iveness: 'ive', iviti: 'ive', biliti: 'ble', bli: 'ble', ogist: 'og',
  ogi: 'og', fulli: 'ful', lessli: 'less', li: '',
});
const STEP3 = table({
  tional: 'tion', ational: 'ate', alize: 'al', icate: 'ic', iciti: 'ic', ical: 'ic', ful: '', ness: '',
  ative: '',
});
const STEP4 = table(
  Object.fromEntries(
    ['al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement', 'ment', 'ent', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize', 'ion'].map(
      (s) => [s, ''],
    ),
  ),
);

const among = (w: string, entries: readonly [string, string][]) => entries.find(([suffix]) => w.endsWith(suffix));

/** Index just past the first non-vowel that follows a vowel, from `from` on; -1 when there is none. */
function pastVowelConsonant(w: string, from: number): number {
  let i = from;
  while (i < w.length && !isV(w[i])) i++;
  i++;
  while (i < w.length && isV(w[i])) i++;
  return i < w.length ? i + 1 : -1;
}

/** w[0, end) ends in a short syllable. */
function shortV(w: string, end: number): boolean {
  if (end >= 3 && !in_('aeiouywxY', w[end - 1]) && isV(w[end - 2]) && !isV(w[end - 3])) return true;
  if (end === 2 && !isV(w[1]) && isV(w[0])) return true;
  return w.slice(0, end).endsWith('past');
}

export function stemEnglish(word: string): string {
  const exception = EXCEPTIONS.get(word);
  if (exception !== undefined) return exception;
  if (word.length < 3) return word;

  // Prelude: drop a leading apostrophe; y at the start or after a vowel is a consonant (Y).
  const unquoted = word.startsWith("'") ? word.slice(1) : word;
  let yFound = false;
  let w = '';
  for (let i = 0; i < unquoted.length; i++) {
    const c = unquoted[i]!;
    if (c === 'y' && (i === 0 || isV(w[i - 1]))) {
      w += 'Y';
      yFound = true;
    } else w += c;
  }

  let p1 = w.length;
  let p2 = w.length;
  const prefix = REGION_PREFIXES.find((p) => w.startsWith(p));
  const r1 = prefix ? prefix.length : pastVowelConsonant(w, 0);
  if (r1 >= 0) {
    p1 = r1;
    const r2 = pastVowelConsonant(w, r1);
    if (r2 >= 0) p2 = r2;
  }

  w = step1a(w);
  w = step1b(w, p1);
  if (w.length > 2 && (w.endsWith('y') || w.endsWith('Y')) && !isV(w[w.length - 2])) w = `${w.slice(0, -1)}i`;
  w = step2(w, p1);
  w = step3(w, p1, p2);
  w = step4(w, p2);
  w = step5(w, p1, p2);

  return yFound ? w.replaceAll('Y', 'y') : w;
}

function step1a(word: string): string {
  let w = word;
  if (w.endsWith("'s'")) w = w.slice(0, -3);
  else if (w.endsWith("'s")) w = w.slice(0, -2);
  else if (w.endsWith("'")) w = w.slice(0, -1);

  if (w.endsWith('sses')) return w.slice(0, -2);
  if (w.endsWith('ied') || w.endsWith('ies')) return w.slice(0, -3) + (w.length - 3 >= 2 ? 'i' : 'ie');
  if (w.endsWith('us') || w.endsWith('ss')) return w;
  // s goes when a vowel comes before the letter preceding it: gaps → gap, gas stays.
  if (w.endsWith('s')) {
    for (let i = 0; i < w.length - 2; i++) if (isV(w[i])) return w.slice(0, -1);
  }
  return w;
}

function step1b(w: string, p1: number): string {
  const match = among(w, STEP1B);
  if (!match) return w;
  const suffix = match[0];
  const start = w.length - suffix.length;
  const base = w.slice(0, start);

  if (suffix === 'eed' || suffix === 'eedly') return p1 <= start && !EED_INVARIANT.has(base) ? `${base}ee` : w;
  if (suffix === 'ing') {
    // dying → die, tying → tie; inning, outing etc. stay.
    if (base.endsWith('y')) {
      if (base.length === 2 && !isV(base[0])) return `${base[0]}ie`;
    } else if (ING_INVARIANT.has(base)) return w;
  }

  if (![...base].some(isV)) return w;
  if (base.endsWith('at') || base.endsWith('bl') || base.endsWith('iz')) return `${base}e`;
  if (DOUBLES.some((d) => base.endsWith(d))) return base.length === 3 && in_('aeo', base[0]) ? base : base.slice(0, -1);
  return p1 === base.length && shortV(base, base.length) ? `${base}e` : base;
}

function step2(w: string, p1: number): string {
  const match = among(w, STEP2);
  if (!match) return w;
  const [suffix, replacement] = match;
  const start = w.length - suffix.length;
  if (p1 > start) return w;
  if (suffix === 'ogi' && w[start - 1] !== 'l') return w;
  if (suffix === 'li' && !in_('cdeghkmnrt', w[start - 1])) return w;
  return w.slice(0, start) + replacement;
}

function step3(w: string, p1: number, p2: number): string {
  const match = among(w, STEP3);
  if (!match) return w;
  const [suffix, replacement] = match;
  const start = w.length - suffix.length;
  if (p1 > start || (suffix === 'ative' && p2 > start)) return w;
  return w.slice(0, start) + replacement;
}

function step4(w: string, p2: number): string {
  const match = among(w, STEP4);
  if (!match) return w;
  const start = w.length - match[0].length;
  if (p2 > start) return w;
  if (match[0] === 'ion' && w[start - 1] !== 's' && w[start - 1] !== 't') return w;
  return w.slice(0, start);
}

function step5(w: string, p1: number, p2: number): string {
  const start = w.length - 1;
  if (w.endsWith('e')) return p2 <= start || (p1 <= start && !shortV(w, start)) ? w.slice(0, start) : w;
  if (w.endsWith('l')) return p2 <= start && w[start - 1] === 'l' ? w.slice(0, start) : w;
  return w;
}
