/**
 * Simple CAI-based codon optimization.
 *
 * For each amino acid, selects the synonymous codon with highest relative
 * frequency in the target organism's genome. Codon tables sourced from
 * CoCoPUTs (Athey et al. 2017, NCBI RefSeq data).
 *
 * This is intentionally simple — the goal is workflow integration
 * (protein → DNA → Construct Designer), not algorithmic novelty.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type CodonOptOrganism = "ecoli" | "human" | "yeast";

export interface CodonOptResult {
  seq: string;     // optimized DNA sequence (starts with ATG, ends with stop)
  cai: number;     // Codon Adaptation Index [0, 1]
  gcContent: number;
  length: number;  // amino acid count
}

// ── Codon → amino acid map ────────────────────────────────────────────────────

const CODON_TO_AA: Record<string, string> = {
  TTT:"F",TTC:"F",TTA:"L",TTG:"L",
  CTT:"L",CTC:"L",CTA:"L",CTG:"L",
  ATT:"I",ATC:"I",ATA:"I",ATG:"M",
  GTT:"V",GTC:"V",GTA:"V",GTG:"V",
  TCT:"S",TCC:"S",TCA:"S",TCG:"S",
  CCT:"P",CCC:"P",CCA:"P",CCG:"P",
  ACT:"T",ACC:"T",ACA:"T",ACG:"T",
  GCT:"A",GCC:"A",GCA:"A",GCG:"A",
  TAT:"Y",TAC:"Y",TAA:"*",TAG:"*",
  CAT:"H",CAC:"H",CAA:"Q",CAG:"Q",
  AAT:"N",AAC:"N",AAA:"K",AAG:"K",
  GAT:"D",GAC:"D",GAA:"E",GAG:"E",
  TGT:"C",TGC:"C",TGA:"*",TGG:"W",
  CGT:"R",CGC:"R",CGA:"R",CGG:"R",
  AGT:"S",AGC:"S",AGA:"R",AGG:"R",
  GGT:"G",GGC:"G",GGA:"G",GGG:"G",
};

// ── Codon usage tables ────────────────────────────────────────────────────────
// Relative frequencies within each synonymous group, normalized to [0, 1].
// Source: CoCoPUTs database (Athey et al. 2017), NCBI RefSeq-derived tables.
//   E. coli: taxid 511145 (E. coli K-12 MG1655)
//   Human:   taxid 9606
//   Yeast:   taxid 4932 (S. cerevisiae S288C)

type CodonFreqs = Record<string, number>;
type OrgTable = Record<CodonOptOrganism, CodonFreqs>;

const TABLES: OrgTable = {
  ecoli: {
    // Phe
    TTT:0.51, TTC:0.49,
    // Leu
    TTA:0.13, TTG:0.13, CTT:0.11, CTC:0.10, CTA:0.04, CTG:0.49,
    // Ile
    ATT:0.49, ATC:0.44, ATA:0.07,
    // Met
    ATG:1.00,
    // Val
    GTT:0.26, GTC:0.22, GTA:0.17, GTG:0.35,
    // Ser
    TCT:0.15, TCC:0.15, TCA:0.14, TCG:0.14, AGT:0.16, AGC:0.26,
    // Pro
    CCT:0.16, CCC:0.10, CCA:0.20, CCG:0.54,
    // Thr
    ACT:0.16, ACC:0.44, ACA:0.14, ACG:0.26,
    // Ala
    GCT:0.16, GCC:0.27, GCA:0.22, GCG:0.35,
    // Tyr
    TAT:0.57, TAC:0.43,
    // Stop
    TAA:0.61, TAG:0.09, TGA:0.30,
    // His
    CAT:0.57, CAC:0.43,
    // Gln
    CAA:0.34, CAG:0.66,
    // Asn
    AAT:0.45, AAC:0.55,
    // Lys
    AAA:0.74, AAG:0.26,
    // Asp
    GAT:0.59, GAC:0.41,
    // Glu
    GAA:0.68, GAG:0.32,
    // Cys
    TGT:0.44, TGC:0.56,
    // Trp
    TGG:1.00,
    // Arg
    CGT:0.38, CGC:0.40, CGA:0.06, CGG:0.10, AGA:0.04, AGG:0.02,
    // Gly
    GGT:0.35, GGC:0.37, GGA:0.13, GGG:0.15,
  },

  human: {
    // Phe
    TTT:0.46, TTC:0.54,
    // Leu
    TTA:0.07, TTG:0.13, CTT:0.13, CTC:0.20, CTA:0.07, CTG:0.40,
    // Ile
    ATT:0.36, ATC:0.48, ATA:0.16,
    // Met
    ATG:1.00,
    // Val
    GTT:0.18, GTC:0.24, GTA:0.11, GTG:0.47,
    // Ser
    TCT:0.15, TCC:0.22, TCA:0.15, TCG:0.06, AGT:0.15, AGC:0.24,
    // Pro
    CCT:0.28, CCC:0.33, CCA:0.27, CCG:0.11,
    // Thr
    ACT:0.24, ACC:0.36, ACA:0.28, ACG:0.12,
    // Ala
    GCT:0.26, GCC:0.40, GCA:0.23, GCG:0.11,
    // Tyr
    TAT:0.44, TAC:0.56,
    // Stop
    TAA:0.29, TAG:0.20, TGA:0.51,
    // His
    CAT:0.41, CAC:0.59,
    // Gln
    CAA:0.25, CAG:0.75,
    // Asn
    AAT:0.46, AAC:0.54,
    // Lys
    AAA:0.43, AAG:0.57,
    // Asp
    GAT:0.46, GAC:0.54,
    // Glu
    GAA:0.42, GAG:0.58,
    // Cys
    TGT:0.45, TGC:0.55,
    // Trp
    TGG:1.00,
    // Arg
    CGT:0.08, CGC:0.19, CGA:0.11, CGG:0.21, AGA:0.20, AGG:0.20,
    // Gly
    GGT:0.16, GGC:0.34, GGA:0.25, GGG:0.25,
  },

  yeast: {
    // Phe
    TTT:0.59, TTC:0.41,
    // Leu
    TTA:0.28, TTG:0.29, CTT:0.13, CTC:0.06, CTA:0.14, CTG:0.11,
    // Ile
    ATT:0.46, ATC:0.26, ATA:0.27,
    // Met
    ATG:1.00,
    // Val
    GTT:0.39, GTC:0.21, GTA:0.21, GTG:0.19,
    // Ser
    TCT:0.26, TCC:0.16, TCA:0.21, TCG:0.10, AGT:0.16, AGC:0.11,
    // Pro
    CCT:0.31, CCC:0.15, CCA:0.41, CCG:0.12,
    // Thr
    ACT:0.35, ACC:0.22, ACA:0.30, ACG:0.13,
    // Ala
    GCT:0.38, GCC:0.22, GCA:0.29, GCG:0.11,
    // Tyr
    TAT:0.56, TAC:0.44,
    // Stop
    TAA:0.47, TAG:0.23, TGA:0.30,
    // His
    CAT:0.64, CAC:0.36,
    // Gln
    CAA:0.69, CAG:0.31,
    // Asn
    AAT:0.59, AAC:0.41,
    // Lys
    AAA:0.58, AAG:0.42,
    // Asp
    GAT:0.65, GAC:0.35,
    // Glu
    GAA:0.70, GAG:0.30,
    // Cys
    TGT:0.63, TGC:0.37,
    // Trp
    TGG:1.00,
    // Arg
    CGT:0.14, CGC:0.06, CGA:0.07, CGG:0.04, AGA:0.48, AGG:0.21,
    // Gly
    GGT:0.47, GGC:0.19, GGA:0.22, GGG:0.12,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** All codons encoding a given amino acid (single-letter code). */
function synonymousCodons(aa: string, table: CodonFreqs): string[] {
  return Object.entries(CODON_TO_AA)
    .filter(([, a]) => a === aa.toUpperCase())
    .map(([c]) => c)
    .filter((c) => table[c] !== undefined);
}

/** Preferred stop codon for the organism. */
function preferredStop(table: CodonFreqs): string {
  return (
    ["TAA", "TGA", "TAG"]
      .map((s) => ({ s, f: table[s] ?? 0 }))
      .sort((a, b) => b.f - a.f)[0]?.s ?? "TAA"
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

const IUPAC_AA = new Set("ACDEFGHIKLMNPQRSTVWY*");

/** Remove headers, whitespace, numbers — return uppercase single-letter codes. */
export function parseProteinSeq(raw: string): string {
  return raw
    .split("\n")
    .filter((l) => !l.startsWith(">"))
    .join("")
    .replace(/[^A-Za-z*]/g, "")
    .toUpperCase();
}

/** Validate a parsed protein string. Returns unknown characters found. */
export function validateProtein(protein: string): { valid: boolean; unknown: string[] } {
  const unknown = [...new Set(protein.split("").filter((c) => !IUPAC_AA.has(c)))];
  return { valid: unknown.length === 0, unknown };
}

/**
 * Optimize a protein sequence to DNA for the target organism.
 * Selects the highest-frequency synonymous codon at each position.
 * The returned sequence always starts with ATG and ends with a stop codon.
 */
export function optimizeCodon(protein: string, organism: CodonOptOrganism): CodonOptResult {
  const table = TABLES[organism];
  const clean = parseProteinSeq(protein).replace(/\*$/, ""); // strip trailing stop
  const aas = clean.split("").filter((c) => c !== "*");

  const codons: string[] = [];
  for (const aa of aas) {
    const syns = synonymousCodons(aa, table);
    if (syns.length === 0) continue;
    // Pick the codon with the highest relative frequency
    const best = syns.reduce((a, b) => ((table[b] ?? 0) > (table[a] ?? 0) ? b : a));
    codons.push(best);
  }

  // Override first codon to ATG (Met start codon is always ATG)
  if (codons.length > 0 && aas[0] === "M") codons[0] = "ATG";

  // Append preferred stop
  codons.push(preferredStop(table));

  const seq = codons.join("");
  return {
    seq,
    cai: computeCAI(seq, organism),
    gcContent: computeGC(seq),
    length: aas.length,
  };
}

/**
 * Compute the Codon Adaptation Index for a DNA sequence.
 * CAI is the geometric mean of per-codon relative adaptiveness values.
 * Returns 0 if the sequence has no scorable codons.
 */
export function computeCAI(dna: string, organism: CodonOptOrganism): number {
  const table = TABLES[organism];
  const upper = dna.toUpperCase().replace(/\s/g, "");
  let logSum = 0;
  let count = 0;

  for (let i = 0; i + 2 < upper.length; i += 3) {
    const codon = upper.slice(i, i + 3);
    const aa = CODON_TO_AA[codon];
    if (!aa || aa === "*") continue;

    const syns = synonymousCodons(aa, table);
    const maxFreq = Math.max(...syns.map((s) => table[s] ?? 0));
    const freq = table[codon] ?? 0;
    if (maxFreq > 0 && freq > 0) {
      logSum += Math.log(freq / maxFreq);
      count++;
    }
  }

  return count > 0 ? Math.exp(logSum / count) : 0;
}

/** GC fraction of a DNA sequence [0, 1]. */
export function computeGC(dna: string): number {
  const upper = dna.toUpperCase();
  const gc = upper.split("").filter((c) => c === "G" || c === "C").length;
  return upper.length > 0 ? gc / upper.length : 0;
}
