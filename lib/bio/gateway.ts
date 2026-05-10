/**
 * Gateway cloning simulation.
 *
 * Recombination rules:
 *   BP reaction:  attB × attP  →  attL  +  attR  (creates entry clone)
 *   LR reaction:  attL × attR  →  attB  +  attP  (creates expression clone)
 *
 * att site detection uses the 25 bp core sequences shared by all four att
 * variants at each site position. The 7 bp overlap (O sequence) is the
 * only sequence preserved in the product; flanking sequences differ by
 * variant and determine which recombination event occurs.
 */

// Core recognition sequences used for site detection.
// attB1/attL1/attP1/attR1 all contain the type-1 core.
// attB2/attL2/attP2/attR2 all contain the type-2 core.
const CORE_1 = "CAAGTTTGTACAAAAAAGCAGGCT"; // 24 bp, inside all att*1 sites
const CORE_2 = "CACTTTGTACAAGAAAGCTGGGT"; // 23 bp, inside all att*2 sites

// The 7 bp overlap sequence preserved in recombination products
const _OVERLAP_1 = "GTTTGTACAAAAAAGCAGGCT".slice(-7); // "CAGGCTT" — actually let me use exact
// Per Invitrogen documentation:
// attB1 overlap (O): GTACAAAAAAGCAGGCT  — central 7 bp: ACAAAAA
const _OVERLAP_SEQ_1 = "ACAAAAA";
const _OVERLAP_SEQ_2 = "ACAAAGT";

// attB sequences as they appear in Invitrogen primers (25 bp each)
export const ATT_SEQUENCES = {
	attB1: "ACAAGTTTGTACAAAAAAGCAGGCT",
	attB2: "ACCACTTTGTACAAGAAAGCTGGGT",
	attL1: "ACAAGTTTGTACAAAAAAGCAGGCT", // same overlap core as attB1
	attL2: "ACCACTTTGTACAAGAAAGCTGGGT",
	attR1: "ACAAGTTTGTACAAAAAAGCAGGCTTC", // attR has extra flanking
	attR2: "ACCACTTTGTACAAGAAAGCTGGGTC",
	attP1: "ACAAGTTTGTACAAAAAAGCAGGCT",
	attP2: "ACCACTTTGTACAAGAAAGCTGGGT",
};

export type GatewayReaction = "LR" | "BP";

export interface AttSite {
	type: 1 | 2;
	variant: "attB" | "attL" | "attP" | "attR";
	pos: number;
	len: number;
}

export interface GatewayResult {
	resultSeq: string;
	productSize: number;
	goiSize: number;
	leftAttSite: string; // att site flanking GOI on left in product
	rightAttSite: string;
	reaction: GatewayReaction;
	warnings: string[];
	error?: string;
}

/** Search for an att site core in seq, return 0-indexed position or -1. */
function findCore(seq: string, core: string): number {
	return seq.indexOf(core);
}

/**
 * Simulate a Gateway LR reaction.
 * entryClone contains attL1…GOI…attL2.
 * destVector contains attR1…ccdB…attR2.
 * Product: attB1…GOI…attB2 flanked by rest of destination vector backbone.
 */
export function simulateGatewayLR(entryClone: string, destVector: string): GatewayResult {
	const warnings: string[] = [];
	const entry = entryClone.toUpperCase().replace(/[^ATGCN]/g, "");
	const dest = destVector.toUpperCase().replace(/[^ATGCN]/g, "");

	if (!entry) return { error: "Entry clone sequence is empty or invalid." } as GatewayResult;
	if (!dest) return { error: "Destination vector sequence is empty or invalid." } as GatewayResult;

	// Find attL1 and attL2 in entry clone
	const attL1Pos = findCore(entry, CORE_1);
	const attL2Pos = findCore(entry, CORE_2);

	if (attL1Pos === -1)
		return {
			error: `No attL1 site found in entry clone. Expected core sequence: ${CORE_1}`,
		} as GatewayResult;
	if (attL2Pos === -1)
		return {
			error: `No attL2 site found in entry clone. Expected core sequence: ${CORE_2}`,
		} as GatewayResult;
	if (attL1Pos >= attL2Pos)
		return { error: "attL1 must appear before attL2 in the entry clone." } as GatewayResult;

	// Find attR1 and attR2 in destination vector
	const attR1Pos = findCore(dest, CORE_1);
	const attR2Pos = findCore(dest, CORE_2);

	if (attR1Pos === -1)
		return {
			error: `No attR1 site found in destination vector. Expected core sequence: ${CORE_1}`,
		} as GatewayResult;
	if (attR2Pos === -1)
		return {
			error: `No attR2 site found in destination vector. Expected core sequence: ${CORE_2}`,
		} as GatewayResult;
	if (attR1Pos >= attR2Pos)
		return { error: "attR1 must appear before attR2 in the destination vector." } as GatewayResult;

	// GOI = sequence between attL1 end and attL2 start
	const goiStart = attL1Pos + CORE_1.length;
	const goiEnd = attL2Pos;
	const goi = entry.slice(goiStart, goiEnd);

	if (goi.length < 1)
		return {
			error: "No sequence found between attL1 and attL2 — GOI appears to be empty.",
		} as GatewayResult;

	// Backbone = destination vector outside the attR sites (ccdB replaced)
	const destLeft = dest.slice(0, attR1Pos); // everything before attR1
	const destRight = dest.slice(attR2Pos + CORE_2.length); // everything after attR2

	// Product: destLeft + attB1 + GOI + attB2 + destRight
	const resultSeq = destLeft + ATT_SEQUENCES.attB1 + goi + ATT_SEQUENCES.attB2 + destRight;

	if (goi.length < 100) warnings.push("GOI is very short — verify att site positions are correct.");

	return {
		resultSeq,
		productSize: resultSeq.length,
		goiSize: goi.length,
		leftAttSite: "attB1",
		rightAttSite: "attB2",
		reaction: "LR",
		warnings,
	};
}

/**
 * Simulate a Gateway BP reaction.
 * attBPCR is the PCR product carrying attB1…GOI…attB2.
 * donorVector contains attP1…ccdB…attP2.
 * Product (entry clone): attL1…GOI…attL2 in donor backbone.
 */
export function simulateGatewayBP(attBPCR: string, donorVector: string): GatewayResult {
	const warnings: string[] = [];
	const pcr = attBPCR.toUpperCase().replace(/[^ATGCN]/g, "");
	const donor = donorVector.toUpperCase().replace(/[^ATGCN]/g, "");

	if (!pcr) return { error: "PCR product sequence is empty or invalid." } as GatewayResult;
	if (!donor) return { error: "Donor vector sequence is empty or invalid." } as GatewayResult;

	// Find attB1 and attB2 in PCR product
	const attB1Pos = findCore(pcr, CORE_1);
	const attB2Pos = findCore(pcr, CORE_2);

	if (attB1Pos === -1)
		return {
			error: `No attB1 site found in PCR product. Expected core sequence: ${CORE_1}`,
		} as GatewayResult;
	if (attB2Pos === -1)
		return {
			error: `No attB2 site found in PCR product. Expected core sequence: ${CORE_2}`,
		} as GatewayResult;
	if (attB1Pos >= attB2Pos)
		return { error: "attB1 must appear before attB2 in the PCR product." } as GatewayResult;

	// Find attP1 and attP2 in donor vector
	const attP1Pos = findCore(donor, CORE_1);
	const attP2Pos = findCore(donor, CORE_2);

	if (attP1Pos === -1)
		return {
			error: `No attP1 site found in donor vector. Expected core sequence: ${CORE_1}`,
		} as GatewayResult;
	if (attP2Pos === -1)
		return {
			error: `No attP2 site found in donor vector. Expected core sequence: ${CORE_2}`,
		} as GatewayResult;
	if (attP1Pos >= attP2Pos)
		return { error: "attP1 must appear before attP2 in the donor vector." } as GatewayResult;

	// GOI = sequence between attB1 end and attB2 start
	const goiStart = attB1Pos + CORE_1.length;
	const goiEnd = attB2Pos;
	const goi = pcr.slice(goiStart, goiEnd);

	if (goi.length < 1)
		return { error: "No sequence found between attB1 and attB2." } as GatewayResult;

	// Backbone = donor vector outside the attP sites
	const donorLeft = donor.slice(0, attP1Pos);
	const donorRight = donor.slice(attP2Pos + CORE_2.length);

	// Entry clone: donorLeft + attL1 + GOI + attL2 + donorRight
	const resultSeq = donorLeft + ATT_SEQUENCES.attL1 + goi + ATT_SEQUENCES.attL2 + donorRight;

	if (goi.length < 100) warnings.push("GOI is very short — verify att site positions are correct.");

	return {
		resultSeq,
		productSize: resultSeq.length,
		goiSize: goi.length,
		leftAttSite: "attL1",
		rightAttSite: "attL2",
		reaction: "BP",
		warnings,
	};
}
