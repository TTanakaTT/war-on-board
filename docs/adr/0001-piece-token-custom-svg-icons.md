# Piece tokens may use custom SVG icons instead of material-symbols

Adding archer, cavalry, and siege-weapon piece types (alongside infantry, heavy,
rook, and noble) exposed a gap: Material Symbols has no cavalry/horse, no
bow/archer, and no catapult/siege icon among its ~4,300 glyphs — it's a general
UI icon font, not a game-asset library. Best-effort substitutes (`bolt` for
cavalry, `target` for archer, `precision_manufacturing` for siege) exist but
read as generic UI icons, not military units, undermining board legibility.

Decision: piece tokens rendered by
[`PieceToken.svelte`](../../src/lib/presentation/components/board/PieceToken.svelte)
may use custom SVG icon assets instead of material-symbols. This is a narrow,
named exception — every other icon in the app (buttons, drawers, headers)
continues to use material-symbols exclusively, per `CLAUDE.md`.

Considered and rejected: forcing all piece types through material-symbols
substitutes, accepting the loss of visual distinctiveness on the board where
it matters most.
