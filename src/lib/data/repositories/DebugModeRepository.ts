import { debugModeState } from "$lib/data/state/DebugModeState.svelte";
import type { InvariantViolationReport, InvariantViolationType } from "$lib/domain/types/invariant";

export class DebugModeRepository {
  static isChecksEnabled(): boolean {
    return debugModeState.get().checksEnabled;
  }

  static setChecksEnabled(checksEnabled: boolean): void {
    debugModeState.set({ ...debugModeState.get(), checksEnabled });
  }

  static getReports(): InvariantViolationReport[] {
    return structuredClone(debugModeState.get().reports);
  }

  static getReportCount(): number {
    return debugModeState.get().reports.length;
  }

  static getLatestViolationType(): InvariantViolationType | null {
    const reports = debugModeState.get().reports;
    return reports.at(-1)?.violations[0]?.type ?? null;
  }

  static addReport(report: InvariantViolationReport): void {
    const debugMode = debugModeState.get();
    debugModeState.set({ ...debugMode, reports: [...debugMode.reports, structuredClone(report)] });
  }

  static clearReports(): void {
    debugModeState.set({ ...debugModeState.get(), reports: [] });
  }
}
