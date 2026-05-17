---
target: sequence viewer
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-05-17T15-44-26Z
slug: app-dashboard-sequence-id-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Change | Key Issue |
|---|-----------|-------|--------|-----------|
| 1 | Visibility of System Status | 3 | — | Stale banner, worker states, "Designing…" all good. No cancel for running worker. |
| 2 | Match System / Real World | 3 | — | Lab vocabulary correct. "Align" tab names the implementation not the task. |
| 3 | User Control and Freedom | 2 | — | Mode cache + delete confirm good. Escape scope tightened this pass. No cancel for running design. |
| 4 | Consistency and Standards | 3 | — | Color discipline clean. "Ask Ori" / "AI" dual naming fixed this pass. |
| 5 | Error Prevention | 3 | +1 | Two-step delete, quick-fix stale-closure fixed, coordinate clamping. Generic fail message unchanged. |
| 6 | Recognition Rather Than Recall | 2 | — | title tooltips hover-only; keyboard shortcuts added but tooltip discoverability unchanged. AI empty state added this pass. |
| 7 | Flexibility and Efficiency | 3 | +2 | Alt+1–7 tabs, Enter to design, ↑↓ pair navigation, Escape to clear. |
| 8 | Aesthetic and Minimalist Design | 3 | — | Theme consistent. Two-row tab bar at 7.5px structural. |
| 9 | Help — Diagnose & Recover | 1 | — | Generic "Primer design failed. Check your sequence." with no cause or recovery unchanged. |
| 10 | Help and Documentation | 2 | — | Options tooltips substantive. AI empty state added. tooltip accessibility gap remains. |
| **Total** | | **25/40** | **+0** | **Above average — H7 +2, H5 +1, H3 -1 net** |

---

## Trend: 19 → 24 → 25 → 25 → 25

Score stable at 25. Heuristic distribution improving — H5 now at 3, H7 now at 3, five heuristics at 3/4. H9 at 1 is the floor that prevents further gains without fixing error messages.

---

## Inline fixes applied this pass

- "Ask Ori" panel header → "AI" (matches tab label)
- AI panel empty state: one-sentence hint before first message
- Escape guard: added contenteditable check to prevent accidental result clearing

---

## Remaining Issues

**[P1] Generic primer design error messages**
"Primer design failed. Check your sequence." for both worker crash and valid primd failure. No cause, no mode, no region, no suggested fix. This single issue caps H9 at 1 and costs approximately 2 total points.

**[P1] No cancel affordance for running design worker**
Once Design is clicked, the user cannot abort. `workerRef.current?.terminate()` exists but isn't exposed.

**[P2] title tooltips hover-only**
8 Options tooltips keyboard-inaccessible. A custom Courier Prime tooltip component would fix this and move H6 and H10.

**[P2] Two-row tab bar**
7 tabs in two rows at 7.5px Courier in 244px panel. Second row 4 tabs at ~61px wide. Structural.

---

## Cognitive Load Failures: 4

1. Two-row tab bar requires spatial-to-shortcut mental mapping (Alt+4 is row 2, tab 1).
2. Generic primer error — user cannot determine cause or next action.
3. No cancel for running design — user must wait or reload.
4. Options non-default values have no persistent indicator between sessions.
