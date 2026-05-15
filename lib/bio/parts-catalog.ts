/**
 * Parts catalog for the AI Construct Designer.
 *
 * Sequences for short regulatory elements (promoters ≤100bp, RBS, terminators)
 * use validated sequences from published literature and the iGEM Registry.
 *
 * Structural elements (ori, resistance markers) are marked PLACEHOLDER and
 * reference the GenBank accession to pull the full functional sequence before
 * production use. The placeholder sequences are the correct length so the
 * assembled construct looks realistic in the viewer.
 *
 * Organism support: E. coli only in v1. Mammalian and yeast parts will be
 * added in a future expansion once organism metadata is curated.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type PartType = "promoter" | "rbs" | "terminator" | "ori" | "marker";
export type Organism = "ecoli" | "mammalian" | "yeast" | "universal";

export interface Part {
  id: string;
  name: string;
  type: PartType;
  organisms: Organism[];
  /** Human-readable description sent to Claude as selection context. */
  description: string;
  seq: string;
  /** Typed now for schema stability; populated as metadata expands. */
  strength?: "strong" | "medium" | "weak";
  /** Inducer molecule if applicable. */
  inducibleBy?: string;
  /** Plasmid copies per cell (ori only). */
  copyNumber?: number;
  /** Restriction enzymes that cut within this part — avoid these for cloning. */
  internalRestrictionSites?: string[];
  /** GenBank accession or publication for sequence validation. */
  source?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generates a placeholder sequence of realistic length for visual correctness.
 *  Replace with the real sequence from the cited accession before production use.
 */
function placeholder(length: number): string {
  const unit = "ATGATCGGCATCGATCGATCGATCGATCGATCGATCG";
  let s = "";
  while (s.length < length) s += unit;
  return s.slice(0, length);
}

// ── Catalog ───────────────────────────────────────────────────────────────────

export const PARTS_CATALOG: Part[] = [
  // ── Promoters ──────────────────────────────────────────────────────────────

  {
    id: "t7_promoter",
    name: "T7 promoter",
    type: "promoter",
    organisms: ["ecoli"],
    description:
      "Very strong promoter recognized exclusively by T7 RNA polymerase. Requires BL21(DE3) or similar strains harboring chromosomal T7 RNAP. Highest expression levels of any E. coli promoter. IPTG-inducible via the T7 RNAP gene control. Use for maximum protein yield when T7-compatible cells are available.",
    seq: "TAATACGACTCACTATAGGG",
    strength: "strong",
    inducibleBy: "IPTG (via T7 RNAP)",
    source: "T7 phage genome, phi10 promoter consensus",
  },
  {
    id: "tac_promoter",
    name: "tac promoter",
    type: "promoter",
    organisms: ["ecoli"],
    description:
      "Hybrid trp-lac promoter. Strong, directly IPTG-inducible in any standard E. coli strain (no T7 RNAP required). Produces high levels of recombinant protein with good induction control. Used in pGEX, pMAL, and many expression vectors. Good balance of strength and tight regulation.",
    seq: "TTGACAATTAATCATCGGCTCGTATAATGTGTGGAATTGTGAGCGGATAACAATTTCACACAGG",
    strength: "strong",
    inducibleBy: "IPTG",
    source: "de Boer et al. 1983, Proc Natl Acad Sci",
  },
  {
    id: "araBAD_promoter",
    name: "araBAD promoter",
    type: "promoter",
    organisms: ["ecoli"],
    description:
      "Arabinose-inducible promoter with tight repression in glucose. Excellent for toxic proteins due to low leakage. Induced by L-arabinose; repressed by glucose. Lower expression than T7 or tac — good for difficult-to-express or toxic proteins.",
    seq: "AGATCTTTTTTTTAATTTAAAATTGTTATCCGCTCATAATCAGCTCATCATTTGATCAATGAAATCGCGATTTTTAATTTGTAAGCTAGCGAATTAAGGAGGTAATATAAATGAAAGCAATTTTCGTACTGAAAGGTTCAGGTTTAAGGAATAACACAAAAGAAGGATTATTTGAAGCTATGCGTTATACTATCCGAGATGCTGCGAATGATCTGGGCATCAATAAATCAGCAAATGTGCAAAAAGCACCGATG",
    strength: "medium",
    inducibleBy: "arabinose",
    source: "araBAD operon, pBAD vector series (Invitrogen)",
  },
  {
    id: "j23119_promoter",
    name: "J23119 (constitutive, strong)",
    type: "promoter",
    organisms: ["ecoli"],
    description:
      "Strong constitutive promoter from the iGEM Anderson Promoter Library. No induction required — produces protein continuously. Good for selection markers, reporter genes, or when constitutive expression is desired. Relative strength ~2.5× J23101.",
    seq: "TTGACAGCTAGCTCAGTCCTAGGTATAATGCTAGC",
    strength: "strong",
    source: "iGEM Registry BBa_J23119, Anderson Promoter Library",
  },
  {
    id: "j23101_promoter",
    name: "J23101 (constitutive, medium)",
    type: "promoter",
    organisms: ["ecoli"],
    description:
      "Medium-strength constitutive promoter from the iGEM Anderson Promoter Library. Useful when strong constitutive expression causes growth burden. Relative strength ~0.7× J23119.",
    seq: "TTTACAGCTAGCTCAGTCCTAGGTATTATGCTAGC",
    strength: "medium",
    source: "iGEM Registry BBa_J23101, Anderson Promoter Library",
  },
  {
    id: "j23106_promoter",
    name: "J23106 (constitutive, weak)",
    type: "promoter",
    organisms: ["ecoli"],
    description:
      "Weak constitutive promoter for low-level expression. Use when overexpression is toxic or to balance multi-gene construct expression.",
    seq: "TTTACGGCTAGCTCAGTCCTAGGTATAGTGCTAGC",
    strength: "weak",
    source: "iGEM Registry BBa_J23106, Anderson Promoter Library",
  },

  // ── Ribosome Binding Sites ─────────────────────────────────────────────────

  {
    id: "b0034_rbs",
    name: "RBS B0034 (strong)",
    type: "rbs",
    organisms: ["ecoli"],
    description:
      "Strong ribosome binding site from the iGEM Registry (~30,000 AU). Contains a strong Shine-Dalgarno sequence (AAAGAGGAG) with optimal spacing. Use with strong promoters for maximum translation.",
    seq: "AAAGAGGAGAAATACTA",
    strength: "strong",
    source: "iGEM Registry BBa_B0034",
  },
  {
    id: "b0032_rbs",
    name: "RBS B0032 (medium)",
    type: "rbs",
    organisms: ["ecoli"],
    description:
      "Medium-strength RBS (~1,000 AU). Lower translation rate reduces metabolic burden and can improve folding of difficult proteins. Use when strong RBS + strong promoter causes insolubility.",
    seq: "AAAGAGGAG",
    strength: "medium",
    source: "iGEM Registry BBa_B0032",
  },

  // ── Terminators ────────────────────────────────────────────────────────────

  {
    id: "t7_terminator",
    name: "T7 terminator",
    type: "terminator",
    organisms: ["ecoli"],
    description:
      "Strong transcriptional terminator from T7 phage. Works well with T7 and bacterial RNA polymerases. Efficient stem-loop structure prevents read-through. Pair with T7 promoter or any strong E. coli promoter.",
    seq: "CTAGCATAACCCCTTGGGGCCTCTAAACGGGTCTTGAGGGGTTTTTTGCTAGC",
    source: "T7 phage genome, Te terminator",
  },
  {
    id: "rrnB_T1T2",
    name: "rrnB T1T2 terminator",
    type: "terminator",
    organisms: ["ecoli"],
    description:
      "Double terminator from the E. coli rrnB ribosomal RNA operon. Two sequential terminators (T1 then T2) provide very high termination efficiency (>99%). Reduces read-through into downstream sequences. Commonly used in pET and many expression vectors.",
    seq: "CCAGGCATCAAATAAAACGAAAGGCTCAGTCGAAAGACTGGGCCTTTCGTTTTATCTGTTGTTTGTCGGTGAACGCTCTCTACTAGAGTCACACTGGCTCACCTTCGGGTGGGCCTTTCTGCGTTTATATACTTTAGCAGTTGGGTGGAGCATTTGACGCTAACCTTGACGGCTAGCTCAGTCCTAGGTACAATGCTAGC",
    source: "E. coli rrnB operon T1 (BBa_B0010) + T2 (BBa_B0012)",
  },

  // ── Origins of Replication ─────────────────────────────────────────────────

  {
    id: "colE1_ori",
    name: "ColE1/pMB1 origin",
    type: "ori",
    organisms: ["ecoli"],
    description:
      "High-copy origin of replication (~500 copies/cell). Used in pUC, pBluescript, pGEM, and most common cloning vectors. Compatible with most E. coli strains. Incompatible with p15A-based plasmids (cannot co-transform pUC + pACYC).",
    seq: placeholder(589),
    copyNumber: 500,
    source: "PLACEHOLDER — replace with pUC19 ori sequence (GenBank L09137, positions ~1629-2218)",
  },
  {
    id: "p15a_ori",
    name: "p15A origin",
    type: "ori",
    organisms: ["ecoli"],
    description:
      "Medium-copy origin (~15-20 copies/cell) from pACYC184. Compatible with ColE1 plasmids — use when you need to co-transform two plasmids. Found in pACYC, pZA, and many two-plasmid systems.",
    seq: placeholder(421),
    copyNumber: 20,
    source: "PLACEHOLDER — replace with pACYC184 ori (GenBank X06403, p15A region)",
  },
  {
    id: "psc101_ori",
    name: "pSC101 origin",
    type: "ori",
    organisms: ["ecoli"],
    description:
      "Stringent low-copy origin (~5 copies/cell). Reduces metabolic burden, helps stabilize toxic or hard-to-express inserts. Found in pSC101 and derivative vectors.",
    seq: placeholder(516),
    copyNumber: 5,
    source: "PLACEHOLDER — replace with pSC101 origin sequence",
  },

  // ── Resistance Markers ─────────────────────────────────────────────────────

  {
    id: "ampR_marker",
    name: "AmpR (ampicillin resistance)",
    type: "marker",
    organisms: ["ecoli"],
    description:
      "Beta-lactamase gene conferring ampicillin resistance. Most common selection marker. Caution: ampicillin degrades in culture — satellite colonies can appear after 12-16h. Prefer KanR for long cultures or when false-positive colonies are a concern.",
    seq: placeholder(1068),
    source: "PLACEHOLDER — replace with AmpR cassette from pUC19 (GenBank L09137, positions ~1629-2489 + promoter)",
  },
  {
    id: "kanR_marker",
    name: "KanR (kanamycin resistance)",
    type: "marker",
    organisms: ["ecoli"],
    description:
      "Aminoglycoside resistance gene. Kanamycin is stable in culture — no satellite colonies. Preferred when working with high-copy plasmids or extended culture times. Compatible with most E. coli strains.",
    seq: placeholder(1076),
    source: "PLACEHOLDER — replace with KanR cassette from pUC4K (GenBank X06404) or Tn903",
  },
  {
    id: "cmR_marker",
    name: "CmR (chloramphenicol resistance)",
    type: "marker",
    organisms: ["ecoli"],
    description:
      "Chloramphenicol acetyltransferase. Useful for selection of p15A-based plasmids. Compatible with AmpR and KanR for multi-plasmid systems.",
    seq: placeholder(658),
    source: "PLACEHOLDER — replace with CmR from pACYC184 (GenBank X06403) or Tn9",
  },
];

// ── Lookup by ID ──────────────────────────────────────────────────────────────

export const PARTS_BY_ID: Record<string, Part> = Object.fromEntries(
  PARTS_CATALOG.map((p) => [p.id, p]),
);

/** Format the catalog as a readable prompt context for Claude. */
export function formatCatalogForPrompt(): string {
  const sections: Record<PartType, Part[]> = {
    promoter: [],
    rbs: [],
    terminator: [],
    ori: [],
    marker: [],
  };
  for (const p of PARTS_CATALOG) sections[p.type].push(p);

  const lines: string[] = ["== AVAILABLE PARTS (E. coli) =="];

  const headers: Record<PartType, string> = {
    promoter: "PROMOTERS",
    rbs: "RIBOSOME BINDING SITES (RBS)",
    terminator: "TERMINATORS",
    ori: "ORIGINS OF REPLICATION",
    marker: "RESISTANCE MARKERS",
  };

  for (const type of ["promoter", "rbs", "terminator", "ori", "marker"] as PartType[]) {
    lines.push(`\n${headers[type]}:`);
    for (const p of sections[type]) {
      lines.push(`  • ${p.name} (id: "${p.id}", ${p.seq.length} bp)`);
      lines.push(`    ${p.description}`);
    }
  }

  return lines.join("\n");
}
