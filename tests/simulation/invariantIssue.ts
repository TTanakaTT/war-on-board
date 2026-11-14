import type { GameStateSnapshot } from "../../src/lib/domain/types/api";
import type {
  InvariantViolationReport,
  RecordedCommand,
} from "../../src/lib/domain/types/invariant";

/** Where the simulation leaves the files the workflow turns into an issue. */
export const INVARIANT_ISSUE_OUTPUT_DIR = "simulation-results";

/** GitHub rejects issue bodies longer than 65,536 characters; keep some margin. */
const ISSUE_BODY_LIMIT = 65_000;

export interface InvariantIssue {
  title: string;
  body: string;
}

/**
 * Builds the issue for the first violation type in <report>. The body has only a 背景
 * section so it can be handed to `/specify-issue <number>` as is.
 */
export function buildInvariantIssue(
  report: InvariantViolationReport,
  typeLabel: string,
  env: NodeJS.ProcessEnv = process.env,
): InvariantIssue {
  const title = `[不変条件違反] ${typeLabel}`;
  const body = buildBody(report, typeLabel, env, true);

  return {
    title,
    body: body.length <= ISSUE_BODY_LIMIT ? body : buildBody(report, typeLabel, env, false),
  };
}

function buildBody(
  report: InvariantViolationReport,
  typeLabel: string,
  env: NodeJS.ProcessEnv,
  includeSnapshots: boolean,
): string {
  const firstType = report.violations[0].type;
  const violations = report.violations.filter((violation) => violation.type === firstType);
  const turn = (report.before ?? report.after).turn;
  const { match } = report;

  const lines = [
    "## 背景",
    "",
    "main の AI 対戦シミュレーションで不変条件違反を検出した。",
    "",
    `- 検出: ${detectionSource(env)}`,
    `- 対戦条件: 盤サイズ ${match.layer} / 先手 ${match.controllers.self} (${match.aiStrengths.self}) / 後手 ${match.controllers.opponent} (${match.aiStrengths.opponent})`,
    `- 違反: ${typeLabel} (\`${firstType}\`)`,
    ...violations.map((violation) => `  - ${indentContinuation(violation.detail)}`),
    report.command
      ? `- 操作: ${turn.num}ターン目 ${turn.player} の \`${formatCommand(report.command)}\``
      : `- 操作: なし（${turn.num}ターン目 ${turn.player} の操作の外で検出）`,
    "",
    "### このターンの操作",
    "",
    ...formatTurnCommands(report),
    "",
  ];

  if (!includeSnapshots) {
    lines.push(
      "盤面 JSON は本文の上限を超えるため省略した。ワークフロー実行の成果物 `invariant-violation-report` の `report.json` を参照。",
      "",
    );
    return lines.join("\n");
  }

  if (report.before) {
    lines.push(...snapshotDetails("直前の盤面", report.before));
  }
  lines.push(...snapshotDetails(report.before ? "直後の盤面" : "検出時の盤面", report.after));

  return lines.join("\n");
}

function detectionSource(env: NodeJS.ProcessEnv): string {
  if (!env.GITHUB_RUN_ID || !env.GITHUB_REPOSITORY) {
    return "ローカル実行";
  }

  const serverUrl = env.GITHUB_SERVER_URL ?? "https://github.com";
  const runUrl = `${serverUrl}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;

  return env.GITHUB_SHA ? `${runUrl} / commit ${env.GITHUB_SHA}` : runUrl;
}

function formatTurnCommands(report: InvariantViolationReport): string[] {
  if (report.turnCommands.length === 0) {
    return ["（なし）"];
  }

  return report.turnCommands.map((command, index) => {
    const isViolating = report.command !== null && index === report.turnCommands.length - 1;
    return `${index + 1}. \`${formatCommand(command)}\`${isViolating ? " ← 違反" : ""}`;
  });
}

function formatCommand(command: RecordedCommand): string {
  return `${command.operation}(${command.args.map((arg) => JSON.stringify(arg)).join(", ")})`;
}

function snapshotDetails(summary: string, snapshot: GameStateSnapshot): string[] {
  return [
    `<details><summary>${summary}</summary>`,
    "",
    "```json",
    JSON.stringify(snapshot),
    "```",
    "",
    "</details>",
    "",
  ];
}

function indentContinuation(text: string): string {
  return text.replaceAll("\n", "\n    ");
}
