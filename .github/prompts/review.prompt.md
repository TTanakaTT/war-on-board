---
description: "Periodic codebase review: architecture, rules compliance, test quality, and best practices"
---

Perform a comprehensive codebase review. This is a periodic health check, not tied to a specific feature.

Rules and architecture definitions are maintained in `.github/copilot-instructions.md` and `docs/ARCHITECTURE.md`. Always read those files first and use them as the source of truth for this review.

## Review Checklist

Work through each section below. For each, report findings as **OK** or list specific issues with file paths and line references.

### 1. Rule Compliance

- Read `.github/copilot-instructions.md` and verify that the codebase conforms to all rules defined there.
- Pay special attention to: layer boundaries, dependency direction, file placement constraints, and prohibited patterns.

### 2. Architecture & Layer Structure

- Read `docs/ARCHITECTURE.md` and verify that the current code matches the defined layer structure.
- Evaluate whether layer assignments are still appropriate given the codebase size and complexity.
- Flag any service or module that has grown too large and should be split.

### 3. Code Quality

- Look for unused exports, dead code, or commented-out code.
- Check for duplicated logic that should be extracted.
- Verify naming conventions (verb+object for functions, clear intent).

### 4. Test Quality

- Identify test cases that are trivially passing (e.g., testing implementation details rather than behavior).
- Check for missing edge case coverage in existing test files.
- Verify test names describe input, condition, and expected result.

### 5. Dependencies & Tooling

- Review `package.json` dependencies and devDependencies.
- Evaluate whether each dependency is still necessary and actively maintained.
- Suggest better alternatives if a library is deprecated, unmaintained, or has a significantly superior replacement.
- Flag any deprecated APIs in use within the codebase.

### 6. Rule Health

- Review `.github/copilot-instructions.md` and `docs/ARCHITECTURE.md` for rules that are overly rigid, contradictory, or no longer relevant.
- Suggest rule additions if recurring issues are found.

### 7. General Best Practices

- Check for security issues.
- Check CSS/styling rules defined in `.github/copilot-instructions.md`.

## Output Format

Summarize findings per section. For issues, provide actionable recommendations with file paths. End with a prioritized list of suggested changes.
