# AGENTS.md

Guidance for coding agents working in this repository.

## Purpose

- `swagger-typescript` is a code generator that turns API specs into client code.
- Inputs include OpenAPI v3, Swagger v2, and Postman collections (normalized to OpenAPI where needed).
- Primary outputs are generated API services/types for TypeScript, JavaScript, and Kotlin.
- The CLI command is `swag-ts`, with generation orchestrated from `src/index.mts`.
- Stability matters: preserve generated output structure/format unless a behavior change is intentional.

## Project Snapshot

- Runtime: Node.js ESM package (`"type": "module"`).
- Package manager: Yarn Classic (`yarn@1.22.22`), `node_modules` linker.
- Source of truth: `src/**/*.mts`.
- Build output: `lib/**/*.mjs` and `lib/**/*.d.mts`.
- CLI entrypoint: `bin/index.mjs` (expects built `lib/`).
- Tests: Jest + ts-jest with ESM and `--experimental-vm-modules`.

## Rules Discovery (Cursor/Copilot)

- Checked for Cursor rules in `.cursor/rules/` and `.cursorrules`: none found.
- Checked for Copilot rules in `.github/copilot-instructions.md`: none found.
- If these files appear later, treat them as higher-priority constraints and update this file.

## High-Value Commands

Run all commands from repository root.

### Install

- `yarn install`

### Build / Compile

- `yarn prepare`
  - Runs `husky install && tsc`.
  - Compiles TypeScript/MTS sources into `lib/`.
- `npx tsc`
  - Compile only, without Husky install side effects.

### Lint

- `yarn lint`
  - Repository script; currently targets `src/**/*.ts`.
- `yarn eslint-fix`
  - Repository autofix script for `src/**/*.ts`.
- `npx eslint "src/**/*.mts"`
  - Recommended for actual source files (`.mts`).
- `npx eslint "src/**/*.mts" --fix`
  - Recommended lint autofix for actual source.

### Format

- `yarn prettier-fix`
  - Repository script; currently targets `**/*.{ts,tsx}`.
- `npx prettier --write "src/**/*.mts" "__tests__/**/*.mjs"`
  - Recommended when touching modern source/tests.

### Test (All)

- `yarn test`
  - Runs `yarn prepare` then Jest in ESM mode.
- Equivalent direct form:
  - `cross-env NODE_OPTIONS=--experimental-vm-modules npx jest`

### Test (Single Test File)

- `yarn test __tests__/main/index.test.mjs`
- `yarn test __tests__/e2e/local-openapi.test.mjs`
- Alternative direct Jest (faster iteration when build already exists):
  - `cross-env NODE_OPTIONS=--experimental-vm-modules npx jest __tests__/main/index.test.mjs`

### Test (By Name / Pattern)

- `yarn test __tests__/e2e/ --testNamePattern="should generate"`
- `cross-env NODE_OPTIONS=--experimental-vm-modules npx jest -t "generate Code"`

### Snapshot Updates

- `yarn test __tests__/e2e/ -u`
- `yarn test __tests__/e2e/local-openapi.test.mjs -u`

### CLI Smoke / API Generation

- `yarn test:api`
  - Runs `yarn prepare && node ./bin/index.mjs`.
- `node ./bin/index.mjs --config ./path/to/swagger.config.json`

## Code Style and Conventions

### Language / Modules

- Use TypeScript `.mts` in `src/` and ESM syntax everywhere.
- Keep internal imports extension-explicit (`.mjs`) in source, matching project style.
- Use named exports by default; keep default exports only where already established.

### Imports

- Group imports in this order when practical:
  1. Node built-ins, 2) third-party packages, 3) local modules.
- Separate type-only imports via `import type { ... }` when used only for types.
- Keep imports stable and minimal; remove unused imports promptly.

### Formatting

- Prettier rules are authoritative (`.prettierrc`):
  - trailing commas: `all`
  - plugin: `prettier-plugin-jsdoc`
- Use double quotes, semicolons, and trailing commas (matches current codebase).
- Keep functions and blocks readable; avoid dense one-liners.

### Types

- `strict` TypeScript is enabled; preserve strictness.
- Prefer explicit interfaces/types for schema-heavy structures.
- Avoid `any`; if unavoidable, isolate and narrow quickly.
- Use discriminated unions and literal types where applicable (existing pattern in `types.mts`).

### Naming

- Types/interfaces: `PascalCase`.
- Variables/functions: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` only when semantically constant; otherwise `camelCase`.
- Generated type names often follow domain patterns (e.g., `RequestBody{Name}`); keep consistency.

### Error Handling

- Validate config and inputs early; throw clear `Error` messages for invalid state.
- Catch at process boundaries to log context (current style uses `chalk` + console logging).
- Avoid swallowing errors silently; either rethrow or return an explicit fallback.
- Keep fallback behavior deterministic (e.g., formatting fallback to `JSON.stringify(..., null, 2)`).

### File and API Generation Patterns

- Preserve separation of concerns used in generators:
  - collect/normalize input
  - transform to AST-like structures
  - render output files
- For filters (`includes`, `excludes`, `whitelistRegex`), maintain current matching behavior.
- Be careful with OpenAPI v2/v3 compatibility branches; keep both paths intact.

### Testing Conventions

- Tests live in `__tests__/` with `*.test.mjs` naming.
- Snapshot testing is heavily used; update snapshots only for intentional output changes.
- E2E tests write under `__tests__/e2e/outputs/` and clean up per test utilities.

## Commit / Hook Expectations

- Pre-commit hook runs: `yarn lint` and `yarn test`.
- Commit messages are validated by commitlint (`@commitlint/config-conventional`).
- Prefer Conventional Commits (e.g., `fix: ...`, `feat: ...`, `refactor: ...`).

## Practical Do/Don't for Agents

- Do: make minimal, focused changes aligned with existing module boundaries.
- Do: update tests/snapshots when generator behavior intentionally changes.
- Do: verify touched flows with targeted tests first, then broader tests.
- Don't: introduce CommonJS patterns.
- Don't: rename public CLI/config keys without explicit request.
- Don't: silently change generated output formatting rules.
