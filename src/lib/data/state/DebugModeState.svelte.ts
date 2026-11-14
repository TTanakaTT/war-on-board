import type { InvariantViolationReport } from "$lib/domain/types/invariant";

export interface DebugModeState {
  checksEnabled: boolean;
  reports: InvariantViolationReport[];
}

// Reports hold whole snapshots, so they are stored raw instead of as deep proxies.
let _debugMode = $state.raw<DebugModeState>({
  checksEnabled: true,
  reports: [],
});

function get(): DebugModeState {
  return _debugMode;
}

function set(debugMode: DebugModeState): void {
  _debugMode = debugMode;
}

export const debugModeState = {
  get,
  set,
};
