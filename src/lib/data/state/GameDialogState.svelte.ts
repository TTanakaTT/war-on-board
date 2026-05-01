export interface GameDialogState {
  leaveRequested: boolean;
  dismissedResultSignature: string | null;
}

let _gameDialog = $state<GameDialogState>({
  leaveRequested: false,
  dismissedResultSignature: null,
});

function get(): GameDialogState {
  return _gameDialog;
}

function set(gameDialog: GameDialogState): void {
  _gameDialog = gameDialog;
}

export const gameDialogState = {
  get,
  set,
};
