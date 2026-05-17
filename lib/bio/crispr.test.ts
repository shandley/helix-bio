import { describe, expect, it } from "vitest";
import {
	type CRISPRDesignOptions,
	designGuides,
	detectFlags,
	reverseComplement,
	scoreSpCas9,
} from "./crispr";

// ── reverseComplement ─────────────────────────────────────────────────────────

describe("reverseComplement", () => {
	it("complements and reverses a simple sequence", () => {
		expect(reverseComplement("ATCG")).toBe("CGAT");
	});

	it("handles all four bases", () => {
		expect(reverseComplement("AACC")).toBe("GGTT");
		expect(reverseComplement("GCGC")).toBe("GCGC");
	});

	it("treats N as N", () => {
		expect(reverseComplement("NATG")).toBe("CATN");
	});

	it("handles mixed case by uppercasing", () => {
		expect(reverseComplement("atcg")).toBe("CGAT");
	});
});

// ── detectFlags ───────────────────────────────────────────────────────────────

describe("detectFlags", () => {
	it("detects polyT (≥4 consecutive T)", () => {
		expect(detectFlags("GCATTTTAGCATCGATCGAT")).toContain("polyT");
		expect(detectFlags("GCATTTAGCATCGATCGATT")).not.toContain("polyT"); // only 3 T
	});

	it("detects homopolymer run of 5+", () => {
		expect(detectFlags("GCAAAAAGCATCGATCGATT")).toContain("homopolymer");
		expect(detectFlags("GCAAAAGCATCGATCGATTA")).not.toContain("homopolymer"); // only 4
	});

	it("detects low GC (<25%)", () => {
		expect(detectFlags("ATATATATAT" + "ATATATATAT")).toContain("lowGC");
	});

	it("detects high GC (>75%)", () => {
		expect(detectFlags("GCGCGCGCGC" + "GCGCGCGCGC")).toContain("highGC");
	});

	it("returns no flags for a clean 20nt guide", () => {
		expect(detectFlags("GCATCGATCGATCGATCGAT")).toHaveLength(0);
	});
});

// ── scoreSpCas9 ───────────────────────────────────────────────────────────────

describe("scoreSpCas9", () => {
	// Reference test cases from CRISPOR doenchScore.py
	it("scores high-efficiency guide near 71/100", () => {
		const score = scoreSpCas9("TATAGCTGCGATCTGAGGTAGGGAGGGACC");
		// Python returns 0.713089; scaled → 71
		expect(score).toBe(71);
	});

	it("scores low-efficiency guide near 2/100", () => {
		const score = scoreSpCas9("TCCGCACCTGTCACGGTCGGGGCTTGGCGC");
		// Python returns 0.01898; scaled → 2
		expect(score).toBe(2);
	});

	it("always returns a value in [0, 100]", () => {
		const score = scoreSpCas9("NNNNNNNNNNNNNNNNNNNNNNNNNNNNNN");
		expect(score).toBeGreaterThanOrEqual(0);
		expect(score).toBeLessThanOrEqual(100);
	});

	it("returns 0 for inputs shorter than 30 chars", () => {
		expect(scoreSpCas9("AAAAAAAAAA")).toBe(0);
	});
});

// ── designGuides — SpCas9 ─────────────────────────────────────────────────────

const SP_OPTS: CRISPRDesignOptions = {
	casVariant: "SpCas9",
	strand: "+",
	minScore: 0,
	maxGuides: 200,
};

describe("designGuides — SpCas9 + strand", () => {
	// Sequence with a single NGG PAM: 20nt guide + NGG
	const SEQ = "GCATCGATCGATCGATCGATCGG"; // guide=GCATCGATCGATCGATCGAT, PAM=CGG

	it("finds the guide at the correct position", () => {
		const guides = designGuides(SEQ, SP_OPTS);
		expect(guides.length).toBeGreaterThanOrEqual(1);
		const g = guides.find((g) => g.position === 0 && g.strand === "+");
		expect(g).toBeDefined();
		expect(g!.sequence).toBe("GCATCGATCGATCGATCGAT");
		expect(g!.pam).toBe("CGG");
	});

	it("guides are exactly 20nt long", () => {
		const guides = designGuides(SEQ, SP_OPTS);
		for (const g of guides) expect(g.sequence).toHaveLength(20);
	});

	it("returns empty when no NGG PAM is present", () => {
		// Sequence with no GG dinucleotide
		const noNGG = "ACATCGATCGATCGATCGATACC";
		const guides = designGuides(noNGG, SP_OPTS);
		expect(guides).toHaveLength(0);
	});

	it("excludes guides containing N in the protospacer", () => {
		// N in the guide region
		const withN = "GCATCNATNGATCGATCGATCGG";
		const guides = designGuides(withN, SP_OPTS);
		// Either no guides, or none with N
		for (const g of guides) expect(g.sequence).not.toMatch(/N/i);
	});

	it("results are sorted highest score first", () => {
		// Use a longer sequence to get multiple guides
		const longSeq = "GCATCGATCGATCGATCGATCGG" + "AAAAAAAAA" + "TATCGATCGATCGATCGATCGGG";
		const guides = designGuides(longSeq, { ...SP_OPTS, strand: "both" });
		for (let i = 1; i < guides.length; i++) {
			expect(guides[i - 1]!.onTargetScore).toBeGreaterThanOrEqual(guides[i]!.onTargetScore);
		}
	});

	it("minScore filter excludes low-scoring guides", () => {
		const guides = designGuides(SEQ, { ...SP_OPTS, minScore: 90 });
		for (const g of guides) expect(g.onTargetScore).toBeGreaterThanOrEqual(90);
	});

	it("strand: '+' only returns plus-strand guides", () => {
		const guides = designGuides(SEQ, { ...SP_OPTS, strand: "+" });
		for (const g of guides) expect(g.strand).toBe("+");
	});
});

describe("designGuides — SpCas9 - strand", () => {
	// CCG at positions 0-2 on + strand = NGG PAM for a - strand guide
	// RC = "AATCGATCGATCGATCGATGCGG" — has NGG at end → guide at orig pos 3
	const SEQ = "CCGCATCGATCGATCGATCGATT";

	it("finds minus-strand guides", () => {
		const guides = designGuides(SEQ, { ...SP_OPTS, strand: "-" });
		expect(guides.length).toBeGreaterThanOrEqual(1);
		for (const g of guides) expect(g.strand).toBe("-");
	});

	it("minus-strand guide positions are within sequence bounds", () => {
		const guides = designGuides(SEQ, { ...SP_OPTS, strand: "-" });
		for (const g of guides) {
			expect(g.position).toBeGreaterThanOrEqual(0);
			expect(g.position + 20).toBeLessThanOrEqual(SEQ.length);
		}
	});
});

// ── designGuides — SaCas9 ─────────────────────────────────────────────────────

describe("designGuides — SaCas9", () => {
	// 21nt guide + NNGRRT PAM (e.g., AAGAGT where pos2=G, pos3=A(R), pos4=G(R), pos5=T)
	const SEQ = "GCATCGATCGATCGATCGATCAAGAGT"; // guide(21)=GCATCGATCGATCGATCGATC, PAM=AAGAGT

	it("finds the SaCas9 guide", () => {
		const guides = designGuides(SEQ, {
			casVariant: "SaCas9",
			strand: "+",
			minScore: 0,
			maxGuides: 200,
		});
		expect(guides.length).toBeGreaterThanOrEqual(1);
		const g = guides.find((g) => g.position === 0);
		expect(g).toBeDefined();
		expect(g!.sequence).toHaveLength(21);
		expect(g!.pam).toHaveLength(6);
	});

	it("scoreMethod is heuristic", () => {
		const guides = designGuides(SEQ, {
			casVariant: "SaCas9",
			strand: "+",
			minScore: 0,
			maxGuides: 200,
		});
		for (const g of guides) expect(g.scoreMethod).toBe("heuristic");
	});
});

// ── designGuides — Cas12a ─────────────────────────────────────────────────────

describe("designGuides — Cas12a", () => {
	// TTTG + exactly 23nt
	const SEQ2 = "TTTG" + "CATCGATCGATCGATCGATCGAT"; // 4+23=27

	it("finds the Cas12a guide", () => {
		const guides = designGuides(SEQ2, {
			casVariant: "Cas12a",
			strand: "+",
			minScore: 0,
			maxGuides: 200,
		});
		expect(guides.length).toBeGreaterThanOrEqual(1);
		const g = guides[0]!;
		expect(g.sequence).toHaveLength(23);
		expect(g.pam).toBe("TTTG");
		// Guide starts after the PAM (position 4 in the sequence)
		expect(g.position).toBe(4);
	});

	it("rejects TTTT as PAM (V must not be T)", () => {
		const badPam = "TTTT" + "CATCGATCGATCGATCGATCGAT";
		const guides = designGuides(badPam, {
			casVariant: "Cas12a",
			strand: "+",
			minScore: 0,
			maxGuides: 200,
		});
		expect(guides).toHaveLength(0);
	});

	it("scoreMethod is heuristic", () => {
		const guides = designGuides(SEQ2, {
			casVariant: "Cas12a",
			strand: "+",
			minScore: 0,
			maxGuides: 200,
		});
		for (const g of guides) expect(g.scoreMethod).toBe("heuristic");
	});
});
