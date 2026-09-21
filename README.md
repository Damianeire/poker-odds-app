# Poker Odds Trainer

A local-first web app that teaches and drills the mathematics of No Limit Texas Hold'em. Specification: [Spec.md](Spec.md).

## Commands

    npm install
    npm run dev      # Vite dev server
    npm run test     # Vitest, the correctness suite
    npm run build    # type-check and static build to dist/

## Layout

    src/engine/    pure TypeScript, no DOM or framework imports
    src/drills/    one module per drill type, shared Drill interface
    src/ui/        Preact views, the equity web worker, styles
    tests/         engine and drill tests

## Principles

- Nothing is hardcoded. Every probability on screen is computed by the engine at render time. Published odds charts appear only in tests, as fixtures.
- The engine is dependency-free and can be lifted out.
- Every figure has a Show Working control that expands its derivation.

## Phase 1 status

Built: card model, 5 to 7 card evaluator, exact enumerator, Monte Carlo with confidence interval, out detection and out probabilities, shortcuts with signed error, pot odds and defence frequencies, drills 1 to 8, sandbox, live reference tables.

Not yet built (Phase 2): EV, implied odds, combinatorics, ranges and villain profiles, learn content, Leitner scheduling and persistence, timed mode, EV bankroll mode.

## Keyboard

- Enter submits an answer. Number keys pick a choice.
- Space moves to the next question once answered.
- w toggles Show Working.

Probability answers are accepted as a percentage (35 or 35%) or as odds against (2 to 1, 2:1).

## Settings

Progress and settings are saved in localStorage after every answer. To move them to another browser, make a progress code on the Progress tab and paste it there (or open the share link). JSON export and import remain as a file backup. Four-colour deck is on by default.
