---
target: sequence viewer
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-05-17T03-13-42Z
slug: app-dashboard-sequence-id-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Stale banner and worker states good. No cancel affordance for running design. |
| 2 | Match System / Real World | 3 | Lab vocabulary correct. "wraps origin ↻" tooltip explains implementation, not biology. |
| 3 | User Control and Freedom | 3 | Mode cache + annotation delete confirm. No cancel for in-flight design worker. |
| 4 | Consistency and Standards | 3 | Color semantics clean. Diagnose (filled) vs Plots (outline) are peer actions with different affordance weight. |
| 5 | Error Prevention | 2 | Quick-fix stale-closure confirmed and fixed this pass. Generic primer fail message unchanged. |
| 6 | Recognition Rather Than Recall | 3 | Plots hint, 8 tooltips, stale banner. Seq-line click-to-copy has no visible affordance. |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts. 7-tab two-row layout. No panel resize. No batch export. |
| 8 | Aesthetic and Minimalist Design | 3 | Theme disciplined. Assembly pair card header dense at 244px. |
| 9 | Help — Diagnose & Recover | 2 | Deletion now safe. Quick-fix buttons now fire with correct params. Generic errors unchanged. |
| 10 | Help and Documentation | 2 | Options tooltips substantive. AI tab has no purpose hint before first message. |
| **Total** | | **25/40** | **Above average** |

---

## Anti-Patterns Verdict

Detector: clean (0 findings). No new anti-patterns introduced this pass.

---

## Confirmed runtime bug fixed this pass

Quick-fix buttons ("Relax ΔTm (+1°)" and "Widen Amplicon") called `setMaxTmDiff(next)` then immediately called `design()`. Because `design` is a useCallback whose closure captured the old parameter values, the retry always ran with the pre-relaxation parameters — a silent no-op. Fixed by adding an optional `overrides` parameter to `runDesign` and `design`; quick-fix buttons compute the next values as local constants and pass them explicitly.

---

## Remaining Issues

**[P1] No keyboard shortcuts** — affects H7 directly. Minimum viable: Enter to run Design, Tab to move through Start/End/Design, arrow keys to cycle ranked primer pairs.

**[P1] Generic primer design error** — "Primer design failed. Check your sequence." provides no recovery path. Should name the failing mode, region, and hint at the likely cause.

**[P2] No cancel affordance for running design worker** — user is locked in once Design is clicked.

**[P2] AI tab has no purpose hint before first message** — a one-line placeholder ("Ask a question about this sequence") would reduce recall burden.

**[P2] Diagnose (filled) vs Plots (outline) inconsistency** — peer actions in the same bottom bar have different visual weight with no semantic reason for it.

**[P2] title tooltips are hover-only** — not keyboard-accessible or mobile-accessible.

---

## Cognitive Load Failures: 6

1. Two-row tab bar at 7.5px Courier in 244px — row-scan before every task switch
2. Seq-line click-to-copy — no visible affordance; must be discovered
3. Diagnose vs Plots fill inconsistency — false affordance hierarchy
4. Generic primer design error — no recovery path
5. AI tab — user must open to learn what it does
6. Options non-defaults have no persistent indicator
