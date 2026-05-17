---
target: sequence viewer panel
total_score: 26
p0_count: 0
p1_count: 0
p2_count: 4
p3_count: 1
timestamp: 2026-05-17T16-19-55Z
slug: components-sequence-sequence-viewer-with-panel-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Cancel button reads as disabled (flat parchment style) rather than "running"; no spinner on Design button itself |
| 2 | Match System / Real World | 3 | "ann" (annealing Tm) in AssemblyPairCard has no tooltip; "muted =" in pair header misuses audio vocabulary for a visual distinction |
| 3 | User Control and Freedom | 3 | No revert-to-original affordance after annotation save; only delete + re-edit path available |
| 4 | Consistency and Standards | 2 | Playfair Display used in panel headers (Primers, AI) — explicit violation of the Playfair Boundary Rule; panel headers should use Karla 600 |
| 5 | Error Prevention | 3 | Coordinate inputs validate only on submit, not on blur; 0-length region still dispatches to worker |
| 6 | Recognition Rather Than Recall | 2 | Alt+1-7 shortcuts not surfaced outside Primers panel; Diagnose button has no pre-result discovery path |
| 7 | Flexibility and Efficiency of Use | 3 | No batch-copy for all pairs; no region history; otherwise strong (click-to-copy, quick-fix buttons, keyboard nav) |
| 8 | Aesthetic and Minimalist Design | 2 | Two-row tab bar (structural issue, 244px panel); keyboard hint line occupies permanent space; Playfair in panel headers adds visual dissonance |
| 9 | Error Recovery | 3 | qPCR quick-fix buttons inline with error are excellent; gap: primd pass-through filter can suppress valid short error messages |
| 10 | Help and Documentation | 2 | Field-level tooltips strong; no workflow-level help for annotation provenance, assembly method choice, or Diagnose feature |
| **Total** | | **26/40** | **Acceptable — targeted improvements needed** |

## Priority Issues

**[P2] Playfair Display in panel headers**
Primers and AI panel headers use `var(--font-playfair)` at 15px. DESIGN.md states explicitly: "Playfair Display is prohibited inside the app shell... title-level text uses Karla 600." This is not a minor deviation; it undermines the typographic system's rule that Playfair's authority comes from scarcity. Fix: change both panel header spans to `font-family: var(--font-karla); font-weight: 600; font-size: 15px`.

**[P2] Two-row tab bar structural problem**
Seven tabs in 244px forces a two-row layout. Row 1 has 3 tabs at ~81px each; row 2 has 4 tabs at ~61px each — visually asymmetric and consuming 44px of panel height before any content. Fix: collapse to a scrollable single row with overflow-x: auto and hidden scrollbar, or reduce tab label to shortest unambiguous abbreviation (Enz / PCR / Dig / Aln / ORF / Find / AI) to fit in one row at 7.5px.

**[P2] Alt+1-7 shortcuts not globally surfaced**
The keyboard hint "⏎ design · ↑↓ navigate · Esc cancel/clear" appears only in the Primers panel. Alt+1-7 tab switching works from any panel but is only discoverable via title hover on tab buttons. A researcher who lands in the Enzymes or Digest panel will not find it. Fix: add "Alt+1-7 tabs" to a single persistent hint line visible at the bottom of the panel shell, or add it to the tab bar's aria-label region.

**[P2] Diagnose has no pre-result discovery**
The "Plots" hint ("available after design") correctly primes users for what to expect. "Diagnose" has no equivalent — it appears in the bottom bar only after results exist, with only a title tooltip. Users who don't hover the button won't know it exists. Fix: add a grayed hint below the Design button ("After design: Diagnose with AI · view Plots") consistent with the existing Plots hint pattern.

**[P3] Cancel button visual state ambiguous**
During a running design, the "× Cancel" button has parchment background and ash border — identical to a disabled or secondary state. The user's primary affordance when running is to cancel, but the button doesn't signal urgency or activity. Fix: use amber border + amber text color (consistent with warning/action palette) during the running state, or add a small spinner adjacent to the button to indicate the active process.

## Cognitive Load Failures

Two moderate failures:
1. **Two-row tabs** — users must scan two rows to find a tab, doubling the visual search space in a 244px panel. This is the most persistent structural source of cognitive overhead.
2. **Diagnose discoverability gap** — users who complete a design run and want AI help must know to look for a button that wasn't visible before. The mental model requires predicting that post-result affordances will appear, which is not primed anywhere before the first design run.
