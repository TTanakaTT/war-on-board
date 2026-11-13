---
name: pull-request
description: Turn all commits on the current branch into a pull request against main after type checking, testing, and bumping the version. Use when asked to open a pull request. Never merges.
---

# Open a pull request for the current branch

Run every step in order. If a step fails, fix the cause and rerun from that step.

1. Check the preconditions: the current branch is not `main`, and there are no uncommitted changes. If either fails, report it and stop.
2. Run `pnpm check`, then `pnpm test`.
3. Compare `version` in `package.json` with `git show origin/main:package.json`. If it is unchanged, bump it with `pnpm version minor --no-git-tag-version` when the branch adds a feature (`feat`), otherwise `pnpm version patch --no-git-tag-version`, and commit it as `chore: bump version to <version>`.
4. Push with `git push -u origin HEAD`. Never push to `main` and never force-push.
5. If a pull request for this branch already exists (`gh pr view`), report its URL and stop. Otherwise run `gh pr create --base main` with:
   - a title in Conventional Commits form, in English;
   - a body in Japanese that follows `.github/PULL_REQUEST_TEMPLATE.md`, with `Closes #<issue>` when the work comes from an issue and the version checkbox checked.
6. Report the pull request URL.

**Never merge the pull request.** Merging is done by a human.
