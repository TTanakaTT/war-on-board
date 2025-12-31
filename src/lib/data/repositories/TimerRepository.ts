import { timerState } from "$lib/presentation/state/TimerState.svelte";

export class TimerRepository {
  static start(): void {
    timerState.startTimer();
  }
  static stop(): void {
    timerState.stopTimer();
  }
  static reset(): void {
    timerState.resetTimer();
  }
  static isActive(): boolean {
    return timerState.isActive();
  }
  static getTimeRemaining(): number {
    return timerState.getTimeRemaining();
  }
}
