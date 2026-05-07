export interface BioAnnotation {
	start: number;
	end: number;
	name: string;
	direction: 1 | -1;
	color: string;
	type: string;
}

export interface ParsedSequence {
	name: string;
	seq: string;
	annotations: BioAnnotation[];
	topology: "circular" | "linear";
}

const FEATURE_COLORS: Record<string, string> = {
	CDS: "#85DAE9",
	gene: "#75D7A0",
	rep_origin: "#FFC569",
	promoter: "#FF9494",
	terminator: "#C9B4FF",
	regulatory: "#FFD580",
	primer_bind: "#75D7A0",
	misc_feature: "#ABD9FF",
	LTR: "#FFB347",
	polyA_signal: "#C9B4FF",
	enhancer: "#FF9494",
	intron: "#D3D3D3",
	exon: "#85DAE9",
	"5'UTR": "#ABD9FF",
	"3'UTR": "#ABD9FF",
	sig_peptide: "#FFC569",
	mat_peptide: "#85DAE9",
	transit_peptide: "#FFC569",
};

function parseLocation(raw: string): { start: number; end: number; direction: 1 | -1 } | null {
	const isComplement = raw.includes("complement");
	// Strip all operators — we just want the numeric positions
	const stripped = raw.replace(/complement\(|\)|join\(|order\(|<|>/g, "");
	const nums: number[] = [];
	for (const part of stripped.split(/[,..]+/)) {
		const n = parseInt(part.trim(), 10);
		if (!isNaN(n)) nums.push(n);
	}
	if (nums.length === 0) return null;
	return {
		start: Math.min(...nums) - 1, // SeqViz is 0-based
		end: Math.max(...nums),
		direction: isComplement ? -1 : 1,
	};
}

function extractQualifierValue(qualifiers: string[], keys: string[]): string | null {
	for (const key of keys) {
		for (const q of qualifiers) {
			// Match /key="value" or /key=value
			const m = q.match(new RegExp(`/${key}="?([^"\\n]+)"?`));
			if (m?.[1]) return m[1].trim();
		}
	}
	return null;
}

export function parseGenBank(content: string): ParsedSequence {
	const lines = content.split("\n");

	// Name + topology from LOCUS line
	const locusLine = lines[0] ?? "";
	const lociParts = locusLine.replace(/^LOCUS\s+/, "").trim().split(/\s+/);
	const name = lociParts[0] ?? "Sequence";
	const topology: "circular" | "linear" = locusLine.toLowerCase().includes("circular")
		? "circular"
		: "linear";

	// Sequence from ORIGIN section
	const originIdx = content.indexOf("\nORIGIN");
	const endIdx = content.lastIndexOf("//");
	let seq = "";
	if (originIdx !== -1) {
		const originText = endIdx !== -1 ? content.slice(originIdx + 7, endIdx) : content.slice(originIdx + 7);
		seq = originText.replace(/[\d\s]/g, "").toUpperCase();
	}

	// Features section
	const annotations: BioAnnotation[] = [];
	const featuresIdx = content.indexOf("\nFEATURES");
	const featuresEnd = originIdx !== -1 ? originIdx : endIdx !== -1 ? endIdx : content.length;

	if (featuresIdx !== -1) {
		const featureLines = content.slice(featuresIdx, featuresEnd).split("\n");

		let currentType = "";
		let currentLocation = "";
		let currentQualifiers: string[] = [];

		const flush = () => {
			if (!currentType || currentType === "source") return;
			const loc = parseLocation(currentLocation);
			if (!loc) return;
			const label =
				extractQualifierValue(currentQualifiers, ["label", "gene", "product", "note"]) ??
				currentType;
			annotations.push({
				...loc,
				name: label.slice(0, 60),
				type: currentType,
				color: FEATURE_COLORS[currentType] ?? "#ABD9FF",
			});
		};

		for (const line of featureLines) {
			if (!line) continue;

			// Feature line: exactly 5 spaces, then type, then location
			const featMatch = line.match(/^     (\S+)\s{1,}(\S.*)$/);
			if (featMatch && featMatch[1] !== "FEATURES") {
				flush();
				currentType = featMatch[1];
				currentLocation = featMatch[2].trim();
				currentQualifiers = [];
				continue;
			}

			if (!currentType) continue;

			const trimmed = line.trimStart();
			if (trimmed.startsWith("/")) {
				// New qualifier
				currentQualifiers.push(trimmed);
			} else if (trimmed && !trimmed.startsWith("FEATURES") && currentQualifiers.length === 0) {
				// Location continuation (no qualifiers yet)
				currentLocation += trimmed;
			} else if (currentQualifiers.length > 0 && trimmed && !trimmed.startsWith("/")) {
				// Multi-line qualifier value continuation
				const last = currentQualifiers.length - 1;
				currentQualifiers[last] = (currentQualifiers[last] ?? "") + trimmed;
			}
		}
		flush();
	}

	return { name, seq, annotations, topology };
}
