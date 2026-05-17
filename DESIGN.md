---
name: Ori
description: Open-source molecular biology workbench — sequence maps, primer design, Sanger alignment, and AI co-pilot.
colors:
  deep-forest: "#1a4731"
  forest-mid: "#2d7a54"
  burnished-amber: "#b8933a"
  bone: "#f5f0e8"
  bone-light: "#faf7f2"
  bone-mid: "#ece6d8"
  ink: "#1c1a16"
  ink-muted: "#5a5648"
  ink-faint: "#9a9284"
  ash: "#ddd8ce"
  terra: "#8b3a2a"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(2.5rem, 5vw, 4rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Karla, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Karla, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.06em"
rounded:
  xs: "2px"
  sm: "3px"
  md: "4px"
  xl: "6px"
  2xl: "8px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.deep-forest}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "rgba(26,71,49,0.85)"
  button-outline:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-outline-hover:
    backgroundColor: "{colors.bone-mid}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.bone-mid}"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 10px"
  card-default:
    backgroundColor: "{colors.bone-light}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "16px"
  badge-primary:
    backgroundColor: "{colors.deep-forest}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "20px"
  badge-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "20px"
---

# Design System: Ori

## 1. Overview

**Creative North Star: "The Annotated Manuscript"**

Ori is a molecular biology workbench where the interface is itself a kind of annotation. Sequences are marked up with features. Primers are designed in the margins. Restriction sites are noted and digests simulated. The design system honors this: it looks like a well-kept, well-annotated scientific record, not a SaaS dashboard.

The palette is warm parchment, deep forest green, and burnished amber, the colors of aged paper, botanical ink, and a brass-capped centrifuge tube. The body background carries actual horizontal ruled lines at 28px intervals and a barely-there paper grain overlay. These are not decorative gestures; they are the substrate that makes the content legible as scientific rather than commercial.

Type is handled with the same deliberateness. Playfair Display carries section headings, giving them the authority of a chapter header. Karla handles all prose and UI copy. Courier Prime speaks exclusively in the language of data: sequences, primer sequences, thermodynamic values, position coordinates, Phred scores. These three families never trade roles.

The system explicitly rejects: Benchling (corporate enterprise, blue-heavy, overcrowded), SnapGene (clinical, Windows-native, visually dated), generic biotech dark mode (cyan-on-black neon, overdesigned for engineers), and generic life-science startup beige (characterless warm neutrals with no conviction). Ori has a point of view.

**Key Characteristics:**
- Warm tonal palette rooted in parchment, not white
- Ruled-line body background that recalls a physical lab notebook
- Three-family type system with strictly enforced role separation
- Nearly square corners (4px radius) throughout the UI; components do not round themselves
- Flat/tonal elevation: rings and tonal stacking, no box-shadows
- Forest green as the sole signal color for interaction; amber as the sole warm accent
- Courier Prime reserved exclusively for scientific data, never prose

## 2. Colors: The Annotated Manuscript Palette

Three color families, one tonal ground. The palette is warm throughout; cold grays and cool blues are prohibited.

### Primary
- **Deep Forest** (`#1a4731`): The primary action color. Used on primary buttons, focus rings, interactive hover states, annotation labels, and the thin accent line at the top of the navigation bar. Its presence on any element signals "this can be acted on." Used at full saturation only; never as a background tint unless at opacity 0.04-0.12.
- **Forest Mid** (`#2d7a54`): The lighter forest tone. Used in gradient transitions (nav accent line), chart colors, and accessible mid-tone contexts where Deep Forest would be too heavy.

### Secondary
- **Burnished Amber** (`#b8933a`): The warm accent. Used for warnings, highlights, and thematic warmth. Appears on the accent CSS variable. Never overused; its scarcity is its authority.
- **Terra** (`#8b3a2a`): Deep red-brown. Used only in chart contexts and destructive-adjacent states where the full red destructive would be too harsh.

### Neutral
- **Bone** (`#f5f0e8`): The page surface. The body background. The ground everything sits on. Carries the ruled-line pattern and paper grain overlay. Never replaced with white.
- **Bone Light** (`#faf7f2`): The card surface. Slightly lighter than the page ground, creating a gentle tonal lift without shadow.
- **Bone Mid** (`#ece6d8`): The secondary/muted surface. Used as button secondary background, muted chips, and card footers. The hover state for outline and ghost buttons.
- **Ink** (`#1c1a16`): The primary text color. Near-black with a warm brown undertone; never pure black.
- **Ink Muted** (`#5a5648`): Secondary text, descriptions, metadata. Warm gray, never cool.
- **Ink Faint** (`#9a9284`): Tertiary text, timestamps, Courier Prime labels in panels. The quietest voice.
- **Ash** (`#ddd8ce`): Borders, input strokes, dividers. Warm light gray. The structural grid of the UI.

### Named Rules

**The One Green Rule.** Deep Forest is the only interactive signal color. If an element is green, it is acting or focused. If it is not green, it is not. Use Deep Forest for primary buttons, focus rings, hover states on text links, and annotation labels. Do not use it for decorative purposes.

**The Warm Ground Rule.** Every surface tints toward the brand hue. Bone, not white. Ink, not black. Ash, not cool gray. Cold neutrals are prohibited at every scale step.

**The Amber Scarcity Rule.** Burnished Amber appears on fewer than 10% of any screen at any given time. It marks warnings and thematic warmth; it is not a highlight color for information hierarchy.

## 3. Typography: Three Families, Three Roles

**Display Font:** Playfair Display (Georgia, serif fallback)
**Body Font:** Karla (system-ui, sans-serif fallback)
**Data Font:** Courier Prime (Courier New, monospace fallback)

**Character:** Playfair Display brings authority without formality, the weight of a journal's chapter heading. Karla is legible, warm, and professionally unremarkable in the best sense; it never fights the data. Courier Prime is the data itself: every primer sequence, every thermodynamic value, every position coordinate is written in this hand.

### Hierarchy

- **Display** (Playfair Display, 400 weight, clamp(2.5rem, 5vw, 4rem), 1.05 line-height, -0.02em letter-spacing): Hero headings on the landing page only. Used once per view.
- **Headline** (Playfair Display, 400 weight, clamp(1.5rem, 3vw, 2.25rem), 1.15 line-height, -0.02em): Page-level section headers in the landing register. Feature names in the landing hero.
- **Title** (Karla, 600 weight, 16px, 1.4 line-height): Panel headers, card titles, modal headings inside the app shell. Karla, not Playfair: the app speaks in its working voice.
- **Body** (Karla, 400 weight, 14px, 1.6 line-height): All prose in the app, descriptions, tooltips, warning messages. Max line length 72ch.
- **Label** (Courier Prime, 400 weight, 11px, 1.4 line-height, 0.06em letter-spacing): Sequence data, primer sequences, Tm values, position coordinates, Phred scores, file formats, the "beta" badge, panel metadata. All scientific output speaks in this voice.

### Named Rules

**The Courier Signal Rule.** Courier Prime is the language of scientific data, and only scientific data. Prose text never appears in Courier. If a value could appear in a GenBank file or a gel report, it speaks in Courier. If it is UI copy, it speaks in Karla.

**The Playfair Boundary Rule.** Playfair Display is prohibited inside the app shell. It belongs to landing-page headings and the wordmark "Ori" in the nav. Inside the dashboard, sequence viewer, and primer tool, title-level text uses Karla 600. The authority of the serif is preserved by its scarcity.

## 4. Elevation: Tonal Stacking, Not Shadows

This is a flat system. Depth is expressed through tonal layering and a single-pixel ring, not through box-shadow.

Three surface levels:
1. **Ground** (`#f5f0e8`, Bone): The page itself.
2. **Raised** (`#faf7f2`, Bone Light): Cards, panels, popovers. Slightly lighter than ground, creating a lift through tone, not shadow.
3. **Elevated** (Bone Light + `ring-1 ring-foreground/10`): Cards add a 1px semi-transparent outline at `rgba(28,26,22,0.10)`. This provides edge definition without a shadow plane.

The one exception to the no-shadow rule: the top navigation bar uses `backdrop-filter: blur(8px)` to separate itself from scroll content. This is structural, not decorative.

### Named Rules

**The Ring-Not-Shadow Rule.** Cards and containers use `outline: 1px solid rgba(28,26,22,0.10)` for edge definition. Box-shadow is prohibited. The UI does not float; it rests on the manuscript surface.

**The Accent Line Rule.** The navigation bar carries a 2px gradient line at its top edge (`linear-gradient(90deg, #1a4731 0%, #2d7a54 50%, transparent 100%)` at 60% opacity). This is the only decorative element that uses a gradient. It is not replicated anywhere else in the UI.

## 5. Components

### Buttons

Scholarly confidence. Nearly square corners (4px radius, `{rounded.md}`). No shadows. State changes only through background tint.

- **Shape:** 4px radius. Height 32px (default). Padding 0 10px.
- **Primary:** Deep Forest background (`#1a4731`), white text. Hover: `rgba(26,71,49,0.85)`. Active: translateY(1px).
- **Focus:** `border: 1px solid #1a4731` + `box-shadow: 0 0 0 3px rgba(26,71,49,0.25)`.
- **Outline:** Bone background, Ash border (`#ddd8ce`). Hover: Bone Mid (`#ece6d8`).
- **Ghost:** Transparent background and border. Hover: Bone Mid.
- **Disabled:** 50% opacity, pointer-events none.
- **Link:** Deep Forest text, underline on hover. No background.

### Badges / Tags

Fully rounded pill (12px radius, `{rounded.pill}`). Height 20px. Padding 0 8px. 12px Karla, medium weight. Used for format labels (GenBank, FASTA), feature types (CDS, promoter), and status indicators.

- **Primary:** Deep Forest background, white text.
- **Outline:** Transparent background, Ash border, Ink text.
- **Secondary:** Bone Mid background, Ink Muted text.

### Cards

Bone Light surface (`#faf7f2`), 6px radius (`{rounded.xl}`), 1px semi-transparent ring (`rgba(28,26,22,0.10)`). Internal padding 16px. No shadow. Card footers use Bone Mid background (`#ece6d8`).

Do not nest cards. Do not use cards inside cards. The sequence library uses rows, not cards.

### Inputs / Fields

Transparent background on the Bone ground. 1px Ash border (`#ddd8ce`). 4px radius. Height 32px. Padding 0 10px.

- **Focus:** border-color shifts to Deep Forest; ring `0 0 0 3px rgba(26,71,49,0.20)`.
- **Placeholder:** Ink Faint (`#9a9284`).
- **Disabled:** 50% opacity, Bone Mid background tint.
- **Error:** border-color destructive red; ring `0 0 0 3px rgba(201,69,52,0.20)`.

### Navigation (Top Bar)

52px height. Background `rgba(245,240,232,0.97)` with `backdrop-filter: blur(8px)`. 1px Ash bottom border. The 2px forest-to-transparent gradient accent line at top edge is the system's signature element.

Wordmark "Ori" in Playfair Display 22px weight 400, color Ink. "beta" badge: Courier Prime 9px, uppercase, 0.12em letter-spacing, Deep Forest color, 1px border at `rgba(26,71,49,0.35)`, 2px radius. User email in Courier Prime 11px, Ink Faint color.

### Sequence Data Display (Signature Component)

The sequence viewer, primer sequences, and thermodynamic value panels use Courier Prime exclusively. Values are typically 9-11px, ranging from Ink Faint for metadata to Ink for primary data. The sequence viewer renders nucleotide data in fixed-width Courier Prime at 10px, letter-spacing 0.04em.

Feature annotation badges (AmpR, lacZ, pMB1 ori) appear as tight inline labels: Courier Prime bold 11px, Deep Forest color, 1px Deep Forest border at 0.2 opacity, 3px radius, 2-4px padding. These are the "margin notes" of the annotated manuscript.

## 6. Do's and Don'ts

### Do:
- **Do** use Bone (`#f5f0e8`) as every page surface. Never replace it with white (`#fff` or `oklch(100% 0 0)`).
- **Do** use Courier Prime for every scientific value: sequences, primer sequences, Tm, GC%, position coordinates, Phred scores, file sizes in bp.
- **Do** keep Deep Forest (`#1a4731`) as the sole signal color for interactive elements. Its presence means "act here."
- **Do** use the tonal lift system: Bone for page ground, Bone Light for card surfaces, Bone Mid for secondary surfaces and hover states.
- **Do** keep borders and rings at Ash (`#ddd8ce`) or weaker. The structural grid of the UI is quiet.
- **Do** use 4px radius on buttons and inputs. 6px on cards. The system has nearly square corners; rounding is minimal and consistent.
- **Do** rely on the `outline: 1px solid rgba(28,26,22,0.10)` ring for card edge definition. This is not a shadow; it is a hairline.
- **Do** reserve Playfair Display for the landing page and the nav wordmark. Titles inside the app shell use Karla 600.
- **Do** keep Burnished Amber (`#b8933a`) for warnings and thematic warmth only. It should appear on fewer than 10% of any screen.
- **Do** ensure WCAG 2.1 AA contrast ratios. Verify Ink on Bone (`#1c1a16` on `#f5f0e8`) and Ink Muted on Bone Light (`#5a5648` on `#faf7f2`) pass AA at body size.

### Don't:
- **Don't** look like SnapGene: no clinical whiteness, no feature-dense panel chrome, no Windows-native widget aesthetics.
- **Don't** look like Benchling: no corporate blue palette, no heavy left-nav chrome, no grid of identical management cards.
- **Don't** use dark mode with neon accents or cyan-on-black typography. Ori is not built for engineers; it is built for biologists.
- **Don't** sand down the manuscript aesthetic with generic warm-neutral SaaS patterns. Ori has a point of view; do not flatten it to characterless.
- **Don't** use box-shadow for elevation. The UI rests on the page; it does not float.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored stripe accent on cards, alerts, or list items. Rewrite with full borders, background tints, or Courier labels.
- **Don't** use gradient text (`background-clip: text`). Use Deep Forest solid for emphasis. Weight and size create hierarchy; gradients do not.
- **Don't** use Playfair Display inside the app shell for panel headings or card titles. Karla 600 is the working title voice.
- **Don't** use Courier Prime for prose, buttons, nav copy, or any UI text that is not scientific data or metadata.
- **Don't** use cold grays or cool-tinted neutrals anywhere. Every neutral tints toward the brand hue. Ash, not silver. Ink Muted, not slate.
- **Don't** put color as the sole indicator of meaning in sequence annotations or primer quality scores. Every color-coded element also has a text label.
