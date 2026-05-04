/**
 * UI rendering constants that do not affect game rules.
 * These values control visual layout, spacing, and geometry for the board display.
 */

/** Hexagon panel height in pixels. */
export const PANEL_HEIGHT = 100;

/** Margin between panels in pixels. */
export const PANEL_MARGIN = 10;

/** Desktop breakpoint used for fixed navigation drawer layout. */
export const DESKTOP_NAVIGATION_BREAKPOINT_PX = 1024;

/** Fixed header height on the game page for mobile layouts. */
export const MOBILE_GAME_HEADER_HEIGHT_PX = 112;

/** Combined horizontal and vertical board gutter used on mobile layouts. */
export const MOBILE_BOARD_VIEWPORT_GUTTER_PX = 32;

/** Default drawer width expressed in Tailwind spacing units. */
export const DEFAULT_DRAWER_WIDTH_UNITS = 64;

/** Expanded game drawer width expressed in Tailwind spacing units. */
export const EXPANDED_GAME_DRAWER_WIDTH_UNITS = 104;

/** Duration for desktop drawer width transitions in milliseconds. */
export const DRAWER_WIDTH_TRANSITION_MS = 200;
