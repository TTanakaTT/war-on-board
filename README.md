# War on Board

Turn-based strategy game built with SvelteKit + Svelte 5. Development notes live in [CLAUDE.md](CLAUDE.md).

```bash
pnpm install
pnpm dev
```

| Command                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `pnpm dev`             | Start the Vite dev server                        |
| `pnpm build`           | Production build (also regenerates Paraglide)    |
| `pnpm check`           | Type + Svelte check                              |
| `pnpm lint`            | Prettier + ESLint check                          |
| `pnpm format`          | Auto-format with Prettier                        |
| `pnpm test`            | Unit tests (Vitest)                              |
| `pnpm test:simulation` | AI-vs-AI invariant simulation against `pnpm dev` |

Docker: `docker build -t war-on-board . && docker run --rm -p 4173:4173 war-on-board` serves the site at http://localhost:4173.
