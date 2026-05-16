// Conservation-based primer design for variable target sequences.
//
// Input: a multiple sequence alignment in FASTA format (sequences must be the
// same length; gaps as '-'). Output: primers designed in highly conserved
// windows across all input sequences, with optional IUPAC degeneracy at
// polymorphic positions.

import {
	calcGC,
	calcHairpinDG,
	calcSelfDimerDG,
	calcTm,
	reverseComplement,
} from "@shandley/primd";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AlignedSequence {
	name: string;
	seq: string; // same length as all others, gaps = '-'
}

export interface ConsensusPrimer {
	seq: string;           // with IUPAC codes where applicable
	consensusSeq: string;  // plain A/C/G/T (for Tm calculation)
	alignPos: number;      // 0-indexed in the alignment
	length: number;
	direction: "fwd" | "rev";
	tm: number;
	gc: number;
	hairpinDG: number;
	selfDimerDG: number;
	conservation: number;  // average per-column conservation in this window
	numDegenerate: number; // how many IUPAC positions
	// Per-sequence mismatch count (positions where input differs from consensus)
	mismatches: { count: number; nSeqs: number }[];
	penalty: number;
}

export interface ConservationResult {
	sequences: AlignedSequence[];
	alignmentLen: number;
	conservation: number[]; // per alignment column [0, 1]
	consensus: string;      // per-column consensus base (may be IUPAC)
	primers: ConsensusPrimer[];
	warning?: string;
}

export interface ConservationRequest {
	alignment: string;           // raw multi-FASTA text
	conservationThreshold: number; // [0.6, 1.0] — min average window conservation
	maxDegeneracy: number;         // max degenerate (IUPAC) positions in a primer
	primerLenRange: [number, number];
	tmTarget: number;
	gcRange: [number, number];
	numReturn: number;
}

export type ConservationResponse =
	| { type: "success"; result: ConservationResult }
	| { type: "error"; message: string };

// ── FASTA parser ──────────────────────────────────────────────────────────────

function parseMultiFasta(text: string): AlignedSequence[] {
	const seqs: AlignedSequence[] = [];
	let name = "";
	let seq = "";

	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (line.startsWith(">")) {
			if (name) seqs.push({ name, seq: seq.toUpperCase() });
			name = line.slice(1).split(/\s/)[0] ?? `seq${seqs.length + 1}`;
			seq = "";
		} else {
			// strip whitespace + digits (numbered FASTA lines)
			seq += line.replace(/[\s\d]/g, "");
		}
	}
	if (name) seqs.push({ name, seq: seq.toUpperCase() });
	return seqs;
}

// ── IUPAC degeneracy ──────────────────────────────────────────────────────────

// Map sorted base string → IUPAC code
const IUPAC: Record<string, string> = {
	A: "A", C: "C", G: "G", T: "T",
	AG: "R", CT: "Y", CG: "S", AT: "W", GT: "K", AC: "M",
	CGT: "B", AGT: "D", ACT: "H", ACG: "V",
	ACGT: "N",
};

function toIUPAC(bases: string[]): string {
	const sorted = [...new Set(bases.filter((b) => "ACGT".includes(b)))].sort().join("");
	return IUPAC[sorted] ?? (sorted.length === 0 ? "N" : sorted[0]!);
}

// ── Conservation computation ──────────────────────────────────────────────────

interface ColumnStats {
	conservation: number; // fraction of non-gap bases that are the most common
	consensusBase: string; // most frequent non-gap base (IUPAC if needed)
	plainBase: string;     // most frequent single non-gap base (for Tm calc)
	freqBases: string[];   // all bases with freq >= 10% of non-gap
}

function computeColumnStats(
	seqs: AlignedSequence[],
	col: number,
	minFreqFraction: number,
): ColumnStats {
	const counts: Record<string, number> = { A: 0, C: 0, G: 0, T: 0, gap: 0 };
	for (const s of seqs) {
		const b = s.seq[col] ?? "-";
		if (b === "-" || b === ".") counts.gap++;
		else if ("ACGT".includes(b)) counts[b] = (counts[b] ?? 0) + 1;
		// Ignore IUPAC codes in input sequences for simplicity
	}
	const nonGap = seqs.length - counts.gap;
	if (nonGap === 0) return { conservation: 0, consensusBase: "-", plainBase: "N", freqBases: [] };

	const bases = (["A", "C", "G", "T"] as const).map((b) => ({ b, n: counts[b] ?? 0 }));
	bases.sort((a, z) => z.n - a.n);

	const maxCount = bases[0]!.n;
	const conservation = maxCount / nonGap;
	const plainBase = bases[0]!.b;

	// Bases above the frequency threshold for degeneracy
	const threshold = Math.max(1, Math.round(nonGap * minFreqFraction));
	const freqBases = bases.filter((x) => x.n >= threshold).map((x) => x.b);
	const consensusBase = toIUPAC(freqBases.length > 0 ? freqBases : [plainBase]);

	return { conservation, consensusBase, plainBase, freqBases };
}

// ── Primer scoring ────────────────────────────────────────────────────────────

const TM_PENALTY = 1.5;
const GC_PENALTY = 6.0;
const HAIRPIN_THRESHOLD = -2.0;
const HAIRPIN_PENALTY = 4.0;
const DIMER_THRESHOLD = -5.0;
const DIMER_PENALTY = 3.0;
const CONSERVATION_PENALTY = 10.0; // per fraction below threshold
const DEGENERACY_PENALTY = 1.5;    // per extra degenerate position beyond 0

function scorePrimer(
	consensusSeq: string,
	tmTarget: number,
	gcRange: [number, number],
	avgConservation: number,
	conservationThreshold: number,
	numDegenerate: number,
): number {
	const { tm } = calcTm(consensusSeq);
	const gc = calcGC(consensusSeq);
	const hairpinDG = calcHairpinDG(consensusSeq);
	const selfDimerDG = calcSelfDimerDG(consensusSeq);

	let penalty = Math.abs(tm - tmTarget) * TM_PENALTY;
	if (gc < gcRange[0] || gc > gcRange[1]) penalty += GC_PENALTY;
	if (hairpinDG < HAIRPIN_THRESHOLD) penalty += HAIRPIN_PENALTY;
	if (selfDimerDG < DIMER_THRESHOLD) penalty += DIMER_PENALTY;
	// Penalise conservation below threshold
	if (avgConservation < conservationThreshold) {
		penalty += (conservationThreshold - avgConservation) * CONSERVATION_PENALTY;
	}
	// Penalise degeneracy
	penalty += numDegenerate * DEGENERACY_PENALTY;
	// GC clamp
	const last2 = consensusSeq.slice(-2);
	if (!last2.includes("G") && !last2.includes("C")) penalty += 1.5;
	return penalty;
}

// ── Mismatch computation ──────────────────────────────────────────────────────

function computeMismatches(
	seqs: AlignedSequence[],
	alignPos: number,
	len: number,
	plainConsensus: string,
): { count: number; nSeqs: number }[] {
	// Bucket by mismatch count: index = mismatch count, value = number of seqs with that count
	const buckets: number[] = [];
	for (const s of seqs) {
		let mm = 0;
		for (let i = 0; i < len; i++) {
			const b = s.seq[alignPos + i] ?? "-";
			if (b !== "-" && b !== "." && b !== plainConsensus[i]) mm++;
		}
		buckets[mm] = (buckets[mm] ?? 0) + 1;
	}
	return buckets
		.map((nSeqs, count) => ({ count, nSeqs }))
		.filter((x) => x.nSeqs > 0);
}

// ── Core design ───────────────────────────────────────────────────────────────

function designConservationPrimers(
	seqs: AlignedSequence[],
	colStats: ColumnStats[],
	opts: ConservationRequest,
	direction: "fwd" | "rev",
): ConsensusPrimer[] {
	const [minLen, maxLen] = opts.primerLenRange;
	const alignLen = colStats.length;
	const candidates: ConsensusPrimer[] = [];

	for (let start = 0; start <= alignLen - minLen; start++) {
		for (let len = minLen; len <= maxLen; len++) {
			if (start + len > alignLen) break;

			// Build consensus + IUPAC sequences for this window
			let iupacSeq = "";
			let plainSeq = "";
			let numDegenerate = 0;
			let sumConservation = 0;

			for (let i = 0; i < len; i++) {
				const col = colStats[start + i]!;
				iupacSeq += col.consensusBase;
				plainSeq += col.plainBase;
				sumConservation += col.conservation;
				if (col.consensusBase !== col.plainBase) numDegenerate++;
			}

			const avgConservation = sumConservation / len;

			// Skip if below threshold or too many degenerate positions
			if (avgConservation < opts.conservationThreshold * 0.8) continue;
			if (numDegenerate > opts.maxDegeneracy) continue;

			// Skip primers with gaps in the consensus (gap-dominated columns)
			if (iupacSeq.includes("-")) continue;

			const workingSeq = direction === "fwd" ? plainSeq : reverseComplement(plainSeq);
			const workingIupac = direction === "fwd" ? iupacSeq : reverseComplement(iupacSeq);

			// Wallace pre-filter
			const gc = (workingSeq.match(/[GC]/gi)?.length ?? 0) / len;
			const roughTm = 64.9 + 41 * (gc - 16.4 / len);
			if (Math.abs(roughTm - opts.tmTarget) > 18) continue;

			const penalty = scorePrimer(
				workingSeq,
				opts.tmTarget,
				opts.gcRange,
				avgConservation,
				opts.conservationThreshold,
				numDegenerate,
			);

			const { tm } = calcTm(workingSeq);
			const mismatches = computeMismatches(seqs, start, len, plainSeq);

			candidates.push({
				seq: workingIupac,
				consensusSeq: workingSeq,
				alignPos: start,
				length: len,
				direction,
				tm,
				gc: calcGC(workingSeq),
				hairpinDG: calcHairpinDG(workingSeq),
				selfDimerDG: calcSelfDimerDG(workingSeq),
				conservation: avgConservation,
				numDegenerate,
				mismatches,
				penalty,
			});
		}
	}

	// Sort by penalty, deduplicate overlapping windows (keep best per region)
	candidates.sort((a, b) => a.penalty - b.penalty);

	// Greedy non-overlapping selection
	const selected: ConsensusPrimer[] = [];
	const used = new Uint8Array(alignLen);

	for (const c of candidates) {
		if (selected.length >= opts.numReturn) break;
		// Check if this window overlaps a selected primer by more than half its length
		let overlap = false;
		for (let i = c.alignPos; i < c.alignPos + c.length; i++) {
			if (used[i]) { overlap = true; break; }
		}
		if (overlap) continue;
		selected.push(c);
		for (let i = c.alignPos; i < c.alignPos + c.length; i++) {
			used[i] = 1;
		}
	}

	return selected;
}

// ── Worker entry ──────────────────────────────────────────────────────────────

self.addEventListener("message", (e: MessageEvent<ConservationRequest>) => {
	try {
		const opts = e.data;

		// Parse alignment
		const seqs = parseMultiFasta(opts.alignment);
		if (seqs.length < 2) throw new Error("Need at least 2 aligned sequences.");

		const alignLen = seqs[0]!.seq.length;
		if (seqs.some((s) => s.seq.length !== alignLen)) {
			throw new Error(
				`All sequences must be the same length (alignment). Got lengths: ${seqs.map((s) => s.seq.length).join(", ")}.`,
			);
		}

		// Per-column statistics
		// minFreqFraction: a base must appear in at least 10% of non-gap seqs to be in degeneracy
		const colStats = Array.from({ length: alignLen }, (_, i) =>
			computeColumnStats(seqs, i, 0.1),
		);

		const conservation = colStats.map((c) => c.conservation);
		const consensus = colStats.map((c) => c.consensusBase).join("");

		// Design both forward and reverse primers
		const fwdPrimers = designConservationPrimers(seqs, colStats, opts, "fwd");
		const revPrimers = designConservationPrimers(seqs, colStats, opts, "rev");

		// Merge, re-sort, return top N
		const allPrimers = [...fwdPrimers, ...revPrimers]
			.sort((a, b) => a.penalty - b.penalty)
			.slice(0, opts.numReturn * 2);

		const warning =
			allPrimers.length === 0
				? `No primers found above the ${Math.round(opts.conservationThreshold * 100)}% conservation threshold. Try lowering the threshold or allowing more degeneracy.`
				: undefined;

		const result: ConservationResult = {
			sequences: seqs,
			alignmentLen: alignLen,
			conservation,
			consensus,
			primers: allPrimers,
			warning,
		};

		const response: ConservationResponse = { type: "success", result };
		self.postMessage(response);
	} catch (err) {
		const response: ConservationResponse = {
			type: "error",
			message: (err as Error).message ?? "Conservation design failed",
		};
		self.postMessage(response);
	}
});
