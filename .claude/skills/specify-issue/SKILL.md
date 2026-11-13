---
name: specify-issue
description: Discuss a product complaint or feature idea with the user until the specification is agreed, optionally build a prototype for the user to try, then record the agreed specification as a GitHub issue. Use when the user voices a complaint or idea about the game, runs `/specify-issue`, or runs `/specify-issue <issue number>` to continue from an existing issue.
---

# Agree on a specification and record it as an issue

Talk with the user in Japanese. The goal is a specification precise enough that another Claude, reading only the issue body, can implement it without asking questions.

## 1. Entry point

- **`/specify-issue` or a complaint in chat**: start from what the user said.
- **`/specify-issue <number>`**: read the issue first with `gh issue view <number> --repo TTanakaTT/war-on-board --comments`, then start from its contents.

## 2. Discuss

- Read the relevant code before proposing anything, so the discussion reflects the current implementation.
- Discuss both product decisions (game rules, look and feel, scope) and technical decisions (design, data structures, where logic lives, trade-offs). For each, give your recommendation and its reasoning, consistent with `CLAUDE.md` and `docs/ARCHITECTURE.md`, and let the user decide.
- Ask a few questions at a time, not a long questionnaire. Summarize what has been agreed as the conversation progresses.

## 3. Prototype (when trying it beats describing it)

- Offer a prototype when the user would judge the result by seeing or playing it (layout, animation, feel of an interaction).
- Build it on a branch named `proto/<issue number or short-kebab-summary>`, commit, and push it. Quality checks are not required for a prototype.
- The pushed branch is published to `https://ttanakatt.github.io/war-on-board/` (the most recently pushed branch is shown). Tell the user to try it there, and iterate.

## 4. Record the specification

When the user says the specification is settled, write the issue body in Japanese with these sections:

```markdown
## 背景

<the user's original complaint or motivation>

## 仕様

<the agreed behavior, concrete enough to implement>

## 対象外

<what was explicitly left out>

## 試作ブランチ

<proto/... branch name, or "なし">
```

- New discussion: `gh issue create --repo TTanakaTT/war-on-board --title "<summary>" --body-file <file>`
- Existing issue: `gh issue edit <number> --repo TTanakaTT/war-on-board --body-file <file>`. Keep the original text in `## 背景`.

Show the user the issue URL and tell them to add the `ready-for-dev` label in GitHub when they approve it.

## Absolute rule

**Never add, remove, or change the `ready-for-dev` label, by any means (gh, API, scripts), even if the user asks you to in chat.** Only the user applies it, in GitHub.
