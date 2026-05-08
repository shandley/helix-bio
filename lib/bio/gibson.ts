import { reverseComplement } from "./primer-design";

export interface GibsonFragment {
	name: string;
	seq: string;
}

export interface GibsonResult {
	resultSeq: string;
	productSize: number;
	fragments: { name: string; size: number; leftOverlapLen: number; rightOverlapLen: number }[];
	warnings: string[];
	error?: string;
	/** Primer tails needed when overlap is missing (keyed by fragment name) */
	missingOverlaps: { fragment: string; side: "left" | "right"; tail: string }[];
}

const MIN_OVERLAP = 15;
const TARGET_OVERLAP = 20;

/** Find longest suffix of `a` that equals a prefix of `b`, up to maxLen. */
function findOverlapLen(a: string, b: string, maxLen = 60): number {
	const limit = Math.min(a.length, b.length, maxLen);
	for (let len = limit; len >= MIN_OVERLAP; len--) {
		if (a.slice(-len) === b.slice(0, len)) return len;
	}
	return 0;
}

/**
 * Simulate Gibson Assembly for a linearized vector and one insert.
 *
 * vectorCutPos — 0-indexed cut position in the circular vector.
 * The insert may already carry homology arms; if not, missingOverlaps
 * will report the primer tails needed to add them.
 */
export function simulateGibson(
	vector: string,
	vectorCutPos: number,
	insert: string,
): GibsonResult {
	const warnings: string[] = [];
	const missingOverlaps: GibsonResult["missingOverlaps"] = [];

	const vec = vector.toUpperCase();
	const ins = insert.toUpperCase().replace(/[^ATGCN]/g, "");

	if (!ins) return { error: "Insert sequence is empty or contains only invalid characters." } as GibsonResult;
	if (vectorCutPos < 0 || vectorCutPos > vec.length)
		return { error: `Cut position ${vectorCutPos} is out of range (0–${vec.length}).` } as GibsonResult;

	// Linearize vector at cut site
	const leftArm = vec.slice(0, vectorCutPos);   // sequence to the left of cut
	const rightArm = vec.slice(vectorCutPos);      // sequence to the right of cut

	// Detect overlaps: left arm ∩ insert left end, insert right end ∩ right arm
	const leftOverlapLen = findOverlapLen(leftArm, ins);
	const rightOverlapLen = findOverlapLen(ins, rightArm);

	// Report missing overlaps and compute needed primer tails
	if (leftOverlapLen === 0) {
		const tail = leftArm.slice(-TARGET_OVERLAP);
		missingOverlaps.push({ fragment: "insert", side: "left", tail });
		warnings.push(
			`No left homology arm detected. Forward primer needs a ${TARGET_OVERLAP}bp 5′ tail: ${tail}`,
		);
	}
	if (rightOverlapLen === 0) {
		const tail = reverseComplement(rightArm.slice(0, TARGET_OVERLAP));
		missingOverlaps.push({ fragment: "insert", side: "right", tail });
		warnings.push(
			`No right homology arm detected. Reverse primer needs a ${TARGET_OVERLAP}bp 5′ tail: ${tail}`,
		);
	}

	if (leftOverlapLen > 0 && leftOverlapLen < MIN_OVERLAP)
		warnings.push(`Left overlap is only ${leftOverlapLen} bp — Gibson efficiency may be low (recommend ≥ ${MIN_OVERLAP} bp).`);
	if (rightOverlapLen > 0 && rightOverlapLen < MIN_OVERLAP)
		warnings.push(`Right overlap is only ${rightOverlapLen} bp — Gibson efficiency may be low (recommend ≥ ${MIN_OVERLAP} bp).`);

	// Assemble: left vector arm + insert core (strip overlap from both ends) + right vector arm
	const insertCore = ins.slice(leftOverlapLen || 0, ins.length - (rightOverlapLen || 0));
	const resultSeq = leftArm + insertCore + rightArm;

	return {
		resultSeq,
		productSize: resultSeq.length,
		fragments: [
			{ name: "vector backbone", size: vec.length, leftOverlapLen: rightOverlapLen, rightOverlapLen: leftOverlapLen },
			{ name: "insert", size: ins.length, leftOverlapLen, rightOverlapLen },
		],
		warnings,
		missingOverlaps,
	};
}

/**
 * Multi-fragment Gibson Assembly (vector + N inserts).
 * Each fragment must overlap the next by MIN_OVERLAP bp.
 */
export function simulateGibsonMulti(
	vector: string,
	vectorCutPos: number,
	fragments: GibsonFragment[],
): GibsonResult {
	if (fragments.length === 0)
		return { error: "No insert fragments provided." } as GibsonResult;
	if (fragments.length === 1)
		return simulateGibson(vector, vectorCutPos, fragments[0].seq);

	const warnings: string[] = [];
	const missingOverlaps: GibsonResult["missingOverlaps"] = [];

	const vec = vector.toUpperCase();
	const frags = fragments.map((f) => ({
		...f,
		seq: f.seq.toUpperCase().replace(/[^ATGCN]/g, ""),
	}));

	if (frags.some((f) => !f.seq))
		return { error: "One or more fragments contain only invalid characters." } as GibsonResult;

	const leftArm = vec.slice(0, vectorCutPos);
	const rightArm = vec.slice(vectorCutPos);

	// Build ordered sequence: leftArm → frag[0] → frag[1] → … → rightArm
	const seqs = [leftArm, ...frags.map((f) => f.seq), rightArm];
	const names = ["vector (left)", ...frags.map((f) => f.name), "vector (right)"];

	const overlapLens: number[] = [];
	for (let i = 0; i < seqs.length - 1; i++) {
		const olen = findOverlapLen(seqs[i], seqs[i + 1]);
		overlapLens.push(olen);
		if (olen === 0) {
			const isRight = i === seqs.length - 2;
			const fragName = names[i + 1];
			const tail = isRight
				? reverseComplement(seqs[i + 1].slice(0, TARGET_OVERLAP))
				: seqs[i].slice(-TARGET_OVERLAP);
			missingOverlaps.push({
				fragment: fragName,
				side: isRight ? "right" : "left",
				tail,
			});
			warnings.push(`No overlap between "${names[i]}" and "${names[i + 1]}". Add a ${TARGET_OVERLAP}bp homology arm.`);
		} else if (olen < MIN_OVERLAP) {
			warnings.push(`Overlap between "${names[i]}" and "${names[i + 1]}" is only ${olen} bp — recommend ≥ ${MIN_OVERLAP} bp.`);
		}
	}

	// Assemble: concatenate, trimming overlaps
	let assembled = seqs[0];
	for (let i = 1; i < seqs.length; i++) {
		const trimLen = overlapLens[i - 1];
		assembled += seqs[i].slice(trimLen);
	}

	return {
		resultSeq: assembled,
		productSize: assembled.length,
		fragments: frags.map((f, i) => ({
			name: f.name,
			size: f.seq.length,
			leftOverlapLen: overlapLens[i],
			rightOverlapLen: overlapLens[i + 1] ?? 0,
		})),
		warnings,
		missingOverlaps,
	};
}
