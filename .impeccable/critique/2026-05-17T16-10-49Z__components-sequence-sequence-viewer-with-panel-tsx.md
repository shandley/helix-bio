---
target: sequence viewer with panel
total_score: 27
p0_count: 0
p1_count: 2
timestamp: 2026-05-17T16-10-49Z
slug: components-sequence-sequence-viewer-with-panel-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Annotation worker spinner, running state, stale-cache banner, and per-primer copy confirmation all present; Diagnose and Plots buttons carry no loading feedback after click. |
| 2 | Match System / Real World | 3 | Terminology is domain-correct throughout; "Search ±" reads like an internal code name rather than plain English. |
| 3 | User Control and Freedom | 3 | Cancel, Escape, Back to library, Back to primers, mode result cache all present; annotation rename has no Undo. |
| 4 | Consistency and Standards | 2 | Three different disclosure triangle patterns; two-row tab bar (structural, 244px panel) — most jarring consistency failure. |
| 5 | Error Prevention | 3 | Two-step delete confirm, smart input constraints, assembly auto-opens Options; Start/End inputs give no live boundary warning as user types. |
| 6 | Recognition Rather Than Recall | 2 | Tooltips on Options labels are hover-only and not keyboard-accessible; Alt+1–7 shortcut numbers don't map visually to the two-row tab layout. |
| 7 | Flexibility and Efficiency of Use | 3 | Alt+1–7, Enter, ↑↓, Escape, click-to-copy, auto-design on annotation click, quick-fix buttons — solid expert layer; no bulk pair export. |
| 8 | Aesthetic and Minimalist Design | 3 | Manuscript palette is distinctive and consistent; keyboard hint at 7.5px / 1.7:1 contrast is near-invisible and fails WCAG AA. |
| 9 | Error Recovery | 3 | Mode-aware error messages, worker crash distinguished, quick-fix buttons for qPCR; Assembly has no quick-fix button for "no pairs found." |
| 10 | Help and Documentation | 2 | Only contextual help is title-tooltips; no inline explanation for Diagnose, no keyboard-accessible help, AI panel not surfaced at point of confusion. |
| **Total** | | **27/40** | **Acceptable** |

## Cognitive Load: 3 failures (moderate)
FAILED: Single focus (simultaneous controls+results+banner+hint+action bar); Visual hierarchy (Design button and results share equal weight); Minimal choices (7 equal-weight tabs, 6+ simultaneous items in results area).

## Priority Issues
- P1: Two-row tab bar (structural, 244px, non-obvious Alt shortcut mapping)
- P1: Keyboard hint at 1.7:1 contrast (7.5px Courier, #b8b0a4 on #f5f0e8)
- P2: Hover-only tooltips, not keyboard-accessible (title attribute only)
- P2: No Assembly quick-fix button for "no pairs found" (qPCR has two)
- P2: Diagnose button gives no loading feedback after click (2-8s gap)

## Minor
- Playfair used in panel headers (AI, Primers) — violates Playfair Boundary Rule
- AssemblyPairCard copy button missing title attribute
- × Cancel reads as "times Cancel" for screen readers
