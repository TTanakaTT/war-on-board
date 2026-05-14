import { GameDialogRepository } from "$lib/data/repositories/GameDialogRepository";

export class GameDialogService {
  static requestLeaveDialog(): void {
    GameDialogRepository.requestLeaveDialog();
  }

  static closeDialog(resultSignature: string | null): void {
    if (resultSignature !== null) {
      GameDialogRepository.dismissResult(resultSignature);
      return;
    }

    GameDialogRepository.clearLeaveRequest();
  }

  static reset(): void {
    GameDialogRepository.reset();
  }
}
