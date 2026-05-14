// Monoisotopic average residue masses (Da)
const AA_MASS: Record<string, number> = {
	A: 89.09,
	R: 174.2,
	N: 132.12,
	D: 133.1,
	C: 121.16,
	E: 147.13,
	Q: 146.15,
	G: 75.03,
	H: 155.16,
	I: 131.17,
	L: 131.17,
	K: 146.19,
	M: 149.21,
	F: 165.19,
	P: 115.13,
	S: 105.09,
	T: 119.12,
	W: 204.23,
	Y: 181.19,
	V: 117.15,
};

const HYDROPHOBIC = new Set(["A", "V", "I", "L", "M", "F", "W", "P"]);
const POLAR = new Set(["S", "T", "N", "Q", "C", "Y"]);
const POSITIVE = new Set(["K", "R", "H"]);
const NEGATIVE = new Set(["D", "E"]);

export type AACategory =
	| "hydrophobic"
	| "polar"
	| "positive"
	| "negative"
	| "special"
	| "stop"
	| "start";

export function aaCategory(aa: string, isFirst: boolean): AACategory {
	if (aa === "*") return "stop";
	if (isFirst && aa === "M") return "start";
	if (HYDROPHOBIC.has(aa)) return "hydrophobic";
	if (POLAR.has(aa)) return "polar";
	if (POSITIVE.has(aa)) return "positive";
	if (NEGATIVE.has(aa)) return "negative";
	return "special";
}

export interface Codon {
	nt: string;
	aa: string;
	cat: AACategory;
}

export function translateCodons(nt: string): Codon[] {
	const codons: Codon[] = [];
	const upper = nt.toUpperCase();
	for (let i = 0; i + 2 < upper.length; i += 3) {
		const triplet = upper.slice(i, i + 3);
		const aa = CODON_TABLE[triplet] ?? "X";
		codons.push({ nt: triplet, aa, cat: aaCategory(aa, i === 0) });
		if (aa === "*") break;
	}
	return codons;
}

const RC_MAP: Record<string, string> = { A: "T", T: "A", G: "C", C: "G", N: "N" };

export function reverseComplementSeq(seq: string): string {
	let out = "";
	for (let i = seq.length - 1; i >= 0; i--) out += RC_MAP[seq[i]!.toUpperCase()] ?? "N";
	return out;
}

export function extractCDS(
	seq: string,
	start: number,
	end: number,
	direction: 1 | -1,
): { nt: string; spansOrigin: boolean } {
	const spansOrigin = end - start > seq.length * 0.8;
	const nt =
		direction === -1
			? reverseComplementSeq(seq.slice(Math.max(0, start), Math.min(seq.length, end)))
			: seq.slice(Math.max(0, start), Math.min(seq.length, end));
	return { nt, spansOrigin };
}

export function estimateMW(codons: Codon[]): number {
	const residues = codons.filter((c) => c.aa !== "*");
	const daltons = residues.reduce((sum, c) => sum + (AA_MASS[c.aa] ?? 110), 18.02);
	return daltons / 1000;
}

const CODON_TABLE: Record<string, string> = {
	TTT: "F",
	TTC: "F",
	TTA: "L",
	TTG: "L",
	CTT: "L",
	CTC: "L",
	CTA: "L",
	CTG: "L",
	ATT: "I",
	ATC: "I",
	ATA: "I",
	ATG: "M",
	GTT: "V",
	GTC: "V",
	GTA: "V",
	GTG: "V",
	TCT: "S",
	TCC: "S",
	TCA: "S",
	TCG: "S",
	CCT: "P",
	CCC: "P",
	CCA: "P",
	CCG: "P",
	ACT: "T",
	ACC: "T",
	ACA: "T",
	ACG: "T",
	GCT: "A",
	GCC: "A",
	GCA: "A",
	GCG: "A",
	TAT: "Y",
	TAC: "Y",
	TAA: "*",
	TAG: "*",
	CAT: "H",
	CAC: "H",
	CAA: "Q",
	CAG: "Q",
	AAT: "N",
	AAC: "N",
	AAA: "K",
	AAG: "K",
	GAT: "D",
	GAC: "D",
	GAA: "E",
	GAG: "E",
	TGT: "C",
	TGC: "C",
	TGA: "*",
	TGG: "W",
	CGT: "R",
	CGC: "R",
	CGA: "R",
	CGG: "R",
	AGT: "S",
	AGC: "S",
	AGA: "R",
	AGG: "R",
	GGT: "G",
	GGC: "G",
	GGA: "G",
	GGG: "G",
};

/** Translate a DNA sequence to a protein string. Stops at first stop codon unless readThrough=true. */
export function translate(dna: string, readThrough = false): string {
	const upper = dna.toUpperCase().replace(/[^ATGCN]/g, "");
	let protein = "";
	for (let i = 0; i + 3 <= upper.length; i += 3) {
		const codon = upper.slice(i, i + 3);
		const aa = CODON_TABLE[codon] ?? "X";
		if (aa === "*") {
			if (!readThrough) break;
			protein += "*";
		} else {
			protein += aa;
		}
	}
	return protein;
}

/**
 * Format a protein string for display: groups of 10 aa separated by spaces,
 * with position numbers on the left every 50 aa.
 */
export function formatProtein(protein: string, groupSize = 10): string {
	const groups: string[] = [];
	for (let i = 0; i < protein.length; i += groupSize) {
		groups.push(protein.slice(i, i + groupSize));
	}
	const lines: string[] = [];
	for (let i = 0; i < groups.length; i += 5) {
		const lineNum = String(i * groupSize + 1).padStart(6, " ");
		lines.push(`${lineNum}  ${groups.slice(i, i + 5).join(" ")}`);
	}
	return lines.join("\n");
}
