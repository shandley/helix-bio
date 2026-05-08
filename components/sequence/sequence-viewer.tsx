"use client";

import SeqViz from "seqviz";
import type { ParsedSequence } from "@/lib/bio/parse-genbank";

interface SequenceViewerProps {
	parsed: ParsedSequence;
	topology: "circular" | "linear";
	enzymes: string[];
}

export function SequenceViewer({ parsed, topology, enzymes }: SequenceViewerProps) {
	const seqvizAnnotations = parsed.annotations.map(({ start, end, name, color, direction }) => ({
		start,
		end,
		name,
		color,
		direction,
	}));

	return (
		<div className="h-full w-full">
			<SeqViz
				name={parsed.name}
				seq={parsed.seq}
				annotations={seqvizAnnotations}
				viewer={topology === "circular" ? "both" : "linear"}
				style={{ height: "100%", width: "100%" }}
				showIndex
				showComplement
				enzymes={enzymes}
			/>
		</div>
	);
}
