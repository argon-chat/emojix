/** NFKC, lower case, trimmed, inner whitespace collapsed to one space: how keys are stored and queries compared. */
export function normalizeQuery(text: string): string {
  return text.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
}
