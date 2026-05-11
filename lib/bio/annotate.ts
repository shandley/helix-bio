/**
 * In-browser sequence annotation using k-mer matching against a curated
 * reference library of 1,472 canonical molecular biology features.
 *
 * Algorithm:
 *   1. Build a k-mer position map for the query (O(queryLen))
 *   2. For each feature, sample seed k-mers and look them up in the query map
 *   3. Cluster votes by expected start position; candidates with ≥3 agreement
 *   4. Verify with identity calculation over the candidate window
 *   5. Repeat on reverse complement for minus-strand features
 *
 * Coverage: >85% identity matches, which encompasses virtually all standard
 * lab features. Novel or highly diverged sequences will not be detected.
 */

export interface CanonicalFeature {
	name: string;
	type: string;
	seq: string;
}

export interface Annotation {
	id: string;
	name: string;
	type: string;
	start: number; // 0-indexed, inclusive
	end: number; // 0-indexed, exclusive
	direction: 1 | -1; // 1 = forward (+), -1 = reverse (−)
	identity: number; // [0, 1]
	color: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const K = 15;
const MIN_VOTES = 3;
const MIN_IDENTITY = 0.82;
const SEEDS_PER_FEATURE = 12; // evenly spaced k-mer seeds

const TYPE_COLORS: Record<string, string> = {
	CDS: "#3b82f6",
	promoter: "#16a34a",
	terminator: "#dc2626",
	rep_origin: "#d97706",
	enhancer: "#7c3aed",
	protein_bind: "#db2777",
	LTR: "#0891b2",
	misc_RNA: "#65a30d",
	intron: "#9ca3af",
	exon: "#6366f1",
	polyA_signal: "#f59e0b",
	misc_recomb: "#be185d",
	misc_feature: "#6b7280",
};

function featureColor(type: string): string {
	return TYPE_COLORS[type] ?? "#9a9284";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RC_MAP: Record<string, string> = { A: "T", T: "A", G: "C", C: "G", N: "N" };

function reverseComplement(seq: string): string {
	let rc = "";
	for (let i = seq.length - 1; i >= 0; i--) {
		rc += RC_MAP[seq[i]!] ?? "N";
	}
	return rc;
}

function buildKmerMap(seq: string, k: number): Map<string, number[]> {
	const map = new Map<string, number[]>();
	for (let i = 0; i <= seq.length - k; i++) {
		const kmer = seq.slice(i, i + k);
		if (!kmer.includes("N")) {
			const arr = map.get(kmer);
			if (arr) arr.push(i);
			else map.set(kmer, [i]);
		}
	}
	return map;
}

function computeIdentity(a: string, b: string): number {
	if (a.length === 0 || b.length === 0) return 0;
	const len = Math.min(a.length, b.length);
	let matches = 0;
	for (let i = 0; i < len; i++) {
		if (a[i] === b[i]) matches++;
	}
	return matches / Math.max(a.length, b.length);
}

function seedPositions(featureLen: number, seeds: number, k: number): number[] {
	if (featureLen <= k) return [0];
	const step = Math.max(1, Math.floor((featureLen - k) / (seeds - 1)));
	const positions: number[] = [];
	for (let i = 0; i < seeds; i++) {
		const pos = Math.min(i * step, featureLen - k);
		if (positions.length === 0 || pos !== positions[positions.length - 1]) {
			positions.push(pos);
		}
	}
	return positions;
}

// ── Core search ───────────────────────────────────────────────────────────────

function searchStrand(
	querySeq: string,
	queryKmers: Map<string, number[]>,
	features: CanonicalFeature[],
	strand: 1 | -1,
): Annotation[] {
	const results: Annotation[] = [];
	const queryLen = querySeq.length;

	for (let fi = 0; fi < features.length; fi++) {
		const feature = features[fi]!;
		const fseq = strand === 1 ? feature.seq : reverseComplement(feature.seq);
		const flen = fseq.length;
		if (flen < K) continue;

		// Vote on expected start position in query
		const votes = new Map<number, number>();
		const seeds = seedPositions(flen, SEEDS_PER_FEATURE, K);

		for (const posInFeature of seeds) {
			const kmer = fseq.slice(posInFeature, posInFeature + K);
			if (kmer.includes("N")) continue;
			const hits = queryKmers.get(kmer);
			if (!hits) continue;
			for (const posInQuery of hits) {
				const expectedStart = posInQuery - posInFeature;
				votes.set(expectedStart, (votes.get(expectedStart) ?? 0) + 1);
			}
		}

		// Evaluate candidates
		for (const [expectedStart, voteCount] of votes) {
			if (voteCount < MIN_VOTES) continue;

			const qStart = Math.max(0, expectedStart);
			const qEnd = Math.min(queryLen, expectedStart + flen);
			if (qEnd - qStart < Math.min(20, flen * 0.7)) continue;

			const fOffset = qStart - expectedStart;
			const queryWindow = querySeq.slice(qStart, qEnd);
			const featureWindow = fseq.slice(fOffset, fOffset + (qEnd - qStart));
			const identity = computeIdentity(queryWindow, featureWindow);
			if (identity < MIN_IDENTITY) continue;

			results.push({
				id: `${fi}-${strand}-${qStart}`,
				name: feature.name,
				type: feature.type,
				start: qStart,
				end: qEnd,
				direction: strand,
				identity,
				color: featureColor(feature.type),
			});
		}
	}
	return results;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function overlapFraction(a: Annotation, b: Annotation): number {
	const lo = Math.max(a.start, b.start);
	const hi = Math.min(a.end, b.end);
	if (hi <= lo) return 0;
	const minLen = Math.min(a.end - a.start, b.end - b.start);
	return minLen > 0 ? (hi - lo) / minLen : 0;
}

function dedup(annotations: Annotation[]): Annotation[] {
	// Sort by identity descending so higher-confidence hits are kept first.
	// Collapse any pair overlapping >70% of the shorter annotation regardless
	// of name or strand — prevents f1-ori / pMB1-ori stacking and eliminates
	// duplicate hits where the same feature matches both + and − strands.
	annotations.sort((a, b) => b.identity - a.identity);
	const kept: Annotation[] = [];
	for (const ann of annotations) {
		if (!kept.some((k) => overlapFraction(k, ann) > 0.7)) {
			kept.push(ann);
		}
	}
	return kept;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Annotate a DNA sequence against the canonical feature library.
 * Both strands are searched. Returns deduplicated annotations sorted by position.
 */
export function annotate(seq: string, features: CanonicalFeature[]): Annotation[] {
	const upper = seq.toUpperCase().replace(/[^ACGTN]/g, "N");
	const fwdMap = buildKmerMap(upper, K);
	const rcSeq = reverseComplement(upper);
	const rcMap = buildKmerMap(rcSeq, K);

	const fwd = searchStrand(upper, fwdMap, features, 1);

	// For reverse strand: search against the RC sequence, then convert coordinates
	const revRaw = searchStrand(rcSeq, rcMap, features, -1);
	const rev = revRaw.map((a) => ({
		...a,
		start: upper.length - a.end,
		end: upper.length - a.start,
	}));

	const all = dedup([...fwd, ...rev]);
	all.sort((a, b) => a.start - b.start);
	return all;
}
