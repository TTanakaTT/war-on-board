---
description: "Guide TDD flow for adding a new GameApi operation"
---

Follow the TDD development process defined in `.github/copilot-instructions.md`:

1. Ask the user for the specification of the new feature (natural language or TSDoc).
2. Create test cases in `GameApi.test.ts` — define only `describe` / `test` structure with empty bodies.
3. Present the test case list to the user for review. Wait for confirmation: "テストケース確定。実装してください。"
4. After confirmation, implement both the test bodies and the production code. Ensure all tests pass.

Key rules:

- All game state mutations go through `GameApi`.
- No `vi.mock` or `vi.spyOn` — use real repositories/state.
- Test names must describe input, condition, and expected result.
- Run `pnpm test` to verify all tests pass before finishing.
