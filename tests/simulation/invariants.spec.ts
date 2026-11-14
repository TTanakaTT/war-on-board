import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  DEFAULT_AUTOMATION_TURN_LIMIT,
  DEFAULT_GAME_LAYER,
} from "../../src/lib/domain/constants/GameConstants";
import { AiStrength } from "../../src/lib/domain/enums/AiStrength";
import type { InvariantViolationReport } from "../../src/lib/domain/types/invariant";
import type { StartMatchOptions } from "../../src/lib/domain/types/match";
import { buildInvariantIssue, INVARIANT_ISSUE_OUTPUT_DIR } from "./invariantIssue";

/** Upper bound for one match, including the per-step automation delay. */
const MATCH_TIMEOUT_MS = 10 * 60_000;
const STATUS_POLLING_MS = 500;

// The AI has no randomness, so each pairing plays the same match every time.
// The first player stays at the first strength; the second player tries every strength.
const strengths = Object.values(AiStrength);
const matches: StartMatchOptions[] = strengths.map((opponentStrength) => ({
  controllers: { self: "cpu", opponent: "cpu" },
  layer: DEFAULT_GAME_LAYER,
  automationTurnLimit: DEFAULT_AUTOMATION_TURN_LIMIT,
  aiStrengths: { self: strengths[0], opponent: opponentStrength },
}));

test("AI matches keep every invariant", async ({ page }) => {
  test.setTimeout(matches.length * MATCH_TIMEOUT_MS);

  for (const match of matches) {
    await page.goto("/");
    await page.waitForFunction(() => window.__WAR_ON_BOARD_DEBUG__ !== undefined);
    await page.evaluate((options) => window.__WAR_ON_BOARD_DEBUG__?.startMatch(options), match);

    await page.waitForFunction(
      () => {
        const status = window.__WAR_ON_BOARD_DEBUG__?.getStatus();
        return (
          status !== undefined &&
          (status.reportCount > 0 ||
            status.winner !== null ||
            status.automationStatus === "stopped")
        );
      },
      undefined,
      { timeout: MATCH_TIMEOUT_MS, polling: STATUS_POLLING_MS },
    );

    const reports = await page.evaluate(() => window.__WAR_ON_BOARD_DEBUG__?.getReports() ?? []);
    if (reports.length === 0) continue;

    // Only the first detection is reported; the run stops here.
    await writeIssueFiles(reports[0], page);
    expect(
      reports.length,
      `invariant violated: ${reports[0].violations[0].type} (see ${INVARIANT_ISSUE_OUTPUT_DIR}/)`,
    ).toBe(0);
  }
});

async function writeIssueFiles(
  report: InvariantViolationReport,
  page: import("@playwright/test").Page,
): Promise<void> {
  const typeLabel = await page.evaluate(
    (type) => window.__WAR_ON_BOARD_DEBUG__?.getViolationTypeLabel(type, "ja") ?? type,
    report.violations[0].type,
  );
  const issue = buildInvariantIssue(report, typeLabel);

  await mkdir(INVARIANT_ISSUE_OUTPUT_DIR, { recursive: true });
  await writeFile(join(INVARIANT_ISSUE_OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(INVARIANT_ISSUE_OUTPUT_DIR, "issue-title.txt"), issue.title);
  await writeFile(join(INVARIANT_ISSUE_OUTPUT_DIR, "issue-body.md"), issue.body);
}
