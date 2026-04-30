import { gameStateHistoryState } from "$lib/data/state/GameStateHistoryState.svelte";
import type {
  GameStateHistoryEntry,
  GameStateSnapshot,
  HomeBaseSnapshot,
  PanelPositionSnapshot,
  PanelSnapshot,
  PieceSnapshot,
  TurnSnapshot,
} from "$lib/domain/types/api";

export class GameStateHistoryRepository {
  static getAll(): GameStateHistoryEntry[] {
    return gameStateHistoryState.getAll().map((entry) => this.cloneEntry(entry));
  }

  static getLength(): number {
    return gameStateHistoryState.getLength();
  }

  static add(entry: GameStateHistoryEntry): void {
    gameStateHistoryState.add(this.cloneEntry(entry));
  }

  static setAll(entries: GameStateHistoryEntry[]): void {
    gameStateHistoryState.setAll(entries.map((entry) => this.cloneEntry(entry)));
  }

  static clear(): void {
    gameStateHistoryState.clear();
  }

  private static cloneEntry(entry: GameStateHistoryEntry): GameStateHistoryEntry {
    return {
      sequence: entry.sequence,
      capturedAtTurn: entry.capturedAtTurn,
      snapshot: this.cloneSnapshot(entry.snapshot),
    };
  }

  private static cloneSnapshot(snapshot: GameStateSnapshot): GameStateSnapshot {
    return {
      panels: snapshot.panels.map((panel) => this.clonePanel(panel)),
      pieces: snapshot.pieces.map((piece) => this.clonePiece(piece)),
      turn: this.cloneTurn(snapshot.turn),
      homeBases: snapshot.homeBases.map((homeBase) => this.cloneHomeBase(homeBase)),
      layer: snapshot.layer,
    };
  }

  private static clonePosition(position: PanelPositionSnapshot): PanelPositionSnapshot {
    return {
      horizontalLayer: position.horizontalLayer,
      verticalLayer: position.verticalLayer,
    };
  }

  private static clonePanel(panel: PanelSnapshot): PanelSnapshot {
    return {
      panelPosition: this.clonePosition(panel.panelPosition),
      panelState: panel.panelState,
      player: panel.player,
      resource: panel.resource,
      castle: panel.castle,
    };
  }

  private static clonePiece(piece: PieceSnapshot): PieceSnapshot {
    return {
      id: piece.id,
      panelPosition: this.clonePosition(piece.panelPosition),
      initialPosition: this.clonePosition(piece.initialPosition),
      targetPosition: piece.targetPosition ? this.clonePosition(piece.targetPosition) : undefined,
      player: piece.player,
      pieceType: piece.pieceType,
      hp: piece.hp,
      stackCount: piece.stackCount,
      maxHp: piece.maxHp,
    };
  }

  private static cloneHomeBase(homeBase: HomeBaseSnapshot): HomeBaseSnapshot {
    return {
      player: homeBase.player,
      panelPosition: this.clonePosition(homeBase.panelPosition),
    };
  }

  private static cloneTurn(turn: TurnSnapshot): TurnSnapshot {
    return {
      num: turn.num,
      player: turn.player,
      resources: { ...turn.resources },
      maxPiecesPerPanel: { ...turn.maxPiecesPerPanel },
      generationMode: { ...turn.generationMode },
      winner: turn.winner,
    };
  }
}
