/**
 * How big a thing must be for a thumb (Phase 44). One table: the screens use these class strings and the unit test reads the
 * same numbers, so a target cannot quietly shrink. 44 px is the floor for anything tappable on a phone; the main action of a
 * screen is 52 px. The classes are written out in full so Tailwind sees them.
 */
export const TOUCH_MIN_PX = 44;
export const TOUCH_PRIMARY_PX = 52;

export const TOUCH = {
  /** A link or button that sits in a row of text: 44 px high on a phone, its natural height from `sm` up. */
  row: "inline-flex min-h-11 items-center sm:min-h-0",
  /** A small link in running text whose hit area is enlarged without moving the layout (padding cancelled by a negative margin). */
  inline: "-my-3.5 inline-block py-3.5 sm:my-0 sm:py-0",
  /** The one main action of a screen. */
  primary: "min-h-[52px]",
} as const;

export type TouchKey = keyof typeof TOUCH;
