# Progress

## Phase 1, the spine (2026-09-17)

Complete and green: `npm run test` passes, `npm run build` succeeds.

Engine
- cards.ts, evaluator.ts (five-card frequency table reproduced exactly in tests)
- enumerate.ts (equities sum to one, ties handled multiway, progress callback)
- montecarlo.ts (95% CI, agrees with enumeration in tests)
- outs.ts (formulas checked against brute force for 0 to 21 outs, automatic detection by target category and against a villain hand, discounting)
- potodds.ts (reference sizing table verified), shortcuts.ts (rule of 2, rule of 4, Solomon, signed errors, percent and ratio conversion)

Drills 1 to 8 with the shared Drill interface, seeded RNG, answer parsing in percent or ratio form, tolerance bands that always accept the taught shortcut.

UI: drill view with timer, session statistics and keyboard flow; sandbox with worker-based enumeration; live tables; four-colour deck toggle.

## Next: Phase 2

EV, implied odds, combinatorics and blockers, multiway support, villain profiles with a percentage range selector, drills 9 to 22, learn content, Leitner scheduling, persistence with export and import, timed mode, EV bankroll mode.
