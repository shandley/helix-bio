---
target: sequence viewer
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-05-17T02-14-04Z
slug: app-dashboard-sequence-id-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Change | Key Issue |
|---|-----------|-------|--------|-----------|
| 1 | Visibility of System Status | 3 | — | Stale-results amber banner is a genuine status signal. No cancel affordance during design run. |
| 2 | Match System / Real World | 3 | +1 | Lab vocabulary correct throughout. "access · structured" badge jargon-compressed. |
| 3 | User Control and Freedom | 2 | +1 | Mode cache restores results across switches. Annotation delete still irrecoverable. No keyboard shortcuts. |
| 4 | Consistency and Standards | 3 | +1 | Color semantics clean throughout. Two-row tab bar has unequal widths. |
| 5 | Error Prevention | 2 | — | Assembly auto-opens Options. Delete still no confirm. Quick-fix potential stale-closure. |
| 6 | Recognition Rather Than Recall | 3 | +1 | Plots hint, tooltips, stale banner all add recognition cues. title hover-only. |
| 7 | Flexibility and Efficiency | 2 | — | Mode cache is an efficiency gain. No keyboard shortcuts. No panel resize. |
| 8 | Aesthetic and Minimalist Design | 3 | +1 | Consistent color discipline. box-shadow on accessibility track tooltip (fixed inline). |
| 9 | Help — Diagnose & Recover | 2 | — | qPCR quick-fix buttons excellent. Generic fail messages unchanged. Delete irrecoverable. |
| 10 | Help and Documentation | 2 | — | title tooltips substantive but hover-only. No workflow documentation. |
| **Total** | | **25/40** | **+1** | **Above average** |

---

## Anti-Patterns Verdict

Clean. Automated detector: 0 findings. box-shadow on accessibility track tooltip fixed inline (replaced with border on dark tooltip, outline on track container). No new layout-animation anti-patterns.

---

## Overall Impression

Score of 25/40 reflects a viewer that is coherent, distinctive, and functionally solid for its primary users. The mode-result cache removed the most concrete daily-use friction. Four heuristics now sit at 3/4 (H1, H2, H4, H6, H8) where they were at 1–2 previously. The ceiling is H3, H7, H9, H10 at 2/4 each — all held down by the same two structural gaps: no keyboard shortcuts and irrecoverable annotation delete.

---

## What's Working

**Mode-result cache.** PCR → qPCR → PCR now restores results. The stale banner communicates exactly what happened and what to do. This is the right UX pattern for a multi-mode tool where comparison is the workflow.

**Color discipline.** Deep Forest = interactive only, Forest Mid = positive-state, Amber = warning. Consistent across every panel. Verified clean in this pass.

**qPCR failure recovery.** One-click "Relax ΔTm" and "Widen Amplicon" with parameter disclosure remains the best-executed pattern in the product.

---

## Remaining Priority Issues

**[P1] Annotation delete is irrecoverable and immediately persisted**
handleOverrideDelete → Supabase write with no confirm, no undo window. The Delete button is adjacent to Cancel in the AnnotationEditor form. One mis-click permanently removes a user-edited annotation with no recovery. Fix: two-step confirm OR a 5-second undo toast before persisting.

**[P1] No keyboard shortcuts**
No Cmd+D to trigger Design, arrow keys to cycle pairs, Cmd+Enter to save annotation editor. Against SnapGene's keyboard-driven workflow this is a power-user friction point that cannot be addressed with UI changes alone.

**[P2] Quick-fix button stale-closure risk**
"Relax ΔTm (+1°)" and "Widen Amplicon" call setMaxTmDiff/setQpcrAmpliconMin then invoke design() — but design() is a useCallback whose closure captures parameter state at creation time. If the state update hasn't flushed before design() reads from it, the retry runs with pre-relaxation values. Verify the closure dependency array includes maxTmDiff and qpcrAmpliconMin/Max, or refactor to pass updated values explicitly.

**[P2] title tooltips are hover-only**
8 Options tooltips + accessibility legend explanation are browser-native title — not keyboard-accessible, not mobile-accessible, outside the design system. A custom Courier Prime tooltip component (small parchment card, 1px Ash border) would fix all three gaps.

**[P2] tab bar second row at legibility floor**
4 tabs at flex:1 in 244px = ~61px wide at 7.5px Courier uppercase. Consider consolidating Search into Enzymes panel or promoting one affordance to an icon in the panel header.

---

## Cognitive Load Failures: 7

1. Error messages don't explain what failed — user guesses and retries blind
2. Options non-defaults have no persistent indicator — user forgets what they changed
3. Annotation delete irrecoverable — user discovers consequence after the fact
4. Panel truncates primer sequences — user must hover to read full sequence
5. Stale banner requires scroll-up + Design click — no inline shortcut
6. Quick-fix stale-closure — user believes relaxed parameters were applied, cannot verify
7. No help distinguishing when to use Diagnose vs. re-run Design with adjusted options
