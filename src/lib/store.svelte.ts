// All reactive state. Values are immutable: replace them, never mutate what a getter returns.
import {
  DEFAULT_AUTOMATION_TURN_LIMIT,
  DEFAULT_MAX_PIECES_PER_PANEL,
  HOME_BASE_INIT_CASTLE,
  PLAYER_INIT_RESOURCE,
} from "#lib/domain/config.ts";
import {
  AiStrength,
  PIECE_TYPES,
  Player,
  samePos,
  type HomeBase,
  type Panel,
  type PanelPosition,
  type Piece,
  type PieceType,
  type Turn,
} from "#lib/domain/model.ts";
import type {
  GameStateHistoryEntry,
  InvariantViolationReport,
  MatchControl,
  MatchStats,
  PlayerMatchStats,
} from "#lib/domain/types.ts";

let panels = $state.raw<Panel[]>([]);
/** Bumped when the set of panel positions changes (not their contents). */
let layoutVersion = 0;
let pieces = $state.raw<Piece[]>([]);
let homeBases = $state.raw<HomeBase[]>([]);
let layer = $state.raw(1);
let turn = $state.raw<Turn>({
  num: 1,
  player: Player.SELF,
  resources: { self: 0, opponent: 0 },
  maxPiecesPerPanel: { self: DEFAULT_MAX_PIECES_PER_PANEL, opponent: DEFAULT_MAX_PIECES_PER_PANEL },
  generationMode: { self: "front", opponent: "front" },
  winner: null,
});
let history = $state.raw<GameStateHistoryEntry[]>([]);
let matchStats = $state.raw<MatchStats>(initialMatchStats());
let matchControl = $state.raw<MatchControl>({
  controllers: { self: "human", opponent: "cpu" },
  aiStrengths: { self: AiStrength.STRENGTH_1, opponent: AiStrength.STRENGTH_1 },
  aiSeeds: { self: 0, opponent: 0 },
  automation: {
    status: "idle",
    automatedTurns: 0,
    turnLimit: DEFAULT_AUTOMATION_TURN_LIMIT,
    stopReason: null,
    stoppedAtWinner: null,
  },
});
let selection = $state.raw<{ pieceId?: number; rangedAttackMode: boolean }>({
  rangedAttackMode: false,
});
let gameDialog = $state.raw<{ leaveRequested: boolean; dismissedResultSignature: string | null }>({
  leaveRequested: false,
  dismissedResultSignature: null,
});
let debugMode = $state.raw<{ checksEnabled: boolean; reports: InvariantViolationReport[] }>({
  checksEnabled: true,
  reports: [],
});

function initialMatchStats(): MatchStats {
  const player = (): PlayerMatchStats => ({
    totalGainedResources: PLAYER_INIT_RESOURCE,
    totalBuiltCastle: HOME_BASE_INIT_CASTLE,
    lostUnitCounts: Object.fromEntries(PIECE_TYPES.map((t) => [t, 0])) as Record<PieceType, number>,
  });
  return { self: player(), opponent: player() };
}

export const PanelRepository = {
  getAll: () => panels,
  find: (position: PanelPosition) => panels.find((p) => samePos(p.panelPosition, position)),
  setAll(next: Panel[]) {
    const sameLayout =
      next.length === panels.length &&
      next.every((panel, i) => samePos(panel.panelPosition, panels[i].panelPosition));
    panels = [...next];
    if (!sameLayout) layoutVersion += 1;
  },
  update(panel: Panel) {
    panels = panels.map((p) => (samePos(p.panelPosition, panel.panelPosition) ? panel : p));
  },
  getLayoutVersion: () => layoutVersion,
};

export const PiecesRepository = {
  getAll: () => pieces,
  get: (id: number | undefined) => pieces.find((p) => p.id === id),
  getPiecesByPosition: (position: PanelPosition) =>
    pieces.filter((p) => samePos(p.panelPosition, position)),
  getPiecesByPlayer: (player: Player) => pieces.filter((p) => p.player === player),
  setAll(next: Piece[]) {
    pieces = [...next];
  },
  add(piece: Piece) {
    pieces = [...pieces, piece];
  },
  update(piece: Piece) {
    pieces = pieces.map((p) => (p.id === piece.id ? piece : p));
  },
  remove(piece: Piece) {
    pieces = pieces.filter((p) => p.id !== piece.id);
  },
};

export const HomeBaseRepository = {
  getAll: () => homeBases,
  getByPlayer: (player: Player) => homeBases.find((h) => h.player === player),
  setAll(next: HomeBase[]) {
    homeBases = [...next];
  },
};

export const LayerRepository = {
  get: () => layer,
  set(next: number) {
    layer = next;
  },
};

export const TurnRepository = {
  get: () => turn,
  set(next: Turn) {
    turn = next;
  },
  maxPieces: (player: Player) => turn.maxPiecesPerPanel[player] ?? DEFAULT_MAX_PIECES_PER_PANEL,
};

export const GameStateHistoryRepository = {
  getAll: () => [...history],
  setAll(next: GameStateHistoryEntry[]) {
    history = [...next];
  },
  add(entry: GameStateHistoryEntry) {
    history = [...history, entry];
  },
  clear() {
    history = [];
  },
};

export const MatchStatsRepository = {
  get: () => matchStats,
  set(next: MatchStats) {
    matchStats = next;
  },
  reset() {
    matchStats = initialMatchStats();
  },
  add(
    player: Player,
    change: (stats: PlayerMatchStats) => Partial<PlayerMatchStats>,
    amount: number,
  ) {
    if (amount <= 0) return;
    const side = player === Player.OPPONENT ? "opponent" : "self";
    matchStats = { ...matchStats, [side]: { ...matchStats[side], ...change(matchStats[side]) } };
  },
  addGainedResources(player: Player, amount: number) {
    this.add(player, (s) => ({ totalGainedResources: s.totalGainedResources + amount }), amount);
  },
  addBuiltCastle(player: Player, amount: number) {
    this.add(player, (s) => ({ totalBuiltCastle: s.totalBuiltCastle + amount }), amount);
  },
  addLostUnits(player: Player, pieceType: PieceType, count: number) {
    this.add(
      player,
      (s) => ({
        lostUnitCounts: { ...s.lostUnitCounts, [pieceType]: s.lostUnitCounts[pieceType] + count },
      }),
      count,
    );
  },
};

export const MatchControlRepository = {
  get: () => matchControl,
  set(next: MatchControl) {
    matchControl = next;
  },
};

export const SelectionRepository = {
  getPieceId: () => selection.pieceId,
  setPieceId(pieceId: number | undefined) {
    selection = { pieceId, rangedAttackMode: false };
  },
  isRangedAttackMode: () => selection.rangedAttackMode,
  setRangedAttackMode(rangedAttackMode: boolean) {
    selection = { ...selection, rangedAttackMode };
  },
};

export const GameDialogRepository = {
  get: () => gameDialog,
  requestLeave() {
    gameDialog = { ...gameDialog, leaveRequested: true };
  },
  /** Closes the dialog; a result dialog stays dismissed for <resultSignature>. */
  close(resultSignature: string | null) {
    gameDialog =
      resultSignature === null
        ? { ...gameDialog, leaveRequested: false }
        : { leaveRequested: false, dismissedResultSignature: resultSignature };
  },
  reset() {
    gameDialog = { leaveRequested: false, dismissedResultSignature: null };
  },
};

export const DebugModeRepository = {
  isChecksEnabled: () => debugMode.checksEnabled,
  setChecksEnabled(checksEnabled: boolean) {
    debugMode = { ...debugMode, checksEnabled };
  },
  getReports: () => structuredClone(debugMode.reports),
  getReportCount: () => debugMode.reports.length,
  getLatestViolationType: () => debugMode.reports.at(-1)?.violations[0]?.type ?? null,
  addReport(report: InvariantViolationReport) {
    debugMode = { ...debugMode, reports: [...debugMode.reports, structuredClone(report)] };
  },
  clearReports() {
    debugMode = { ...debugMode, reports: [] };
  },
};
