---
target: sequence viewer
total_score: 19
p0_count: 2
p1_count: 2
timestamp: 2026-05-16T23-53-20Z
slug: app-dashboard-sequence-id-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Annotation badge is `pointerEvents:none` — a dead signal. Bottom drawers have no status. |
| 2 | Match System / Real World | 3 | Discipline vocabulary is correct. "↓ Annotated" is ambiguous. "Ask Ori" is a product name, not a task. |
| 3 | User Control and Freedom | 1 | No undo anywhere. Mode switch destroys primer results. Drawers cannot be minimized. |
| 4 | Consistency and Standards | 2 | `#1a4731` carries four simultaneous meanings: interactive, excellent, accessible, best-result. |
| 5 | Error Prevention | 2 | Coordinate inputs validate on submit, not on input. Destructive delete sits adjacent to Cancel. |
| 6 | Recognition Rather Than Recall | 1 | Three bottom drawers are invisible until triggered. 7-tab bar requires recall, no tooltips. |
| 7 | Flexibility and Efficiency | 3 | Annotation-click-to-auto-design is fast. Origin-spanning primers work. No keyboard shortcuts. |
| 8 | Aesthetic and Minimalist Design | 2 | Distinctive palette. 15–17 controls before action button. Three nav zones in 244px panel. |
| 9 | Error Recovery | 3 | qPCR failure recovery with one-click remediation is exemplary. Generic errors give nothing actionable. |
| 10 | Help and Documentation | 0 | No tooltips on any parameter. No explanation of heterodimer ΔG, Gibson overlap, GC clamp, or template accessibility anywhere. |
| **Total** | | **19/40** | **Below average — functional but hostile to new users** |

---

## Anti-Patterns Verdict

**Does this look AI-generated?** No. The manuscript palette (parchment + forest green + amber), ruled-line body background, Courier/Karla/Playfair three-family type system, and 4px corner radius are committed and distinctive. Nobody would look at this and say "AI made that" — the aesthetic has a point of view.

**Automated scan (1 finding):** `transition: width` at `primer-panel.tsx:362` — the qPCR efficiency bar animates its width, which causes layout thrash. Should be replaced with `transform: scaleX()` on a fixed-width container.

**No visual overlays** — browser automation not used for this run.

---

## Overall Impression

This is a tool built by scientists for scientists, and it shows: the thermodynamics vocabulary is correct, origin-spanning primer design actually works, the qPCR failure recovery is better than anything SnapGene offers. But two structural problems undermine it. First, the forest green color cannot mean both "click here" and "this result is excellent" — that ambiguity is a systems failure, not a cosmetic one. Second, three of the app's most powerful features (translation viewer, chromatogram, primer plots) are invisible until discovered by accident. The gap between what the tool can do and what a new user can find is large enough to cause churn.

---

## What's Working

**The qPCR failure recovery.** When primd returns no compatible pairs, the UI shows a human explanation of *why*, then surfaces "Relax ΔTm (+1°)" and "Widen Amplicon" buttons that modify the exact failing parameter and re-run automatically. Button titles disclose the exact parameter change. This is textbook error recovery — the system knows what broke and gives a one-click out.

**The accessibility heat map.** Showing template secondary structure synchronized with the primer selection, live-updating with a crosshair tooltip, is a genuine differentiator. SnapGene doesn't do this. The canvas rendering (ImageData pixel-by-pixel, ResizeObserver for sharpness) is efficient and correct. This feature earns its screen space.

**Origin-spanning primer design.** The sequence rotation/unrotation logic handles an edge case most academic tools refuse entirely. The inline "wraps origin ↻" label explains the behavior without documentation.

---

## Priority Issues

**[P0] Forest green carries four simultaneous semantic loads**
- **What:** `#1a4731` is used for: interactive state (active tab border, primary button, save), positive feedback (efficiency bar ≥80%, efficiency score text), structural state ("Accessible" in template heat map legend), and best-result highlight (isBest card tint). The design system thesis is that this color means "act here." It does not.
- **Why it matters:** When a user sees green on this screen, they cannot determine whether it means "click me," "this result is excellent," "this region is structurally open," or "this is the top pair." A first-time user hovering over a green efficiency bar will wonder if it's interactive. A power user will lose the signal because the color has been devalued by overuse.
- **Fix:** Reserve `#1a4731` exclusively for interactive affordances. Introduce a distinct semantic token — consider `#2d7a54` (Forest Mid) or a desaturated warm green — for positive-state indicators. The efficiency bar, accessibility legend "Accessible" label, and best-pair card tint should not use the same color as the save button and the focus ring.
- **Suggested command:** `/impeccable colorize`

**[P0] Annotation editor injects above the tab bar, displacing navigation mid-session**
- **What:** When a non-CDS annotation is clicked on the map, `AnnotationEditor` renders between the top action strip and the tab bar. The tab bar shifts downward. The user's spatial context — which tab they were on — is physically displaced. The editor is also doing too much in one line: color swatch, name, type, position, bp count, edit button, close button, all at Courier 8px.
- **Why it matters:** Spatial instability (cognitive load checklist item 8) is a high-friction pattern. Users navigating between tabs while an annotation is selected experience the tab bar jumping position. On a 244px panel with tight layout, even 40px of vertical shift is disorienting.
- **Fix:** Move annotation editing to a popover anchored to the map annotation itself (where the click happened), not injected into the panel nav structure. The panel should remain spatially stable regardless of selection state.
- **Suggested command:** `/impeccable layout`

**[P1] Three bottom drawers are invisible until accidentally discovered**
- **What:** Translation, Chromatogram, and Primer Plots have no persistent affordance in the static chrome. A researcher who never clicks a CDS annotation, never completes an alignment, and never designs primers will never know these features exist — which describes a majority of first sessions.
- **Why it matters:** The chromatogram viewer is likely the most technically sophisticated piece of the app (4-channel fluorescence traces, Phred quality coloring, mismatch highlighting). It is completely hidden. The Primer Plots (melt curve, amplicon structure, pair scatter) are central to the primd library's value proposition. Both are invisible.
- **Fix:** Add a persistent disabled/grayed state for each drawer that communicates the capability exists. A "Plots ↗" row at the bottom of the primer panel, grayed until a design run completes, costs nothing and eliminates the discovery problem. Similarly, a disabled "Chromatogram" indicator in the Align tab footer.
- **Suggested command:** `/impeccable onboard`

**[P1] Zero help for discipline-specific vocabulary**
- **What:** "heterodimer ΔG," "template accessibility," "Gibson overlap," "assembly search extension," "GC clamp," "GC soft zone" appear in the primer panel's Options section with no tooltip, no link, no inline definition. The accessibility heat map legend (Structured / Marginal / Accessible) is not explained.
- **Why it matters:** Score of 0/4 on H10. For an academic audience where a significant fraction of users are graduate students encountering computational primer design tools for the first time, this is a hard wall. The "Ask Ori" AI tab addresses this indirectly but requires the user to already know what to ask.
- **Fix:** Every Options parameter label gets a `title` attribute (one sentence). The heat map legend gets a `?` icon with a two-sentence popover. Implementation cost: ~2 hours. The improvement to first-session success rate will be substantial.
- **Suggested command:** `/impeccable clarify`

**[P2] 15–17 controls visible before the Design Primers action button**
- **What:** In PCR mode with Options collapsed, the primer panel still shows: mode toggle (3 buttons), Start input, End input, and the From Selection / From Annotation controls. In Assembly mode: additionally, method toggle (2 buttons), overlap input, enzyme dropdown, search-extension input. With Options open: Tm target, length min, length max, GC min, GC max, Max ΔTm, amplicon min, amplicon max.
- **Why it matters:** A graduate student opening the Primers tab for the first time sees a form, not a workflow. The mode-specific controls for Assembly are visible in PCR mode and confusing. The cognitive demand before hitting the primary action is too high for a tool that is otherwise well-paced.
- **Fix:** Gate Assembly-specific controls (method toggle, overlap, enzyme, search extension) strictly behind the Assembly mode selection. In PCR mode, the primer panel above the Design button should show: mode toggle, start/end inputs, and a collapsed Options chevron. Four controls. That is the correct initial density.
- **Suggested command:** `/impeccable distill`

---

## Persona Red Flags

**Power user / postdoc who needs to design primers fast:**

The annotation-click-to-auto-design path is excellent and should be the primary affordance. The friction appears immediately after: the mode toggle defaults to PCR, but a postdoc with a standing qPCR workflow must change it every session with no persistence. Switching modes clears all results — comparing PCR and qPCR output for the same region requires two separate runs with no side-by-side view. The "Plots" button materializes in the bottom bar only after a design run completes, with no keyboard shortcut and no prior indication it will appear. The "Diagnose" button sits at equal visual prominence to "Plots" despite being used far less frequently (only on failure vs. on every successful design).

**First-time user / grad student who just uploaded their first plasmid:**

They see the sequence viewer with 7 tabs at 7.5px Courier uppercase. The default active tab is Enzymes — correct for power users, wrong for someone who just wants to see what's in their sequence. The annotation status badge says "8 features detected" but is `pointerEvents: none`. They cannot click it. The Enzymes tab shows restriction enzyme checkboxes with cut counts — meaningful only if the student knows which enzymes to care about. The DEFAULT_ENZYMES list is not labeled or explained. The student has no path to understanding what the screen shows them without external help. Recommended alternative default tab for detected first-time users: trigger to the annotation view or add a "Features" summary tab.

---

## Minor Observations

- The `transition: width` on the efficiency bar (primer-panel.tsx:362) causes layout thrash. Replace with `transform: scaleX()` on a fixed-width container.
- The `#2d4a7a` navy on the "Diagnose" button is not in the design system palette. Use `#5a5648` (Ink Muted) or the outline button style instead.
- The `pointerEvents: none` on the annotation status badge is correct to prevent click interference with the map, but the affordance of "N features detected" strongly implies clickability. Consider changing the label to something non-interactive in phrasing: "N features · auto-detected" or removing the bullet point marker.
- The amber dot indicator on the Primers tab (4px, amber, no label) is too small to be a reliable signal. A text indicator like "· selection ready" would communicate the state without requiring the user to have previously learned what the dot means.
- "Ask Ori" as a tab label is a product name. "AI" or "Ask" would scan faster at 7.5px.

---

## Questions to Consider

- **What does green mean on this screen?** This forces the structural decision: interactive affordance or positive-state signal. You cannot keep both.
- **What if the default tab were contextual?** First upload → Features tab. Known sequence with no alignment → Enzymes. After primer design run → Primers stays active. The tab bar is mode-switching, not page-switching — it could respond to context.
- **What if the panel were resizable?** A researcher doing serious primer work might want 350px. One reviewing annotations only might want 180px. The fixed 244px optimizes for neither.
