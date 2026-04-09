# Architecture Overview

This project follows **Clean Architecture** principles. Code is organized into concentric layers with strict dependency direction: inner layers never depend on outer layers.

## Layers (inner → outer)

```
┌─────────────────────────────────────────┐
│            Domain (innermost)           │
│  entities, enums, constants, types      │
├─────────────────────────────────────────┤
│            Application                  │
│  api (GameApi), services                │
├─────────────────────────────────────────┤
│            Adapter                      │
│  data (repositories, state),            │
│  presentation (components)              │
├─────────────────────────────────────────┤
│         Framework (outermost)           │
│  routes, paraglide                      │
└─────────────────────────────────────────┘
```

**Dependency rule**: outer → inner only. No reverse imports.

| Layer           | Directories              | Responsibility                                           |
| --------------- | ------------------------ | -------------------------------------------------------- |
| **Domain**      | `domain/`                | Pure business rules, entities, types. No side-effects.   |
| **Application** | `api/`, `services/`      | Use cases, game operations, orchestration, side-effects. |
| **Adapter**     | `data/`, `presentation/` | External interfaces: state persistence, UI rendering.    |
| **Framework**   | `routes/`, `paraglide/`  | SvelteKit routing, i18n generated output.                |

---

## Service Responsibilities

| Service                                                                 | Purpose                                                          |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [**InteractionService**](../src/lib/services/InteractionService.ts)     | Board interaction: piece selection, panel click, highlight logic |
| [**MovementRulesService**](../src/lib/services/MovementRulesService.ts) | Read-only movement queries: `canMoveTo`, `canCancelMove`         |
| [**GenerationService**](../src/lib/services/GenerationService.ts)       | Unit generation: find best panel, spawn piece, consume resources |
| [**CombatService**](../src/lib/services/CombatService.ts)               | Combat resolution: multi-unit simultaneous damage, wall siege    |
| [**PieceService**](../src/lib/services/PieceService.ts)                 | Piece CRUD, move execution, passive gains                        |
| [**PanelService**](../src/lib/services/PanelService.ts)                 | Panel initialization, adjacent lookup, state clearing            |
| [**AiService**](../src/lib/services/AiService.ts)                       | AI player logic (random strategy)                                |
| [**VictoryService**](../src/lib/services/VictoryService.ts)             | Win condition check (home base capture)                          |
| [**BoardLayoutService**](../src/lib/services/BoardLayoutService.ts)     | Hexagon coordinate geometry for rendering                        |

---

## File Map

[`src/lib/`](../src/lib/)

- [`domain/`](../src/lib/domain/) — Domain layer (innermost)
  - [`constants/`](../src/lib/domain/constants/) — GameConstants.ts
  - [`entities/`](../src/lib/domain/entities/) — Panel, Piece, PanelPosition, Turn, HomeBase
  - [`enums/`](../src/lib/domain/enums/) — Player, PanelState, PieceType, ActionError, EnumFactory
  - [`types/`](../src/lib/domain/types/) — Shared type definitions (Result, CombatOutcome, etc.)
- [`api/`](../src/lib/api/) — Application layer — GameApi (sole game operation entry point)
- [`services/`](../src/lib/services/) — Application layer — orchestration logic
- [`data/`](../src/lib/data/) — Adapter layer
  - [`repositories/`](../src/lib/data/repositories/) — Static classes wrapping State
  - [`state/`](../src/lib/data/state/) — Svelte 5 $state stores
- [`presentation/`](../src/lib/presentation/) — Adapter layer
  - [`components/`](../src/lib/presentation/components/) — Svelte components
  - [`constants/`](../src/lib/presentation/constants/) — UI rendering constants (UiConstants.ts)
- [`paraglide/`](../src/lib/paraglide/) — Framework layer — i18n generated output

[`tests/`](../tests/)

- [`unit/`](../tests/unit/) — Vitest — mirrors src/lib/ structure
  - [`api/`](../tests/unit/api/) — GameApi tests
  - [`services/`](../tests/unit/services/) — Service tests
  - [`domain/`](../tests/unit/domain/)
    - [`entities/`](../tests/unit/domain/entities/) — Entity tests
    - [`enums/`](../tests/unit/domain/enums/) — Enum tests
- [`e2e/`](../tests/e2e/) — Playwright (CI only)

---

## Core Files (changes require careful design review)

- [`src/lib/api/GameApi.ts`](../src/lib/api/GameApi.ts) — Game operation contract.
- [`src/lib/domain/types/api.ts`](../src/lib/domain/types/api.ts) — API result type definitions.
- [`src/lib/domain/entities/`](../src/lib/domain/entities/) — Data structures.
- [`src/lib/domain/enums/`](../src/lib/domain/enums/) — Enumerations.

## Extension Points (safe to change / add)

- [`src/lib/domain/constants/GameConstants.ts`](../src/lib/domain/constants/GameConstants.ts) — Numeric tuning.
- [`src/lib/domain/enums/PieceType.ts`](../src/lib/domain/enums/PieceType.ts) CONFIGS — Unit parameters.
- [`src/lib/presentation/components/`](../src/lib/presentation/components/) — UI additions.
- [`messages/`](../messages/) — Translation additions.

## Test Coverage

Business logic lives exclusively in the Domain and Application layers. Only these layers require unit tests.

| Layer       | Directories                                                                                    | Test location                                                                              | Unit tests   |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------ |
| Domain      | [`domain/entities/`](../src/lib/domain/entities/), [`domain/enums/`](../src/lib/domain/enums/) | [`tests/unit/domain/`](../tests/unit/domain/)                                              | **Required** |
| Application | [`api/`](../src/lib/api/), [`services/`](../src/lib/services/)                                 | [`tests/unit/api/`](../tests/unit/api/), [`tests/unit/services/`](../tests/unit/services/) | **Required** |
| Adapter     | [`data/`](../src/lib/data/), [`presentation/`](../src/lib/presentation/)                       | —                                                                                          | Not required |
| Framework   | [`routes/`](../src/routes/), [`paraglide/`](../src/lib/paraglide/)                             | —                                                                                          | Not required |
