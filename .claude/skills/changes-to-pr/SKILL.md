---
name: changes-to-pr
description: Run quality checks, bump the version, commit, push, and open a pull request for the current work. Use when the user asks to commit, push, open a PR the current changes. Never merges.
---

# Turn the current changes into a pull request

Run every step in order. If a step fails, fix the cause and rerun from that step. Do not skip steps.

## 1. Branch

- If the current branch is `main`, create a branch first: `git switch -c <type>/<short-kebab-summary>` (`type` is one of `feat`, `fix`, `refactor`, `chore`, `docs`, `test`).
- Never push to `main` and never force-push.

## 2. Quality checks

Run sequentially and stop at the first failure:

1. `pnpm format`
2. `pnpm lint`
3. `pnpm check`
4. `pnpm test`

## 3. Version bump (once per branch)

- Compare `version` in `package.json` with `git show origin/main:package.json`.
- If it is unchanged, bump it: `pnpm version minor --no-git-tag-version` when the branch adds a feature (`feat`), otherwise `pnpm version patch --no-git-tag-version`.
- If it already differs from `origin/main`, do not bump again.

## 4. Commit

- Use Conventional Commits in English: `<type>(<scope>): <summary>` (e.g. `feat(api): allow redirecting ranged attacks`).
- Split unrelated changes into separate commits. Stage files explicitly; never commit secrets or build output.

## 5. Push and pull request

- `git push -u origin HEAD`
- If a PR for this branch already exists (`gh pr view`), stop after pushing and report the PR URL.
- Otherwise run `gh pr create --base main` with a title in Conventional Commits form and a body following `.github/PULL_REQUEST_TEMPLATE.md`. Write the body in Japanese. Include `Closes #<issue>` when the work comes from an issue.

## 6. Report

Report the PR URL and the preview URL `https://ttanakatt.github.io/war-on-board/` (the preview shows the most recently pushed branch).

**Never merge the pull request.** Merging is done by a human.
