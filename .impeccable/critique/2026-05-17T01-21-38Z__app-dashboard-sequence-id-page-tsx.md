---
target: sequence viewer
total_score: 24
p0_count: 0
p1_count: 3
timestamp: 2026-05-17T01-21-38Z
slug: app-dashboard-sequence-id-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Change | Key Issue |
|---|-----------|-------|--------|-----------|
| 1 | Visibility of System Status | 3 | +1 | Worker states, Diagnose dots, Design button label all communicate. No "last run" breadcrumb. |
| 2 | Match System / Real World | 2 | — | "Accessibility" means secondary structure not WCAG — legend tooltip now explains it. Assembly not visually distinct from PCR/qPCR as a workflow type. |
| 3 | User Control and Freedom | 1 | — | Mode switch silently discards results; annotation delete immediately persists with no confirm; no undo anywhere. |
| 4 | Consistency and Standards | 2 | +1 | Deep Forest / Forest Mid split is clean throughout. Verify button (#2d4a7a) missed in this round — fixed inline. |
| 5 | Error Prevention | 2 | — | qPCR quick-fix buttons are good. Delete has no confirm. Mode switching is unconditionally destructive. |
| 6 | Recognition Rather Than Recall | 2 | +1 | Plots hint, chromatogram hint, ORF translation footer all added. title tooltips hover-only. |
| 7 | Flexibility and Efficiency | 1 | — | No keyboard shortcuts. No region recall. Copy-on-click has no persistent affordance. |
| 8 | Aesthetic and Minimalist Design | 2 | — | Color discipline good. 7 tabs in two rows at 7.5px Courier is at legibility floor. |
| 9 | Error Recovery | 2 | — | "← Back to library" on error state. Generic fail messages ("Check your sequence") unchanged. |
| 10 | Help and Documentation | 2 | +1 | title attributes on all Options labels and accessibility legend. Hover-only; not keyboard accessible. |
| **Total** | | **24/40** | **+5** | **Above average — structurally coherent, key power-user gaps remain** |

---

## Anti-Patterns Verdict

**Still not AI-generated.** Manuscript palette, ruled-line body, three-family typography, and 4px corner geometry remain distinctive. Automated detector: clean (0 findings). The `transition: width` was removed; no new layout-animation anti-patterns introduced.

---

## Overall Impression

Five fixes landed where they were aimed. Color semantics are materially cleaner, the tab bar is spatially stable, and the vocabulary tooltips plus persistent hints address real discoverability gaps. The score of 24/40 reflects a viewer that is coherent at the component level but still has unresolved structural issues that cap it. The two hardest remaining problems are not visual: mode-switching is destructive without recovery, and there are no keyboard shortcuts.

---

## What's Working

**Green color semantics.** Deep Forest as interactive-only and Forest Mid as positive-state is consistent throughout every panel examined. The prior ambiguity where a green efficiency bar looked like a button is resolved.

**Annotation editor flow.** The tab bar no longer jumps. The ✎ trigger is explicit and contextually placed. The editor appearing inside the content area (below the tabs, above results) is spatially coherent.

**qPCR failure recovery.** "Relax ΔTm (+1°)" and "Widen Amplicon" with parameter disclosure in button titles remains the best-executed error recovery in the app.

---

## Remaining Priority Issues

**[P0 — fixed inline] Verify button off-palette color**
Align panel Verify button had `background: "#2d4a7a"` — same navy as the Diagnose button fix that was applied in the prior round. Now uses the same outline style as Diagnose.

**[P1] Mode switching silently destroys primer results**
Switching PCR → qPCR → back to PCR clears results each time. A researcher comparing PCR and qPCR output for the same region runs the design twice and cannot see both simultaneously. At minimum: warn before clearing, or show a one-line summary of the previous mode's best pair.

**[P1] Annotation delete has no confirmation and immediately persists**
`handleOverrideDelete` fires Supabase write immediately with `deleted: true`. No confirm, no undo window. Delete sits adjacent to Cancel in the editor form. One mis-click permanently removes a user-edited annotation.

**[P1] No keyboard shortcuts**
No Cmd+D to design, no arrow keys to cycle primer pairs, no Cmd+Enter to save annotation editor. Against SnapGene, which has extensive keyboard control, this is a daily-use friction point for power users.

**[P2] 7 tabs in two rows — legibility floor**
Second row has 4 tabs at flex:1 in 244px → ~61px wide at 7.5px Courier uppercase. Consolidating Search into Enzymes or promoting one to an icon in the header bar would reduce the row count to one.

**[P2] `title` tooltips are hover-only**
Eight Options tooltips and the accessibility legend explanation are browser-native `title` — invisible until hover, not keyboard-accessible, not mobile-accessible, rendered outside the design system. A custom tooltip component matching the manuscript palette would serve these and also address H10.

---

## Cognitive Load Failures: 6 of 8 remain

Resolved: Plots pre-run hint, chromatogram drop-zone hint reduce recall burden.
Still active: no region breadcrumb after design, mode-switch destroys results, annotation editor multi-step discovery, Align tab undiscoverable purpose, copy-on-click silent affordance, `title` tooltips require hover to discover.
