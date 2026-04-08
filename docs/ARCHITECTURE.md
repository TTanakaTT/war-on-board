# Architecture Overview

## Layers & Dependency Direction

```
Routes (+page.svelte)
  ↓
Presentation (components, UI state)
  ↓
API (GameApi — sole entry point for game state mutations)
  ↓
Services (application logic, side-effects)
  ↓
Domain (entities, enums, constants)
  ↓
Data (repositories, state)
```

Dependencies flow **top → bottom**. No upward imports.

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
| **TurnAndAiService**     | AI opponent logic, resource accounting                           |
| **VictoryService**       | Win condition check (home base capture)                          |
| **BoardLayoutService**   | Hexagon coordinate geometry for rendering                        |

---

## File Map

```
src/lib/
├── api/                 # GameApi (sole game operation entry point) + types
├── data/
│   ├── repositories/    # Static API classes wrapping State
│   └── state/           # Svelte 5 $state stores
├── domain/
│   ├── constants/       # GameConstants.ts
│   ├── entities/        # Panel, Piece, PanelPosition, Turn, HomeBase
│   └── enums/           # Player, PanelState, PieceType (with EnumFactory)
├── presentation/
│   └── components/      # Svelte components
├── services/            # Application logic (see table above)
└── paraglide/           # i18n generated output
```
