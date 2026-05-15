import { describe, expect, it } from "vitest";
import {
  computeCAI,
  computeGC,
  optimizeCodon,
  parseProteinSeq,
  validateProtein,
} from "./codon-optimize";

describe("parseProteinSeq", () => {
  it("strips FASTA header and whitespace", () => {
    const raw = ">my protein\nMSIQ HFRV\nALMN";
    expect(parseProteinSeq(raw)).toBe("MSIQHFRVALMN");
  });

  it("handles plain amino acid string", () => {
    expect(parseProteinSeq("MSIQ")).toBe("MSIQ");
  });

  it("strips numbers (common in formatted sequences)", () => {
    expect(parseProteinSeq("1 MSIQ 10\n11 HFRV 20")).toBe("MSIQHFRV");
  });
});

describe("validateProtein", () => {
  it("accepts valid amino acids", () => {
    const { valid, unknown } = validateProtein("MSIQHFRVAL");
    expect(valid).toBe(true);
    expect(unknown).toHaveLength(0);
  });

  it("flags unknown characters", () => {
    const { valid, unknown } = validateProtein("MSIQXBZ");
    expect(valid).toBe(false);
    expect(unknown).toContain("X");
  });
});

describe("optimizeCodon — E. coli", () => {
  it("produces a sequence starting with ATG", () => {
    const { seq } = optimizeCodon("MSIQ", "ecoli");
    expect(seq.startsWith("ATG")).toBe(true);
  });

  it("produces a sequence ending with a stop codon", () => {
    const { seq } = optimizeCodon("MSIQ", "ecoli");
    expect(["TAA", "TAG", "TGA"]).toContain(seq.slice(-3));
  });

  it("length: (amino acids × 3) + 3 for stop", () => {
    const protein = "MSIQHFR";
    const { seq, length } = optimizeCodon(protein, "ecoli");
    expect(length).toBe(protein.length);
    expect(seq.length).toBe(protein.length * 3 + 3);
  });

  it("CAI is high for E. coli-optimized sequence", () => {
    // A CAI-maximized sequence should score very high
    const { cai } = optimizeCodon("MSIQHFRVAL", "ecoli");
    expect(cai).toBeGreaterThan(0.85);
  });

  it("preferred E. coli Leu codon is CTG", () => {
    const { seq } = optimizeCodon("L", "ecoli");
    // seq = CTG + stop
    expect(seq.startsWith("CTG")).toBe(true);
  });

  it("preferred E. coli Pro codon is CCG", () => {
    const { seq } = optimizeCodon("MP", "ecoli");
    // ATG + CCG + stop
    expect(seq.slice(3, 6)).toBe("CCG");
  });

  it("preferred E. coli Arg is CGT or CGC", () => {
    const { seq } = optimizeCodon("MR", "ecoli");
    expect(["CGT", "CGC"]).toContain(seq.slice(3, 6));
  });
});

describe("optimizeCodon — human", () => {
  it("preferred human Leu codon is CTG", () => {
    const { seq } = optimizeCodon("L", "human");
    expect(seq.startsWith("CTG")).toBe(true);
  });

  it("preferred human Lys is AAG (not AAA as in E. coli)", () => {
    const { seq } = optimizeCodon("MK", "human");
    expect(seq.slice(3, 6)).toBe("AAG");
  });

  it("E. coli preferred Lys (AAA) differs from human (AAG)", () => {
    const ecoli = optimizeCodon("MK", "ecoli");
    const human = optimizeCodon("MK", "human");
    expect(ecoli.seq.slice(3, 6)).toBe("AAA");
    expect(human.seq.slice(3, 6)).toBe("AAG");
  });

  it("GC content differs by organism for same protein", () => {
    const protein = "MSIQHFRVALMN";
    const ecoli = optimizeCodon(protein, "ecoli");
    const human = optimizeCodon(protein, "human");
    // Human sequences generally have higher GC than E. coli CAI-maximized
    expect(ecoli.gcContent).not.toEqual(human.gcContent);
  });
});

describe("optimizeCodon — yeast", () => {
  it("preferred yeast Arg is AGA (not CGT as in E. coli)", () => {
    const { seq } = optimizeCodon("MR", "yeast");
    expect(seq.slice(3, 6)).toBe("AGA");
  });
});

describe("computeCAI", () => {
  it("returns value between 0 and 1", () => {
    const cai = computeCAI("ATGAAAGAATAA", "ecoli");
    expect(cai).toBeGreaterThanOrEqual(0);
    expect(cai).toBeLessThanOrEqual(1);
  });

  it("returns 0 for empty input", () => {
    expect(computeCAI("", "ecoli")).toBe(0);
  });
});

describe("computeGC", () => {
  it("all-GC sequence → 1.0", () => {
    expect(computeGC("GCGCGC")).toBe(1.0);
  });

  it("all-AT sequence → 0.0", () => {
    expect(computeGC("ATATAT")).toBe(0.0);
  });

  it("ATGC → 0.5", () => {
    expect(computeGC("ATGC")).toBe(0.5);
  });
});

describe("real protein — mCherry N-terminus check", () => {
  // mCherry starts with MVSKGEEDNMAI...
  // In E. coli, Val is best encoded by GTG, Ser by AGC, Lys by AAA
  it("optimizes mCherry-like sequence without error", () => {
    const protein = "MVSKGEEDNMAIIKEFMR";
    const { seq, cai, gcContent, length } = optimizeCodon(protein, "ecoli");
    expect(seq.startsWith("ATG")).toBe(true);
    expect(length).toBe(protein.length);
    expect(cai).toBeGreaterThan(0.7);
    expect(gcContent).toBeGreaterThan(0.3);
    expect(gcContent).toBeLessThan(0.8);
  });
});
