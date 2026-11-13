---
name: commit
description: Turn working-tree changes into commits after formatting and linting. Use when asked to commit changes. Does not create branches, push, or open pull requests.
---

# Commit working-tree changes

Run every step in order. If a step fails, fix the cause and rerun from that step.

1. Run `pnpm format`, then `pnpm lint`.
2. Stage files explicitly by path. Never commit secrets or build output.
3. Split unrelated changes into separate commits.
4. Write each message in English using Conventional Commits: `<type>(<scope>): <summary>` (`type` is one of `feat`, `fix`, `refactor`, `chore`, `docs`, `test`).
