# Repository Guidelines

## Project Summary

- Purpose: TBD. Working title: Claude-Log.
- Primary stack: TBD.
- Package manager: TBD.
- Deploy target: TBD.
- Key external services: TBD.

## Commands

- Install: TBD.
- Develop: TBD.
- Verify: TBD.
- Build: TBD.
- Test: TBD.
- Deploy: TBD.

Prefer adding a single `verify` command that delegates to the right local checks. For JavaScript projects, use `npm run verify`, `pnpm run verify`, or `bun run verify`. For native, Python, or mixed projects, use `make verify` when that fits better.

## Project Structure

- Source: TBD.
- Tests: TBD.
- Scripts: TBD.
- Generated output: TBD.
- Docs: TBD.

## Working Rules

- Read this file and nearby README/config files before editing.
- Keep changes scoped to this project unless cross-project work is explicitly requested.
- Do not change model names during debugging just because they are unfamiliar.
- Use generated images or visual mockups when they would clarify product, UI, or asset direction.
- Do not commit secrets; use local env files and document required variables without values.

## Verification Notes

- Required before handoff: TBD.
- Manual smoke path: TBD.
- Known flaky or slow checks: TBD.

## Known Gotchas

- None yet.
