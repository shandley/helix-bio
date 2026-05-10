export interface RestrictionEnzyme {
	name: string;
	recognition: string; // IUPAC uppercase
	endType: "5p" | "3p" | "blunt";
	group: "common" | "6-cutter" | "8-cutter" | "4-cutter";
}

export const RESTRICTION_ENZYMES: RestrictionEnzyme[] = [
	// ── Common lab workhorses ────────────────────────────────────────────
	{ name: "EcoRI", recognition: "GAATTC", endType: "5p", group: "common" },
	{ name: "BamHI", recognition: "GGATCC", endType: "5p", group: "common" },
	{ name: "HindIII", recognition: "AAGCTT", endType: "5p", group: "common" },
	{ name: "XhoI", recognition: "CTCGAG", endType: "5p", group: "common" },
	{ name: "NcoI", recognition: "CCATGG", endType: "5p", group: "common" },
	{ name: "NheI", recognition: "GCTAGC", endType: "5p", group: "common" },
	{ name: "XbaI", recognition: "TCTAGA", endType: "5p", group: "common" },
	{ name: "SalI", recognition: "GTCGAC", endType: "5p", group: "common" },
	{ name: "KpnI", recognition: "GGTACC", endType: "3p", group: "common" },
	{ name: "SacI", recognition: "GAGCTC", endType: "3p", group: "common" },
	{ name: "PstI", recognition: "CTGCAG", endType: "3p", group: "common" },
	{ name: "SphI", recognition: "GCATGC", endType: "3p", group: "common" },
	{ name: "BglII", recognition: "AGATCT", endType: "5p", group: "common" },
	{ name: "SpeI", recognition: "ACTAGT", endType: "5p", group: "common" },
	{ name: "AgeI", recognition: "ACCGGT", endType: "5p", group: "common" },
	{ name: "MluI", recognition: "ACGCGT", endType: "5p", group: "common" },
	{ name: "ClaI", recognition: "ATCGAT", endType: "5p", group: "common" },
	{ name: "BsrGI", recognition: "TGTACA", endType: "5p", group: "common" },
	{ name: "AvrII", recognition: "CCTAGG", endType: "5p", group: "common" },
	{ name: "EcoRV", recognition: "GATATC", endType: "blunt", group: "common" },
	{ name: "SmaI", recognition: "CCCGGG", endType: "blunt", group: "common" },
	{ name: "PvuII", recognition: "CAGCTG", endType: "blunt", group: "common" },
	{ name: "ScaI", recognition: "AGTACT", endType: "blunt", group: "common" },
	// ── Additional 6-cutters ─────────────────────────────────────────────
	{ name: "AflII", recognition: "CTTAAG", endType: "5p", group: "6-cutter" },
	{ name: "ApoI", recognition: "RAATTY", endType: "5p", group: "6-cutter" },
	{ name: "BspEI", recognition: "TCCGGA", endType: "5p", group: "6-cutter" },
	{ name: "BstBI", recognition: "TTCGAA", endType: "5p", group: "6-cutter" },
	{ name: "ClaI", recognition: "ATCGAT", endType: "5p", group: "6-cutter" },
	{ name: "DraI", recognition: "TTTAAA", endType: "blunt", group: "6-cutter" },
	{ name: "HpaI", recognition: "GTTAAC", endType: "blunt", group: "6-cutter" },
	{ name: "MluI", recognition: "ACGCGT", endType: "5p", group: "6-cutter" },
	{ name: "NarI", recognition: "GGCGCC", endType: "5p", group: "6-cutter" },
	{ name: "NdeI", recognition: "CATATG", endType: "5p", group: "6-cutter" },
	{ name: "NruI", recognition: "TCGCGA", endType: "blunt", group: "6-cutter" },
	{ name: "SacII", recognition: "CCGCGG", endType: "3p", group: "6-cutter" },
	{ name: "StuI", recognition: "AGGCCT", endType: "blunt", group: "6-cutter" },
	{ name: "XmaI", recognition: "CCCGGG", endType: "5p", group: "6-cutter" },
	// ── 8-cutters (rare cutters) ─────────────────────────────────────────
	{ name: "NotI", recognition: "GCGGCCGC", endType: "5p", group: "8-cutter" },
	{ name: "AscI", recognition: "GGCGCGCC", endType: "5p", group: "8-cutter" },
	{ name: "PacI", recognition: "TTAATTAA", endType: "3p", group: "8-cutter" },
	{ name: "FseI", recognition: "GGCCGGCC", endType: "3p", group: "8-cutter" },
	{ name: "SbfI", recognition: "CCTGCAGG", endType: "3p", group: "8-cutter" },
	{ name: "SwaI", recognition: "ATTTAAAT", endType: "blunt", group: "8-cutter" },
	{ name: "SrfI", recognition: "GCCCGGGC", endType: "blunt", group: "8-cutter" },
	{ name: "PmeI", recognition: "GTTTAAAC", endType: "blunt", group: "8-cutter" },
	// ── 4-cutters (frequent) ─────────────────────────────────────────────
	{ name: "TaqI", recognition: "TCGA", endType: "5p", group: "4-cutter" },
	{ name: "MboI", recognition: "GATC", endType: "5p", group: "4-cutter" },
	{ name: "DpnI", recognition: "GATC", endType: "blunt", group: "4-cutter" },
	{ name: "NlaIII", recognition: "CATG", endType: "3p", group: "4-cutter" },
	{ name: "HaeIII", recognition: "GGCC", endType: "blunt", group: "4-cutter" },
	{ name: "AluI", recognition: "AGCT", endType: "blunt", group: "4-cutter" },
	{ name: "RsaI", recognition: "GTAC", endType: "blunt", group: "4-cutter" },
	{ name: "CfoI", recognition: "GCGC", endType: "3p", group: "4-cutter" },
	{ name: "MspI", recognition: "CCGG", endType: "5p", group: "4-cutter" },
	{ name: "HpaII", recognition: "CCGG", endType: "5p", group: "4-cutter" },
];

// IUPAC ambiguity codes → regex character class
const IUPAC: Record<string, string> = {
	A: "A",
	C: "C",
	G: "G",
	T: "T",
	R: "[AG]",
	Y: "[CT]",
	S: "[GC]",
	W: "[AT]",
	K: "[GT]",
	M: "[AC]",
	B: "[CGT]",
	D: "[AGT]",
	H: "[ACT]",
	V: "[ACG]",
	N: "[ACGT]",
};

function toRegex(recognition: string): RegExp {
	const pattern = recognition
		.toUpperCase()
		.split("")
		.map((c) => IUPAC[c] ?? c)
		.join("");
	return new RegExp(pattern, "g");
}

function reverseComplement(seq: string): string {
	const comp: Record<string, string> = {
		A: "T",
		T: "A",
		C: "G",
		G: "C",
		R: "Y",
		Y: "R",
		S: "S",
		W: "W",
		K: "M",
		M: "K",
		B: "V",
		D: "H",
		H: "D",
		V: "B",
		N: "N",
	};
	return seq
		.toUpperCase()
		.split("")
		.reverse()
		.map((c) => comp[c] ?? c)
		.join("");
}

export function countCutSites(enzyme: RestrictionEnzyme, seq: string, circular: boolean): number {
	const upper = seq.toUpperCase();
	const searchSeq = circular ? upper + upper.slice(0, enzyme.recognition.length - 1) : upper;

	const fwdRe = toRegex(enzyme.recognition);
	const fwdMatches = (searchSeq.match(fwdRe) ?? []).length;

	// Count reverse complement only if not palindromic
	const rc = reverseComplement(enzyme.recognition);
	if (rc === enzyme.recognition.toUpperCase()) return fwdMatches;

	const revRe = toRegex(rc);
	const revMatches = (searchSeq.match(revRe) ?? []).length;
	return fwdMatches + revMatches;
}

export const DEFAULT_ENZYMES = [
	"EcoRI",
	"BamHI",
	"HindIII",
	"XhoI",
	"NcoI",
	"NheI",
	"XbaI",
	"SalI",
	"KpnI",
	"SacI",
];

export const GROUP_LABELS: Record<RestrictionEnzyme["group"], string> = {
	common: "Common",
	"6-cutter": "6-cutters",
	"8-cutter": "8-cutters (rare)",
	"4-cutter": "4-cutters (frequent)",
};

export const END_TYPE_LABEL: Record<RestrictionEnzyme["endType"], string> = {
	"5p": "5′ overhang",
	"3p": "3′ overhang",
	blunt: "blunt",
};
