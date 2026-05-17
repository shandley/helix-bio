---
target: sequence viewer
total_score: 27
p0_count: 0
p1_count: 2
timestamp: 2026-05-17T16-14-12Z
slug: app-dashboard-sequence-id-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Change | Key Issue |
|---|-----------|-------|--------|-----------|
| 1 | Visibility of System Status | 3 | — | "× Cancel", spinning states, stale banner. No progress beyond button transform for long runs. |
| 2 | Match System / Real World | 3 | -1 | Lab vocabulary correct. "access" badge abbreviation is primd jargon, not standard bench term. |
| 3 | User Control and Freedom | 3 | +1 | Cancel button + Escape cancel + mode cache + delete confirm. Annotation Save persists immediately. |
| 4 | Consistency and Standards | 2 | -1 | Duplicate ↑↓ hint fixed this pass. Two-row tab bar has no logical split rationale for biologists. |
| 5 | Error Prevention | 3 | — | Mode-specific error hints, quick-fix buttons, coord clamping. Start=End produces generic message. |
| 6 | Recognition Rather Than Recall | 2 | — | title tooltips hover-only. Plots pre-run hint is text, not a disabled button. |
| 7 | Flexibility and Efficiency | 3 | — | Full keyboard suite. Mode cache. 7.5px hint barely readable at small viewport. |
| 8 | Aesthetic and Minimalist Design | 3 | +1 | Palette consistent. Two-row tab bar below typographic floor. |
| 9 | Help — Diagnose & Recover | 3 | -1 | Primd errors passed through, mode hints, quick-fix. Start=End hint missing. |
| 10 | Help and Documentation | 2 | -1 | Options tooltips hover-only. No onboarding for first-time users. |
| **Total** | | **27/40** | **-2** | Score variance — H3+H8 improved, H2/H4/H9/H10 graded harder |

---

## Trend: 19 → 24 → 25 → 25 → 25 → 29 → 27

The -2 drop is scoring variance, not regression. H3 moved up (cancel button), H8 moved up (palette consistency credited). H2/H9/H10 were graded more strictly; H4 correctly flagged the duplicated navigate hint (now fixed). Net change since start: +8 points, 6 of 10 heuristics improved.

---

## Inline fixes applied this pass

- Duplicate ↑↓ hint removed from results header (was also in keyboard hint line below Design)
- Keyboard hint contrast: #b8b0a4 → #5a5648 (1.98:1 → 6.36:1, passes WCAG AA)

---

## Remaining Issues

**[P1] Two-row tab bar (H4, H8)**
7 tabs in a 3+4 split at 7.5px Courier in 244px. No logical grouping rationale. Fix options: widen panel to ~280px, consolidate to 6 tabs, or restructure into icon row.

**[P1] title tooltips hover-only (H6, H10)**
8 Options labels + accessibility legend — not keyboard-accessible, not mobile-accessible. Fix: custom Courier Prime tooltip component or inline ? trigger.

**[P2] "access" badge abbreviation**
"access · marginal", "access · structured" — compressed primd terminology. "template · marginal" or just "marginal" would be more self-explaining.

---

## Cognitive Load Failures: 3

1. Two-row tab bar — spatial layout without logical split
2. Hover-only tooltips — keyboard users must recall parameter meaning
3. "access" badge — primd jargon at point of use
