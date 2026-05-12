# Glossary

This glossary standardizes the English terms used in documentation and public concepts.

- Code-only terms are included when they appear in exported types or public docs.
- When player-facing wording and implementation wording differ, the canonical term is clarified in the definition or notes.

## Core Terms

| Term          | Definition                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Match         | One full game session from setup to a winner or an automation stop.                                                                |
| Turn          | A single player's active phase. A turn ends after move resolution, victory check, player switch, passive gains, and resource gain. |
| Player        | A controllable seat in a match. The project uses two controllable players.                                                         |
| Self          | The first controllable player and the local "self" side in domain terms.                                                           |
| Opponent      | The second controllable player and the opposing side in domain terms.                                                              |
| Seat          | The player order label used in match setup and history presentation.                                                               |
| Controller    | The actor assigned to a player slot. Current values are human and CPU.                                                             |
| AI Strength   | The configured CPU level for a controlled slot.                                                                                    |
| Winner        | The player who captures the enemy home base, or the winning side shown in result and history views.                                |
| Board Size    | The selected layer count used to generate the hex board.                                                                           |
| Board Panel   | A single hex tile on the board. In domain code this is usually called a panel.                                                     |
| Panel         | The canonical domain term for a board tile. Panels store owner, resource, castle, and occupancy state.                             |
| Home Base     | The home panel that determines victory when captured by the enemy.                                                                 |
| Resource      | The economic value stored on a panel and gained at turn start from owned panels.                                                   |
| Castle        | The wall value on a panel. Castle must be reduced before attackers can enter an enemy panel.                                       |
| Piece         | The canonical domain term for a unit on the board.                                                                                 |
| Unit          | The player-facing summary term for pieces in counts and history views.                                                             |
| Knight        | Attack-focused piece type. Knights claim the panel they occupy at turn start.                                                      |
| Bishop        | Economy-focused piece type. Bishops increase panel resource at turn start.                                                         |
| Rook          | Defense-focused piece type. Rooks increase panel castle at turn start.                                                             |
| Produce       | The action name for creating a new piece.                                                                                          |
| Generation    | The game system that selects a valid panel and spends resources to create a new piece. Front and Rear are generation priorities.   |
| Match History | The exported or displayed record of turns and match metadata.                                                                      |
| Result        | The post-match summary dialog or section.                                                                                          |
| Current turn  | The marker used to highlight the row that matches the present turn in history displays.                                            |
| Turn Player   | The player label attached to a turn entry in history displays.                                                                     |
| Menu          | The drawer entry point and title for auxiliary controls and information.                                                           |
| Settings      | The UI area for language, theme, and reset actions.                                                                                |
| Language      | The locale selection setting for UI text.                                                                                          |
| Theme         | The color-scheme setting for the UI.                                                                                               |
| Information   | The non-board informational area shown in the drawer and panels.                                                                   |

## API And Data Terms

| Term            | Definition                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Result type     | The success or failure return shape used by GameApi actions. Failures carry an ActionError value.      |
| Action Error    | A named failure reason returned when a GameApi precondition is not met.                                |
| Player snapshot | The serialized player identifier used in API and history data. Values are self, opponent, and unknown. |
| Panel snapshot  | The serialized panel shape used for API-style reads and exports.                                       |
| Piece snapshot  | The serialized piece shape used for API-style reads and exports.                                       |
| Target position | The pending destination of a piece before end-turn resolution.                                         |

## Terminology Notes

- Use Panel as the canonical domain word, even when player-facing wording varies.
- Use Piece for rules and data structures, and Unit for player-facing summaries.
- Use Produce for the action name and Generation for the underlying system or priority mode.
- Use Self and Opponent for domain-facing references, and First Player and Second Player for seat-order labels.
