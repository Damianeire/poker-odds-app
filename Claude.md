# Poker Odds Trainer

Full specification: ./SPEC.md
Read it before starting any new module. It is the source of truth
for scope, formulas, curriculum and phasing.

## Non-negotiable rules

- No hardcoded probability tables. Every number is computed by the
  engine at runtime. Published odds charts are test fixtures only.
- `src/engine/` has no DOM imports and no framework imports. Pure
  TypeScript, no dependencies.
- No new feature lands without tests. See SPEC.md section 9 for the
  required assertions.
- Hold'em only. Omaha is permanently out of scope.
- Do not proceed to Phase 2 until the Phase 1 suite is green.

## Commands

npm run dev
npm run test
npm run build

## Conventions

- TypeScript strict mode.
- Learn content interpolates figures from engine calls. Never a literal.
- Copy is plain and dense. No badges, no congratulatory language.