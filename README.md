# War on Board

Turn-based strategy game built with SvelteKit + Svelte 5.

## Setup

```bash
pnpm install
pnpm dev
```

## Commands

| Command           | Description                   |
| ----------------- | ----------------------------- |
| `pnpm dev`        | Start Vite dev server         |
| `pnpm build`      | Production build              |
| `pnpm check`      | Type + Svelte component check |
| `pnpm lint`       | Prettier + ESLint check       |
| `pnpm format`     | Auto-format with Prettier     |
| `pnpm test`       | Run unit tests (Vitest)       |
| `pnpm test:watch` | Run unit tests in watch mode  |
| `pnpm test:e2e`   | E2E tests (CI only)           |

## AI Prompt Files

Prompt files (`.github/prompts/`) can be invoked in VS Code Copilot Chat with `/`.

| Prompt        | Usage          | Description                                            |
| ------------- | -------------- | ------------------------------------------------------ |
| `pre-commit`  | `/pre-commit`  | Run format → lint → type-check → test sequentially     |
| `new-feature` | `/new-feature` | TDD flow guide for adding a new GameApi operation      |
| `review`      | `/review`      | Periodic codebase review — architecture, quality, deps |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — Clean Architecture layers, file map, extension points
- [Glossary](docs/GLOSSARY.md) — English terminology definitions for public documentation and concepts
- [Japanese Glossary](docs/GLOSSARY_JA.md) — Japanese terminology list aligned with the English glossary structure
- [Coding Conventions](.github/copilot-instructions.md) — Style rules, TDD process, LLM guardrails
