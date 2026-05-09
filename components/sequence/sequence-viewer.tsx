"use client";

import SeqViz from "seqviz";
import type { ParsedSequence } from "@/lib/bio/parse-genbank";
import { AccessibilityTrack } from "./accessibility-track";

export interface SeqVizSelection {
	start: number;
	end: number;
	sequence: string;
	length: number;
}

interface SequenceViewerProps {
	parsed: ParsedSequence;
	topology: "circular" | "linear";
	enzymes: string[];
	selection?: SeqVizSelection | null;
	onSelection?: (sel: SeqVizSelection | null) => void;
}

export function SequenceViewer({ parsed, topology, enzymes, selection, onSelection }: SequenceViewerProps) {
	const seqvizAnnotations = parsed.annotations.map(({ start, end, name, color, direction }) => ({
		start,
		end,
		name,
		color,
		direction,
	}));

	return (
		<div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
			{/* Sequence map — takes all remaining height */}
			<div style={{ flex: 1, overflow: "hidden" }}>
				<SeqViz
					name={parsed.name}
					seq={parsed.seq}
					annotations={seqvizAnnotations}
					viewer={topology === "circular" ? "both" : "linear"}
					style={{ height: "100%", width: "100%" }}
					showIndex
					showComplement
					enzymes={enzymes}
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					onSelection={(sel: any) => {
						if (onSelection) {
							const s = sel as SeqVizSelection;
							onSelection(s.length > 0 ? s : null);
						}
					}}
				/>
			</div>

			{/* Accessibility heat map — fixed-height strip below the map */}
			<AccessibilityTrack
				seq={parsed.seq}
				selection={selection}
			/>
		</div>
	);
}
