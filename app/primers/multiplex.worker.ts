// Multiplex PCR primer design and compatibility checking.
//
// For each target sequence (multi-FASTA input), designs the best PCR
// primer pair. Then computes a pairwise compatibility matrix: for every
// pair of primer pairs, checks whether they can run in the same multiplex
// reaction (similar annealing temperature, no cross-pair hetero-dimers).
// Finally identifies the largest mutually compatible subset.

import { designPCR, calcHeteroDimerDG } from "@shandley/primd";
import type { PCROptions, PrimerPair } from "@shandley/primd";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MultiplexTarget {
	name: string;
	seq: string;
}

export interface MultiplexPairResult {
	targetName: string;
	targetIdx: number;
	pair: PrimerPair | null;
	avgTm: number; // (fwd.tm + rev.tm) / 2 — used for cross-pair ΔTm
	warning?: string;
}

export type CompatibilityStatus = "ok" | "warn" | "fail";

export interface CompatibilityCell {
	status: CompatibilityStatus;
	tmDiff: number;       // |avgTm_i − avgTm_j|
	worstDimerDG: number; // most negative cross-dimer ΔG across all 4 combinations
	dimerDetail: string;  // which combination was worst
}

export interface MultiplexResult {
	pairs: MultiplexPairResult[];
	matrix: CompatibilityCell[][]; // N×N symmetric — matrix[i][j] for all i,j
	compatibleSet: number[];       // indices of the largest mutually "ok" subset
}

export interface MultiplexRequest {
	// Multi-FASTA: each entry is a distinct amplification target
	targets: string;
	primerLenRange: [number, number];
	tmTarget: number;
	gcRange: [number, number];
	maxTmDiff: number;
	productSizeRange: [number, number];
	// Compatibility thresholds
	maxCrossTmDiff: number;   // ΔTm between pair annealing temps (default 3°C)
	warnDimerDG: number;      // hetero-dimer ΔG warn threshold (default -3.0)
	failDimerDG: number;      // hetero-dimer ΔG fail threshold (default -5.0)
}

export type MultiplexResponse =
	| { type: "success"; result: MultiplexResult }
	| { type: "error"; message: string };

// ── FASTA parser (same as conservation worker) ────────────────────────────────

function parseMultiFasta(text: string): MultiplexTarget[] {
	const targets: MultiplexTarget[] = [];
	let name = "";
	let seq = "";
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (line.startsWith(">")) {
			if (name) targets.push({ name, seq: seq.toUpperCase() });
			// Use first word after > as name, strip version suffixes for display
			name = line.slice(1).split(/\s/)[0]?.replace(/\.\d+$/, "") ?? `Target${targets.length + 1}`;
			seq = "";
		} else {
			seq += line.replace(/\s/g, "");
		}
	}
	if (name) targets.push({ name, seq: seq.toUpperCase() });
	return targets;
}

// ── Per-target primer design ──────────────────────────────────────────────────

function designForTarget(
	target: MultiplexTarget,
	idx: number,
	opts: MultiplexRequest,
): MultiplexPairResult {
	const { seq } = target;
	// Inset so primers have a search window at each end
	const INSET = Math.min(200, Math.max(40, Math.floor(seq.length * 0.1)));
	const regionStart = INSET;
	const regionEnd = seq.length - INSET;

	if (regionStart >= regionEnd) {
		return { targetName: target.name, targetIdx: idx, pair: null, avgTm: 0, warning: "Sequence too short to design primers." };
	}

	const pcrOpts: PCROptions = {
		primerLenRange: opts.primerLenRange,
		tmTarget: opts.tmTarget,
		gcRange: opts.gcRange,
		maxTmDiff: opts.maxTmDiff,
		productSizeRange: opts.productSizeRange,
		numReturn: 1,
	};

	const result = designPCR(seq, regionStart, regionEnd, pcrOpts);

	if (result.pairs.length === 0) {
		return {
			targetName: target.name,
			targetIdx: idx,
			pair: null,
			avgTm: 0,
			warning: result.warning ?? "No primer pairs found.",
		};
	}

	const pair = result.pairs[0]!;
	const avgTm = (pair.fwd.tm + pair.rev.tm) / 2;
	return { targetName: target.name, targetIdx: idx, pair, avgTm };
}

// ── Compatibility matrix ──────────────────────────────────────────────────────

function checkCompatibility(
	a: MultiplexPairResult,
	b: MultiplexPairResult,
	opts: MultiplexRequest,
): CompatibilityCell {
	if (!a.pair || !b.pair) {
		return { status: "fail", tmDiff: 0, worstDimerDG: 0, dimerDetail: "no pair" };
	}

	const tmDiff = Math.abs(a.avgTm - b.avgTm);

	// Check all 4 cross-pair hetero-dimer combinations
	const crossCombos = [
		{ label: "Fwd×Fwd", dg: calcHeteroDimerDG(a.pair.fwd.seq, b.pair.fwd.seq) },
		{ label: "Fwd×Rev", dg: calcHeteroDimerDG(a.pair.fwd.seq, b.pair.rev.seq) },
		{ label: "Rev×Fwd", dg: calcHeteroDimerDG(a.pair.rev.seq, b.pair.fwd.seq) },
		{ label: "Rev×Rev", dg: calcHeteroDimerDG(a.pair.rev.seq, b.pair.rev.seq) },
	];

	const worst = crossCombos.reduce((w, c) => (c.dg < w.dg ? c : w), crossCombos[0]!);
	const worstDimerDG = worst.dg;
	const dimerDetail = worst.label;

	let status: CompatibilityStatus;
	if (tmDiff > opts.maxCrossTmDiff + 2 || worstDimerDG < opts.failDimerDG) {
		status = "fail";
	} else if (tmDiff > opts.maxCrossTmDiff || worstDimerDG < opts.warnDimerDG) {
		status = "warn";
	} else {
		status = "ok";
	}

	return { status, tmDiff, worstDimerDG, dimerDetail };
}

// ── Maximum compatible subset ─────────────────────────────────────────────────

function findCompatibleSet(
	pairs: MultiplexPairResult[],
	matrix: CompatibilityCell[][],
): number[] {
	// Indices of targets that actually have pairs
	const valid = pairs.map((p, i) => (p.pair ? i : -1)).filter((i) => i >= 0);
	if (valid.length === 0) return [];
	if (valid.length === 1) return valid;

	// Check if a set of indices is mutually compatible (all pairs "ok")
	function isCompatible(subset: number[]): boolean {
		for (let a = 0; a < subset.length; a++) {
			for (let b = a + 1; b < subset.length; b++) {
				const cell = matrix[subset[a]!]?.[subset[b]!];
				if (!cell || cell.status === "fail") return false;
			}
		}
		return true;
	}

	// Brute-force for N ≤ 15; greedy for larger
	if (valid.length <= 15) {
		// Try subsets from largest to smallest
		for (let size = valid.length; size >= 2; size--) {
			// Generate combinations of `size` items from `valid`
			const combo = (arr: number[], k: number): number[][] => {
				if (k === 0) return [[]];
				if (arr.length < k) return [];
				const [first, ...rest] = arr;
				return [
					...combo(rest, k - 1).map((c) => [first!, ...c]),
					...combo(rest, k),
				];
			};
			for (const subset of combo(valid, size)) {
				if (isCompatible(subset)) return subset;
			}
		}
		return valid.slice(0, 1); // fallback: just the first valid pair
	}

	// Greedy for N > 15
	const chosen: number[] = [valid[0]!];
	for (const idx of valid.slice(1)) {
		if ([...chosen, idx].every((a, i, arr) =>
			arr.slice(i + 1).every((b) => matrix[a]?.[b]?.status !== "fail"),
		)) {
			chosen.push(idx);
		}
	}
	return chosen;
}

// ── Worker entry ──────────────────────────────────────────────────────────────

self.addEventListener("message", (e: MessageEvent<MultiplexRequest>) => {
	try {
		const opts = e.data;
		const targets = parseMultiFasta(opts.targets);

		if (targets.length < 2) {
			throw new Error("Need at least 2 target sequences. Paste multiple FASTA entries.");
		}
		if (targets.length > 20) {
			throw new Error("Maximum 20 targets supported (found ${targets.length}). Split into smaller panels.");
		}

		// Design a primer pair for each target
		const pairs: MultiplexPairResult[] = targets.map((t, i) =>
			designForTarget(t, i, opts),
		);

		// Build N×N compatibility matrix
		const N = pairs.length;
		const matrix: CompatibilityCell[][] = Array.from({ length: N }, (_, i) =>
			Array.from({ length: N }, (__, j) => {
				if (i === j) return { status: "ok" as const, tmDiff: 0, worstDimerDG: 0, dimerDetail: "self" };
				return checkCompatibility(pairs[i]!, pairs[j]!, opts);
			}),
		);

		const compatibleSet = findCompatibleSet(pairs, matrix);

		const response: MultiplexResponse = {
			type: "success",
			result: { pairs, matrix, compatibleSet },
		};
		self.postMessage(response);
	} catch (err) {
		const response: MultiplexResponse = {
			type: "error",
			message: (err as Error).message ?? "Multiplex design failed",
		};
		self.postMessage(response);
	}
});
