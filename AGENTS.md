# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the TypeScript source (CLI, GitHub, Claude, orchestrator, and config loaders).
- `test/` holds lightweight `.test.ts` scripts run with `tsx`.
- `docs/` includes architecture, workflow, and configuration references.
- `dist/` is the compiled output from `tsc` (do not edit by hand).
- Root configs: `tsconfig.json`, `eslint.config.js`, `config.example.yaml`.

## Build, Test, and Development Commands
- `npm run dev` runs `src/index.ts` via `tsx` for local iteration.
- `npm run build` compiles TypeScript into `dist/`.
- `npm run start` runs the built CLI from `dist/index.js`.
- `npm run lint` checks `src/**/*.ts` with ESLint.
- `npm run format` formats `src/**/*.ts` with Prettier.
- `npm run type-check` validates types without emitting files.
- `npm run test:git` and `npm run test:claude` execute the respective `test/*.test.ts` files.

## Coding Style & Naming Conventions
- TypeScript, ES modules (`"type": "module"` in `package.json`).
- Prefer `camelCase` for variables/functions, `PascalCase` for types/classes.
- Indentation: 2 spaces, no tabs; let Prettier enforce formatting.
- Keep modules small and focused; place shared types under `src/types/`.

## Testing Guidelines
- Tests live in `test/` and are named `*.test.ts`.
- Run targeted tests with `npm run test:git` or `npm run test:claude`.
- Add tests for new CLI flags, GitHub API flows, and Claude tool behaviors.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits (`feat:`, `refactor:`). Use the same pattern.
- PRs should include: a concise summary, steps to verify, and any config changes.
- If behavior affects external APIs, note required env vars and example payloads.

## Security & Configuration Tips
- Use `.env` for secrets (`GITHUB_TOKEN`, `ANTHROPIC_API_KEY`).
- Copy `config.example.yaml` to `config.yaml` and adjust repo labels.
- Node.js 20+ is required (`engines` in `package.json`).
