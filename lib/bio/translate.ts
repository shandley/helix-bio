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
