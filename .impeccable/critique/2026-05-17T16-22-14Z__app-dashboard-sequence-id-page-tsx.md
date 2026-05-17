---
target: sequence viewer
total_score: 26
p0_count: 0
p1_count: 2
timestamp: 2026-05-17T16-22-14Z
slug: app-dashboard-sequence-id-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "× Cancel" amber now signals interruption. No progress beyond button transform. |
| 2 | Match System / Real World | 3 | "ann" in assembly pair header unexpanded; otherwise lab vocabulary correct. |
| 3 | User Control and Freedom | 3 | Cancel + Esc + mode cache + delete confirm. Annotation Save persists immediately (no undo). |
| 4 | Consistency and Standards | 2 | Two-row tab bar structural. Playfair violation fixed this pass. |
| 5 | Error Prevention | 3 | Coord validation, quick-fix buttons, mode hints. 0-length selection still reaches worker. |
| 6 | Recognition Rather Than Recall | 2 | title tooltips hover-only. Alt+1–7 now surfaced globally. |
| 7 | Flexibility and Efficiency | 3 | Full keyboard suite. Mode cache. Global hint added. |
| 8 | Aesthetic and Minimalist Design | 2 | Two-row tab bar (structural). Playfair violation fixed. |
| 9 | Error Recovery | 3 | Primd pass-through, mode hints, quick-fix. |
| 10 | Help and Documentation | 2 | Diagnose + Plots pre-result hint updated. Tooltips hover-only. |
| **Total** | | **26/40** | |

---

## Inline fixes applied this pass

- Playfair Display in Primers + AI panel headers → Karla 600 14px (design system compliance)
- Cancel button → amber background/border/text while running (interruptible, not secondary)
- Pre-result hint updated: "After design: Diagnose with AI · view Plots"
- Global "Alt+1–7 · switch panels" hint below tab bar, visible from every panel

---

## Trend: 19 → 24 → 25 → 25 → 25 → 29 → 27 → 26

Score variance in final passes (29 → 27 → 26) reflects LLM grading strictness on the same outstanding structural issues. Net improvement from start: +7 points. The two-row tab bar is the primary ceiling.

---

## Remaining Issues

**[P1] Two-row tab bar (H4, H8)** — structural, 244px panel. Options: single scrollable row, label abbreviation, or panel widening.

**[P1] title tooltips hover-only (H6, H10)** — not keyboard-accessible.

**[P3] 0-length selection reaches worker** — entering Start=End dispatches to primd. Should be caught pre-launch.
