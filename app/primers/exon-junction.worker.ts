// Exon-junction qPCR primer design.
//
// Designs forward primers that SPAN an exon-exon junction in the mature
// mRNA sequence. The primer's 5' end sits in exon N and its 3' end sits
// in exon N+1. When it encounters genomic DNA, the intervening intron
// separates the two exon segments so the 3' end cannot bind — no gDNA
// amplification. The reverse primer is a normal primer placed downstream
// within the qPCR amplicon size window.
//
// Input: mature mRNA sequence (concatenated exons, no introns) + a list
// of junction positions (0-indexed start of each downstream exon in the
// mRNA sequence).

import {
	calcGC,
	calcHairpinDG,
	calcHeteroDimerDG,
	calcSelfDimerDG,
	calcTm,
	calcAccessibilityProfile,
	reverseComplement,
} from "@shandley/primd";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JunctionPrimer {
	seq: string;
	start: number;
	end: number; // exclusive
	len: number;
	tm: number;
	gc: number;
	hairpinDG: number;
	selfDimerDG: number;
	templateAccessibility: number;
	penalty: number;
	junctionPos: number;    // mRNA position where junction falls within this primer
	upstreamBases: number;  // bases anchored in upstream exon
	downstreamBases: number; // bases anchored in downstream exon (the 3' end)
}

interface RevPrimer {
	seq: string;
	start: number;
	end: number;
	len: number;
	tm: number;
	gc: number;
	hairpinDG: number;
	selfDimerDG: number;
	templateAccessibility: number;
	penalty: number;
}

export interface ExonJunctionPair {
	fwd: JunctionPrimer;
	rev: RevPrimer;
	productSize: number;
	tmDiff: number;
	heteroDimerDG: number;
	penalty: number;
}

export interface ExonJunctionRequest {
	seq: string;
	// 0-indexed positions in the mRNA where a new exon begins.
	// e.g., [150, 300] means exon 1 = [0,150), exon 2 = [150,300), exon 3 = [300,end)
	junctions: number[];
	primerLenRange: [number, number];
	tmTarget: number;
	gcRange: [number, number];
	maxTmDiff: number;
	productSizeRange: [number, number];
	numReturn: number;
	// min bp each side of the junction — 3' end must be ≥ minDownstream into the new exon
	minUpstreamBases: number;   // default 5
	minDownstreamBases: number; // default 8
}

export interface ExonJunctionResult {
	pairs: ExonJunctionPair[];
	warning?: string;
}

export type ExonJunctionResponse =
	| { type: "success"; result: ExonJunctionResult }
	| { type: "error"; message: string };

// ── Scoring ───────────────────────────────────────────────────────────────────

const TM_PENALTY = 1.5;
const GC_PENALTY = 6.0;
const HAIRPIN_THRESHOLD = -2.0;
const HAIRPIN_PENALTY = 4.0;
const DIMER_THRESHOLD = -5.0;
const DIMER_PENALTY = 3.0;

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
	if (accessibility < 0.4) penalty += 8.0;
	else if (accessibility < 0.75) penalty += 2.5;
	const last2 = seq.slice(-2);
	if (!last2.includes("G") && !last2.includes("C")) penalty += 1.5;
	return penalty;
}

// ── Forward primer design (spanning) ─────────────────────────────────────────

function designSpanningForwardPrimers(
	seq: string,
	junction: number,
	opts: ExonJunctionRequest,
	accessProfile: Float32Array,
): JunctionPrimer[] {
	const [minLen, maxLen] = opts.primerLenRange;
	const { minUpstreamBases: minUp, minDownstreamBases: minDown } = opts;
	const candidates: JunctionPrimer[] = [];

	for (let len = minLen; len <= maxLen; len++) {
		for (let up = minUp; up <= len - minDown; up++) {
			const down = len - up;
			const start = junction - up;
			const end = junction + down;

			if (start < 0 || end > seq.length) continue;

			const primerSeq = seq.slice(start, end);
			// Wallace pre-filter
			const gcFrac = (primerSeq.match(/[GC]/gi)?.length ?? 0) / len;
			const roughTm = 64.9 + 41 * (gcFrac - 16.4 / len);
			if (Math.abs(roughTm - opts.tmTarget) > 15) continue;

			const accessibility = accessProfile[start] ?? 0.5;
			const penalty = scorePrimer(primerSeq, opts.tmTarget, opts.gcRange, accessibility);
			const { tm } = calcTm(primerSeq);

			candidates.push({
				seq: primerSeq,
				start,
				end,
				len,
				tm,
				gc: calcGC(primerSeq),
				hairpinDG: calcHairpinDG(primerSeq),
				selfDimerDG: calcSelfDimerDG(primerSeq),
				templateAccessibility: accessibility,
				penalty,
				junctionPos: junction,
				upstreamBases: up,
				downstreamBases: down,
			});
		}
	}

	return candidates.sort((a, b) => a.penalty - b.penalty).slice(0, 8);
}

// ── Reverse primer design ─────────────────────────────────────────────────────

function findBestReversePrimers(
	seq: string,
	fwd: JunctionPrimer,
	opts: ExonJunctionRequest,
	accessProfile: Float32Array,
): RevPrimer[] {
	const [minLen, maxLen] = opts.primerLenRange;
	const [minAmp, maxAmp] = opts.productSizeRange;
	const candidates: RevPrimer[] = [];

	// Amplicon is fwd.start to revEnd (exclusive).
	// productSize = revEnd - fwd.start → revEnd in [fwd.start + minAmp, fwd.start + maxAmp]
	const revEndMin = fwd.start + minAmp;
	const revEndMax = Math.min(seq.length, fwd.start + maxAmp);

	for (let revEnd = revEndMin; revEnd <= revEndMax; revEnd++) {
		for (let len = minLen; len <= maxLen; len++) {
			const revStart = revEnd - len;
			if (revStart <= fwd.end) continue; // overlap with forward primer
			if (revStart < 0) continue;

			const revSeq = reverseComplement(seq.slice(revStart, revEnd));

			const gcFrac = (revSeq.match(/[GC]/gi)?.length ?? 0) / len;
			const roughTm = 64.9 + 41 * (gcFrac - 16.4 / len);
			if (Math.abs(roughTm - opts.tmTarget) > 15) continue;

			const accessibility = accessProfile[revStart] ?? 0.5;
			const penalty = scorePrimer(revSeq, opts.tmTarget, opts.gcRange, accessibility);
			const { tm } = calcTm(revSeq);

			candidates.push({
				seq: revSeq,
				start: revStart,
				end: revEnd,
				len,
				tm,
				gc: calcGC(revSeq),
				hairpinDG: calcHairpinDG(revSeq),
				selfDimerDG: calcSelfDimerDG(revSeq),
				templateAccessibility: accessibility,
				penalty,
			});
		}
	}

	return candidates.sort((a, b) => a.penalty - b.penalty).slice(0, 5);
}

// ── Pairing ───────────────────────────────────────────────────────────────────

function pairPrimers(
	fwdList: JunctionPrimer[],
	seq: string,
	opts: ExonJunctionRequest,
	accessProfile: Float32Array,
): ExonJunctionPair[] {
	const pairs: ExonJunctionPair[] = [];

	for (const fwd of fwdList) {
		const revCandidates = findBestReversePrimers(seq, fwd, opts, accessProfile);

		for (const rev of revCandidates) {
			const tmDiff = Math.abs(fwd.tm - rev.tm);
			if (tmDiff > opts.maxTmDiff) continue;

			const heteroDimerDG = calcHeteroDimerDG(fwd.seq, rev.seq);
			const productSize = rev.end - fwd.start;
			const pairPenalty = fwd.penalty + rev.penalty + tmDiff * 0.5 + (heteroDimerDG < -3 ? 3 : 0);

			pairs.push({
				fwd,
				rev,
				productSize,
				tmDiff,
				heteroDimerDG,
				penalty: pairPenalty,
			});
		}
	}

	return pairs.sort((a, b) => a.penalty - b.penalty);
}

// ── Worker entry ──────────────────────────────────────────────────────────────

self.addEventListener("message", (e: MessageEvent<ExonJunctionRequest>) => {
	try {
		const opts = e.data;
		const seq = opts.seq.toUpperCase();

		if (opts.junctions.length === 0) {
			const response: ExonJunctionResponse = {
				type: "success",
				result: {
					pairs: [],
					warning: "No junction positions provided. Enter exon boundary positions (e.g. 150, 300) and try again.",
				},
			};
			self.postMessage(response);
			return;
		}

		// Compute accessibility once for the whole template
		const accessProfile = calcAccessibilityProfile(seq, opts.primerLenRange[0], {
			annealTempC: opts.tmTarget - 5,
		});

		// For each junction, generate spanning forward primers and pair them
		const allPairs: ExonJunctionPair[] = [];

		for (const junction of opts.junctions) {
			if (junction <= 0 || junction >= seq.length) continue;
			const fwdCandidates = designSpanningForwardPrimers(seq, junction, opts, accessProfile);
			const junctionPairs = pairPrimers(fwdCandidates, seq, opts, accessProfile);
			allPairs.push(...junctionPairs);
		}

		// Global sort, deduplicate by forward primer position
		allPairs.sort((a, b) => a.penalty - b.penalty);
		const seen = new Set<number>();
		const selected: ExonJunctionPair[] = [];
		for (const pair of allPairs) {
			if (selected.length >= opts.numReturn) break;
			const key = pair.fwd.start;
			if (seen.has(key)) continue;
			seen.add(key);
			selected.push(pair);
		}

		const warning =
			selected.length === 0
				? "No exon-spanning primer pairs found within the amplicon size and Tm constraints. Try widening the amplicon range, relaxing ΔTm, or check that junction positions fall within the sequence."
				: undefined;

		const response: ExonJunctionResponse = {
			type: "success",
			result: { pairs: selected, warning },
		};
		self.postMessage(response);
	} catch (err) {
		const response: ExonJunctionResponse = {
			type: "error",
			message: (err as Error).message ?? "Exon-junction design failed",
		};
		self.postMessage(response);
	}
});
