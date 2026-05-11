/**
 * Content tab for top-level picker navigation (e.g. Emoji, GIF, Stickers)
 */
export interface ContentTab {
  /** Unique tab identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon character or emoji */
  icon: string;
  /** Search placeholder when this tab is active */
  placeholder?: string;
}
