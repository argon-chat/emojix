/**
 * The Snowball Russian stemmer, ported from algorithms/russian.sbl of
 * https://github.com/snowballstem/snowball (https://snowballstem.org/algorithms/russian/stemmer.html).
 * BSD-3-Clause, see LICENSE-snowball.txt. Expects a lower-case word.
 */

const isV = (c: string | undefined): boolean => c !== undefined && c.length === 1 && 'аеиоуыэюя'.includes(c);

/** A group of endings; `afterAYa` ones are removed only when they follow а or я (which stays). */
interface Endings {
  /** Longest first: Snowball's `among` takes the longest match. */
  readonly list: readonly string[];
  readonly afterAYa: ReadonlySet<string>;
}

function endings(afterAYa: string, plain: string): Endings {
  const a = afterAYa.split(' ').filter(Boolean);
  const list = [...a, ...plain.split(' ').filter(Boolean)].sort((x, y) => y.length - x.length);
  return { list, afterAYa: new Set(a) };
}

const PERFECTIVE_GERUND = endings('в вши вшись', 'ив ивши ившись ыв ывши ывшись');
const ADJECTIVE = endings('', 'ее ие ые ое ими ыми ей ий ый ой ем им ым ом его ого ему ому их ых ую юю ая яя ою ею');
const PARTICIPLE = endings('ем нн вш ющ щ', 'ивш ывш ующ');
const REFLEXIVE = endings('', 'ся сь');
const VERB = endings(
  'ла на ете йте ли й л ем н ло но ет ют ны ть ешь нно',
  'ила ыла ена ейте уйте ите или ыли ей уй ил ыл им ым ен ило ыло ено ят ует уют ит ыт ены ить ыть ишь ую ю',
);
const NOUN = endings(
  '',
  'а ев ов ие ье е иями ями ами еи ии и ией ей ой ий й иям ям ием ем ам ом о у ах иях ях ы ь ию ью ю ия ья я',
);
const DERIVATIONAL = endings('', 'ост ость');
const TIDY_UP = endings('', 'ейш ейше н ь');

/** The longest ending of `e` that `w` ends with, inside w[limit…]. */
function among(w: string, limit: number, e: Endings): string | undefined {
  return e.list.find((s) => w.length - s.length >= limit && w.endsWith(s));
}

/** `w` without its ending from `e`, or null when it has none (or its а/я condition fails). */
function remove(w: string, limit: number, e: Endings): string | null {
  const suffix = among(w, limit, e);
  if (suffix === undefined) return null;
  const start = w.length - suffix.length;
  if (e.afterAYa.has(suffix)) {
    const prev = w[start - 1];
    if (start - 1 < limit || (prev !== 'а' && prev !== 'я')) return null;
  }
  return w.slice(0, start);
}

/** Index just past the first character from `from` on that passes `test`; -1 when there is none. */
function gopast(w: string, from: number, test: (c: string) => boolean): number {
  for (let i = from; i < w.length; i++) if (test(w[i]!)) return i + 1;
  return -1;
}

export function stemRussian(word: string): string {
  let w = word.replaceAll('ё', 'е');

  // RV: after the first vowel. R2: after vowel, consonant, vowel, consonant.
  let rv = w.length;
  let r2 = w.length;
  const afterVowel = gopast(w, 0, isV);
  if (afterVowel >= 0) {
    rv = afterVowel;
    const steps = [(c: string) => !isV(c), isV, (c: string) => !isV(c)];
    let at = afterVowel;
    for (const step of steps) if (at >= 0) at = gopast(w, at, step);
    if (at >= 0) r2 = at;
  }

  // Step 1: a perfective gerund; otherwise a reflexive ending, then an adjectival, verb or noun one.
  const gerund = remove(w, rv, PERFECTIVE_GERUND);
  if (gerund !== null) w = gerund;
  else {
    w = remove(w, rv, REFLEXIVE) ?? w;
    const adjective = remove(w, rv, ADJECTIVE);
    const next = adjective !== null ? (remove(adjective, rv, PARTICIPLE) ?? adjective) : (remove(w, rv, VERB) ?? remove(w, rv, NOUN));
    if (next !== null) w = next;
  }

  // Step 2: и.
  if (w.endsWith('и') && w.length - 1 >= rv) w = w.slice(0, -1);

  // Step 3: a derivational ending in R2.
  const derivational = among(w, rv, DERIVATIONAL);
  if (derivational !== undefined && w.length - derivational.length >= r2) w = w.slice(0, -derivational.length);

  // Step 4: нн → н, a superlative ending (then нн → н), or ь.
  const tidy = among(w, rv, TIDY_UP);
  if (tidy === 'ейш' || tidy === 'ейше') {
    w = w.slice(0, -tidy.length);
    if (w.endsWith('нн') && w.length - 2 >= rv) w = w.slice(0, -1);
  } else if (tidy === 'н') {
    if (w.endsWith('нн') && w.length - 2 >= rv) w = w.slice(0, -1);
  } else if (tidy === 'ь') w = w.slice(0, -1);

  return w;
}
