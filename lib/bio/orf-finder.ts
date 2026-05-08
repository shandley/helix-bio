export interface ORF {
	start: number;         // 0-indexed, start of ATG in original sequence coords
	end: number;           // 0-indexed, exclusive, end of stop codon
	strand: 1 | -1;
	frame: 0 | 1 | 2;     // reading frame (0, 1, or 2)
	length: number;        // bp (includes stop codon)
	proteinLength: number; // amino acids (excludes stop)
}

const STOP = new Set(["TAA", "TAG", "TGA"]);

function revComp(seq: string): string {
	const comp: Record<string, string> = { A: "T", T: "A", C: "G", G: "C", N: "N" };
	return seq.toUpperCase().split("").reverse().map((c) => comp[c] ?? "N").join("");
}

function scanStrand(seq: string, strand: 1 | -1, seqLen: number, minBp: number): ORF[] {
	const orfs: ORF[] = [];

	for (let frame = 0; frame < 3; frame++) {
		let i = frame;
		while (i + 3 <= seq.length) {
			if (seq.slice(i, i + 3) === "ATG") {
				let j = i + 3;
				while (j + 3 <= seq.length) {
					if (STOP.has(seq.slice(j, j + 3))) {
						const len = j + 3 - i;
						if (len >= minBp) {
							if (strand === 1) {
								orfs.push({ start: i, end: j + 3, strand, frame: frame as 0 | 1 | 2, length: len, proteinLength: len / 3 - 1 });
							} else {
								// Convert reverse-complement coords back to forward coords
								orfs.push({ start: seqLen - (j + 3), end: seqLen - i, strand, frame: frame as 0 | 1 | 2, length: len, proteinLength: len / 3 - 1 });
							}
						}
						break;
					}
					j += 3;
				}
			}
			i += 3;
		}
	}

	return orfs;
}

/**
 * Find ORFs in all 6 reading frames.
 * @param minBp Minimum ORF length in bp (default 100 = ~33 aa).
 */
export function findORFs(seq: string, minBp = 100): ORF[] {
	const upper = seq.toUpperCase().replace(/[^ATGCN]/g, "");
	const fwd = scanStrand(upper, 1, upper.length, minBp);
	const rc = revComp(upper);
	const rev = scanStrand(rc, -1, upper.length, minBp);
	return [...fwd, ...rev].sort((a, b) => a.start - b.start);
}
