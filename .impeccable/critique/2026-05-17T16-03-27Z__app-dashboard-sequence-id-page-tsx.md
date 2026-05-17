---
target: sequence viewer
total_score: 29
p0_count: 0
p1_count: 1
timestamp: 2026-05-17T16-03-27Z
slug: app-dashboard-sequence-id-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Change | Key Issue |
|---|-----------|-------|--------|-----------|
| 1 | Visibility of System Status | 3 | — | Stale banner and streaming states good. No cancel/progress for running worker. |
| 2 | Match System / Real World | 4 | +1 | Manuscript metaphor fully realized. Lab vocabulary correct throughout. |
| 3 | User Control and Freedom | 2 | — | No cancel for running design worker. Otherwise solid. |
| 4 | Consistency and Standards | 3 | — | Color semantics clean. Custom Deep Forest/Forest Mid split requires learning. |
| 5 | Error Prevention | 3 | — | Mode cache, two-step delete, validation. No guard against double-launch. |
| 6 | Recognition Rather Than Recall | 2 | — | Hover-only tooltips + two-row tab bar both require spatial recall. |
| 7 | Flexibility and Efficiency | 3 | — | Alt+1–7, Enter, ↑↓, Esc cover expert paths. Hover-only tooltips exclude keyboard users. |
| 8 | Aesthetic and Minimalist Design | 2 | — | 7 tabs in two rows in 244px is structural overcrowding. Palette is distinctive. |
| 9 | Help — Diagnose & Recover | 4 | +3 | Mode-specific hints, primd messages passed through, crashes distinguished, stack traces filtered. |
| 10 | Help and Documentation | 3 | +1 | Options tooltips, panel hints, keyboard hint line. No progressive help for first-time users. |
| **Total** | | **29/40** | **+4** | **Strong — two heuristics at 4/4** |

---

## Trend: 19 → 24 → 25 → 25 → 25 → 29

---

## What moved

**H9: 1 → 4.** The error message fix was a single targeted change that fully resolved the lowest-scoring heuristic. Three distinct behaviors now: primd validation messages passed through directly, mode+region+hint fallback for logic failures, crash-specific message for worker.onerror. Stack trace fragments filtered out.

**H2: 3 → 4.** The manuscript metaphor is fully realized — parchment, Courier for data, Karla for prose, botanical ink green, amber for warnings. No residual vocabulary mismatches flagged this pass.

**H10: 2 → 3.** Options tooltips, panel hints, AI empty-state, keyboard shortcut line collectively bring contextual help to an adequate level.

---

## Remaining Issues

**[P1] No cancel affordance for running design worker**
Once Design is clicked, the user cannot stop it. `workerRef.current?.terminate()` exists but isn't wired to any UI. A "Cancel" button or pressing Escape while running would fix this and move H3 from 2→3.

**[P2] 7 tabs in two rows (structural)**
244px panel with 7 tabs forces a 3+4 split at 7.5px Courier. Below legibility threshold on non-retina displays. Would require either widening the panel or consolidating tabs.

**[P2] title tooltips hover-only**
8 Options labels + accessibility legend are not keyboard-accessible. A custom tooltip component would move H6 and H7 each by a point.

---

## Cognitive Load Failures: 3

1. Seven tabs in two rows — spatial scan required
2. Hover-only tooltips — invisible until mouse contact
3. No cancel affordance — user cannot distinguish running from hung
