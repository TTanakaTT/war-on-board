import { gameDialogState, type GameDialogState } from "$lib/data/state/GameDialogState.svelte";

export class GameDialogRepository {
  static get(): GameDialogState {
    const gameDialog = gameDialogState.get();

    return {
      leaveRequested: gameDialog.leaveRequested,
      dismissedResultSignature: gameDialog.dismissedResultSignature,
    };
  }

  static set(gameDialog: GameDialogState): void {
    gameDialogState.set({
      leaveRequested: gameDialog.leaveRequested,
      dismissedResultSignature: gameDialog.dismissedResultSignature,
    });
  }

  static requestLeaveDialog(): void {
    this.set({
      ...this.get(),
      leaveRequested: true,
    });
  }

  static clearLeaveRequest(): void {
    this.set({
      ...this.get(),
      leaveRequested: false,
    });
  }

  static dismissResult(resultSignature: string): void {
    this.set({
      leaveRequested: false,
      dismissedResultSignature: resultSignature,
    });
  }

  static reset(): void {
    this.set({
      leaveRequested: false,
      dismissedResultSignature: null,
    });
  }
}
