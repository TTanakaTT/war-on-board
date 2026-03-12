# Architecture Overview

## Layers & Dependency Direction

```
Routes (+page.svelte)
  ↓
Presentation (components, UI state)
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

| Service                  | File                               | Purpose                                                                    |
| ------------------------ | ---------------------------------- | -------------------------------------------------------------------------- |
| **GameService**          | `services/GameService.ts`          | Façade — initializes board, delegates to sub-services                      |
| **InteractionService**   | `services/InteractionService.ts`   | Board interaction: piece selection, panel click, highlight computation     |
| **MovementRulesService** | `services/MovementRulesService.ts` | Read-only movement queries: `canMoveTo`, `canCancelMove`, projected counts |
| **GenerationService**    | `services/GenerationService.ts`    | Unit generation: find best panel, spawn piece, consume resources           |
| **CombatService**        | `services/CombatService.ts`        | Combat resolution: multi-unit simultaneous damage, wall siege              |
| **PieceService**         | `services/PieceService.ts`         | Piece CRUD, move execution, passive gains (resource/castle growth)         |
| **PanelService**         | `services/PanelService.ts`         | Panel initialization, adjacent lookup, state clearing, refresh             |
| **TurnAndAiService**     | `services/TurnAndAiService.ts`     | Turn progression, resource accounting, AI opponent logic                   |
| **VictoryService**       | `services/VictoryService.ts`       | Win condition check (home base capture)                                    |
| **BoardLayoutService**   | `services/BoardLayoutService.ts`   | Hexagon coordinate geometry for rendering                                  |

### Call Graph (simplified)

```
GameService
  ├── InteractionService.panelChange / pieceChange / stateChange
  │     └── MovementRulesService.canMoveTo / canCancelMove
  ├── GenerationService.generate
  │     └── PieceService.generateNextId
  └── TurnAndAiService.nextTurn / doOpponentTurn
        ├── PieceService.finalizePlayerMoves
        │     └── CombatService.resolveCombat / attackWallMulti
        ├── PieceService.applyPassiveGains
        ├── VictoryService.applyVictory
        ├── InteractionService.pieceChange / panelChange
        └── GenerationService.findGenerationPanel / generate
```

---

## Domain Model

### Enums

| Enum         | Values                                             | Notes                                                 |
| ------------ | -------------------------------------------------- | ----------------------------------------------------- |
| `Player`     | SELF, OPPONENT, UNKNOWN                            | UNKNOWN = unclaimed panel                             |
| `PanelState` | UNOCCUPIED, OCCUPIED, SELECTED, MOVABLE, IMMOVABLE | Highlight states for UI                               |
| `PieceType`  | KNIGHT, ROOK, BISHOP                               | Each carries a `PieceConfig` (cost, HP, attack stats) |

### PieceType Configs

| Type   | Cost | Max HP | AP vs Piece | AP vs Wall | Passive                  |
| ------ | ---- | ------ | ----------- | ---------- | ------------------------ |
| KNIGHT | 4    | 10     | 5           | 2          | Claims panel ownership   |
| ROOK   | 5    | 10     | 2           | 2          | +1 castle/turn (cap 5)   |
| BISHOP | 5    | 5      | 0           | 0          | +1 resource/turn (cap 5) |

### Constants (`domain/constants/GameConstants.ts`)

| Constant                            | Value | Usage                                     |
| ----------------------------------- | ----- | ----------------------------------------- |
| `HOME_BASE_INIT_RESOURCE`           | 5     | Initial resource on home base panels      |
| `HOME_BASE_INIT_CASTLE`             | 10    | Initial castle on home base panels        |
| `PASSIVE_RESOURCE_CAP`              | 5     | Max resource from BISHOP passive growth   |
| `PASSIVE_CASTLE_CAP`                | 5     | Max castle from ROOK passive growth       |
| `RESOURCE_THRESHOLD_FOR_GENERATION` | 5     | Min resource on panel to allow unit spawn |
| `DEFAULT_MAX_PIECES_PER_PANEL`      | 2     | Max friendly pieces per panel             |

---

## State Management (Svelte 5 Runes)

```
State (svelte $state)  ←→  Repository (read/write API)
```

| State File                     | Repository                | Contents                                              |
| ------------------------------ | ------------------------- | ----------------------------------------------------- |
| `PanelsState.svelte.ts`        | `PanelRepository`         | All panels (position, state, owner, resource, castle) |
| `PiecesState.svelte.ts`        | `PiecesRepository`        | All pieces (position, type, HP, target)               |
| `TurnState.svelte.ts`          | `TurnRepository`          | Current player, turn num, resources, caps, winner     |
| `SelectedPanelState.svelte.ts` | `SelectedPanelRepository` | Currently selected panel + piece ID                   |
| `LayerState.svelte.ts`         | `LayerRepository`         | Board layer count                                     |

---

## PanelState Transitions

```
                  ┌─── piece click ──→ SELECTED
  UNOCCUPIED ─────┤
                  └─── (unreachable) ──→ IMMOVABLE

                  ┌─── piece click ──→ SELECTED
  OCCUPIED   ─────┤
                  └─── (unreachable) ──→ IMMOVABLE

  SELECTED   ───── click again ──→ cancel (→ OCCUPIED/UNOCCUPIED)

  MOVABLE    ───── click ──→ assign target (→ clear highlights)

  IMMOVABLE  ───── (no interaction)
```

After any selection action, `stateChange()` recomputes all panels:

- Source → SELECTED
- Reachable & allowed → MOVABLE
- Everything else → IMMOVABLE

---

## Turn Flow

```
1. Player selects pieces & assigns targets
2. "End Turn" pressed → TurnAndAiService.nextTurn()
   a. finalizePlayerMoves() — execute all pending moves (combat resolved here)
   b. refreshPanelStates() — sync panel ownership
   c. VictoryService.applyVictory() — check home base capture
   d. Switch to next player
   e. resetInitialPositions() + applyPassiveGains() for next player
   f. addResources() — count panel resources, accumulate to turn pool
   g. If OPPONENT → doOpponentTurn() (random AI, delayed via setTimeout)
```

---

## Combat Flow (`PieceService.finalizePlayerMoves`)

```
1. Snapshot all pieces with pending targetPosition
2. Group attackers by target panel
3. For each target panel group:
   ├── target panel has enemy castle > 0?
   │     YES → CombatService.attackWallMulti(all attackers, panel)
   │           → all attackers stay in place
   │     NO  ↓
   ├── target has enemy pieces (defenders)?
   │     YES → CombatService.resolveCombat(attackers, defenders)
   │           Front-line selection: Rook > Knight > Bishop (low ID tiebreak)
   │           All attackers deal AP → front-line defender (summed)
   │           All defenders deal AP → front-line attacker (summed)
   │           Simultaneous damage application
   │           Overkill does NOT carry over to other units
   │     NO  ↓
   └── After resolution:
         All enemies eliminated AND castle = 0?
           YES → surviving attackers move to panel, claim ownership
           NO  → surviving attackers stay, clear targetPosition
```

Castle-first rule: walls must be destroyed before units can be attacked or the panel entered.

---

## File Map

```
src/lib/
├── data/
│   ├── repositories/    # Static API classes wrapping State
│   └── state/           # Svelte 5 $state stores
├── domain/
│   ├── constants/       # GameConstants.ts
│   ├── entities/        # Panel, Piece, PanelPosition, Turn, HomeBase
│   └── enums/           # Player, PanelState, PieceType (with EnumFactory)
├── presentation/
│   └── components/      # Svelte components (HexagonPanel, Drawer, etc.)
├── services/            # Application logic (see table above)
└── paraglide/           # i18n generated output
```
