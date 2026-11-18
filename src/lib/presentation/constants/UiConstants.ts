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

/** Default desktop drawer width expressed in Tailwind spacing units. */
export const DEFAULT_DRAWER_WIDTH_UNITS = 64;

/** The drawer's 1px borders on both sides (AppDrawer `border`), in Tailwind spacing units. */
const DRAWER_BORDER_UNITS = 0.25 * 2;

/** The drawer content's padding on both sides (AppDrawerContent `p-4`), in Tailwind spacing units. */
const DRAWER_CONTENT_PADDING_UNITS = 4 * 2;

/** Gutter for the edge toggle of the desktop game drawer (AppDrawer `pr-5`), in Tailwind spacing units. */
const GAME_DRAWER_TOGGLE_GUTTER_UNITS = 5;

/** Horizontal space the desktop game drawer takes around its content, in Tailwind spacing units. */
const GAME_DRAWER_HORIZONTAL_CHROME_UNITS =
  DRAWER_BORDER_UNITS + GAME_DRAWER_TOGGLE_GUTTER_UNITS + DRAWER_CONTENT_PADDING_UNITS;

/** Horizontal space the mobile drawer takes around its content, in Tailwind spacing units. */
const MOBILE_DRAWER_HORIZONTAL_CHROME_UNITS = DRAWER_BORDER_UNITS + DRAWER_CONTENT_PADDING_UNITS;

/**
 * Width of a player info card in Tailwind spacing units: the content width of the default
 * desktop game drawer. Every drawer showing the cards is sized so they get this width.
 */
const INFO_CARD_WIDTH_UNITS = DEFAULT_DRAWER_WIDTH_UNITS - GAME_DRAWER_HORIZONTAL_CHROME_UNITS;

/** Gap between the two player info cards in the expanded game drawer (GameInfoDrawerContent `gap-4`). */
const INFO_CARD_GAP_UNITS = 4;

/**
 * Expanded game drawer width expressed in Tailwind spacing units. It shows the two player
 * info cards side by side.
 */
export const EXPANDED_GAME_DRAWER_WIDTH_UNITS =
  GAME_DRAWER_HORIZONTAL_CHROME_UNITS + 2 * INFO_CARD_WIDTH_UNITS + INFO_CARD_GAP_UNITS;

/**
 * Mobile drawer (dialog) width expressed in Tailwind spacing units. It has no edge toggle,
 * so it is narrower than the desktop drawer to give the player info cards the same width.
 */
export const MOBILE_DRAWER_WIDTH_UNITS =
  MOBILE_DRAWER_HORIZONTAL_CHROME_UNITS + INFO_CARD_WIDTH_UNITS;

/** Duration for desktop drawer width transitions in milliseconds. */
export const DRAWER_WIDTH_TRANSITION_MS = 200;
