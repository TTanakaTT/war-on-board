import type { GameStateHistoryEntry } from "$lib/domain/types/api";

const _history = $state<GameStateHistoryEntry[]>([]);

function getAll(): GameStateHistoryEntry[] {
  return _history;
}

function add(entry: GameStateHistoryEntry): void {
  _history.push(entry);
}

function setAll(entries: GameStateHistoryEntry[]): void {
  _history.splice(0, _history.length, ...entries);
}

function clear(): void {
  _history.splice(0, _history.length);
}

export const gameStateHistoryState = {
  getAll,
  add,
  setAll,
  clear,
};
