import { describe, expect, it } from "vitest";
import type { AlignmentResult } from "./align";
import type { AnnotationSummary, ReadInput } from "./verify-clone";
import {
  CONFIRMED_MIN_IDENTITY,
  CONFIRMED_NO_CDS_IDENTITY,
  LOW_QUALITY_THRESHOLD,
  buildVerificationPromptContext,
  verifyClone,
  verifyRead,
} from "./verify-clone";

// ── Test fixtures ─────────────────────────────────────────────────────────────

/**
 * Build a minimal AlignmentResult for testing.
 * Defaults: forward strand, 100% identity, perfectly aligned.
 * Override individual fields to simulate specific scenarios.
 */
function makeAlignment(
  overrides: Partial<AlignmentResult> & {
    refAligned: string;
    queryAligned: string;
    refStart: number;
  },
): AlignmentResult {
  const refAligned = overrides.refAligned;
  const alignedLen = refAligned.replace(/-/g, "").length;

  return {
    refStart: overrides.refStart,
    refEnd: overrides.refEnd ?? overrides.refStart + alignedLen,
    queryStart: overrides.queryStart ?? 0,
    queryEnd: overrides.queryEnd ?? overrides.queryAligned.replace(/-/g, "").length,
    strand: overrides.strand ?? "+",
    score: overrides.score ?? alignedLen * 2,
    identity: overrides.identity ?? 0.99, // default: near-perfect read
    coverage: overrides.coverage ?? 1.0,
    mismatches: overrides.mismatches ?? [],
    refAligned,
    queryAligned: overrides.queryAligned,
  };
}

/**
 * A minimal plasmid for testing: 900 bp
 *   promoter: 0–60 (forward)
 *   CDS:      60–360 (forward, 100 codons of ATG = Met)
 *   AmpR:     500–860 (reverse)
 *
 * Sequence: all A's except the CDS region which is repeating ATG.
 */
const SEQ_LEN = 900;
const CDS_START = 60;
const CDS_END = 360; // 300 bp = 100 codons

function makeSeq(): string {
  const bases = new Array<string>(SEQ_LEN).fill("A");
  // CDS: repeating ATG (Met)
  for (let i = CDS_START; i < CDS_END; i += 3) {
    bases[i] = "A";
    bases[i + 1] = "T";
    bases[i + 2] = "G";
  }
  // AmpR region: repeating CAG (Gln) on forward strand, CTG (Leu) on RC
  for (let i = 500; i < 860; i += 3) {
    bases[i] = "C";
    bases[i + 1] = "A";
    bases[i + 2] = "G";
  }
  return bases.join("");
}

const SEQ = makeSeq();

const PROMOTER_ANN: AnnotationSummary = {
  name: "T7 promoter",
  type: "promoter",
  start: 0,
  end: 60,
  direction: 1,
};

const CDS_ANN: AnnotationSummary = {
  name: "TestCDS",
  type: "CDS",
  start: CDS_START,
  end: CDS_END,
  direction: 1,
};

const AMPR_ANN: AnnotationSummary = {
  name: "AmpR",
  type: "CDS",
  start: 500,
  end: 860,
  direction: -1,
};

const ALL_ANNS: AnnotationSummary[] = [PROMOTER_ANN, CDS_ANN, AMPR_ANN];

// ── Helper: build a read input covering the full CDS ─────────────────────────

function fullCDSRead(overrides: Partial<AlignmentResult> = {}): ReadInput {
  const refSlice = SEQ.slice(CDS_START, CDS_END);
  return {
    name: "M13_fwd",
    result: makeAlignment({
      refAligned: refSlice,
      queryAligned: refSlice,
      refStart: CDS_START,
      ...overrides,
    }),
  };
}

// ── verifyRead unit tests ─────────────────────────────────────────────────────

describe("verifyRead", () => {
  it("unaligned read (score=0) → not aligned", () => {
    const read: ReadInput = {
      name: "bad_read",
      result: makeAlignment({
        refAligned: "ATGATG",
        queryAligned: "ATGATG",
        refStart: 0,
        score: 0,
      }),
    };
    const rv = verifyRead(read.name, read.result, ALL_ANNS, SEQ, "linear");
    expect(rv.aligned).toBe(false);
    expect(rv.variants).toHaveLength(0);
  });

  it("undefined result → not aligned", () => {
    const rv = verifyRead("no_result", undefined, ALL_ANNS, SEQ, "linear");
    expect(rv.aligned).toBe(false);
  });

  it("perfect alignment → zero variants, aligned", () => {
    const refSlice = SEQ.slice(CDS_START, CDS_END);
    const rv = verifyRead(
      "fwd_perfect",
      makeAlignment({ refAligned: refSlice, queryAligned: refSlice, refStart: CDS_START }),
      ALL_ANNS,
      SEQ,
      "linear",
    );
    expect(rv.aligned).toBe(true);
    expect(rv.variants).toHaveLength(0);
    expect(rv.silentCount).toBe(0);
    expect(rv.missenseCount).toBe(0);
  });

  it("silent substitution in CDS → silent, not missense", () => {
    // CDS starts at 60 with repeating ATG. Codon 0 = ATG (positions 60,61,62).
    // Change position 62 (G→A): ATG→ATA = Met→Ile... actually ATA = Ile, missense!
    // Let's use position 62 (0-indexed): G→A: codon ATG→ATA=Ile — MISSENSE
    // We need a truly silent change. ATG→ATG (no change) or find a degenerate position.
    // In our CDS the pattern is ATG repeated. Position 63 (start of codon 1) = A.
    // A→A is no change. Let's pick position 60 = A, change to... hmm all codons are ATG.
    //
    // Let's build a CDS with a wobble position for testing.
    // Override: change the seq so codon 5 (positions 75-77) is "AAA" (Lys)
    // Then change position 77 (A→G): AAA→AAG = Lys→Lys = SILENT
    //
    // Use a custom seq where codon 5 = AAA
    const customSeq = SEQ.split("");
    customSeq[75] = "A";
    customSeq[76] = "A";
    customSeq[77] = "A";
    const seq = customSeq.join("");

    // Read: 30 bp covering positions 60-90, with G at position 77
    const refSlice = seq.slice(60, 90); // contains AAA at positions 75-77
    const querySlice = refSlice.split("");
    querySlice[77 - 60] = "G"; // A→G at ref position 77
    const queryStr = querySlice.join("");

    const rv = verifyRead(
      "test_read",
      makeAlignment({
        refAligned: refSlice,
        queryAligned: queryStr,
        refStart: 60,
        identity: 0.99,
        mismatches: [{ refPos: 77, queryPos: 17, refBase: "A", queryBase: "G", qualityScore: 35 }],
      }),
      [CDS_ANN],
      seq,
      "linear",
    );

    expect(rv.variants).toHaveLength(1);
    const v = rv.variants[0]!;
    expect(v.effect.kind).toBe("inCDS");
    if (v.effect.kind === "inCDS") {
      expect(v.effect.effect).toBe("silent");
      expect(v.effect.featureName).toBe("TestCDS");
      expect(v.effect.refAA).toBe("K"); // Lys
      expect(v.effect.altAA).toBe("K"); // Lys
      expect(v.effect.refCodon).toBe("AAA");
      expect(v.effect.altCodon).toBe("AAG");
    }
    expect(rv.silentCount).toBe(1);
    expect(rv.missenseCount).toBe(0);
  });

  it("missense substitution in CDS → missense effect", () => {
    // CDS positions 60-360, repeating ATG. Change position 61 (T→C): ATG→ACG = Met→Thr
    const refSlice = SEQ.slice(CDS_START, CDS_START + 30);
    const querySlice = refSlice.split("");
    querySlice[1] = "C"; // position 61 relative to seq start: T→C
    const queryStr = querySlice.join("");

    const rv = verifyRead(
      "test_read",
      makeAlignment({
        refAligned: refSlice,
        queryAligned: queryStr,
        refStart: CDS_START,
        identity: 0.99,
        mismatches: [{ refPos: 61, queryPos: 1, refBase: "T", queryBase: "C", qualityScore: 38 }],
      }),
      [CDS_ANN],
      SEQ,
      "linear",
    );

    expect(rv.variants).toHaveLength(1);
    const v = rv.variants[0]!;
    expect(v.effect.kind).toBe("inCDS");
    if (v.effect.kind === "inCDS") {
      expect(v.effect.effect).toBe("missense");
      expect(v.effect.refAA).toBe("M"); // Met
      expect(v.effect.altAA).toBe("T"); // Thr
      expect(v.effect.refCodon).toBe("ATG");
      expect(v.effect.altCodon).toBe("ACG");
      expect(v.effect.codonIndex).toBe(0);
      expect(v.effect.posInCodon).toBe(2); // second position of codon (1-based)
    }
    expect(rv.missenseCount).toBe(1);
    expect(rv.silentCount).toBe(0);
  });

  it("nonsense mutation (stop codon introduced) in CDS", () => {
    // ATG → TAG at position 60 (A→T, second base G stays): ATG→TAG = Met→*
    // Actually ATG → TGA: position 60 A→T, position 62 G→A: too complex
    // Let's do: CDS has AAA at positions 75-77 (from custom seq like above)
    // AAA→TAA = Lys→STOP: position 75 A→T
    const customSeq = SEQ.split("");
    customSeq[75] = "A";
    customSeq[76] = "A";
    customSeq[77] = "A";
    const seq = customSeq.join("");

    const refSlice = seq.slice(60, 90);
    const querySlice = refSlice.split("");
    querySlice[75 - 60] = "T"; // A→T at position 75: AAA→TAA = Lys→STOP
    const queryStr = querySlice.join("");

    const rv = verifyRead(
      "test_read",
      makeAlignment({
        refAligned: refSlice,
        queryAligned: queryStr,
        refStart: 60,
        identity: 0.99,
        mismatches: [{ refPos: 75, queryPos: 15, refBase: "A", queryBase: "T", qualityScore: 40 }],
      }),
      [CDS_ANN],
      seq,
      "linear",
    );

    expect(rv.variants).toHaveLength(1);
    const v = rv.variants[0]!;
    expect(v.effect.kind).toBe("inCDS");
    if (v.effect.kind === "inCDS") {
      expect(v.effect.effect).toBe("nonsense");
      expect(v.effect.altAA).toBe("*");
    }
    expect(rv.nonsenseCount).toBe(1);
  });

  it("1-bp deletion in CDS → frameshift", () => {
    // Delete one base from the CDS region: reading frame disrupted
    const refSlice = SEQ.slice(CDS_START, CDS_START + 12); // "ATGATGATGATG"
    // Delete the T at position 1 (0-indexed in the read):
    // ref:   A T G A T G A T G A T G
    // query: A - G A T G A T G A T G
    const queryAligned = "A-GATGATGATG";

    const rv = verifyRead(
      "test_read",
      makeAlignment({
        refAligned: refSlice,
        queryAligned,
        refStart: CDS_START,
        identity: 0.99,
      }),
      [CDS_ANN],
      SEQ,
      "linear",
    );

    expect(rv.variants).toHaveLength(1);
    const v = rv.variants[0]!;
    expect(v.variantType).toBe("deletion");
    expect(v.length).toBe(1);
    expect(v.effect.kind).toBe("inCDS");
    if (v.effect.kind === "inCDS") {
      expect(v.effect.effect).toBe("frameshift");
    }
    expect(rv.frameshiftCount).toBe(1);
  });

  it("3-bp deletion in CDS → in-frame-indel, not frameshift", () => {
    // Delete 3 bases (one full codon): in-frame deletion, not a frameshift
    // ref:   A T G A T G A T G A T G
    // query: A T G - - - A T G A T G
    const refSlice = SEQ.slice(CDS_START, CDS_START + 12);
    const queryAligned = "ATG---ATGATG";

    const rv = verifyRead(
      "test_read",
      makeAlignment({
        refAligned: refSlice,
        queryAligned,
        refStart: CDS_START,
        identity: 0.99,
      }),
      [CDS_ANN],
      SEQ,
      "linear",
    );

    expect(rv.variants).toHaveLength(1);
    const v = rv.variants[0]!;
    expect(v.variantType).toBe("deletion");
    expect(v.length).toBe(3);
    expect(v.effect.kind).toBe("inCDS");
    if (v.effect.kind === "inCDS") {
      expect(v.effect.effect).toBe("in-frame-indel");
    }
    expect(rv.frameshiftCount).toBe(0);
  });

  it("2-bp insertion in CDS → frameshift", () => {
    // ref:   A T G A T G
    // query: A T G G G A T G  (2 extra bases inserted after pos 62)
    const refAligned = "ATG--ATGATG";
    const queryAligned = "ATGGG ATGATG".replace(" ", "");

    const rv = verifyRead(
      "test_read",
      makeAlignment({
        refAligned,
        queryAligned,
        refStart: CDS_START,
        identity: 0.99,
      }),
      [CDS_ANN],
      SEQ,
      "linear",
    );

    const indels = rv.variants.filter((v) => v.variantType === "insertion");
    expect(indels).toHaveLength(1);
    expect(indels[0]!.length).toBe(2);
    expect(indels[0]!.effect.kind).toBe("inCDS");
    if (indels[0]!.effect.kind === "inCDS") {
      expect(indels[0]!.effect.effect).toBe("frameshift");
    }
    expect(rv.frameshiftCount).toBe(1);
  });

  it("low-quality mismatch (Q<threshold) → flagged as sequencing error", () => {
    const refSlice = SEQ.slice(CDS_START, CDS_START + 12);
    const querySlice = refSlice.split("");
    querySlice[1] = "C"; // T→C at pos 61
    const queryStr = querySlice.join("");

    const rv = verifyRead(
      "test_read",
      makeAlignment({
        refAligned: refSlice,
        queryAligned: queryStr,
        refStart: CDS_START,
        identity: 0.99,
        mismatches: [
          {
            refPos: 61,
            queryPos: 1,
            refBase: "T",
            queryBase: "C",
            qualityScore: LOW_QUALITY_THRESHOLD - 1, // below threshold
          },
        ],
      }),
      [CDS_ANN],
      SEQ,
      "linear",
    );

    expect(rv.variants).toHaveLength(1);
    expect(rv.variants[0]!.isLikelySequencingError).toBe(true);
    expect(rv.likelyErrorCount).toBe(1);
    expect(rv.missenseCount).toBe(0); // suppressed
  });

  it("high-quality mismatch (Q>=threshold) → not suppressed", () => {
    const refSlice = SEQ.slice(CDS_START, CDS_START + 12);
    const querySlice = refSlice.split("");
    querySlice[1] = "C";
    const queryStr = querySlice.join("");

    const rv = verifyRead(
      "test_read",
      makeAlignment({
        refAligned: refSlice,
        queryAligned: queryStr,
        refStart: CDS_START,
        identity: 0.99,
        mismatches: [{ refPos: 61, queryPos: 1, refBase: "T", queryBase: "C", qualityScore: 35 }],
      }),
      [CDS_ANN],
      SEQ,
      "linear",
    );

    expect(rv.variants[0]!.isLikelySequencingError).toBe(false);
    expect(rv.missenseCount).toBe(1);
  });

  it("mismatch without quality score (reverse strand) → not suppressed", () => {
    // Reverse-strand reads have qualityScore: undefined — should count as real variant
    const refSlice = SEQ.slice(CDS_START, CDS_START + 12);
    const querySlice = refSlice.split("");
    querySlice[1] = "C";
    const queryStr = querySlice.join("");

    const rv = verifyRead(
      "test_read",
      makeAlignment({
        refAligned: refSlice,
        queryAligned: queryStr,
        refStart: CDS_START,
        strand: "-",
        identity: 0.99,
        mismatches: [
          {
            refPos: 61,
            queryPos: 1,
            refBase: "T",
            queryBase: "C",
            qualityScore: undefined, // rev strand: no quality
          },
        ],
      }),
      [CDS_ANN],
      SEQ,
      "linear",
    );

    expect(rv.variants[0]!.isLikelySequencingError).toBe(false);
    expect(rv.variants[0]!.qualityScore).toBeUndefined();
    expect(rv.missenseCount).toBe(1);
  });

  it("variant in intergenic region → intergenic effect", () => {
    // Position 400 is between CDS (end=360) and AmpR (start=500)
    const refSlice = SEQ.slice(390, 410);
    const querySlice = refSlice.split("");
    querySlice[10] = "T"; // A→T at position 400, no annotation here
    const queryStr = querySlice.join("");

    const rv = verifyRead(
      "test_read",
      makeAlignment({
        refAligned: refSlice,
        queryAligned: queryStr,
        refStart: 390,
        identity: 0.99,
        mismatches: [{ refPos: 400, queryPos: 10, refBase: "A", queryBase: "T" }],
      }),
      ALL_ANNS,
      SEQ,
      "linear",
    );

    expect(rv.variants).toHaveLength(1);
    expect(rv.variants[0]!.effect.kind).toBe("intergenic");
    expect(rv.missenseCount).toBe(0);
  });

  it("variant in promoter region → inFeature effect (not CDS)", () => {
    // Position 30 is in the promoter annotation
    const refSlice = SEQ.slice(20, 40);
    const querySlice = refSlice.split("");
    querySlice[10] = "T";
    const queryStr = querySlice.join("");

    const rv = verifyRead(
      "test_read",
      makeAlignment({
        refAligned: refSlice,
        queryAligned: queryStr,
        refStart: 20,
        identity: 0.99,
        mismatches: [{ refPos: 30, queryPos: 10, refBase: "A", queryBase: "T" }],
      }),
      ALL_ANNS,
      SEQ,
      "linear",
    );

    expect(rv.variants).toHaveLength(1);
    expect(rv.variants[0]!.effect.kind).toBe("inFeature");
    if (rv.variants[0]!.effect.kind === "inFeature") {
      expect(rv.variants[0]!.effect.featureName).toBe("T7 promoter");
    }
  });
});

// ── Reverse-strand CDS tests ──────────────────────────────────────────────────

describe("verifyRead — reverse-strand CDS", () => {
  it("missense in reverse-strand CDS is classified correctly", () => {
    // AmpR CDS: start=500, end=860, direction=-1
    // Codon 0 (from 3' end of genomic region) occupies genomic positions 857,858,859
    // seq[857..860] = "CAG" (in our SEQ). RC("CAG") = "CTG" = Leu.
    // Change position 859 (seq[859]="G" → "A"):
    //   genomicSlice = seq[857..860] = "CAG"
    //   altGenomicSlice = "CAA"
    //   RC("CAA") = "TTG" = Leu → same AA, so SILENT.
    //
    // Let's instead change position 858 (A→T):
    //   altGenomicSlice = "CTG"
    //   RC("CTG") = "CAG" = Gln → different from Leu (CTG), so MISSENSE.

    // Ref slice covering genomic positions 850-860 (part of AmpR)
    const refSlice = SEQ.slice(850, 860);
    const querySlice = refSlice.split("");
    querySlice[858 - 850] = "T"; // position 858: A→T
    const queryStr = querySlice.join("");

    const rv = verifyRead(
      "test_rev",
      makeAlignment({
        refAligned: refSlice,
        queryAligned: queryStr,
        refStart: 850,
        strand: "-",
        identity: 0.99,
        mismatches: [{ refPos: 858, queryPos: 8, refBase: "A", queryBase: "T" }],
      }),
      [AMPR_ANN],
      SEQ,
      "linear",
    );

    expect(rv.variants).toHaveLength(1);
    const v = rv.variants[0]!;
    expect(v.effect.kind).toBe("inCDS");
    if (v.effect.kind === "inCDS") {
      expect(v.effect.featureName).toBe("AmpR");
      // Should be missense or silent — either way it classified it
      expect(["missense", "silent", "nonsense"]).toContain(v.effect.effect);
    }
  });
});

// ── verifyClone verdict tests ─────────────────────────────────────────────────

describe("verifyClone — verdicts", () => {
  it("CONFIRMED: perfect alignment covering all CDS", () => {
    const reads: ReadInput[] = [fullCDSRead()];
    const result = verifyClone(SEQ, "linear", "TestPlasmid", [CDS_ANN], reads);
    expect(result.verdict).toBe("CONFIRMED");
  });

  it("CONFIRMED: silent mutation only — not a problem", () => {
    const customSeq = SEQ.split("");
    customSeq[75] = "A";
    customSeq[76] = "A";
    customSeq[77] = "A";
    const seq = customSeq.join("");

    const refSlice = seq.slice(CDS_START, CDS_END);
    const querySlice = refSlice.split("");
    querySlice[77 - CDS_START] = "G"; // A→G at position 77: AAA→AAG = Lys→Lys = SILENT
    const queryStr = querySlice.join("");

    const reads: ReadInput[] = [
      {
        name: "fwd",
        result: makeAlignment({
          refAligned: refSlice,
          queryAligned: queryStr,
          refStart: CDS_START,
          identity: 0.99,
          mismatches: [{ refPos: 77, queryPos: 17, refBase: "A", queryBase: "G", qualityScore: 35 }],
        }),
      },
    ];

    const cdsAnn: AnnotationSummary = { ...CDS_ANN };
    const result = verifyClone(seq, "linear", "TestPlasmid", [cdsAnn], reads);
    expect(result.verdict).toBe("CONFIRMED");
  });

  it("CONFIRMED: no CDS annotations, identity above relaxed threshold", () => {
    const refSlice = SEQ.slice(0, 200);
    const reads: ReadInput[] = [
      {
        name: "fwd",
        result: makeAlignment({
          refAligned: refSlice,
          queryAligned: refSlice,
          refStart: 0,
          identity: CONFIRMED_NO_CDS_IDENTITY + 0.01,
        }),
      },
    ];
    const result = verifyClone(SEQ, "linear", "TestPlasmid", [PROMOTER_ANN], reads);
    expect(result.verdict).toBe("CONFIRMED");
  });

  it("FAILED: all reads fail to align (score=0)", () => {
    const reads: ReadInput[] = [
      {
        name: "bad_read",
        result: makeAlignment({
          refAligned: "ATGATG",
          queryAligned: "ATGATG",
          refStart: 0,
          score: 0,
        }),
      },
    ];
    const result = verifyClone(SEQ, "linear", "TestPlasmid", [CDS_ANN], reads);
    expect(result.verdict).toBe("FAILED");
  });

  it("FAILED: frameshift (1-bp deletion) in CDS", () => {
    const refAligned = "ATG-ATGATG";
    const queryAligned = "ATGAATGATG"
      .split("")
      .map((c, i) => (i === 3 ? "-" : c))
      .join("");

    const reads: ReadInput[] = [
      {
        name: "fwd",
        result: makeAlignment({
          refAligned: SEQ.slice(CDS_START, CDS_START + 10).split("").map((c, i) => (i === 3 ? c : c)).join(""),
          queryAligned: SEQ.slice(CDS_START, CDS_START + 10)
            .split("")
            .map((c, i) => (i === 3 ? "-" : c))
            .join(""),
          refStart: CDS_START,
          identity: 0.99,
        }),
      },
    ];
    // Manually build aligned strings with a deletion
    const ref10 = SEQ.slice(CDS_START, CDS_START + 10);
    reads[0]!.result = makeAlignment({
      refAligned: ref10,
      queryAligned: ref10.slice(0, 3) + "-" + ref10.slice(4),
      refStart: CDS_START,
      identity: 0.99,
    });

    const result = verifyClone(SEQ, "linear", "TestPlasmid", [CDS_ANN], reads);
    expect(result.verdict).toBe("FAILED");
  });

  it("FAILED: premature stop codon in CDS", () => {
    // Build a seq with a recognizable codon we can mutate to stop
    const customSeq = SEQ.split("");
    // Set codon 5 of CDS (positions 75-77) to TGG (Trp), then mutate to TGA (Stop)
    customSeq[75] = "T";
    customSeq[76] = "G";
    customSeq[77] = "G";
    const seq = customSeq.join("");

    const refSlice = seq.slice(CDS_START, CDS_END);
    const querySlice = refSlice.split("");
    querySlice[77 - CDS_START] = "A"; // TGG→TGA = Trp→Stop (NONSENSE)
    const queryStr = querySlice.join("");

    const reads: ReadInput[] = [
      {
        name: "fwd",
        result: makeAlignment({
          refAligned: refSlice,
          queryAligned: queryStr,
          refStart: CDS_START,
          identity: 0.99,
          mismatches: [{ refPos: 77, queryPos: 17, refBase: "G", queryBase: "A", qualityScore: 40 }],
        }),
      },
    ];

    const cdsAnn: AnnotationSummary = { ...CDS_ANN };
    const result = verifyClone(seq, "linear", "TestPlasmid", [cdsAnn], reads);
    expect(result.verdict).toBe("FAILED");
  });

  it("MUTATION_DETECTED: missense in CDS", () => {
    const refSlice = SEQ.slice(CDS_START, CDS_END);
    const querySlice = refSlice.split("");
    querySlice[1] = "C"; // ATG→ACG = Met→Thr at codon 0
    const queryStr = querySlice.join("");

    const reads: ReadInput[] = [
      {
        name: "fwd",
        result: makeAlignment({
          refAligned: refSlice,
          queryAligned: queryStr,
          refStart: CDS_START,
          identity: 0.99,
          mismatches: [{ refPos: 61, queryPos: 1, refBase: "T", queryBase: "C", qualityScore: 35 }],
        }),
      },
    ];

    const result = verifyClone(SEQ, "linear", "TestPlasmid", [CDS_ANN], reads);
    expect(result.verdict).toBe("MUTATION_DETECTED");
    expect(result.criticalVariants).toHaveLength(1);
  });

  it("MUTATION_DETECTED: missense not triggered by low-Q variant", () => {
    // Same as above but quality score below threshold → should be CONFIRMED
    const refSlice = SEQ.slice(CDS_START, CDS_END);
    const querySlice = refSlice.split("");
    querySlice[1] = "C";
    const queryStr = querySlice.join("");

    const reads: ReadInput[] = [
      {
        name: "fwd",
        result: makeAlignment({
          refAligned: refSlice,
          queryAligned: queryStr,
          refStart: CDS_START,
          identity: 0.99,
          mismatches: [
            { refPos: 61, queryPos: 1, refBase: "T", queryBase: "C", qualityScore: LOW_QUALITY_THRESHOLD - 1 },
          ],
        }),
      },
    ];

    const result = verifyClone(SEQ, "linear", "TestPlasmid", [CDS_ANN], reads);
    // Low-Q missense should be suppressed → verdict is CONFIRMED (not MUTATION_DETECTED)
    expect(result.verdict).toBe("CONFIRMED");
  });

  it("INCOMPLETE: CDS not covered by any read", () => {
    // Read only covers the promoter region, not the CDS
    const refSlice = SEQ.slice(0, 60);
    const reads: ReadInput[] = [
      {
        name: "fwd",
        result: makeAlignment({
          refAligned: refSlice,
          queryAligned: refSlice,
          refStart: 0,
          identity: CONFIRMED_MIN_IDENTITY + 0.005,
        }),
      },
    ];

    const result = verifyClone(SEQ, "linear", "TestPlasmid", [CDS_ANN], reads);
    expect(result.verdict).toBe("INCOMPLETE");
    expect(result.hasUnsequencedCDS).toBe(true);
  });

  it("INCOMPLETE: read identity below threshold with no CDS", () => {
    const refSlice = SEQ.slice(0, 200);
    const reads: ReadInput[] = [
      {
        name: "fwd",
        result: makeAlignment({
          refAligned: refSlice,
          queryAligned: refSlice,
          refStart: 0,
          identity: CONFIRMED_NO_CDS_IDENTITY - 0.01, // just below relaxed threshold
        }),
      },
    ];

    const result = verifyClone(SEQ, "linear", "TestPlasmid", [PROMOTER_ANN], reads);
    expect(result.verdict).toBe("INCOMPLETE");
  });
});

// ── Feature coverage tests ────────────────────────────────────────────────────

describe("feature coverage", () => {
  it("read fully covering a feature → fullySequenced=true", () => {
    const reads: ReadInput[] = [fullCDSRead()];
    const result = verifyClone(SEQ, "linear", "TestPlasmid", [CDS_ANN], reads);
    const cov = result.featureCoverage.find((f) => f.name === "TestCDS")!;
    expect(cov.fullySequenced).toBe(true);
    expect(cov.coveredFraction).toBeCloseTo(1.0);
  });

  it("read not overlapping a feature → coveredFraction=0", () => {
    // Read covers 0-60, CDS is at 60-360 — no overlap
    const reads: ReadInput[] = [
      {
        name: "fwd",
        result: makeAlignment({
          refAligned: SEQ.slice(0, 60),
          queryAligned: SEQ.slice(0, 60),
          refStart: 0,
        }),
      },
    ];
    const result = verifyClone(SEQ, "linear", "TestPlasmid", [CDS_ANN], reads);
    const cov = result.featureCoverage.find((f) => f.name === "TestCDS")!;
    expect(cov.coveredFraction).toBe(0);
    expect(cov.fullySequenced).toBe(false);
  });

  it("two reads together cover a feature their union = fullySequenced", () => {
    const halfLen = (CDS_END - CDS_START) / 2;
    const reads: ReadInput[] = [
      {
        name: "fwd1",
        result: makeAlignment({
          refAligned: SEQ.slice(CDS_START, CDS_START + halfLen),
          queryAligned: SEQ.slice(CDS_START, CDS_START + halfLen),
          refStart: CDS_START,
        }),
      },
      {
        name: "fwd2",
        result: makeAlignment({
          refAligned: SEQ.slice(CDS_START + halfLen, CDS_END),
          queryAligned: SEQ.slice(CDS_START + halfLen, CDS_END),
          refStart: CDS_START + halfLen,
        }),
      },
    ];
    const result = verifyClone(SEQ, "linear", "TestPlasmid", [CDS_ANN], reads);
    const cov = result.featureCoverage.find((f) => f.name === "TestCDS")!;
    expect(cov.fullySequenced).toBe(true);
    expect(cov.coveredFraction).toBeCloseTo(1.0);
  });
});

// ── buildVerificationPromptContext ───────────────────────────────────────────

describe("buildVerificationPromptContext", () => {
  it("includes verdict and plasmid info", () => {
    const reads: ReadInput[] = [fullCDSRead()];
    const result = verifyClone(SEQ, "linear", "TestPlasmid", [CDS_ANN], reads);
    const ctx = buildVerificationPromptContext(result, "TestPlasmid", SEQ_LEN, "linear", [CDS_ANN]);

    expect(ctx).toContain("TestPlasmid");
    expect(ctx).toContain("CONFIRMED");
    expect(ctx).toContain("TestCDS");
    expect(ctx).toContain("fully sequenced");
  });

  it("flags unaligned reads", () => {
    const reads: ReadInput[] = [
      {
        name: "bad_read",
        result: makeAlignment({ refAligned: "ATG", queryAligned: "ATG", refStart: 0, score: 0 }),
      },
    ];
    const result = verifyClone(SEQ, "linear", "TestPlasmid", [CDS_ANN], reads);
    const ctx = buildVerificationPromptContext(result, "TestPlasmid", SEQ_LEN, "linear", [CDS_ANN]);
    expect(ctx).toContain("FAILED TO ALIGN");
  });

  it("includes missense detail when present", () => {
    const refSlice = SEQ.slice(CDS_START, CDS_END);
    const querySlice = refSlice.split("");
    querySlice[1] = "C"; // missense
    const queryStr = querySlice.join("");

    const reads: ReadInput[] = [
      {
        name: "fwd",
        result: makeAlignment({
          refAligned: refSlice,
          queryAligned: queryStr,
          refStart: CDS_START,
          identity: 0.99,
          mismatches: [{ refPos: 61, queryPos: 1, refBase: "T", queryBase: "C", qualityScore: 35 }],
        }),
      },
    ];
    const result = verifyClone(SEQ, "linear", "TestPlasmid", [CDS_ANN], reads);
    const ctx = buildVerificationPromptContext(result, "TestPlasmid", SEQ_LEN, "linear", [CDS_ANN]);
    expect(ctx).toContain("MISSENSE");
  });
});
