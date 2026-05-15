/**
 * Parts catalog for the AI Construct Designer — E. coli v1.
 *
 * All sequences are real and sourced from our annotation database
 * (public/data/features.json), which was built from SnapGene public plasmid
 * library + iGEM Registry features clustered at 80% identity.
 *
 * To update sequences after features.json grows (e.g., Addgene expansion):
 *   python3 scripts/update-parts-catalog.py
 *   # then embed the sequences from data/parts-sequences.json here
 *
 * Parts not yet in the database (CmR, pSC101 ori) are omitted until
 * the sequences can be verified. AmpR + KanR cover >95% of E. coli use cases.
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
  /** Inducer molecule, if applicable. */
  inducibleBy?: string;
  /** Plasmid copies per cell (ori only). */
  copyNumber?: number;
  /** Restriction enzymes that cut within this part — avoid for cloning. */
  internalRestrictionSites?: string[];
  /** Source for sequence traceability. */
  source?: string;
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
    source: "T7 phage genome, phi10 promoter consensus (20 bp core)",
  },
  {
    id: "tac_promoter",
    name: "tac promoter",
    type: "promoter",
    organisms: ["ecoli"],
    description:
      "Hybrid trp-lac promoter. Strong, directly IPTG-inducible in any standard E. coli strain — no T7 RNAP required. Produces high levels of recombinant protein with good induction control. Used in pGEX, pMAL, and many expression vectors. Requires lacI repressor for tight control (present in DH5α, BL21, most lab strains).",
    seq: "TTGACAATTAATCATCGGCTCGTATAATGTGTGGAATTGTGAGCGGATAACAATTTCACACAGG",
    strength: "strong",
    inducibleBy: "IPTG",
    source: "de Boer et al. 1983, Proc Natl Acad Sci (64 bp, includes -35, -10, and lac operator)",
  },
  {
    id: "araBAD_promoter",
    name: "araBAD promoter",
    type: "promoter",
    organisms: ["ecoli"],
    description:
      "Arabinose-inducible promoter with tight repression in glucose. Excellent for toxic proteins due to very low leakage. Induced by L-arabinose; repressed by glucose. Lower expression than T7 or tac but tighter control. Good for difficult-to-express or toxic proteins.",
    seq: "AAGAAACCAATTGTCCATATTGCATCAGACATTGCCGTCACTGCGTCTTTTACTGGCTCTTCTCGCTAACCAAACCGGTAACCCCGCTTATTAAAAGCATTCTGTAACAAAGCGGGACCAAAGCCATGACAAAAACGCGTAACAAAAGTGTCTATAATCACGGCAGAAAAGTCCACATTGATTATTTGCACGGCGTCACACTTTGCTATGCCATAGCATTTTTATCCATAAGATTAGCGGATCCTACCTGACGCTTTTTATCGCAACTCTCTACTGTTTCTCCAT",
    strength: "medium",
    inducibleBy: "arabinose",
    source: "features.json: araBAD promoter (285 bp) from pBAD vector series",
  },
  {
    id: "j23119_promoter",
    name: "J23119 (constitutive, strong)",
    type: "promoter",
    organisms: ["ecoli"],
    description:
      "Strong constitutive promoter from the iGEM Anderson Promoter Library. No induction required — produces protein continuously. Good for selection markers, reporter genes, or when constitutive expression is desired.",
    seq: "TTGACAGCTAGCTCAGTCCTAGGTATAATGCTAGC",
    strength: "strong",
    source: "iGEM Registry BBa_J23119, Anderson Promoter Library (35 bp)",
  },
  {
    id: "j23101_promoter",
    name: "J23101 (constitutive, medium)",
    type: "promoter",
    organisms: ["ecoli"],
    description:
      "Medium-strength constitutive promoter from the iGEM Anderson Promoter Library. Useful when strong constitutive expression causes growth burden.",
    seq: "TTTACAGCTAGCTCAGTCCTAGGTATTATGCTAGC",
    strength: "medium",
    source: "iGEM Registry BBa_J23101, Anderson Promoter Library (35 bp)",
  },

  // ── Ribosome Binding Sites ─────────────────────────────────────────────────

  {
    id: "b0034_rbs",
    name: "RBS B0034 (strong)",
    type: "rbs",
    organisms: ["ecoli"],
    description:
      "Strong ribosome binding site from the iGEM Registry. Contains a strong Shine-Dalgarno sequence with optimal spacing. Use with strong promoters for maximum translation.",
    seq: "AAAGAGGAGAAATACTA",
    strength: "strong",
    source: "iGEM Registry BBa_B0034 (17 bp)",
  },
  {
    id: "b0032_rbs",
    name: "RBS B0032 (medium)",
    type: "rbs",
    organisms: ["ecoli"],
    description:
      "Medium-strength RBS. Lower translation rate reduces metabolic burden and can improve folding of difficult proteins. Use when strong RBS + strong promoter causes insolubility.",
    seq: "AAAGAGGAG",
    strength: "medium",
    source: "iGEM Registry BBa_B0032 (9 bp)",
  },

  // ── Terminators ────────────────────────────────────────────────────────────

  {
    id: "t7_terminator",
    name: "T7 terminator",
    type: "terminator",
    organisms: ["ecoli"],
    description:
      "Strong transcriptional terminator from T7 phage. Works with both T7 and bacterial RNA polymerases. Efficient stem-loop prevents read-through. Pair with T7 promoter or any strong E. coli promoter.",
    seq: "CTAGCATAACCCCTTGGGGCCTCTAAACGGGTCTTGAGGGGTTTTTTG",
    source: "features.json: T7 terminator (48 bp)",
  },
  {
    id: "rrnB_T1T2",
    name: "rrnB T1T2 terminator",
    type: "terminator",
    organisms: ["ecoli"],
    description:
      "Double terminator from the E. coli rrnB ribosomal RNA operon. Two sequential terminators (T1 then T2) provide very high termination efficiency. Reduces read-through into downstream sequences. Commonly used in pET and many expression vectors.",
    seq: "ATTTGTCCTACTCAGGAGAGCGTTCACCGACAAACAACAGATAAAACGAAAGGCCCAGTCTTCCGACTGAGCCTTTCGTTTTATTTGAGAAGGCCATCCTGACGGATGGCCTTTT",
    source: "features.json: rrnB T1 (87 bp) + rrnB T2 (28 bp) = 115 bp",
  },

  // ── Origins of Replication ─────────────────────────────────────────────────

  {
    id: "colE1_ori",
    name: "ColE1/pMB1 origin",
    type: "ori",
    organisms: ["ecoli"],
    description:
      "High-copy origin of replication (~500 copies/cell). Used in pUC, pBluescript, pGEM, and most common cloning vectors. Compatible with most E. coli strains. Incompatible with p15A-based plasmids — cannot co-transform with pACYC-based vectors.",
    seq: "ATGAAATCTAACAATGCGCTCATCGTCATCCTCGGCACCGTCACCCTGGATGCTGTAGGCATAGGCTTGGTTATGCCGGTACTGCCGGGCCTCTTGCGGGATATCGTCCATTCCGACAGCATCGCCAGTCACTATGGCGTGCTGCTAGCGCTATATGCGTTGATGCAATTTCTATGCGCACCCGTTCTCGGAGCACTGTCCGACCGCTTTGGCCGCCGCCCAGTCCTGCTCGCTTCGCTACTTGGAGCCACTATCGACTACGCGATCATGGCGACCACACCCGTCCTGTGGATCCTCTACGCCGGACGCATCGTGGCCGGCATCACCGGCGCCACAGGTGCGGTTGCTGGCGCCTATATCGCCGACATCACCGATGGGGAAGATCGGGCTCGCCACTTCGGGCTCATGAGCGCTTGTTTCGGCGTGGGTATGGTGGCAGGCCCCGTGGCCGGGGGACTGTTGGGCGCCATCTCCTTGCATGCACCATTCCTTGCGGCGGCGGTGCTCAACGGCCTCAACCTACTACTGGGCTGCTTCCTAATGCAGGAGTCGCATAAGGGAGAGCGTCGACCGATGCCCTTGAGAGCCTTCAACCCAGTCAGCTCCTTCCGGTGGGCGCGGGGCATGACTATCGTCGCCGCACTTATGACTGTCTTCTTTATCATGCAACTCGTAGGACAGGTGCCGGCAGCGCTCTGGGTCATTTTCGGCGAGGACCGCTTTCGCTGGAGCGCGACGATGATCGGCCTGTCGCTTGCGGTATTCGGAATCTTGCACGCCCTCGCTCAAGCCTTCGTCACTGGTCCCGCCACCAAACGTTTCGGCGAGAAGCAGGCCATTATCGCCGGCATGGCGGCCGACGCGCTGGGCTACGTCTTGCTGGCGTTCGCGACGCGAGGCTGGATGGCCTTCCCCATTATGATTCTTCTCGCTTCCGGCGGCATCGGGATGCCCGCGTTGCAGGCCATGCTGTCCAGGCAGGTAGATGACGACCATCAGGGACAGCTTCAAGGATCGCTCGCGGCTCTTACCAGCCTAACTTCGATCACTGGACCGCTGATCGTCACGGCGATTTATGCCGCCTCGGCGAGCACATGGAACGGGTTGGCATGGATTGTAGGCGCCGCCCTATACCTTGTCTGCCTCCCCGCGTTGCGTCGCGGTGCATGGAGCCGGGCCACCTCGACCTGA",
    copyNumber: 500,
    source: "features.json: ColE1 ori (1191 bp) from SnapGene plasmid library",
  },
  {
    id: "p15a_ori",
    name: "p15A origin",
    type: "ori",
    organisms: ["ecoli"],
    description:
      "Medium-copy origin (~15-20 copies/cell) from pACYC184. Compatible with ColE1 plasmids — use when you need to co-transform two plasmids. Found in pACYC, pZA, and many two-plasmid systems.",
    seq: "TTGAGATCGTTTTGGTCTGCGCGTAATCTCTTGCTCTGAAAACGAAAAAACCGCCTTGCAGGGCGGTTTTTCGAAGGTTCTCTGAGCTACCAACTCTTTGAACCGAGGTAACTGGCTTGGAGGAGCGCAGTCACCAAAACTTGTCCTTTCAGTTTAGCCTTAACCGGCGCATGACTTCAAGACTAACTCCTCTAAATCAATTACCAGTGGCTGCTGCCAGTGGTGCTTTTGCATGTCTTTCCGGGTTGGACTCAAGACGATAGTTACCGGATAAGGCGCAGCGGTCGGACTGAACGGGGGGTTCGTGCATACAGTCCAGCTTGGAGCGAACTGCCTACCCGGAACTGAGTGTCAGGCGTGGAATGAGACAAACGCGGCCATAACAGCGGAATGACACCGGTAAACCGAAAGGCAGGAACAGGAGAGCGCACGAGGGAGCCGCCAGGGGGAAACGCCTGGTATCTTTATAGTCCTGTCGGGTTTCGCCACCACTGATTTGAGCGTCAGATTTCGTGATGCTTGTCAGGGGGGCGGAGCCTATGGAAA",
    copyNumber: 20,
    source: "features.json: p15A ori (546 bp) from SnapGene plasmid library",
  },

  // ── Resistance Markers ─────────────────────────────────────────────────────

  {
    id: "ampR_marker",
    name: "AmpR (ampicillin resistance)",
    type: "marker",
    organisms: ["ecoli"],
    description:
      "Beta-lactamase cassette conferring ampicillin resistance. Includes native AmpR promoter + bla CDS. Most common selection marker. Caution: ampicillin degrades in culture — satellite colonies can appear after 12-16h of growth. Prefer KanR for long cultures or when false-positive colonies are a concern.",
    seq: "CGCGGAACCCCTATTTGTTTATTTTTCTAAATACATTCAAATATGTATCCGCTCATGAGACAATAACCCTGATAAATGCTTCAATAATATTGAAAAAGGAAGAGTATGAGTATTCAACATTTCCGTGTCGCCCTTATTCCCTTTTTTGCGGCATTTTGCCTTCCTGTTTTTGCTCACCCAGAAACGCTGGTGAAAGTAAAAGATGCTGAAGATCAGTTGGGTGCACGAGTGGGTTACATCGAACTGGATCTCAACAGCGGTAAGATCCTTGAGAGTTTTCGCCCCGAAGAACGTTTTCCAATGATGAGCACTTTTAAAGTTCTGCTATGTGGCGCGGTATTATCCCGTGTTGACGCCGGGCAAGAGCAACTCGGTCGCCGCATACACTATTCTCAGAATGACTTGGTTGAGTACTCACCAGTCACAGAAAAGCATCTTACGGATGGCATGACAGTAAGAGAATTATGCAGTGCTGCCATAACCATGAGTGATAACACTGCGGCCAACTTACTTCTGACAACGATCGGAGGACCGAAGGAGCTAACCGCTTTTTTGCACAACATGGGGGATCATGTAACTCGCCTTGATCGTTGGGAACCGGAGCTGAATGAAGCCATACCAAACGACGAGCGTGACACCACGATGCCTGCAGCAATGGCAACAACGTTGCGCAAACTATTAACTGGCGAACTACTTACTCTAGCTTCCCGGCAACAATTAATAGACTGGATGGAGGCGGATAAAGTTGCAGGACCACTTCTGCGCTCGGCCCTTCCGGCTGGCTGGTTTATTGCTGATAAATCTGGAGCCGGTGAGCGTGGGTCTCGCGGTATCATTGCAGCACTGGGGCCAGATGGTAAGCCCTCCCGTATCGTAGTTATCTACACGACGGGGAGTCAGGCAACTATGGATGAACGAAATAGACAGATCGCTGAGATAGGTGCCTCACTGATTAAGCATTGGTAA",
    source: "features.json: AmpR promoter (105 bp) + AmpR/bla CDS (861 bp, TEM-1) = 966 bp",
  },
  {
    id: "kanR_marker",
    name: "KanR (kanamycin resistance)",
    type: "marker",
    organisms: ["ecoli"],
    description:
      "Aminoglycoside phosphotransferase cassette conferring kanamycin resistance. Kanamycin is stable in culture — no satellite colonies. Preferred when working with high-copy plasmids or extended culture times. Uses AmpR promoter to drive KanR CDS expression.",
    seq: "CGCGGAACCCCTATTTGTTTATTTTTCTAAATACATTCAAATATGTATCCGCTCATGAGACAATAACCCTGATAAATGCTTCAATAATATTGAAAAAGGAAGAGTATGAGCCATATTCAACGGGAAACGTCTTGCTCGAGGCCGCGATTAAATTCCAACATGGATGCTGATTTATATGGGTATAAATGGGCTCGCGATAATGTCGGGCAATCAGGTGCGACAATCTATCGATTGTATGGGAAGCCCGATGCGCCAGAGTTGTTTCTGAAACATGGCAAAGGTAGCGTTGCCAATGATGTTACAGATGAGATGGTCAGGCTAAACTGGCTGACGGAATTTATGCCTCTTCCGACCATCAAGCATTTTATCCGTACTCCTGATGATGCATGGTTACTCACCACTGCGATCCCAGGGAAAACAGCATTCCAGGTATTAGAAGAATATCCTGATTCAGGTGAAAATATTGTTGATGCGCTGGCAGTGTTCCTGCGCCGGTTGCATTCGATTCCTGTTTGTAATTGTCCTTTTAACGGCGATCGCGTATTTCGTCTCGCTCAGGCGCAATCACGAATGAATAACGGTTTGGTTGGTGCGAGTGATTTTGATGACGAGCGTAATGGCTGGCCTGTTGAACAAGTCTGGAAAGAAATGCATAAGCTTTTGCCATTCTCACCGGATTCAGTCGTCACTCATGGTGATTTCTCACTTGATAACCTTATTTTTGACGAGGGGAAATTAATAGGTTGTATTGATGTTGGACGAGTCGGAATCGCAGACCGATACCAGGATCTTGCCATCCTATGGAACTGCCTCGGTGAGTTTTCTCCTTCATTACAGAAACGGCTTTTTCAAAAATATGGTATTGATAATCCTGATATGAATAAATTGCAGTTTCACTTGATGCTCGATGAGTTTTTCTGA",
    source: "features.json: AmpR promoter (105 bp) + KanR/APH(3')-Ia CDS (816 bp, Tn903) = 921 bp",
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
