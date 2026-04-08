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

| Service                  | Purpose                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| **InteractionService**   | Board interaction: piece selection, panel click, highlight logic |
| **MovementRulesService** | Read-only movement queries: `canMoveTo`, `canCancelMove`         |
| **GenerationService**    | Unit generation: find best panel, spawn piece, consume resources |
| **CombatService**        | Combat resolution: multi-unit simultaneous damage, wall siege    |
| **PieceService**         | Piece CRUD, move execution, passive gains                        |
| **PanelService**         | Panel initialization, adjacent lookup, state clearing            |
| **TurnAndAiService**     | AI opponent logic                                                |
| **VictoryService**       | Win condition check (home base capture)                          |
| **BoardLayoutService**   | Hexagon coordinate geometry for rendering                        |

---

## File Map

```
src/lib/
├── domain/              # Domain layer (innermost)
│   ├── constants/       # GameConstants.ts
│   ├── entities/        # Panel, Piece, PanelPosition, Turn, HomeBase
│   ├── enums/           # Player, PanelState, PieceType, ActionError, EnumFactory
│   └── types/           # Shared type definitions (Result, CombatOutcome, etc.)
├── api/                 # Application layer — GameApi (sole game operation entry point)
├── services/            # Application layer — orchestration logic
├── data/                # Adapter layer
│   ├── repositories/    # Static classes wrapping State
│   └── state/           # Svelte 5 $state stores
├── presentation/        # Adapter layer
│   └── components/      # Svelte components
└── paraglide/           # Framework layer — i18n generated output

tests/
├── unit/                # Vitest — mirrors src/lib/ structure
│   ├── api/             # GameApi tests
│   ├── services/        # Service tests
│   └── domain/
│       ├── entities/    # Entity tests
│       └── enums/       # Enum tests
└── e2e/                 # Playwright (CI only)
```

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

| Layer       | Directories                         | Test location                             | Unit tests   |
| ----------- | ----------------------------------- | ----------------------------------------- | ------------ |
| Domain      | `domain/entities/`, `domain/enums/` | `tests/unit/domain/`                      | **Required** |
| Application | `api/`, `services/`                 | `tests/unit/api/`, `tests/unit/services/` | **Required** |
| Adapter     | `data/`, `presentation/`            | —                                         | Not required |
| Framework   | `routes/`, `paraglide/`             | —                                         | Not required |
