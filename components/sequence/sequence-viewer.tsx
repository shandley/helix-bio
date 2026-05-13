"use client";

import type { PrimerPair } from "@shandley/primd";
import SeqViz from "seqviz";
import type { ParsedSequence } from "@/lib/bio/parse-genbank";
import { AccessibilityTrack } from "./accessibility-track";
import { LinearMap } from "./linear-map";

export interface SeqVizSelection {
	start: number;
	end: number;
	sequence: string;
	length: number;
	/** Annotation name — present when an annotation was clicked, not when dragging sequence */
	name?: string;
	/** "ANNOTATION" when an annotation was clicked, "SEQ" for a sequence drag */
	type?: string;
}

interface SequenceViewerProps {
	parsed: ParsedSequence;
	topology: "circular" | "linear";
	enzymes: string[];
	selection?: SeqVizSelection | null;
	onSelection?: (sel: SeqVizSelection | null) => void;
	primerPair?: PrimerPair | null;
}

export function SequenceViewer({
	parsed,
	topology,
	enzymes,
	selection,
	onSelection,
	primerPair,
}: SequenceViewerProps) {
	const seqvizAnnotations = [
		...parsed.annotations.map(({ start, end, name, color, direction }) => ({
			start,
			end,
			name,
			color,
			direction,
		})),
		...(primerPair
			? [
					{
						start: primerPair.fwd.start,
						end: primerPair.fwd.end,
						name: "→ Fwd",
						color: "#3b82f6",
						direction: 1 as const,
					},
					{
						start: primerPair.rev.start,
						end: primerPair.rev.end,
						name: "← Rev",
						color: "#a855f7",
						direction: -1 as const,
					},
				]
			: []),
	];

	// For linear sequences, position clicks from the overview map scroll SeqViz
	// by setting a selection at that position (SeqViz will scroll to show it).
	const handleLinearMapClick = (pos: number) => {
		if (onSelection) {
			onSelection({ start: pos, end: pos + 1, sequence: "", length: 1 });
		}
	};

	return (
		<div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
			{/* Linear overview map — only for linear sequences */}
			{topology === "linear" && (
				<LinearMap
					seq={parsed.seq}
					annotations={seqvizAnnotations.map((a) => ({
						start: a.start,
						end: a.end,
						name: a.name,
						color: a.color ?? "#6b7280",
						direction: (a.direction ?? 1) as 1 | -1,
						type: "misc_feature",
					}))}
					onPositionSelect={handleLinearMapClick}
				/>
			)}

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
			<AccessibilityTrack seq={parsed.seq} selection={selection} primerPair={primerPair} />
		</div>
	);
}
