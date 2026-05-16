// Sanger primer walking design worker.
//
// Designs a set of forward primers spaced along a template so that their
// expected Sanger reads (readLen bp each) give complete coverage with at
// least `overlap` bp between adjacent reads.
//
// At each target position the worker tries every 18–27 bp candidate in a
// ±30 bp search window, scores them with the same penalty model used by
// primd's designPCR, and picks the best one. The accessibility profile is
// computed once upfront to avoid redundant O(n³) hairpin scans.

import {
	calcGC,
	calcHairpinDG,
	calcSelfDimerDG,
	calcTm,
	calcAccessibilityProfile,
	reverseComplement,
} from "@shandley/primd";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WalkingPrimer {
	seq: string;
	position: number;      // 0-indexed start on the template
	direction: "fwd" | "rev";
	tm: number;
	gc: number;
	hairpinDG: number;
	selfDimerDG: number;
	templateAccessibility: number;
	penalty: number;
	readEnd: number;       // expected last covered base (exclusive)
}

export interface WalkingResult {
	primers: WalkingPrimer[];
	seqLen: number;
	readLen: number;
	overlap: number;
	// coverage[i] = number of reads covering base i (sparse: only gaps stored)
	gaps: [number, number][];   // [start, end] inclusive base-coordinate gaps
	totalCovered: number;       // number of bases with ≥1 read
}

export interface WalkingRequest {
	seq: string;
	readLen: number;
	overlap: number;
	direction: "fwd" | "both";
	primerLenRange: [number, number];
	tmTarget: number;
	gcRange: [number, number];
	searchWindow: number;       // bp on each side of target position to search (default 35)
}

export type WalkingResponse =
	| { type: "success"; result: WalkingResult }
	| { type: "error"; message: string };

// ── Scoring ───────────────────────────────────────────────────────────────────

const TM_PENALTY = 1.5;      // per °C deviation from target
const GC_PENALTY = 6.0;      // flat penalty for out-of-range GC
const HAIRPIN_THRESHOLD = -2.0;   // kcal/mol
const HAIRPIN_PENALTY = 4.0;
const DIMER_THRESHOLD = -5.0;
const DIMER_PENALTY = 3.0;
const ACCESS_LOW = 0.4;
const ACCESS_MID = 0.75;
const ACCESS_PENALTY_LOW = 8.0;
const ACCESS_PENALTY_MID = 2.5;

function scorePrimer(
	seq: string,
	tmTarget: number,
	gcRange: [number, number],
	accessibility: number,
): number {
	const { tm } = calcTm(seq);
	const gc = calcGC(seq);
	const hairpinDG = calcHairpinDG(seq);
	const selfDimerDG = calcSelfDimerDG(seq);

	let penalty = Math.abs(tm - tmTarget) * TM_PENALTY;
	if (gc < gcRange[0] || gc > gcRange[1]) penalty += GC_PENALTY;
	if (hairpinDG < HAIRPIN_THRESHOLD) penalty += HAIRPIN_PENALTY;
	if (selfDimerDG < DIMER_THRESHOLD) penalty += DIMER_PENALTY;
	if (accessibility < ACCESS_LOW) penalty += ACCESS_PENALTY_LOW;
	else if (accessibility < ACCESS_MID) penalty += ACCESS_PENALTY_MID;

	// Penalise missing GC clamp at 3' end
	const last2 = seq.slice(-2).toUpperCase();
	if (!last2.includes("G") && !last2.includes("C")) penalty += 1.5;

	return penalty;
}

// ── Core design ───────────────────────────────────────────────────────────────

function designStrand(
	template: string,
	direction: "fwd" | "rev",
	opts: WalkingRequest,
): WalkingPrimer[] {
	const [minLen, maxLen] = opts.primerLenRange;
	const stepSize = opts.readLen - opts.overlap;
	const nPositions = Math.ceil((template.length - opts.overlap) / stepSize);
	const win = opts.searchWindow;

	// Precompute accessibility once (most expensive per-candidate operation)
	const accessProfile = calcAccessibilityProfile(template, minLen, {
		annealTempC: opts.tmTarget - 5,
	});

	const primers: WalkingPrimer[] = [];

	for (let i = 0; i < nPositions; i++) {
		const targetPos = i * stepSize;
		const windowStart = Math.max(0, targetPos - win);
		const windowEnd = Math.min(template.length - minLen, targetPos + win);

		let best: WalkingPrimer | null = null;
		let bestPenalty = Infinity;

		for (let start = windowStart; start <= windowEnd; start++) {
			for (let len = minLen; len <= maxLen; len++) {
				if (start + len > template.length) break;
				const candidateSeq = template.slice(start, start + len);

				// Fast pre-filter: rough Tm check before full scoring
				const gcFrac = (candidateSeq.match(/[GC]/gi)?.length ?? 0) / len;
				const roughTm = 64.9 + 41 * (gcFrac - 16.4 / len); // Wallace rule approx
				if (Math.abs(roughTm - opts.tmTarget) > 15) continue;

				const accessibility = accessProfile[start] ?? 0.5;
				// Small pull toward the target position keeps coverage evenly spaced
				const distancePenalty = Math.abs(start - targetPos) * 0.04;
				const penalty = scorePrimer(candidateSeq, opts.tmTarget, opts.gcRange, accessibility) + distancePenalty;

				if (penalty < bestPenalty) {
					bestPenalty = penalty;
					const { tm } = calcTm(candidateSeq);
					best = {
						seq: candidateSeq,
						position: start,
						direction,
						tm,
						gc: calcGC(candidateSeq),
						hairpinDG: calcHairpinDG(candidateSeq),
						selfDimerDG: calcSelfDimerDG(candidateSeq),
						templateAccessibility: accessibility,
						penalty,
						readEnd: Math.min(template.length, start + opts.readLen),
					};
				}
			}
		}

		if (best) primers.push(best);
	}

	return primers;
}

function computeGaps(
	primers: WalkingPrimer[],
	seqLen: number,
): { gaps: [number, number][]; totalCovered: number } {
	// Mark coverage per base (Uint8 is sufficient — we just need ≥1)
	const covered = new Uint8Array(seqLen);
	for (const p of primers) {
		const start = p.position;
		const end = p.readEnd; // exclusive
		for (let j = start; j < end; j++) covered[j] = 1;
	}

	const gaps: [number, number][] = [];
	let gapStart = -1;
	let totalCovered = 0;

	for (let j = 0; j < seqLen; j++) {
		if (covered[j]) {
			totalCovered++;
			if (gapStart !== -1) {
				gaps.push([gapStart, j - 1]);
				gapStart = -1;
			}
		} else if (gapStart === -1) {
			gapStart = j;
		}
	}
	if (gapStart !== -1) gaps.push([gapStart, seqLen - 1]);

	return { gaps, totalCovered };
}

// ── Worker entry ──────────────────────────────────────────────────────────────

self.addEventListener("message", (e: MessageEvent<WalkingRequest>) => {
	try {
		const opts = e.data;
		const fwdTemplate = opts.seq.toUpperCase();

		let primers: WalkingPrimer[] = designStrand(fwdTemplate, "fwd", opts);

		if (opts.direction === "both") {
			// Reverse primers: design on RC template, then map positions back
			const rcTemplate = reverseComplement(fwdTemplate);
			const rcOpts = { ...opts, seq: rcTemplate };
			const revPrimers = designStrand(rcTemplate, "rev", rcOpts);

			// Translate RC positions back to original coordinates
			const seqLen = fwdTemplate.length;
			for (const p of revPrimers) {
				const origStart = seqLen - p.position - p.seq.length;
				p.position = origStart;
				// read goes backward: readEnd in original coords = origStart + readLen
				// but coverage is from (origStart - readLen) to origStart
				// We reuse readEnd to mean "coverage extends to max(0, origStart - readLen)"
				// For display: store as readEnd < position to signal reverse direction
				p.readEnd = Math.max(0, origStart - opts.readLen);
			}
			primers = [...primers, ...revPrimers];
		}

		const { gaps, totalCovered } = computeGaps(primers, fwdTemplate.length);

		const result: WalkingResult = {
			primers,
			seqLen: fwdTemplate.length,
			readLen: opts.readLen,
			overlap: opts.overlap,
			gaps,
			totalCovered,
		};

		const response: WalkingResponse = { type: "success", result };
		self.postMessage(response);
	} catch (err) {
		const response: WalkingResponse = {
			type: "error",
			message: (err as Error).message ?? "Walking design failed",
		};
		self.postMessage(response);
	}
});
