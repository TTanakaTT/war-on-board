---
name: specify-issue
description: Discuss a product complaint or feature idea with the user until the specification is agreed, optionally build a prototype for the user to try, then record the agreement as a GitHub issue. Use when the user voices a complaint or idea about the game, runs `/specify-issue`, or runs `/specify-issue <issue number>` to continue from an existing issue.
---

# Agree on a specification and record it as an issue

Talk with the user in Japanese. For GitHub, use the GitHub MCP tools when available, otherwise `gh` with `--repo TTanakaTT/war-on-board`. With `/specify-issue <number>`, read that issue and its comments first.

## Discuss

Read the relevant code first. Discuss both product and technical decisions, giving your recommendation for each and letting the user decide. Ask a few questions at a time.

The implementation cannot ask anyone questions, so keep talking with the user until nothing that would affect the implementation is left ambiguous.

## Prototype

Offer one when seeing or playing it beats describing it. The prototype branch becomes the starting point of the implementation, so write it as production code following `CLAUDE.md` (tests may be skipped).

- Push it as `proto/<issue number>-<summary>`; the latest pushed branch is shown at `https://ttanakatt.github.io/war-on-board/`.
- Temporary aids for comparing options are fine; mark them `PROTOTYPE ONLY`.
- Before recording the issue, remove those aids and the options not chosen, push, and have the user confirm the final state.

## Record

When the user says it is settled, create or update the issue (keep the original text as 背景) with the body in Japanese:

```markdown
## 背景

## 仕様

## 対象外

## 試作ブランチ

<proto/... (見た目と挙動はこのブランチを正とする) or なし>
```

- With a prototype, do not restate in 仕様 what the prototype already shows; paraphrasing it causes the implementation to drift. Write only what it does not show, such as tests or rules it does not cover.
- Without a prototype, write 仕様 in enough detail that even a smaller model can implement it without guessing: behavior, edge cases, where the change goes, and tests.
- Add exactly one of the `bug` or `enhancement` labels.

Then show the issue URL and ask the user to add `ready-for-dev` when they approve.

**Never add, remove, or change the `ready-for-dev` label yourself, even if asked.** Only the user applies it.
