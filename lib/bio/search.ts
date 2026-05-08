const IUPAC_RE: Record<string, string> = {
	A: "A", C: "C", G: "G", T: "T", U: "T",
	R: "[AG]", Y: "[CT]", S: "[GC]", W: "[AT]",
	K: "[GT]", M: "[AC]", B: "[CGT]", D: "[AGT]",
	H: "[ACT]", V: "[ACG]", N: "[ACGT]",
};

function revComp(seq: string): string {
	const comp: Record<string, string> = {
		A: "T", T: "A", U: "A", C: "G", G: "C",
		R: "Y", Y: "R", S: "S", W: "W",
		K: "M", M: "K", B: "V", D: "H", H: "D", V: "B", N: "N",
	};
	return seq.toUpperCase().split("").reverse().map((c) => comp[c] ?? c).join("");
}

function queryToRegex(query: string): RegExp | null {
	try {
		const pattern = query.toUpperCase().split("").map((c) => IUPAC_RE[c] ?? c).join("");
		return new RegExp(pattern, "g");
	} catch {
		return null;
	}
}

export interface SearchMatch {
	start: number;  // 0-indexed
	end: number;    // exclusive
	strand: "+" | "-";
}

/**
 * Search for a DNA query (supports IUPAC degenerate bases) in seq.
 * Searches both strands. Handles circular wrap-around.
 * Minimum query length: 3 bp.
 */
export function searchSequence(seq: string, query: string, circular = false): SearchMatch[] {
	if (!query || query.length < 3) return [];

	const upper = seq.toUpperCase();
	const searchSeq = circular ? upper + upper.slice(0, query.length - 1) : upper;
	const matches: SearchMatch[] = [];
	const seen = new Set<string>();

	function addMatch(start: number, end: number, strand: "+" | "-") {
		// Normalize positions for circular sequences
		const normStart = start % seq.length;
		const key = `${normStart}:${strand}`;
		if (seen.has(key)) return;
		seen.add(key);
		matches.push({ start: normStart, end: normStart + query.length, strand });
	}

	// Forward strand
	const fwdRe = queryToRegex(query);
	if (fwdRe) {
		let m: RegExpExecArray | null;
		while ((m = fwdRe.exec(searchSeq)) !== null) {
			if (m.index < seq.length) addMatch(m.index, m.index + query.length, "+");
		}
	}

	// Reverse complement (skip if palindrome)
	const rcQuery = revComp(query);
	if (rcQuery !== query.toUpperCase()) {
		const revRe = queryToRegex(rcQuery);
		if (revRe) {
			let m: RegExpExecArray | null;
			while ((m = revRe.exec(searchSeq)) !== null) {
				if (m.index < seq.length) addMatch(m.index, m.index + query.length, "-");
			}
		}
	}

	return matches.sort((a, b) => a.start - b.start);
}

/** True if the query string contains only valid IUPAC DNA characters. */
export function isValidQuery(query: string): boolean {
	return /^[ACGTURYSWKMBDHVN]+$/i.test(query);
}
