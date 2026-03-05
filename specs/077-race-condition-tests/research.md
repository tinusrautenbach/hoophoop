# Research: npm → Bun Migration

**Branch**: `077-race-condition-tests` | **Date**: 2026-02-28

## Decisions

### 1. Bun as package manager only vs full runtime

- **Decision**: Use Bun as **package manager + script runner** (`bun install`, `bun run <script>`). Keep Node.js as the process runtime for Next.js (`next dev`, `next build`, `next start`) since the custom `server.ts` uses `node:http` and `tsx`.
- **Rationale**: Bun 1.3.5 supports Next.js 15 App Router for `bun run dev/build` but the production Dockerfile uses `node server.js` (Next.js standalone output). Changing the production runner to Bun would require switching the base Docker image and is out of scope.
- **Alternatives considered**: Full Bun runtime (bun server.ts) — rejected; production image is `node:20-alpine` and `server.js` is the standalone Next output, not `server.ts`.

### 2. `bun run dev` — server.ts + nodemon

- **Decision**: Replace `nodemon server.ts` with `bun --hot server.ts`.
- **Rationale**: `nodemon` + `tsx` is the current watcher/transpiler pair. Bun has built-in TypeScript support and `--hot` for hot-reload, eliminating both dependencies for the dev script.
- **Alternatives considered**: Keep `nodemon` + `tsx` with bun — works but pointless; Bun handles TS natively.

### 3. `bun run start` — production

- **Decision**: Keep `tsx server.ts` as the `start` script in `package.json`. The Dockerfile uses `node server.js` (standalone output) not the `start` script.
- **Rationale**: `start` is only used outside Docker (local prod-like runs). `tsx` is already installed.

### 4. Vitest under Bun

- **Decision**: Keep `vitest --config tests/vitest.config.ts` unchanged. Run as `bun run test` (which calls vitest via Node under the hood through Bun's script runner).
- **Rationale**: `bun x vitest` would use Bun as the vitest runtime, which has partial support. Our test suite uses `jsdom`, `@testing-library/react`, and complex vi.mock hoisting — all tested against Node. The vitest config uses `@vitejs/plugin-react` which requires Node-compatible Vite. Running vitest through Bun's script runner (not `bun test`) keeps Node as the JS engine for tests.
- **Alternatives considered**: `bun test` — uses Bun's own test runner, incompatible with vitest config, vi.mock, and @testing-library.

### 5. Lockfile

- **Decision**: Generate `bun.lockb` (Bun's binary lockfile), keep `package-lock.json` deleted.
- **Rationale**: `bun install` replaces `npm ci`. `bun.lockb` is the authoritative lockfile going forward.

### 6. Dockerfile

- **Decision**: Update `deps` and `builder` stages to use `oven/bun` or install Bun into `node:20-alpine`. Runner stage stays `node:20-alpine` (Next.js standalone runs on Node).
- **Rationale**: Build-time uses bun for `bun install` + `bun run build`. Runtime (`node server.js`) is Node-only.

### 7. CI/CD

- **Decision**: Replace `actions/setup-node` + `npm ci` with `oven-sh/setup-bun` + `bun install` in all CI jobs.
- **Rationale**: Direct drop-in; `bun install` is ~10x faster than `npm ci`.

### 8. Drizzle, Clerk, Hasura, Tailwind, Framer Motion, Zustand

- **Decision**: No changes needed for any of these.
- **Rationale**: These are library dependencies. Bun installs and resolves them identically to npm. They run inside Next.js / Node processes, not in Bun's runtime directly.

## Known Gotchas

- `bun install` with `overrides` field in `package.json` — Bun supports npm `overrides` since 1.1.0. ✅
- `nodemon.json` becomes dead config once `dev` script switches to `bun --hot`. Keep file but it won't be read.
- `bun.lockb` is binary — not human-readable. Git-commit it.
- `package-lock.json` must be deleted before `bun install` to avoid confusion (Bun will warn if both exist).
