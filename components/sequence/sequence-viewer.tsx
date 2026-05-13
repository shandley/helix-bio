"use client";

import type { PrimerPair } from "@shandley/primd";
import SeqViz from "seqviz";
import { useRef } from "react";
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

	// Ref to the SeqViz wrapper so we can query its internal DOM
	const seqvizWrapRef = useRef<HTMLDivElement>(null);

	// For linear sequences, clicking the overview map scrolls SeqViz's internal
	// scroller (class "la-vz-linear-scroller") to the proportional position.
	const handleLinearMapClick = (pos: number) => {
		// Visual: set selection for cursor feedback in both views
		if (onSelection) {
			onSelection({ start: pos, end: pos + 1, sequence: "", length: 1 });
		}
		// Scroll: find SeqViz's internal scrollable container and scroll it
		const scroller = seqvizWrapRef.current?.querySelector(".la-vz-linear-scroller");
		if (scroller && parsed.seq.length > 0) {
			const ratio = pos / parsed.seq.length;
			const target = ratio * (scroller.scrollHeight - scroller.clientHeight);
			scroller.scrollTo({ top: target, behavior: "smooth" });
		}
	};

	return (
		<div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
			{/* Linear map panel — visually distinct overview for linear sequences */}
			{topology === "linear" && (
				<div
					style={{
						flexShrink: 0,
						borderBottom: "2px solid #ddd8ce",
						background: "#fff",
					}}
				>
					{/* Panel header */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							padding: "4px 12px",
							background: "#f5f0e8",
							borderBottom: "1px solid #ddd8ce",
						}}
					>
						<span
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "8px",
								letterSpacing: "0.12em",
								textTransform: "uppercase",
								color: "#5a5648",
							}}
						>
							Linear Map
						</span>
						<span
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "8px",
								color: "#9a9284",
							}}
						>
							{parsed.seq.length >= 1000
								? `${(parsed.seq.length / 1000).toFixed(1)} kb`
								: `${parsed.seq.length} bp`}
						</span>
					</div>
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
						selectionStart={selection?.start}
						selectionEnd={selection?.end}
						onPositionSelect={handleLinearMapClick}
					/>
				</div>
			)}

			{/* Sequence map — takes all remaining height */}
			<div ref={seqvizWrapRef} style={{ flex: 1, overflow: "hidden" }}>
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
