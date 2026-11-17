import arrowBack from "@material-symbols/svg-400/outlined/arrow_back.svg?raw";
import arrowDownward from "@material-symbols/svg-400/outlined/arrow_downward.svg?raw";
import arrowForward from "@material-symbols/svg-400/outlined/arrow_forward.svg?raw";
import arrowUpward from "@material-symbols/svg-400/outlined/arrow_upward.svg?raw";
import castle from "@material-symbols/svg-400/outlined/castle.svg?raw";
import chessBishop2 from "@material-symbols/svg-400/outlined/chess_bishop_2.svg?raw";
import chessKnight from "@material-symbols/svg-400/outlined/chess_knight.svg?raw";
import chessPawn from "@material-symbols/svg-400/outlined/chess_pawn.svg?raw";
import chessRook from "@material-symbols/svg-400/outlined/chess_rook.svg?raw";
import close from "@material-symbols/svg-400/outlined/close.svg?raw";
import download from "@material-symbols/svg-400/outlined/download.svg?raw";
import exitToApp from "@material-symbols/svg-400/outlined/exit_to_app.svg?raw";
import home from "@material-symbols/svg-400/outlined/home.svg?raw";
import keyboardArrowLeft from "@material-symbols/svg-400/outlined/keyboard_arrow_left.svg?raw";
import keyboardArrowRight from "@material-symbols/svg-400/outlined/keyboard_arrow_right.svg?raw";
import menu from "@material-symbols/svg-400/outlined/menu.svg?raw";
import shield from "@material-symbols/svg-400/outlined/shield.svg?raw";
import skipNext from "@material-symbols/svg-400/outlined/skip_next.svg?raw";
import target from "@material-symbols/svg-400/outlined/target.svg?raw";
import taskAlt from "@material-symbols/svg-400/outlined/task_alt.svg?raw";
import trophy from "@material-symbols/svg-400/outlined/trophy.svg?raw";

/**
 * Material Symbols (outlined, weight 400) used by the UI, keyed by icon name.
 * `Icon.svelte` draws them as inline SVG, so only these icons reach the
 * bundle. To use another icon, import its SVG from
 * `@material-symbols/svg-400/outlined/` and add it here.
 */
const MATERIAL_ICON_SOURCES = {
  arrow_back: arrowBack,
  arrow_downward: arrowDownward,
  arrow_forward: arrowForward,
  arrow_upward: arrowUpward,
  castle,
  chess_bishop_2: chessBishop2,
  chess_knight: chessKnight,
  chess_pawn: chessPawn,
  chess_rook: chessRook,
  close,
  download,
  exit_to_app: exitToApp,
  home,
  keyboard_arrow_left: keyboardArrowLeft,
  keyboard_arrow_right: keyboardArrowRight,
  menu,
  shield,
  skip_next: skipNext,
  target,
  task_alt: taskAlt,
  trophy,
};

/** The viewBox every Material Symbols SVG is drawn in. */
export const MATERIAL_ICON_VIEW_BOX = "0 -960 960 960";

function pathData(name: string, svg: string): string {
  const d = /<path d="([^"]+)"/.exec(svg)?.[1];
  if (d === undefined) {
    throw new Error(`Material Symbols icon "${name}" has no path`);
  }
  return d;
}

/** The `d` attribute of each icon's single `<path>`. */
export const MATERIAL_ICON_PATHS: Readonly<Partial<Record<string, string>>> = Object.fromEntries(
  Object.entries(MATERIAL_ICON_SOURCES).map(([name, svg]) => [name, pathData(name, svg)]),
);
