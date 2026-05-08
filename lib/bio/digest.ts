import { RESTRICTION_ENZYMES, type RestrictionEnzyme } from "./enzymes";

export interface DigestCutSite {
	enzyme: string;
	position: number; // 0-indexed start of recognition sequence
}

export interface DigestFragment {
	size: number;
	start: number;
	end: number;
	leftEnzyme: string;
	rightEnzyme: string;
}

export interface DigestResult {
	fragments: DigestFragment[];        // sorted largest → smallest
	cutSites: DigestCutSite[];          // sorted by position
	enzymeCount: Record<string, number>;
	error?: string;
}

// IUPAC ambiguity → regex character class
const IUPAC: Record<string, string> = {
	A: "A", C: "C", G: "G", T: "T",
	R: "[AG]", Y: "[CT]", S: "[GC]", W: "[AT]",
	K: "[GT]", M: "[AC]", B: "[CGT]", D: "[AGT]",
	H: "[ACT]", V: "[ACG]", N: "[ACGT]",
};

function toRegex(recognition: string): RegExp {
	const pattern = recognition.toUpperCase().split("").map((c) => IUPAC[c] ?? c).join("");
	return new RegExp(pattern, "g");
}

function revComp(seq: string): string {
	const comp: Record<string, string> = {
		A: "T", T: "A", C: "G", G: "C",
		R: "Y", Y: "R", S: "S", W: "W",
		K: "M", M: "K", B: "V", D: "H", H: "D", V: "B", N: "N",
	};
	return seq.toUpperCase().split("").reverse().map((c) => comp[c] ?? c).join("");
}

function findPositions(seq: string, enzyme: RestrictionEnzyme, circular: boolean): number[] {
	const upper = seq.toUpperCase();
	// Extend by recognition length - 1 for circular wrap detection
	const searchSeq = circular ? upper + upper.slice(0, enzyme.recognition.length - 1) : upper;
	const positions = new Set<number>();

	const fwdRe = toRegex(enzyme.recognition);
	let m: RegExpExecArray | null;
	while ((m = fwdRe.exec(searchSeq)) !== null) {
		if (m.index < seq.length) positions.add(m.index);
	}

	const rc = revComp(enzyme.recognition);
	if (rc !== enzyme.recognition.toUpperCase()) {
		const revRe = toRegex(rc);
		while ((m = revRe.exec(searchSeq)) !== null) {
			if (m.index < seq.length) positions.add(m.index);
		}
	}

	return [...positions].sort((a, b) => a - b);
}

export function simulateDigest(
	seq: string,
	topology: "circular" | "linear",
	enzymeNames: string[],
): DigestResult {
	const upper = seq.toUpperCase();
	const isCircular = topology === "circular";
	const allCuts: DigestCutSite[] = [];
	const enzymeCount: Record<string, number> = {};

	// Deduplicate enzyme names before processing
	for (const name of [...new Set(enzymeNames)]) {
		const enzyme = RESTRICTION_ENZYMES.find((e) => e.name === name);
		if (!enzyme) continue;
		const positions = findPositions(upper, enzyme, isCircular);
		enzymeCount[name] = positions.length;
		for (const pos of positions) allCuts.push({ enzyme: name, position: pos });
	}

	allCuts.sort((a, b) => a.position - b.position);

	if (allCuts.length === 0) {
		if (enzymeNames.length === 0) {
			return { fragments: [], cutSites: [], enzymeCount, error: "No enzymes selected." };
		}
		return { fragments: [], cutSites: [], enzymeCount, error: "None of the selected enzymes cut this sequence." };
	}

	const fragments: DigestFragment[] = [];

	if (isCircular) {
		for (let i = 0; i < allCuts.length; i++) {
			const cut = allCuts[i];
			const next = allCuts[(i + 1) % allCuts.length];
			const size =
				i < allCuts.length - 1
					? next.position - cut.position
					: upper.length - cut.position + allCuts[0].position;
			fragments.push({ size, start: cut.position, end: next.position, leftEnzyme: cut.enzyme, rightEnzyme: next.enzyme });
		}
	} else {
		// 5′ end → first cut
		if (allCuts[0].position > 0) {
			fragments.push({ size: allCuts[0].position, start: 0, end: allCuts[0].position, leftEnzyme: "5′", rightEnzyme: allCuts[0].enzyme });
		}
		for (let i = 0; i < allCuts.length - 1; i++) {
			const size = allCuts[i + 1].position - allCuts[i].position;
			fragments.push({ size, start: allCuts[i].position, end: allCuts[i + 1].position, leftEnzyme: allCuts[i].enzyme, rightEnzyme: allCuts[i + 1].enzyme });
		}
		// Last cut → 3′ end
		const last = allCuts[allCuts.length - 1];
		if (last.position < upper.length) {
			fragments.push({ size: upper.length - last.position, start: last.position, end: upper.length, leftEnzyme: last.enzyme, rightEnzyme: "3′" });
		}
	}

	fragments.sort((a, b) => b.size - a.size);
	return { fragments, cutSites: allCuts, enzymeCount };
}

/** Enzymes from RESTRICTION_ENZYMES that cut the sequence, with counts. */
export function enzymesCuttingSeq(
	seq: string,
	topology: "circular" | "linear",
): { enzyme: RestrictionEnzyme; count: number }[] {
	const upper = seq.toUpperCase();
	const isCircular = topology === "circular";
	const seen = new Set<string>();
	const results: { enzyme: RestrictionEnzyme; count: number }[] = [];

	for (const enzyme of RESTRICTION_ENZYMES) {
		if (seen.has(enzyme.name)) continue;
		seen.add(enzyme.name);
		const count = findPositions(upper, enzyme, isCircular).length;
		if (count > 0) results.push({ enzyme, count });
	}

	return results.sort((a, b) => a.count - b.count || a.enzyme.name.localeCompare(b.enzyme.name));
}
