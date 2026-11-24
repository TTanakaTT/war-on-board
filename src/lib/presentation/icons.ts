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
import forest from "@material-symbols/svg-400/outlined/forest.svg?raw";
import home from "@material-symbols/svg-400/outlined/home.svg?raw";
import keyboardArrowLeft from "@material-symbols/svg-400/outlined/keyboard_arrow_left.svg?raw";
import keyboardArrowRight from "@material-symbols/svg-400/outlined/keyboard_arrow_right.svg?raw";
import landscape from "@material-symbols/svg-400/outlined/landscape.svg?raw";
import landscape2 from "@material-symbols/svg-400/outlined/landscape_2.svg?raw";
import menu from "@material-symbols/svg-400/outlined/menu.svg?raw";
import shield from "@material-symbols/svg-400/outlined/shield.svg?raw";
import skipNext from "@material-symbols/svg-400/outlined/skip_next.svg?raw";
import target from "@material-symbols/svg-400/outlined/target.svg?raw";
import taskAlt from "@material-symbols/svg-400/outlined/task_alt.svg?raw";
import trophy from "@material-symbols/svg-400/outlined/trophy.svg?raw";

/** Material Symbols (outlined, 400) used by the UI. Add an icon by importing its SVG here. */
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
  forest,
  home,
  keyboard_arrow_left: keyboardArrowLeft,
  keyboard_arrow_right: keyboardArrowRight,
  landscape,
  landscape_2: landscape2,
  menu,
  shield,
  skip_next: skipNext,
  target,
  task_alt: taskAlt,
  trophy,
};

export const MATERIAL_ICON_VIEW_BOX = "0 -960 960 960";

/** The `d` of each icon's single path. */
export const MATERIAL_ICON_PATHS: Readonly<Partial<Record<string, string>>> = Object.fromEntries(
  Object.entries(MATERIAL_ICON_SOURCES).map(([name, svg]) => {
    const d = /<path d="([^"]+)"/.exec(svg)?.[1];
    if (d === undefined) throw new Error(`Material Symbols icon "${name}" has no path`);
    return [name, d];
  }),
);

/** Piece icons without a Material Symbols equivalent, drawn in a 24x24 viewBox. */
export type IconShape =
  | { type: "path"; d: string; strokeWidth: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; strokeWidth: number }
  | { type: "polygon"; points: string }
  | { type: "circle"; cx: number; cy: number; r: number };

export const CUSTOM_PIECE_ICONS: Record<string, IconShape[]> = {
  archer: [
    { type: "path", d: "M7,2 C3,7 3,17 7,22", strokeWidth: 1.5 },
    { type: "path", d: "M7,2 L13,12 L7,22", strokeWidth: 1 },
    { type: "line", x1: 7, y1: 12, x2: 21, y2: 12, strokeWidth: 1.5 },
    { type: "polygon", points: "21,8.5 21,15.5 24,12" },
    { type: "path", d: "M7,12 L4,9.5 M7,12 L4,14.5", strokeWidth: 1.5 },
  ],
  siege: [
    { type: "line", x1: 4, y1: 20, x2: 12, y2: 4, strokeWidth: 1.5 },
    { type: "line", x1: 20, y1: 20, x2: 12, y2: 4, strokeWidth: 1.5 },
    { type: "line", x1: 4, y1: 20, x2: 20, y2: 20, strokeWidth: 1.5 },
    { type: "line", x1: 10, y1: 13, x2: 19, y2: 4, strokeWidth: 1.5 },
    { type: "circle", cx: 19, cy: 4, r: 1.8 },
  ],
};
