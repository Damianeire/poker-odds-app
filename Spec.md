# Poker Odds Trainer: Build Handover

Prepared for: Claude Code (Fable 5.1)
Prepared by: planning session with Damian Evans
Status: specification, ready to build

---

## 1. What we are building

A local-first web app that teaches and drills the mathematics of No Limit Texas Hold'em. The user is not learning how to play poker. He is learning how to calculate, and then how to estimate quickly under time pressure, the odds that govern poker decisions.

The app has three modes:

1. Learn. Short concept pages with worked examples, each generated live from the engine so the numbers are always exact.
2. Drill. Randomised practice questions with a timer, tolerance-banded grading, and an explanation after every answer.
3. Sandbox. Free-form calculators where the user enters a situation and sees every relevant number at once, with the working shown.

A fourth layer, Progress, tracks accuracy per concept and schedules review.

### Design principle that governs everything

Nothing is hardcoded. Every probability, equity figure, break-even percentage and table entry is computed at runtime by the engine. Published odds charts are used only as test fixtures, never as app data. This matters because the pedagogical core of the app is showing where the mental shortcuts diverge from the truth, which requires the truth to be computed independently of the shortcut.

### Non-goals

- Not a GTO solver. No range-vs-range equilibrium solving, no CFR.
- Not a hand history importer or tracker.
- Not a bot, and no connection to any real or play-money poker site.
- No gambling promotion. The framing throughout is mathematical literacy and pattern recognition. Keep the copy neutral and instructional.

---

## 2. User profile

Assume an intermediate-to-advanced technical user who is a near-total beginner at poker.

- Comfortable with probability, combinatorics and expected value as abstract mathematics.
- Comfortable with scripting, the command line, GitHub and running local dev servers.
- Does not know poker jargon. Every poker term must be defined at first use, and defined again in a glossary.
- Wants structured logic and shortcuts he can actually execute in his head, not a wall of memorised tables.
- Dislikes filler, over-signposting and motivational padding. Copy should be dense and plain.

Practical consequence: the app must carry its own jargon-teaching load. Do not write copy that assumes the reader knows what a check-raise, a street, a nut flush or an overcard is.

---

## 3. Technology

Recommended stack:

- TypeScript, strict mode.
- Vite for the dev server and build.
- Preact (or plain TypeScript with a small render layer). Avoid heavyweight frameworks. No state management library.
- No backend. All state in `localStorage`, with JSON export and import so progress survives a browser reset.
- Vitest for unit tests.
- Deployable as a static site to GitHub Pages. Also has to work when opened from a local build with no network.

Rationale: a static site runs everywhere, deploys with no infrastructure, and is trivially portable into an Obsidian plugin webview later if that becomes interesting. Keep the engine a dependency-free TypeScript module with no DOM imports so it can be lifted out and reused.

Repository layout:

```
src/
  engine/        pure logic, zero DOM, zero framework imports
    cards.ts         card, rank, suit, deck, parsing, formatting
    evaluator.ts     7-card hand evaluator
    enumerate.ts     exact equity by full enumeration
    montecarlo.ts    sampled equity with confidence intervals
    outs.ts          out counting and out-based probability
    potodds.ts       pot odds, break-even equity, MDF, alpha
    ev.ts            EV of call, bet, bluff, semi-bluff
    implied.ts       implied and reverse implied odds
    combos.ts        combinatorics and blockers
    shortcuts.ts     rule of 2 and 4, Solomon correction, error reporting
  content/       concept pages as structured data, not free HTML
  drills/        one module per drill type, all implementing a shared interface
  srs/           scheduler and progress store
  ui/            views and components
tests/
```

---

## 4. The engine

### 4.1 Card model

52 cards. Ranks 2 to 14 (ace high, with ace-low handled inside straight detection). Suits c, d, h, s. Represent a card as a small integer (`rank * 4 + suit`) for speed, with parse and format helpers accepting the standard `As`, `Th`, `7d` notation.

### 4.2 Hand evaluator

A 7-card evaluator returning a single comparable integer score plus a category label. Any standard approach is fine (two-plus-two lookup table, or a straightforward categorise-and-rank implementation). Speed matters only enough to make full enumeration feel instant.

Validation targets, from exhaustive enumeration of all C(52,5) = 2,598,960 five-card hands:

| Category | Expected count |
| --- | --- |
| Straight flush (including royal) | 40 |
| Four of a kind | 624 |
| Full house | 3,744 |
| Flush (excluding straight flush) | 5,108 |
| Straight (excluding straight flush) | 10,200 |
| Three of a kind | 54,912 |
| Two pair | 123,552 |
| One pair | 1,098,240 |
| High card | 1,302,540 |

These sum to 2,598,960. If the evaluator reproduces this table exactly, it is correct. Make this a test, not a manual check.

Also assert C(52,7) = 133,784,560 as the enumeration space for a 7-card sanity test if you run one.

### 4.3 Equity

Two implementations, sharing one interface:

- `enumerate(hands, board, deadCards)`: exact, by iterating every possible runout. Feasible for heads-up on the flop (1,081 runouts) and turn (46). Preflop heads-up is 1,712,304 runouts, which is fine in a web worker but should show a progress state.
- `monteCarlo(hands, board, deadCards, trials)`: sampled, with a reported 95% confidence interval.

Both return win, tie and loss fractions per hand, and equity defined as win + tie/n for an n-way pot. Equities across all hands must sum to 1.0 within floating point tolerance. Assert this in tests.

Run enumeration in a web worker so the UI never blocks.

### 4.4 Outs

Two distinct capabilities, and the difference between them is a teaching point in its own right:

1. Automatic out detection. Given hero's hole cards and a board, enumerate every unseen card and classify it by whether it improves hero to a specified target category, or whether it wins against a specified villain hand or range. This is the honest definition of an out and the app should lead with it.
2. Manual out counting. The user states a number of outs; the app computes the resulting probability. This is the traditional table-based approach and is what the drills mostly test.

Probability formulas, with `u` unseen cards and `o` outs:

- One card to come: `P = o / u`. From the flop to the turn, u = 47. From the turn to the river, u = 46.
- Two cards to come, flop to river: `P = 1 - C(u - o, 2) / C(u, 2)` with u = 47.

The engine must expose both the "by the river" figure and the "on the next card" figure, because conflating them is the single most common beginner error and the app should trap it deliberately.

Also implement discounted outs: the user (or a drill) can mark some outs as tainted, meaning they complete hero's hand but plausibly give villain a better one. The engine treats this as a straightforward reduction in the out count, and the learn content explains why the reduction is a judgement call rather than arithmetic.

### 4.5 Shortcuts

Implement the shortcuts as first-class functions that return both the estimate and its signed error against the exact figure:

- Rule of 2: `outs x 2` approximates the chance of hitting on the next single card.
- Rule of 4: `outs x 4` approximates the chance of hitting by the river with two cards to come.
- Solomon's correction: when using the Rule of 4 with more than 8 outs, subtract 1 percentage point for each out above 8. Implement it and show its error alongside the raw rule's error, because the corrected version is materially better at high out counts and the app should demonstrate that rather than assert it.

Reference behaviour for two cards to come, which the engine should reproduce and the UI should be able to display as a live-generated table:

| Outs | Typical draw | Rule of 4 | Solomon | Exact |
| --- | --- | --- | --- | --- |
| 4 | Gutshot straight draw | 16% | 16% | 16.5% |
| 8 | Open-ended straight draw | 32% | 32% | 31.5% |
| 9 | Flush draw | 36% | 35% | 35.0% |
| 12 | Flush draw plus gutshot | 48% | 44% | 45.0% |
| 15 | Flush draw plus open-ender | 60% | 53% | 54.1% |

Treat the Exact column as the output of the engine, not as data to be entered. Use these as test assertions with a tolerance of 0.1 percentage points. The Rule of 4 and Solomon columns should fall out of the shortcut functions.

A second shortcut worth implementing: converting a percentage to an odds ratio, `(100 - p) : p`, since pot odds are conventionally quoted as ratios and the user needs to move between the two representations fluently.

### 4.6 Pot odds and defence frequencies

Given a pot `P` (not including villain's bet) and a bet `B` that hero faces:

- Cost to call: `B`.
- Odds offered: `(P + B) : B`.
- Break-even equity required to call: `B / (P + 2B)`.
- Minimum defence frequency, the share of hero's range that must continue to stop villain profiting with any two cards: `MDF = P / (P + B)`.
- Alpha, the share of the time a bluff must succeed to break even: `alpha = B / (P + B)`. Note `alpha = 1 - MDF`.

The app should be able to generate this reference table live for arbitrary sizings:

| Bet size (fraction of pot) | Equity needed to call | MDF | Alpha |
| --- | --- | --- | --- |
| 1/3 | 20.0% | 75.0% | 25.0% |
| 1/2 | 25.0% | 66.7% | 33.3% |
| 2/3 | 28.6% | 60.0% | 40.0% |
| 3/4 | 30.0% | 57.1% | 42.9% |
| Pot | 33.3% | 50.0% | 50.0% |
| 1.5x pot | 37.5% | 40.0% | 60.0% |
| 2x pot | 40.0% | 33.3% | 66.7% |

Verify these against the formulas in tests.

### 4.7 Expected value

- EV of a call: `EV = e x (P + B) - (1 - e) x B`, where `e` is hero's equity. Positive EV means call.
- EV of a pure bluff of size `B` into pot `P`, folding out villain with probability `f`: `EV = f x P - (1 - f) x B`. Break-even at `f = B / (P + B)`.
- EV of a semi-bluff, where hero bets `B` with equity `e` when called: `EV = f x P + (1 - f) x [e x (P + B) - (1 - e) x B]`. This is the formula that explains why drawing hands prefer betting to calling, and it deserves its own learn page.

Every EV function should return the component terms, not just the total, so the UI can show the decomposition.

### 4.8 Implied and reverse implied odds

Facing a bet `B` into pot `P` with equity `e` and insufficient immediate pot odds, the additional amount `X` hero must expect to win on later streets to make the call break even:

`X = B x (1 - e) / e - P - B`

Reverse implied odds are the mirror: the amount hero expects to lose on later streets in the cases where the draw completes but is still beaten, or where hero improves to a second-best hand. Model this as a user-supplied expected loss term subtracted from the implied gain, and be explicit in the copy that this input is an estimate, not a calculation.

Set mining is the canonical application. A pocket pair flops three of a kind or better 11.76% of the time. The engine should derive this rather than store it: `1 - C(48,3) / C(50,3)`. From there, derive the break-even implied odds for a given preflop call, and let the user compare that to the popular rule of thumb (effective stacks of roughly 15 times the call). Showing that the rule of thumb is a rough fit to a computed answer is more useful than teaching the rule of thumb alone.

### 4.9 Combinatorics and blockers

- A specific unpaired starting hand has 16 combinations: 4 suited, 12 offsuit.
- A specific pocket pair has 6 combinations.
- With `bx` cards of rank X and `by` of rank Y already visible: unpaired combos `= (4 - bx) x (4 - by)`; pair combos `= C(4 - bx, 2)`.
- Blocker effect: holding one card of a rank reduces villain's combinations of hands containing that rank, and the app should let the user see the size of that effect numerically rather than describe it in words.

Preflop dealing probabilities the engine should derive from C(52,2) = 1,326:

- A specific pocket pair: 6 / 1,326 = 0.45%, roughly 220 to 1 against.
- Any pocket pair: 78 / 1,326 = 5.88%, roughly 16 to 1 against.
- A specific unpaired hand such as ace-king: 16 / 1,326 = 1.21%.

Flop probabilities to derive and use as tests:

- Suited hole cards flopping a flush draw (exactly four of the suit): `C(11,2) x 39 / C(50,3)` = 10.94%.
- Suited hole cards flopping a made flush: `C(11,3) / C(50,3)` = 0.84%.
- Unpaired hole cards flopping at least a pair using a hole card: `1 - C(44,3) / C(50,3)` = 32.43%.
- Pocket pair flopping a set or better: 11.76%, as above.

---

## 5. Curriculum

Nine modules, each a short concept page plus a set of drills. Order matters: each module assumes the previous ones.

M1. Vocabulary, hand rankings and the shape of a hand
Street, hole cards, board, flop, turn, river, position, pot, bet, raise, call, fold, showdown. The ranking of the ten hand categories, and how a five-card hand is made from seven available cards. The user cannot count outs if he cannot yet see instantly that a board pairing turns a flush draw into a losing proposition against a full house, so this module must be drilled to fluency before M2 unlocks. The evaluator makes the drills for it almost free to build. Keep the written content to one page and resist the urge to teach strategy.

M2. Counting outs
Definition of an out. Standard counts: 9 for a flush draw, 8 for an open-ended straight draw, 4 for a gutshot, 6 for two overcards, 2 for a pair to trips, 7 for a set to a full house or better on the turn. Double-counting errors. Backdoor draws and why they are worth roughly one out. Dirty or tainted outs, and discounting.

M3. From outs to probability
The exact formulas. Next card versus by the river, and why the difference is large. Percentage versus odds ratio, and converting between them.

M4. The Rule of 2 and 4
The shortcut, its error profile, Solomon's correction, and the boundary conditions where the user should stop trusting it. This module exists to be the app's signature: the user should leave it able to estimate in his head and able to say how wrong he is.

It must also teach when the Rule of 4 is legitimate at all. Multiplying by 4 assumes hero sees both the turn and the river for the price of the current call, which is only guaranteed when villain is all-in. In a normal spot, calling on the flop buys one card, and villain will usually bet again on the turn. Using the Rule of 4 there overstates equity by roughly double and is one of the most expensive beginner errors available. Default to the Rule of 2, and treat the Rule of 4 as the all-in case. The app should refuse to let this pass quietly: at least one drill must present flop spots where villain is all-in and flop spots where villain is not, and grade on whether the user picked the right multiplier before it grades the arithmetic.

M5. Pot odds
Odds offered, break-even equity, the call or fold decision as a single comparison. The seven common bet sizings as a memorised anchor set. Both representations must be fluent: the literature and most poker writing quote odds as ratios (4 to 1 against a flush on the next card), while break-even thresholds are quoted as percentages, and the user needs to move between them without thinking.

Two named traps belong here. First, money already in the pot is not hero's money. Chips invested on earlier streets are sunk, and the decision compares the cost of this call against the pot as it now stands. Second, hero's own call is part of the final pot, which is why the denominator is `P + 2B` and not `P + B`.

This module also teaches tool selection. Pot odds are the correct tool when no further betting can occur: villain is all-in, or it is the river, or hero is considering a pure bluff. Everywhere else the answer depends on future streets and the correct tool is implied odds. Asking "which calculation does this spot call for" is a separate skill from performing the calculation, and it should be drilled separately.

M6. Equity
Equity as a concept distinct from outs. Hand versus hand. The classic matchups: pair against two overcards (roughly a coinflip, slightly favouring the pair), pair against two undercards, dominated hands where one card is shared, and the small but real value of suitedness. Compute all of these with the enumerator rather than quoting them. Equity realisation as a brief conceptual caveat: having equity and collecting it are not the same thing.

M7. Implied and reverse implied odds
When a call that fails on pot odds is still correct. The formula for the required future winnings. Stack depth as the limiting factor. Set mining as the worked case. Reverse implied odds and drawing to a hand that is not the nuts.

M8. Expected value, bluffs and defence
EV as the unifying frame. The break-even fold percentage for a bluff. Semi-bluff EV and why fold equity plus draw equity is more than either alone. Minimum defence frequency and alpha. Bluff-to-value ratios: on the river, a bettor sizing `B` into pot `P` makes the caller indifferent when bluffs make up `B / (P + 2B)` of the betting range, which is one third for a pot-sized bet.

M9. Combinatorics and blockers
Counting combinations of hands. How blockers change those counts. Using combination counts to reason about how often villain holds a given class of hand. This is the module that turns arithmetic into hand reading, so it is worth doing properly even though it is the least mechanical.

Optional M10, stretch scope only: tournament layer. Chip EV against monetary EV, ICM in outline, stack depth measured in big blinds, push and fold thresholds. Only build this if the first nine are complete and solid.

---

## 6. Drill catalogue

Every drill implements this interface:

```ts
interface Drill {
  id: string;
  module: ModuleId;
  generate(rng: Rng, difficulty: 1 | 2 | 3): DrillInstance;
}

interface DrillInstance {
  prompt: PromptSpec;         // structured, renderable as cards and text
  answer: number;             // exact value from the engine
  unit: 'percent' | 'ratio' | 'chips' | 'count';
  tolerance: number;          // absolute, in the answer's unit
  shortcutAnswer?: number;    // what the taught shortcut would give
  explanation: ExplanationSpec; // step by step, generated not written
}
```

Grading rule: an answer inside the tolerance band is correct. The tolerance should be wide enough that a correct application of the taught shortcut always passes. After grading, always show three numbers: the user's answer, the shortcut's answer, and the exact answer. This is the core learning loop.

Drills to build, roughly in the order they should be introduced:

1. Count the outs. Show hole cards and a flop, ask for the number of outs to a named target. Difficulty 3 adds a villain hand and asks for outs that actually win.
2. Outs to percentage, one card to come.
3. Outs to percentage, two cards to come.
4. Percentage to odds ratio, and the reverse.
5. Estimate with the Rule of 2 and 4, under a countdown timer.
6. Spot the error. Given an out count and a shortcut estimate, state how far off it is and in which direction.
7. Break-even equity for a given bet size.
8. Call or fold. Given a draw, a pot and a bet, decide, then justify with the two numbers being compared.
9. Bet sizing from the other side. Given a villain's draw, choose a bet size that prices it out.
10. MDF and alpha for a given sizing.
11. Bluff break-even fold percentage.
12. Semi-bluff EV, with fold equity supplied.
13. Implied odds. Given insufficient pot odds, state the future winnings required.
14. Set mining. Given a pair, a raise size and effective stacks, decide whether to call.
15. Combination counting, with and without blockers.
16. Equity estimation for classic preflop matchups, graded against the enumerator.
17. Dirty outs. Given a coordinated board, adjust a raw out count and justify the discount.
18. Multiway equity. The same hand and board against one, two and three opponents. Estimate each.
19. Multiway bluff. Given a bet size and a number of opponents, state the per-player fold frequency needed to break even.
20. Dead money. Given a pot built from folded contributions and calls, compute the price being offered.
21. Villain-dependent call. Identical hand, board and bet, with two different villain profiles. Decide for each and state which parameter flipped the answer.
22. Implied odds from observation. Given a described opponent tendency, set a payoff propensity and compute the resulting call threshold.
23. Hand ranking. Order five hand categories, or name the category of a given seven-card holding. Difficulty 3 uses boards where the best five cards use zero or one hole card.
24. Best hand. Two or three hole-card holdings and a five-card board. Say who wins, or whether it is a split pot.
25. Which multiplier. A flop spot with villain either all-in or not. Choose the Rule of 2 or the Rule of 4 before estimating, and be graded on the choice.
26. Which tool. A described spot. Say whether it is a pot odds calculation or an implied odds calculation, and why.

The numbers above are catalogue numbers. The app shows drills numbered in teaching order (by module, then catalogue order), so its numbers differ.

Drills 23 and 24 gate the rest. Require fluency on them before M2 unlocks, since out-counting is meaningless without instant hand reading.

All drills whose answer is a probability must accept the answer in either percentage or ratio form, and the post-answer explanation must show both.

Difficulty should vary by making numbers less round, boards more coordinated, and by tightening the timer, not by introducing new concepts.

Add a Timed Mode: twenty questions drawn across unlocked modules, scored on accuracy and median response time, with a session history. Speed is the actual skill being built once accuracy is reliable.

---

## 7. Progress and scheduling

Leitner-style spaced repetition is sufficient and much easier to reason about than SM-2. Five boxes with review intervals of 1, 2, 4, 8 and 16 days. A drill type advances a box on a correct answer inside tolerance and drops to box 1 on a miss.

Track per drill type: attempts, accuracy, median time to answer, and a rolling signed error so the user can see systematic bias (for example, consistently overestimating high-out draws).

Store everything in `localStorage` under one versioned key. Provide Export and Import as JSON. Include a schema version field from day one.

The Progress view should show one thing prominently: which concepts are weakest, ranked. Not a badge wall.

---

## 8. Interface

Keep it quiet and dense. Dark theme by default, high contrast, no animation beyond state transitions.

Card rendering: clear rank and suit glyphs, legible at small sizes since a drill prompt shows up to seven cards. Ship a four-colour deck (clubs green, diamonds blue, hearts red, spades black) as the default, with a settings toggle for the traditional two-colour deck. Four colours make flush draws readable at a glance, which matters while out-counting is still slow.

Every screen needs a persistent Show Working control that expands the full derivation of whatever number is on screen. The user should never encounter a figure he cannot trace.

Keyboard first. Numeric answer entry, Enter to submit, Space for next question, and a shortcut to reveal the explanation. A drill session should be completable without touching the mouse.

Sandbox mode is a single screen: enter hole cards, board, villain hand or range, pot and bet, and see outs, exact equity, shortcut estimate, pot odds, break-even equity, MDF, EV of calling, and implied odds requirement, all at once and all live.

Accessibility: suits must never be distinguished by colour alone, so include the suit glyph and a text label in the accessible name.

---

## 9. Correctness

This app is worthless if the numbers are wrong, and wrong numbers will not be obvious to the user. Testing is not optional.

- Evaluator: reproduce the five-card category frequency table exactly.
- Enumerator: equities across all hands sum to 1.0; enumeration and Monte Carlo agree within the Monte Carlo confidence interval; a hand against itself returns a tie.
- Outs: the two-cards-to-come formula agrees with a brute-force count over all C(47,2) runouts for every out count from 0 to 21.
- Pot odds and MDF: agree with the closed-form values in the table above.
- Combinatorics: the derived flop and preflop probabilities in section 4.9 match a brute-force enumeration.
- Shortcuts: error against exact is reported correctly in sign and magnitude.

Property-based tests are worth the effort here, particularly for the invariant that equities sum to one and that adding an out never decreases a probability.

---

## 10. Build phases

Phase 1, the spine. Card model, evaluator, enumerator, outs, shortcuts, pot odds. Sandbox mode. Drills 1 to 8. No SRS, no persistence beyond a session. Ship this and use it.

Phase 2, depth. EV, implied odds, combinatorics. Multiway support throughout. Villain profiles with a percentage-based range selector. Drills 9 to 22. Learn content for all nine modules. Leitner scheduling, persistence, export and import. Timed Mode and EV Bankroll mode.

Phase 3, optional. Variance mode and the paired equity curves. Boss rounds. Full range notation parsing (`JJ+, AQs+, KQo`). Seed sharing for two-player comparison. The tournament module, and an Obsidian plugin wrapper if that turns out to be wanted.

Do not start Phase 2 until the Phase 1 test suite is green.

---

## 11. Decisions resolved

1. Omaha is out of scope permanently. No Pot Limit Omaha, no five-card variants. Build the engine for Hold'em only and do not add abstraction layers in anticipation of other variants.
2. Learn content format is your call. Pick one, document the choice in the README, and be consistent. The requirement that matters is that no figure in the content is ever a literal: every number must be interpolated from an engine call at render time.
3. Four-colour deck is a toggle, defaulting to on. Clubs green, diamonds blue, hearts red, spades black. The traditional two-colour deck is the alternative setting. Persist the choice.

---

## 12. Multiway pots

The app must handle pots with more than two players. This is not a cosmetic extension. Almost every number in the spec behaves differently multiway, and the differences are exactly the sort of thing a beginner gets wrong.

What changes, and what the engine must do about it:

Equity collapses. The enumerator already takes an array of hands, so support this properly rather than special-casing heads-up. A hand that is a favourite against one opponent is often an underdog against three, and the app should let the user watch that happen by adding opponents one at a time to the same hand.

Outs get dirtier. More opponents means a higher chance that a card completing hero's draw also completes someone else's better hand. This is a judgement input, not a calculation, but the app should prompt for it: when a drill is multiway, the discount step becomes mandatory rather than optional.

Pot odds improve. Money from players who have already folded, and calls from players between hero and the bettor, are dead money that sweetens the price. The pot odds formula is unchanged; the inputs change. Make the sandbox accept the pot as a set of contributions rather than one figure, so the user sees where the price is coming from.

Action behind is a real cost. Calling with players still to act carries the risk of a raise that forces a fold, forfeiting the call. Model this as an optional probability input that discounts the EV of a call. Do not overbuild it; one slider and a clear explanation is enough.

Bluffing scales badly. A bluff must get through every opponent. If each folds independently with probability `f`, the bluff succeeds with probability `f^n`. The break-even threshold `B / (P + B)` does not move, but reaching it against three players requires each to fold roughly 80% of the time for a pot-sized bet that would only need 50% heads-up. This deserves its own learn page and its own drill, because it is counter-intuitive and expensive.

Minimum defence frequency degrades. MDF is a heads-up construct. Multiway, the defence burden is shared and no individual player's continuing frequency follows from the formula. State this limitation explicitly in the content rather than quietly presenting a multiway MDF number, which would be misleading.

Engine requirements: a `players` parameter on all relevant functions, defaulting to 2. Equity functions already generalise. Bluff EV needs an `opponents` count and an independent-folding assumption that the copy flags as a simplification.

---

## 13. Villain profiles

Player type is not separate from the maths. It is where the estimated inputs to the formulas come from. A loose passive opponent and a tight aggressive one produce different numbers out of the same equations, and the app should make that mechanism visible rather than leaving "read your opponent" as folk wisdom.

Implement a villain profile as four parameters, each feeding a specific term already in the engine:

| Parameter | Range | Feeds |
| --- | --- | --- |
| Range width | 5% to 100% of starting hands | Hero's equity against villain's range |
| Fold frequency to a bet | 0 to 1 | `f` in bluff and semi-bluff EV |
| Payoff propensity | expressed as expected additional chips won on later streets when hero's draw completes, as a multiple of the current pot | `X` in the implied odds calculation |
| Aggression | 0 to 1 | Reverse implied odds, and the probability of action behind |

Provide three or four presets as starting points (loose passive, tight passive, loose aggressive, tight aggressive), but make the sliders primary. The presets are a teaching scaffold, not the feature.

The pedagogical payoff is a single screen showing the same hand, the same board and the same bet, with the decision flipping from fold to call as the payoff propensity slider moves. That one interaction teaches implied odds better than any amount of prose.

Honest caveat to put in the copy: the four parameters are estimates the user makes from observation, and the output is only as good as they are. The app calculates precisely from imprecise inputs. Say this plainly once, in the villain profile page, and do not repeat it everywhere.

Range width requires range support, which section 10 places in Phase 3. Move a minimal version forward into Phase 2: a percentage-based top-of-range selector with a static hand ranking table is enough to make the equity-against-range number work. Full range notation parsing can stay in Phase 3.

---

## 14. Game mechanics

The app needs to be enjoyable enough to be used repeatedly, but points and badges awarded for participation are noise. Build mechanics that are themselves the lesson.

### 14.1 EV Bankroll mode, the headline feature

The user starts a session with a stack of 100 big blinds and faces a continuous stream of decisions. After each decision, the stack moves by the expected value of the choice made, not by the outcome of the hand.

Choose correctly and the stack rises by the EV gained. Choose the second-best option and the stack falls by the EV surrendered relative to the best available line. A session is scored as big blinds won or lost per 100 decisions.

This is the right central mechanic for three reasons. It is a real score that goes up and down, which is what makes something a game. It is decision quality rather than results, which is the hardest lesson in poker and is built into the scoring rather than lectured about. And it makes the cost of a mistake concrete: the user sees that misjudging a pot-odds call costs a specific number of chips.

### 14.2 Variance mode, unlocked after EV Bankroll

The same stream of decisions, but the hands are dealt out and the stack moves by the actual result. Run the identical decision sequence in both modes and show the two equity curves on one chart.

The point is to let the user watch correct decisions lose money over a short run. Cap it at a session length where divergence is obvious, and show the EV curve as the reference line. This is the antidote to the single most common failure in learning poker, which is updating strategy from results rather than from reasoning.

### 14.3 Supporting mechanics

Calibration score. Track the signed error on every estimate, and surface a single number: the median absolute error across the last fifty estimates, in percentage points. It should visibly shrink over weeks. This is a better progress metric than accuracy because it keeps improving after the user is already getting most answers right.

Ghost racing. Replay the user's own median response time for a drill type as a countdown bar. Beating your own previous speed is more motivating than an arbitrary target and it self-calibrates.

Session streaks, not day streaks. Consecutive correct answers within a session, reset at the end. Daily streaks manufacture obligation and punish a missed day, which is the wrong incentive for something that should be picked up when useful.

Boss rounds. Once a module's drills are consistently passed, offer a mixed sequence of eight to twelve decisions from a single simulated hand played from preflop to river, scored in EV. This is where isolated calculations become a sequence of connected choices.

What not to build: badges, levels, experience points, achievement walls, confetti, congratulatory copy. The score is the stack and the calibration number. Keep the feedback informational.

### 14.4 Two-player option

Since the intended user has people to play against: allow a session seed to be exported as a short code. Two people running the same seed get the identical decision sequence and can compare EV scores afterwards. No backend, no accounts, no live sync. A shared seed and an exported result file is the whole feature.

---

## Appendix A: formula reference

| Quantity | Formula |
| --- | --- |
| Hit on next card | `o / u`, u = 47 on the flop, 46 on the turn |
| Hit by river, two cards | `1 - C(47 - o, 2) / C(47, 2)` |
| Rule of 2 | `o x 2` |
| Rule of 4 | `o x 4` |
| Solomon's correction | `o x 4 - max(0, o - 8)` |
| Percent to odds against | `(100 - p) : p` |
| Pot odds offered | `(P + B) : B` |
| Equity needed to call | `B / (P + 2B)` |
| Equity needed to call, with implied odds | `B / (P + 2B + X)` |
| Minimum defence frequency | `P / (P + B)` |
| Alpha | `B / (P + B)` |
| EV of call | `e(P + B) - (1 - e)B` |
| EV of bluff | `fP - (1 - f)B` |
| EV of semi-bluff | `fP + (1 - f)[e(P + B) - (1 - e)B]` |
| Implied odds requirement | `B(1 - e)/e - P - B` |
| River bluff share of range | `B / (P + 2B)` |
| Unpaired hand combos | `(4 - bx)(4 - by)` |
| Pocket pair combos | `C(4 - b, 2)` |

Notation: `o` outs, `u` unseen cards, `P` pot before villain's bet, `B` bet faced or made, `e` hero equity, `f` probability villain folds, `b` blockers.

## Appendix B: glossary to implement in-app

Backdoor draw, blocker, board, combo, dominated, equity, effective stacks, fold equity, gutshot, hole cards, implied odds, nuts, open-ended straight draw, out, overcard, pot odds, position, range, reverse implied odds, semi-bluff, set, set mining, street, tainted out, value bet.

Each entry needs a one-sentence definition and, where the term is quantitative, a link to the module that computes it.
