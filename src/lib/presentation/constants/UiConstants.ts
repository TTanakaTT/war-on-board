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

/**
 * Horizontal space the desktop game drawer takes around its content, in Tailwind spacing
 * units: the 1px borders (AppDrawer `border`), the edge toggle gutter (AppDrawer `pr-5`) and
 * the content padding on both sides (AppDrawerContent `p-4`).
 */
const GAME_DRAWER_HORIZONTAL_CHROME_UNITS = 0.25 * 2 + 5 + 4 * 2;

/** Gap between the two player info cards in the expanded game drawer (GameInfoDrawerContent `gap-4`). */
const INFO_CARD_GAP_UNITS = 4;

/**
 * Expanded game drawer width expressed in Tailwind spacing units. It shows the two player
 * info cards side by side, each as wide as the single card of the default drawer.
 */
export const EXPANDED_GAME_DRAWER_WIDTH_UNITS =
  GAME_DRAWER_HORIZONTAL_CHROME_UNITS +
  2 * (DEFAULT_DRAWER_WIDTH_UNITS - GAME_DRAWER_HORIZONTAL_CHROME_UNITS) +
  INFO_CARD_GAP_UNITS;

/** Duration for desktop drawer width transitions in milliseconds. */
export const DRAWER_WIDTH_TRANSITION_MS = 200;
